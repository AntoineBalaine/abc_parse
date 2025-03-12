import { isNote, isToken } from "../helpers2";
import { ABCContext } from "../parsers/Context";
import {
  Annotation,
  BarLine,
  Beam,
  Chord,
  Comment,
  Decoration,
  Expr,
  Grace_group,
  Info_line,
  Inline_field,
  MultiMeasureRest,
  Note,
  Pitch,
  Rest,
  Rhythm,
  Symbol,
  System,
  Tune,
  Tune_Body,
  Tune_header,
  Tuplet,
  YSPACER,
  tune_body_code,
} from "../types/Expr2";
import { Token } from "../parsers/scan2";
import { SystemAligner2 } from "./fmt2/fmt_aligner";
import { resolveRules } from "./fmt2/fmt_rules_assignment";

/**
 * A pretty printer for a score's AST.
 * Exposes two main functions:
 *
 * `stringify()` will return the AST as written by the composer,
 * `format()` will apply formatting to the score,
 * by adding spaces between expressions, and aligning barlines within a multi-voices system.
 *
 * eg:
 * ```typescript
 * const ast = parseTune(Scanner2(source), new ABCContext());
 * const fmt: string = new AbcFormatter2(new ABCContext()).format(ast);
 * ```
 */
export class AbcFormatter2 {
  ctx: ABCContext;
  constructor(ctx: ABCContext) {
    this.ctx = ctx;
  }
  /**
   * use this flag to indicate if we just want to stringify the tree, without pretty-printing
   */
  no_format: boolean = false;
  format(ast: Tune): string {
    this.no_format = false;
    // 1. Rules resolution phase
    let withRules = resolveRules(ast, this.ctx);

    // 2. align multi-voices tunes
    let alignedTune = new SystemAligner2(this.ctx, this).alignTune(withRules);

    // 3. Print using visitor
    return this.stringify(alignedTune);
  }

  stringify(expr: Expr | Token): string {
    this.no_format = true;
    let fmt = "";
    if (isToken(expr)) {
      fmt = expr.lexeme;
    } else {
      fmt = this.visitExpr(expr);
    }
    this.no_format = false;
    return fmt;
  }

  visitExpr(expr: Expr): string {
    if (expr instanceof Annotation) {
      return this.visitAnnotationExpr(expr);
    } else if (expr instanceof BarLine) {
      return this.visitBarLineExpr(expr);
    } else if (expr instanceof Beam) {
      return this.visitBeamExpr(expr);
    } else if (expr instanceof Chord) {
      return this.visitChordExpr(expr);
    } else if (expr instanceof Comment) {
      return this.visitCommentExpr(expr);
    } else if (expr instanceof Decoration) {
      return this.visitDecorationExpr(expr);
    } else if (expr instanceof Grace_group) {
      return this.visitGraceGroupExpr(expr);
    } else if (expr instanceof Info_line) {
      return this.visitInfoLineExpr(expr);
    } else if (expr instanceof Inline_field) {
      return this.visitInlineFieldExpr(expr);
    } else if (expr instanceof MultiMeasureRest) {
      return this.visitMultiMeasureRestExpr(expr);
    } else if (expr instanceof Note) {
      return this.visitNoteExpr(expr);
    } else if (expr instanceof Pitch) {
      return this.visitPitchExpr(expr);
    } else if (expr instanceof Rest) {
      return this.visitRestExpr(expr);
    } else if (expr instanceof Rhythm) {
      return this.visitRhythmExpr(expr);
    } else if (expr instanceof Symbol) {
      return this.visitSymbolExpr(expr);
    } else if (expr instanceof Tune_Body) {
      return this.visitTuneBodyExpr(expr);
    } else if (expr instanceof Tune) {
      return this.visitTuneExpr(expr);
    } else if (expr instanceof Tune_header) {
      return this.visitTuneHeaderExpr(expr);
    } else if (expr instanceof Tuplet) {
      return this.visitTupletExpr(expr);
    } else if (expr instanceof YSPACER) {
      return this.visitYSpacerExpr(expr);
    } else {
      return ""; // Default case
    }
  }

  visitAnnotationExpr(expr: Annotation): string {
    return expr.text.lexeme;
  }

  visitBarLineExpr(expr: BarLine): string {
    return [expr.barline, expr.repeatNumbers]
      .filter((e): e is Token[] => !!e)
      .flatMap((e) => e)
      .map((e) => e.lexeme)
      .join("");
  }

  visitBeamExpr(expr: Beam): string {
    let fmt = expr.contents
      .map((content) => {
        if (isToken(content)) {
          return content.lexeme;
        } else {
          return this.visitExpr(content);
        }
      })
      .join("");
    return fmt;
  }

  visitChordExpr(expr: Chord): string {
    const str = expr.contents
      .map((content): string => {
        if (isToken(content)) {
          return content.lexeme;
        } else if (content instanceof Note) {
          return this.visitNoteExpr(content);
        } else if (content instanceof Annotation) {
          return this.visitAnnotationExpr(content);
        } else {
          return "";
        }
      })
      .join("");

    let rhythm: string = "";
    let tie: string = "";
    if (expr.rhythm) {
      rhythm = this.visitRhythmExpr(expr.rhythm);
    }
    if (expr.tie) {
      tie = expr.tie.lexeme;
    }
    return `[${str}]${rhythm}${tie}`;
  }

