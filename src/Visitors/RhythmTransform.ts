import {
  cloneToken,
  exprIsInRange,
  getPitchRange,
  getTokenRange,
  isChord,
  isEmptyRhythm,
  isNote,
  isRhythmInRange,
  isToken,
  isTune_Body,
} from "../helpers";
import { ABCContext } from "../parsers/Context";
import { Token, TT as TokenType } from "../parsers/scan2";
import {
  Annotation,
  BarLine,
  Beam,
  Beam_contents,
  Chord,
  Comment,
  Decoration,
  Directive,
  ErrorExpr,
  Expr,
  File_header,
  File_structure,
  Grace_group,
  Info_line,
  Inline_field,
  Lyric_section,
  MultiMeasureRest,
  Music_code,
  music_code,
  Note,
  Pitch,
  Rest,
  Rhythm,
  Symbol,
  Tune,
  Tune_Body,
  tune_body_code,
  Tune_header,
  Tuplet,
  Visitor,
  Voice_overlay,
  YSPACER,
} from "../types/Expr2";
import { Range } from "../types/types";
import { createRational, divideRational, multiplyRational, Rational } from "./fmt2/rational";
import { AbcFormatter2 as AbcFormatter } from "./Formatter2";
import { ExpressionCollector } from "./RangeCollector";
import { RangeVisitor } from "./RangeVisitor";

/**
 * Use this visitor to divide or multiply rhythms in a score.
 *
 * eg:
 * ```typescript
 * const source = `X:1\nabc`
 * const ast = new Parser(new Scanner(source).scanTokens()).parse();
 * const result = new RhythmVisitor(ast, ctx).transform("/");
 * // will yield `X:1\na/b/c/`
 * ```
 * `transform()` can take either `*` or `/`, respectively to multiply or divide rhythms by two.
 * In the context of editing a score, you might request that
 * only a selected portion of the source text be transformed,
 * by passing a `Range` object to `transform()`.
 * ```typescript
 * const range = {
 *  start: { line: 0, character: 0 },
 *  end: { line: 0, character: 5 }
 * }
 * const result = new RhythmVisitor(ast, ctx).transform("/", range);
 * ```
 */
export class RhythmVisitor implements Visitor<Expr> {
  private source: Expr;
  private factor?: "*" | "/";
  private range?: Range;
  private collectedExpressions: Array<Expr | Token> = [];
  ctx: ABCContext;
  rangeVisitor: RangeVisitor;

  constructor(source: Expr, ctx: ABCContext) {
    this.ctx = ctx;
    this.source = source;

    this.rangeVisitor = new RangeVisitor(this.ctx);
  }

  visitToken(token: Token): Token {
    return token;
  }

  transform(factor: "*" | "/", range?: Range) {
    this.factor = factor;

    const formatter = new AbcFormatter(this.ctx);
    if (range) {
      this.range = range;

      // Collect expressions in the specified range
      const collector = new ExpressionCollector(this.ctx, this.range);
      this.source.accept(collector);
      this.collectedExpressions = collector.getCollectedExpressions();

      // Apply transformations to the AST
      this.source.accept(this);

      // Format only the collected expressions
      return this.collectedExpressions.map((e) => e.accept(formatter)).join("");
    } else {
      this.collectedExpressions = [];
      this.source.accept(this);
      return this.source.accept(formatter);
    }
  }

  /**
   * Get changes for range-based transformations
   * @returns Formatted string of the transformed expressions
   */
  getChanges(): string {
    const formatter = new AbcFormatter(this.ctx);
    if (!this.range) {
      return this.source.accept(formatter);
    }
    return this.collectedExpressions.map((e) => e.accept(formatter)).join("");
  }

  private isInRange(expr: Expr | Token) {
    if (!this.range) return true;
    let exprRange: Range;
    if (isToken(expr)) {
      exprRange = getTokenRange(expr);
    } else {
      exprRange = expr.accept(this.rangeVisitor);
    }
    return exprIsInRange(this.range, exprRange);
  }

  visitAnnotationExpr(expr: Annotation): Annotation {
    return expr;
  }

