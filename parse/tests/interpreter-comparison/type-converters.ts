/**
 * type-converters.ts
 *
 * Bidirectional type converters between abcjs's raw format and our idealized format
 */

import { Meter, Tune, MetaText, StaffSystem } from "../../types/abcjs-ast";
import { IRational, createRational } from "../../Visitors/fmt2/rational";
import { AbcjsRawTune, AbcjsRawMeter, AbcjsRawMeterValue, AbcjsRawMetaText } from "./abcjs-wrapper";

// ============================================================================
// Constants
// ============================================================================

/** Tolerance for floating point comparisons */
export const FLOAT_TOLERANCE = 1e-10;

// ============================================================================
// Duration / Note Length Conversions
// ============================================================================

/**
 * Convert a float duration to a rational
 * Uses GCD to find simplest form
 */
export function floatToRational(n: number): IRational {
  if (n === 0) return createRational(0, 1);

  // Handle simple cases
  const epsilon = FLOAT_TOLERANCE;

  // Common note durations
  const commonDurations: [number, IRational][] = [
    [1, createRational(1, 1)], // whole note
    [0.5, createRational(1, 2)], // half note
    [0.25, createRational(1, 4)], // quarter note
    [0.125, createRational(1, 8)], // eighth note
    [0.0625, createRational(1, 16)], // sixteenth note
    [0.75, createRational(3, 4)], // dotted half
    [0.375, createRational(3, 8)], // dotted quarter
    [0.1875, createRational(3, 16)], // dotted eighth
  ];

  for (const [val, rational] of commonDurations) {
    if (Math.abs(n - val) < epsilon) {
      return rational;
    }
  }

  // General conversion using continued fractions or simple fraction finding
  const maxDenominator = 1000;
  let bestNumerator = 1;
  let bestDenominator = 1;
  let bestError = Math.abs(n - 1);

  for (let denom = 1; denom <= maxDenominator; denom++) {
    const numer = Math.round(n * denom);
    const error = Math.abs(n - numer / denom);
    if (error < bestError) {
      bestError = error;
      bestNumerator = numer;
      bestDenominator = denom;
      if (error < epsilon) break;
    }
  }

  return createRational(bestNumerator, bestDenominator);
}

/**
 * Convert a rational to a float duration
 */
export function rationalToFloat(r: IRational): number {
  return r.numerator / r.denominator;
}

/**
 * Check if two durations are approximately equal
 */
export function durationsEqual(a: number | IRational, b: number | IRational): boolean {
  const aFloat = typeof a === "number" ? a : rationalToFloat(a);
  const bFloat = typeof b === "number" ? b : rationalToFloat(b);
  return Math.abs(aFloat - bFloat) < FLOAT_TOLERANCE;
}

// ============================================================================
// Meter Conversions
// ============================================================================

/**
 * Convert abcjs meter value to our format
 */
export function convertAbcjsMeterValue(abcjsValue: AbcjsRawMeterValue): IRational {
  const num = parseInt(abcjsValue.num, 10);
  const den = abcjsValue.den ? parseInt(abcjsValue.den, 10) : 1;
  return createRational(num, den);
}

/**
 * Convert abcjs meter to our format
 */
export function convertAbcjsMeter(abcjsMeter: AbcjsRawMeter): Meter {
  if (abcjsMeter.type !== "specified" || !abcjsMeter.value) {
    return {
      type: abcjsMeter.type as any,
    } as Meter;
  }

  // Convert meter values
  const values = abcjsMeter.value.map(convertAbcjsMeterValue);

  return {
    type: "specified",
    value: values,
  } as Meter;
}

/**
 * Convert our meter to abcjs format
 */
export function convertMeterToAbcjs(meter: Meter): AbcjsRawMeter {
  if (meter.type !== "specified" || !meter.value) {
    return {
      type: meter.type,
    };
  }

  const values: AbcjsRawMeterValue[] = meter.value.map((rational) => ({
    num: rational.numerator.toString(),
    den: rational.denominator.toString(),
  }));

  return {
    type: "specified",
    value: values,
  };
}

// ============================================================================
// MetaText Conversions
// ============================================================================

/**
 * Convert abcjs metaText to our format
 * Note: abcjs may have string | array for some fields
 */
