// Retrograde Transform
// Reverses the sequence of pitches across the selection

import { isNote, isChord, isPitch, Expr, Note, Chord, Pitch } from "abc-parser";
import { Selection, TransformFn } from "../types";

/**
 * Retrograde transform - reverses the sequence of pitches.
 *
 * The transform collects all pitches from selected nodes in sequence order,
 * reverses the pitch data, and writes it back to the nodes in their original
 * positions. This preserves tree structure while reversing musical content.
 *
 * Usage: retrograde
 * Example: C D E F becomes F E D C
 *
 * For chords, the entire chord is treated as a single position, and its
 * pitches are swapped with the pitches at the corresponding reversed position.
 */
export const retrograde: TransformFn = (
  selection: Selection,
  _args: unknown[]
): void => {
  // Collect all selected nodes that contain pitches, in order
  const nodesWithPitches = collectNodesInOrder(selection);

  if (nodesWithPitches.length <= 1) {
    // Nothing to reverse
    return;
  }

  // Extract pitch data from all nodes
  const pitchData = nodesWithPitches.map((node) => extractPitchData(node));

  // Reverse the pitch data array
  const reversedPitchData = [...pitchData].reverse();

  // Write the reversed pitch data back to the original nodes
  for (let i = 0; i < nodesWithPitches.length; i++) {
    applyPitchData(nodesWithPitches[i], reversedPitchData[i]);
  }
};

// ============================================================================
// Types for pitch data extraction
// ============================================================================

/**
 * Pitch data that can be extracted and reapplied.
 * For a single note, this is the Pitch object.
 * For a chord, this is an array of Pitch objects.
 */
type PitchData = Pitch | Pitch[];

// ============================================================================
// Helper functions
// ============================================================================

/**
 * Collect selected nodes that contain pitches, maintaining their order.
 * We need to process in sequence order to properly reverse.
 */
function collectNodesInOrder(selection: Selection): Expr[] {
  // The selected Set doesn't maintain order, but we need to process in sequence.
  // We'll iterate through the AST and collect only nodes that are in the selection.
  const orderedNodes: Expr[] = [];
  const selectedSet = selection.selected;

  // Walk the AST in sequence order
  for (const content of selection.ast.contents) {
    if (content instanceof Object && "tune_body" in content) {
      const tune = content;
      if (!tune.tune_body) continue;

      for (const system of tune.tune_body.sequence) {
        for (const element of system) {
          collectFromElement(element, selectedSet, orderedNodes);
        }
      }
    }
  }

  return orderedNodes;
}

function collectFromElement(
  element: unknown,
  selectedSet: Set<Expr>,
  result: Expr[]
): void {
  if (!(element instanceof Object) || element === null) return;

  const expr = element as Expr;

  // Check if this element is selected
  if (selectedSet.has(expr)) {
    if (isNote(expr) || isChord(expr)) {
      result.push(expr);
    }
  }

  // Recurse into containers
  if ("contents" in element) {
    const container = element as { contents: unknown[] };
    for (const child of container.contents) {
      collectFromElement(child, selectedSet, result);
    }
  }

  if ("notes" in element) {
    const graceGroup = element as { notes: unknown[] };
    for (const child of graceGroup.notes) {
      collectFromElement(child, selectedSet, result);
    }
  }
}

/**
 * Extract pitch data from a note or chord.
 */
function extractPitchData(node: Expr): PitchData {
  if (isNote(node)) {
    if (isPitch(node.pitch)) {
      return clonePitch(node.pitch);
    }
    // Return a placeholder for non-pitch notes (shouldn't happen in normal cases)
    throw new Error("Note without pitch encountered in retrograde");
  }

  if (isChord(node)) {
    const pitches: Pitch[] = [];
    for (const element of node.contents) {
      if (isNote(element)) {
        if (isPitch(element.pitch)) {
          pitches.push(clonePitch(element.pitch));
        }
      }
    }
    return pitches;
  }

  throw new Error(`Unexpected node type in retrograde: ${(node as { constructor: { name: string } }).constructor.name}`);
}

/**
 * Apply pitch data to a note or chord.
 */
function applyPitchData(node: Expr, data: PitchData): void {
  if (isNote(node)) {
    if (Array.isArray(data)) {
      // Chord data being applied to a single note - use first pitch
      if (data.length > 0) {
        node.pitch = data[0];
      }
    } else {
      node.pitch = data;
    }
    return;
  }

  if (isChord(node)) {
    const pitches = Array.isArray(data) ? data : [data];

    let pitchIndex = 0;
    for (const element of node.contents) {
      if (isNote(element) && pitchIndex < pitches.length) {
        element.pitch = pitches[pitchIndex];
        pitchIndex++;
      }
    }
    return;
  }
}

/**
 * Clone a Pitch object so we don't share references.
 */
function clonePitch(pitch: Pitch): Pitch {
  // Create a new Pitch with the same token references
  // We clone the token references to avoid modifying the original
  return new Pitch(pitch.id, {
    alteration: pitch.alteration,
    noteLetter: pitch.noteLetter,
    octave: pitch.octave,
  });
}

export default retrograde;