  visitBarLineExpr(expr: BarLine): Expr {
    // FIXME - return type should be BarLine
    return expr;
  }

  visitChordExpr(expr: Chord): Chord {
    if (!isChord(expr)) {
      return expr;
    }

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

    return expr;
  }

  visitCommentExpr(expr: Comment): Comment {
    return expr;
  }

  visitDirectiveExpr(expr: Directive): Expr {
    return expr;
  }

  visitDecorationExpr(expr: Decoration): Decoration {
    return expr;
  }

  visitFileHeaderExpr(expr: File_header): File_header {
    return expr;
  }

  visitFileStructureExpr(expr: File_structure): File_structure {
    expr.contents = expr.contents.map((tune) => {
      return tune.accept(this);
    }) as Tune[];
    return expr;
  }

  visitGraceGroupExpr(expr: Grace_group): Grace_group {
    expr.notes = expr.notes.map((e) => {
      if (isNote(e)) {
        return e.accept(this) as Note;
      } else {
        return e;
      }
    });
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
    expr.contents = expr.contents.map((e) => {
      if (isToken(e)) {
        return e;
      } else {
        return e.accept(this);
      }
    }) as Array<music_code>;
    return expr;
  }

  /**
   * Transform the rhythm of a note if it's in the specified range
   */
  visitNoteExpr(expr: Note): Note {
    const isInRange = this.isInRange(expr);

    // Apply rhythm transformation if in range
    if (isInRange && this.factor) {
      if (expr.rhythm) {
        expr.rhythm = this.visitRhythmExpr(expr.rhythm);
      } else {
        // If no rhythm is specified, add one based on the factor
        if (this.factor === "*") {
          expr.rhythm = new Rhythm(this.ctx.generateId(), new Token(TokenType.RHY_NUMER, "2", this.ctx.generateId()));
        } else {
          expr.rhythm = new Rhythm(this.ctx.generateId(), new Token(TokenType.RHY_SEP, "/", this.ctx.generateId()));
        }
      }

      // Remove empty rhythms
      if (expr.rhythm && isEmptyRhythm(expr.rhythm)) {
        expr.rhythm = undefined;
      }

      // Sync token positions
      this.syncTokenPositions(expr);
    }

    return expr;
  }

  /**
   * When rhythms get updated, the positions of their tokens might be inaccurate.
   * To avoid this pitfall, take the position of each of their pitch,
   * update all the token positions
   */
  private syncTokenPositions(expr: Note) {
    let { end } = getPitchRange(expr.pitch);
    let { line, character } = end;
    if (!expr.rhythm) {
      return expr;
    }
    const { numerator, separator, denominator, broken } = expr.rhythm;
    const mapped = [numerator, separator, denominator, broken].map((e) => {
      if (!e) {
        return e;
      }
      e.line = line;
      e.position = character + 1;
      character = character + e.lexeme.length;
      return cloneToken(e, this.ctx);
    });
    mapped.forEach((e, index): void | Expr | Token | null | undefined => {
      if (!e || !expr.rhythm) {
        return e;
      }
      switch (index) {
        case 0:
          return (expr.rhythm.numerator = e);
        case 1:
          return (expr.rhythm.separator = e);
        case 2:
          return (expr.rhythm.denominator = e);
        case 3:
          return (expr.rhythm.broken = e);
      }
    });
    return expr;
  }

  visitPitchExpr(expr: Pitch): Pitch {
    return expr;
  }

  visitRestExpr(expr: Rest): Rest {
    return expr;
  }

  /**
   * Transform a rhythm by multiplying or dividing it by 2
   */
  visitRhythmExpr(expr: Rhythm): Rhythm {
    if (!this.factor) {
      return expr;
    }

    // Apply transformation if in range
    if ((this.range && isRhythmInRange(this.range, expr)) || !this.range) {
      if (this.factor === "*") {
        expr = this.duplicateLength(expr);
      } else {
        expr = this.divideLength(expr);
      }
    }

    return expr;
  }

  visitSymbolExpr(expr: Symbol): Symbol {
    return expr;
  }

