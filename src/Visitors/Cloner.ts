import { cloneText, cloneToken, isToken } from "../helpers";
import { ABCContext } from "../parsers/Context";
import {
  Annotation,
  BarLine,
  Beam,
  Beam_contents,
  Chord,
  Comment,
  Decoration,
  Expr,
  File_header,
  File_structure,
  Grace_group,
  Info_line,
  Inline_field,
  Lyric_section,
  MultiMeasureRest,
  Music_code,
  Note,
  Nth_repeat,
  Pitch,
  Rest,
  Rhythm,
  Symbol,
  Tune,
  Tune_Body,
  Tune_header,
  Tuplet,
  Visitor,
  Voice_overlay,
  YSPACER,
  music_code,
  ErrorExpr,
} from "../types/Expr";
import { Token } from "../types/token";
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
  visitAnnotationExpr(expr: Annotation): Annotation {
    return new Annotation(this.ctx, cloneToken(expr.text, this.ctx));
  }
  visitBarLineExpr(expr: BarLine): Expr {
    return new BarLine(
      this.ctx,
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
    let newRhythm: Rhythm | undefined;
    if (expr.rhythm) {
      newRhythm = expr.rhythm.accept(this);
    }
    return new Chord(this.ctx, newContents, newRhythm);
  }
  visitCommentExpr(expr: Comment): Comment {
    return new Comment(this.ctx, cloneText(expr.token.lexeme), cloneToken(expr.token, this.ctx));
  }
  visitDecorationExpr(expr: Decoration): Decoration {
    return new Decoration(this.ctx, cloneToken(expr.decoration, this.ctx));
  }
  visitFileHeaderExpr(expr: File_header): File_header {
    const newText = cloneText(expr.text);
    const newTokens: Array<Token> = expr.tokens.map((e) => cloneToken(e, this.ctx));
    return new File_header(this.ctx, newText, newTokens);
  }
  visitFileStructureExpr(expr: File_structure): File_structure {
    const newHeader = expr.file_header?.accept(this) as File_header;
    const newBody = expr.tune.map((e) => {
      return e.accept(this) as Tune;
    });

    return new File_structure(this.ctx, newHeader, newBody);
  }
  visitGraceGroupExpr(expr: Grace_group): Grace_group {
    const newContents = expr.notes.map((content) => {
      if (isToken(content)) {
        return cloneToken(content, this.ctx);
      } else {
        return content.accept(this);
      }
    }) as Array<Note>;
    return new Grace_group(this.ctx, newContents, expr.isAccacciatura);
  }
  visitInfoLineExpr(expr: Info_line): Info_line {
    let newKey: Token = cloneToken(expr.key, this.ctx);
    let newValue: Array<Token> = expr.value.map((e) => cloneToken(e, this.ctx));
    return new Info_line(this.ctx, [newKey, ...newValue]);
  }
  visitInlineFieldExpr(expr: Inline_field): Inline_field {
    let newField: Token = cloneToken(expr.field, this.ctx);
    let newText: Array<Token> = expr.text.map((e) => cloneToken(e, this.ctx));
    return new Inline_field(this.ctx, newField, newText);
  }
  visitLyricSectionExpr(expr: Lyric_section): Lyric_section {
    let newInfo_lines: Array<Info_line> = expr.info_lines.map((e) => e.accept(this) as Info_line);
    return new Lyric_section(this.ctx, newInfo_lines);
  }
  visitMultiMeasureRestExpr(expr: MultiMeasureRest): MultiMeasureRest {
    let newRest: Token = cloneToken(expr.rest, this.ctx);
    let newLength = expr.length ? cloneToken(expr.length, this.ctx) : undefined;
    return new MultiMeasureRest(this.ctx, newRest, newLength);
  }
  visitMusicCodeExpr(expr: Music_code): Music_code {
    let newContents: Array<music_code> = expr.contents.map((e) => {
      if (isToken(e)) {
        return cloneToken(e, this.ctx);
      } else {
        return e.accept(this) as music_code;
      }
    });
    return new Music_code(this.ctx, newContents);
  }
  visitNoteExpr(expr: Note): Note {
    let newPitch: Pitch | Rest = expr.pitch.accept(this) as Pitch | Rest;
    let newRhythm = expr.rhythm?.accept(this) as Rhythm | undefined;
    let newTie = expr.tie;
    return new Note(this.ctx, newPitch, newRhythm, newTie);
  }
  visitNthRepeatExpr(expr: Nth_repeat): Nth_repeat {
    return new Nth_repeat(this.ctx, cloneToken(expr.repeat, this.ctx));
  }
  visitPitchExpr(expr: Pitch): Pitch {
    let newAlteration: Token | undefined = expr.alteration ? cloneToken(expr.alteration, this.ctx) : undefined;
    let newNoteLetter: Token = cloneToken(expr.noteLetter, this.ctx);
    let newOctave: Token | undefined = expr.octave ? cloneToken(expr.octave, this.ctx) : undefined;
    return new Pitch(this.ctx, {
      alteration: newAlteration,
      noteLetter: newNoteLetter,
      octave: newOctave,
    });
  }
  visitRestExpr(expr: Rest): Rest {
    return new Rest(this.ctx, cloneToken(expr.rest, this.ctx));
  }
  visitRhythmExpr(expr: Rhythm): Rhythm {
    let newNumerator: Token | null = expr.numerator ? cloneToken(expr.numerator, this.ctx) : null;
    let newSeparator: Token | undefined = expr.separator ? cloneToken(expr.separator, this.ctx) : undefined;
    let newDenominator: Token | null = expr.denominator ? cloneToken(expr.denominator, this.ctx) : null;
    let newBroken: Token | null = expr.broken ? cloneToken(expr.broken, this.ctx) : null;
    return new Rhythm(this.ctx, newNumerator, newSeparator, newDenominator, newBroken);
  }
  visitSymbolExpr(expr: Symbol): Symbol {
    return new Symbol(this.ctx, cloneToken(expr.symbol, this.ctx));
  }
  visitTuneBodyExpr(expr: Tune_Body): Tune_Body {
    let newSequence = expr.sequence.map((e) => {
      return e.map((exp) => {
        if (isToken(exp)) {
          return cloneToken(exp, this.ctx);
        } else {
          return exp.accept(this);
        }
      }) as System;
    });
    return new Tune_Body(this.ctx, newSequence);
  }
  visitTuneExpr(expr: Tune): Tune {
    let newHeader: Tune_header = expr.tune_header.accept(this) as Tune_header;
    let newBody: Tune_Body | undefined = expr.tune_body ? (expr.tune_body.accept(this) as Tune_Body) : undefined;
    return new Tune(this.ctx, newHeader, newBody);
  }
  visitTuneHeaderExpr(expr: Tune_header): Tune_header {
    let newInfo_lines: Array<Info_line> = expr.info_lines.map((e) => e.accept(this) as Info_line);
    return new Tune_header(this.ctx, newInfo_lines);
  }
  visitVoiceOverlayExpr(expr: Voice_overlay) {
    let newAmpersands = expr.contents.map((token) => cloneToken(token, this.ctx));
    return new Voice_overlay(this.ctx, newAmpersands);
  }
  visitYSpacerExpr(expr: YSPACER): YSPACER {
    const rhythm = expr.rhythm;
    let newRhythm = rhythm ? rhythm.accept(this) : undefined;
    let newYSpacer: Token = cloneToken(expr.ySpacer, this.ctx);
    return new YSPACER(this.ctx, newYSpacer, newRhythm);
  }
  visitBeamExpr(expr: Beam): Beam {
    let newContents: Array<Beam_contents> = expr.contents.map((e) => {
      if (isToken(e)) {
        return cloneToken(e, this.ctx);
      } else {
        return e.accept(this) as Beam_contents;
      }
    });
    return new Beam(this.ctx, newContents);
  }
  visitTupletExpr(expr: Tuplet): Tuplet {
    let new_p = cloneToken(expr.p, this.ctx);
    let new_q: Array<Token> | undefined;
    let new_r: Array<Token> | undefined;
    const q = expr.q;
    if (q) {
      new_q = q.map((t) => cloneToken(t, this.ctx));
    }
    const r = expr.r;
    if (r) {
      new_r = r.map((t) => cloneToken(t, this.ctx));
    }
    return new Tuplet(this.ctx, new_p, new_q, new_r);
  }
  visitErrorExpr(expr: ErrorExpr): ErrorExpr {
    const tokens = expr.tokens.map((e) => cloneToken(e, this.ctx));
    let err_msg = expr.errorMessage ? (" " + expr.errorMessage).slice(1) : expr.errorMessage;
    return new ErrorExpr(this.ctx, tokens, expr.expectedType, err_msg);
  }
}
