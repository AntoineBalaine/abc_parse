import { getTokenRange, isNote, isToken, reduceRanges } from "../helpers";
import { Token } from "../parsers/scan2";
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
  Note,
  Pitch,
  Rational,
  SystemBreak,
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

/**
 * Use this visitor to figure out the {@link Range} of a given expr.
 * {@link Range} being: start line and character `Position`, end line and character `Position`.
 */
export class RangeVisitor implements Visitor<Range> {
  constructor() {}
  visitToken(token: Token): Range {
    return getTokenRange(token);
  }
  visitAnnotationExpr(expr: Annotation): Range {
    return getTokenRange(expr.text);
  }
  visitDirectiveExpr(expr: Directive): Range {
    return [expr.key, expr.values]
      .flatMap((e) => e)
      .filter((e): e is Token | Annotation | Rational | Pitch | KV | Measurement => !!e)
      .map((e) => e.accept(this))
      .reduce(reduceRanges, <Range>{});
  }
  visitBarLineExpr(expr: BarLine): Range {
    return [expr.barline, expr.repeatNumbers]
      .filter((e): e is Token[] => !!e)
      .flatMap((e) => e)
      .map((e) => getTokenRange(e))
      .reduce(reduceRanges, <Range>{});
  }

  visitChordExpr(expr: Chord): Range {
    return expr.contents
      .map((e) => {
        if (isToken(e)) {
          return getTokenRange(e);
        } else {
          return e.accept(this);
        }
      })
      .reduce(reduceRanges, <Range>{});
  }
  visitCommentExpr(expr: Comment): Range {
    return getTokenRange(expr.token);
  }
  visitDecorationExpr(expr: Decoration): Range {
    return getTokenRange(expr.decoration);
  }
  visitSystemBreakExpr(expr: SystemBreak): Range {
    return getTokenRange(expr.symbol);
  }
  visitFileHeaderExpr(expr: File_header): Range {
    return expr.contents
      .map((e) => {
        if (isToken(e)) return getTokenRange(e);
        return e.accept(this);
      })
      .reduce(reduceRanges, <Range>{});
  }
  visitFileStructureExpr(expr: File_structure): Range {
    const { file_header, contents } = expr;
    return contents
      .map((t) => t.accept(this))
      .concat([file_header?.accept(this)].filter((e): e is Range => !!e))
      .reduce(reduceRanges, <Range>{});
  }
  visitGraceGroupExpr(expr: Grace_group): Range {
    const res = expr.notes
      .map((e) => {
        if (isNote(e)) {
          return e.accept(this);
        } else {
          return getTokenRange(e);
        }
      })
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
    return expr.value
      .map((t) => getTokenRange(t))
      .concat([getTokenRange(expr.key)].filter((e): e is Range => !!e))
      .reduce(reduceRanges, <Range>{});
  }
  visitInlineFieldExpr(expr: Inline_field): Range {
    return expr.text
      .map((t) => getTokenRange(t))
      .concat([getTokenRange(expr.field)].filter((e): e is Range => !!e))
      .reduce(reduceRanges, <Range>{});
  }
  visitLyricSectionExpr(expr: Lyric_section): Range {
    return expr.info_lines.map((e) => e.accept(this)).reduce(reduceRanges, <Range>{});
  }
  visitMultiMeasureRestExpr(expr: MultiMeasureRest): Range {
    return [expr.rest]
      .concat([expr.length].filter((e): e is Token => !!e))
      .map((t) => getTokenRange(t))
      .reduce(reduceRanges, <Range>{});
  }
  visitMusicCodeExpr(expr: Music_code): Range {
    return expr.contents
      .map((e) => {
        if (isToken(e)) {
          return getTokenRange(e);
        } else {
          return e.accept(this);
        }
      })
      .reduce(reduceRanges, <Range>{});
  }
  visitNoteExpr(expr: Note): Range {
    const { pitch, rhythm, tie } = expr;
    // TODO accomodate tie
    return [pitch, rhythm]
      .filter((e): e is Pitch | Rest | Rhythm => !!e)
      .map((e) => {
        if (isToken(e)) {
          return getTokenRange(e);
        } else {
          return e.accept(this);
        }
      })
      .reduce(reduceRanges, <Range>{});
  }
  visitPitchExpr(expr: Pitch): Range {
    const { alteration, noteLetter, octave } = expr;
    return [alteration, noteLetter, octave]
      .filter((e): e is Token => !!e)
      .map((e) => getTokenRange(e))
      .reduce(reduceRanges, <Range>{});
  }
  visitRestExpr(expr: Rest): Range {
    return getTokenRange(expr.rest);
  }
  visitRhythmExpr(expr: Rhythm): Range {
    const { numerator, separator, denominator, broken } = expr;
    return [numerator, separator, denominator, broken]
      .filter((e): e is Token => !!e)
      .map((e) => getTokenRange(e))
      .reduce(reduceRanges, <Range>{});
  }
  visitSymbolExpr(expr: Symbol): Range {
    return getTokenRange(expr.symbol);
  }
  visitTuneBodyExpr(expr: Tune_Body): Range {
    return expr.sequence
      .map((e) => {
        return e
          .map((expr) => {
            if (isToken(expr)) {
              return getTokenRange(expr);
            } else {
              return expr.accept(this);
            }
          })
          .reduce(reduceRanges, <Range>{});
      })
      .reduce(reduceRanges, <Range>{});
  }
  visitTuneExpr(expr: Tune): Range {
    const { tune_header, tune_body } = expr;
    return [tune_header.accept(this), tune_body?.accept(this)].filter((e): e is Range => !!e).reduce(reduceRanges, <Range>{});
  }
  visitTuneHeaderExpr(expr: Tune_header): Range {
    return expr.info_lines.map((e) => e.accept(this)).reduce(reduceRanges, <Range>{});
  }
  visitVoiceOverlayExpr(expr: Voice_overlay): Range {
    return expr.contents.map((e) => getTokenRange(e)).reduce(reduceRanges, <Range>{});
  }
  visitLineContinuationExpr(expr: Line_continuation): Range {
    return getTokenRange(expr.token);
  }
  visitYSpacerExpr(expr: YSPACER): Range {
    return [expr.ySpacer, expr.rhythm]
      .filter((e): e is Token => !!e)
      .map((e) => getTokenRange(e))
      .reduce(reduceRanges, <Range>{});
  }
  visitBeamExpr(expr: Beam): Range {
    return expr.contents
      .map((e) => {
        if (isToken(e)) {
          return getTokenRange(e);
        } else {
          return e.accept(this);
        }
      })
      .reduce(reduceRanges, <Range>{});
  }
  visitTupletExpr(expr: Tuplet) {
    const { p, q, r } = expr;
    return [p, q, r]
      .filter((e): e is Token => !!e)
      .map((e) => getTokenRange(e))
      .reduce(reduceRanges, <Range>{});
  }

