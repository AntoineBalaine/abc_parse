import {
  KeySignature,
  Meter,
  ClefProperties,
  TempoProperties,
  MetaText,
  KeyRoot,
  KeyAccidental,
  Mode,
  ClefType,
  VoiceProperties,
} from "../types/abcjs-ast";
import { IRational, createRational } from "../Visitors/fmt2/rational";

export interface VoiceContext {
  id: string;
  properties: VoiceProperties;
  currentKey: KeySignature;
  currentClef: ClefProperties;
  currentMeter?: Meter;
  transpose: number;
  octave: number;
  accidentals: Map<string, "sharp" | "flat" | "natural">; // Active accidentals in current measure
}

export interface InterpreterContext {
  // Global musical context
  defaultKey: KeySignature;
  defaultMeter?: Meter;
  defaultNoteLength: IRational;
  defaultTempo?: TempoProperties;

  // Voice and staff management
  voices: Map<string, VoiceContext>;
  currentVoiceId?: string;

  // Metadata
  metaText: MetaText;

  // User-defined symbols and macros
  userSymbols: Map<string, string>;
  macros: Map<string, string>;

  // Global formatting properties
  formatting: { [key: string]: any };

  // Visual transposition
  visualTranspose?: number;

  // Current processing state
  measureNumber: number;
  charPosition: number;
}

// Context creation
export function createInterpreterContext(): InterpreterContext {
  return {
    defaultKey: {
      root: KeyRoot.C,
      acc: KeyAccidental.None,
      mode: Mode.Major,
      accidentals: [],
      impliedNaturals: [],
      explicitAccidentals: [],
    },
    defaultNoteLength: createRational(1, 8), // Default to 1/8 note
    voices: new Map(),
    metaText: {},
    userSymbols: new Map(),
    macros: new Map(),
    formatting: {},
    measureNumber: 1,
    charPosition: 0,
  };
}

// Reset context to initial state
export function resetContext(ctx: InterpreterContext): void {
  ctx.defaultKey = {
    root: KeyRoot.C,
    acc: KeyAccidental.None,
    mode: Mode.Major,
    accidentals: [],
    impliedNaturals: [],
    explicitAccidentals: [],
  };
  ctx.defaultNoteLength = createRational(1, 8);
  ctx.voices.clear();
  ctx.metaText = {};
  ctx.userSymbols.clear();
  ctx.macros.clear();
  ctx.formatting = {};
  ctx.measureNumber = 1;
  ctx.charPosition = 0;
  delete ctx.currentVoiceId;
  delete ctx.defaultMeter;
  delete ctx.defaultTempo;
  delete ctx.visualTranspose;
}

// Voice management functions
export function getCurrentVoice(ctx: InterpreterContext): VoiceContext | undefined {
  if (ctx.currentVoiceId) {
    return ctx.voices.get(ctx.currentVoiceId);
  }
  return undefined;
}

export function addVoice(ctx: InterpreterContext, id: string, properties: VoiceProperties): void {
  const voice: VoiceContext = {
    id,
    properties,
    currentKey: ctx.defaultKey,
    currentClef: properties.clef || getDefaultClef(),
    currentMeter: ctx.defaultMeter,
    transpose: properties.transpose || 0,
    octave: properties.octave || 0,
    accidentals: new Map(),
  };

  ctx.voices.set(id, voice);
}

export function setCurrentVoice(ctx: InterpreterContext, id: string): void {
  if (ctx.voices.has(id)) {
    ctx.currentVoiceId = id;
  } else {
    throw new Error(`Voice ${id} not found`);
  }
}

// Key signature management
export function setDefaultKey(ctx: InterpreterContext, key: KeySignature): void {
  ctx.defaultKey = key;

  // Update all voices that don't have their own key
  for (const voice of ctx.voices.values()) {
    if (!voice.properties.clef || !voice.properties.transpose) {
      voice.currentKey = key;
    }
  }
}

export function setVoiceKey(ctx: InterpreterContext, voiceId: string, key: KeySignature): void {
  const voice = ctx.voices.get(voiceId);
  if (voice) {
    voice.currentKey = key;
    // Clear accidentals when key changes
    voice.accidentals.clear();
  }
}

// Meter management
export function setDefaultMeter(ctx: InterpreterContext, meter: Meter): void {
  ctx.defaultMeter = meter;

  // Update all voices
  for (const voice of ctx.voices.values()) {
    voice.currentMeter = meter;
  }
}

export function setVoiceMeter(ctx: InterpreterContext, voiceId: string, meter: Meter): void {
  const voice = ctx.voices.get(voiceId);
  if (voice) {
    voice.currentMeter = meter;
  }
}

// Accidental management
export function setAccidental(ctx: InterpreterContext, note: string, accidental: "sharp" | "flat" | "natural", voiceId?: string): void {
  const targetVoiceId = voiceId || ctx.currentVoiceId;
  if (!targetVoiceId) return;

  const voice = ctx.voices.get(targetVoiceId);
  if (voice) {
    voice.accidentals.set(note.toUpperCase(), accidental);
  }
}

export function getAccidental(ctx: InterpreterContext, note: string, voiceId?: string): "sharp" | "flat" | "natural" | undefined {
  const targetVoiceId = voiceId || ctx.currentVoiceId;
  if (!targetVoiceId) return undefined;

  const voice = ctx.voices.get(targetVoiceId);
  if (voice) {
    return voice.accidentals.get(note.toUpperCase());
  }
  return undefined;
}

export function clearMeasureAccidentals(ctx: InterpreterContext, voiceId?: string): void {
  const targetVoiceId = voiceId || ctx.currentVoiceId;
  if (!targetVoiceId) return;

  const voice = ctx.voices.get(targetVoiceId);
  if (voice) {
    voice.accidentals.clear();
  }
}

// Measure management
export function nextMeasure(ctx: InterpreterContext): void {
  ctx.measureNumber++;

  // Clear accidentals for all voices
  for (const voice of ctx.voices.values()) {
    voice.accidentals.clear();
  }
}

// Helper functions
function getDefaultClef(): ClefProperties {
  return {
    type: ClefType.Treble,
    verticalPos: 0,
    clefPos: 0,
  };
}

// Create a snapshot of the current state for debugging
export function createSnapshot(ctx: InterpreterContext): object {
  return JSON.parse(
    JSON.stringify({
      defaultKey: ctx.defaultKey,
      defaultMeter: ctx.defaultMeter,
      defaultNoteLength: ctx.defaultNoteLength,
      voices: Array.from(ctx.voices.entries()),
      currentVoiceId: ctx.currentVoiceId,
      measureNumber: ctx.measureNumber,
      charPosition: ctx.charPosition,
      metaText: ctx.metaText,
      userSymbols: Array.from(ctx.userSymbols.entries()),
      macros: Array.from(ctx.macros.entries()),
    })
  );
}
