/**
 * ABCT Parser Context
 *
 * Following the ABC scanner/parser pattern with context objects
 */

import { Token, AbctTT } from "../scanner";
import { Loc, Pos } from "../ast";
import { AbctContext } from "../context";

/**
 * Parser context that tracks position in token stream
 */
export class AbctParseCtx {
  public tokens: Token[];
  public current: number;
  public abctContext: AbctContext;

  constructor(tokens: Token[], abctContext: AbctContext) {
    this.tokens = tokens;
    this.current = 0;
    this.abctContext = abctContext;
  }

  /**
   * Report a parse error at the current token
   */
  error(message: string): void {
    const token = this.tokens[this.current];
    this.abctContext.errorReporter.parserError(message, token);
  }

  /**
   * Report a parse error at a specific token
   */
  errorAt(token: Token, message: string): void {
    this.abctContext.errorReporter.parserError(message, token);
  }
}

/**
 * Convert a token to a Loc (source location range).
 * Token positions are 0-based, matching the Loc convention.
 */
export function tokenToLoc(token: Token): Loc {
  const start: Pos = {
    line: token.line,
    column: token.column,
    offset: token.offset,
  };
  const end: Pos = {
    line: token.line,
    column: token.column + token.lexeme.length,
    offset: token.offset + token.lexeme.length,
  };
  return { start, end };
}

/**
 * Create a Loc spanning from start to end tokens.
 * Token positions are 0-based, matching the Loc convention.
 */
export function spanLoc(start: Token, end: Token): Loc {
  return {
    start: {
      line: start.line,
      column: start.column,
      offset: start.offset,
    },
    end: {
      line: end.line,
      column: end.column + end.lexeme.length,
      offset: end.offset + end.lexeme.length,
    },
  };
}

/**
 * Create a new parser context for the given tokens
 */
export function createParseCtx(tokens: Token[], abctContext: AbctContext): AbctParseCtx {
  return new AbctParseCtx(tokens, abctContext);
}
