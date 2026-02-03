import { cloneText, cloneToken, isToken } from "../helpers";
import { ABCContext } from "../parsers/Context";
import { Token } from "../parsers/scan2";
import {
  AbsolutePitch,
  Annotation,
  BarLine,
  Beam,
  Beam_contents,
  Binary,
  Chord,
  ChordSymbol,
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
  Line_continuation,
  Lyric_line,
  Lyric_section,
  Macro_decl,
  Macro_invocation,
  Measurement,
  MultiMeasureRest,
  Music_code,
  music_code,
  Note,
  Pitch,
  Rational,
  Rest,
  Rhythm,
  Symbol,
  SystemBreak,
  Tune,
  Tune_Body,
  Tune_header,
  tune_body_code,
  Tuplet,
  User_symbol_decl,
  User_symbol_invocation,
  Visitor,
  Voice_overlay,
  YSPACER,
  Unary,
} from "../types/Expr2";
import { System } from "../types/types";

/**
 * Use to clone an AST.
 * Useful in situations where you need to keep an immutable source tree.
 */
export class Cloner implements Visitor<Expr | Token> {
  public ctx: ABCContext;
  constructor(ctx: ABCContext) {
    this.ctx = ctx;
  }

  visitToken(token: Token): Token {
    return cloneToken(token, this.ctx);
  }

  visitAnnotationExpr(expr: Annotation): Expr | Token {
    return new Annotation(this.ctx.generateId(), cloneToken(expr.text, this.ctx));
  }

  visitBarLineExpr(expr: BarLine): BarLine {
    return new BarLine(
      this.ctx.generateId(),
      expr.barline.map((e) => cloneToken(e, this.ctx)),
      expr.repeatNumbers ? expr.repeatNumbers.map((e) => cloneToken(e, this.ctx)) : undefined
    );
  }

  visitChordExpr(expr: Chord): Chord {
    const newContents = expr.contents.map((content) => {
      if (isToken(content)) {
        return cloneToken(content, this.ctx);
      } else {
        return content.accept(this);
      }
    }) as Array<Note | Token | Annotation>;
    const newRhythm = expr.rhythm ? (expr.rhythm.accept(this) as Rhythm) : undefined;
    const newTie = expr.tie ? cloneToken(expr.tie, this.ctx) : undefined;
    const newLeftBracket = expr.leftBracket ? cloneToken(expr.leftBracket, this.ctx) : undefined;
    const newRightBracket = expr.rightBracket ? cloneToken(expr.rightBracket, this.ctx) : undefined;
    return new Chord(this.ctx.generateId(), newContents, newRhythm, newTie, newLeftBracket, newRightBracket);
  }

  visitCommentExpr(expr: Comment): Comment {
    return new Comment(this.ctx.generateId(), cloneToken(expr.token, this.ctx));
  }

  visitDirectiveExpr(expr: Directive): Directive {
    const newKey = cloneToken(expr.key, this.ctx);
    const newValues = expr.values.map((v) => {
      if (isToken(v)) {
        return cloneToken(v, this.ctx);
      } else {
        return v.accept(this) as Rational | Pitch | KV | Measurement | Annotation;
      }
    });
    return new Directive(this.ctx.generateId(), newKey, newValues);
  }

  visitSystemBreakExpr(expr: SystemBreak): SystemBreak {
    return new SystemBreak(this.ctx.generateId(), cloneToken(expr.symbol, this.ctx));
  }

  visitDecorationExpr(expr: Decoration): Decoration {
    return new Decoration(this.ctx.generateId(), cloneToken(expr.decoration, this.ctx));
  }

  visitFileHeaderExpr(expr: File_header): File_header {
    const newContents = expr.contents.map((e) => {
      if (isToken(e)) {
        return cloneToken(e, this.ctx);
      } else {
        return e.accept(this) as Expr;
      }
    });
    return new File_header(this.ctx.generateId(), newContents);
  }

  visitFileStructureExpr(expr: File_structure): File_structure {
    const newHeader = expr.file_header ? (expr.file_header.accept(this) as File_header) : null;
    const newContents = expr.contents.map((e) => {
      if (isToken(e)) {
        return cloneToken(e, this.ctx);
      } else {
        return e.accept(this) as Tune;
      }
    });
    return new File_structure(this.ctx.generateId(), newHeader, newContents, expr.linear);
  }