  visitErrorExpr(expr: ErrorExpr) {
    return expr.tokens.map((e) => getTokenRange(e)).reduce(reduceRanges, <Range>{});
  }

  visitLyricLineExpr(expr: Lyric_line): Range {
    const headerRange = getTokenRange(expr.header);
    const contentsRanges = expr.contents.map((token) => getTokenRange(token));
    return [headerRange, ...contentsRanges].reduce(reduceRanges, <Range>{});
  }

  visitMacroDeclExpr(expr: Macro_decl): Range {
    return [getTokenRange(expr.header), getTokenRange(expr.variable), getTokenRange(expr.content)].reduce(reduceRanges, <Range>{});
  }

  visitMacroInvocationExpr(expr: Macro_invocation): Range {
    return getTokenRange(expr.variable);
  }

  visitUserSymbolDeclExpr(expr: User_symbol_decl): Range {
    return [getTokenRange(expr.header), getTokenRange(expr.variable), getTokenRange(expr.symbol)].reduce(reduceRanges, <Range>{});
  }

  visitUserSymbolInvocationExpr(expr: User_symbol_invocation): Range {
    return getTokenRange(expr.variable);
  }

  // New expression visitor methods for unified info line parsing
  visitKV(expr: KV): Range {
    // Handle value which can be Token or Expr
    const valueRange = expr.value instanceof Token ? getTokenRange(expr.value) : expr.value.accept(this);
    const ranges = [valueRange];

    if (expr.key) {
      if (expr.key instanceof AbsolutePitch) {
        ranges.push(expr.key.accept(this));
      } else {
        ranges.push(getTokenRange(expr.key));
      }
    }
    if (expr.equals) {
      ranges.push(getTokenRange(expr.equals));
    }
    return ranges.reduce(reduceRanges, <Range>{});
  }

  visitBinary(expr: Binary): Range {
    const leftRange = expr.left instanceof Token ? getTokenRange(expr.left) : expr.left.accept(this);
    const rightRange = expr.right instanceof Token ? getTokenRange(expr.right) : expr.right.accept(this);
    return [leftRange, getTokenRange(expr.operator), rightRange].reduce(reduceRanges, <Range>{});
  }

  visitGrouping(expr: Grouping): Range {
    return expr.expression.accept(this);
  }

  visitAbsolutePitch(expr: AbsolutePitch): Range {
    const ranges = [getTokenRange(expr.noteLetter)];
    if (expr.alteration) {
      ranges.push(getTokenRange(expr.alteration));
    }
    if (expr.octave) {
      ranges.push(getTokenRange(expr.octave));
    }
    return ranges.reduce(reduceRanges, <Range>{});
  }

  visitRationalExpr(expr: Rational): Range {
    return [getTokenRange(expr.numerator), getTokenRange(expr.separator), getTokenRange(expr.denominator)].reduce(reduceRanges, <Range>{});
  }

  visitMeasurementExpr(expr: Measurement): Range {
    return [getTokenRange(expr.value), getTokenRange(expr.scale)].reduce(reduceRanges, <Range>{});
  }

  visitUnary(expr: import("../types/Expr2").Unary): Range {
    const operatorRange = getTokenRange(expr.operator);
    const operandRange = expr.operand instanceof Token ? getTokenRange(expr.operand) : expr.operand.accept(this);
    return [operatorRange, operandRange].reduce(reduceRanges, <Range>{});
  }
}
