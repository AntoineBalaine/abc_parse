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
  music_code
} from "../Expr";
import { cloneText, cloneToken, isToken } from "../helpers";
import { Token } from "../token";
import { System } from "../types";
export class Cloner implements Visitor<Expr | Token> {

  visitAnnotationExpr(expr: Annotation): Annotation {
    return new Annotation(cloneToken(expr.text));
  }
  visitBarLineExpr(expr: BarLine): Expr {
    return new BarLine(cloneToken(expr.barline));
  }
  visitChordExpr(expr: Chord): Chord {
    const newContents = expr.contents.map((content) => {
      if (isToken(content)) {
        return cloneToken(content);
      } else {
        return content.accept(this);
      }
    }) as Array<Note | Token | Annotation>;
    let newRhythm: Rhythm | undefined;
    if (expr.rhythm) {
      newRhythm = expr.rhythm.accept(this);
    }
    return new Chord(newContents, newRhythm);
  }
  visitCommentExpr(expr: Comment): Comment {
    return new Comment(cloneText(expr.token.lexeme), cloneToken(expr.token));
  }
  visitDecorationExpr(expr: Decoration): Decoration {
    return new Decoration(cloneToken(expr.decoration));
  }
  visitFileHeaderExpr(expr: File_header): File_header {
    const newText = cloneText(expr.text);
    const newTokens: Array<Token> = expr.tokens.map((e) => (cloneToken(e)));
    return new File_header(newText, newTokens);
  }
  visitFileStructureExpr(expr: File_structure): File_structure {
    const newHeader = expr.file_header?.accept(this) as File_header;
    const newBody = expr.tune.map(e => {
      return e.accept(this) as Tune;
    });

    return new File_structure(newHeader, newBody);
  }
  visitGraceGroupExpr(expr: Grace_group): Grace_group {
    const newContents = expr.notes.map((content) => {
      if (isToken(content)) {
        return cloneToken(content);
      } else {
        return content.accept(this);
      }
    }) as Array<Note>;
    return new Grace_group(newContents, expr.isAccacciatura);
  }
  visitInfoLineExpr(expr: Info_line): Info_line {
    let newKey: Token = cloneToken(expr.key);
    let newValue: Array<Token> = expr.value.map((e) => (cloneToken(e)));
    return new Info_line([newKey, ...newValue]);
  }
  visitInlineFieldExpr(expr: Inline_field): Inline_field {
    let newField: Token = cloneToken(expr.field);
    let newText: Array<Token> = expr.text.map((e) => (cloneToken(e)));
    return new Inline_field(newField, newText);
  }
  visitLyricSectionExpr(expr: Lyric_section): Lyric_section {
    let newInfo_lines: Array<Info_line> = expr.info_lines.map((e) => (e.accept(this) as Info_line));
    return new Lyric_section(newInfo_lines);
  }
  visitMultiMeasureRestExpr(expr: MultiMeasureRest): MultiMeasureRest {
    let newRest: Token = cloneToken(expr.rest);
    let newLength = expr.length ? cloneToken(expr.length) : undefined;
    return new MultiMeasureRest(newRest, newLength);
  }
  visitMusicCodeExpr(expr: Music_code): Music_code {
    let newContents: Array<music_code> = expr.contents.map((e) => {
      if (isToken(e)) {
        return cloneToken(e);
      } else {
        return e.accept(this) as music_code;
      }
    });
    return new Music_code(newContents);
  }
  visitNoteExpr(expr: Note): Note {
    let newPitch: Pitch | Rest = expr.pitch.accept(this) as Pitch | Rest;
    let newRhythm = expr.rhythm?.accept(this) as Rhythm | undefined;
    let newTie = expr.tie;
    return new Note(newPitch, newRhythm, newTie);
  }
  visitNthRepeatExpr(expr: Nth_repeat): Nth_repeat { return new Nth_repeat(cloneToken(expr.repeat)); }
  visitPitchExpr(expr: Pitch): Pitch {
    let newAlteration: Token | undefined = expr.alteration ? cloneToken(expr.alteration) : undefined;
    let newNoteLetter: Token = cloneToken(expr.noteLetter);
    let newOctave: Token | undefined = expr.octave ? cloneToken(expr.octave) : undefined;
    return new Pitch({ alteration: newAlteration, noteLetter: newNoteLetter, octave: newOctave });
  }
  visitRestExpr(expr: Rest): Rest { return new Rest(cloneToken(expr.rest)); }
  visitRhythmExpr(expr: Rhythm): Rhythm {
    let newNumerator: Token | null = expr.numerator ? cloneToken(expr.numerator) : null;
    let newSeparator: Token | undefined = expr.separator ? cloneToken(expr.separator) : undefined;
    let newDenominator: Token | null = expr.denominator ? cloneToken(expr.denominator) : null;
    let newBroken: Token | null = expr.broken ? cloneToken(expr.broken) : null;
    return new Rhythm(newNumerator, newSeparator, newDenominator, newBroken);
  }
  visitSymbolExpr(expr: Symbol): Symbol { return new Symbol(cloneToken(expr.symbol)); }
  visitTuneBodyExpr(expr: Tune_Body): Tune_Body {
    let newSequence = expr.sequence.map((e) => {
      return e.map(exp => {
        if (isToken(exp)) {
          return cloneToken(exp);
        } else {
          return exp.accept(this);
        }
      }) as System;
    });
    return new Tune_Body(newSequence);
  }
  visitTuneExpr(expr: Tune): Tune {
    let newHeader: Tune_header = expr.tune_header.accept(this) as Tune_header;
    let newBody: Tune_Body | undefined = expr.tune_body ? expr.tune_body.accept(this) as Tune_Body : undefined;
    return new Tune(newHeader, newBody);
  }
  visitTuneHeaderExpr(expr: Tune_header): Tune_header {
    let newInfo_lines: Array<Info_line> = expr.info_lines.map((e) => (e.accept(this) as Info_line));
    return new Tune_header(newInfo_lines);
  }
  visitVoiceOverlayExpr(expr: Voice_overlay) {
    let newAmpersands = expr.contents
      .map((token) => cloneToken(token));
    return new Voice_overlay(newAmpersands);
  }
  visitYSpacerExpr(expr: YSPACER): YSPACER {
    let newNumber: Token | undefined = expr.number ? cloneToken(expr.number) : undefined;
    let newYSpacer: Token = cloneToken(expr.ySpacer);
    return new YSPACER(newYSpacer, newNumber);
  }
  visitBeamExpr(expr: Beam): Beam {
    let newContents: Array<Beam_contents> = expr.contents.map((e) => {
      if (isToken(e)) {
        return cloneToken(e);
      } else {
        return e.accept(this) as Beam_contents;
      }
    });
    return new Beam(newContents);
  }
  visitTupletExpr(expr: Tuplet): Tuplet {
    let p = cloneToken(expr.p);
    let q: Token | undefined;
    let r: Token | undefined;
    if (expr.q) {
      let q = cloneToken(expr.q);
    }
    if (expr.r) {
      let r = cloneToken(expr.r);
    }
    return new Tuplet(p, q, r);
  }
}
