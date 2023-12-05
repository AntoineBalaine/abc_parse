
import { cloneToken, exprIsInRange, getPitchRange, getTokenRange, isChord, isEmptyRhythm, isRhythmInRange, isToken, isTune_Body } from "../helpers";
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
  tune_body_code
} from "../types/Expr";
import { Token } from "../types/token";
import { Range, TokenType } from "../types/types";
import { AbcFormatter } from "./Formatter";
import { RangeVisitor } from "./RangeVisitor";

export class RhythmVisitor implements Visitor<Expr> {
  private source: Expr;
  private factor?: "*" | "/";
  private range: Range;
  private updated: Array<Expr | Token> = [];
  rangeVisitor = new RangeVisitor();

  constructor(source: Expr) {
    this.source = source;
    this.range = {
      start: {
        line: 0,
        character: 0,
      },
      end: {
        line: Number.MAX_VALUE,
        character: Number.MAX_VALUE,
      }
    };
  }

  transform(factor: "*" | "/", range?: Range) {
    this.factor = factor;
    if (range) {
      this.range = range;
    }
    return this.source.accept(this);
  }

  updateChanges(expr: Array<Expr | Token>) {
    if (expr.length > 0) {
      this.updated = expr;
    }
  }
  getChanges(): string {
    const formatter = new AbcFormatter();
    return this.updated.map(e => {
      if (isToken(e)) {
        return e.lexeme;
      } else {
        return formatter.stringify(e);
      }
    }).join("");
  }

  private isInRange(expr: Expr | Token) {
    let exprRange: Range;
    if (isToken(expr)) {
      exprRange = getTokenRange(expr);
    } else {
      exprRange = expr.accept(this.rangeVisitor);
    }
    return exprIsInRange(this.range, exprRange);
  }

  visitAnnotationExpr(expr: Annotation): Annotation {
    if (this.isInRange(expr)) {
      this.updateChanges([expr]);
    }
    return expr;
  };
  visitBarLineExpr(expr: BarLine): Expr { // FIXME - return type should be BarLine
    if (this.isInRange(expr)) {
      this.updateChanges([expr]);
    }
    return expr;
  };
  visitChordExpr(expr: Chord): Chord {
    const isInRange = (this.isInRange(expr));
    if (!isChord(expr)) { return expr; }
    expr.contents = expr.contents.map((content) => {
      if (!isToken(content)) {
        return content.accept(this);
      } else {
        return content;
      }
    }) as Array<Note | Token | Annotation>;
    if (expr.rhythm) {
      expr.rhythm = expr.rhythm.accept(this);
    }
    if (isInRange) {
      this.updateChanges([expr]);
    }
    return expr;
  };
  visitCommentExpr(expr: Comment): Comment {
    if (this.isInRange(expr)) {
      this.updateChanges([expr]);
    }
    return expr;
  };
  visitDecorationExpr(expr: Decoration): Decoration {
    if (this.isInRange(expr)) {
      this.updateChanges([expr]);
    }
    return expr;
  };
  visitFileHeaderExpr(expr: File_header): File_header { return expr; };
  visitFileStructureExpr(expr: File_structure): File_structure {
    expr.tune = expr.tune.map((tune) => {
      return tune.accept(this);
    }) as Tune[];
    return expr;
  };
  visitGraceGroupExpr(expr: Grace_group): Grace_group {
    expr.notes = expr.notes.map(e => {
      return e.accept(this);
    }) as Note[];
    if (this.isInRange(expr)) {
      this.updateChanges([expr]);
    }
    return expr;
  };
  visitInfoLineExpr(expr: Info_line): Info_line {
    if (this.isInRange(expr)) {
      this.updateChanges([expr]);
    }
    return expr;
  };