  visitTuneBodyExpr(expr: Tune_Body): Tune_Body {
    if (!isTune_Body(expr)) {
      return expr;
    }

    expr.sequence = expr.sequence.map((e) => {
      return e.map((exp) => {
        if (isToken(exp)) {
          return exp;
        } else {
          return exp.accept(this) as tune_body_code;
        }
      });
    });

    return expr;
  }

  visitTuneExpr(expr: Tune): Tune {
    if (expr.tune_body) {
      expr.tune_body = expr.tune_body.accept(this) as Tune_Body;
    }
    return expr;
  }

  visitTuneHeaderExpr(expr: Tune_header): Tune_header {
    return expr;
  }

  visitVoiceOverlayExpr(expr: Voice_overlay): Voice_overlay {
    return expr;
  }

  visitYSpacerExpr(expr: YSPACER): YSPACER {
    return expr;
  }

  visitBeamExpr(expr: Beam): Beam {
    expr.contents = expr.contents.map((content) => {
      if (isToken(content)) {
        return content;
      } else {
        return content.accept(this);
      }
    }) as Array<Beam_contents>;

    return expr;
  }

  visitTupletExpr(expr: Tuplet) {
    return expr;
  }

  visitErrorExpr(expr: ErrorExpr) {
    return expr;
  }

  /**
   * Convert a rhythm expression to a rational number
   */
  private rhythmToRational(expr: Rhythm): Rational {
    let numerator = 1;
    let denominator = 1;

    // Handle numerator
    if (expr.numerator) {
      numerator = parseInt(expr.numerator.lexeme);
    }

    // Handle separator and denominator
    if (expr.separator) {
      const slashCount = expr.separator.lexeme.length;
      let slashDenominator = Math.pow(2, slashCount);

      if (expr.denominator) {
        denominator = parseInt(expr.denominator.lexeme) * slashDenominator;
      } else {
        denominator = slashDenominator;
      }
    }

    return createRational(numerator, denominator);
  }

  /**
   * Convert a rational number back to a rhythm expression
   */
  private rationalToRhythm(rational: Rational, expr: Rhythm): Rhythm {
    // Simplify the rational number
    const { numerator, denominator } = rational;

    // Clear existing rhythm tokens
    expr.numerator = undefined;
    expr.separator = undefined;
    expr.denominator = undefined;

    if (denominator === 1) {
      // Whole number rhythm (e.g., 2, 4)
      if (numerator !== 1) {
        expr.numerator = new Token(TokenType.RHY_NUMER, numerator.toString(), this.ctx.generateId());
      }
    } else {
      // Fraction rhythm
      if (numerator !== 1) {
        expr.numerator = new Token(TokenType.RHY_NUMER, numerator.toString(), this.ctx.generateId());
      }

      // Check if denominator is a power of 2
      let slashCount = 0;
      let remainingDenominator = denominator;

      while (remainingDenominator % 2 === 0 && remainingDenominator > 1) {
        slashCount++;
        remainingDenominator /= 2;
      }

      if (slashCount > 0) {
        expr.separator = new Token(TokenType.RHY_SEP, "/".repeat(slashCount), this.ctx.generateId());
      }

      if (remainingDenominator > 1) {
        expr.denominator = new Token(TokenType.RHY_NUMER, remainingDenominator.toString(), this.ctx.generateId());
      }
    }

    return expr;
  }

  /**
   * Multiply a rhythm by 2
   */
  private duplicateLength(expr: Rhythm): Rhythm {
    // Convert to rational
    const rational = this.rhythmToRational(expr);

    // Multiply by 2
    const multiplied = multiplyRational(rational, createRational(2, 1));

    // Convert back to rhythm
    return this.rationalToRhythm(multiplied, expr);
  }

  /**
   * Divide a rhythm by 2
   */
  private divideLength(expr: Rhythm): Rhythm {
    // Convert to rational
    const rational = this.rhythmToRational(expr);

    // Divide by 2
    const divided = divideRational(rational, createRational(2, 1));

    // Convert back to rhythm
    return this.rationalToRhythm(divided, expr);
  }
}
