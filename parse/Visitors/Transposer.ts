import { exprIsInRange, getTokenRange, isBeam, isChord, isGraceGroup, isNote, isPitch, isToken } from "../helpers";
import { ABCContext } from "../parsers/Context";
import { Token, TT } from "../parsers/scan2";
import {
  AbsolutePitch,
  Annotation,
  BarLine,
  Beam,
  Binary,
  Chord,
  Comment,
  Decoration,
  Directive,
  ErrorExpr,
  Expr,
  File_header,
  File_structure,
  Grace_group,
  Grouping,
  Info_line,
  Inline_field,
  KV,
  Lyric_line,
  Lyric_section,
  Macro_decl,
  Macro_invocation,
  Measurement,
  MultiMeasureRest,
  Music_code,
  Note,
  Pitch,
  Rational,
  Rest,
  Rhythm,
  Symbol,
  Tune,
  Tune_Body,
  Tune_header,
  Tuplet,
  User_symbol_decl,
  User_symbol_invocation,
  Visitor,
  Voice_overlay,
  YSPACER,
} from "../types/Expr2";
import { Range } from "../types/types";
import { AbcFormatter, toMidiPitch } from "./Formatter2";
import { ExpressionCollector } from "./RangeCollector";
import { RangeVisitor } from "./RangeVisitor";

/**
 * WIP there will be dragons.
 * Use this to transpose notes within an AST.
 */
export class Transposer implements Visitor<Expr | Token> {
  distance: number = 0;
  source: File_structure;
  ctx: ABCContext;
  range?: Range;
  rangeVisitor: RangeVisitor;
  private collectedExpressions: Array<Expr | Token> = [];

  constructor(source: File_structure, ctx: ABCContext) {
    this.ctx = ctx;
    this.source = source;
    this.rangeVisitor = new RangeVisitor();
    // Default range covers the entire document
  }

  visitToken(token: Token): Token {
    return token;
  }

  private isInRange(expr: Expr | Token): boolean {
    if (!this.range) return true;
    let exprRange: Range;
    if (isToken(expr)) {
      exprRange = getTokenRange(expr);
    } else {
      exprRange = expr.accept(this.rangeVisitor);
    }
    return exprIsInRange(this.range, exprRange);
  }

  transpose(distance: number, range?: Range): string {
    this.distance = distance;

    const formatter = new AbcFormatter(this.ctx);
    if (range) {
      this.range = range;
      const collector = new ExpressionCollector(this.ctx, this.range);
      this.source.accept(collector);
      this.collectedExpressions = collector.getCollectedExpressions();
      this.visitFileStructureExpr(this.source);
      return this.collectedExpressions.map((e) => e.accept(formatter)).join("");
    } else {
      this.collectedExpressions = [];
      this.visitFileStructureExpr(this.source);
      return this.source.accept(formatter);
    }
  }