  visitInlineFieldExpr(expr: Inline_field): Inline_field {
    if (this.isInRange(expr)) {
      this.updateChanges([expr]);
    }
    return expr;
  };
  visitLyricSectionExpr(expr: Lyric_section): Lyric_section { return expr; };
  visitMultiMeasureRestExpr(expr: MultiMeasureRest): MultiMeasureRest {
    if (this.isInRange(expr)) {
      this.updateChanges([expr]);
    }
    return expr;
  };
  visitMusicCodeExpr(expr: Music_code): Music_code {
    let rangeExpr: Array<Expr | Token> = [];
    expr.contents = expr.contents.map((e) => {
      if (isToken(e)) {
        if (this.isInRange(e)) {
          rangeExpr.push(e);
        }
        return e;
      } else {
        const isInRange = (this.isInRange(e));
        const updated = e.accept(this);
        if (isInRange) {
          rangeExpr.push(updated);
        }
        return updated;
      }
    }) as Array<music_code>;
    this.updateChanges(rangeExpr);
    return expr;
  };
  /**TODO 
   * replicate this logic for MultiMeasure rests
   */
  visitNoteExpr(expr: Note): Note {
    let isInRange = this.isInRange(expr);
    const pitchRange = expr.pitch.accept(this.rangeVisitor);
    if (expr.rhythm) {
      expr.rhythm = this.visitRhythmExpr(expr.rhythm);
    } else if (isInRange) {
      if (this.factor === "*") {
        expr.rhythm = new Rhythm(new Token(TokenType.NUMBER, "2", null, pitchRange.start.line, pitchRange.end.character + 1));
      } else {
        expr.rhythm = new Rhythm(null, new Token(TokenType.SLASH, "/", null, pitchRange.start.line, pitchRange.end.character + 1));
      }
    }
    if (expr.rhythm && isEmptyRhythm(expr.rhythm)) {
      expr.rhythm = undefined;
    }
    if (isInRange) {
      this.updateChanges([expr]);
    }
    return expr;
  }

  /**
   * when rhythms get updated, the positions of their tokens might be inaccurate. 
   * To avoid this pitfall, take the position of each of their pitch,
   * update all the token positions
   * @param expr up
   * @returns 
   */
  private syncTokenPositions(expr: Note) {
    let { end } = getPitchRange(expr.pitch);
    let { line, character } = end;
    if (!expr.rhythm) { return expr; }
    const { numerator, separator, denominator, broken } = expr.rhythm;
    const mapped = [numerator, separator, denominator, broken].map((e) => {
      if (!e) { return e; }
      e.line = line;
      e.position = character + 1;
      character = character + e.lexeme.length;
      return cloneToken(e);
    });
    mapped.forEach((e, index): void | Expr | Token | null | undefined => {
      if (!e || !expr.rhythm) { return e; }
      switch (index) {
        case 0: return expr.rhythm.numerator = e;
        case 1: return expr.rhythm.separator = e;
        case 2: return expr.rhythm.denominator = e;
        case 3: return expr.rhythm.broken = e;
      }
    });
    return expr;
  }

  visitNthRepeatExpr(expr: Nth_repeat): Nth_repeat {
    if (this.isInRange(expr)) {
      this.updateChanges([expr]);
    }
    return expr;
  };
  visitPitchExpr(expr: Pitch): Pitch { return expr; };
  visitRestExpr(expr: Rest): Rest { return expr; };
  visitRhythmExpr(expr: Rhythm): Rhythm {
    let isInRange = this.isInRange(expr);
    if (!this.factor) {
      if (isInRange) {
        this.updateChanges([expr]);
      }
      return expr;
    }
    if ((this.range && isRhythmInRange(this.range, expr)) || !this.range) {
      if (this.factor === "*") {
        expr = this.duplicateLength(expr);
      } else {
        expr = this.divideLength(expr);
      }
    }
    if (isInRange) {
      this.updateChanges([expr]);
    }
    return expr;
  };
  visitSymbolExpr(expr: Symbol): Symbol {
    if (this.isInRange(expr)) {
      this.updateChanges([expr]);
    }
    return expr;
  };
  visitTuneBodyExpr(expr: Tune_Body): Tune_Body {
    let rangeExpr: Array<Expr | Token> = [];
    if (!isTune_Body(expr)) { return expr; }
    expr.sequence = expr.sequence.map((e) => {
      return e.map((exp) => {
        if (isToken(exp)) {
          if (this.isInRange(exp)) {
            rangeExpr.push(exp);
          }
          return exp;
        } else {
          const isInRange = (this.isInRange(exp));
          const updated = exp.accept(this) as tune_body_code;
          if (isInRange) {
            rangeExpr.push(updated);
          }
          return updated;
        }
      });
    });
    this.updateChanges(rangeExpr);
    return expr;
  };
  visitTuneExpr(expr: Tune): Tune {
    if (expr.tune_body) {
      expr.tune_body = expr.tune_body.accept(this) as Tune_Body;
    }
    return expr;
  };
  visitTuneHeaderExpr(expr: Tune_header): Tune_header { return expr; };

