import {
  Tune,
  MetaText,
  MediaType,
  MusicLine,
  VoiceElement,
  KeySignature,
  Meter,
  ClefProperties,
  TempoProperties,
  KeyRoot,
  KeyAccidental,
  ClefType,
  AccidentalType,
  Mode,
} from "../types/abcjs-ast";
import { HeaderCtx, ROHeadrCtx } from "./HeaderContext";
import { VoiceProperties } from "./InfoLineParser";
import { Rational, createRational } from "../Visitors/fmt2/rational";

// Constants for cascading defaults
const DEFAULT_VOICE_ID = "default";

const INTERPRETER_CONSTANTS: Pick<HeaderCtx, "defaultKey" | "defaultNoteLength" | "defaultClef" | "defaultVoiceProperties"> = {
  defaultKey: {
    root: KeyRoot.C,
    acc: KeyAccidental.None,
    mode: Mode.Major,
    accidentals: [],
    impliedNaturals: [],
    explicitAccidentals: [],
  },
  defaultNoteLength: createRational(1, 8),
  defaultClef: {
    type: ClefType.Treble,
    verticalPos: 6,
    clefPos: 0,
  },
  defaultVoiceProperties: {},
};

interface ResolvedDefaults {
  // Merged from tuneHeader -> fileHeader -> constants
  defaultKey: KeySignature;
  defaultMeter?: Meter;
  defaultNoteLength: Rational;
  defaultTempo?: TempoProperties;
  defaultClef: ClefProperties;
  defaultVoiceProperties: VoiceProperties;

  // Macros/symbols for expansion
  macros: ReadonlyMap<string, string>;
  userSymbols: ReadonlyMap<string, string>;
}

interface VoiceRunningContext {
  id: string;
  properties: VoiceProperties; // From V: declaration

  // Mutable voice state during processing
  currentKey: KeySignature;
  currentClef: ClefProperties;
  currentMeter?: Meter;

  // Measure-scoped accidentals (cleared each measure)
  accidentals: Map<string, AccidentalType>;

  // Output accumulator
  elements: VoiceElement[];
}

export interface TuneBodyContext {
  // Context hierarchy (immutable references)
  fileHeader: ROHeadrCtx;
  tuneHeader: ROHeadrCtx;

  // Resolved defaults (merged from tune -> file -> constants)
  resolvedDefaults: ResolvedDefaults;

  // Voice state machine
  voiceContexts: Map<string, VoiceRunningContext>;
  currentVoiceId: string;

  // Output AST - building the Tune structure (data properties only)
  outputTune: Pick<
    Tune,
    "version" | "media" | "metaText" | "metaTextInfo" | "formatting" | "lines" | "staffNum" | "voiceNum" | "lineNum" | "visualTranspose"
  >;

  // Processing state
  measureNumber: number;
  expansionDepth: number;

  // Current line being built
  currentMusicLine?: MusicLine;
}

export function createTuneBodyContext(fileHeader: ROHeadrCtx, tuneHeader: ROHeadrCtx): TuneBodyContext {
  const resolvedDefaults = mergeDefaults(fileHeader, tuneHeader);

  return {
    fileHeader,
    tuneHeader,
    resolvedDefaults,
    voiceContexts: createVoiceContextsFromHeaders(tuneHeader, resolvedDefaults),
    currentVoiceId: DEFAULT_VOICE_ID,
    outputTune: {
      version: "2.0",
      media: MediaType.Screen,
      metaText: buildMetaText(fileHeader, tuneHeader),
      metaTextInfo: {},
      formatting: { ...fileHeader.formatting, ...tuneHeader.formatting },
      lines: [],
      staffNum: 0,
      voiceNum: 0,
      lineNum: 0,
    },
    measureNumber: 1,
    expansionDepth: 0,
    currentMusicLine: undefined,
  };
}

function mergeDefaults(fileHeader: ROHeadrCtx, tuneHeader: ROHeadrCtx): ResolvedDefaults {
  return {
    // Cascading defaults: tune -> file -> constants
    defaultKey: tuneHeader.defaultKey || fileHeader.defaultKey || INTERPRETER_CONSTANTS.defaultKey,
    defaultMeter: tuneHeader.defaultMeter || fileHeader.defaultMeter,
    defaultNoteLength: tuneHeader.defaultNoteLength || fileHeader.defaultNoteLength || INTERPRETER_CONSTANTS.defaultNoteLength,
    defaultTempo: tuneHeader.defaultTempo || fileHeader.defaultTempo,
    defaultClef: tuneHeader.defaultClef || fileHeader.defaultClef || INTERPRETER_CONSTANTS.defaultClef,
    defaultVoiceProperties: {
      ...INTERPRETER_CONSTANTS.defaultVoiceProperties,
      ...fileHeader.defaultVoiceProperties,
      ...tuneHeader.defaultVoiceProperties,
    },

    // Combine macros and symbols (tune level can add to file level)
    macros: new Map([...(fileHeader.macros?.entries() || []), ...(tuneHeader.macros?.entries() || [])]),
    userSymbols: new Map([...(fileHeader.userSymbols?.entries() || []), ...(tuneHeader.userSymbols?.entries() || [])]),
  };
}

function createVoiceContextsFromHeaders(tuneHeader: ROHeadrCtx, resolvedDefaults: ResolvedDefaults): Map<string, VoiceRunningContext> {
  const voices = new Map<string, VoiceRunningContext>();

  // TODO: Extract voice declarations from tune header
  // For now, create a default voice
  const defaultVoice: VoiceRunningContext = {
    id: DEFAULT_VOICE_ID,
    properties: resolvedDefaults.defaultVoiceProperties,
    currentKey: resolvedDefaults.defaultKey,
    currentClef: resolvedDefaults.defaultClef,
    currentMeter: resolvedDefaults.defaultMeter,
    accidentals: new Map(),
    elements: [],
  };

  voices.set(DEFAULT_VOICE_ID, defaultVoice);
  return voices;
}

function buildMetaText(fileHeader: ROHeadrCtx, tuneHeader: ROHeadrCtx): MetaText {
  return {
    // Tune header wins over file header for metadata
    title: tuneHeader.title || fileHeader.title,
    composer: tuneHeader.composer || fileHeader.composer,
    origin: tuneHeader.origin || fileHeader.origin,
    book: tuneHeader.book || fileHeader.book,
    notes: tuneHeader.notes || fileHeader.notes,
    transcription: tuneHeader.transcription || fileHeader.transcription,
    history: tuneHeader.history || fileHeader.history,
    tempo: tuneHeader.defaultTempo || fileHeader.defaultTempo,
  };
}

export function interpretTuneBody(
  fileHeader: ROHeadrCtx,
  tuneHeader: ROHeadrCtx,
  tuneBody: any[] // TODO: Define proper tune body element type
): TuneBodyContext {
  const context = createTuneBodyContext(fileHeader, tuneHeader);

  for (const element of tuneBody) {
    processElement(context, element); // Mutates context directly
  }

  // Finalize any remaining music line
  if (context.currentMusicLine) {
    finalizeCurrentMusicLine(context);
  }

  return context;
}

function processElement(context: TuneBodyContext, element: any): void {
  // TODO: Implement element processing based on element type
  // This will handle:
  // - Voice switches (V: directives)
  // - Musical elements (notes, bars, clefs, etc.)
  // - Line breaks and text elements
  // - Macro expansion
}

function finalizeCurrentMusicLine(context: TuneBodyContext): void {
  if (context.currentMusicLine) {
    context.outputTune.lines.push(context.currentMusicLine);
    context.currentMusicLine = undefined;
    context.outputTune.lineNum++;
  }
}
