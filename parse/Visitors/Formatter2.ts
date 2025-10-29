import { isNote, isToken } from "../helpers";
import { ABCContext } from "../parsers/Context";
import { Token, TT } from "../parsers/scan2";
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
  Expr,
  File_header,
  File_structure,
  Grace_group,
  Grouping,
  Info_line,
  Inline_field,
  KV,
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
 * const ast = parseTune(Scanner(source), new ABCContext());
 * const fmt: string = new AbcFormatter(new ABCContext()).format(ast);
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
  formatFile(ast: File_structure): string {
    this.no_format = false;
    const rv = ast.contents
      .map((tune_or_token) => {
        if (tune_or_token instanceof Tune) {
          return this.format(tune_or_token);
        } else {
          return tune_or_token.accept(this);
        }
      })
      .join("\n\n");
    if (ast.file_header) {
      return `${ast.file_header?.accept(this)}${rv.length ? "\n\n" : ""}${rv}`;
    }
    return rv;
  }
  format(ast: Tune): string {
    this.no_format = false;
    // 1. Rules resolution phase
    const withRules = resolveRules(ast, this.ctx);

    // 2. align multi-voices tunes
    const alignedTune = alignTune(withRules, this.ctx, this);

    // 3. Print using visitor
    return this.stringify(alignedTune, false);
  }

  stringify(expr: Expr | Token, no_fmt?: boolean): string {
    this.no_format = no_fmt !== undefined ? no_fmt : true;

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
  visitToken(expr: Token) {
    return expr.lexeme;
  }
  visitFileStructureExpr(expr: File_structure) {
    let formattedFile = "";
    if (expr.file_header) {
      formattedFile += expr.file_header.accept(this);
    }
    const formattedTunes = expr.contents.map((tune): string => {
      return tune.accept(this);
    });
    return formattedFile + formattedTunes.join(formattedFile.length > 0 ? "\n" : "");
  }

  visitFileHeaderExpr(expr: File_header): string {
    //TODO should I return tokens here as well?
    return expr.contents
      .map((c) => c.accept(this))
      .join("\n")
      .trim();
  }

  visitDirectiveExpr(expr: Directive): string {
    const fmt_key = expr.key?.lexeme || "";
    const fmt_vals = expr.values?.map((e) => e.accept(this)).join(" ");
    if (fmt_key) return `%%${[fmt_key, fmt_vals].filter((e) => !!e).join(" ")}`;
    return `%%${fmt_vals}`;
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
    const fmt = expr.contents
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
    // If we're formatting (not just stringifying), sort the notes from lowest to highest
    const contents = this.no_format ? expr.contents : sortNotes(expr.contents);

    const str = contents
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

  visitSystemBreakExpr(expr: SystemBreak): string {
    return expr.symbol.lexeme;
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
    const { key } = expr;

    // If we have value2 expressions, format them using the visitor pattern
    if (expr.value2 && expr.value2.length > 0) {
      const formattedExpressions = expr.value2.map((expression) => {
        if (isToken(expression)) {
          return expression.lexeme;
        } else {
          return expression.accept(this);
        }
      });
      return `${key.lexeme}${formattedExpressions.join(" ")}`;
    }

    // Fallback to original token-based formatting for compatibility
    let val = "";
    for (let i = 0; i < expr.value.length; i++) {
      const tok = expr.value[i];
      if (tok.type === TT.WS) {
        continue;
      } else {
        val += (i === 0 ? "" : " ") + expr.value[i].lexeme;
      }
    }
    return `${key.lexeme}${val}`;
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
    }
    // else if (expr.pitch instanceof Rest) {
    //   formattedNote += this.visitRestExpr(expr.pitch);
    // }
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
    if (expr.tune_body && expr.tune_body.sequence.length) {
      formatted += "\n";
      formatted += this.visitTuneBodyExpr(expr.tune_body);
    }
    return formatted;
  }

  visitTuneHeaderExpr(expr: Tune_header): string {
    const info_lines = expr.info_lines.map((il) => il.accept(this)).join("\n");
    return info_lines;
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

  visitLyricLineExpr(expr: Lyric_line): string {
    const headerStr = expr.header.lexeme;
    const contentsStr = expr.contents.map((token) => token.lexeme).join("");
    return headerStr + contentsStr;
  }

  visitMacroDeclExpr(expr: Macro_decl): string {
    return expr.header.lexeme + expr.variable.lexeme + "=" + expr.content.lexeme;
  }

  visitMacroInvocationExpr(expr: Macro_invocation): string {
    return expr.variable.lexeme;
  }

  visitUserSymbolDeclExpr(expr: User_symbol_decl): string {
    return expr.header.lexeme + expr.variable.lexeme + "=" + expr.symbol.lexeme;
  }

  visitUserSymbolInvocationExpr(expr: User_symbol_invocation): string {
    return expr.variable.lexeme;
  }

  // New expression visitor methods for unified info line parsing
  visitKV(expr: KV): string {
    // Format the value (could be Token or Expr like Unary)
    const valueStr = expr.value instanceof Token ? expr.value.lexeme : expr.value.accept(this);

    if (expr.key && expr.equals) {
      // Format as key=value (no spaces around =)
      let keyStr: string;
      if (expr.key instanceof AbsolutePitch) {
        keyStr = this.visitAbsolutePitch(expr.key);
      } else {
        keyStr = expr.key.lexeme;
      }
      return keyStr + expr.equals.lexeme + valueStr;
    } else {
      // Standalone value (no key)
      return valueStr;
    }
  }

  visitBinary(expr: Binary): string {
    // Format binary expressions without spaces around operators (4/4, 2+3)
    const leftStr = expr.left instanceof Token ? expr.left.lexeme : expr.left.accept(this);
    const rightStr = expr.right instanceof Token ? expr.right.lexeme : expr.right.accept(this);
    return leftStr + expr.operator.lexeme + rightStr;
  }

  visitUnary(expr: import("../types/Expr2").Unary): string {
    // Format unary expressions as operator + operand (e.g., -2, +3)
    const operandStr = expr.operand instanceof Token ? expr.operand.lexeme : expr.operand.accept(this);
    return expr.operator.lexeme + operandStr;
  }

  visitGrouping(expr: Grouping): string {
    // Format as (expression)
    return "(" + expr.expression.accept(this) + ")";
  }

  visitAbsolutePitch(expr: AbsolutePitch): string {
    // Format as note[accidental][octave] - no spaces
    let result = expr.noteLetter.lexeme;
    if (expr.alteration) {
      result += expr.alteration.lexeme;
    }
    if (expr.octave) {
      result += expr.octave.lexeme;
    }
    return result;
  }

  visitRationalExpr(expr: Rational): string {
    return expr.numerator.lexeme + expr.separator.lexeme + expr.denominator.lexeme;
  }

  visitMeasurementExpr(expr: Measurement): string {
    return expr.value.lexeme + expr.scale.lexeme;
  }
}

export class FmtCtx {
  source: Array<Token | Expr>;
  current: number = 0;
  start: number = 0;

  constructor(tokens: Array<Token | Expr>) {
    this.source = tokens;
  }

  peek(): Token | Expr {
    return this.source[this.current];
  }

  previous(): Token | Expr {
    return this.source[this.current - 1];
  }

  advance(): Token | Expr {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  isAtEnd(): boolean {
    const cur = this.peek();
    return this.current >= this.source.length || (isToken(cur) && cur.type === TT.EOF);
  }

  push(into: Array<Array<Token | Expr>>) {
    into.push([...this.source.slice(this.start, this.current)]);
    this.start = this.current;
  }
}

// Export for testing
export function getSplits(contents: Array<Note | Token | Annotation>): Array<Array<Note | Token | Annotation>> {
  const splits: Array<Array<Note | Token | Annotation>> = [];
  const ctx = new FmtCtx(contents);

  while (!ctx.isAtEnd()) {
    while (!isNote(ctx.peek())) {
      ctx.advance();
    }

    ctx.advance(); // advance note
    ctx.push(splits);
  }
  if (ctx.current < ctx.source.length) {
    splits.push([...ctx.source.slice(ctx.start)] as Array<Note | Token | Annotation>);
    ctx.push(splits);
  }
  return splits;
}

// Export for testing
export function sortNotes(contents: Array<Note | Token | Annotation>): Array<Note | Token | Annotation> {
  const splits = getSplits(contents);
  splits.sort((a, b) => {
    // compare relative value of notes.
    const a_note = a.find((e) => isNote(e));
    const b_note = b.find((e) => isNote(e));
    if (!a_note || !b_note) {
      return 0;
    }
    const a_pval = toMidiPitch(a_note.pitch as Pitch);
    const b_pval = toMidiPitch(b_note.pitch as Pitch);
    return a_pval - b_pval;
  });
  return splits.flat();
}

/**
 * Converts a Pitch object to its MIDI pitch value for comparison
 * This is used to sort notes from lowest to highest in a chord
 */
// Export for testing
export const toMidiPitch = (pitch: Pitch): number => {
  let noteNum: number;
  const note_letter = pitch.noteLetter.lexeme;

  // Base MIDI numbers for C4 (middle C) = 60, D4 = 62, etc.
  switch (note_letter.toUpperCase()) {
    case "C":
      noteNum = 60;
      break;
    case "D":
      noteNum = 62;
      break;
    case "E":
      noteNum = 64;
      break;
    case "F":
      noteNum = 65;
      break;
    case "G":
      noteNum = 67;
      break;
    case "A":
      noteNum = 69;
      break;
    case "B":
      noteNum = 71;
      break;
    default:
      throw new Error(`Invalid note letter: ${note_letter}`);
  }

  // Handle alterations (sharps, flats, naturals)
  if (pitch.alteration) {
    const alt = pitch.alteration.lexeme;
    if (alt === "^") noteNum += 1; // Sharp
    else if (alt === "^^") noteNum += 2; // Double sharp
    else if (alt === "_") noteNum -= 1; // Flat
    else if (alt === "__") noteNum -= 2; // Double flat
    // Natural (=) doesn't change the pitch
  }

  // Handle octave
  // In ABC notation, lowercase letters are one octave higher than uppercase
  if (/[a-g]/.test(note_letter)) {
    noteNum += 12; // One octave higher for lowercase letters
  }

  pitch.octave?.lexeme.split("").forEach((oct) => (oct === "'" ? (noteNum += 12) : (noteNum -= 12)));

  return noteNum;
};
