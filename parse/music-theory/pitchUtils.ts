import { KeySignature, AccidentalType } from "../types/abcjs-ast";

/**
 * Context for pitch resolution operations.
 * Contains the information needed to convert between written ABC notation
 * and sounding MIDI pitches.
 */
export interface PitchContext {
  key: KeySignature;
  measureAccidentals?: Map<string, AccidentalType>;
  transpose: number;
}

/**
 * Maps note letter names to their semitone offset from C within an octave.
 */
const NOTE_TO_SEMITONE: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

/**
 * Maps semitone offsets to possible enharmonic spellings.
 * Each entry contains [noteLetter, semitoneOffset] pairs.
 * For natural notes, there's one option. For accidental notes, there are two.
 */
const SEMITONE_TO_ENHARMONICS: Record<number, Array<[string, number]>> = {
  0: [["C", 0]],
  1: [
    ["C", 1],
    ["D", -1],
  ], // C# or Db
  2: [["D", 0]],
  3: [
    ["D", 1],
    ["E", -1],
  ], // D# or Eb
  4: [["E", 0]],
  5: [["F", 0]],
  6: [
    ["F", 1],
    ["G", -1],
  ], // F# or Gb
  7: [["G", 0]],
  8: [
    ["G", 1],
    ["A", -1],
  ], // G# or Ab
  9: [["A", 0]],
  10: [
    ["A", 1],
    ["B", -1],
  ], // A# or Bb
  11: [["B", 0]],
};

/**
 * Converts a note letter and octave to MIDI pitch number.
 * C4 (middle C) = 60.
 */
export function noteLetterToMidi(pitchClass: string, octave: number): number {
  const semitone = NOTE_TO_SEMITONE[pitchClass.toUpperCase()] ?? 0;
  return (octave + 1) * 12 + semitone;
}

/**
 * Converts an ABC accidental string to semitone adjustment.
 */
export function accidentalToSemitones(acc: string): number {
  switch (acc) {
    case "^^":
      return 2;
    case "^":
      return 1;
    case "=":
      return 0;
    case "_":
      return -1;
    case "__":
      return -2;
    default:
      return 0;
  }
}

/**
 * Converts an AccidentalType enum to semitone adjustment.
 */
export function accidentalTypeToSemitones(acc: AccidentalType | null): number {
  if (acc === null) return 0;
  switch (acc) {
    case AccidentalType.DblSharp:
      return 2;
    case AccidentalType.Sharp:
      return 1;
    case AccidentalType.Natural:
      return 0;
    case AccidentalType.Flat:
      return -1;
    case AccidentalType.DblFlat:
      return -2;
    case AccidentalType.QuarterSharp:
      return 0.5;
    case AccidentalType.QuarterFlat:
      return -0.5;
    default:
      return 0;
  }
}

/**
 * Converts a semitone adjustment to an ABC accidental string.
 */
export function semitonesToAccidentalString(semitones: number): string {
  switch (semitones) {
    case 2:
      return "^^";
    case 1:
      return "^";
    case 0:
      return "=";
    case -1:
      return "_";
    case -2:
      return "__";
    default:
      return "";
  }
}

/**
 * Gets the accidental for a pitch class from the key signature.
 * Returns the AccidentalType if the note is altered in the key, null otherwise.
 */
export function getKeyAccidentalForPitch(pitchClass: string, key: KeySignature): AccidentalType | null {
  const upperPitch = pitchClass.toUpperCase();
  for (const acc of key.accidentals) {
    // Because the NoteLetter enum includes both upper and lower case versions,
    // we need to match against the uppercase version of the note.
    if (acc.note.toUpperCase() === upperPitch) {
      return acc.acc;
    }
  }
  return null;
}

/**
 * Converts a MIDI pitch to its natural note components.
 * Returns the first (sharp-preferring) enharmonic option.
 * For context-aware spelling, use pitchToNoteName instead.
 */
export function midiToNaturalNote(midiPitch: number): {
  naturalNote: string;
  octave: number;
  semitoneOffset: number;
} {
  const octave = Math.floor(midiPitch / 12) - 1;
  // Use ((n % 12) + 12) % 12 to handle negative MIDI values correctly
  const semitoneInOctave = ((midiPitch % 12) + 12) % 12;

  // Get the first enharmonic option (prefers sharps)
  const [naturalNote, semitoneOffset] = SEMITONE_TO_ENHARMONICS[semitoneInOctave][0];

  return { naturalNote, octave, semitoneOffset };
}

/**
 * Gets all possible enharmonic spellings for a MIDI pitch.
 */
