/**
 * ContextInterpreter
 *
 * A visitor-based interpreter that traverses the ABC AST to gather musical context snapshots.
 * Transforms can query these snapshots to determine the meter, key, clef, tempo, and other
 * context at any position.
 *
 * Design:
 * - Snapshots are stored per-tune, then per-voice: `Map<number, Map<string, Array<{pos, snapshot}>>>`
 * - The outer map is keyed by Tune.id (the AST node id), which is guaranteed unique
 * - Position encoding: `pos = line * 1_000_000 + char`
 * - O(log n) binary search for floor queries
 * - Per-voice context isolation (voice 1's key doesn't affect voice 2)
 * - Reuses semantic analyzer output rather than re-parsing directives
 */

import {
  TuneDefaults,
  VoiceState,
  newVxState,
  createTuneDefaults,
  createFileDefaults,
  getDefaultKeySignature,
  getDefaultClef,
} from "./InterpreterState";
import { Meter, KeySignature, ClefProperties, TempoProperties, MeterType } from "../types/abcjs-ast";
import { SemanticData } from "../analyzers/semantic-analyzer";
import { IRational, createRational } from "../Visitors/fmt2/rational";
import { ABCContext } from "../parsers/Context";
import { RangeVisitor } from "../Visitors/RangeVisitor";
import { Range } from "../types/types";
import { Token } from "../parsers/scan2";
import { InfoLineUnion } from "../types/Expr2";
import {
  Visitor,
  File_structure,
  File_header,
  Tune,
  Tune_header,
  Tune_Body,
  Info_line,
  Inline_field,
  BarLine,
  Music_code,
  Note,
  Rest,
  Chord,
  Beam,
  Tuplet,
  Grace_group,
  Decoration,
  Annotation,
  Comment,
  SystemBreak,
  Symbol,
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
  Unary,
  Directive,
  MultiMeasureRest,
  YSPACER,
  ChordSymbol,
  Expr,
} from "../types/Expr2";

// ============================================================================
// Type Guards
// ============================================================================

/**
 * The set of info line types that affect musical context.
 * These are the only SemanticData types that the ContextInterpreter processes.
 */
const CONTEXT_INFO_TYPES = new Set(["key", "meter", "voice", "tempo", "note_length"]);

/**
 * Type guard to check if the semantic data is an InfoLineUnion that affects context.
 * Because SemanticData is a union of DirectiveSemanticData and InfoLineUnion,
 * we need to filter to only the types that we handle.
 */
function isContextInfoLineData(sem: SemanticData): sem is InfoLineUnion {
  return CONTEXT_INFO_TYPES.has(sem.type);
}

/**
 * Default meter to use when no meter has been specified.
 */
const DEFAULT_METER: Meter = { type: MeterType.CommonTime };

/**
 * Default tempo to use when no tempo has been specified.
 */
const DEFAULT_TEMPO: TempoProperties = { bpm: 120 };

// ============================================================================
// Data Structures
// ============================================================================

/**
 * Stores the full resolved musical context at a directive position.
 * All fields are the effective values at that point.
 */
export interface ContextSnapshot {
  /** Encoded position (line * 1_000_000 + char) for binary search */
  pos: number;
  /** Original line number (0-indexed) */
  line: number;
  /** Original character position (0-indexed) */
  char: number;
  /** The meter in effect at this position */
  meter: Meter;
  /** The note length in effect at this position */
  noteLength: IRational;
  /** The tempo in effect at this position */
  tempo: TempoProperties;
  /** The key signature in effect at this position */
  key: KeySignature;
  /** The clef in effect at this position */
  clef: ClefProperties;
  /** The voice ID at this position */
  voiceId: string;
  /**
   * The measure number at this snapshot position.
   *
   * LIMITATION: This value is only accurate for deferred-style tunes.
   * For linear-style tunes, omitted voices are considered to be implicitly
   * resting while other voices play, which means their measure count should
   * be incremented by the maximum bar count across all voices in each system.
   * The current implementation does not handle this case.
   *
   * See the "Addendum: Linear-Style Measure Counting" section in
   * context-gathering-design.md for details.
   */
  measureNumber: number;
  /** The transpose value in effect at this position */
  transpose: number;
  /** The octave shift in effect at this position */
  octave: number;
}

