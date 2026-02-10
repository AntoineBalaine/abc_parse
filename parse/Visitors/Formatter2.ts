import { isComment, isNote, isToken } from "../helpers";
import { ABCContext } from "../parsers/Context";
import { Token, TT } from "../parsers/scan2";
import {
  AbsolutePitch,
  Annotation,
  BarLine,
  Beam,
  Binary,
  Chord,
  ChordSymbol,
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
  System,
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
import { alignTune, discoverVoicesInTuneBody } from "./fmt2/fmt_aligner";
import { resolveRules } from "./fmt2/fmt_rules_assignment";
import { VoiceMarkerStyleVisitor } from "./VoiceMarkerStyleVisitor";

/**
 * Checks if a comment is "empty" (contains only % or % followed by whitespace).
 * Because the comment token is typically "%..." or "% ...", we check that
 * after removing the leading % there is only whitespace remaining.
 */
function isEmptyComment(comment: Comment): boolean {
  const text = comment.token.lexeme;
  // Remove the leading % and check if the rest is only whitespace
  const afterPercent = text.startsWith("%") ? text.slice(1) : text;
  return afterPercent.trim() === "";
}

/**
 * Checks if a system has an empty comment at the specified boundary.
 *
 * @param system - The system (array of tune body elements)
 * @param boundary - Whether to check the "start" or "end" of the system
 * @returns true if an empty comment exists at the boundary
 */
export function hasCommentAtBoundary(system: System, boundary: "start" | "end"): boolean {
  if (system.length === 0) {
    return false;
  }

  if (boundary === "start") {
    // Find the first non-whitespace element
    for (const element of system) {
      if (isToken(element) && (element.type === TT.WS || element.type === TT.EOL)) {
        continue;
      }
      if (isComment(element) && isEmptyComment(element)) {
        return true;
      }
      // First non-whitespace element is not an empty comment
      return false;
    }
    return false;
  } else {
    // Find the last non-whitespace, non-EOL element
    for (let i = system.length - 1; i >= 0; i--) {
      const element = system[i];
      if (isToken(element) && (element.type === TT.WS || element.type === TT.EOL)) {
        continue;
      }
      if (isComment(element) && isEmptyComment(element)) {
        return true;
      }
      // Last non-whitespace element is not an empty comment
      return false;
    }
    return false;
  }
}

/**
 * Joins formatted system strings, inserting empty comment lines between systems
 * where neither system boundary already has an empty comment.
 *
 * @param formattedSystems - Array of formatted system strings
 * @param systems - Array of original System AST nodes for boundary checking
 * @returns The joined result with comment separators inserted as needed
 */
export function joinSystemsWithComments(formattedSystems: string[], systems: System[]): string {
  const result: string[] = [];
  for (let i = 0; i < formattedSystems.length; i++) {
    result.push(formattedSystems[i]);

    // Check if we need to insert a comment between this system and the next
    if (i < formattedSystems.length - 1) {
      const currentSystem = systems[i];
      const nextSystem = systems[i + 1];

      // Insert comment if neither system boundary has an empty comment
      const currentHasEndComment = hasCommentAtBoundary(currentSystem, "end");
      const nextHasStartComment = hasCommentAtBoundary(nextSystem, "start");

      if (!currentHasEndComment && !nextHasStartComment) {
        result.push("%\n");
      }
    }
  }
  return result.join("");
}

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
  /**
   * Current tune being formatted. Used by visitTuneBodyExpr to access
   * the tune's formatterConfig for system separator comment insertion.
   */
  currentTune: Tune | null = null;
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

    // 1. Transform voice markers if configured
    let tuneToFormat = ast;
    if (ast.formatterConfig.voiceMarkerStyle !== null && ast.tune_body) {
      const visitor = new VoiceMarkerStyleVisitor(this.ctx, ast.formatterConfig.voiceMarkerStyle);
      const transformedBody = visitor.transformTuneBody(ast.tune_body);
      tuneToFormat = new Tune(
        ast.id,
        ast.tune_header,
        transformedBody,
        ast.linear,
        ast.formatterConfig
      );
    }

    // 2. Discover voices declared in tune body and update the voices list
    if (tuneToFormat.tune_body) {
      discoverVoicesInTuneBody(tuneToFormat.tune_header.voices, tuneToFormat.tune_body);
    }

    // 3. Rules resolution phase
    const withRules = resolveRules(tuneToFormat, this.ctx);

    // 4. Align multi-voices tunes
    const alignedTune = alignTune(withRules, this.ctx, this);

    // 5. Print using visitor
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
    // Section breaks between tunes are represented by blank lines (\n\n)
    const tunesJoined = formattedTunes.join("\n\n");
    return formattedFile + (formattedFile.length > 0 && tunesJoined.length > 0 ? "\n\n" : "") + tunesJoined;
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

    if (fmt_key.toLowerCase() === "begintext") {
      return `%%${fmt_key}\n${expr.values.map((e) => e.accept(this))}\n%%endtext`;
    }
    const fmt_vals = expr.values?.map((e) => e.accept(this)).join(" ");
    if (fmt_key) return `%%${[fmt_key, fmt_vals].filter((e) => !!e).join(" ")}`;
    return `%%${fmt_vals}`;
  }

  visitVoiceOverlayExpr(expr: Voice_overlay) {
    return expr.contents.map((token): string => token.lexeme).join("");
  }

  visitLineContinuationExpr(expr: Line_continuation) {
    return expr.token.lexeme;
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
    // If we're formatting (not just stringifying), convert single-note chords to notes
    if (!this.no_format && this.isSingleNoteChord(expr)) {
      return this.formatSingleNoteChord(expr);
    }

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
    return `${expr.leftBracket?.lexeme ?? "["}${str}${expr.rightBracket?.lexeme ?? "]"}${rhythm}${tie}`;
  }

  /**
   * Check if a chord contains exactly one note and no other content (annotations, tokens).
   */
  private isSingleNoteChord(expr: Chord): boolean {
    const notes = expr.contents.filter((c) => c instanceof Note);
    const otherContent = expr.contents.filter((c) => !(c instanceof Note));
    return notes.length === 1 && otherContent.length === 0;
  }

  /**
   * Format a single-note chord as a note.
   * Rhythm rules:
   * 1. If the chord has a rhythm, the note inherits the chord's rhythm (chord takes priority)
   * 2. If the chord has no rhythm, the note keeps its own rhythm (if any)
   */
  private formatSingleNoteChord(expr: Chord): string {
    const note = expr.contents[0] as Note;

    // Format the pitch
    let formatted = this.visitPitchExpr(note.pitch);

    // Determine rhythm: chord's rhythm takes priority over note's rhythm
    if (expr.rhythm) {
      formatted += this.visitRhythmExpr(expr.rhythm);
    } else if (note.rhythm) {
      formatted += this.visitRhythmExpr(note.rhythm);
    }

    // Handle tie: chord's tie takes priority, otherwise use note's tie
    if (expr.tie) {
      formatted += expr.tie.lexeme;
    } else if (note.tie) {
      formatted += note.tie.lexeme;
    }

    return formatted;
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
    const lb = expr.leftBrace?.lexeme ?? "{";
    const rb = expr.rightBrace?.lexeme ?? "}";
    const slash = expr.acciaccaturaSlash?.lexeme ?? (expr.isAccacciatura ? "/" : "");
    return `${lb}${slash}${fmt}${rb}`;
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

    // Fallback to original token-based formatting for compatibility.
    // We preserve the original spacing by including all tokens as-is.
    let val = "";
    for (const tok of expr.value) {
      val += tok.lexeme;
    }
    return `${key.lexeme}${val}`;
  }

  visitInlineFieldExpr(expr: Inline_field): string {
    const { field } = expr;

    // If we have value2 expressions, format them using the visitor pattern
    if (expr.value2 && expr.value2.length > 0) {
      const formattedExpressions = expr.value2.map((expression) => {
        if (isToken(expression)) {
          return expression.lexeme;
        } else {
          return expression.accept(this);
        }
      });
      return `${expr.leftBracket?.lexeme ?? "["}${field.lexeme}${formattedExpressions.join(" ")}${expr.rightBracket?.lexeme ?? "]"}`;
    }

    // Fallback to original token-based formatting for compatibility
    // Skip the first token (field) since we're already including it in the output
    const formattedText = expr.text
      .slice(1)
      .map((val) => val.lexeme)
      .join("");
    return `${expr.leftBracket?.lexeme ?? "["}${field.lexeme}${formattedText}${expr.rightBracket?.lexeme ?? "]"}`;
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
    const systems = expr.sequence;

    // Check if we need to insert system separator comments
    const shouldInsertComments =
      this.currentTune &&
      this.currentTune.linear &&
      systems.length > 1 &&
      this.currentTune.formatterConfig.systemComments;

    const formattedSystems = systems.map((system) => {
      return system
        .map((node) => {
          if (isToken(node)) {
            return node.lexeme;
          } else {
            return node.accept(this);
          }
        })
        .join("");
    });

    if (!shouldInsertComments) {
      return formattedSystems.join("");
    }

    return joinSystemsWithComments(formattedSystems, systems);
  }

  visitTuneExpr(expr: Tune): string {
    // Store current tune for access by visitTuneBodyExpr
    this.currentTune = expr;
    let formatted = "";
    formatted += this.visitTuneHeaderExpr(expr.tune_header);
    if (expr.tune_body && expr.tune_body.sequence.length) {
      formatted += "\n";
      formatted += this.visitTuneBodyExpr(expr.tune_body);
    }
    this.currentTune = null;
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
    let result = (expr.leftParen?.lexeme ?? "(") + expr.p.lexeme;

    if (expr.firstColon) {
      // Because stored colon tokens drive the output, the (p::r) case is handled correctly.
      result += expr.firstColon.lexeme;
      if (expr.q) result += expr.q.lexeme;
      if (expr.secondColon) {
        result += expr.secondColon.lexeme;
        if (expr.r) result += expr.r.lexeme;
      }
    } else if (expr.q) {
      // Fallback for programmatically-constructed Exprs without stored tokens
      result += ":" + expr.q.lexeme;
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
    return expr.header.lexeme + expr.variable.lexeme + (expr.equals?.lexeme ?? "=") + expr.content.lexeme;
  }

  visitMacroInvocationExpr(expr: Macro_invocation): string {
    return expr.variable.lexeme;
  }

  visitUserSymbolDeclExpr(expr: User_symbol_decl): string {
    return expr.header.lexeme + expr.variable.lexeme + (expr.equals?.lexeme ?? "=") + expr.symbol.lexeme;
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
    return (expr.leftParen?.lexeme ?? "(") + expr.expression.accept(this) + (expr.rightParen?.lexeme ?? ")");
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

  visitChordSymbolExpr(expr: ChordSymbol): string {
    return expr.token.lexeme;
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
    if (alt === "^")
      noteNum += 1; // Sharp
    else if (alt === "^^")
      noteNum += 2; // Double sharp
    else if (alt === "_")
      noteNum -= 1; // Flat
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