  visitGraceGroupExpr(expr: Grace_group): Grace_group {
    const newNotes = expr.notes.map((content) => {
      if (isToken(content)) {
        return cloneToken(content, this.ctx);
      } else {
        return content.accept(this) as Note;
      }
    });
    return new Grace_group(this.ctx.generateId(), newNotes, expr.isAccacciatura);
  }

  visitInfoLineExpr(expr: Info_line): Info_line {
    const newKey = cloneToken(expr.key, this.ctx);
    const newValue = expr.value.map((e) => cloneToken(e, this.ctx));
    const newValue2 = expr.value2 ? expr.value2.map((e) => e.accept(this) as Expr) : undefined;
    return new Info_line(this.ctx.generateId(), [newKey, ...newValue], expr.parsed, newValue2);
  }

  visitInlineFieldExpr(expr: Inline_field): Inline_field {
    const newField = cloneToken(expr.field, this.ctx);
    const newText = expr.text.map((e) => cloneToken(e, this.ctx));
    return new Inline_field(this.ctx.generateId(), newField, newText);
  }

  visitLyricLineExpr(expr: Lyric_line): Lyric_line {
    const newHeader = cloneToken(expr.header, this.ctx);
    const newContents = expr.contents.map((e) => cloneToken(e, this.ctx));
    return new Lyric_line(this.ctx.generateId(), newHeader, newContents);
  }

  visitLyricSectionExpr(expr: Lyric_section): Lyric_section {
    const newInfoLines = expr.info_lines.map((e) => e.accept(this) as Info_line);
    return new Lyric_section(this.ctx.generateId(), newInfoLines);
  }

  visitMacroDeclExpr(expr: Macro_decl): Macro_decl {
    const newHeader = cloneToken(expr.header, this.ctx);
    const newVariable = cloneToken(expr.variable, this.ctx);
    const newContent = cloneToken(expr.content, this.ctx);
    const newEquals = expr.equals ? cloneToken(expr.equals, this.ctx) : undefined;
    return new Macro_decl(this.ctx.generateId(), newHeader, newVariable, newContent, newEquals);
  }

  visitMacroInvocationExpr(expr: Macro_invocation): Macro_invocation {
    return new Macro_invocation(this.ctx.generateId(), cloneToken(expr.variable, this.ctx));
  }

  visitMultiMeasureRestExpr(expr: MultiMeasureRest): MultiMeasureRest {
    const newRest = cloneToken(expr.rest, this.ctx);
    const newLength = expr.length ? cloneToken(expr.length, this.ctx) : undefined;
    return new MultiMeasureRest(this.ctx.generateId(), newRest, newLength);
  }

  visitMusicCodeExpr(expr: Music_code): Music_code {
    const newContents: Array<music_code> = expr.contents.map((e) => {
      if (isToken(e)) {
        return cloneToken(e, this.ctx);
      } else {
        return e.accept(this) as music_code;
      }
    });
    return new Music_code(this.ctx.generateId(), newContents);
  }

  visitNoteExpr(expr: Note): Note {
    const newPitch = expr.pitch.accept(this) as Pitch;
    const newRhythm = expr.rhythm ? (expr.rhythm.accept(this) as Rhythm) : undefined;
    const newTie = expr.tie ? cloneToken(expr.tie, this.ctx) : undefined;
    return new Note(this.ctx.generateId(), newPitch, newRhythm, newTie);
  }

  visitPitchExpr(expr: Pitch): Pitch {
    const newAlteration = expr.alteration ? cloneToken(expr.alteration, this.ctx) : undefined;
    const newNoteLetter = cloneToken(expr.noteLetter, this.ctx);
    const newOctave = expr.octave ? cloneToken(expr.octave, this.ctx) : undefined;
    return new Pitch(this.ctx.generateId(), {
      alteration: newAlteration,
      noteLetter: newNoteLetter,
      octave: newOctave,
    });
  }

  visitRestExpr(expr: Rest): Rest {
    const newRhythm = expr.rhythm ? (expr.rhythm.accept(this) as Rhythm) : undefined;
    return new Rest(this.ctx.generateId(), cloneToken(expr.rest, this.ctx), newRhythm);
  }

