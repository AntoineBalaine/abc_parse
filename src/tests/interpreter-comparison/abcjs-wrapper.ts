/**
 * abcjs-wrapper.ts
 *
 * Wrapper for the abcjs parser located in abcjs_parse/
 * Defines AbcjsRaw types that match abcjs's actual output format
 * (which differs from our idealized types in abcjs-ast.ts)
 */

// ============================================================================
// abcjs Package Import
// ============================================================================

import * as abcjs from 'abcjs';

// ============================================================================
// AbcjsRaw Types - Match abcjs's Actual Output Format
// ============================================================================

/**
 * abcjs uses plain numbers (floats) for durations, not rationals
 */
export type AbcjsRawDuration = number;

/**
 * abcjs uses {num: string, den?: string} for meter values
 */
export interface AbcjsRawMeterValue {
  num: string;
  den?: string;
}

/**
 * abcjs meter structure
 */
export interface AbcjsRawMeter {
  type: 'specified' | 'common_time' | 'cut_time' | 'tempus_perfectum' | 'tempus_imperfectum' | 'tempus_perfectum_prolatio' | 'tempus_imperfectum_prolatio';
  value?: AbcjsRawMeterValue[];
}

/**
 * abcjs uses plain numbers for note lengths
 */
export type AbcjsRawNoteLength = number;

/**
 * abcjs pitch structure
 */
export interface AbcjsRawPitch {
  pitch: number;
  name: string;
  verticalPos: number;
  accidental?: string;
}

/**
 * abcjs note element
 */
export interface AbcjsRawNoteElement {
  el_type: string; // "note"
  startChar: number;
  endChar: number;
  duration: AbcjsRawDuration;
  pitches?: AbcjsRawPitch[];
  rest?: { type: string };
}

/**
 * abcjs bar element
 */
export interface AbcjsRawBarElement {
  el_type: string; // "bar"
  startChar: number;
  endChar: number;
  type: string;
}

/**
 * Union of voice elements
 */
export type AbcjsRawVoiceElement = AbcjsRawNoteElement | AbcjsRawBarElement;

/**
 * abcjs staff structure
 */
export interface AbcjsRawStaff {
  clef?: any;
  key?: any;
  meter?: AbcjsRawMeter;
  workingClef?: any;
  voices: AbcjsRawVoiceElement[][];
}

/**
 * abcjs music line
 */
export interface AbcjsRawMusicLine {
  staff: AbcjsRawStaff[];
}

/**
 * abcjs line union type
 */
export type AbcjsRawLine = AbcjsRawMusicLine | any; // Can have other line types

/**
 * abcjs metaText structure
 */
export interface AbcjsRawMetaText {
  title?: string | any[];
  composer?: string | any[];
  author?: string | any[];
  rhythm?: string;
  origin?: string;
  book?: string;
  source?: string;
  discography?: string;
  notes?: string;
  transcription?: string;
  "abc-copyright"?: string;
  "abc-creator"?: string;
  "abc-edited-by"?: string;
  tempo?: any;
  partOrder?: string;
  unalignedWords?: string;
}

/**
 * abcjs Tune structure - matches abcjs's actual output
 */
export interface AbcjsRawTune {
  version: string;
  media: string;
  metaText: AbcjsRawMetaText;
  metaTextInfo: { [key: string]: any };
  formatting: { [key: string]: any };
  lines: AbcjsRawLine[];
  staffNum: number;
  voiceNum: number;
  lineNum: number;
  visualTranspose?: number;

  // Methods (may not be present in raw output)
  getBeatLength?: () => number;
  getPickupLength?: () => number;
  getBarLength?: () => number;
  getTotalTime?: () => number;
  getTotalBeats?: () => number;
  millisecondsPerMeasure?: (bpmOverride?: number) => number;
  getBeatsPerMeasure?: () => number;
  getMeter?: () => any;
  getMeterFraction?: () => any;
  getKeySignature?: () => any;
  getElementFromChar?: (char: number) => any;
  getBpm?: (tempo?: any) => number;
  setTiming?: (bpm?: number, measuresOfDelay?: number) => any[];
  setUpAudio?: (options?: any) => any;
  deline?: (options?: any) => any;
  findSelectableElement?: (target: any) => any;
  getSelectableArray?: () => any[];
}

// ============================================================================
// abcjs Parser Wrapper
// ============================================================================

/**
 * Parse ABC notation using the abcjs parser
 * @param input ABC notation string
 * @param params Optional parsing parameters
 * @returns Array of parsed tunes in abcjs's raw format
 */
export function parseWithAbcjs(input: string, params?: abcjs.AbcVisualParams): AbcjsRawTune[] {
  try {
    // Use abcjs.parseOnly() to parse without rendering
    const tuneObjects = abcjs.parseOnly(input, params);

    // Cast to our raw type array
    // Note: abcjs.TuneObject is very close to our AbcjsRawTune
    return tuneObjects as unknown as AbcjsRawTune[];
  } catch (error: any) {
    throw new Error(`abcjs parser failed: ${error?.message || error}`);
  }
}
