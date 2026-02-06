import { Selection } from "../selection";
import { CSNode, TAGS, createCSNode, isTokenNode, getTokenData } from "../csTree/types";
import { ABCContext, TT } from "abc-parser";
import { noteToRest, chordToRest } from "./toRest";
import { addVoice } from "./addVoice";
import { findFirstByTag } from "../selectors/treeWalk";
import {
  groupElementsBySourceLine,
  reassignIds,
  findTuneBody,
  findTargetNote,
  nodeOrDescendantInSet,
} from "./lineUtils";

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
      if (nodeOrDescendantInSet(elem, selectedIds)) {
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
          if (valueChild !== null) {
            const declaredId = extractVoiceIdFromValueChild(valueChild);
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
 * Extracts the voice ID from a value child node.
 * Because the CSTree may contain KV expressions (from value2 preservation),
 * we need to handle both token and KV cases.
 */
function extractVoiceIdFromValueChild(valueChild: CSNode): string | null {
  // Handle token children (legacy format or simple values)
  if (isTokenNode(valueChild)) {
    const lexeme = getTokenData(valueChild).lexeme.trim();
    const firstWord = lexeme.split(/\s+/)[0];
    return firstWord || null;
  }

  // Handle KV expression children (new format with value2)
  // For voice IDs like "ExistingVoice" in "V:ExistingVoice", the KV has just a value.
  if (valueChild.tag === TAGS.KV) {
    let child = valueChild.firstChild;
    let lastChild: CSNode | null = null;
    while (child) {
      lastChild = child;
      child = child.nextSibling;
    }
    if (lastChild && isTokenNode(lastChild)) {
      return getTokenData(lastChild).lexeme.trim();
    }
  }

  return null;
}

/**
 * Finds the Tune_header in the tree.
 */
function findTuneHeader(root: CSNode): CSNode | null {
  return findFirstByTag(root, TAGS.Tune_header);
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
