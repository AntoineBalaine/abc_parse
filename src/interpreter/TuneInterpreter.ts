/**
 * Tune Interpreter
 *
 * Main interpreter that converts ABC AST into ABCJS Tune format.
 * Uses semantic data pre-computed by the analyzer and builds incrementally
 * following the ABCJS builder pattern.
 */

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
  Symbol,
  Beam,
  Tuplet,
  Annotation,
  Inline_field,
  MultiMeasureRest,
  YSPACER,
  Voice_overlay,
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
} from "../types/Expr2";
import { Token } from "../parsers/scan2";
import { SemanticAnalyzer } from "../analyzers/semantic-analyzer";
import {
  Tune,
  MusicLine,
  Staff,
  VoiceElement,
  NoteElement,
  BarElement,
  ElementType,
  RestType,
  BarType,
  Pitch as ABCJSPitch,
  AccidentalType,
} from "../types/abcjs-ast";
import {
  InterpreterState,
  FileDefaults,
  createFileDefaults,
  createInterpreterState,
  getCurrentVoice,
  setCurrentVoice,
  addVoice,
  nextMeasure,
  TuneDefaults,
} from "./InterpreterState";
import { SemanticData } from "../analyzers/semantic-analyzer";
import { InfoLineUnion } from "../types/Expr2";
import { RangeVisitor } from "../Visitors/RangeVisitor";
import { ABCContext } from "../parsers/Context";

// ============================================================================
// Type Guards for SemanticData
// ============================================================================

function isInfoLineSemanticData(data: SemanticData): data is InfoLineUnion {
  const infoTypes = ["key", "meter", "voice", "tempo", "title", "composer", "origin", "note_length", "clef"];
  return infoTypes.includes(data.type);
}

// ============================================================================
// Helper Functions for Processing Semantic Data
// ============================================================================

type HeaderContext = { type: "file_header"; target: FileDefaults } | { type: "tune_header"; target: { tune: Tune; tuneDefaults: TuneDefaults } };

/**
 * Process info line semantic data and assign to appropriate target
 * @returns Warning message if info line is not valid in this context
 */
