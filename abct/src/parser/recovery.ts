/**
 * ABCT Parser Error Recovery
 *
 * Implements synchronization for error recovery
 */

import { AbctParseCtx } from "./context";
import { AbctTT } from "../scanner";
import { advance, isAtEnd, peek, previous, checkAny } from "./utils";

/**
 * Synchronize after an error by advancing to a recovery point
 *
 * Recovery points:
 * 1. EOL (statement boundary)
 * 2. = at statement level (assignment start)
 * 3. | at expression level (pipe boundary)
 * 4. Closing delimiters: ), ], ``` (ABC fence close)
 */
export function synchronize(ctx: AbctParseCtx): void {
  advance(ctx);

  while (!isAtEnd(ctx)) {
    // Recovered at statement boundary (after EOL)
    if (previous(ctx).type === AbctTT.EOL) {
      return;
    }

    // Recovered at known statement/expression boundaries
    switch (peek(ctx).type) {
      case AbctTT.EQ: // assignment
      case AbctTT.PIPE: // pipe (at expression level)
      case AbctTT.RPAREN: // closing paren
      case AbctTT.RBRACKET: // closing bracket
      case AbctTT.ABC_FENCE_CLOSE: // closing ABC fence
        return;
    }

    advance(ctx);
  }
}

/**
 * Synchronize to statement boundary (EOL or EOF)
 * More aggressive recovery - skips to end of current statement
 */
export function synchronizeToStatement(ctx: AbctParseCtx): void {
  while (!isAtEnd(ctx)) {
    if (peek(ctx).type === AbctTT.EOL) {
      advance(ctx); // consume the EOL
      return;
    }
    advance(ctx);
  }
}

/**
 * Synchronize to closing delimiter
 * Used when inside a grouped expression or list
 */
export function synchronizeToClose(ctx: AbctParseCtx, closeType: AbctTT): void {
  while (!isAtEnd(ctx)) {
    if (peek(ctx).type === closeType) {
      return; // Found the closing delimiter, don't consume it
    }
    if (peek(ctx).type === AbctTT.EOL) {
      // Statement boundary - stop here too
      return;
    }
    advance(ctx);
  }
}

/**
 * Check if we're at a potential recovery point
 */
export function isAtRecoveryPoint(ctx: AbctParseCtx): boolean {
  return checkAny(
    ctx,
    AbctTT.EOL,
    AbctTT.EOF,
    AbctTT.EQ,
    AbctTT.PIPE,
    AbctTT.RPAREN,
    AbctTT.RBRACKET,
    AbctTT.ABC_FENCE_CLOSE
  );
}

/**
 * Try to recover from an error and return true if successful
 * Returns false if at EOF
 */
export function tryRecover(ctx: AbctParseCtx): boolean {
  if (isAtEnd(ctx)) {
    return false;
  }
  synchronize(ctx);
  return !isAtEnd(ctx);
}
