import { scanChordSymbol } from "./scanChordSymbol";
import { parseChordSymbol } from "./parseChordSymbol";
import { chordToPitches } from "./chordPitches";
import { ParsedChord } from "./types";

export interface ChordInfo {
  parsed: ParsedChord;
  pitches: number[] | null;
}

/**
 * Convenience function that combines scanning, parsing, and pitch generation.
 *
 * @param text The chord symbol text (e.g., "Am7", "Cmaj7#11")
 * @param baseOctave The base octave for pitch generation (default 4)
 * @returns ChordInfo with parsed chord and MIDI pitches, or null if invalid
 */
export function analyzeChordSymbol(
  text: string,
  baseOctave: number = 4
): ChordInfo | null {
  const scanResult = scanChordSymbol(text);
  if (!scanResult) return null;

  const parsed = parseChordSymbol(scanResult.tokens);
  if (!parsed) return null;

  const pitches = chordToPitches(parsed, baseOctave);

  return { parsed, pitches };
}

// Re-export from submodules
export { scanChordSymbol, ScanResult } from "./scanChordSymbol";
export { parseChordSymbol } from "./parseChordSymbol";
export { chordToPitches } from "./chordPitches";
export {
  ParsedChord,
  ChordQuality,
  ChordAlteration,
  ChordTT,
  ChordToken,
} from "./types";

// Re-export shared key utilities for external consumers
export { parseKeyRoot, parseKeyAccidental } from "../utils/keyUtils";
