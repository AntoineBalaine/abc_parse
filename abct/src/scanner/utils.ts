/**
 * ABCT Scanner Utility Functions
 *
 * Following the ABC scanner pattern from parse/parsers/scan2.ts
 */

import { AbctCtx } from "./context";

/**
 * Check if scanner has reached end of source
 */
export function isAtEnd(ctx: AbctCtx): boolean {
  return ctx.current >= ctx.source.length;
}

/**
 * Advance the cursor by count characters
 * @param ctx - Scanner context
 * @param count - Number of characters to advance (default 1)
 */
export function advance(ctx: AbctCtx, count: number = 1): void {
  if (isAtEnd(ctx)) return;
  ctx.current += count;
}

/**
 * Peek at the current character without advancing
 * @returns Current character or null byte if at end
 */
export function peek(ctx: AbctCtx): string {
  if (isAtEnd(ctx)) return "\0";
  return ctx.source.charAt(ctx.current);
}

/**
 * Peek at the next character (one ahead) without advancing
 * @returns Next character or null byte if at end
 */
export function peekNext(ctx: AbctCtx): string {
  if (ctx.current + 1 >= ctx.source.length) return "\0";
  return ctx.source.charAt(ctx.current + 1);
}

/**
 * Consume characters (advance and reset start)
 * Used when we want to skip characters without creating a token
 * @param ctx - Scanner context
 * @param count - Number of characters to consume (default 1)
 */
export function consume(ctx: AbctCtx, count: number = 1): void {
  if (isAtEnd(ctx)) return;
  ctx.current += count;
  ctx.start = ctx.current;
}

/**
 * Match a regex at current position and advance if matched
 * @param ctx - Scanner context
 * @param pattern - Regex pattern to match
 * @returns The match array if matched, null otherwise
 */
export function matchPattern(ctx: AbctCtx, pattern: RegExp): RegExpExecArray | null {
  const anchored = new RegExp(`^${pattern.source}`, pattern.flags);
  const match = anchored.exec(ctx.source.substring(ctx.current));
  if (match) {
    ctx.current += match[0].length;
  }
  return match;
}

/**
 * Update line tracking when encountering a newline
 * Call this after pushing an EOL token
 */
export function newLine(ctx: AbctCtx): void {
  ctx.line++;
  ctx.lineStart = ctx.current;
}