  visitRhythmExpr(expr: Rhythm): Rhythm {
    const newNumerator = expr.numerator ? cloneToken(expr.numerator, this.ctx) : null;
    const newSeparator = expr.separator ? cloneToken(expr.separator, this.ctx) : undefined;
    const newDenominator = expr.denominator ? cloneToken(expr.denominator, this.ctx) : null;
    const newBroken = expr.broken ? cloneToken(expr.broken, this.ctx) : null;
    return new Rhythm(this.ctx.generateId(), newNumerator, newSeparator, newDenominator, newBroken);
  }

  visitSymbolExpr(expr: Symbol): Symbol {
    return new Symbol(this.ctx.generateId(), cloneToken(expr.symbol, this.ctx));
  }

  visitTuneBodyExpr(expr: Tune_Body): Tune_Body {
    const newSequence = expr.sequence.map((system) => {
      return system.map((element) => {
        if (isToken(element)) {
          return cloneToken(element, this.ctx);
        } else {
          return element.accept(this);
        }
      }) as System;
    });
    return new Tune_Body(this.ctx.generateId(), newSequence);
  }

  visitTuneExpr(expr: Tune): Tune {
    const newHeader = expr.tune_header.accept(this) as Tune_header;
    const newBody = expr.tune_body ? (expr.tune_body.accept(this) as Tune_Body) : null;
    return new Tune(this.ctx.generateId(), newHeader, newBody, expr.linear);
  }

  visitTuneHeaderExpr(expr: Tune_header): Tune_header {
    const newInfoLines = expr.info_lines.map((e) => e.accept(this)) as Array<Info_line | Comment | Macro_decl | User_symbol_decl | Directive>;
    return new Tune_header(this.ctx.generateId(), newInfoLines, expr.voices);
  }

  visitUserSymbolDeclExpr(expr: User_symbol_decl): User_symbol_decl {
    const newHeader = cloneToken(expr.header, this.ctx);
    const newVariable = cloneToken(expr.variable, this.ctx);
    const newSymbol = cloneToken(expr.symbol, this.ctx);
    const newEquals = expr.equals ? cloneToken(expr.equals, this.ctx) : undefined;
    return new User_symbol_decl(this.ctx.generateId(), newHeader, newVariable, newSymbol, newEquals);
  }

  visitUserSymbolInvocationExpr(expr: User_symbol_invocation): User_symbol_invocation {
    return new User_symbol_invocation(this.ctx.generateId(), cloneToken(expr.variable, this.ctx));
  }

  visitVoiceOverlayExpr(expr: Voice_overlay): Voice_overlay {
    const newContents = expr.contents.map((token) => cloneToken(token, this.ctx));
    return new Voice_overlay(this.ctx.generateId(), newContents);
  }

  visitLineContinuationExpr(expr: Line_continuation): Line_continuation {
    return new Line_continuation(this.ctx.generateId(), cloneToken(expr.token, this.ctx));
  }

  visitYSpacerExpr(expr: YSPACER): YSPACER {
    const newYSpacer = cloneToken(expr.ySpacer, this.ctx);
    const newRhythm = expr.rhythm ? (expr.rhythm.accept(this) as Rhythm) : undefined;
    return new YSPACER(this.ctx.generateId(), newYSpacer, newRhythm);
  }

  visitBeamExpr(expr: Beam): Beam {
    const newContents: Array<Beam_contents> = expr.contents.map((e) => {
      if (isToken(e)) {
        return cloneToken(e, this.ctx);
      } else {
        return e.accept(this) as Beam_contents;
      }
    });
    return new Beam(this.ctx.generateId(), newContents);
  }

  visitTupletExpr(expr: Tuplet): Tuplet {
    const new_p = cloneToken(expr.p, this.ctx);
    let new_q: Token | undefined;
    let new_r: Token | undefined;
    if (expr.q) {
      new_q = cloneToken(expr.q, this.ctx);
    }
    if (expr.r) {
      new_r = cloneToken(expr.r, this.ctx);
    }
    return new Tuplet(this.ctx.generateId(), new_p, new_q, new_r);
  }

  visitErrorExpr(expr: ErrorExpr): ErrorExpr {
    const tokens = expr.tokens.map((e) => cloneToken(e, this.ctx));
    const err_msg = expr.errorMessage ? cloneText(expr.errorMessage) : expr.errorMessage;
    return new ErrorExpr(this.ctx.generateId(), tokens, expr.expectedType, err_msg);
  }

