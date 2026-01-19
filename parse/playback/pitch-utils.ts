/**
 * Pitch Conversion Utilities
 *
 * Converts ABC pitch notation (as represented in ABCJS Tune format)
 * to MIDI pitch numbers for MuseSampler.
 */

import { AccidentalType } from "../types/abcjs-ast";

/**
 * Maps pitch class (position within octave) to semitone offset from C.
 *
 * In ABCJS, the pitch field is a vertical staff position where:
 *   0 = C4 (middle C)
 *   1 = D4
 *   2 = E4
 *   ...
 *   7 = C5
 *
 * Each step is a diatonic step, not a semitone.
 */
const PITCH_CLASS_TO_SEMITONE: Record<number, number> = {
  0: 0,   // C
  1: 2,   // D
  2: 4,   // E
  3: 5,   // F
  4: 7,   // G
  5: 9,   // A
  6: 11,  // B
};

/**
 * Maps AccidentalType to semitone offset.
 */
const ACCIDENTAL_TO_SEMITONE: Record<AccidentalType, number> = {
  [AccidentalType.DblFlat]: -2,
  [AccidentalType.Flat]: -1,
  [AccidentalType.Natural]: 0,
  [AccidentalType.Sharp]: 1,
  [AccidentalType.DblSharp]: 2,
  [AccidentalType.QuarterFlat]: 0,   // handled via offset_cents
  [AccidentalType.QuarterSharp]: 0,  // handled via offset_cents
};

/**
 * Maps AccidentalType to cents offset for microtonal accidentals.
 */
const ACCIDENTAL_TO_CENTS: Record<AccidentalType, number> = {
  [AccidentalType.DblFlat]: 0,
  [AccidentalType.Flat]: 0,
  [AccidentalType.Natural]: 0,
  [AccidentalType.Sharp]: 0,
  [AccidentalType.DblSharp]: 0,
  [AccidentalType.QuarterFlat]: -50,
  [AccidentalType.QuarterSharp]: 50,
};

/**
 * Converts an ABCJS vertical pitch position to a MIDI pitch number.
 *
 * The ABCJS Pitch.pitch field represents vertical staff position:
 *   - 0 corresponds to C4 (middle C, MIDI 60)
 *   - Each increment is one diatonic step (not semitone)
 *   - Negative values go below middle C
 *
 * @param verticalPos - The ABCJS pitch value (vertical staff position)
 * @param accidental - Optional accidental type
 * @returns MIDI pitch number (60 = C4)
 */
export function abcPitchToMidi(
  verticalPos: number,
  accidental?: AccidentalType
): number {
  // Calculate octave offset from C4
  // We use floor division to handle negative positions correctly
  const octaveOffset = Math.floor(verticalPos / 7);

  // Calculate pitch class (0-6) within the octave
  // We use modulo with adjustment for negative numbers
  const pitchClass = ((verticalPos % 7) + 7) % 7;

  // Base MIDI pitch: C4 = 60
  const baseMidi = 60 + (octaveOffset * 12) + PITCH_CLASS_TO_SEMITONE[pitchClass];

  // Apply accidental offset
  const accidentalOffset = accidental ? ACCIDENTAL_TO_SEMITONE[accidental] : 0;

  return baseMidi + accidentalOffset;
}

/**
 * Gets the cents offset for microtonal accidentals.
 *
 * Quarter tones are not represented in MIDI pitch, so we return them
 * as a cents offset to be passed to MuseSampler's offset_cents field.
 *
 * @param accidental - The accidental type
 * @returns Cents offset (-50 for quarter flat, 50 for quarter sharp, 0 otherwise)
 */
export function accidentalToCents(accidental?: AccidentalType): number {
  if (!accidental) return 0;
  return ACCIDENTAL_TO_CENTS[accidental];
}

/**
 * Converts a MIDI pitch number back to a note name string.
 * Useful for debugging and testing.
 *
 * @param midi - MIDI pitch number
 * @returns Note name (e.g., "C4", "F#5", "Bb3")
 */
export function midiToNoteName(midi: number): string {
  const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const octave = Math.floor(midi / 12) - 1;
  const noteIndex = midi % 12;
  return `${noteNames[noteIndex]}${octave}`;
}

/**
 * Converts an ABCJS vertical position back to a note name string.
 * Useful for debugging and testing.
 *
 * @param verticalPos - The ABCJS pitch value
 * @param accidental - Optional accidental type
 * @returns Note name (e.g., "C4", "F#5")
 */
export function abcPitchToNoteName(
  verticalPos: number,
  accidental?: AccidentalType
): string {
  const midi = abcPitchToMidi(verticalPos, accidental);
  let name = midiToNoteName(midi);

  // Append microtonal indicator if applicable
  if (accidental === AccidentalType.QuarterFlat) {
    // Replace the note name to show quarter flat
    name = name.replace(/([A-G])/, "$1q♭");
  } else if (accidental === AccidentalType.QuarterSharp) {
    name = name.replace(/([A-G])/, "$1q♯");
  }

  return name;
}