  visitCommentExpr(expr: Comment): string {
    return expr.token.lexeme;
  }

  visitDecorationExpr(expr: Decoration): string {
    return expr.decoration.lexeme;
  }

  visitGraceGroupExpr(expr: Grace_group): string {
    const fmt = expr.notes
      .map((note) => {
        if (isNote(note)) {
          return this.visitNoteExpr(note);
        } else {
          return note.lexeme;
        }
      })
      .join("");
    // TODO implement accaciatura formatting
    if (expr.isAccacciatura) {
      return `{/${fmt}}`;
    } else {
      return `{${fmt}}`;
    }
  }

  visitInfoLineExpr(expr: Info_line): string {
    const { key, value } = expr;
    const formattedVal = value.map((val) => val.lexeme).join("");
    return `${key.lexeme}${formattedVal}`;
  }

  visitInlineFieldExpr(expr: Inline_field): string {
    const { field, text } = expr;
    const formattedText = text.map((val) => val.lexeme).join("");
    return `[${field.lexeme}${formattedText}]`;
  }

  visitMultiMeasureRestExpr(expr: MultiMeasureRest): string {
    return `${expr.rest.lexeme}${expr.length ? expr.length.lexeme : ""}`;
  }

  visitNoteExpr(expr: Note): string {
    let formattedNote = "";
    if (expr.pitch instanceof Pitch) {
      formattedNote += this.visitPitchExpr(expr.pitch);
    } else if (expr.pitch instanceof Rest) {
      formattedNote += this.visitRestExpr(expr.pitch);
    }
    if (expr.rhythm) {
      formattedNote += this.visitRhythmExpr(expr.rhythm);
    }
    if (expr.tie) {
      formattedNote += expr.tie.lexeme;
    }
    return formattedNote;
  }

  visitPitchExpr(expr: Pitch): string {
    let formatted = "";
    if (expr.alteration) {
      formatted += expr.alteration.lexeme;
    }
    formatted += expr.noteLetter.lexeme;
    if (expr.octave) {
      formatted += expr.octave.lexeme;
    }
    return formatted;
  }

  visitRestExpr(expr: Rest): string {
    return expr.rest.lexeme;
  }

  visitRhythmExpr(expr: Rhythm): string {
    let formatted = "";
    if (this.no_format) {
      const { numerator, separator, denominator, broken } = expr;
      return [numerator, separator, denominator, broken].map((e) => e?.lexeme || "").join("");
    }
    if (expr.numerator) {
      formatted += expr.numerator.lexeme;
    }
    if (expr.separator) {
      // in case we have expr like <pitch>///
      if (expr.separator.lexeme.length > 1 && !expr.denominator) {
        // count the separators.
        const numDivisions = expr.separator.lexeme.length;
        let count = 1;
        for (let i = 0; i < numDivisions; i++) {
          count = count * 2;
        }
        formatted += `/${count}`;
      } else if (expr.separator.lexeme === "/" && expr.denominator && expr.denominator.lexeme === "2") {
        formatted += "/";
      } else {
        // for now, don't handle mix of multiple slashes and a denominator
        formatted += expr.separator.lexeme;
      }
    }
    if (expr.denominator) {
      formatted += expr.denominator.lexeme;
    }
    if (expr.broken) {
      formatted += expr.broken.lexeme;
    }
    return formatted;
  }

  visitSymbolExpr(expr: Symbol): string {
    return `${expr.symbol.lexeme}`;
  }

  visitTuneBodyExpr(expr: Tune_Body): string {
    return expr.sequence
      .map((system) => {
        return system
          .map((node) => {
            if (isToken(node)) {
              return node.lexeme;
            } else {
              return this.visitExpr(node);
            }
          })
          .join("");
      })
      .join("");
  }

  visitTuneExpr(expr: Tune): string {
    let formatted = "";
    formatted += this.visitTuneHeaderExpr(expr.tune_header);
    if (expr.tune_body) {
      formatted += this.visitTuneBodyExpr(expr.tune_body);
    }
    return formatted;
  }

  visitTuneHeaderExpr(expr: Tune_header): string {
    const info_lines = expr.info_lines.map((infoLine): string => {
      let rv = "";
      if (infoLine instanceof Comment) {
        rv = this.visitCommentExpr(infoLine);
      } else if (infoLine instanceof Info_line) {
        rv = this.visitInfoLineExpr(infoLine);
      } else {
        rv = this.visitExpr(infoLine);
      }
      rv += "\n";
      return rv;
    });
    return info_lines.join("");
  }

  visitYSpacerExpr(expr: YSPACER): string {
    let formatted = expr.ySpacer.lexeme;
    if (expr.rhythm) {
      formatted += this.visitRhythmExpr(expr.rhythm);
    }
    return formatted;
  }

  visitTupletExpr(expr: Tuplet): string {
    return expr.p.lexeme;
  }
}
