/**
 * Tune Interpreter
 *
 * Main interpreter that converts ABC AST into ABCJS Tune format.
 * Uses semantic data pre-computed by the analyzer and builds incrementally
 * following the ABCJS builder pattern.
 */

import { SemanticAnalyzer } from "../analyzers/semantic-analyzer";
import { SemanticData } from "../analyzers/semantic-analyzer";
import { ABCContext } from "../parsers/Context";
import { Token, TT } from "../parsers/scan2";
import {
  Tune,
  StaffSystem,
  Staff,
  VoiceElement,
  NoteElement,
  BarElement,
  ElementType,
  RestType,
  BarType,
  Pitch as ABCJSPitch,
  AccidentalType,
  LyricProperties,
  LyricDivider,
  Decorations,
  ClefProperties,
  KeyElement,
  MeterElement,
} from "../types/abcjs-ast";
import { InfoLineUnion } from "../types/Expr2";
import {
  Visitor,
  File_structure,
  File_header,
  Tune as TuneExpr,
  Tune_header,
  Tune_Body,
  Info_line,
  Directive,
  Music_code,
  Note,
  Rest,
  Chord,
  BarLine,
  Grace_group,
  Decoration,
  SystemBreak,
  Symbol,
  Beam,
  Tuplet,
  Annotation,
  Inline_field,
  MultiMeasureRest,
  YSPACER,
  Voice_overlay,
  Line_continuation,
  Macro_decl,
  Macro_invocation,
  User_symbol_decl,
  User_symbol_invocation,
  Lyric_line,
  Lyric_section,
  Pitch,
  Rhythm,
  ErrorExpr,
  KV,
  Binary,
  Grouping,
  AbsolutePitch,
  Rational,
  Measurement,
  Comment,
  isKeyInfo,
  isMeterInfo,
  isVoiceInfo,
  isTempoInfo,
  isNoteLengthInfo,
  isTitleInfo,
  isComposerInfo,
  isOriginInfo,
  isReferenceNumberInfo,
  isRhythmInfo,
  isBookInfo,
  isSourceInfo,
  isDiscographyInfo,
  isNotesInfo,
  isTranscriptionInfo,
  isHistoryInfo,
  isAuthorInfo,
} from "../types/Expr2";
import { IRational, createRational, multiplyRational, rationalToNumber } from "../Visitors/fmt2/rational";
import { RangeVisitor } from "../Visitors/RangeVisitor";
import {
  InterpreterState,
  FileDefaults,
  createFileDefaults,
  createInterpreterState,
  getCurrentVoice,
  nextMeasure,
  TuneDefaults,
  VoiceState,
  applyVoice,
} from "./InterpreterState";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Tuplet Q lookup table (abcjs tripletQ)
 * Maps p (number of notes) to q (time they fit into)
 * E.g., (3 means 3 notes in the time of 2
 */
const TUPLET_Q: Record<number, number> = {
  2: 3, // (2 → 2 notes in time of 3
  3: 2, // (3 → 3 notes in time of 2
  4: 3, // (4 → 4 notes in time of 3
  5: 2, // (5 → 5 notes in time of 2
  6: 2, // (6 → 6 notes in time of 2
  7: 2, // (7 → 7 notes in time of 2
  8: 3, // (8 → 8 notes in time of 3
  9: 2, // (9 → 9 notes in time of 2
};

/**
 * Decoration mapping (abcjs letter_to_accent)
 * Maps ABC decoration symbols to abcjs decoration names
 */
const DECORATION_MAP: Record<string, string> = {
  ".": "staccato",
  u: "upbow",
  v: "downbow",
  "~": "irishroll",
  H: "fermata",
  J: "slide",
  L: "accent",
  M: "mordent",
  O: "coda",
  P: "pralltriller",
  R: "roll",
  S: "segno",
  T: "trill",
};

/**
 * Calculate rhythm multiplier from a Rhythm expression.
 *
 * Examples:
 *   "2" → 2/1
 *   "/" → 1/2
 *   "//" → 1/4
 *   "///" → 1/8
 *   "/2" → 1/2
 *   "3/2" → 3/2
 *   "0" → 0/1 (grace notes)
 */
/**
 * Get broken rhythm multipliers based on the broken rhythm symbol
 * Returns [currentNoteMultiplier, nextNoteMultiplier] as rationals
 *
 * Pattern: first note takes (2 - 1/2^n), second note takes 1/2^n
 * where n is the number of symbols
 *
 * Examples:
 *   > (n=1): [3/2, 1/2] = [1.5, 0.5]
 *   >> (n=2): [7/4, 1/4] = [1.75, 0.25]
 *   >>> (n=3): [15/8, 1/8] = [1.875, 0.125]
 */
function getBrokenRhythmMultipliers(brokenLexeme: string): [IRational, IRational] {
  const char = brokenLexeme[0];
  const count = brokenLexeme.length;

  // Short note denominator: 2^n (2, 4, 8, ...)
  const shortNoteDenominator = Math.pow(2, count);
  const shortNoteNumerator = 1;

  // Long note = 2 - (short note) = (2 * 2^n - 1) / 2^n
  const longNoteNumerator = 2 * shortNoteDenominator - 1;
  const longNoteDenominator = shortNoteDenominator;

  if (char === ">") {
    // Current note gets longer, next note gets shorter
    return [createRational(longNoteNumerator, longNoteDenominator), createRational(shortNoteNumerator, shortNoteDenominator)];
  } else if (char === "<") {
    // Current note gets shorter, next note gets longer
    return [createRational(shortNoteNumerator, shortNoteDenominator), createRational(longNoteNumerator, longNoteDenominator)];
  }

  return [createRational(1, 1), createRational(1, 1)]; // Default (shouldn't happen)
}

/**
 * Calculate the full duration for a musical element (note/rest/chord)
 * including broken rhythm handling.
 *
 * @param rhythm - The rhythm expression from the AST
 * @param defaultLength - The default note length from tune state
 * @param voiceState - Voice state for broken rhythm tracking (optional for stateless calculation)
 * @returns Duration and optional next-note multiplier
 */
function calculateRhythm(
  rhythm: Rhythm | undefined | null,
  defaultLength: IRational,
  voiceState?: VoiceState
): {
  duration: IRational; // Final duration for current note
  nextMultiplier?: IRational; // Multiplier to store for next note (if broken rhythm)
} {
  // Step 1: Calculate base rhythm multiplier (without broken rhythm)
  let baseMultiplier: IRational;

  if (!rhythm) {
    baseMultiplier = createRational(1, 1);
  } else if (rhythm.broken) {
    // Broken rhythms don't have additional rhythm notation
    baseMultiplier = createRational(1, 1);
  } else {
    // Parse rhythm notation (numerator/denominator)
    let num = 1;
    let den = 1;

    if (rhythm.numerator) {
      const numValue = parseInt(rhythm.numerator.lexeme, 10);
      if (!isNaN(numValue)) {
        num = numValue;
      }
    }

    if (rhythm.separator) {
      if (rhythm.separator.lexeme === "/") {
        // Single slash
        if (rhythm.denominator) {
          const denValue = parseInt(rhythm.denominator.lexeme, 10);
          if (!isNaN(denValue) && denValue > 0) {
            den = denValue;
          } else {
            // "/" with invalid number → implied /2
            den = 2;
          }
        } else {
          // "/" alone → implied /2
          den = 2;
        }
      } else {
        // Multiple slashes: each slash divides by 2
        const slashCount = rhythm.separator.lexeme.length;
        den = Math.pow(2, slashCount);
      }
    }

    baseMultiplier = createRational(num, den);
  }

  // Step 2: Calculate duration = defaultLength * baseMultiplier
  let duration = multiplyRational(defaultLength, baseMultiplier);

  // Step 3: Apply pending broken rhythm from previous note (if any)
  let nextMultiplier: IRational | undefined;

  if (voiceState?.nextNoteDurationMultiplier) {
    duration = multiplyRational(duration, voiceState.nextNoteDurationMultiplier);
    // Clear the multiplier after applying (side effect on voiceState)
    voiceState.nextNoteDurationMultiplier = undefined;
  }

  // Step 4: Handle broken rhythm on current note (if any)
  if (rhythm?.broken && voiceState) {
    const [currentMultiplier, nextMult] = getBrokenRhythmMultipliers(rhythm.broken.lexeme);
    duration = multiplyRational(duration, currentMultiplier);
    nextMultiplier = nextMult; // To be stored by caller
  }

  return {
    duration,
    nextMultiplier,
  };
}

/**
 * Beaming Helper Functions
 *
 * Based on abcjs beaming algorithm:
 * - Notes with duration < 0.25 can be beamed
 * - Beams break on: quarter notes, rests, bars, whitespace
 * - Track potentialStartBeam and potentialEndBeam per voice
 */

/**
 * Check if a note can be beamed (duration < 1/4)
 */
function canBeam(duration: IRational): boolean {
  // duration < 1/4
  // duration.num / duration.den < 1/4
  // duration.num * 4 < duration.den
  return duration.numerator * 4 < duration.denominator;
}

/**
 * End the current beam group (if any) by setting startBeam and endBeam properties
 */
function endBeamGroup(voiceState: VoiceState): void {
  if (voiceState.potentialStartBeam && voiceState.potentialEndBeam) {
    voiceState.potentialStartBeam.startBeam = true;
    voiceState.potentialEndBeam.endBeam = true;
  }
  voiceState.potentialStartBeam = undefined;
  voiceState.potentialEndBeam = undefined;
}

/**
 * Process beaming for a note element
 * Call this after creating each note element
 */
function processBeaming(noteElement: NoteElement, voiceState: VoiceState, isRest: boolean): void {
  const duration = noteElement.duration;

  // Beam breaks on:
  // 1. Quarter notes or longer (duration >= 1/4)
  // 2. Rests

  // Check if duration >= 1/4
  // duration.num / duration.den >= 1/4
  // duration.num * 4 >= duration.den
  const isQuarterOrLonger = duration.numerator * 4 >= duration.denominator;

  if (isQuarterOrLonger || isRest) {
    // End beam on previous note (if any)
    endBeamGroup(voiceState);
    return;
  }

  // Short note (8th, 16th, etc.) and not a rest
  if (canBeam(duration) && !isRest) {
    if (!voiceState.potentialStartBeam) {
      // Start new beam group
      voiceState.potentialStartBeam = noteElement;
      voiceState.potentialEndBeam = undefined;
    } else {
      // Continue beam group
      voiceState.potentialEndBeam = noteElement;
    }
  }
}

// ============================================================================
// Tie Processing
// ============================================================================

/**
 * Process tie start for a note/chord
 * When a note has a tie (-), mark it with startTie and add to pendingTies
 */
function processTieStart(pitches: any[], voiceState: VoiceState): void {
  for (const pitch of pitches) {
    if (pitch.pitch !== undefined) {
      pitch.startTie = {};
      voiceState.pendingTies.set(pitch.pitch, {});
    }
  }
}

/**
 * Process tie end for a note/chord
 * In abcjs, a tie connects to the NEXT note/chord, and:
 * - If the next note/chord has the same pitch, that pitch gets endTie
 * - If the next note/chord has different pitches, ALL pending ties end (on ANY pitch in the chord)
 * This matches abcjs behavior where C2-|D2 sets endTie on D.
 */
function processTieEnd(pitches: any[], voiceState: VoiceState): void {
  if (voiceState.pendingTies.size === 0) return;

  // First, try to match pitches exactly
  const matchedPitches = new Set<number>();
  for (const pitch of pitches) {
    if (pitch.pitch !== undefined && voiceState.pendingTies.has(pitch.pitch)) {
      pitch.endTie = true;
      matchedPitches.add(pitch.pitch);
    }
  }

  // Remove matched ties
  for (const matched of matchedPitches) {
    voiceState.pendingTies.delete(matched);
  }

  // If there are still pending ties and we didn't match them, end them on the first pitch
  // This handles the case where C2-|D2 should set endTie on D
  if (voiceState.pendingTies.size > 0 && pitches.length > 0 && pitches[0].pitch !== undefined) {
    pitches[0].endTie = true;
    voiceState.pendingTies.clear();
  }
}

// ============================================================================
// Slur Processing
// ============================================================================

/**
 * Apply start slurs to pitches
 * When we encounter '(' tokens, we add labels to pendingStartSlurs.
 * This function applies those labels to the current note's pitches.
 */
function applyStartSlurs(pitches: any[], voiceState: VoiceState): void {
  if (voiceState.pendingStartSlurs.length === 0) return;

  for (const pitch of pitches) {
    if (pitch.pitch !== undefined) {
      // Apply all pending start slurs to this pitch
      pitch.startSlur = voiceState.pendingStartSlurs.map((label) => ({ label }));
      break; // Only apply to first pitch
    }
  }

  // Clear pending start slurs (they've been applied)
  voiceState.pendingStartSlurs = [];
}

/**
 * Apply end slurs to pitches
 * When we encounter ')' tokens, we add labels to pendingEndSlurs.
 * This function applies those labels to the current note's pitches.
 */
function applyEndSlurs(pitches: any[], voiceState: VoiceState): void {
  if (voiceState.pendingEndSlurs.length === 0) return;

  for (const pitch of pitches) {
    if (pitch.pitch !== undefined) {
      // Apply all pending end slurs to this pitch
      pitch.endSlur = [...voiceState.pendingEndSlurs];
      break; // Only apply to first pitch
    }
  }

  // Clear pending end slurs (they've been applied)
  voiceState.pendingEndSlurs = [];
}

// ============================================================================
// Decoration Processing
// ============================================================================

/**
 * Apply pending decorations to a note element
 * Decorations are ornaments and articulations like staccato, trill, etc.
 */
function applyDecorations(element: NoteElement, voiceState: VoiceState): void {
  if (voiceState.pendingDecorations.length === 0) return;

  // Apply decorations to the element
  element.decoration = [...voiceState.pendingDecorations];

  // Clear pending decorations
  voiceState.pendingDecorations = [];
}

// ============================================================================
// Grace Note Processing
// ============================================================================

/**
 * Apply pending grace notes to a note element
 * Grace notes are ornamental notes that precede the main note
 */
function applyGraceNotes(element: NoteElement, voiceState: VoiceState): void {
  if (voiceState.pendingGraceNotes.length === 0) return;

  // Apply grace notes to the element
  element.gracenotes = [...voiceState.pendingGraceNotes];

  // Clear pending grace notes
  voiceState.pendingGraceNotes = [];
}

// ============================================================================
// Chord Symbol Processing
// ============================================================================

/**
 * Apply pending chord symbols to a note element
 * Chord symbols are guitar chord annotations like "C", "Dm", "G7"
 */
function applyChordSymbols(element: NoteElement, voiceState: VoiceState): void {
  if (voiceState.pendingChordSymbols.length === 0) return;

  // Apply chord symbols to the element
  element.chord = [...voiceState.pendingChordSymbols];

  // Clear pending chord symbols
  voiceState.pendingChordSymbols = [];
}

// ============================================================================
// Tuplet Processing
// ============================================================================

/**
 * Apply tuplet properties to a note element
 * If we're in an active tuplet, mark the first note with startTriplet and tripletMultiplier,
 * and the last note with endTriplet.
 */
function applyTuplet(element: NoteElement, voiceState: VoiceState): void {
  if (voiceState.tupletNotesLeft <= 0) return;

  // First note of tuplet gets startTriplet, tripletMultiplier, and tripletR
  if (voiceState.tupletNotesLeft === voiceState.tupletR) {
    element.startTriplet = voiceState.tupletP;
    element.tripletMultiplier = voiceState.tupletQ / voiceState.tupletP;
    element.tripletR = voiceState.tupletR;
  }

  // Decrement counter
  voiceState.tupletNotesLeft--;

  // Last note of tuplet gets endTriplet
  if (voiceState.tupletNotesLeft === 0) {
    element.endTriplet = true;
  }
}

// ============================================================================
// Type Guards for SemanticData
// ============================================================================

function isInfoLineSemanticData(data: SemanticData): data is InfoLineUnion {
  const infoTypes = [
    "key",
    "meter",
    "voice",
    "tempo",
    "title",
    "composer",
    "origin",
    "note_length",
    "clef",
    "reference_number",
    "rhythm",
    "book",
    "source",
    "discography",
    "notes",
    "transcription",
    "history",
    "author",
  ];
  return infoTypes.includes(data.type);
}

// ============================================================================
// Helper Functions for Processing Semantic Data
// ============================================================================

type HeaderContext =
  | { type: "file_header"; target: FileDefaults }
  | { type: "tune_header"; target: { tune: Tune; tuneDefaults: TuneDefaults; parserConfig: import("./InterpreterState").ParserConfig } };

/**
 * Process info line semantic data and assign to appropriate target
 * @returns Warning message if info line is not valid in this context
 */
function applyInfoLine(semanticData: InfoLineUnion, context: HeaderContext): string | null {
  // Process properties that work in both file and tune headers
  const metaText = context.type === "file_header" ? context.target.metaText : context.target.tune.metaText;

  if (isTitleInfo(semanticData)) {
    let title = semanticData.data;

    // Apply titlecaps transformation if directive is set
    const parserConfig = context.type === "file_header" ? context.target.parserConfig : context.target.parserConfig;
    if (parserConfig.titlecaps === true) {
      title = title.toUpperCase();
    }

    metaText.title = title;
    return null;
  }
  if (isComposerInfo(semanticData)) {
    metaText.composer = semanticData.data;
    return null;
  }
  if (isOriginInfo(semanticData)) {
    metaText.origin = semanticData.data;
    return null;
  }
  if (isRhythmInfo(semanticData)) {
    metaText.rhythm = semanticData.data;
    return null;
  }
  if (isBookInfo(semanticData)) {
    metaText.book = semanticData.data;
    return null;
  }
  if (isSourceInfo(semanticData)) {
    metaText.source = semanticData.data;
    return null;
  }
  if (isDiscographyInfo(semanticData)) {
    metaText.discography = semanticData.data;
    return null;
  }
  if (isNotesInfo(semanticData)) {
    metaText.notes = semanticData.data;
    return null;
  }
  if (isTranscriptionInfo(semanticData)) {
    metaText.transcription = semanticData.data;
    return null;
  }
  if (isHistoryInfo(semanticData)) {
    metaText.history = semanticData.data;
    return null;
  }
  if (isAuthorInfo(semanticData)) {
    metaText.author = semanticData.data;
    return null;
  }
  if (isTempoInfo(semanticData)) {
    metaText.tempo = semanticData.data;
    if (context.type === "tune_header") {
      context.target.tuneDefaults.tempo = semanticData.data;
    }
    return null;
  }
  if (isNoteLengthInfo(semanticData)) {
    if (context.type === "file_header") {
      context.target.noteLength = semanticData.data;
    } else {
      context.target.tuneDefaults.noteLength = semanticData.data;
    }
    return null;
  }
  if (isReferenceNumberInfo(semanticData)) {
    // X: (reference number) is typically not stored in metaText
    // Could be stored in metaTextInfo if needed
    return null;
  }

  // Process tune-only properties
  if (context.type === "file_header") {
    return `Info line ${semanticData.type}: is not allowed in file header`;
  }

  // Tune header only
  if (isKeyInfo(semanticData)) {
    context.target.tuneDefaults.key = semanticData.data.keySignature;
    if (semanticData.data.clef) {
      context.target.tuneDefaults.clef = semanticData.data.clef;
    }
  } else if (isMeterInfo(semanticData)) {
    context.target.tuneDefaults.meter = semanticData.data;
  }
  // Voice is handled separately in visitInfoLineExpr

  return null;
}

/**
 * Process directive semantic data and assign to appropriate target
 * @returns Warning message if directive is not valid in this context
 */
function applyDirective(semanticData: SemanticData, directiveName: string, context: HeaderContext): string | null {
  const metaText = context.type === "file_header" ? context.target.metaText : context.target.tune.metaText;
  const formatting = context.type === "file_header" ? context.target.formatting : context.target.tune.formatting;
  const parserConfig = context.type === "file_header" ? context.target.parserConfig : context.target.parserConfig;

  // Handle abc-version specially
  if (semanticData.type === "abc-version") {
    if (context.type === "file_header") {
      context.target.version = semanticData.data;
    } else {
      context.target.tune.version = semanticData.data;
    }
    return null;
  }

  // Handle abc-* metaText directives
  // Multiple occurrences are concatenated with newline (matching abcjs behavior)
  if (semanticData.type === "abc-copyright") {
    const existing = metaText["abc-copyright"];
    metaText["abc-copyright"] = existing ? existing + "\n" + semanticData.data : semanticData.data;
    return null;
  } else if (semanticData.type === "abc-creator") {
    const existing = metaText["abc-creator"];
    metaText["abc-creator"] = existing ? existing + "\n" + semanticData.data : semanticData.data;
    return null;
  } else if (semanticData.type === "abc-edited-by") {
    const existing = metaText["abc-edited-by"];
    metaText["abc-edited-by"] = existing ? existing + "\n" + semanticData.data : semanticData.data;
    return null;
  }

  // List of formatting directives that require a tune context
  const formattingOnlyDirectives = ["bagpipes", "flatbeams", "jazzchords", "accentAbove", "germanAlphabet", "titleleft", "measurebox", "nobarcheck"];

  // Check if this is a formatting directive in file header
  if (context.type === "file_header" && formattingOnlyDirectives.includes(directiveName)) {
    return `Directive %%${directiveName} is not allowed in file header (requires tune context)`;
  }

  // Categorize directives: parser config, formatting, or ignored
  // Parser config directives affect parsing but are not exposed in output
  if (directiveName === "landscape" || directiveName === "titlecaps" || directiveName === "continueall") {
    if (typeof semanticData.data === "boolean") {
      parserConfig[directiveName] = semanticData.data;
    }
  } else if (directiveName === "papersize") {
    if (typeof semanticData.data === "string") {
      parserConfig.papersize = semanticData.data;
    }
  } else if (directiveName === "font") {
    // Ignored directive - abcjs does nothing with it
    return null;
  } else {
    // All other directives go in formatting
    formatting[directiveName] = semanticData;
  }

  return null;
}

// ============================================================================
// Parse Result
// ============================================================================

export interface ParseResult {
  tunes: Tune[];
  warnings?: string[];
}

// ============================================================================
// Main Tune Interpreter
// ============================================================================

export class TuneInterpreter implements Visitor<void> {
  analyzer: SemanticAnalyzer;
  ctx: ABCContext;
  state!: InterpreterState;
  rangeVisitor: RangeVisitor;

  // Working state for file-level processing
  fileDefaults!: FileDefaults;
  tunes: Tune[] = [];

  // Processing context tracking
  processingContext: "file_header" | "tune_header" | "tune_body" = "file_header";

  private sourceText: string = "";
  private lineOffsets: number[] = [];

  constructor(analyzer: SemanticAnalyzer, ctx: ABCContext, sourceText?: string) {
    this.analyzer = analyzer;
    this.ctx = ctx;
    this.rangeVisitor = new RangeVisitor();

    if (sourceText) {
      this.sourceText = sourceText;
      this.calculateLineOffsets();
    }
  }

  private calculateLineOffsets(): void {
    this.lineOffsets = [0];
    for (let i = 0; i < this.sourceText.length; i++) {
      if (this.sourceText[i] === "\n") {
        this.lineOffsets.push(i + 1);
      }
    }
  }

  private toAbsolutePosition(line: number, character: number): number {
    if (line >= this.lineOffsets.length) return character;
    return this.lineOffsets[line] + character;
  }

  /**
   * Pushes an element directly to the current voice's output location.
   *
   * This uses the cached write location (currentSystemNum, currentStaffNum, currentVoiceIndex)
   * that was set by the last voice switch via handleVoiceDirective().
   */
  private pushElement(element: VoiceElement): void {
    const { currentSystemNum, currentStaffNum, currentVoiceIndex } = this.state;

    // Write directly to the final output structure
    const system = this.state.tune.systems[currentSystemNum] as StaffSystem;
    system.staff[currentStaffNum].voices[currentVoiceIndex].push(element);
  }

  /**
   * Gets the current voice's element array for operations that need to read/modify it.
   * Use sparingly - prefer pushElement() for adding elements.
   */
  private getCurrentVoiceElements(): VoiceElement[] {
    const { currentSystemNum, currentStaffNum, currentVoiceIndex } = this.state;
    const system = this.state.tune.systems[currentSystemNum] as StaffSystem;
    return system.staff[currentStaffNum].voices[currentVoiceIndex];
  }

  // ============================================================================
  // Public API
  // ============================================================================

  interpretFile(fileStructure: File_structure): ParseResult {
    this.tunes = [];
    this.fileDefaults = createFileDefaults();

    // Visit the file structure (will process header and tunes)
    fileStructure.accept(this);

    return { tunes: this.tunes };
  }

  // ============================================================================
  // Visitor Implementation
  // ============================================================================

  visitFileStructureExpr(expr: File_structure): void {
    // Process file header first
    if (expr.file_header) {
      expr.file_header.accept(this);
    }

    // Process each tune
    for (const content of expr.contents) {
      if (content instanceof TuneExpr) {
        content.accept(this);
      }
    }
  }

  visitFileHeaderExpr(expr: File_header): void {
    // Set processing context
    this.processingContext = "file_header";

    // Extract file-level info and directives from semantic data
    const context: HeaderContext = { type: "file_header", target: this.fileDefaults };

    for (const item of expr.contents) {
      if (item instanceof Info_line) {
        const semanticData = this.analyzer.data.get(item.id);
        if (semanticData && isInfoLineSemanticData(semanticData)) {
          const warning = applyInfoLine(semanticData, context);
          if (warning) {
            this.ctx.errorReporter.interpreterError(warning, item);
          }
        }
      } else if (item instanceof Directive) {
        const semanticData = this.analyzer.data.get(item.id);
        if (semanticData) {
          const warning = applyDirective(semanticData, item.key.lexeme, context);
          if (warning) {
            this.ctx.errorReporter.interpreterError(warning, item);
          }
        }
      }
    }
  }

  visitTuneExpr(expr: TuneExpr): void {
    // Create fresh state for this tune
    this.state = createInterpreterState(this.analyzer.data, this.fileDefaults);

    // Initialize tune with file defaults (deep copy to avoid sharing references)
    this.state.tune.metaText = structuredClone(this.fileDefaults.metaText);
    this.state.tune.formatting = structuredClone(this.fileDefaults.formatting);
    if (this.fileDefaults.version) {
      this.state.tune.version = this.fileDefaults.version;
    }

    // Set processing context and visit tune header
    this.processingContext = "tune_header";
    expr.tune_header.accept(this);

    // For single-voice tunes without V: directives, create a default voice
    if (this.state.voices.size === 0) {
      applyVoice(this.state, { id: "default", properties: {} });
    }

    // Visit tune body if present
    if (expr.tune_body) {
      expr.tune_body.accept(this);
    }

    // Finalize and store tune
    this.finalizeTune();
    this.tunes.push(this.state.tune);
  }

  visitTuneHeaderExpr(expr: Tune_header): void {
    // Process all info lines and directives
    for (const line of expr.info_lines) {
      line.accept(this);
    }
  }

  visitTuneBodyExpr(expr: Tune_Body): void {
    // Set processing context
    this.processingContext = "tune_body";

    // Process each ABC text line (not systems - voices control system creation now)
    for (const abcLine of expr.sequence) {
      // Visit each element in the ABC text line
      for (const element of abcLine) {
        if (element instanceof Token) {
          continue; // Skip plain tokens
        }
        element.accept(this);
      }
    }

    // Note: No createMusicLine() call needed - elements are written directly
    // to tune.systems via the multi-staff system
  }

  visitInfoLineExpr(expr: Info_line): void {
    const semanticData = this.state.semanticData.get(expr.id);
    if (!semanticData || !isInfoLineSemanticData(semanticData)) return;

    if (this.processingContext === "tune_body") {
      // Inline info line in tune body - can change voice, key, meter, tempo, note length, clef
      if (isVoiceInfo(semanticData)) {
        applyVoice(this.state, semanticData.data);
      } else if (isKeyInfo(semanticData)) {
        const voice = getCurrentVoice(this.state);
        if (voice) {
          voice.currentKey = semanticData.data.keySignature;
          if (semanticData.data.clef) {
            voice.currentClef = semanticData.data.clef;
          }
        }
        // Also update tune defaults for future voices
        this.state.tuneDefaults.key = semanticData.data.keySignature;
        if (semanticData.data.clef) {
          this.state.tuneDefaults.clef = semanticData.data.clef;
        }
      } else if (isMeterInfo(semanticData)) {
        const voice = getCurrentVoice(this.state);
        if (voice) {
          voice.currentMeter = semanticData.data;
        }
        this.state.tuneDefaults.meter = semanticData.data;
      } else if (isNoteLengthInfo(semanticData)) {
        this.state.tuneDefaults.noteLength = semanticData.data;
      } else if (isTempoInfo(semanticData)) {
        this.state.tuneDefaults.tempo = semanticData.data;
      }
    } else {
      // Header info line - use the helper function
      const context: HeaderContext = {
        type: "tune_header",
        target: { tune: this.state.tune, tuneDefaults: this.state.tuneDefaults, parserConfig: this.state.parserConfig },
      };
      const warning = applyInfoLine(semanticData, context);
      if (warning) {
        this.ctx.errorReporter.interpreterError(warning, expr);
      }

      // Handle voice separately since it requires state manipulation
      if (isVoiceInfo(semanticData)) {
        applyVoice(this.state, semanticData.data);
      }
    }
  }

  visitDirectiveExpr(expr: Directive): void {
    const semanticData = this.state.semanticData.get(expr.id);
    if (semanticData) {
      if (this.processingContext === "file_header") {
        const context: HeaderContext = { type: "file_header", target: this.fileDefaults };
        const warning = applyDirective(semanticData, expr.key.lexeme, context);
        if (warning) {
          this.ctx.errorReporter.interpreterError(warning, expr);
        }
      } else {
        // Tune header or body
        const context: HeaderContext = {
          type: "tune_header",
          target: { tune: this.state.tune, tuneDefaults: this.state.tuneDefaults, parserConfig: this.state.parserConfig },
        };
        const warning = applyDirective(semanticData, expr.key.lexeme, context);
        if (warning) {
          this.ctx.errorReporter.interpreterError(warning, expr);
        }
      }
    }
  }

  visitMusicCodeExpr(expr: Music_code): void {
    // Visit each content element
    for (const content of expr.contents) {
      if (content instanceof Token) {
        // Handle slur tokens
        if (content.type === TT.SLUR) {
          const voiceState = this.state.voices.get(this.state.currentVoice);
          if (voiceState) {
            if (content.lexeme === "(") {
              // Start slur: generate a new label and add to pending
              const label = voiceState.nextSlurLabel++;
              voiceState.pendingStartSlurs.push(label);
            } else if (content.lexeme === ")") {
              // End slur: pop a label from start slurs and retroactively add to last note
              const elements = this.getCurrentVoiceElements();
              if (voiceState.pendingStartSlurs.length > 0 && elements.length > 0) {
                const label = voiceState.pendingStartSlurs.pop()!;
                const lastElement = elements[elements.length - 1];

                // Add endSlur to the last note's first pitch
                if ("pitches" in lastElement && lastElement.pitches && lastElement.pitches.length > 0) {
                  const pitch = lastElement.pitches[0];
                  if (!pitch.endSlur) {
                    pitch.endSlur = [];
                  }
                  pitch.endSlur.push(label);
                }
              }
            }
          }
        }
        continue;
      }
      content.accept(this);
    }
  }

  visitNoteExpr(expr: Note): void {
    const noteLetter = expr.pitch.noteLetter.lexeme;
    const accidental = expr.pitch.alteration?.lexeme;
    const octave = expr.pitch.octave?.lexeme;

    const basePitch = this.getBasePitch(noteLetter);
    const octaveOffset = octave ? this.getOctaveOffset(octave) : 0;
    const pitchNumber = basePitch + octaveOffset;

    // Get current voice state for clef and rhythm calculations
    const voiceState = this.state.voices.get(this.state.currentVoice);
    const clef = voiceState?.currentClef;

    const pitch: ABCJSPitch = {
      pitch: pitchNumber,
      name: (accidental || "") + noteLetter,
      verticalPos: this.calculateVerticalPos(pitchNumber, clef),
      accidental: accidental ? this.convertAccidental(accidental) : undefined,
    };

    // Calculate duration with broken rhythm handling
    const defaultLength = this.state.tuneDefaults.noteLength;
    const rhythmResult = calculateRhythm(expr.rhythm, defaultLength, voiceState);

    // Store next multiplier if present
    if (rhythmResult.nextMultiplier && voiceState) {
      voiceState.nextNoteDurationMultiplier = rhythmResult.nextMultiplier;
    }

    const range = this.rangeVisitor.visitNoteExpr(expr);

    // Convert rational to float for abcjs compatibility
    const duration = rationalToNumber(rhythmResult.duration);

    const startChar = this.toAbsolutePosition(range.start.line, range.start.character);
    const endChar = this.toAbsolutePosition(range.end.line, range.end.character);

    const element: NoteElement = {
      el_type: ElementType.Note,
      startChar,
      endChar,
      // FIXME: what the eff is this
      duration: duration as any, // abcjs uses float, not IRational
      pitches: [pitch],
    };

    this.pushElement(element);

    // Process beaming for this note (voiceState already retrieved above)
    if (voiceState) {
      // Process chord symbols (first, as they're typically written before everything)
      applyChordSymbols(element, voiceState);

      // Process grace notes (second, as they precede the note)
      applyGraceNotes(element, voiceState);

      // Process decorations (third, as they're typically written before the note)
      applyDecorations(element, voiceState);

      // Process tuplets (before beaming, as tuplets affect note grouping)
      applyTuplet(element, voiceState);

      processBeaming(element, voiceState, false); // false = not a rest

      // Process slurs
      if (element.pitches) {
        applyStartSlurs(element.pitches, voiceState);
      }

      // Process ties
      if (element.pitches) {
        // First, check if this note should end any pending ties
        processTieEnd(element.pitches, voiceState);

        // Then, check if this note starts a new tie
        if (expr.tie) {
          processTieStart(element.pitches, voiceState);
        }
      }
    }
  }

  visitRestExpr(expr: Rest): void {
    // Calculate duration with broken rhythm handling
    const voiceState = this.state.voices.get(this.state.currentVoice);
    const defaultLength = this.state.tuneDefaults.noteLength;

    // Calculate full duration (with broken rhythm from previous note)
    const rhythmResult = calculateRhythm(expr.rhythm, defaultLength, voiceState);

    // Store next multiplier if present
    if (rhythmResult.nextMultiplier && voiceState) {
      voiceState.nextNoteDurationMultiplier = rhythmResult.nextMultiplier;
    }

    const range = this.rangeVisitor.visitRestExpr(expr);

    // Convert rational to float for abcjs compatibility
    const duration = rationalToNumber(rhythmResult.duration);

    // Determine rest type from lexeme
    // Initial classification (abcjs compatible):
    // - 'x' → "invisible"
    // - 'y' → "spacer"
    // - 'Z' → "multimeasure"
    // - 'X' → "invisible-multimeasure"
    // - 'z' → "rest" (may be upgraded to "whole" below)
    const restLexeme = expr.rest.lexeme;
    let restType: RestType;
    if (restLexeme === "x") {
      restType = RestType.Invisible;
    } else if (restLexeme === "y") {
      restType = RestType.Spacer;
    } else if (restLexeme === "Z") {
      restType = RestType.Multimeasure;
    } else if (restLexeme === "X") {
      restType = RestType.InvisibleMultimeasure;
    } else if (restLexeme === "z") {
      restType = RestType.Rest; // Initial classification
    } else {
      restType = RestType.Rest; // Default
    }

    // Post-processing for 'z' rests (abcjs logic):
    // If rest has FINAL duration==1 (after broken rhythm) and measure duration <=1, upgrade to "whole"
    // This matches abcjs behavior from abc_parse_music.js line 550-554
    // Note: Uses final duration, not base duration!
    if (restLexeme === "z" && duration === 1.0) {
      const measureDuration = this.getMeasureDuration(voiceState);
      if (measureDuration <= 1.0) {
        restType = RestType.Whole;
      }
    }

    const element: NoteElement = {
      el_type: ElementType.Note,
      startChar: this.toAbsolutePosition(range.start.line, range.start.character),
      endChar: this.toAbsolutePosition(range.end.line, range.end.character),
      duration: duration as any,
      rest: { type: restType },
    };

    this.pushElement(element);

    // Process beaming for this rest (beams break on rests, voiceState already retrieved above)
    if (voiceState) {
      processBeaming(element, voiceState, true); // true = is a rest
    }
  }

  visitChordExpr(expr: Chord): void {
    const pitches: ABCJSPitch[] = [];

    // Get current voice state for clef
    const voiceState = this.state.voices.get(this.state.currentVoice);
    const clef = voiceState?.currentClef;

    for (const content of expr.contents) {
      if (content instanceof Note) {
        const noteLetter = content.pitch.noteLetter.lexeme;
        const accidental = content.pitch.alteration?.lexeme;
        const octave = content.pitch.octave?.lexeme;

        const basePitch = this.getBasePitch(noteLetter);
        const octaveOffset = octave ? this.getOctaveOffset(octave) : 0;
        const pitchNumber = basePitch + octaveOffset;

        pitches.push({
          pitch: pitchNumber,
          name: (accidental || "") + noteLetter,
          verticalPos: this.calculateVerticalPos(pitchNumber, clef),
          accidental: accidental ? this.convertAccidental(accidental) : undefined,
        });
      }
    }

    if (pitches.length === 0) return;

    // Calculate duration with broken rhythm handling
    const defaultLength = this.state.tuneDefaults.noteLength;
    const rhythmResult = calculateRhythm(expr.rhythm, defaultLength, voiceState);

    // Store next multiplier if present
    if (rhythmResult.nextMultiplier && voiceState) {
      voiceState.nextNoteDurationMultiplier = rhythmResult.nextMultiplier;
    }

    const range = this.rangeVisitor.visitChordExpr(expr);

    // Convert rational to float for abcjs compatibility
    const duration = rationalToNumber(rhythmResult.duration);

    const element: NoteElement = {
      el_type: ElementType.Note,
      startChar: this.toAbsolutePosition(range.start.line, range.start.character),
      endChar: this.toAbsolutePosition(range.end.line, range.end.character),
      duration: duration as any,
      pitches,
    };

    this.pushElement(element);

    // Process beaming for this chord (voiceState already retrieved above)
    // TODO: this is a lot of duplicated code, let's consolidate into a function.
    if (voiceState) {
      // Process chord symbols (first, as they're typically written before everything)
      applyChordSymbols(element, voiceState);

      // Process grace notes (second, as they precede the note)
      applyGraceNotes(element, voiceState);

      // Process decorations (third, as they're typically written before the note)
      applyDecorations(element, voiceState);

      // Process tuplets (before beaming, as tuplets affect note grouping)
      applyTuplet(element, voiceState);

      processBeaming(element, voiceState, false); // false = not a rest

      // Process slurs
      if (element.pitches) {
        applyStartSlurs(element.pitches, voiceState);
      }

      // Process ties
      if (element.pitches) {
        // First, check if any pitches should end pending ties
        processTieEnd(element.pitches, voiceState);

        // Then, check if this chord starts new ties
        if (expr.tie) {
          processTieStart(element.pitches, voiceState);
        }
      }
    }
  }

  visitBarLineExpr(expr: BarLine): void {
    const barString = expr.barline.map((t) => t.lexeme).join("");
    let barType: BarType;

    switch (barString) {
      case "|":
        barType = BarType.BarThin;
        break;
      case "||":
        barType = BarType.BarThinThin;
        break;
      case "|:":
        barType = BarType.BarLeftRepeat;
        break;
      case ":|":
        barType = BarType.BarRightRepeat;
        break;
      case "::":
        barType = BarType.BarDblRepeat;
        break;
      default:
        barType = BarType.BarThin;
    }

    const range = this.rangeVisitor.visitBarLineExpr(expr);

    const element: BarElement = {
      el_type: ElementType.Bar,
      startChar: this.toAbsolutePosition(range.start.line, range.start.character),
      endChar: this.toAbsolutePosition(range.end.line, range.end.character),
      type: barType,
    };

    this.pushElement(element);

    // Clear beams and broken rhythm at barlines
    const voiceState = this.state.voices.get(this.state.currentVoice);
    if (voiceState) {
      // Broken rhythm does not persist across barlines
      voiceState.nextNoteDurationMultiplier = undefined;
      endBeamGroup(voiceState);
    }

    nextMeasure(this.state);
  }

  visitRhythmExpr(expr: Rhythm): void {
    // This visitor method is not used - see calculateRhythm() helper function instead
  }

  // Placeholder implementations for other visitors
  visitPitchExpr(expr: Pitch): void {
    // Pitch is handled inline in visitNoteExpr
  }

  visitToken(token: Token): void {}
  visitAnnotationExpr(expr: Annotation): void {
    const voiceState = this.state.voices.get(this.state.currentVoice);
    if (!voiceState) return;

    // Annotation text is the chord symbol (e.g., "C", "Dm", "G7")
    // The lexeme includes the quotes, so we need to strip them
    let chordName = expr.text.lexeme;

    // Remove surrounding quotes if present
    if ((chordName.startsWith('"') && chordName.endsWith('"')) || (chordName.startsWith("'") && chordName.endsWith("'"))) {
      chordName = chordName.slice(1, -1);
    }

    // Create chord symbol object matching abcjs format
    const chordSymbol = {
      name: chordName,
      position: "default" as const, // abcjs uses 'default' as the position
    };

    // Store chord symbol to be applied to the next note
    voiceState.pendingChordSymbols.push(chordSymbol);
  }
  visitCommentExpr(expr: Comment): void {}

  visitDecorationExpr(expr: Decoration): void {
    // Decorations modify the next note, so add them to pending decorations
    const voiceState = this.state.voices.get(this.state.currentVoice);
    if (!voiceState) return;

    const lexeme = expr.decoration.lexeme;

    // Handle !decoration! or +decoration+ syntax
    if (lexeme.startsWith("!") || lexeme.startsWith("+")) {
      // Remove the delimiters
      // FIXME: need some type predicates here?
      let decoration = lexeme.slice(1, -1) as Decorations;

      // Handle leading ^ or _ (positioning hints that we ignore)
      if (decoration.startsWith("^") || decoration.startsWith("_")) {
        decoration = decoration.substring(1) as Decorations;
      }

      // Use the decoration name directly (already in abcjs format)
      if (decoration) {
        voiceState.pendingDecorations.push(decoration);
      }
    } else {
      // Handle single-character decorations
      const mappedDecoration = DECORATION_MAP[lexeme] as Decorations;
      if (mappedDecoration) {
        voiceState.pendingDecorations.push(mappedDecoration);
      }
    }
  }
  visitSystemBreakExpr(expr: SystemBreak): void {}
  visitGraceGroupExpr(expr: Grace_group): void {
    const voiceState = this.state.voices.get(this.state.currentVoice);
    if (!voiceState) return;

    // Get current clef for vertical position calculations
    const clef = voiceState.currentClef;

    // FIXME: why must this be untyped?
    const graceNotes: any[] = [];
    let isFirstNote = true;

    for (const item of expr.notes) {
      // Skip tokens (spaces, etc.)
      if (item instanceof Token) continue;

      const note = item as Note;
      const noteLetter = note.pitch.noteLetter.lexeme;
      const accidental = note.pitch.alteration?.lexeme;
      const octave = note.pitch.octave?.lexeme;

      const basePitch = this.getBasePitch(noteLetter);
      const octaveOffset = octave ? this.getOctaveOffset(octave) : 0;
      const pitchNumber = basePitch + octaveOffset;

      // FIXME: why must this be untyped?
      const graceNote: any = {
        pitch: pitchNumber,
        name: (accidental || "") + noteLetter,
        duration: 0.125, // Grace notes are typically 1/8th notes in abcjs
        verticalPos: this.calculateVerticalPos(pitchNumber, clef),
      };

      // Add accidental if present
      if (accidental) {
        graceNote.accidental = this.convertAccidental(accidental);
      }

      // Mark first note as acciaccatura if the grace group has the slash
      if (isFirstNote && expr.isAccacciatura) {
        graceNote.acciaccatura = true;
      }

      graceNotes.push(graceNote);
      isFirstNote = false;
    }

    // Store grace notes to be applied to the next note
    voiceState.pendingGraceNotes = graceNotes;
  }

  // TODO: create a helper that can be shared with the info lines?
  visitInlineFieldExpr(expr: Inline_field): void {
    // Inline fields are analyzed by SemanticAnalyzer and reuse Info_line analysis logic
    const semanticData = this.state.semanticData.get(expr.id);
    if (!semanticData || !isInfoLineSemanticData(semanticData)) return;

    // Get character range for the inline field
    const startChar = expr.field.position;
    const lastToken = expr.text[expr.text.length - 1];
    const endChar = lastToken ? lastToken.position + lastToken.lexeme.length : expr.field.position + expr.field.lexeme.length;

    // Inline fields are always in tune_body context (they can only appear in music lines)
    // Handle the same way as Info_line in tune_body context
    if (isVoiceInfo(semanticData)) {
      applyVoice(this.state, semanticData.data);
    } else if (isKeyInfo(semanticData)) {
      const voice = getCurrentVoice(this.state);
      if (voice) {
        voice.currentKey = semanticData.data.keySignature;
        if (semanticData.data.clef) {
          voice.currentClef = semanticData.data.clef;
        }
      }
      // Also update tune defaults for future voices
      this.state.tuneDefaults.key = semanticData.data.keySignature;
      if (semanticData.data.clef) {
        this.state.tuneDefaults.clef = semanticData.data.clef;
      }

      // Create a key element in the voice for rendering
      const keyElement: KeyElement = {
        el_type: ElementType.Key,
        startChar,
        endChar,
        root: semanticData.data.keySignature.root,
        acc: semanticData.data.keySignature.acc,
        mode: semanticData.data.keySignature.mode,
        accidentals: semanticData.data.keySignature.accidentals,
      };
      this.pushElement(keyElement);
    } else if (isMeterInfo(semanticData)) {
      const voice = getCurrentVoice(this.state);
      if (voice) {
        voice.currentMeter = semanticData.data;
      }
      this.state.tuneDefaults.meter = semanticData.data;

      // Create a meter element in the voice for rendering
      const meterElement: MeterElement = {
        el_type: ElementType.Meter,
        startChar,
        endChar,
        type: semanticData.data.type,
        value: semanticData.data.value,
      };
      this.pushElement(meterElement);
    } else if (isNoteLengthInfo(semanticData)) {
      this.state.tuneDefaults.noteLength = semanticData.data;
    } else if (isTempoInfo(semanticData)) {
      this.state.tuneDefaults.tempo = semanticData.data;
    }
  }

  visitLyricLineExpr(expr: Lyric_line): void {
    // Lyrics come after a music line and need to be mapped to the notes
    // Parse lyric tokens into syllables with dividers
    const lyrics: LyricProperties[] = [];

    for (const token of expr.contents) {
      const lexeme = token.lexeme;

      // Skip spaces and empty tokens
      if (!lexeme || lexeme.trim() === "") continue;

      // Check for dividers: hyphen (-), underscore (_), or space
      if (lexeme === "-") {
        // Hyphen divider: if we have a previous syllable, update its divider
        if (lyrics.length > 0) {
          lyrics[lyrics.length - 1].divider = LyricDivider.Hyphen;
        }
      } else if (lexeme === "_") {
        // Underscore divider: extends previous syllable
        if (lyrics.length > 0) {
          lyrics[lyrics.length - 1].divider = LyricDivider.Underscore;
        }
      } else if (lexeme === "~" || lexeme === "\\-") {
        // Tilde or escaped hyphen: these are special cases in ABC
        // For now, treat as space
        continue;
      } else {
        // Regular syllable
        lyrics.push({
          syllable: lexeme,
          divider: LyricDivider.Space, // Default divider is space
        });
      }
    }

    // Apply lyrics to notes in the current voice
    // Go through the current voice elements to find notes
    const elements = this.getCurrentVoiceElements();
    const notesWithPitches = elements.filter((el) => "pitches" in el && el.pitches && el.pitches.length > 0) as NoteElement[];

    // Map lyrics to notes (one lyric per note)
    for (let i = 0; i < Math.min(lyrics.length, notesWithPitches.length); i++) {
      const note = notesWithPitches[i];
      if (!note.lyric) {
        note.lyric = [];
      }
      note.lyric.push(lyrics[i]);
    }
  }
  visitLyricSectionExpr(expr: Lyric_section): void {}
  visitMacroDeclExpr(expr: Macro_decl): void {}
  visitMacroInvocationExpr(expr: Macro_invocation): void {}
  visitMultiMeasureRestExpr(expr: MultiMeasureRest): void {
    const range = this.rangeVisitor.visitMultiMeasureRestExpr(expr);

    // Determine rest type from lexeme
    const restLexeme = expr.rest.lexeme;
    let restType: RestType;
    if (restLexeme === "X") {
      restType = RestType.InvisibleMultimeasure;
    } else if (restLexeme === "Z") {
      restType = RestType.Multimeasure;
    } else {
      restType = RestType.Multimeasure; // Default for multi-measure
    }

    // Get the length if specified (e.g., Z4)
    const length = expr.length ? parseInt(expr.length.lexeme) : 1;

    const element: NoteElement = {
      el_type: ElementType.Note,
      startChar: this.toAbsolutePosition(range.start.line, range.start.character),
      endChar: this.toAbsolutePosition(range.end.line, range.end.character),
      duration: ((length * this.state.tuneDefaults.noteLength.numerator) / this.state.tuneDefaults.noteLength.denominator) as any,
      rest: { type: restType },
    };

    this.pushElement(element);
  }
  visitSymbolExpr(expr: Symbol): void {}
  visitUserSymbolDeclExpr(expr: User_symbol_decl): void {}
  visitUserSymbolInvocationExpr(expr: User_symbol_invocation): void {}
  visitYSpacerExpr(expr: YSPACER): void {}
  visitBeamExpr(expr: Beam): void {
    // User explicitly grouped these notes with beam syntax
    // We need to:
    // 1. Visit each note to create NoteElements
    // 2. Apply beaming rules to validate and potentially split the group
    // 3. Set startBeam/endBeam on valid beam groups

    // The beaming will be handled automatically by processBeaming()
    // as we visit each note/chord/rest within the beam
    for (const content of expr.contents) {
      if (content instanceof Token) {
        continue;
      }
      content.accept(this);
    }

    // After visiting all notes in the beam, check if we need to end the current beam group
    // (in case the user's beam ends but we have a valid beam group running)
    const voiceState = this.state.voices.get(this.state.currentVoice);
    if (voiceState) {
      // End any pending beam at the end of the user's beam group
      endBeamGroup(voiceState);
    }
  }
  visitVoiceOverlayExpr(expr: Voice_overlay): void {}
  visitLineContinuationExpr(_expr: Line_continuation): void {}

  visitTupletExpr(expr: Tuplet): void {
    // Parse tuplet notation: (p:q:r or (p:q or (p
    // p = number of notes
    // q = time they fit into (defaults to TUPLET_Q[p])
    // r = how many notes to apply tuplet to (defaults to p)

    const voiceState = this.state.voices.get(this.state.currentVoice);
    if (!voiceState) return;

    const p = parseInt(expr.p.lexeme, 10);
    const q = expr.q ? parseInt(expr.q.lexeme, 10) : TUPLET_Q[p] || 2;
    const r = expr.r ? parseInt(expr.r.lexeme, 10) : p;

    // Set tuplet state for the next r notes
    voiceState.tupletP = p;
    voiceState.tupletQ = q;
    voiceState.tupletR = r;
    voiceState.tupletNotesLeft = r;
  }
  visitErrorExpr(expr: ErrorExpr): void {}
  visitKV(expr: KV): void {}
  visitBinary(expr: Binary): void {}
  visitGrouping(expr: Grouping): void {}
  visitAbsolutePitch(expr: AbsolutePitch): void {}
  visitRationalExpr(expr: Rational): void {}
  visitMeasurementExpr(expr: Measurement): void {}
  visitUnary(expr: import("../types/Expr2").Unary): void {}

  // ============================================================================
  // Helper Methods
  // ============================================================================

  getBasePitch(noteLetter: string): number {
    // abcjs uses diatonic pitch numbering (staff positions), not chromatic
    // C=0, D=1, E=2, F=3, G=4, A=5, B=6
    // Lowercase letters are one octave higher: c=7, d=8, etc.
    const upperPitches: { [key: string]: number } = {
      C: 0,
      D: 1,
      E: 2,
      F: 3,
      G: 4,
      A: 5,
      B: 6,
    };

    const letter = noteLetter.toUpperCase();
    const basePitch = upperPitches[letter] || 0;

    // If lowercase, add 7 (one octave in diatonic system)
    return noteLetter === noteLetter.toLowerCase() ? basePitch + 7 : basePitch;
  }

  getOctaveOffset(octave: string): number {
    // Octave markers shift by 7 (diatonic octave), not 12 (chromatic)
    if (octave.includes(",")) {
      return -7 * octave.length;
    } else if (octave.includes("'")) {
      return 7 * octave.length;
    }
    return 0;
  }

  convertAccidental(accidental: string): AccidentalType {
    switch (accidental) {
      case "^":
        return AccidentalType.Sharp;
      case "_":
        return AccidentalType.Flat;
      case "=":
        return AccidentalType.Natural;
      case "^^":
        return AccidentalType.DblSharp;
      case "__":
        return AccidentalType.DblFlat;
      default:
        return AccidentalType.Natural;
    }
  }

  /**
   * Calculate vertical position on staff based on pitch and clef
   * The pitch number represents the absolute musical pitch (invariant to clef)
   * The verticalPos represents the position on the staff (varies with clef)
   *
   * Formula: verticalPos = pitch - clef.verticalPos
   *
   * Example for note 'a' (pitch=12):
   * - Treble clef (verticalPos=0): verticalPos = 12 - 0 = 12
   * - Bass clef (verticalPos=-12): verticalPos = 12 - (-12) = 24
   */
  calculateVerticalPos(pitch: number, clef?: ClefProperties): number {
    if (!clef || clef.verticalPos === undefined) {
      return pitch; // Default: no adjustment
    }
    return pitch - clef.verticalPos;
  }

  /**
   * Get the duration of a full measure based on the current meter
   * For example, M:2/1 means a measure contains 2 whole notes, so duration = 2.0
   * M:4/4 means a measure contains 4 quarter notes = 1 whole note, so duration = 1.0
   * Default is 4/4 = 1.0
   */
  getMeasureDuration(voiceState?: VoiceState): number {
    const meter = voiceState?.currentMeter || this.state.tuneDefaults.meter;

    if (!meter || !meter.value || meter.value.length === 0) {
      return 1.0; // Default: 4/4 = 1 whole note
    }

    // Sum all the fractions in the meter
    let total = 0;
    for (const fraction of meter.value) {
      total += rationalToNumber(fraction);
    }

    return total;
  }

  finalizeTune(): void {
    // Use the tracked staff count from the multi-staff system
    this.state.tune.staffNum = this.state.staves.length;
    this.state.tune.voiceNum = this.state.voices.size;
    this.state.tune.lineNum = this.state.tune.systems.length;
    // Note: metaText and formatting were already initialized from fileDefaults in visitTuneExpr
  }

  /**
   * Legacy method - kept for backward compatibility but no longer used.
   * Staff count is now tracked in state.staves.
   */
  countStaffs(): number {
    let max = 0;
    for (const line of this.state.tune.systems) {
      if ("staff" in line) {
        max = Math.max(max, line.staff.length);
      }
    }
    return max;
  }
}
