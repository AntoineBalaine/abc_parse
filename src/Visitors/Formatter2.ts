import { isNote, isToken } from "../helpers2";
import { ABCContext } from "../parsers/Context";
import {
  Annotation,
  BarLine,
  Beam,
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
  Visitor,
  Voice_overlay,
  YSPACER,
  tune_body_code,
} from "../types/Expr2";
import { Token, TT } from "../parsers/scan2";
import { alignTune } from "./fmt2/fmt_aligner";
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
export class AbcFormatter2 implements Visitor<string> {
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
    let alignedTune = alignTune(withRules, this.ctx, this);

    // 3. Print using visitor
    return this.stringify(alignedTune);
  }

  stringify(expr: Expr | Token): string {
    this.no_format = true;

    const fmt = isToken(expr) ? expr.lexeme : expr.accept(this);
    this.no_format = false;
    return fmt;
  }

  visitLyricSectionExpr(expr: Lyric_section) {
    return expr.info_lines
      .map((info_line): string => {
        return info_line.accept(this);
      })
      .join("\n");
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

  visitFileHeaderExpr(expr: File_header) {
    //TODO should I return tokens here as well?
    return expr.text;
  }

  visitDirectiveExpr(expr: Directive): string {
    return expr.token.lexeme;
  }

  visitVoiceOverlayExpr(expr: Voice_overlay) {
    return expr.contents.map((token): string => token.lexeme).join("");
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
          return content.accept(this);
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
    let rv = expr.rest.lexeme;
    if (expr.rhythm) {
      rv += this.visitRhythmExpr(expr.rhythm);
    }
    return rv;
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
      } else if (expr.separator.lexeme === "/" && expr.denominator?.lexeme === "2") {
        return formatted + "/";
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
              return node.accept(this);
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
      rv = infoLine.accept(this);
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
    // Construct the tuplet notation
    let result = "(" + expr.p.lexeme;

    // Add q value if present
    if (expr.q) {
      result += ":" + expr.q.lexeme;

      // Add r value if present
      if (expr.r) {
        result += ":" + expr.r.lexeme;
      }
    }

    return result;
  }

  visitErrorExpr(expr: ErrorExpr): string {
    return expr.tokens.map((token) => token.lexeme).join("");
  }
}
