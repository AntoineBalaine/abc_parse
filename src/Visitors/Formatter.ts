import { isToken } from "../helpers";
import { ABCContext } from "../parsers/Context";
import {
  Annotation,
  BarLine,
  Beam,
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
  ErrorExpr,
} from "../types/Expr";
import { Token } from "../types/token";
import { SystemAligner } from "./fmt/fmt_aligner";
import { resolveRules } from "./fmt/fmt_rules_assignment";

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
 * const ast = new Parser(new Scanner(source).scanTokens()).parse()
 * const fmt: string = new AbcFormatter().format(ast);
 * ```
 */
export class AbcFormatter implements Visitor<string> {
  ctx: ABCContext;
  constructor(ctx: ABCContext) {
    this.ctx = ctx;
  }
  /**
   * use this flag to indicate if we just want to stringify the tree, without pretty-printing
   */
  no_format: boolean = false;
  format(ast: File_structure): string {
    this.no_format = false;
    // 1. Rules resolution phase
    let withRules = resolveRules(ast, this.ctx);

    // 2. align multi-voices tunes
    withRules.tune = withRules.tune.map((tune) => new SystemAligner(this.ctx, this).alignTune(tune));

    // 3. Print using visitor
    return this.stringify(withRules);
  }

  stringify(expr: Expr | Token) {
    this.no_format = true;
    const fmt = isToken(expr) ? expr.lexeme : expr.accept(this);
    this.no_format = false;
    return fmt;
  }
  visitAnnotationExpr(expr: Annotation) {
    return expr.text.lexeme;
  }
  visitBarLineExpr(expr: BarLine) {
    return expr.barline.lexeme;
  }
  visitBeamExpr(expr: Beam): string {
    let fmt = expr.contents
      .map((content) => {
        if (content instanceof Token) {
          return content.lexeme;
        } else {
          return content.accept(this);
        }
      })
      .join("");
    return fmt;
  }
  visitChordExpr(expr: Chord): string {
    const str = expr.contents
      .map((content): string => {
        if (content instanceof Token) {
          return content.lexeme;
        } else {
          return content.accept(this);
        }
      })
      .join("");

    let rhythm: string = "";
    let tie: string = "";
    if (expr.rhythm) {
      rhythm = expr.rhythm.accept(this);
    }
    if (expr.tie) {
      tie = expr.tie.lexeme;
    }
    return `[${str}]${rhythm}${tie}`;
  }
  visitCommentExpr(expr: Comment) {
    return expr.text;
  }
  visitDecorationExpr(expr: Decoration) {
    return expr.decoration.lexeme;
  }
  visitFileHeaderExpr(expr: File_header) {
    //TODO should I return tokens here as well?
    return expr.text;
  }
  visitFileStructureExpr(expr: File_structure) {
    let formattedFile = "";
    if (expr.file_header) {
      formattedFile += expr.file_header.accept(this);
    }
    const formattedTunes = expr.tune.map((tune): string => {
      return tune.accept(this);
    });
    return formattedFile + formattedTunes.join(formattedFile.length > 0 ? "\n" : "");
  }
  visitGraceGroupExpr(expr: Grace_group): string {
    const fmt = expr.notes
      .map((note) => {
        return note.accept(this);
      })
      .join("");
    // TODO implement accaciatura formatting
    if (expr.isAccacciatura) {
      return `{/${fmt}}`;
    } else {
      return `{${fmt}}`;
    }
  }
  visitInfoLineExpr(expr: Info_line) {
    const { key, value, metadata } = expr;
    const formattedVal = value.map((val) => val.lexeme).join("");

    return `${key.lexeme}${formattedVal}${metadata ?? ""}`;
  }
  visitInlineFieldExpr(expr: Inline_field) {
    // TODO fix Inline_field parsing (numbers causing issue)
    const { field, text } = expr;
    const formattedText = text.map((val) => val.lexeme).join("");
    return `[${field.lexeme}${formattedText}]`;
  }
  visitLyricSectionExpr(expr: Lyric_section) {
    return expr.info_lines
      .map((info_line): string => {
        return info_line.accept(this);
      })
      .join("\n");
  }
  visitMultiMeasureRestExpr(expr: MultiMeasureRest) {
    return `${expr.rest.lexeme}${expr.length ? expr.length.lexeme : ""}`; // TODO do I need the bar lines?
  }
  visitMusicCodeExpr(expr: Music_code): string {
    return expr.contents
      .map((content) => {
        if (content instanceof Token) {
          return content.lexeme;
        } else {
          return content.accept(this);
        }
      })
      .join("");
  }
  visitNoteExpr(expr: Note) {
    let formattedNote = "";
    formattedNote += expr.pitch.accept(this);
    if (expr.rhythm) {
      formattedNote += expr.rhythm.accept(this);
    }
    if (expr.tie) {
      formattedNote += expr.tie.lexeme;
    }
    return formattedNote;
  }
  visitNthRepeatExpr(expr: Nth_repeat) {
    return expr.repeat.lexeme;
  }
  visitPitchExpr(expr: Pitch) {
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
  visitRestExpr(expr: Rest) {
    return expr.rest.lexeme;
  }
  visitRhythmExpr(expr: Rhythm) {
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
        expr.denominator = undefined;
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
  visitSymbolExpr(expr: Symbol) {
    return `${expr.symbol.lexeme}`;
  }
  visitTuneBodyExpr(expr: Tune_Body): string {
    return expr.sequence
      .map((system) => {
        return system.map((node) => (isToken(node) ? node.lexeme : node.accept(this))).join("");
      })
      .join("");
  }
  visitTuneExpr(expr: Tune) {
    let formatted = "";
    formatted += expr.tune_header.accept(this);
    if (expr.tune_body) {
      formatted += expr.tune_body.accept(this);
    }
    return formatted;
  }
  visitTuneHeaderExpr(expr: Tune_header) {
    const info_lines = expr.info_lines.map((infoLine): string => {
      let rv = infoLine.accept(this);
      rv += "\n";
      return rv;
    });
    return info_lines.join("");
  }

  visitVoiceOverlayExpr(expr: Voice_overlay) {
    return expr.contents.map((token): string => token.lexeme).join("");
  }
  visitYSpacerExpr(expr: YSPACER) {
    let formatted = expr.ySpacer.lexeme;
    if (expr.number) {
      formatted += expr.number.lexeme;
    }
    return formatted;
  }
  visitTupletExpr(expr: Tuplet) {
    let { p, q, r } = expr;
    return [p, q, r]
      .filter((e): e is Token => !!e)
      .map((token): string => token.lexeme)
      .join("");
  }
  visitErrorExpr(expr: ErrorExpr): string {
    // Preserve the original text of error nodes
    return expr.tokens.map((t) => t.lexeme).join("");
  }
}
