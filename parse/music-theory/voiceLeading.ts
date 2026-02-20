/**
 * Voice Leading Utilities
 *
 * Functions for analyzing voice leading relationships between chords.
 */

import { ChordPosition } from "../interpreter/ChordPositionCollector";

/**
 * Finds the MIDI pitches of the previous chord in the same voice.
 * Because chordPositions is sorted by pos, we search backward from the end.
 *
 * @param chordPositions Array of chord positions (sorted by pos)
 * @param voiceId The voice to search within
 * @param beforePos The position before which to search
 * @returns MIDI pitches of the previous chord, or null if none found
 */
export function findPreviousChordInVoice(chordPositions: ChordPosition[], voiceId: string, beforePos: number): number[] | null {
  for (let i = chordPositions.length - 1; i >= 0; i--) {
    const cp = chordPositions[i];
    if (cp.pos >= beforePos) continue;
    if (cp.voiceId === voiceId) {
      return cp.midiPitches;
    }
  }
  return null;
}
