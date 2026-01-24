// Bass Transform
// Extracts the lowest note from chords (single notes are unchanged)

import { isNote, isChord, Expr, Note, Chord, Annotation, Token } from "abc-parser";
import { getNoteMidiPitch } from "../utils/pitch";
import { Selection, TransformFn } from "../types";

/**
 * Bass transform - extracts the lowest note from chords.
 *
 * For chords: keeps only the note with the lowest pitch.
 * For single notes: returns the note unchanged (no-op).
 *
 * Usage: bass
 * Example: [CEG] becomes [C] (the lowest note)
 *          [GBd] becomes [G]
 *          C remains C (single note unchanged)
 *
 * The transform mutates chords in place, keeping only the bass note.
 */
export const bass: TransformFn = (
  selection: Selection,
  _args: unknown[]
): void => {
  for (const node of selection.selected) {
    if (isChord(node)) {
      extractBassFromChord(node as Chord);
    }
    // Single notes are left unchanged (no-op per spec)
  }
};

// ============================================================================
// Helper functions
// ============================================================================

/**
 * Extract the lowest note from a chord, modifying the chord in place.
 */
function extractBassFromChord(chord: Chord): void {
  // Find all notes in the chord
  const notes: Note[] = [];
  const nonNotes: (Token | Annotation)[] = [];

  for (const element of chord.contents) {
    if (isNote(element)) {
      notes.push(element);
    } else {
      // Keep non-note elements (tokens like brackets, annotations)
      nonNotes.push(element as Token | Annotation);
    }
  }

  if (notes.length <= 1) {
    // Already has only one note (or none), nothing to do
    return;
  }

  // Find the lowest note by MIDI pitch
  let lowestNote = notes[0];
  let lowestPitch = getNoteMidiPitch(lowestNote);

  for (let i = 1; i < notes.length; i++) {
    const note = notes[i];
    const pitch = getNoteMidiPitch(note);
    if (pitch < lowestPitch) {
      lowestPitch = pitch;
      lowestNote = note;
    }
  }

  // Replace chord contents with just the lowest note
  // Keep any non-note elements (though typically just brackets which are implicit)
  chord.contents = [lowestNote];
}

export default bass;
