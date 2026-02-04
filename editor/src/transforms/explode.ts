import { Selection } from "../selection";
import { CSNode, TAGS, createCSNode } from "../csTree/types";
import { ABCContext } from "abc-parser";
import { noteToRest, chordToRest } from "./toRest";
import { unwrapSingle } from "./unwrapSingle";
import { consolidateRests } from "./consolidateRests";
import {
  groupElementsBySourceLine,
  reassignIds,
  findTuneBody,
  collectNotesFromChord,
  nodeOrDescendantInSet,
} from "./lineUtils";

/**
 * Filters a chord to keep only the note at the specified part index.
 * Part index 0 keeps the top note (last in the array), index 1 keeps the second from top, etc.
 * If the chord has fewer notes than partIndex+1, the chord is converted to a rest.
 */
function filterChordToPart(chordNode: CSNode, partIndex: number, ctx: ABCContext): void {
  const notes = collectNotesFromChord(chordNode);
  const noteIndex = (notes.length - 1) - partIndex;

  if (noteIndex < 0) {
    // The chord doesn't have enough notes for this part - convert to rest
    chordToRest(chordNode, ctx);
    return;
  }

  // Remove all notes except the one at noteIndex
  let prev: CSNode | null = null;
  let current = chordNode.firstChild;

  while (current !== null) {
    const next = current.nextSibling;

    if (current.tag === TAGS.Note) {
      if (current !== notes[noteIndex]) {
        // Remove this note from the chord
        if (prev === null) {
          chordNode.firstChild = next;
        } else {
          prev.nextSibling = next;
        }
        current.nextSibling = null;
        // Don't update prev since we removed current
      } else {
        prev = current;
      }
    } else {
      prev = current;
    }

    current = next;
  }
}

/**
 * Removes grace groups from the sibling chain for parts other than part 0.
 * Grace groups ornament the top voice, so they are only kept in part 0.
 *
 * @param parent - The parent node containing the sibling chain
 * @param partIndex - The voice part index (0 = top voice)
 */