  /* create all the properties that are needed for the transposer
  for each expression, create a visit method
  that returns the expression */
  visitAnnotationExpr(expr: Annotation) {
    return expr as Expr | Token; // ugh… this cast is ugly as can be
  }
  visitDirectiveExpr(expr: Directive) {
    return expr;
  }
  visitBarLineExpr(expr: BarLine) {
    return expr;
  }
  visitChordExpr(expr: Chord): Chord {
    if (this.isInRange(expr)) {
      expr.contents.map((content) => {
        if (isNote(content)) {
          return this.visitNoteExpr(content);
        } else {
          return content;
        }
      });
    }
    return expr;
  }
  visitCommentExpr(expr: Comment): Comment {
    return expr;
  }
  visitDecorationExpr(expr: Decoration): Decoration {
    return expr;
  }
  visitFileHeaderExpr(expr: File_header): File_header {
    return expr;
  }
  visitFileStructureExpr(expr: File_structure): File_structure {
    expr.contents = expr.contents.map((contents) => {
      if (isToken(contents)) {
        return contents;
      }
      return this.visitTuneExpr(contents);
    });
    return expr;
  }
  visitGraceGroupExpr(expr: Grace_group): Grace_group {
    if (this.isInRange(expr)) {
      expr.notes = expr.notes.map((e) => {
        if (isNote(e)) {
          return this.visitNoteExpr(e);
        } else {
          return e;
        }
      });
    }
    return expr;
  }
  visitInfoLineExpr(expr: Info_line): Info_line {
    return expr;
  }
  visitInlineFieldExpr(expr: Inline_field): Inline_field {
    return expr;
  }
  visitLyricSectionExpr(expr: Lyric_section): Lyric_section {
    return expr;
  }
  visitMultiMeasureRestExpr(expr: MultiMeasureRest): MultiMeasureRest {
    return expr;
  }
  visitMusicCodeExpr(expr: Music_code): Music_code {
    expr.contents.map((e) => {
      if (isToken(e)) {
        return e;
      } else if (isBeam(e)) {
        return this.visitBeamExpr(e);
      } else if (isChord(e)) {
        return this.visitChordExpr(e);
      } else if (isNote(e)) {
        return this.visitNoteExpr(e);
      } else if (isGraceGroup(e)) {
        return this.visitGraceGroupExpr(e);
      } else {
        return e;
      }
    });
    return expr;
  }
  visitNoteExpr(expr: Note): Note {
    if (isPitch(expr.pitch) && this.isInRange(expr)) {
      const id = expr.pitch.id;
      expr.pitch = this.visitPitchExpr(expr.pitch);
      expr.id = id;
    }
    return expr;
  }
  visitPitchExpr(expr: Pitch): Pitch {
    // Convert to MIDI pitch
    const midiPitch = toMidiPitch(expr);

    // Apply transposition
    const transposedMidiPitch = midiPitch + this.distance;

    // Convert back to ABC notation
    return fromMidiPitch(transposedMidiPitch, this.ctx);
  }
  visitRestExpr(expr: Rest): Rest {
    return expr;
  }
  visitRhythmExpr(expr: Rhythm): Rhythm {
    return expr;
  }
  visitSymbolExpr(expr: Symbol): Symbol {
    return expr;
  }
  visitTuneBodyExpr(expr: Tune_Body): Tune_Body {
    expr.sequence = expr.sequence.map((system) => {
      return system.map((expr) => {
        if (isToken(expr)) {
          return expr;
        } else if (isBeam(expr)) {
          return this.visitBeamExpr(expr);
        } else if (isChord(expr)) {
          return this.visitChordExpr(expr);
        } else if (isNote(expr)) {
          return this.visitNoteExpr(expr);
        } else if (isGraceGroup(expr)) {
          return this.visitGraceGroupExpr(expr);
        } else {
          return expr;
        }
      });
    });
    return expr;
  }
  visitTuneExpr(expr: Tune): Tune {
    if (expr.tune_body) {
      expr.tune_body = this.visitTuneBodyExpr(expr.tune_body);
    }
    return expr;
  }
  visitTuneHeaderExpr(expr: Tune_header): Tune_header {
    return expr;
  }

  visitVoiceOverlayExpr(expr: Voice_overlay) {
    return expr; // TODO dbl check this
  }
  visitYSpacerExpr(expr: YSPACER): YSPACER {
    return expr;
  }
  visitBeamExpr(expr: Beam): Beam {
    if (this.isInRange(expr)) {
      expr.contents.map((content) => {
        if (isToken(content)) {
          return content;
        } else if (isChord(content)) {
          return this.visitChordExpr(content);
        } else if (isNote(content)) {
          return this.visitNoteExpr(content);
        } else if (isGraceGroup(content)) {
          return this.visitGraceGroupExpr(content);
        } else {
          return content;
        }
      });
    }
    return expr;
  }

  visitTupletExpr(expr: Tuplet): Tuplet {
    return expr;
  }

  visitErrorExpr(expr: ErrorExpr) {
    return expr;
  }