  // New expression visitor methods for unified info line parsing
  visitKV(expr: KV): KV {
    let newKey: Token | AbsolutePitch | undefined;
    if (expr.key) {
      if (isToken(expr.key)) {
        newKey = cloneToken(expr.key, this.ctx);
      } else {
        newKey = expr.key.accept(this) as AbsolutePitch;
      }
    }
    const newEquals = expr.equals ? cloneToken(expr.equals, this.ctx) : undefined;
    let newValue: Token | Expr;
    if (isToken(expr.value)) {
      newValue = cloneToken(expr.value, this.ctx);
    } else {
      newValue = expr.value.accept(this) as Expr;
    }
    return new KV(this.ctx.generateId(), newValue, newKey, newEquals);
  }

  visitBinary(expr: Binary): Binary {
    let newLeft: Expr | Token;
    if (isToken(expr.left)) {
      newLeft = cloneToken(expr.left, this.ctx);
    } else {
      newLeft = expr.left.accept(this) as Expr;
    }
    const newOperator = cloneToken(expr.operator, this.ctx);
    let newRight: Expr | Token;
    if (isToken(expr.right)) {
      newRight = cloneToken(expr.right, this.ctx);
    } else {
      newRight = expr.right.accept(this) as Expr;
    }
    return new Binary(this.ctx.generateId(), newLeft, newOperator, newRight);
  }

  visitUnary(expr: Unary): Unary {
    const newOperator = cloneToken(expr.operator, this.ctx);
    let newOperand: Expr | Token;
    if (isToken(expr.operand)) {
      newOperand = cloneToken(expr.operand, this.ctx);
    } else {
      newOperand = expr.operand.accept(this) as Expr;
    }
    return new Unary(this.ctx.generateId(), newOperator, newOperand);
  }

  visitGrouping(expr: Grouping): Grouping {
    const newExpression = expr.expression.accept(this) as Expr;
    const newLeftParen = expr.leftParen ? cloneToken(expr.leftParen, this.ctx) : undefined;
    const newRightParen = expr.rightParen ? cloneToken(expr.rightParen, this.ctx) : undefined;
    return new Grouping(this.ctx.generateId(), newExpression, newLeftParen, newRightParen);
  }

  visitAbsolutePitch(expr: AbsolutePitch): AbsolutePitch {
    const newNoteLetter = cloneToken(expr.noteLetter, this.ctx);
    const newAlteration = expr.alteration ? cloneToken(expr.alteration, this.ctx) : undefined;
    const newOctave = expr.octave ? cloneToken(expr.octave, this.ctx) : undefined;
    return new AbsolutePitch(this.ctx.generateId(), newNoteLetter, newAlteration, newOctave);
  }

  visitRationalExpr(expr: Rational): Rational {
    const newNumerator = cloneToken(expr.numerator, this.ctx);
    const newSeparator = cloneToken(expr.separator, this.ctx);
    const newDenominator = cloneToken(expr.denominator, this.ctx);
    return new Rational(this.ctx.generateId(), newNumerator, newSeparator, newDenominator);
  }

  visitMeasurementExpr(expr: Measurement): Measurement {
    const newValue = cloneToken(expr.value, this.ctx);
    const newScale = cloneToken(expr.scale, this.ctx);
    return new Measurement(this.ctx.generateId(), newValue, newScale);
  }

  visitChordSymbolExpr(expr: ChordSymbol): ChordSymbol {
    return new ChordSymbol(this.ctx.generateId(), cloneToken(expr.token, this.ctx));
  }
}

// Helper functions for convenience
export { cloneToken } from "../helpers";

export function cloneLine(line: tune_body_code[], ctx: ABCContext): tune_body_code[] {
  const cloner = new Cloner(ctx);
  return line.map((element) => {
    if (isToken(element)) {
      return cloneToken(element, ctx);
    } else {
      return element.accept(cloner) as tune_body_code;
    }
  });
}

export function cloneExpr<T extends Expr>(expr: T, ctx: ABCContext): T {
  const cloner = new Cloner(ctx);
  return expr.accept(cloner) as T;
}