  visitVoiceOverlayExpr(expr: Voice_overlay): Voice_overlay {
    if (this.isInRange(expr)) {
      this.updateChanges([expr]);
    }
    return expr;
  }

  visitYSpacerExpr(expr: YSPACER): YSPACER {
    if (this.isInRange(expr)) {
      this.updateChanges([expr]);
    }
    return expr;
  };
  visitBeamExpr(expr: Beam): Beam {
    let rangeExpr: Array<Expr | Token> = [];
    expr.contents = expr.contents.map((content) => {
      if (isToken(content)) {
        if (this.isInRange(content)) {
          rangeExpr.push(content);
        }
        return content;
      } else {
        const isInRange = this.isInRange(content);
        const updated = content.accept(this);
        if (isInRange) {
          rangeExpr.push(updated);
        }
        return updated;
      }
    }) as Array<Beam_contents>;
    this.updateChanges(rangeExpr);
    return expr;
  };
  visitTupletExpr(expr: Tuplet) {
    if (this.isInRange(expr)) {
      this.updateChanges([expr]);
    }
    return expr;
  }
  private duplicateLength(expr: Rhythm): Rhythm {
    if (expr.separator) {
      if (!expr.denominator) {
        /**
         * remove a separator
         * if there was only one separator, remove the token altogether
         */
        expr.separator.lexeme = expr.separator.lexeme.substring(0, expr.separator.lexeme.length - 1);
        if (expr.separator.lexeme === "") {
          expr.separator = undefined;
        }
      } else {
        let denominator_int = parseInt(expr.denominator.lexeme);
        /**
         * count the separators
         * add them to the denominator
         */
        expr.denominator.lexeme = (denominator_int / 2).toString();
        if (expr.denominator.lexeme === "1") {
          expr.denominator = undefined;
          expr.separator = undefined;
        }
      }
    } else if (expr.numerator) {
      expr.numerator.lexeme = (parseInt(expr.numerator.lexeme) * 2).toString();
    } else {
      expr.numerator = new Token(TokenType.NUMBER, "2", null, -1, -1);
    }
    return expr;
  };
  private divideLength(expr: Rhythm): Rhythm {
    if (expr.separator) {
      if (!expr.denominator) {
        /**
         * add a separator, format the separators
         */
        const numDivisions = expr.separator.lexeme.length + 1;
        let count = 1;
        for (let i = 0; i < numDivisions; i++) {
          count = count * 2;
        }
        expr.separator.lexeme = `/`;
        if (count > 2) {
          expr.denominator = new Token(TokenType.NUMBER, `${count}`, null, -1, -1);
        }
      } else {
        let denominator_int = parseInt(expr.denominator.lexeme);
        /**
         * count the separators
         * add them to the denominator
         */
        expr.denominator.lexeme = (denominator_int * 2).toString();
      }
    } else if (expr.numerator) {
      expr.numerator.lexeme = (parseInt(expr.numerator.lexeme) / 2).toString();
      if (expr.numerator.lexeme === "1") {
        expr.numerator = undefined;
        expr.separator = undefined;
      }
    } else {
      expr.separator = new Token(TokenType.SLASH, "/", null, -1, -1);
    }
    return expr;
  }
}
