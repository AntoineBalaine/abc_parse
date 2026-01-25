import { KeyRoot, KeyAccidental } from "../types/abcjs-ast";
import { ChordQuality, ParsedChord, ChordAlteration } from "./types";

/**
 * Interval patterns for each chord quality in semitones from the root.
 */
const QUALITY_INTERVALS: Record<ChordQuality, number[]> = {
  [ChordQuality.Major]: [0, 4, 7],
  [ChordQuality.Minor]: [0, 3, 7],
  [ChordQuality.Dominant]: [0, 4, 7, 10],
  [ChordQuality.Diminished]: [0, 3, 6],
  [ChordQuality.Augmented]: [0, 4, 8],
  [ChordQuality.HalfDiminished]: [0, 3, 6, 10],
  [ChordQuality.Suspended2]: [0, 2, 7],
  [ChordQuality.Suspended4]: [0, 5, 7],
  [ChordQuality.Power]: [0, 7],
  [ChordQuality.Add]: [0, 4, 7],
};

/**
 * Root note to semitone offset.
 * Only standard note roots are supported; Highland Pipes roots are not included.
 */
const ROOT_TO_SEMITONE: Partial<Record<KeyRoot, number>> = {
  [KeyRoot.C]: 0,
  [KeyRoot.D]: 2,
  [KeyRoot.E]: 4,
  [KeyRoot.F]: 5,
  [KeyRoot.G]: 7,
  [KeyRoot.A]: 9,
  [KeyRoot.B]: 11,
};

/**
 * Maps scale degrees to their natural interval in semitones.
 */
const DEGREE_TO_INTERVAL: Record<number, number> = {
  3: 4,
  5: 7,
  7: 11,
  9: 14,
  11: 17,
  13: 21,
};

function addExtensionIntervals(
  intervals: number[],
  chord: ParsedChord
): number[] {
  const ext = chord.extension;
  const quality = chord.quality;

  if (ext === null) return intervals;

  // Special case: Add quality just adds the extension to triad (no stacked extensions)
  if (quality === ChordQuality.Add) {
    if (ext === 6) intervals.push(9);
    if (ext === 7) intervals.push(11);
    if (ext === 9) intervals.push(14);
    if (ext === 11) intervals.push(17);
    if (ext === 13) intervals.push(21);
    return intervals;
  }

  // Power chord: no additional intervals
  if (quality === ChordQuality.Power) {
    return intervals;
  }

  // 6th chord: add major 6th
  if (ext === 6) {
    intervals.push(9);
    return intervals;
  }

  // 69 chord: add major 6th and major 9th
  if (ext === 69) {
    intervals.push(9, 14);
    return intervals;
  }

  // 7th and beyond: add appropriate 7th first
  if (ext >= 7) {
    // Diminished 7th chord uses diminished 7th interval (9 semitones)
    if (quality === ChordQuality.Diminished) {
      if (!intervals.includes(9)) {
        intervals.push(9);
      }
    }
    // Major quality with 7th uses major 7th (11 semitones)
    else if (quality === ChordQuality.Major) {
      if (!intervals.includes(11)) {
        intervals.push(11);
      }
    }
    // All others (Dominant, Minor, etc.) use minor 7th (10 semitones)
    else {
      if (!intervals.includes(10)) {
        intervals.push(10);
      }
    }
  }

  // 9th and beyond: add 9th
  if (ext >= 9) {
    intervals.push(14);
  }

  // 11th and beyond: add 11th
  if (ext >= 11) {
    intervals.push(17);
  }

  // 13th: add 13th
  if (ext >= 13) {
    intervals.push(21);
  }

  return intervals;
}

function applyAlteration(
  intervals: number[],
  alt: ChordAlteration
): number[] {
  const degree = alt.degree;

  // Get the natural interval for this degree
  if (!(degree in DEGREE_TO_INTERVAL)) {
    return intervals; // Unknown degree, skip
  }

  const naturalInterval = DEGREE_TO_INTERVAL[degree];
  const alteredInterval =
    alt.type === "sharp" ? naturalInterval + 1 : naturalInterval - 1;

  // Replace natural with altered if present, otherwise add altered
  const newIntervals: number[] = [];
  let found = false;
  for (const interval of intervals) {
    if (interval === naturalInterval) {
      newIntervals.push(alteredInterval);
      found = true;
    } else {
      newIntervals.push(interval);
    }
  }

  // If natural interval was not present, add the altered interval anyway
  if (!found) {
    newIntervals.push(alteredInterval);
  }

  return newIntervals;
}

/**
 * Converts a ParsedChord to MIDI pitch numbers.
 * Returns null if the chord root is not a standard note (A-G).
 * Highland Pipes roots are rejected.
 *
 * @param chord The parsed chord structure
 * @param baseOctave The base octave (default 4, where C4 = MIDI 60)
 * @returns Array of MIDI pitch numbers sorted ascending, or null for invalid roots
 */
export function chordToPitches(
  chord: ParsedChord,
  baseOctave: number = 4
): number[] | null {
  // Validate root is a standard note (reject Highland Pipes)
  const rootSemitoneBase = ROOT_TO_SEMITONE[chord.root];
  if (rootSemitoneBase === undefined) {
    return null;
  }

  // Calculate root MIDI pitch
  let rootSemitone = rootSemitoneBase;
  if (chord.rootAccidental === KeyAccidental.Sharp) rootSemitone += 1;
  if (chord.rootAccidental === KeyAccidental.Flat) rootSemitone -= 1;

  // MIDI pitch formula: (octave + 1) * 12 + semitone
  const rootMidi = (baseOctave + 1) * 12 + rootSemitone;

  // Get base intervals from quality
  let intervals = [...QUALITY_INTERVALS[chord.quality]];

  // Add extension intervals
  intervals = addExtensionIntervals(intervals, chord);

  // Apply alterations
  for (const alt of chord.alterations) {
    intervals = applyAlteration(intervals, alt);
  }

  // Convert intervals to MIDI pitches
  const pitches = intervals.map((interval) => rootMidi + interval);

  return pitches.sort((a, b) => a - b);
}
