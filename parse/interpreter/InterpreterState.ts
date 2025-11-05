/**
 * Unified Interpreter State
 *
 * This module defines the state structure for interpreting ABC notation into ABCJS Tune format.
 * Instead of multiple context types, we use a single hierarchical state that tracks:
 * - File-level defaults (shared across all tunes)
 * - Tune-level defaults (inherited from file, overridden per tune)
 * - Working state (current position during body traversal)
 */

import { SemanticData } from "../analyzers/semantic-analyzer";
import {
  Tune,
  KeySignature,
  Meter,
  TempoProperties,
  ClefProperties,
  MetaText,
  NoteElement,
  AccidentalType,
  KeyRoot,
  KeyAccidental,
  Mode,
  ClefType,
  MediaType,
  VoiceProperties,
  Decorations,
  Staff,
  StaffSystem,
} from "../types/abcjs-ast";
import { IRational, createRational } from "../Visitors/fmt2/rational";

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
// Multi-Staff Support Structures
// ============================================================================

/**
 * Information about a single staff in the output.
 * Tracks how many voices are assigned to this staff and visual grouping properties.
 *
 * Note: bracket/brace/connectBarLines types match the Staff interface in abcjs-ast.ts
 */
export interface StaffInfo {
  index: number; // Staff number (0, 1, 2...)
  numVoices: number; // How many voices are assigned to this staff
  bracket?: object; // Bracket grouping for ensemble scores (abcjs uses object type)
  brace?: object; // Brace grouping for piano scores (abcjs uses object type)
  connectBarLines?: boolean; // Bar line connections (abcjs uses boolean type)
}

/**
 * Maps a voice ID to its staff and position within that staff.
 */
export interface VxStaff {
  staffNum: number; // Which staff this voice writes to (0, 1, 2...)
  index: number; // Position within the staff's voices array (0, 1, 2...)
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
  measureAccidentals: Map<string, AccidentalType>; // Cleared each measure

  // Beam tracking (for automatic beaming)
  potentialStartBeam?: NoteElement; // First note of potential beam group
  potentialEndBeam?: NoteElement; // Last note of potential beam group

  // Tie tracking (for connecting same pitches across barlines)
  pendingTies: Map<number, {}>; // Map of pitch number to tie object

  // Slur tracking (for phrasing marks)
  pendingStartSlurs: number[]; // Labels for slurs that need to start on next note
  pendingEndSlurs: number[]; // Labels for slurs that need to end on next note
  nextSlurLabel: number; // Counter for generating unique slur labels

  // Tuplet tracking (for triplets, quintuplets, etc.)
  tupletNotesLeft: number; // Number of notes remaining in current tuplet
  tupletP: number; // p in (p:q:r notation
  tupletQ: number; // q in (p:q:r notation
  tupletR: number; // r in (p:q:r notation

  // Decoration tracking (for ornaments and articulations)
  pendingDecorations: Decorations[]; // Decorations to apply to next note

  // Grace note tracking (for ornamental notes before main note)
  pendingGraceNotes: any[]; // Grace notes to apply to next note

  // Chord symbol tracking (for guitar chord annotations)
  pendingChordSymbols: any[]; // Chord symbols to apply to next note

  // Broken rhythm tracking (for dotted rhythms like < and >)
  nextNoteDurationMultiplier?: IRational; // Multiplier for next note's duration from broken rhythm
}

type VoiceID = string;

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
  currentVoice: string;
  measureNumber: number;

  // Voice tracking
  voices: Map<VoiceID, VoiceState>;

  // Multi-staff tracking
  staves: StaffInfo[]; // Staff configuration (one per staff)
  vxStaff: Map<VoiceID, VxStaff>; // Maps voice ID to staff/index
  voiceCurrentSystem: Map<VoiceID, number>; // Tracks where each voice last wrote

  // Current write location (cached for performance)
  currentSystemNum: number; // Which system (tune.systems[]) to write to
  currentStaffNum: number; // Which staff within the system
  currentVoiceIndex: number; // Which voice within the staff

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
    currentVoice: "",
    measureNumber: 1,
    voices: new Map(),

    // Multi-staff tracking (initially empty)
    staves: [],
    vxStaff: new Map(),
    voiceCurrentSystem: new Map(),

    // Current write location (will be set on first voice switch)
    currentSystemNum: 0,
    currentStaffNum: 0,
    currentVoiceIndex: 0,

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
    systems: [],
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
    verticalPos: 0,
    clefPos: 0,
  };
}

