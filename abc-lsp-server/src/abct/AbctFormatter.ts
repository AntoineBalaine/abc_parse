// ABCT Formatter - Formats ABCT code with consistent spacing and style
// Walks the AST and produces formatted output according to the formatting rules

import {
  Program,
  Statement,
  Expr,
  Assignment,
  Pipe,
  Concat,
  Update,
  Application,
  Or,
  And,
  Not,
  Negate,
  Group,
  Comparison,
  FilterExpression,
  Selector,
  LocationSelector,
  VoiceRef,
  List,
  AbcLiteral,
  FileRef,
  NumberLiteral,
  Identifier,
  SelectorPath,
  Range,
  isAssignment,
  isPipe,
  isConcat,
  isUpdate,
  isApplication,
  isOr,
  isAnd,
  isNot,
  isNegate,
  isGroup,
  isComparison,
  isFilterExpression,
  isSelector,
  isLocationSelector,
  isVoiceRef,
  isList,
  isAbcLiteral,
  isFileRef,
  isNumberLiteral,
  isIdentifier,
} from "../../../abct/src/ast";
import { formatLocation } from "../../../abct/src/utils/formatLocation";

/**
 * Comment information extracted from source code.
 * Since Peggy skips comments, we extract them separately from the source.
 */
interface Comment {
  text: string;
  line: number;
  column: number;
  isTrailing: boolean; // true if comment appears after code on the same line
}

/**
 * Formatter for ABCT code.
 * Produces consistently formatted output according to the formatting rules:
 * - Spaces around | and |=
 * - No space after @
 * - Spaces after commas in lists
 * - No spaces inside parentheses/brackets
 * - Single space in applications
 * - Preserve comments and line breaks
 * - Do not format inside ABC literals (```abc ... ```)
 */
export class AbctFormatter {
  private output: string[] = [];
  private comments: Comment[] = [];
  private commentIndex = 0;
  private currentLine = 0; // 0-based to match AST positions

  /**
   * Format an ABCT program AST to a string.
   * @param ast The program AST to format
   * @param source The original source code (used for extracting comments)
   * @returns The formatted source code
   */
  format(ast: Program, source: string): string {
    this.output = [];
    this.comments = this.extractComments(source);
    this.commentIndex = 0;
    this.currentLine = 0;

    for (let i = 0; i < ast.statements.length; i++) {
      const stmt = ast.statements[i];
      const stmtLine = stmt.loc.start.line;

      // Emit any leading comments before this statement
      this.emitLeadingComments(stmtLine);

      // Emit blank lines to preserve line structure
      while (this.currentLine < stmtLine) {
        this.output.push("\n");
        this.currentLine++;
      }

      // Format the statement
      this.formatStatement(stmt);

      // Emit trailing comment on the same line if present
      this.emitTrailingComment(stmtLine);

      this.output.push("\n");
      this.currentLine++;
    }

    // Emit any remaining trailing comments
    this.emitRemainingComments();

    return this.output.join("");
  }

  /**
   * Extract comments from source code.
   * Comments start with # and extend to end of line.
   */
  private extractComments(source: string): Comment[] {
    const comments: Comment[] = [];
    const lines = source.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const commentStart = line.indexOf("#");

      if (commentStart !== -1) {
        const text = line.substring(commentStart);
        const beforeComment = line.substring(0, commentStart).trim();
        const isTrailing = beforeComment.length > 0;

        comments.push({
          text,
          line: i, // 0-based to match AST positions
          column: commentStart, // 0-based
          isTrailing,
        });
      }
    }

