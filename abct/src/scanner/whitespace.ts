/**
 * ABCT Scanner Whitespace Functions
 *
 * Scans whitespace, end-of-line, and comments.
 * Following the ABC scanner pattern: boolean returns, composition via if/continue.
 */

import { AbctCtx } from "./context";
import { AbctTT } from "./types";
import { advance, isAtEnd, matchPattern, newLine } from "./utils";

/**
 * Scan horizontal whitespace (spaces and tabs)
 */
export function WS(ctx: AbctCtx): boolean {
  const match = matchPattern(ctx, /[ \t]+/);
  if (!match) return false;

  ctx.push(AbctTT.WS);
  return true;
}

/**
 * Scan end-of-line (\n, \r, or \r\n)
 */
export function EOL(ctx: AbctCtx): boolean {
  if (ctx.test("\r\n")) {
    advance(ctx, 2);
    ctx.push(AbctTT.EOL);
    newLine(ctx);
    return true;
  }

  if (ctx.test("\n") || ctx.test("\r")) {
    advance(ctx);
    ctx.push(AbctTT.EOL);
    newLine(ctx);
    return true;
  }

  return false;
}

/**
 * Scan a comment: # to end of line
 * The comment includes the # but not the newline
 */
export function comment(ctx: AbctCtx): boolean {
  if (!ctx.test("#")) return false;

  // Scan to end of line (but don't consume the newline)
  while (!isAtEnd(ctx) && !ctx.test(/[\n\r]/)) {
    advance(ctx);
  }

  ctx.push(AbctTT.COMMENT);
  return true;
}
