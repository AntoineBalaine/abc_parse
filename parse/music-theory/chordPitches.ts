import { KeyRoot, KeyAccidental } from "../types/abcjs-ast";
import { ChordQuality, ParsedChord, ChordAlteration } from "./types";
import { LETTERS } from "./constants";
import {
  VoicedNote,
  QUALITY_INTERVALS,
  INTERVAL_TO_SCALE_STEP,
  INTERVAL_TO_FUNC,
  keyRootToLetter,
  keyAccidentalToSemitones,
  spellFromRoot,
} from "./harmonization";

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

function addExtensionIntervals(intervals: number[], chord: ParsedChord): number[] {
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

function applyAlteration(intervals: number[], alt: ChordAlteration): number[] {
  const degree = alt.degree;

  // Get the natural interval for this degree
  if (!(degree in DEGREE_TO_INTERVAL)) {
    return intervals; // Unknown degree, skip
  }

  const naturalInterval = DEGREE_TO_INTERVAL[degree];
  const alteredInterval = alt.type === "sharp" ? naturalInterval + 1 : naturalInterval - 1;

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
 * Converts a ParsedChord to VoicedNotes with proper spellings.
 * Returns null if the chord root is not a standard note (A-G).
 * Highland Pipes roots are rejected.
 *
 * @param chord The parsed chord structure
 * @param baseOctave The base octave (default 4, where C4 = MIDI 60)
 * @returns Array of VoicedNotes sorted ascending by MIDI, or null for invalid roots
 */
export function chordToPitches(chord: ParsedChord, baseOctave: number = 4): VoicedNote[] | null {
  // Validate root is a standard note (reject Highland Pipes)
  const rootSemitoneBase = ROOT_TO_SEMITONE[chord.root];
  if (rootSemitoneBase === undefined) {
    return null;
  }

  // Calculate root MIDI pitch
  const rootLetter = keyRootToLetter(chord.root);
  const rootAccSemitones = keyAccidentalToSemitones(chord.rootAccidental);
  const rootIndex = LETTERS.indexOf(rootLetter);
  const rootSemitone = (rootSemitoneBase + rootAccSemitones + 12) % 12;

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

  // Sort intervals
  intervals = intervals.sort((a, b) => a - b);

  // Convert intervals to VoicedNotes with proper spellings
  const result: VoicedNote[] = intervals.map((interval) => {
    const scaleStep = INTERVAL_TO_SCALE_STEP[interval] ?? Math.floor(interval / 2) % 7;
    const spelling = spellFromRoot(rootIndex, rootSemitone, scaleStep, interval % 12);
    const midi = rootMidi + interval;
    const func = INTERVAL_TO_FUNC[interval] ?? 8;

    return { spelling, midi, func };
  });

  return result;
}
