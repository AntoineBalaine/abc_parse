// Token Extractor - Walks the AST to produce tokens for semantic highlighting
// Comments are extracted separately from the source since Peggy skips them

import {
  Program,
  Statement,
  Expr,
  Loc,
  isAssignment,
  isPipe,
  isConcat,
  isUpdate,
  isApplication,
  isOr,
  isAnd,
  isNot,
  isComparison,
  isSelector,
  isLocationSelector,
  isVoiceRef,
  isList,
  isAbcLiteral,
  isFileRef,
  isNumberLiteral,
  isIdentifier,
} from "./ast";
import { formatLocation } from "./utils/formatLocation";

/**
 * Token types for semantic highlighting
 */
export enum AbctTokenType {
  COMMENT = "comment",
  KEYWORD = "keyword",
  OPERATOR = "operator",
  ABC_LITERAL = "abc_literal",
  NUMBER = "number",
  IDENTIFIER = "identifier",
  VARIABLE = "variable",
  FILE_REF = "file_ref",
  SELECTOR = "selector",
  VOICE_REF = "voice_ref",
  PUNCTUATION = "punctuation",
}

/**
 * A token with position information for semantic highlighting
 */
export interface AbctToken {
  type: AbctTokenType;
  text: string;
  line: number; // 1-based (Peggy uses 1-based)
  column: number; // 1-based
  length: number;
}

/**
 * Extract all tokens from the AST for semantic highlighting.
 * Also extracts comments from the source since they are skipped by Peggy.
 */
export function extractTokens(ast: Program, source: string): AbctToken[] {
  const tokens: AbctToken[] = [];

  // Extract comments from the source (Peggy skips them)
  extractComments(source, tokens);

  // Walk the AST to extract tokens
  for (const statement of ast.statements) {
    extractStatementTokens(statement, tokens);
  }

  // Sort tokens by position
  tokens.sort((a, b) => {
    if (a.line !== b.line) return a.line - b.line;
    return a.column - b.column;
  });

  return tokens;
}

/**
 * Extract comment tokens from source code.
 * Comments are lines starting with # (after optional whitespace).
 */
function extractComments(source: string, tokens: AbctToken[]): void {
  const lines = source.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const commentStart = line.indexOf("#");
    if (commentStart !== -1) {
      const commentText = line.substring(commentStart);
      tokens.push({
        type: AbctTokenType.COMMENT,
        text: commentText,
        line: i + 1, // 1-based
        column: commentStart + 1, // 1-based
        length: commentText.length,
      });
    }
  }
}

/**
 * Extract tokens from a statement
 */
function extractStatementTokens(stmt: Statement, tokens: AbctToken[]): void {
  if (isAssignment(stmt)) {
    // Variable on the left side
    tokens.push({
      type: AbctTokenType.VARIABLE,
      text: stmt.id,
      line: stmt.idLoc.start.line,
      column: stmt.idLoc.start.column,
      length: stmt.idLoc.end.offset - stmt.idLoc.start.offset,
    });

    // = operator
    tokens.push({
      type: AbctTokenType.OPERATOR,
      text: "=",
      line: stmt.eqLoc.start.line,
      column: stmt.eqLoc.start.column,
      length: 1,
    });

    // Value expression
    extractExprTokens(stmt.value, tokens);
  } else {
    // Expression statement
    extractExprTokens(stmt, tokens);
  }
}

/**
 * Extract tokens from an expression
 */
