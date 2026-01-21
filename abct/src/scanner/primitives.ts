/**
 * ABCT Scanner Primitive Functions
 *
 * Scans identifiers, numbers, strings, ABC literals, and operators.
 * Following the ABC scanner pattern: boolean returns, composition via if/continue.
 */

import { AbctCtx } from "./context";
import { AbctTT, Token } from "./types";
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
 * Sanitize ABC content by escaping triple backticks
 * This allows ABC content that contains ``` to be safely embedded in ABCT
 */
export function sanitizeAbcContent(raw: string): string {
  return raw.replace(/```/g, "\\`\\`\\`");
}

/**
 * Desanitize ABC content by unescaping triple backticks
 * Used when extracting ABC content for insertion into ABC files
 */
export function desanitizeAbcContent(sanitized: string): string {
  return sanitized.replace(/\\`\\`\\`/g, "```");
}

// Pattern for ABC fence opening: ```abc optionally followed by location
// Must be at line start (possibly with leading whitespace)
const pAbcFenceOpen = /^[ \t]*```abc(?: :(\d+)(?::(\d+))?(?:-(\d+)(?::(\d+))?)?)?[ \t]*$/;

// Pattern for ABC fence closing: ``` at line start
const pAbcFenceClose = /^[ \t]*```[ \t]*$/;

/**
 * Check if we are at the start of a line
 */
function isAtLineStart(ctx: AbctCtx): boolean {
  return ctx.current === 0 || ctx.current === ctx.lineStart;
}

/**
 * Scan an ABC fence literal: ```abc ... ```
 * The opening fence must be at line start (possibly with leading whitespace).
 * The closing fence must be at line start.
 * Content is sanitized (``` escaped as \`\`\`).
 */
export function abcFence(ctx: AbctCtx): boolean {
  // Must be at line start to match opening fence
  if (!isAtLineStart(ctx)) return false;

  // Get the current line to validate the opening fence
  const lineEnd = ctx.source.indexOf("\n", ctx.current);
  const crlfEnd = ctx.source.indexOf("\r\n", ctx.current);
  let actualLineEnd: number;

  if (crlfEnd !== -1 && (lineEnd === -1 || crlfEnd < lineEnd)) {
    actualLineEnd = crlfEnd;
  } else if (lineEnd !== -1) {
    actualLineEnd = lineEnd;
  } else {
    actualLineEnd = ctx.source.length;
  }

  const openingLine = ctx.source.slice(ctx.current, actualLineEnd);

  // Validate the opening line matches the fence pattern (handles leading whitespace)
  if (!pAbcFenceOpen.test(openingLine)) return false;

  // Consume the opening fence line including trailing newline (for round-trip)
  ctx.current = actualLineEnd;
  if (ctx.test("\r\n")) {
    ctx.current += 2;
    ctx.line++;
    ctx.lineStart = ctx.current;
  } else if (ctx.test("\n") || ctx.test("\r")) {
    ctx.current += 1;
    ctx.line++;
    ctx.lineStart = ctx.current;
  }
  ctx.push(AbctTT.ABC_FENCE_OPEN);

  // Mark start of content
  ctx.start = ctx.current;
  const contentStart = ctx.current;

  // Scan until closing fence or EOF
  // The closing fence must be at the start of a line
  while (!isAtEnd(ctx)) {
    // Check if we're at line start and have a closing fence
    if (ctx.current === ctx.lineStart) {
      // Get the current line
      const closingLineEnd = ctx.source.indexOf("\n", ctx.current);
      const closingCrlfEnd = ctx.source.indexOf("\r\n", ctx.current);
      let closingActualEnd: number;

      if (closingCrlfEnd !== -1 && (closingLineEnd === -1 || closingCrlfEnd < closingLineEnd)) {
        closingActualEnd = closingCrlfEnd;
      } else if (closingLineEnd !== -1) {
        closingActualEnd = closingLineEnd;
      } else {
        closingActualEnd = ctx.source.length;
      }

      const currentLine = ctx.source.slice(ctx.current, closingActualEnd);

      if (pAbcFenceClose.test(currentLine)) {
        // Found closing fence - push content first
        const rawContent = ctx.source.slice(contentStart, ctx.current);
        const sanitizedContent = sanitizeAbcContent(rawContent);

        // Push content token (even if empty, for round-trip correctness)
        if (sanitizedContent.length > 0) {
          // Create a token manually since content may have been sanitized
          const contentToken = new Token(
            AbctTT.ABC_CONTENT,
            sanitizedContent,
            ctx.line, // This is approximate - multi-line content will span lines
            0, // Column at line start
            contentStart
          );
          ctx.tokens.push(contentToken);
        }

        // Update start and consume the closing fence
        ctx.start = ctx.current;
        ctx.current = closingActualEnd;
        ctx.push(AbctTT.ABC_FENCE_CLOSE);

        return true;
      }
    }

    // Not at closing fence, advance through content
    if (ctx.test("\r\n")) {
      ctx.current += 2;
      ctx.line++;
      ctx.lineStart = ctx.current;
    } else if (ctx.test(pEOL)) {
      ctx.current += 1;
      ctx.line++;
      ctx.lineStart = ctx.current;
    } else {
      ctx.current += 1;
    }
  }

  // EOF without closing fence - report error
  // Still emit content token and return true for error recovery
  const rawContent = ctx.source.slice(contentStart, ctx.current);
  const sanitizedContent = sanitizeAbcContent(rawContent);

  if (sanitizedContent.length > 0) {
    const contentToken = new Token(
      AbctTT.ABC_CONTENT,
      sanitizedContent,
      ctx.line,
      0,
      contentStart
    );
    ctx.tokens.push(contentToken);
  }

  ctx.report("Unterminated ABC fence, expected closing ```");
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