function getEnharmonicOptions(midiPitch: number): Array<{
  noteLetter: string;
  octave: number;
  semitoneOffset: number;
}> {
  const octave = Math.floor(midiPitch / 12) - 1;
  // Use ((n % 12) + 12) % 12 to handle negative MIDI values correctly
  const semitoneInOctave = ((midiPitch % 12) + 12) % 12;

  return SEMITONE_TO_ENHARMONICS[semitoneInOctave].map(([noteLetter, semitoneOffset]) => ({
    noteLetter,
    octave,
    semitoneOffset,
  }));
}

/**
 * Resolves a melody note to its sounding MIDI pitch.
 *
 * The resolution follows this precedence:
 * 1. Explicit accidental on the note itself
 * 2. Measure accidental (previously seen accidental on same pitch class)
 * 3. Key signature accidental
 * 4. Natural (no accidental)
 *
 * Finally, the transpose offset is applied to get the sounding pitch.
 *
 * @param noteLetter The note letter (A-G, case insensitive)
 * @param noteOctave The octave number (4 = middle C octave)
 * @param explicitAccidental The explicit accidental string ("^", "_", "=", "^^", "__") or null
 * @param ctx The pitch context containing key, measure accidentals, and transpose
 * @returns The sounding MIDI pitch number
 */
export function resolveMelodyPitch(noteLetter: string, noteOctave: number, explicitAccidental: string | null, ctx: PitchContext): number {
  const pitchClass = noteLetter.toUpperCase();
  const baseMidi = noteLetterToMidi(pitchClass, noteOctave);

  let writtenPitch: number;

  if (explicitAccidental !== null) {
    // Explicit accidental takes precedence
    writtenPitch = baseMidi + accidentalToSemitones(explicitAccidental);
  } else if (ctx.measureAccidentals?.has(pitchClass)) {
    // Measure accidental (from earlier in the measure)
    const measureAcc = ctx.measureAccidentals.get(pitchClass)!;
    writtenPitch = baseMidi + accidentalTypeToSemitones(measureAcc);
  } else {
    // Key signature accidental
    const keyAccidental = getKeyAccidentalForPitch(pitchClass, ctx.key);
    if (keyAccidental !== null) {
      writtenPitch = baseMidi + accidentalTypeToSemitones(keyAccidental);
    } else {
      writtenPitch = baseMidi;
    }
  }

  // Apply transpose to get sounding pitch
  return writtenPitch + ctx.transpose;
}

/**
 * Converts a sounding MIDI pitch to ABC notation components.
 *
 * This function determines the appropriate note letter, octave, and accidental
 * needed to represent the given MIDI pitch in the current context.
 *
 * When there are multiple enharmonic options (e.g., A# vs Bb), it chooses
 * the spelling that requires no explicit accidental if possible. This means
 * it will prefer spellings that match the key signature or measure accidentals.
 *
 * @param midiPitch The sounding MIDI pitch number
 * @param ctx The pitch context containing key, measure accidentals, and transpose
 * @returns Object with noteLetter, octave, and accidental string
 */
export function pitchToNoteName(midiPitch: number, ctx: PitchContext): { noteLetter: string; octave: number; accidental: string } {
  // Remove transpose to get written pitch
  const writtenMidi = midiPitch - ctx.transpose;

  // Get all possible enharmonic spellings
  const options = getEnharmonicOptions(writtenMidi);

  // For each option, calculate what accidental would be needed
  type ScoredOption = {
    noteLetter: string;
    octave: number;
    neededAccidental: string;
    score: number; // lower is better
  };

  const scoredOptions: ScoredOption[] = options.map((opt) => {
    const pitchClass = opt.noteLetter.toUpperCase();

    // Determine what accidental is already in effect for this pitch class
    let effectiveAccidental: AccidentalType | null = null;
    if (ctx.measureAccidentals?.has(pitchClass)) {
      effectiveAccidental = ctx.measureAccidentals.get(pitchClass)!;
    } else {
      effectiveAccidental = getKeyAccidentalForPitch(pitchClass, ctx.key);
    }

    const neededSemitones = opt.semitoneOffset;
    const effectiveSemitones = accidentalTypeToSemitones(effectiveAccidental);

    let neededAccidental: string;
    let score: number;

    if (neededSemitones === effectiveSemitones) {
      // No explicit accidental needed - best option
      neededAccidental = "";
      score = 0;
    } else {
      // Need an explicit accidental
      neededAccidental = semitonesToAccidentalString(neededSemitones);
      // Score based on complexity: natural < single accidental < double accidental
      score = Math.abs(neededSemitones) + 1;
    }

    return {
      noteLetter: opt.noteLetter,
      octave: opt.octave,
      neededAccidental,
      score,
    };
  });

  // Sort by score (lower is better) and pick the first
  scoredOptions.sort((a, b) => a.score - b.score);
  const best = scoredOptions[0];

  return {
    noteLetter: best.noteLetter,
    octave: best.octave,
    accidental: best.neededAccidental,
  };
}
