import { advance, Ctx, isAtEnd, TT, WS, collectInvalidInfoLn } from "../scan2";
import { pEOL, pNumber } from "../scan_tunebody";
import { infoHeader } from "./infoLnHelper";

/**
 * Unified info line scanner using generic token types
 *
 * This scanner produces a generic token stream that can be used by
 * a unified parser to handle all info line types (K:, M:, L:, Q:, V:).
 *
 * Replaces the type-specific sub-scanners with a single generic approach.
 */
export function scanInfoLine2(ctx: Ctx): boolean {
  if (!infoHeader(ctx)) return false;

  while (!(isAtEnd(ctx) || ctx.test(pEOL) || ctx.test("%"))) {
    if (WS(ctx)) continue;
    if (specialLiteral(ctx)) continue; // C, C|
    if (identifier(ctx)) continue; // abc, treble, major
    if (stringLiteral(ctx)) continue; // "Allegro"
    if (number(ctx)) continue; // 1, 4, 120
    if (singleChar(ctx, "=", TT.EQL)) continue; // =
    if (singleChar(ctx, "+", TT.PLUS)) continue; // +
    if (singleChar(ctx, "/", TT.SLASH)) continue; // /
    if (singleChar(ctx, "(", TT.LPAREN)) continue; // (
    if (singleChar(ctx, ")", TT.RPAREN)) continue; // )

    // Invalid token - use existing helper
    collectInvalidInfoLn(ctx, "Invalid token in info line");
    break;
  }

  return true;
}

/**
 * Helper function to scan a single character and push the corresponding token type
 */
function singleChar(ctx: Ctx, char: string, tokenType: TT): boolean {
  if (!ctx.test(char)) return false;

  advance(ctx);
  ctx.push(tokenType);
  return true;
}

/**
 * Scan identifier: unquoted words like "treble", "major", "clef"
 */
function identifier(ctx: Ctx): boolean {
  if (!ctx.test(/[a-zA-Z][a-zA-Z0-9_]*/)) return false;

  const match = /^[a-zA-Z][a-zA-Z0-9_]*/.exec(ctx.source.substring(ctx.current));
  if (match) {
    ctx.current += match[0].length;
    ctx.push(TT.IDENTIFIER);
    return true;
  }
  return false;
}

/**
 * Scan string literal: quoted text like "Allegro", "Slowly"
 * Includes the quotes in the token
 */
function stringLiteral(ctx: Ctx): boolean {
  if (!ctx.test(/"/)) return false;

  advance(ctx); // consume opening quote

  // Scan until closing quote or end of line
  while (!(isAtEnd(ctx) || ctx.test(/"/) || ctx.test(pEOL))) {
    advance(ctx);
  }

  // Consume closing quote if present
  if (ctx.test(/"/)) {
    advance(ctx);
  }

  ctx.push(TT.STRING_LITERAL);
  return true;
}

/**
 * Scan number: integers that don't start with 0, using existing pNumber pattern
 */
function number(ctx: Ctx): boolean {
  if (!ctx.test(pNumber)) return false;

  const match = new RegExp(`^${pNumber.source}`).exec(ctx.source.substring(ctx.current));
  if (match) {
    ctx.current += match[0].length;
    ctx.push(TT.NUMBER);
    return true;
  }
  return false;
}

/**
 * Scan special literals: C (common time) and C| (cut time)
 * These are special cases in meter info lines
 * Must be followed by whitespace, end of line, or comment
 */
function specialLiteral(ctx: Ctx): boolean {
  // Check C| first since it contains C - must be followed by WS/EOL/comment
  if (ctx.test(/C\|(?=\s|$|%)/)) {
    advance(ctx, 2);
    ctx.push(TT.SPECIAL_LITERAL);
    return true;
  } else if (ctx.test(/C(?=\s|$|%)/)) {
    advance(ctx);
    ctx.push(TT.SPECIAL_LITERAL);
    return true;
  }

  return false;
}
