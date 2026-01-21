/**
 * ABCT Scanner Primitive Functions
 *
 * Scans identifiers, numbers, strings, ABC literals, and operators.
 * Following the ABC scanner pattern: boolean returns, composition via if/continue.
 */

import { AbctCtx } from "./context";
import { AbctTT } from "./types";
import { advance, isAtEnd, matchPattern } from "./utils";

// Pattern for the end of line
const pEOL = /[\n\r]/;

/**
 * Scan an identifier: starts with letter or _, followed by alphanumerics
 * Keywords (and, or, not) are scanned as their own token types
 */
export function identifier(ctx: AbctCtx): boolean {
  const match = matchPattern(ctx, /[a-zA-Z_][a-zA-Z0-9_]*/);
  if (!match) return false;

  const lexeme = match[0];

  // Check for keywords
  switch (lexeme) {
    case "and":
      ctx.push(AbctTT.AND);
      break;
    case "or":
      ctx.push(AbctTT.OR);
      break;
    case "not":
      ctx.push(AbctTT.NOT);
      break;
    default:
      ctx.push(AbctTT.IDENTIFIER);
  }
  return true;
}

/**
 * Scan a number: integer or decimal
 * Matches: 1, 42, 3.14, 0.5
 * Also matches fractions: 1/4, 3/8
 *
 * Note: Negative numbers are NOT matched here. The parser handles
 * unary minus. This ensures that `5-8` scans as `5 MINUS 8`, not `5` and `-8`.
 */
export function number(ctx: AbctCtx): boolean {
  // Try fraction first: 1/4, 3/8
  if (matchPattern(ctx, /[0-9]+\/[0-9]+/)) {
    ctx.push(AbctTT.NUMBER);
    return true;
  }

  // Integer or decimal
  if (matchPattern(ctx, /[0-9]+(\.[0-9]+)?/)) {
    ctx.push(AbctTT.NUMBER);
    return true;
  }

  return false;
}

/**
 * Scan a string literal: "..." with escape sequences
 */
export function string(ctx: AbctCtx): boolean {
  if (!ctx.test('"')) return false;

  advance(ctx); // consume opening quote

  while (!isAtEnd(ctx) && !ctx.test('"') && !ctx.test(pEOL)) {
    if (ctx.test("\\")) {
      advance(ctx, 2); // skip escape sequence
    } else {
      advance(ctx);
    }
  }

  if (ctx.test('"')) {
    advance(ctx); // consume closing quote
  } else {
    ctx.report("Unterminated string literal");
  }

  ctx.push(AbctTT.STRING);
  return true;
}

/**
 * Scan an ABC literal: <<...>>
 * Can span multiple lines
 */
export function abcLiteral(ctx: AbctCtx): boolean {
  if (!ctx.test("<<")) return false;

  advance(ctx, 2); // consume <<
  ctx.push(AbctTT.LT_LT);

  // Mark start of content
  ctx.start = ctx.current;

  // Scan until >> or EOF
  while (!isAtEnd(ctx) && !ctx.test(">>")) {
    if (ctx.test(pEOL)) {
      // Track newlines for line counting
      if (ctx.test("\r\n")) {
        advance(ctx, 2);
      } else {
        advance(ctx);
      }
      ctx.line++;
      ctx.lineStart = ctx.current;
    } else {
      advance(ctx);
    }
  }

  // Push ABC content if any
  if (ctx.current > ctx.start) {
    ctx.push(AbctTT.ABC_LITERAL);
  }

  if (ctx.test(">>")) {
    ctx.start = ctx.current;
    advance(ctx, 2);
    ctx.push(AbctTT.GT_GT);
  } else {
    ctx.report("Unterminated ABC literal, expected >>");
  }

  return true;
}

/**
 * Scan operators (multi-character first, then single-character)
 */
export function operator(ctx: AbctCtx): boolean {
  // Two-character operators (check first)
  if (ctx.test("|=")) {
    advance(ctx, 2);
    ctx.push(AbctTT.PIPE_EQ);
    return true;
  }
  if (ctx.test(">=")) {
    advance(ctx, 2);
    ctx.push(AbctTT.GTE);
    return true;
  }
  if (ctx.test("<=")) {
    advance(ctx, 2);
    ctx.push(AbctTT.LTE);
    return true;
  }
  if (ctx.test("==")) {
    advance(ctx, 2);
    ctx.push(AbctTT.EQEQ);
    return true;
  }
  if (ctx.test("!=")) {
    advance(ctx, 2);
    ctx.push(AbctTT.BANGEQ);
    return true;
  }

  // Single-character operators
  const singleOps: [string, AbctTT][] = [
    ["|", AbctTT.PIPE],
    ["+", AbctTT.PLUS],
    ["=", AbctTT.EQ],
    ["@", AbctTT.AT],
    [":", AbctTT.COLON],
    ["-", AbctTT.MINUS],
    [".", AbctTT.DOT],
    [",", AbctTT.COMMA],
    ["(", AbctTT.LPAREN],
    [")", AbctTT.RPAREN],
    ["[", AbctTT.LBRACKET],
    ["]", AbctTT.RBRACKET],
    [">", AbctTT.GT],
    ["<", AbctTT.LT],
  ];

  for (const [char, tokenType] of singleOps) {
    if (ctx.test(char)) {
      advance(ctx);
      ctx.push(tokenType);
      return true;
    }
  }

  return false;
}

/**
 * Collect invalid characters into an INVALID token
 * Used for error recovery when no other scanner matches
 */
export function collectInvalid(ctx: AbctCtx): boolean {
  if (isAtEnd(ctx)) return false;

  // Collect characters until we find something valid
  while (!isAtEnd(ctx) && !ctx.test(pEOL) && !ctx.test(/[\s"<\[(@|+=\-:>!.,]/)) {
    advance(ctx);
  }

  if (ctx.current > ctx.start) {
    ctx.report(`Invalid character(s): ${ctx.source.slice(ctx.start, ctx.current)}`);
    ctx.push(AbctTT.INVALID);
    return true;
  }

  return false;
}