  visitLyricLineExpr(expr: Lyric_line): Expr | Token {
    return expr;
  }

  visitMacroDeclExpr(expr: Macro_decl): Expr | Token {
    return expr;
  }

  visitMacroInvocationExpr(expr: Macro_invocation): Expr | Token {
    return expr;
  }

  visitUserSymbolDeclExpr(expr: User_symbol_decl): Expr | Token {
    return expr;
  }

  visitUserSymbolInvocationExpr(expr: User_symbol_invocation): Expr | Token {
    return expr;
  }

  visitKV(expr: KV): Expr | Token {
    return expr;
  }

  visitBinary(expr: Binary): Expr | Token {
    return expr;
  }

  visitGrouping(expr: Grouping): Expr | Token {
    return expr;
  }

  visitAbsolutePitch(expr: AbsolutePitch): Expr | Token {
    return expr;
  }

  visitRationalExpr(expr: Rational): Expr | Token {
    return expr;
  }

  visitMeasurementExpr(expr: Measurement): Expr | Token {
    return expr;
  }
}

export function fromMidiPitch(midiPitch: number, ctx: ABCContext): Pitch {
  // Create tokens for the new Pitch object

  // Determine the note letter and accidental
  // C=0, C#=1, D=2, D#=3, E=4, F=5, F#=6, G=7, G#=8, A=9, A#=10, B=11
  const noteNum = midiPitch % 12;
  let noteLetter: string;
  let accidental: string | undefined;

  // Map MIDI note numbers to ABC notation
  // Prefer using sharps for simplicity
  switch (noteNum) {
    case 0: // C
      noteLetter = "C";
      break;
    case 1: // C#
      noteLetter = "C";
      accidental = "^";
      break;
    case 2: // D
      noteLetter = "D";
      break;
    case 3: // D#
      noteLetter = "D";
      accidental = "^";
      break;
    case 4: // E
      noteLetter = "E";
      break;
    case 5: // F
      noteLetter = "F";
      break;
    case 6: // F#
      noteLetter = "F";
      accidental = "^";
      break;
    case 7: // G
      noteLetter = "G";
      break;
    case 8: // G#
      noteLetter = "G";
      accidental = "^";
      break;
    case 9: // A
      noteLetter = "A";
      break;
    case 10: // A#
      noteLetter = "A";
      accidental = "^";
      break;
    case 11: // B
      noteLetter = "B";
      break;
    default:
      throw new Error(`Invalid MIDI note number: ${noteNum}`);
  }

  const midiOctave = Math.floor(midiPitch / 12) - 1; // Convert MIDI octave to musical octave number

  // Create tokens for the new Pitch object
  let noteLetterToken: Token;
  let accidentalToken: Token | undefined;
  let octaveToken: Token | undefined;

  // Handle octave notation
  if (midiOctave <= 4) {
    // Octave 4 and below - uppercase letters
    noteLetterToken = new Token(TT.NOTE_LETTER, noteLetter, ctx.generateId());

    // Add commas for octaves below 4
    if (midiOctave < 4) {
      const octaveStr = ",".repeat(4 - midiOctave);
      octaveToken = new Token(TT.OCTAVE, octaveStr, ctx.generateId());
    }
  } else {
    // Octave 5 and above - lowercase letters
    noteLetterToken = new Token(TT.NOTE_LETTER, noteLetter.toLowerCase(), ctx.generateId());

    // Add apostrophes for octaves above 5
    if (midiOctave > 5) {
      const octaveStr = "'".repeat(midiOctave - 5);
      octaveToken = new Token(TT.OCTAVE, octaveStr, ctx.generateId());
    }
  }

  // Create accidental token if needed
  if (accidental) {
    accidentalToken = new Token(TT.ACCIDENTAL, accidental, ctx.generateId());
  }

  // Create and return the new Pitch object
  return new Pitch(ctx.generateId(), {
    alteration: accidentalToken,
    noteLetter: noteLetterToken,
    octave: octaveToken,
  });
}