    return comments;
  }

  /**
   * Emit leading comments that appear before the given line.
   */
  private emitLeadingComments(beforeLine: number): void {
    while (
      this.commentIndex < this.comments.length &&
      this.comments[this.commentIndex].line < beforeLine &&
      !this.comments[this.commentIndex].isTrailing
    ) {
      const comment = this.comments[this.commentIndex];

      // Emit blank lines to reach the comment's line
      while (this.currentLine < comment.line) {
        this.output.push("\n");
        this.currentLine++;
      }

      this.output.push(comment.text);
      this.output.push("\n");
      this.currentLine++;
      this.commentIndex++;
    }
  }

  /**
   * Emit trailing comment on the given line if present.
   */
  private emitTrailingComment(onLine: number): void {
    if (
      this.commentIndex < this.comments.length &&
      this.comments[this.commentIndex].line === onLine &&
      this.comments[this.commentIndex].isTrailing
    ) {
      this.output.push("  ");
      this.output.push(this.comments[this.commentIndex].text);
      this.commentIndex++;
    }
  }

  /**
   * Emit any remaining comments at the end of the file.
   */
  private emitRemainingComments(): void {
    while (this.commentIndex < this.comments.length) {
      const comment = this.comments[this.commentIndex];

      // Emit blank lines to reach the comment's line
      while (this.currentLine < comment.line) {
        this.output.push("\n");
        this.currentLine++;
      }

      this.output.push(comment.text);
      this.output.push("\n");
      this.currentLine++;
      this.commentIndex++;
    }
  }

  /**
   * Format a statement (assignment or expression).
   */
  private formatStatement(stmt: Statement): void {
    if (isAssignment(stmt)) {
      this.formatAssignment(stmt);
    } else {
      this.formatExpr(stmt);
    }
  }

  /**
   * Format an assignment statement.
   */
  private formatAssignment(assign: Assignment): void {
    this.output.push(assign.id);
    this.output.push(" = ");
    this.formatExpr(assign.value);
  }

  /**
   * Format an expression.
   */
  private formatExpr(expr: Expr): void {
    if (isPipe(expr)) {
      this.formatPipe(expr);
    } else if (isConcat(expr)) {
      this.formatConcat(expr);
    } else if (isUpdate(expr)) {
      this.formatUpdate(expr);
    } else if (isApplication(expr)) {
      this.formatApplication(expr);
    } else if (isOr(expr)) {
      this.formatOr(expr);
    } else if (isAnd(expr)) {
      this.formatAnd(expr);
    } else if (isNot(expr)) {
      this.formatNot(expr);
    } else if (isNegate(expr)) {
      this.formatNegate(expr);
    } else if (isGroup(expr)) {
      this.formatGroup(expr);
    } else if (isComparison(expr)) {
      this.formatComparison(expr);
    } else if (isFilterExpression(expr)) {
      this.formatFilterExpression(expr);
    } else if (isSelector(expr)) {
      this.formatSelector(expr);
    } else if (isLocationSelector(expr)) {
      this.formatLocationSelector(expr);
    } else if (isVoiceRef(expr)) {
      this.formatVoiceRef(expr);
    } else if (isList(expr)) {
      this.formatList(expr);
    } else if (isAbcLiteral(expr)) {
      this.formatAbcLiteral(expr);
    } else if (isFileRef(expr)) {
      this.formatFileRef(expr);
    } else if (isNumberLiteral(expr)) {
      this.formatNumberLiteral(expr);
    } else if (isIdentifier(expr)) {
      this.formatIdentifier(expr);
    }
  }

  /**
   * Format a pipe expression: left | right
   * Preserves newlines when the pipe operator is on a different line than left expression
   */
  private formatPipe(pipe: Pipe): void {
    this.formatExpr(pipe.left);
    // Check if pipe operator is on a different line than left expression's end
    if (pipe.opLoc.start.line > pipe.left.loc.end.line) {
      this.output.push("\n| ");
    } else {
      this.output.push(" | ");
    }
    this.formatExpr(pipe.right);
  }

  /**
   * Format a concatenation expression: left + right
   */
  private formatConcat(concat: Concat): void {
    this.formatExpr(concat.left);
    this.output.push(" + ");
    this.formatExpr(concat.right);
  }

  /**
   * Format an update expression: selector |= transform
   */
  private formatUpdate(update: Update): void {
    this.formatExpr(update.selector);
    this.output.push(" |= ");
    this.formatExpr(update.transform);
  }

  /**
   * Format an application expression: term1 term2 term3
   */
  private formatApplication(app: Application): void {
    for (let i = 0; i < app.terms.length; i++) {
      if (i > 0) {
        this.output.push(" ");
      }
      this.formatApplicationTerm(app.terms[i]);
    }
  }

  /**
   * Format a term within an application.
   * Wraps certain expressions in parentheses when needed to preserve semantics.
   */
  private formatApplicationTerm(expr: Expr): void {
    // These expression types need parentheses when used as application terms
    // to preserve the correct parsing/semantics
    if (isPipe(expr) || isConcat(expr) || isOr(expr) || isAnd(expr) || isComparison(expr)) {
      this.output.push("(");
      this.formatExpr(expr);
      this.output.push(")");
    } else {
      this.formatExpr(expr);
    }
  }

  /**
   * Format an or expression: left or right
   */
  private formatOr(or: Or): void {
    this.formatExpr(or.left);
    this.output.push(" or ");
    this.formatExpr(or.right);
  }

  /**
   * Format an and expression: left and right
   */
  private formatAnd(and: And): void {
    this.formatExpr(and.left);
    this.output.push(" and ");
    this.formatExpr(and.right);
  }

  /**
   * Format a not expression: not operand
   */
  private formatNot(not: Not): void {
    this.output.push("not ");
    this.formatExpr(not.operand);
  }

  /**
   * Format a negate expression: -operand
   */
  private formatNegate(neg: Negate): void {
    this.output.push("-");
    this.formatExpr(neg.operand);
  }

  /**
   * Format a grouped expression: (expr)
   * Preserves parentheses to maintain user's explicit grouping
   */
  private formatGroup(group: Group): void {
    this.output.push("(");
    this.formatExpr(group.expr);
    this.output.push(")");
  }

  /**
   * Format a comparison expression: left op right
   */
  private formatComparison(cmp: Comparison): void {
    this.formatExpr(cmp.left);
    this.output.push(" ");
    this.output.push(cmp.op);
    this.output.push(" ");
    this.formatExpr(cmp.right);
  }

  /**
   * Format a filter expression: filter (predicate)
   */
  private formatFilterExpression(filter: FilterExpression): void {
    this.output.push("filter (");
    this.formatComparison(filter.predicate);
    this.output.push(")");
  }

  /**
   * Format a selector: @path
   * No space after @.
   */
  private formatSelector(sel: Selector): void {
    this.output.push("@");
    this.formatSelectorPath(sel.path);
  }

  /**
   * Format a selector path: id or id:value
   */
  private formatSelectorPath(path: SelectorPath): void {
    this.output.push(path.id);
    if (path.value !== undefined) {
      this.output.push(":");
      this.formatSelectorValue(path.value);
    }
  }

  /**
   * Format a selector value (string, number, or range).
   */
  private formatSelectorValue(value: string | number | Range): void {
    if (typeof value === "object" && value.type === "range") {
      this.output.push(`${value.start}-${value.end}`);
    } else {
      this.output.push(String(value));
    }
  }

  /**
   * Format a location selector: :line or :line:col or :line:col-end
   * Note: The actual runtime structure has { value: { line, col, end }, loc }
   * even though the TypeScript interface says { line, col, end, loc }.
   * We handle both cases for safety.
   */
  private formatLocationSelector(locSel: LocationSelector): void {
    // The runtime structure from the grammar has value.line, value.col, value.end
    // but the TypeScript interface says line, col, end directly.
    // We access via 'as any' to work with the actual runtime structure.
    const data = (locSel as any).value ?? locSel;
    this.output.push(formatLocation(data));
  }

  /**
   * Format a voice reference: V:name
   */
  private formatVoiceRef(ref: VoiceRef): void {
    this.output.push(ref.voiceType);
    this.output.push(":");
    this.output.push(String(ref.name));
  }

  /**
   * Format a list: [item1, item2, ...]
   * No spaces inside brackets, spaces after commas.
   */
  private formatList(list: List): void {
    this.output.push("[");
    for (let i = 0; i < list.items.length; i++) {
      if (i > 0) {
        this.output.push(", ");
      }
      this.formatExpr(list.items[i]);
    }
    this.output.push("]");
  }

  /**
   * Format an ABC literal: ```abc\ncontent\n``` or ```abc :location\ncontent\n```
   * Content is preserved exactly as-is.
   */
  private formatAbcLiteral(lit: AbcLiteral): void {
    this.output.push("```abc");
    // Output optional location (formatLocation includes the leading colon)
    if (lit.location) {
      this.output.push(" ");
      this.output.push(formatLocation(lit.location));
    }
    this.output.push("\n");
    // Content includes trailing newline from scanner for round-trip
    // Remove it since we add it explicitly below
    const content = lit.content.replace(/\n$/, "");
    this.output.push(content);
    this.output.push("\n```");
  }

  /**
   * Format a file reference: path or path:location or path@selector
   */
  private formatFileRef(ref: FileRef): void {
    this.output.push(ref.path);

    if (ref.location) {
      // formatLocation returns :line, :line:col, etc.
      this.output.push(formatLocation(ref.location));
    }

    if (ref.selector) {
      this.output.push("@");
      this.formatSelectorPath(ref.selector);
    }
  }

  /**
   * Format a number literal.
   */
  private formatNumberLiteral(num: NumberLiteral): void {
    this.output.push(num.value);
  }

  /**
   * Format an identifier.
   */
  private formatIdentifier(id: Identifier): void {
    this.output.push(id.name);
  }
}
