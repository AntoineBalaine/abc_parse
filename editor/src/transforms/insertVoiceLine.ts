import { Selection } from "../selection";
import { CSNode, TAGS, createCSNode, isTokenNode, getTokenData } from "../csTree/types";
import { ABCContext, TT } from "abc-parser";
import { noteToRest, chordToRest } from "./toRest";
import { addVoice } from "./addVoice";
import { findFirstByTag } from "../selectors/treeWalk";

/**
 * Inserts a new voice line by duplicating lines containing selected notes.
 * Non-selected notes are converted to rests, preserving rhythm.
 * If the voice ID doesn't exist in the header, it is added automatically.
 */
export function insertVoiceLine(
  selection: Selection,
  voiceName: string,
  ctx: ABCContext
): Selection {
  // Flatten all cursor sets into a single Set of selected node IDs
  const selectedIds = new Set<number>();
  for (const cursor of selection.cursors) {
    for (const id of cursor) {
      selectedIds.add(id);
    }
  }

  if (selectedIds.size === 0) {
    return selection;
  }

  // Add voice to header if missing
  if (!voiceExistsInHeader(selection.root, voiceName)) {
    addVoice(selection, voiceName, {}, ctx);
  }

  // Find the Tune_Body
  const tuneBody = findTuneBody(selection.root);
  if (!tuneBody) {
    return selection;
  }

  // Group Tune_Body children by their source line number
  const elementsByLine = groupElementsBySourceLine(tuneBody);

  // Find which source lines contain selected nodes
  const linesWithSelection = new Set<number>();
  for (const [lineNum, elements] of elementsByLine) {
    for (const elem of elements) {
      if (nodeOrDescendantSelected(elem, selectedIds)) {
        linesWithSelection.add(lineNum);
        break;
      }
    }
  }

  // Sort line numbers in descending order to process from end to start
  const sortedLines = Array.from(linesWithSelection).sort((a, b) => b - a);

  // Process each line that has selections
  for (const lineNum of sortedLines) {
    const elements = elementsByLine.get(lineNum);
    if (!elements || elements.length === 0) continue;

    // Clone all elements on this line
    const clonedElements: CSNode[] = elements.map(e => structuredClone(e));

    // Build the cloned chain: voice marker, space, then cloned elements
    const voiceMarker = createInlineVoiceMarker(voiceName, ctx);
    const spaceAfterMarker = createCSNode(TAGS.Token, ctx.generateId(), {
      type: "token",
      lexeme: " ",
      tokenType: TT.WS,
      line: 0,
      position: 0,
    });

    // Link: voiceMarker -> space -> cloned elements
    voiceMarker.nextSibling = spaceAfterMarker;
    spaceAfterMarker.nextSibling = clonedElements[0];
    for (let i = 0; i < clonedElements.length - 1; i++) {
      clonedElements[i].nextSibling = clonedElements[i + 1];
    }
    clonedElements[clonedElements.length - 1].nextSibling = null;

    // Remove grace groups before non-selected notes (must be done before note-to-rest conversion)
    removeUnselectedGraceGroups(spaceAfterMarker, selectedIds);

    // Process cloned elements: convert non-selected to rests
    let processNode: CSNode | null = spaceAfterMarker.nextSibling;
    while (processNode !== null) {
      processElementForVoiceInsert(processNode, selectedIds, ctx);
      processNode = processNode.nextSibling;
    }

    // Reassign IDs to voice marker, space, and all cloned elements
    reassignIds(voiceMarker, ctx);
    spaceAfterMarker.id = ctx.generateId();
    for (const cloned of clonedElements) {
      reassignIds(cloned, ctx);
    }

    // Insert the cloned chain after the last original element on this line
    const lastOriginal = elements[elements.length - 1];
    const originalNext = lastOriginal.nextSibling;
    lastOriginal.nextSibling = voiceMarker;
    clonedElements[clonedElements.length - 1].nextSibling = originalNext;
  }

  return selection;
}

/**
 * Recursively collects elements from a container node into a line number map.
 * Recurses into System nodes because tune body content is wrapped in System wrapper nodes.
 */
function collectElementsByLine(parent: CSNode, result: Map<number, CSNode[]>): void {
  let current = parent.firstChild;
  while (current !== null) {
    // Recurse into System nodes to find actual content
    if (current.tag === TAGS.System) {
      collectElementsByLine(current, result);
    } else {
      const lineNum = getSourceLineNumber(current);
      if (lineNum !== -1) {
        if (!result.has(lineNum)) {
          result.set(lineNum, []);
        }
        result.get(lineNum)!.push(current);
      }
    }
    current = current.nextSibling;
  }
}