/**
 * Type alias for the per-voice snapshot map for a single tune.
 * Maps voice ID to an array of position-snapshot pairs, sorted by position.
 */
export type TuneSnapshots = Map<string, Array<{ pos: number; snapshot: ContextSnapshot }>>;

/**
 * The return type of the interpret method.
 * Maps Tune.id (AST node id) to that tune's per-voice snapshots.
 */
export type InterpreterResult = Map<number, TuneSnapshots>;

/**
 * The main interpreter state that accumulates snapshots during traversal.
 */
export interface ContextInterpreterState {
  ctx: ABCContext;
  semanticData: Map<number, SemanticData>;
  tuneDefaults: TuneDefaults;
  voices: Map<string, VoiceState>;
  /** The current voice ID. Default: "" (empty string) for content before any voice declaration */
  currentVoiceId: string;
  measureNumber: number;
  /** Accumulates snapshots for current tune, keyed by voice ID */
  snapshotsByVoice: TuneSnapshots;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Encodes a (line, char) position into a single integer for binary search.
 * Preserves lexicographic ordering: if position A comes before position B
 * in the document, then `encode(A) < encode(B)`.
 *
 * The multiplier of 1,000,000 assumes no line exceeds one million characters,
 * which is safe for any reasonable source file.
 */
export function encode(line: number, char: number): number {
  return line * 1_000_000 + char;
}

/**
 * Finds the largest index i where `snapshots[i].pos <= target`.
 * Returns -1 if no such index exists (i.e., all positions are greater than target).
 *
 * Uses binary search for O(log n) complexity.
 */
export function binarySearchFloor(snapshots: Array<{ pos: number }>, target: number): number {
  let lo = 0;
  let hi = snapshots.length - 1;
  let result = -1;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (snapshots[mid].pos <= target) {
      result = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return result;
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Queries the context snapshot at a given position for a specific voice.
 * Returns the most recent snapshot at or before `pos`, or null if none exists.
 *
 * @param tuneSnapshots The per-voice snapshots for a tune
 * @param pos The encoded position to query
 * @param voiceId The voice ID to query
 * @returns The snapshot at or before the position, or null if none exists
 */
export function getSnapshot(tuneSnapshots: TuneSnapshots, pos: number, voiceId: string): ContextSnapshot | null {
  const snapshots = tuneSnapshots.get(voiceId);
  if (!snapshots || snapshots.length === 0) {
    return null;
  }

  const index = binarySearchFloor(snapshots, pos);
  if (index < 0) {
    return null;
  }

  return snapshots[index].snapshot;
}

/**
 * Returns all snapshots within a given range for a specific voice.
 *
 * @param tuneSnapshots The per-voice snapshots for a tune
 * @param range The range to query
 * @param voiceId The voice ID to query
 * @returns An array of position-snapshot pairs within the range
 */
export function getRangeSnapshots(
  tuneSnapshots: TuneSnapshots,
  range: Range,
  voiceId: string
): Array<{ pos: number; snapshot: ContextSnapshot }> {
  const snapshots = tuneSnapshots.get(voiceId);
  if (!snapshots || snapshots.length === 0) {
    return [];
  }

  const startPos = encode(range.start.line, range.start.character);
  const endPos = encode(range.end.line, range.end.character);

  let baseIndex = binarySearchFloor(snapshots, startPos);
  if (baseIndex < 0) {
    baseIndex = 0;
  }

  let endIndex = baseIndex;
  while (endIndex < snapshots.length && snapshots[endIndex].pos <= endPos) {
    endIndex++;
  }

  return snapshots.slice(baseIndex, endIndex);
}

// ============================================================================
// ContextInterpreter Class
// ============================================================================

/**
 * The ContextInterpreter traverses the ABC AST and gathers context snapshots
 * at positions where musical context changes (M:, K:, L:, Q:, V: directives).
 */
export class ContextInterpreter implements Visitor<void> {
  state!: ContextInterpreterState;
  ctx!: ABCContext;
  semanticData!: Map<number, SemanticData>;
  rangeVisitor!: RangeVisitor;
  result!: InterpreterResult;

  /**
   * Entry point for interpreting an ABC file structure.
   * Returns a map from Tune.id to that tune's per-voice snapshots.
   */
  interpret(ast: File_structure, semanticData: Map<number, SemanticData>, ctx: ABCContext): InterpreterResult {
    this.ctx = ctx;
    this.semanticData = semanticData;
    this.rangeVisitor = new RangeVisitor();
    this.result = new Map();

    ast.accept(this);
    return this.result;
  }

  /**
   * Initializes state for a new tune, including pre-populating voice snapshot arrays.
   * Uses a Set to ensure the default voice is always included without duplicates.
   */
  initTuneState(voiceIds: string[]): void {
    this.state = {
      ctx: this.ctx,
      semanticData: this.semanticData,
      tuneDefaults: createTuneDefaults(createFileDefaults()),
      voices: new Map(),
      currentVoiceId: "", // Default voice is empty string
      measureNumber: 1,
      snapshotsByVoice: new Map(),
    };

    // Initialize empty snapshot arrays for all known voices (including default)
    const allVoiceIds = new Set(["", ...voiceIds]);
    for (const voiceId of allVoiceIds) {
      this.state.snapshotsByVoice.set(voiceId, []);
    }
  }

  /**
   * Gets the current voice state, creating it if it doesn't exist.
   */
  getCurrentVoice(): VoiceState {
    const voiceId = this.state.currentVoiceId;
    let voice = this.state.voices.get(voiceId);
    if (!voice) {
      voice = newVxState(voiceId, {}, this.state.tuneDefaults);
      this.state.voices.set(voiceId, voice);
    }
    return voice;
  }

  /**
   * Extracts the position from an expression using RangeVisitor.
   */
  getPosition(expr: Expr): { line: number; char: number } {
    const range = expr.accept(this.rangeVisitor);
    if (range && range.start && range.start.line !== undefined) {
      return { line: range.start.line, char: range.start.character };
    }
    // Fallback: return (0, 0) if range not found
    return { line: 0, char: 0 };
  }

  /**
   * Creates and stores a snapshot at the current position for the current voice.
   */
  pushSnapshot(expr: Expr): void {
    const { line, char } = this.getPosition(expr);
    const voice = this.getCurrentVoice();
    const voiceId = voice.id;
    const pos = encode(line, char);

    // Ensure snapshot array exists (may have been created dynamically)
    if (!this.state.snapshotsByVoice.has(voiceId)) {
      this.state.snapshotsByVoice.set(voiceId, []);
    }

    const snapshot: ContextSnapshot = {
      pos,
      line,
      char,
      meter: voice.currentMeter ?? this.state.tuneDefaults.meter ?? DEFAULT_METER,
      noteLength: this.state.tuneDefaults.noteLength,
      tempo: this.state.tuneDefaults.tempo ?? DEFAULT_TEMPO,
      key: voice.currentKey,
      clef: voice.currentClef,
      voiceId,
      measureNumber: this.state.measureNumber,
      transpose: voice.properties.transpose ?? 0,
      octave: voice.properties.octave ?? 0,
    };

    this.state.snapshotsByVoice.get(voiceId)!.push({ pos, snapshot });
  }

  // ============================================================================
  // Active Visitor Methods
  // ============================================================================

  visitFileStructureExpr(expr: File_structure): void {
    for (const item of expr.contents) {
      if (item instanceof Tune) {
        item.accept(this);
      }
    }
  }

  visitTuneExpr(expr: Tune): void {
    // Get voice IDs from tune body
    const voiceIds = expr.tune_body?.voices ?? [];

    // Initialize state for this tune
    this.initTuneState(voiceIds);

    // Traverse header and body
    expr.tune_header.accept(this);
    if (expr.tune_body) {
      expr.tune_body.accept(this);
    }

    // Store results keyed by Tune.id (guaranteed unique)
    this.result.set(expr.id, this.state.snapshotsByVoice);
  }

  visitTuneHeaderExpr(expr: Tune_header): void {
    for (const line of expr.info_lines) {
      if (line instanceof Info_line) {
        line.accept(this);
      }
    }
  }

  visitTuneBodyExpr(expr: Tune_Body): void {
    for (const system of expr.sequence) {
      for (const element of system) {
        if (element instanceof Token) {
          continue;
        }
        element.accept(this);
      }
    }
  }

  visitMusicCodeExpr(expr: Music_code): void {
    for (const content of expr.contents) {
      if (content instanceof Token) {
        continue;
      }
      content.accept(this);
    }
  }

  /**
   * Handles context-changing directives (M:, K:, L:, Q:, V:) from both info lines
   * and inline fields. Updates the voice state and tune defaults accordingly.
   *
   * @param expr The expression containing the directive
   * @param sem The semantic data for the directive (must be an InfoLineUnion)
   * @returns true if the context was changed and a snapshot should be created
   */
  handleContextDirective(expr: Expr, sem: InfoLineUnion): boolean {
    const voice = this.getCurrentVoice();

    if (sem.type === "key") {
      voice.currentKey = sem.data.keySignature;
      if (sem.data.clef) {
        voice.currentClef = sem.data.clef;
      }
      this.state.tuneDefaults.key = sem.data.keySignature;
      if (sem.data.clef) {
        this.state.tuneDefaults.clef = sem.data.clef;
      }
      return true;
    } else if (sem.type === "meter") {
      voice.currentMeter = sem.data;
      this.state.tuneDefaults.meter = sem.data;
      return true;
    } else if (sem.type === "note_length") {
      this.state.tuneDefaults.noteLength = sem.data;
      return true;
    } else if (sem.type === "tempo") {
      this.state.tuneDefaults.tempo = sem.data;
      return true;
    } else if (sem.type === "voice") {
      const voiceId = sem.data.id;
      this.state.currentVoiceId = voiceId;
      // Ensure snapshot array exists for dynamically discovered voices
      if (!this.state.snapshotsByVoice.has(voiceId)) {
        this.state.snapshotsByVoice.set(voiceId, []);
      }
      return true;
    }

    return false;
  }

  visitInfoLineExpr(expr: Info_line): void {
    const sem = this.semanticData.get(expr.id);
    if (!sem || !isContextInfoLineData(sem)) return;

    if (this.handleContextDirective(expr, sem)) {
      this.pushSnapshot(expr);
    }
  }

  visitInlineFieldExpr(expr: Inline_field): void {
    const sem = this.semanticData.get(expr.id);
    if (!sem || !isContextInfoLineData(sem)) return;

    if (this.handleContextDirective(expr, sem)) {
      this.pushSnapshot(expr);
    }
  }

  visitBarLineExpr(expr: BarLine): void {
    this.state.measureNumber++;
  }

  // ============================================================================
  // No-op Stubs (required by Visitor<void> interface)
  // ============================================================================

  visitToken(token: Token): void {}
  visitNoteExpr(expr: Note): void {}
  visitRestExpr(expr: Rest): void {}
  visitChordExpr(expr: Chord): void {}
  visitBeamExpr(expr: Beam): void {}
  visitTupletExpr(expr: Tuplet): void {}
  visitGraceGroupExpr(expr: Grace_group): void {}
  visitDecorationExpr(expr: Decoration): void {}
  visitAnnotationExpr(expr: Annotation): void {}
  visitCommentExpr(expr: Comment): void {}
  visitSystemBreakExpr(expr: SystemBreak): void {}
  visitSymbolExpr(expr: Symbol): void {}
  visitVoiceOverlayExpr(expr: Voice_overlay): void {}
  visitLineContinuationExpr(expr: Line_continuation): void {}
  visitMacroDeclExpr(expr: Macro_decl): void {}
  visitMacroInvocationExpr(expr: Macro_invocation): void {}
  visitUserSymbolDeclExpr(expr: User_symbol_decl): void {}
  visitUserSymbolInvocationExpr(expr: User_symbol_invocation): void {}
  visitLyricLineExpr(expr: Lyric_line): void {}
  visitLyricSectionExpr(expr: Lyric_section): void {}
  visitPitchExpr(expr: Pitch): void {}
  visitRhythmExpr(expr: Rhythm): void {}
  visitErrorExpr(expr: ErrorExpr): void {}
  visitKV(expr: KV): void {}
  visitBinary(expr: Binary): void {}
  visitGrouping(expr: Grouping): void {}
  visitAbsolutePitch(expr: AbsolutePitch): void {}
  visitRationalExpr(expr: Rational): void {}
  visitMeasurementExpr(expr: Measurement): void {}
  visitUnary(expr: Unary): void {}
  visitDirectiveExpr(expr: Directive): void {}
  visitMultiMeasureRestExpr(expr: MultiMeasureRest): void {}
  visitYSpacerExpr(expr: YSPACER): void {}
  visitChordSymbolExpr(expr: ChordSymbol): void {}
  visitFileHeaderExpr(expr: File_header): void {}
}