function extractExprTokens(expr: Expr, tokens: AbctToken[]): void {
  if (isPipe(expr)) {
    extractExprTokens(expr.left, tokens);
    tokens.push({
      type: AbctTokenType.OPERATOR,
      text: "|",
      line: expr.opLoc.start.line,
      column: expr.opLoc.start.column,
      length: 1,
    });
    extractExprTokens(expr.right, tokens);
  } else if (isConcat(expr)) {
    extractExprTokens(expr.left, tokens);
    tokens.push({
      type: AbctTokenType.OPERATOR,
      text: "+",
      line: expr.opLoc.start.line,
      column: expr.opLoc.start.column,
      length: 1,
    });
    extractExprTokens(expr.right, tokens);
  } else if (isUpdate(expr)) {
    extractExprTokens(expr.selector, tokens);
    tokens.push({
      type: AbctTokenType.OPERATOR,
      text: "|=",
      line: expr.opLoc.start.line,
      column: expr.opLoc.start.column,
      length: 2,
    });
    extractExprTokens(expr.transform, tokens);
  } else if (isApplication(expr)) {
    for (const term of expr.terms) {
      extractExprTokens(term, tokens);
    }
  } else if (isOr(expr)) {
    extractExprTokens(expr.left, tokens);
    tokens.push({
      type: AbctTokenType.KEYWORD,
      text: "or",
      line: expr.kwLoc.start.line,
      column: expr.kwLoc.start.column,
      length: 2,
    });
    extractExprTokens(expr.right, tokens);
  } else if (isAnd(expr)) {
    extractExprTokens(expr.left, tokens);
    tokens.push({
      type: AbctTokenType.KEYWORD,
      text: "and",
      line: expr.kwLoc.start.line,
      column: expr.kwLoc.start.column,
      length: 3,
    });
    extractExprTokens(expr.right, tokens);
  } else if (isNot(expr)) {
    tokens.push({
      type: AbctTokenType.KEYWORD,
      text: "not",
      line: expr.kwLoc.start.line,
      column: expr.kwLoc.start.column,
      length: 3,
    });
    extractExprTokens(expr.operand, tokens);
  } else if (isComparison(expr)) {
    extractExprTokens(expr.left, tokens);
    tokens.push({
      type: AbctTokenType.OPERATOR,
      text: expr.op,
      line: expr.opLoc.start.line,
      column: expr.opLoc.start.column,
      length: expr.op.length,
    });
    extractExprTokens(expr.right, tokens);
  } else if (isSelector(expr)) {
    // @ symbol
    tokens.push({
      type: AbctTokenType.SELECTOR,
      text: "@",
      line: expr.atLoc.start.line,
      column: expr.atLoc.start.column,
      length: 1,
    });
    // Selector path id
    tokens.push({
      type: AbctTokenType.SELECTOR,
      text: expr.path.id,
      line: expr.path.idLoc.start.line,
      column: expr.path.idLoc.start.column,
      length: expr.path.idLoc.end.offset - expr.path.idLoc.start.offset,
    });
    // Optional value
    if (expr.path.valueLoc) {
      const valText =
        typeof expr.path.value === "object" && expr.path.value.type === "range"
          ? `${expr.path.value.start}-${expr.path.value.end}`
          : String(expr.path.value);
      tokens.push({
        type: AbctTokenType.SELECTOR,
        text: valText,
        line: expr.path.valueLoc.start.line,
        column: expr.path.valueLoc.start.column,
        length: expr.path.valueLoc.end.offset - expr.path.valueLoc.start.offset,
      });
    }
  } else if (isLocationSelector(expr)) {
    // Location selectors are treated as numbers for highlighting
    tokens.push({
      type: AbctTokenType.NUMBER,
      text: formatLocation(expr),
      line: expr.loc.start.line,
      column: expr.loc.start.column,
      length: expr.loc.end.offset - expr.loc.start.offset,
    });
  } else if (isVoiceRef(expr)) {
    // Voice type (e.g., "V")
    tokens.push({
      type: AbctTokenType.VOICE_REF,
      text: expr.voiceType,
      line: expr.typeLoc.start.line,
      column: expr.typeLoc.start.column,
      length: expr.typeLoc.end.offset - expr.typeLoc.start.offset,
    });
    // Voice name
    tokens.push({
      type: AbctTokenType.VOICE_REF,
      text: String(expr.name),
      line: expr.nameLoc.start.line,
      column: expr.nameLoc.start.column,
      length: expr.nameLoc.end.offset - expr.nameLoc.start.offset,
    });
  } else if (isList(expr)) {
    // Extract tokens from list items
    for (const item of expr.items) {
      extractExprTokens(item, tokens);
    }
  } else if (isAbcLiteral(expr)) {
    tokens.push({
      type: AbctTokenType.ABC_LITERAL,
      text: `<<${expr.content}>>`,
      line: expr.loc.start.line,
      column: expr.loc.start.column,
      length: expr.loc.end.offset - expr.loc.start.offset,
    });
  } else if (isFileRef(expr)) {
    // File path
    tokens.push({
      type: AbctTokenType.FILE_REF,
      text: expr.path,
      line: expr.pathLoc.start.line,
      column: expr.pathLoc.start.column,
      length: expr.pathLoc.end.offset - expr.pathLoc.start.offset,
    });
    // Optional location (as number)
    if (expr.locationLoc) {
      tokens.push({
        type: AbctTokenType.NUMBER,
        text: formatLocation(expr.location!),
        line: expr.locationLoc.start.line,
        column: expr.locationLoc.start.column,
        length: expr.locationLoc.end.offset - expr.locationLoc.start.offset,
      });
    }
    // Optional selector
    if (expr.selector) {
      tokens.push({
        type: AbctTokenType.SELECTOR,
        text: "@" + expr.selector.id,
        line: expr.selector.idLoc.start.line,
        column: expr.selector.idLoc.start.column - 1, // Include @
        length: expr.selector.idLoc.end.offset - expr.selector.idLoc.start.offset + 1,
      });
      if (expr.selector.valueLoc) {
        const valText =
          typeof expr.selector.value === "object" &&
          expr.selector.value.type === "range"
            ? `${expr.selector.value.start}-${expr.selector.value.end}`
            : String(expr.selector.value);
        tokens.push({
          type: AbctTokenType.SELECTOR,
          text: valText,
          line: expr.selector.valueLoc.start.line,
          column: expr.selector.valueLoc.start.column,
          length:
            expr.selector.valueLoc.end.offset -
            expr.selector.valueLoc.start.offset,
        });
      }
    }
  } else if (isNumberLiteral(expr)) {
    tokens.push({
      type: AbctTokenType.NUMBER,
      text: expr.value,
      line: expr.loc.start.line,
      column: expr.loc.start.column,
      length: expr.loc.end.offset - expr.loc.start.offset,
    });
  } else if (isIdentifier(expr)) {
    tokens.push({
      type: AbctTokenType.IDENTIFIER,
      text: expr.name,
      line: expr.loc.start.line,
      column: expr.loc.start.column,
      length: expr.loc.end.offset - expr.loc.start.offset,
    });
  }
}
