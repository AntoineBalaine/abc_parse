/**
 * ABCT Parser Utility Functions
 *
 * Following the ABC scanner/parser pattern
 */

import { AbctParseCtx } from "./context";
import { Token, AbctTT } from "../scanner";

/**
 * Check if parser has reached end of tokens
 */
export function isAtEnd(ctx: AbctParseCtx): boolean {
  return peek(ctx).type === AbctTT.EOF;
}

/**
 * Look at the current token without consuming it
 */
export function peek(ctx: AbctParseCtx): Token {
  return ctx.tokens[ctx.current];
}

/**
 * Look at the next token (one ahead) without consuming it
 */
export function peekNext(ctx: AbctParseCtx): Token {
  if (ctx.current + 1 >= ctx.tokens.length) {
    return ctx.tokens[ctx.tokens.length - 1]; // Return EOF
  }
  return ctx.tokens[ctx.current + 1];
}

/**
 * Get the previous token
 */
export function previous(ctx: AbctParseCtx): Token {
  if (ctx.current === 0) {
    return ctx.tokens[0];
  }
  return ctx.tokens[ctx.current - 1];
}

/**
 * Consume the current token and advance
 */
export function advance(ctx: AbctParseCtx): Token {
  if (!isAtEnd(ctx)) {
    ctx.current++;
  }
  return previous(ctx);
}

/**
 * Check if the current token is of the given type
 */
export function check(ctx: AbctParseCtx, type: AbctTT): boolean {
  if (isAtEnd(ctx)) return false;
  return peek(ctx).type === type;
}

/**
 * Check if the current token is one of the given types
 */
export function checkAny(ctx: AbctParseCtx, ...types: AbctTT[]): boolean {
  if (isAtEnd(ctx)) return false;
  return types.includes(peek(ctx).type);
}

/**
 * Consume current token if it matches, return true if matched
 */
export function match(ctx: AbctParseCtx, ...types: AbctTT[]): boolean {
  for (const type of types) {
    if (check(ctx, type)) {
      advance(ctx);
      return true;
    }
  }
  return false;
}

/**
 * Consume token if it matches, or report error
 * Returns the consumed token on success, or throws on failure
 */
export function consume(ctx: AbctParseCtx, type: AbctTT, message: string): Token {
  if (check(ctx, type)) {
    return advance(ctx);
  }
  ctx.error(message);
  throw new ParseException(message, peek(ctx));
}

/**
 * Try to consume token if it matches
 * Returns the consumed token on success, or null if no match
 */
export function tryConsume(ctx: AbctParseCtx, type: AbctTT): Token | null {
  if (check(ctx, type)) {
    return advance(ctx);
  }
  return null;
}

/**
 * Skip whitespace and comment tokens
 * Returns true if any tokens were skipped
 */
export function skipWS(ctx: AbctParseCtx): boolean {
  let skipped = false;
  while (checkAny(ctx, AbctTT.WS, AbctTT.COMMENT)) {
    advance(ctx);
    skipped = true;
  }
  return skipped;
}

/**
 * Skip whitespace, comments, and EOL tokens
 * Returns true if any tokens were skipped
 */
export function skipWSAndEOL(ctx: AbctParseCtx): boolean {
  let skipped = false;
  while (checkAny(ctx, AbctTT.WS, AbctTT.COMMENT, AbctTT.EOL)) {
    advance(ctx);
    skipped = true;
  }
  return skipped;
}

/**
 * Exception for parse errors (used internally for control flow)
 */
export class ParseException extends Error {
  public token: Token;

  constructor(message: string, token: Token) {
    super(message);
    this.token = token;
    this.name = "ParseException";
  }
}
