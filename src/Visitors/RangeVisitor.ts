import { getTokenRange, isToken, reduceRanges } from "../helpers";
import {
  Annotation,
  BarLine,
  Beam,
  Chord,
  Comment,
  Decoration,
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
  YSPACER
} from "../types/Expr";
import { Token } from "../types/token";
import { Range } from "../types/types";

/**
 * Use this visitor to figure out the range of a given expr.
 * Range being: start line and character position, end line and character position.
 */
export class RangeVisitor implements Visitor<Range> {
  visitAnnotationExpr(expr: Annotation): Range { return getTokenRange(expr.text); }
  visitBarLineExpr(expr: BarLine): Range { return getTokenRange(expr.barline); }
  visitChordExpr(expr: Chord): Range {
    return expr.contents.map((e) => {
      if (isToken(e)) {
        return getTokenRange(e);
      } else {
        return e.accept(this);
      }
    }).reduce(reduceRanges, <Range>{});
  }
  visitCommentExpr(expr: Comment): Range { return getTokenRange(expr.token); }
  visitDecorationExpr(expr: Decoration): Range { return getTokenRange(expr.decoration); }
  visitFileHeaderExpr(expr: File_header): Range { return expr.tokens.map(e => (getTokenRange(e))).reduce(reduceRanges, <Range>{}); }
  visitFileStructureExpr(expr: File_structure): Range {
    const { file_header, tune, } = expr;
    return tune.map(t => (t.accept(this)))
      .concat([file_header?.accept(this)].filter((e): e is Range => !!e))
      .reduce(reduceRanges, <Range>{});
  }
  visitGraceGroupExpr(expr: Grace_group): Range {
    let res = expr.notes.map(e => (e.accept(this)))
      .reduce(reduceRanges, <Range>{});
    /**
     * Since Grace Group's curlies are not saved in tree, accomodate for them here
     */
    res.start.character -= 1;
    res.end.character += 1;
    /**
     * handle accacciatura by adding a character to the end
     */
    if (expr.isAccacciatura) {
      res.start.character -= 1;
    }
    return res;
  }
  visitInfoLineExpr(expr: Info_line): Range {
    return expr.value.map(t => (getTokenRange(t)))
      .concat([getTokenRange(expr.key)].filter((e): e is Range => !!e))
      .reduce(reduceRanges, <Range>{});
  }
  visitInlineFieldExpr(expr: Inline_field): Range {
    return expr.text.map(t => (getTokenRange(t)))
      .concat([getTokenRange(expr.field)].filter((e): e is Range => !!e))
      .reduce(reduceRanges, <Range>{});
  }
  visitLyricSectionExpr(expr: Lyric_section): Range {
    return expr.info_lines.map(e => (e.accept(this)))
      .reduce(reduceRanges, <Range>{});
  }
  visitMultiMeasureRestExpr(expr: MultiMeasureRest): Range {
    return [expr.rest]
      .concat([expr.length].filter((e): e is Token => !!e))
      .map(t => (getTokenRange(t)))
      .reduce(reduceRanges, <Range>{});
  }
  visitMusicCodeExpr(expr: Music_code): Range {
    return expr.contents.map((e) => {
      if (isToken(e)) {
        return getTokenRange(e);
      } else {
        return e.accept(this);
      }
    }).reduce(reduceRanges, <Range>{});
  }
  visitNoteExpr(expr: Note): Range {
    const {
      pitch,
      rhythm,
      tie,
    } = expr;
    // TODO accomodate tie
    return [pitch, rhythm]
      .filter((e): e is Pitch | Rest | Rhythm => (!!e)).map((e) => {
        if (isToken(e)) {
          return getTokenRange(e);
        } else {
          return e.accept(this);
        }
      }).reduce(reduceRanges, <Range>{});
  }
  visitNthRepeatExpr(expr: Nth_repeat): Range {
    return getTokenRange(expr.repeat);
  }
  visitPitchExpr(expr: Pitch): Range {
    const {
      alteration,
      noteLetter,
      octave,
    } = expr;
    return [alteration, noteLetter, octave]
      .filter((e): e is Token => !!e)
      .map((e) => (getTokenRange(e)))
      .reduce(reduceRanges, <Range>{});
  }
  visitRestExpr(expr: Rest): Range {
    return getTokenRange(expr.rest);
  }
  visitRhythmExpr(expr: Rhythm): Range {
    const { numerator, separator, denominator, broken } = expr;
    return [numerator, separator, denominator, broken]
      .filter((e): e is Token => !!e)
      .map((e) => (getTokenRange(e)))
      .reduce(reduceRanges, <Range>{});
  }
  visitSymbolExpr(expr: Symbol): Range {
    return getTokenRange(expr.symbol);
  }
  visitTuneBodyExpr(expr: Tune_Body): Range {
    return expr.sequence.map((e) => {
      return e.map(expr => {
        if (isToken(expr)) {
          return getTokenRange(expr);
        } else {
          return expr.accept(this);
        }
      }).reduce(reduceRanges, <Range>{});
    }).reduce(reduceRanges, <Range>{});
  }
  visitTuneExpr(expr: Tune): Range {
    const { tune_header, tune_body } = expr;
    return [tune_header.accept(this), tune_body?.accept(this)]
      .filter((e): e is Range => !!e)
      .reduce(reduceRanges, <Range>{});
  }
  visitTuneHeaderExpr(expr: Tune_header): Range {
    return expr.info_lines.map(e => (e.accept(this)))
      .reduce(reduceRanges, <Range>{});
  }
  visitVoiceOverlayExpr(expr: Voice_overlay): Range {
    return expr.contents
      .map(e => (getTokenRange(e)))
      .reduce(reduceRanges, <Range>{});
  }
  visitYSpacerExpr(expr: YSPACER): Range {
    return [expr.ySpacer, expr.number].filter((e): e is Token => !!e)
      .map(e => (getTokenRange(e)))
      .reduce(reduceRanges, <Range>{});
  }
  visitBeamExpr(expr: Beam): Range {
    return expr.contents.map((e) => {
      if (isToken(e)) {
        return getTokenRange(e);
      } else {
        return e.accept(this);
      }
    }).reduce(reduceRanges, <Range>{});
  }
  visitTupletExpr(expr: Tuplet) {
    let { p, q, r } = expr;
    return [p, q, r]
      .filter((e): e is Token => !!e)
      .map(e => (getTokenRange(e)))
      .reduce(reduceRanges, <Range>{});
  }

}
