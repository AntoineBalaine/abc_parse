/**
 * Unified Interpreter State
 *
 * This module defines the state structure for interpreting ABC notation into ABCJS Tune format.
 * Instead of multiple context types, we use a single hierarchical state that tracks:
 * - File-level defaults (shared across all tunes)
 * - Tune-level defaults (inherited from file, overridden per tune)
 * - Working state (current position during body traversal)
 */

import {
  Tune,
  KeySignature,
  Meter,
  TempoProperties,
  ClefProperties,
  MetaText,
  VoiceElement,
  AccidentalType,
  KeyRoot,
  KeyAccidental,
  Mode,
  ClefType,
  MediaType,
  VoiceProperties,
} from "../types/abcjs-ast";
import { IRational, createRational } from "../Visitors/fmt2/rational";
import { SemanticData } from "../analyzers/semantic-analyzer";

// ============================================================================
// Parser Configuration (directives that affect parsing but aren't exposed)
// ============================================================================

export interface ParserConfig {
  landscape?: boolean;
  titlecaps?: boolean;
  continueall?: boolean;
  papersize?: string;
}

// ============================================================================
// File-level Defaults (shared across all tunes in a file)
// ============================================================================

export interface FileDefaults {
  noteLength?: IRational;
  formatting: { [key: string]: any };
  parserConfig: ParserConfig;
  version?: string;
  metaText: Partial<MetaText>;
}

// ============================================================================
// Tune-level Defaults (per-tune, inherited from file)
// ============================================================================

export interface TuneDefaults {
  key: KeySignature;
  meter?: Meter;
  tempo?: TempoProperties;
  noteLength: IRational;
  clef: ClefProperties;
}

// ============================================================================
// Voice State (per voice within a tune)
// ============================================================================

export interface VoiceState {
  id: string;
  properties: VoiceProperties;
  currentKey: KeySignature;
  currentClef: ClefProperties;
  currentMeter?: Meter;
  staffIndex: number;
  voiceIndex: number;
  measureAccidentals: Map<string, AccidentalType>; // Cleared each measure
}

// ============================================================================
// Main Interpreter State (per tune being processed)
// ============================================================================

export interface InterpreterState {
  // Semantic data from analyzer (shared reference)
  semanticData: Map<number, SemanticData>;

  // Hierarchical defaults
  fileDefaults: FileDefaults;
  tuneDefaults: TuneDefaults;
  parserConfig: ParserConfig;

  // Working state (mutable during body processing)
  currentLine: number;
  currentStaff: number;
  currentVoice: string;
  measureNumber: number;

  // Voice tracking
  voices: Map<string, VoiceState>;

  // Output being constructed
  tune: Tune;

  // Temporary working variables (for beaming, slurs, etc.)
  potentialStartBeam?: any;
  potentialEndBeam?: any;
  openSlurs: any[];
  inTie: Map<string, any>;
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createFileDefaults(): FileDefaults {
  return {
    formatting: {},
    parserConfig: {},
    metaText: {},
  };
}

export function createTuneDefaults(fileDefaults: FileDefaults): TuneDefaults {
  return {
    key: getDefaultKeySignature(),
    noteLength: fileDefaults.noteLength || createRational(1, 8),
    clef: getDefaultClef(),
  };
}

export function createInterpreterState(semanticData: Map<number, SemanticData>, fileDefaults: FileDefaults): InterpreterState {
  return {
    semanticData,
    fileDefaults,
    tuneDefaults: createTuneDefaults(fileDefaults),
    parserConfig: { ...fileDefaults.parserConfig },
    currentLine: 0,
    currentStaff: 0,
    currentVoice: "default",
    measureNumber: 1,
    voices: new Map(),
    tune: createEmptyTune(),
    openSlurs: [],
    inTie: new Map(),
  };
}

export function createEmptyTune(): Tune {
  return {
    version: "2.2",
    media: MediaType.Screen,
    metaText: {},
    metaTextInfo: {},
    formatting: {},
    lines: [],
    staffNum: 0,
    voiceNum: 0,
    lineNum: 0,

    // Placeholder method implementations
    getBeatLength: () => 0.25,
    getPickupLength: () => 0,
    getBarLength: () => 1,
    getTotalTime: () => 0,
    getTotalBeats: () => 0,
    millisecondsPerMeasure: () => 1000,
    getBeatsPerMeasure: () => 4,
    getMeter: function () {
      // WRONG: meter is NOT the same as BPM.
      // meter is an info line that needs to be retrieved. let’s leave the implementation empty.
      return this.metaText.tempo?.bpm ? ({ type: 0 } as any) : ({ type: 0 } as any);
    },
    getMeterFraction: () => createRational(4, 4),
    getKeySignature: function () {
      return getDefaultKeySignature();
    },
    getElementFromChar: () => null,
    getBpm: () => 120,
    setTiming: () => [],
    setUpAudio: () => null,
    deline: () => null,
    findSelectableElement: () => null,
    getSelectableArray: () => [],
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

export function getDefaultKeySignature(): KeySignature {
  return {
    root: KeyRoot.C,
    acc: KeyAccidental.None,
    mode: Mode.Major,
    accidentals: [],
  };
}

export function getDefaultClef(): ClefProperties {
  return {
    type: ClefType.Treble,
    verticalPos: 6,
    clefPos: 0,
  };
}

export function createVoiceState(
  id: string,
  properties: VoiceProperties,
  tuneDefaults: TuneDefaults,
  staffIndex: number,
  voiceIndex: number
): VoiceState {
  return {
    id,
    properties,
    currentKey: tuneDefaults.key,
    currentClef: properties.clef || tuneDefaults.clef,
    currentMeter: tuneDefaults.meter,
    staffIndex,
    voiceIndex,
    measureAccidentals: new Map(),
  };
}

// ============================================================================
// State Management Functions
// ============================================================================

export function getCurrentVoice(state: InterpreterState): VoiceState | undefined {
  return state.voices.get(state.currentVoice);
}

export function addVoice(state: InterpreterState, id: string, properties: VoiceProperties): void {
  const staffIndex = state.currentStaff;
  const voiceIndex = state.voices.size;

  const voice = createVoiceState(id, properties, state.tuneDefaults, staffIndex, voiceIndex);
  state.voices.set(id, voice);
}

export function setCurrentVoice(state: InterpreterState, id: string): void {
  if (!state.voices.has(id)) {
    // Auto-create voice if it doesn't exist
    addVoice(state, id, {});
  }
  state.currentVoice = id;
}

export function clearMeasureAccidentals(state: InterpreterState): void {
  for (const voice of state.voices.values()) {
    voice.measureAccidentals.clear();
  }
}

export function nextMeasure(state: InterpreterState): void {
  state.measureNumber++;
  clearMeasureAccidentals(state);
}

/**
 * Resolve a property with hierarchical precedence:
 * voiceOverride > tuneDefaults > fileDefaults
 */
export function resolveProperty<T>(fileValue: T | undefined, tuneValue: T | undefined, voiceValue: T | undefined): T | undefined {
  return voiceValue ?? tuneValue ?? fileValue;
}