function processInfoLineSemanticData(semanticData: InfoLineUnion, context: HeaderContext): string | null {
  // Process properties that work in both file and tune headers
  const metaText = context.type === "file_header" ? context.target.metaText : context.target.tune.metaText;

  if (isTitleInfo(semanticData)) {
    metaText.title = semanticData.data;
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
 */
function processDirectiveSemanticData(semanticData: SemanticData, directiveName: string, context: HeaderContext): void {
  const metaText = context.type === "file_header" ? context.target.metaText : context.target.tune.metaText;
  const formatting = context.type === "file_header" ? context.target.formatting : context.target.tune.formatting;

  // Handle abc-version specially
  if (semanticData.type === "abc-version") {
    if (context.type === "file_header") {
      context.target.version = semanticData.data;
    } else {
      context.target.tune.version = semanticData.data;
    }
  }

  // Handle abc-* metaText directives
  if (semanticData.type === "abc-copyright") {
    metaText["abc-copyright"] = semanticData.data;
  } else if (semanticData.type === "abc-creator") {
    metaText["abc-creator"] = semanticData.data;
  } else if (semanticData.type === "abc-edited-by") {
    metaText["abc-edited-by"] = semanticData.data;
  }

  // Store all directives in formatting
  formatting[directiveName] = semanticData;
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

  // Working state for body processing
  currentVoiceElements: VoiceElement[] = [];

  constructor(analyzer: SemanticAnalyzer, ctx: ABCContext) {
    this.analyzer = analyzer;
    this.ctx = ctx;
    this.rangeVisitor = new RangeVisitor();
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
    // Extract file-level info and directives from semantic data
    const context: HeaderContext = { type: "file_header", target: this.fileDefaults };

    for (const item of expr.contents) {
      if (item instanceof Info_line) {
        const semanticData = this.analyzer.data.get(item.id);
        if (semanticData && isInfoLineSemanticData(semanticData)) {
          const warning = processInfoLineSemanticData(semanticData, context);
          if (warning) {
            this.ctx.errorReporter.interpreterError(warning, item);
          }
        }
      } else if (item instanceof Directive) {
        const semanticData = this.analyzer.data.get(item.id);
        if (semanticData) {
          processDirectiveSemanticData(semanticData, item.key.lexeme, context);
        }
      }
    }
  }

  visitTuneExpr(expr: TuneExpr): void {
    // Create fresh state for this tune
    this.state = createInterpreterState(this.analyzer.data, this.fileDefaults);

    // Visit tune header
    expr.tune_header.accept(this);

    // Ensure at least one voice exists
    if (this.state.voices.size === 0) {
      addVoice(this.state, "default", {});
      setCurrentVoice(this.state, "default");
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
    // Process each system (line of music)
    for (const system of expr.sequence) {
      this.currentVoiceElements = [];

      // Visit each element in the system
      for (const element of system) {
        if (element instanceof Token) {
          continue; // Skip plain tokens
        }
        element.accept(this);
      }

      // Create music line if we have elements
      if (this.currentVoiceElements.length > 0) {
        this.createMusicLine();
      }
    }
  }

  visitInfoLineExpr(expr: Info_line): void {
    const semanticData = this.state.semanticData.get(expr.id);
    if (!semanticData || !isInfoLineSemanticData(semanticData)) return;

    // Check if we're in tune body (has currentVoiceElements array)
    const isInBody = Array.isArray(this.currentVoiceElements);

    if (isInBody) {
      // Inline info line - handle voice switches and key changes
      if (isVoiceInfo(semanticData)) {
        const { id } = semanticData.data;
        setCurrentVoice(this.state, id);
        this.state.currentLine++;
      } else if (isKeyInfo(semanticData)) {
        const voice = getCurrentVoice(this.state);
        if (voice) {
          voice.currentKey = semanticData.data.keySignature;
        }
      }
    } else {
      // Header info line - set tune defaults and metaText
      if (isKeyInfo(semanticData)) {
        this.state.tuneDefaults.key = semanticData.data.keySignature;
        if (semanticData.data.clef) {
          this.state.tuneDefaults.clef = semanticData.data.clef;
        }
      } else if (isMeterInfo(semanticData)) {
        this.state.tuneDefaults.meter = semanticData.data;
      } else if (isNoteLengthInfo(semanticData)) {
        this.state.tuneDefaults.noteLength = semanticData.data;
      } else if (isTempoInfo(semanticData)) {
        this.state.tuneDefaults.tempo = semanticData.data;
        this.state.tune.metaText.tempo = semanticData.data;
      } else if (isTitleInfo(semanticData)) {
        this.state.tune.metaText.title = semanticData.data;
      } else if (isComposerInfo(semanticData)) {
        this.state.tune.metaText.composer = semanticData.data;
      } else if (isOriginInfo(semanticData)) {
        this.state.tune.metaText.origin = semanticData.data;
      } else if (isVoiceInfo(semanticData)) {
        const { id, properties } = semanticData.data;
        addVoice(this.state, id, properties);
        setCurrentVoice(this.state, id);
      }
    }
  }

  visitDirectiveExpr(expr: Directive): void {
    const semanticData = this.state.semanticData.get(expr.id);
    if (semanticData) {
      this.state.tune.formatting[expr.key.lexeme] = semanticData;
    }
  }

  visitMusicCodeExpr(expr: Music_code): void {
    // Visit each content element
    for (const content of expr.contents) {
      if (content instanceof Token) {
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
    const verticalPos = Math.floor((basePitch + octaveOffset) / 2);

    const pitch: ABCJSPitch = {
      pitch: pitchNumber,
      name: (accidental || "") + noteLetter,
      verticalPos,
      accidental: accidental ? this.convertAccidental(accidental) : undefined,
    };

    const duration = expr.rhythm ? (expr.rhythm.accept(this) as any) : this.state.tuneDefaults.noteLength;
    const range = this.rangeVisitor.visitNoteExpr(expr);

    const element: NoteElement = {
      el_type: ElementType.Note,
      startChar: range.start.character,
      endChar: range.end.character,
      duration: duration || this.state.tuneDefaults.noteLength,
      pitches: [pitch],
    };

    this.currentVoiceElements.push(element);
  }

  visitRestExpr(expr: Rest): void {
    const duration = expr.rhythm ? (expr.rhythm.accept(this) as any) : this.state.tuneDefaults.noteLength;
    const range = this.rangeVisitor.visitRestExpr(expr);

    const element: NoteElement = {
      el_type: ElementType.Note,
      startChar: range.start.character,
      endChar: range.end.character,
      duration: duration || this.state.tuneDefaults.noteLength,
      rest: { type: RestType.Normal },
    };

    this.currentVoiceElements.push(element);
  }

  visitChordExpr(expr: Chord): void {
    const pitches: ABCJSPitch[] = [];

    for (const content of expr.contents) {
      if (content instanceof Note) {
        const noteLetter = content.pitch.noteLetter.lexeme;
        const accidental = content.pitch.alteration?.lexeme;
        const octave = content.pitch.octave?.lexeme;

        const basePitch = this.getBasePitch(noteLetter);
        const octaveOffset = octave ? this.getOctaveOffset(octave) : 0;
        const pitchNumber = basePitch + octaveOffset;
        const verticalPos = Math.floor((basePitch + octaveOffset) / 2);

        pitches.push({
          pitch: pitchNumber,
          name: (accidental || "") + noteLetter,
          verticalPos,
          accidental: accidental ? this.convertAccidental(accidental) : undefined,
        });
      }
    }

    if (pitches.length === 0) return;

    const duration = expr.rhythm ? (expr.rhythm.accept(this) as any) : this.state.tuneDefaults.noteLength;
    const range = this.rangeVisitor.visitChordExpr(expr);

    const element: NoteElement = {
      el_type: ElementType.Note,
      startChar: range.start.character,
      endChar: range.end.character,
      duration: duration || this.state.tuneDefaults.noteLength,
      pitches,
    };

    this.currentVoiceElements.push(element);
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
      startChar: range.start.character,
      endChar: range.end.character,
      type: barType,
    };

    this.currentVoiceElements.push(element);
    nextMeasure(this.state);
  }

  visitRhythmExpr(expr: Rhythm): void {
    // TODO: Implement full rhythm calculation
    // For now, return undefined and caller will use default
  }

  // Placeholder implementations for other visitors
  visitPitchExpr(expr: Pitch): void {
    // Pitch is handled inline in visitNoteExpr
  }

  visitToken(token: Token): void {}
  visitAnnotationExpr(expr: Annotation): void {}
  visitCommentExpr(expr: Comment): void {}
  visitDecorationExpr(expr: Decoration): void {}
  visitGraceGroupExpr(expr: Grace_group): void {}
  visitInlineFieldExpr(expr: Inline_field): void {}
  visitLyricLineExpr(expr: Lyric_line): void {}
  visitLyricSectionExpr(expr: Lyric_section): void {}
  visitMacroDeclExpr(expr: Macro_decl): void {}
  visitMacroInvocationExpr(expr: Macro_invocation): void {}
  visitMultiMeasureRestExpr(expr: MultiMeasureRest): void {}
  visitSymbolExpr(expr: Symbol): void {}
  visitUserSymbolDeclExpr(expr: User_symbol_decl): void {}
  visitUserSymbolInvocationExpr(expr: User_symbol_invocation): void {}
  visitYSpacerExpr(expr: YSPACER): void {}
  visitBeamExpr(expr: Beam): void {}
  visitVoiceOverlayExpr(expr: Voice_overlay): void {}
  visitTupletExpr(expr: Tuplet): void {}
  visitErrorExpr(expr: ErrorExpr): void {}
  visitKV(expr: KV): void {}
  visitBinary(expr: Binary): void {}
  visitGrouping(expr: Grouping): void {}
  visitAbsolutePitch(expr: AbsolutePitch): void {}
  visitRationalExpr(expr: Rational): void {}
  visitMeasurementExpr(expr: Measurement): void {}

  // ============================================================================
  // Helper Methods
  // ============================================================================

  getBasePitch(noteLetter: string): number {
    const pitches: { [key: string]: number } = {
      C: 0,
      D: 2,
      E: 4,
      F: 5,
      G: 7,
      A: 9,
      B: 11,
      c: 12,
      d: 14,
      e: 16,
      f: 17,
      g: 19,
      a: 21,
      b: 23,
    };
    return pitches[noteLetter] || 0;
  }

  getOctaveOffset(octave: string): number {
    if (octave.includes(",")) {
      return -12 * octave.length;
    } else if (octave.includes("'")) {
      return 12 * octave.length;
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

  createMusicLine(): void {
    const voice = getCurrentVoice(this.state);
    if (!voice) return;

    const staff: Staff = {
      clef: voice.currentClef,
      key: voice.currentKey,
      meter: voice.currentMeter,
      workingClef: voice.currentClef,
      voices: [this.currentVoiceElements],
    };

    const musicLine: MusicLine = {
      staff: [staff],
    };

    this.state.tune.lines.push(musicLine);
  }

  finalizeTune(): void {
    this.state.tune.staffNum = this.countStaffs();
    this.state.tune.voiceNum = this.state.voices.size;
    this.state.tune.lineNum = this.state.tune.lines.length;
    this.state.tune.formatting = { ...this.fileDefaults.formatting, ...this.state.tune.formatting };

    if (this.fileDefaults.version) {
      this.state.tune.version = this.fileDefaults.version;
    }
  }

  countStaffs(): number {
    let max = 0;
    for (const line of this.state.tune.lines) {
      if ("staff" in line) {
        max = Math.max(max, line.staff.length);
      }
    }
    return max;
  }
}