/**
 * Groups tune body elements by their source line number.
 */
function groupElementsBySourceLine(tuneBody: CSNode): Map<number, CSNode[]> {
  const result = new Map<number, CSNode[]>();
  collectElementsByLine(tuneBody, result);
  return result;
}

/**
 * Gets the source line number of a node by finding the first token in its subtree.
 * Returns -1 if no token found.
 */
function getSourceLineNumber(node: CSNode): number {
  if (isTokenNode(node)) {
    return getTokenData(node).line;
  }

  let child = node.firstChild;
  while (child !== null) {
    const lineNum = getSourceLineNumber(child);
    if (lineNum !== -1) {
      return lineNum;
    }
    child = child.nextSibling;
  }

  return -1;
}

/**
 * Recursively reassigns fresh IDs to all nodes in the subtree.
 */
function reassignIds(node: CSNode, ctx: ABCContext): void {
  node.id = ctx.generateId();
  let child = node.firstChild;
  while (child !== null) {
    reassignIds(child, ctx);
    child = child.nextSibling;
  }
}

/**
 * Finds the target note/chord/rest that a grace group ornaments,
 * skipping over intermediate elements (decorations, annotations, etc.).
 */
function findTargetNote(graceGroup: CSNode): CSNode | null {
  let current = graceGroup.nextSibling;

  while (current !== null) {
    // Found a note, chord, or rest - this is the target
    if (current.tag === TAGS.Note || current.tag === TAGS.Chord || current.tag === TAGS.Rest) {
      return current;
    }

    // Skip over intermediate elements that can appear between grace and target
    if (
      current.tag === TAGS.Decoration ||
      current.tag === TAGS.Annotation ||
      current.tag === TAGS.ChordSymbol ||
      current.tag === TAGS.Inline_field ||
      current.tag === TAGS.Token
    ) {
      current = current.nextSibling;
      continue;
    }

    // Hit a structural element (BarLine, Beam, Tuplet, etc.) - no target found
    return null;
  }

  return null;
}

/**
 * Creates an inline voice marker [V:name] as an Inline_field CSNode.
 */
function createInlineVoiceMarker(voiceName: string, ctx: ABCContext): CSNode {
  const leftBracket = createCSNode(TAGS.Token, ctx.generateId(), {
    type: "token",
    lexeme: "[",
    tokenType: TT.INLN_FLD_LFT_BRKT,
    line: 0,
    position: 0,
  });

  const field = createCSNode(TAGS.Token, ctx.generateId(), {
    type: "token",
    lexeme: "V:",
    tokenType: TT.INF_HDR,
    line: 0,
    position: 1,
  });

  const text = createCSNode(TAGS.Token, ctx.generateId(), {
    type: "token",
    lexeme: voiceName,
    tokenType: TT.INFO_STR,
    line: 0,
    position: 3,
  });

  const rightBracket = createCSNode(TAGS.Token, ctx.generateId(), {
    type: "token",
    lexeme: "]",
    tokenType: TT.INLN_FLD_RGT_BRKT,
    line: 0,
    position: 3 + voiceName.length,
  });

  const inlineField = createCSNode(TAGS.Inline_field, ctx.generateId(), { type: "empty" });
  inlineField.firstChild = leftBracket;
  leftBracket.nextSibling = field;
  field.nextSibling = text;
  text.nextSibling = rightBracket;

  return inlineField;
}

/**
 * Checks if a chord has any notes whose IDs are in the selected set.
 */
function chordHasSelectedNotes(chord: CSNode, selectedIds: Set<number>): boolean {
  let child = chord.firstChild;
  while (child !== null) {
    if (child.tag === TAGS.Note && selectedIds.has(child.id)) {
      return true;
    }
    child = child.nextSibling;
  }
  return false;
}

/**
 * Removes notes from a chord that are not in the selected set.
 */
function removeUnselectedNotesFromChord(chord: CSNode, selectedIds: Set<number>): void {
  let prev: CSNode | null = null;
  let current = chord.firstChild;

  while (current !== null) {
    const next = current.nextSibling;

    if (current.tag === TAGS.Note && !selectedIds.has(current.id)) {
      // Remove this note
      if (prev === null) {
        chord.firstChild = next;
      } else {
        prev.nextSibling = next;
      }
      current.nextSibling = null;
      // Don't update prev since we removed current
    } else {
      prev = current;
    }

    current = next;
  }
}

/**
 * Checks if a voice with the given ID exists in the tune header.
 */