export function createVoiceState(id: string, properties: VoiceProperties, tuneDefaults: TuneDefaults): VoiceState {
  return {
    id,
    properties,
    currentKey: tuneDefaults.key,
    currentClef: properties.clef || tuneDefaults.clef,
    currentMeter: tuneDefaults.meter,
    measureAccidentals: new Map(),
    pendingTies: new Map(),
    pendingStartSlurs: [],
    pendingEndSlurs: [],
    nextSlurLabel: 101, // abcjs starts at 101
    tupletNotesLeft: 0,
    tupletP: 0,
    tupletQ: 0,
    tupletR: 0,
    pendingDecorations: [],
    pendingGraceNotes: [],
    pendingChordSymbols: [],
  };
}

// ============================================================================
// State Management Functions
// ============================================================================

export function getCurrentVoice(state: InterpreterState): VoiceState | undefined {
  return state.voices.get(state.currentVoice);
}

export function addVoice(state: InterpreterState, id: string, properties: VoiceProperties): void {
  const voice = createVoiceState(id, properties, state.tuneDefaults);
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

// ============================================================================
// Multi-Staff Helper Functions
// ============================================================================

/**
 * Assigns a voice to a staff automatically based on ABC specification rules.
 *
 * Rules:
 * - First voice → creates staff 0
 * - Subsequent voices → create new staff (unless `merge` property is set)
 * - `V:X merge` → adds voice to the most recently created staff
 *
 * This function is called when a voice is encountered that hasn't been
 * explicitly assigned to a staff (e.g., via %%score directive).
 */
export function assignStaff(state: InterpreterState, voiceId: string, properties?: VoiceProperties): void {
  if (state.staves.length === 0) {
    // First voice creates first staff
    state.staves.push({ index: 0, numVoices: 1 });
    state.vxStaff.set(voiceId, { staffNum: 0, index: 0 });
  } else if (properties?.merge) {
    // "V:X merge" adds to last staff
    const lastStaff = state.staves[state.staves.length - 1];
    state.vxStaff.set(voiceId, {
      staffNum: lastStaff.index,
      index: lastStaff.numVoices,
    });
    lastStaff.numVoices++;
  } else {
    // Default: create new staff for this voice
    const newStaffIndex = state.staves.length;
    state.staves.push({ index: newStaffIndex, numVoices: 1 });
    state.vxStaff.set(voiceId, { staffNum: newStaffIndex, index: 0 });
  }
}

/**
 * Finds an available system for a voice to write to, or returns the index
 * for a new system if all existing systems have content for this voice.
 *
 * This implements the "find-or-create" pattern from abcjs:
 * - Search from `startFrom` for the first system where this voice slot is empty
 * - If all systems have content, return tune.systems.length (create new system)
 *
 * This allows voices to be written in any order and fill systems incrementally.
 */
export function getSystemIdx(tune: Tune, vxStaff: VxStaff, curSystem: number): number {
  const { staffNum, index: voiceIndex } = vxStaff;
  // Search from startFrom for first available slot
  for (let i = curSystem; i < tune.systems.length; i++) {
    const system = tune.systems[i];

    // Skip non-music lines (text, subtitles, etc.)
    if (!("staff" in system)) continue;

    const staff = (system as StaffSystem).staff;

    // Check if this voice slot is empty or has no notes
    if (!staff[staffNum] || !staff[staffNum].voices[voiceIndex] || staff[staffNum].voices[voiceIndex].length === 0) {
      return i;
    }
  }

  // All systems have content for this voice, need a new system
  return tune.systems.length;
}

/**
 * Ensures that the nested structure exists for writing to a specific
 * system/staff/voice location. Creates any missing levels.
 *
 * Structure: tune.systems[systemNum].staff[staffNum].voices[voiceIndex]
 *
 * This function is idempotent - safe to call multiple times for the same location.
 */
export function ensureVxStaff(state: InterpreterState, systemIdx: number, vxStaff: VxStaff, voiceState: VoiceState): void {
  const { staffNum, index: voiceIndex } = vxStaff;
  const tune = state.tune;
  // Ensure system exists
  while (tune.systems.length <= systemIdx) {
    const system: StaffSystem = {
      staff: [],
    };
    tune.systems.push(system);
  }

  const system = tune.systems[systemIdx] as StaffSystem;

  // Ensure staff exists in this system
  if (!system.staff[staffNum]) {
    const staffInfo = state.staves[staffNum];

    const newStaff: Staff = {
      clef: voiceState.currentClef,
      key: voiceState.currentKey,
      meter: voiceState.currentMeter,
      workingClef: voiceState.currentClef,
      voices: [],
    };

    // Copy bracket/brace info from StaffInfo if present
    if (staffInfo.bracket) newStaff.bracket = staffInfo.bracket;
    if (staffInfo.brace) newStaff.brace = staffInfo.brace;
    if (staffInfo.connectBarLines) newStaff.connectBarLines = staffInfo.connectBarLines;

    system.staff[staffNum] = newStaff;
  }

  // Ensure voice array exists in this staff
  const staff = system.staff[staffNum];
  while (staff.voices.length <= voiceIndex) {
    staff.voices.push([]);
  }
}

/**
 * Switches the interpreter to write to a specific voice.
 *
 * This is the main orchestration function that:
 * 1. Looks up where this voice should write (staff/index from voiceMetadata)
 * 2. Finds or creates an available system for this voice
 * 3. Ensures the nested structure exists
 * 4. Caches the write location for fast element creation
 * 5. Updates tracking so next switch starts from the next system
 *
 * After calling this, elements can be written directly to:
 * tune.systems[currentSystemNum].staff[currentStaffNum].voices[currentVoiceIndex]
 */
export function switchToVoice(state: InterpreterState, voiceId: string): void {
  // Get or create voice metadata
  const vxStaff = state.vxStaff.get(voiceId);
  if (!vxStaff) {
    throw new Error(`Voice ${voiceId} not assigned to staff. Call assignVoiceToStaffAutomatically first.`);
  }

  const curSystem = state.voiceCurrentSystem.get(voiceId) ?? 0;

  // Find next available system slot for this voice
  const systemIdx = getSystemIdx(state.tune, vxStaff, curSystem);

  // Get voice state
  const voiceState = state.voices.get(voiceId);
  if (!voiceState) {
    throw new Error(`Voice state not found for ${voiceId}`);
  }

  // Ensure the structure exists
  ensureVxStaff(state, systemIdx, vxStaff, voiceState);

  // Cache the write location for subsequent element creation
  state.currentSystemNum = systemIdx;
  state.currentStaffNum = vxStaff.staffNum;
  state.currentVoiceIndex = vxStaff.index;
  state.currentVoice = voiceId;

  // Next time we switch to this voice, start searching from current system first,
  // then move to next if current is full. This ensures voices can continue
  // writing to the same system if it still has space.
  // Note: We DON'T increment systemNum here because we want to check the current
  // system first on the next switch. The findOrCreateSystemForVoice function
  // will correctly detect if this slot already has content and move to the next.
  state.voiceCurrentSystem.set(voiceId, systemIdx);
}

/**
 * Switch to this voice,
 * creating it if missing,
 * creatig its system/staff slot if missing.
 *
 * This function:
 * 1. Creates voice state if it doesn't exist
 * 2. Assigns voice to staff if not already assigned
 * 3. Updates voice properties if provided
 * 4. Switches to the voice for writing
 *
 * Call this whenever a V: directive is encountered (header, body, or inline field).
 */
export function applyVoice(state: InterpreterState, voice: { id: string; properties: VoiceProperties }): void {
  const { id: voiceId, properties } = voice;
  // 1. Create voice state if doesn't exist
  if (!state.voices.has(voiceId)) {
    addVoice(state, voiceId, properties || {});
  } else if (properties) {
    const voice = state.voices.get(voiceId)!;
    if (properties.clef) {
      voice.currentClef = properties.clef;
    }
    if (properties.name !== undefined) {
      voice.properties.name = properties.name;
    }

    voice.properties = { ...voice.properties, ...properties };
  }

  // 2. Check if already assigned to staff
  if (!state.vxStaff.has(voiceId)) {
    assignStaff(state, voiceId, properties);
  }

  // 3. Switch to this voice
  switchToVoice(state, voiceId);
}
