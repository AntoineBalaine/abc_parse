// Transpose Transform
// Wraps the existing Transposer from abc_parse to work with the ABCT runtime

import {
  isNote,
  isChord,
  isBeam,
  isGraceGroup,
  isPitch,
} from "../../../../parse/helpers";
import { ABCContext } from "../../../../parse/parsers/Context";
import { toMidiPitch } from "../../../../parse/Visitors/Formatter2";
import { fromMidiPitch } from "../../../../parse/Visitors/Transposer";
import {
  Expr,
  Note,
  Chord,
  Beam,
  Grace_group,
  Pitch,
} from "../../../../parse/types/Expr2";
import { Selection, TransformFn } from "../types";

/**
 * Transpose transform - shifts all pitches by a number of semitones.
 *
 * Usage: transpose <semitones>
 * Example: transpose 2 (up a whole step)
 *          transpose -12 (down an octave)
 *
 * The transform mutates the AST in place, modifying only selected nodes.
 */
export const transpose: TransformFn = (
  selection: Selection,
  args: unknown[]
): void => {
  // Parse the distance argument
  const distance = parseDistance(args);
  if (distance === 0) return; // No-op for zero transposition

  // Create a context for generating new tokens
  const ctx = new ABCContext();

  // Process each selected node
  for (const node of selection.selected) {
    transposeNode(node, distance, ctx);
  }
};

/**
 * Octave transform - shifts all pitches by a number of octaves.
 * This is a convenience wrapper around transpose (octave n = transpose n*12).
 *
 * Usage: octave <n>
 * Example: octave 1 (up one octave)
 *          octave -2 (down two octaves)
 */
export const octave: TransformFn = (
  selection: Selection,
  args: unknown[]
): void => {
  const octaves = parseDistance(args);
  transpose(selection, [octaves * 12]);
};

// ============================================================================
// Helper functions
// ============================================================================

function parseDistance(args: unknown[]): number {
  if (args.length === 0) {
    throw new Error("transpose requires a distance argument");
  }

  const arg = args[0];
  if (typeof arg === "number") {
    return arg;
  }
  if (typeof arg === "string") {
    const parsed = parseInt(arg, 10);
    if (isNaN(parsed)) {
      throw new Error(`Invalid transpose distance: ${arg}`);
    }
    return parsed;
  }

  throw new Error(`Invalid transpose argument type: ${typeof arg}`);
}

function transposeNode(node: Expr, distance: number, ctx: ABCContext): void {
  if (isNote(node)) {
    transposeNote(node, distance, ctx);
  } else if (isChord(node)) {
    transposeChord(node, distance, ctx);
  } else if (isBeam(node)) {
    transposeBeam(node, distance, ctx);
  } else if (isGraceGroup(node)) {
    transposeGraceGroup(node, distance, ctx);
  }
  // Other node types are ignored (rests, bar lines, etc.)
}

function transposeNote(note: Note, distance: number, ctx: ABCContext): void {
  if (isPitch(note.pitch)) {
    transposePitch(note, distance, ctx);
  }
}

function transposePitch(note: Note, distance: number, ctx: ABCContext): void {
  const pitch = note.pitch as Pitch;
  const midiPitch = toMidiPitch(pitch);
  const transposedMidiPitch = midiPitch + distance;
  const newPitch = fromMidiPitch(transposedMidiPitch, ctx);

  // Replace the pitch in place
  note.pitch = newPitch;
}

function transposeChord(chord: Chord, distance: number, ctx: ABCContext): void {
  for (const element of chord.contents) {
    if (isNote(element)) {
      transposeNote(element, distance, ctx);
    }
  }
}

function transposeBeam(beam: Beam, distance: number, ctx: ABCContext): void {
  for (const element of beam.contents) {
    if (isNote(element)) {
      transposeNote(element, distance, ctx);
    } else if (isChord(element)) {
      transposeChord(element, distance, ctx);
    } else if (isGraceGroup(element)) {
      transposeGraceGroup(element, distance, ctx);
    }
  }
}

function transposeGraceGroup(
  graceGroup: Grace_group,
  distance: number,
  ctx: ABCContext
): void {
  for (const element of graceGroup.notes) {
    if (isNote(element)) {
      transposeNote(element, distance, ctx);
    }
  }
}

export default transpose;