function removeGraceGroupsForLowerParts(parent: CSNode, partIndex: number): void {
  if (partIndex === 0) {
    return; // Keep grace groups for top voice
  }

  let prev: CSNode | null = null;
  let current = parent.firstChild;

  while (current !== null) {
    const next = current.nextSibling;

    if (current.tag === TAGS.Grace_group) {
      // Remove grace group from the sibling chain
      if (prev === null) {
        parent.firstChild = next;
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
 * Walks the sibling chain starting from the given node and filters elements
 * based on the part index. Chords are filtered to keep only the note at the
 * part index, and standalone notes are converted to rests for parts > 0.
 * Grace groups are removed for parts > 0 (they ornament the top voice only).
 * Recurses into Beam containers.
 *
 * @param treeRoot - The root of the entire CSNode tree, needed for unwrapSingle to find parents correctly
 * @param startNode - The first node in the sibling chain to process
 * @param partIndex - The voice part index (0 = top voice)
 * @param ctx - The ABC context for generating IDs
 */
function walkAndFilter(treeRoot: CSNode, startNode: CSNode | null, partIndex: number, ctx: ABCContext): void {
  // First, remove grace groups for lower parts (must be done before note-to-rest conversion)
  removeGraceGroupsForLowerParts(treeRoot, partIndex);

  let current = startNode;

  while (current !== null) {
    const next = current.nextSibling;

    if (current.tag === TAGS.Chord) {
      filterChordToPart(current, partIndex, ctx);
      // If the chord now has only one note, unwrap it
      const remainingNotes = collectNotesFromChord(current);
      if (remainingNotes.length === 1 && current.tag === TAGS.Chord) {
        // Use the actual tree root so unwrapSingle can find the parent correctly
        const tempSelection: Selection = {
          root: treeRoot,
          cursors: [new Set([current.id])],
        };
        unwrapSingle(tempSelection);
      }
    } else if (current.tag === TAGS.Note) {
      if (partIndex > 0) {
        noteToRest(current, ctx);
      }
    } else if (current.tag === TAGS.Beam || current.tag === TAGS.Tuplet) {
      // Recurse into container children - also remove grace groups inside
      removeGraceGroupsForLowerParts(current, partIndex);
      walkAndFilter(treeRoot, current.firstChild, partIndex, ctx);
    }

    current = next;
  }
}

/**
 * Collects all node IDs from a sibling chain, recursing into children.
 */
function collectSiblingIds(startNode: CSNode | null): Set<number> {
  const ids = new Set<number>();
  let current = startNode;
  while (current !== null) {
    ids.add(current.id);
    if (current.firstChild) {
      for (const childId of collectSiblingIds(current.firstChild)) {
        ids.add(childId);
      }
    }
    current = current.nextSibling;
  }
  return ids;
}

/**
 * Explodes a selection into multiple voice parts.
 * Creates partCount copies of the selected line(s), where each copy contains
 * only the notes belonging to that voice part:
 * - Part 0: top notes of chords + standalone notes
 * - Part 1: second-from-top notes of chords, rests for standalone notes
 * - Part N: Nth-from-top notes of chords, rests for standalone notes
 *
 * The original line is preserved, and new lines are inserted after it.
 * Consecutive rests in each created line are consolidated.
 *
 * Returns a new Selection where each cursor contains all element IDs
 * from one created line (in document order).
 */
export function explode(
  selection: Selection,
  partCount: number,
  ctx: ABCContext
): Selection {
  if (partCount < 1) {
    return selection;
  }

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

  // Accumulate cursors for each created line
  const createdLineCursors: Set<number>[] = [];

  // Process each line that has selections
  for (const lineNum of sortedLines) {
    const elements = elementsByLine.get(lineNum);
    if (!elements || elements.length === 0) continue;

    // Create partCount copies, from last to first (so they end up in order)
    for (let partIndex = partCount - 1; partIndex >= 0; partIndex--) {
      // Clone all elements on this line
      const clonedElements: CSNode[] = elements.map(e => structuredClone(e));

      // Link the cloned elements together
      for (let i = 0; i < clonedElements.length - 1; i++) {
        clonedElements[i].nextSibling = clonedElements[i + 1];
      }
      clonedElements[clonedElements.length - 1].nextSibling = null;

      // Reassign IDs to all cloned elements
      for (const cloned of clonedElements) {
        reassignIds(cloned, ctx);
      }

      // Create a System node to hold the cloned chain during processing.
      // This allows unwrapSingle to find the parent of chords correctly.
      const systemNode = createCSNode(TAGS.System, ctx.generateId(), { type: "empty" });
      systemNode.firstChild = clonedElements[0];

      // Walk and filter the cloned elements
      walkAndFilter(systemNode, systemNode.firstChild, partIndex, ctx);

      // Consolidate consecutive rests in the processed chain
      const allIds = collectSiblingIds(systemNode.firstChild);
      const lineSelection: Selection = { root: systemNode, cursors: [allIds] };
      consolidateRests(lineSelection, ctx);

      // After consolidation, allIds has been updated (consumed IDs removed)
      createdLineCursors.push(allIds);

      // Extract the processed chain from the System node
      // (the first child may have changed if elements were promoted)
      let firstProcessed = systemNode.firstChild;
      let lastProcessed = firstProcessed;
      while (lastProcessed && lastProcessed.nextSibling) {
        lastProcessed = lastProcessed.nextSibling;
      }

      // Insert the processed chain after the last original element on this line
      if (firstProcessed) {
        const lastOriginal = elements[elements.length - 1];
        const originalNext = lastOriginal.nextSibling;
        lastOriginal.nextSibling = firstProcessed;
        if (lastProcessed) {
          lastProcessed.nextSibling = originalNext;
        }
      }
    }
  }

  // Reverse cursors to match document order (we processed lines and parts in reverse)
  createdLineCursors.reverse();

  return { root: selection.root, cursors: createdLineCursors };
}

/**
 * Explodes a selection into 2 voice parts.
 */
export function explode2(selection: Selection, ctx: ABCContext): Selection {
  return explode(selection, 2, ctx);
}

/**
 * Explodes a selection into 3 voice parts.
 */
export function explode3(selection: Selection, ctx: ABCContext): Selection {
  return explode(selection, 3, ctx);
}

/**
 * Explodes a selection into 4 voice parts.
 */
export function explode4(selection: Selection, ctx: ABCContext): Selection {
  return explode(selection, 4, ctx);
}