export function convertAbcjsMetaText(abcjsMetaText: AbcjsRawMetaText): MetaText {
  const metaText: MetaText = {};

  // Handle string or array fields
  const stringOrArrayFields = ["title", "composer", "author"] as const;
  for (const field of stringOrArrayFields) {
    if (abcjsMetaText[field]) {
      const value = abcjsMetaText[field];
      metaText[field] = Array.isArray(value) ? value : value;
    }
  }

  // Handle simple string fields
  const stringFields = [
    "rhythm",
    "origin",
    "book",
    "source",
    "discography",
    "notes",
    "transcription",
    "abc-copyright",
    "abc-creator",
    "abc-edited-by",
    "partOrder",
    "unalignedWords",
  ] as const;
  for (const field of stringFields) {
    if (abcjsMetaText[field]) {
      metaText[field] = abcjsMetaText[field];
    }
  }

  // Handle tempo (may have complex structure)
  if (abcjsMetaText.tempo) {
    metaText.tempo = abcjsMetaText.tempo; // Keep as-is for now
  }

  return metaText;
}

/**
 * Convert our metaText to abcjs format
 */
export function convertMetaTextToAbcjs(metaText: MetaText): AbcjsRawMetaText {
  // For now, direct copy since most fields are compatible
  return { ...metaText } as AbcjsRawMetaText;
}

// ============================================================================
// Full Tune Conversions
// ============================================================================

/**
 * Convert abcjs raw tune to our format
 */
export function abcjsToOurFormat(abcjsTune: AbcjsRawTune): Tune {
  // Convert metaText
  const metaText = convertAbcjsMetaText(abcjsTune.metaText);

  // Convert lines (preserve structure for now)
  const lines = abcjsTune.lines.map((line: any) => {
    if ("staff" in line) {
      // Convert music line
      const musicLine: StaffSystem = {
        staff: line.staff.map((staff: any) => ({
          ...staff,
          meter: staff.meter ? convertAbcjsMeter(staff.meter) : undefined,
        })),
      };
      return musicLine;
    }
    return line;
  });

  const tune: Tune = {
    version: abcjsTune.version,
    media: abcjsTune.media as any,
    metaText,
    metaTextInfo: abcjsTune.metaTextInfo,
    formatting: abcjsTune.formatting,
    systems: lines as any,
    staffNum: abcjsTune.staffNum,
    voiceNum: abcjsTune.voiceNum,
    lineNum: abcjsTune.lineNum,
    visualTranspose: abcjsTune.visualTranspose,

    // Placeholder method implementations
    getBeatLength: () => 0.25,
    getPickupLength: () => 0,
    getBarLength: () => 1,
    getTotalTime: () => 0,
    getTotalBeats: () => 0,
    millisecondsPerMeasure: () => 1000,
    getBeatsPerMeasure: () => 4,
    getMeter: () => ({ type: 0 }) as any,
    getMeterFraction: () => createRational(4, 4),
    getKeySignature: () => ({}) as any,
    getElementFromChar: () => null,
    getBpm: () => 120,
    setTiming: () => [],
    setUpAudio: () => null,
    deline: () => null,
    findSelectableElement: () => null,
    getSelectableArray: () => [],
  };

  return tune;
}

/**
 * Convert our tune to abcjs format
 */
export function ourToAbcjsFormat(ourTune: Tune): AbcjsRawTune {
  // Convert metaText
  const metaText = convertMetaTextToAbcjs(ourTune.metaText);

  // Convert lines (preserve structure for now)
  const lines = ourTune.systems.map((line: any) => {
    if ("staff" in line) {
      // Convert music line
      return {
        staff: line.staff.map((staff: any) => ({
          ...staff,
          meter: staff.meter ? convertMeterToAbcjs(staff.meter) : undefined,
        })),
      };
    }
    return line;
  });

  const tune: AbcjsRawTune = {
    version: ourTune.version,
    media: ourTune.media,
    metaText,
    metaTextInfo: ourTune.metaTextInfo,
    formatting: ourTune.formatting,
    lines,
    staffNum: ourTune.staffNum,
    voiceNum: ourTune.voiceNum,
    lineNum: ourTune.lineNum,
    visualTranspose: ourTune.visualTranspose,
  };

  return tune;
}
