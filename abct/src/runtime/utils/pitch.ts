// Pitch Utility Functions
// Shared helpers for working with note pitches

import { isPitch } from "../../../../parse/helpers";
import { toMidiPitch } from "../../../../parse/Visitors/Formatter2";
import { Note, Pitch } from "../../../../parse/types/Expr2";

/**
 * Get the MIDI pitch value for a note.
 * Returns a very high value for notes without valid pitches (so they sort last).
 */
export function getNoteMidiPitch(note: Note): number {
  if (isPitch(note.pitch)) {
    return toMidiPitch(note.pitch as Pitch);
  }
  // If no valid pitch, return a high value
  return Number.MAX_SAFE_INTEGER;
}