function voiceExistsInHeader(root: CSNode, voiceId: string): boolean {
  const tuneHeader = findTuneHeader(root);
  if (!tuneHeader) {
    return false;
  }

  let current = tuneHeader.firstChild;
  while (current !== null) {
    if (current.tag === TAGS.Info_line) {
      const keyChild = current.firstChild;
      if (keyChild !== null && isTokenNode(keyChild)) {
        const keyData = getTokenData(keyChild);
        if (keyData.lexeme === "V:") {
          // Check if this voice line declares the voiceId
          const valueChild = keyChild.nextSibling;
          if (valueChild !== null && isTokenNode(valueChild)) {
            const valueData = getTokenData(valueChild);
            // Voice ID is the first word in the value
            const declaredId = valueData.lexeme.split(/\s+/)[0];
            if (declaredId === voiceId) {
              return true;
            }
          }
        }
      }
    }
    current = current.nextSibling;
  }

  return false;
}

/**
 * Finds the Tune_header in the tree.
 */
function findTuneHeader(root: CSNode): CSNode | null {
  return findFirstByTag(root, TAGS.Tune_header);
}

/**
 * Finds the Tune_Body in the tree.
 */
function findTuneBody(root: CSNode): CSNode | null {
  return findFirstByTag(root, TAGS.Tune_Body);
}

/**
 * Recursively checks if a node or any of its descendants has an ID in the selected set.
 */
function nodeOrDescendantSelected(node: CSNode, selectedIds: Set<number>): boolean {
  if (selectedIds.has(node.id)) {
    return true;
  }
  let child = node.firstChild;
  while (child !== null) {
    if (nodeOrDescendantSelected(child, selectedIds)) {
      return true;
    }
    child = child.nextSibling;
  }
  return false;
}

/**
 * Removes grace groups whose target notes are not selected.
 * Must be called before note-to-rest conversion because it examines the original IDs.
 * Also recursively handles grace groups inside Beam/Tuplet containers.
 */
function removeUnselectedGraceGroups(
  startNode: CSNode,
  selectedIds: Set<number>
): void {
  let prev: CSNode | null = startNode;
  let current = startNode.nextSibling;

  while (current !== null) {
    const next = current.nextSibling;

    if (current.tag === TAGS.Grace_group) {
      const targetNote = findTargetNote(current);
      let shouldRemove = false;

      if (targetNote === null) {
        // Orphan grace group with no target - keep it
        shouldRemove = false;
      } else if (targetNote.tag === TAGS.Rest) {
        // Grace group before a rest - remove it
        shouldRemove = true;
      } else if (targetNote.tag === TAGS.Note) {
        // Remove if target note is not selected
        shouldRemove = !selectedIds.has(targetNote.id);
      } else if (targetNote.tag === TAGS.Chord) {
        // Remove if chord has no selected notes
        shouldRemove = !chordHasSelectedNotes(targetNote, selectedIds);
      }

      if (shouldRemove) {
        // Remove the grace group from the sibling chain
        prev.nextSibling = next;
        current.nextSibling = null;
        current = next;
        continue;
      }
    } else if (current.tag === TAGS.Beam || current.tag === TAGS.Tuplet) {
      // Recursively handle grace groups inside containers
      // Create a dummy head to simplify removal from firstChild
      const dummyHead = createCSNode(TAGS.Token, -1, { type: "empty" });
      dummyHead.nextSibling = current.firstChild;
      removeUnselectedGraceGroups(dummyHead, selectedIds);
      current.firstChild = dummyHead.nextSibling;
    }

    prev = current;
    current = next;
  }
}

/**
 * Processes a single element for voice insertion.
 * Converts non-selected notes to rests and handles chords.
 * Grace groups should be removed before calling this function.
 */
function processElementForVoiceInsert(
  node: CSNode,
  selectedIds: Set<number>,
  ctx: ABCContext
): void {
  if (node.tag === TAGS.Note) {
    if (!selectedIds.has(node.id)) {
      noteToRest(node, ctx);
    }
  } else if (node.tag === TAGS.Chord) {
    if (!chordHasSelectedNotes(node, selectedIds)) {
      chordToRest(node, ctx);
    } else {
      removeUnselectedNotesFromChord(node, selectedIds);
    }
  } else if (node.tag === TAGS.Grace_group) {
    // Grace groups are handled by removeUnselectedGraceGroups; skip here
    return;
  }

  // Recurse into children (for Beam, Tuplet, etc.)
  let child = node.firstChild;
  while (child !== null) {
    processElementForVoiceInsert(child, selectedIds, ctx);
    child = child.nextSibling;
  }
}
