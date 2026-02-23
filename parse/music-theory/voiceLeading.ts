/**
 * Voice Leading Utilities
 *
 * Functions for analyzing voice leading relationships between chords.
 */

import { ChordPosition } from "../interpreter/ChordPositionCollector";

/**
 * Finds the ChordPosition of the previous chord in the same voice.
 * Because chordPositions is sorted by pos, we search backward from the end.
 *
 * @param chordPositions Array of chord positions (sorted by pos)
 * @param voiceId The voice to search within
 * @param beforePos The position before which to search
 * @returns The ChordPosition of the previous chord, or null if none found
 */
export function findPreviousChordInVoice(chordPositions: ChordPosition[], voiceId: string, beforePos: number): ChordPosition | null {
  for (let i = chordPositions.length - 1; i >= 0; i--) {
    const cp = chordPositions[i];
    if (cp.pos >= beforePos) continue;
    if (cp.voiceId === voiceId) {
      return cp;
    }
  }
  return null;
}

/**
 * Finds the ChordPosition of the next chord in the same voice.
 * Because chordPositions is sorted by pos, we search forward from the beginning.
 *
 * @param chordPositions Array of chord positions (sorted by pos)
 * @param voiceId The voice to search within
 * @param afterPos The position after which to search
 * @returns The ChordPosition of the next chord, or null if none found
 */
export function findNextChordInVoice(chordPositions: ChordPosition[], voiceId: string, afterPos: number): ChordPosition | null {
  for (let i = 0; i < chordPositions.length; i++) {
    const cp = chordPositions[i];
    if (cp.pos <= afterPos) continue;
    if (cp.voiceId === voiceId) {
      return cp;
    }
  }
  return null;
}
