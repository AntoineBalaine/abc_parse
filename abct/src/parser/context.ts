/**
 * ABCT Parser Context
 *
 * Following the ABC scanner/parser pattern with context objects
 */

import { Token, AbctTT } from "../scanner";
import { Loc, Pos } from "../ast";

/**
 * Parse error information
 */
export interface ParseError {
  message: string;
  token: Token;
  loc: Loc;
}

/**
 * Parser context that tracks position in token stream and accumulates errors
 */
export class AbctParseCtx {
  public tokens: Token[];
  public current: number;
  public errors: ParseError[];

  constructor(tokens: Token[]) {
    this.tokens = tokens;
    this.current = 0;
    this.errors = [];
  }

  /**
   * Report a parse error at the current token
   */
  error(message: string): void {
    const token = this.tokens[this.current];
    this.errors.push({
      message,
      token,
      loc: tokenToLoc(token),
    });
  }

  /**
   * Report a parse error at a specific token
   */
  errorAt(token: Token, message: string): void {
    this.errors.push({
      message,
      token,
      loc: tokenToLoc(token),
    });
  }
}

/**
 * Convert a token to a Loc (source location range)
 */
export function tokenToLoc(token: Token): Loc {
  const start: Pos = {
    line: token.line + 1, // Convert from 0-based to 1-based
    column: token.column + 1,
    offset: token.offset,
  };
  const end: Pos = {
    line: token.line + 1,
    column: token.column + token.lexeme.length + 1,
    offset: token.offset + token.lexeme.length,
  };
  return { start, end };
}

/**
 * Create a Loc spanning from start to end tokens
 */
export function spanLoc(start: Token, end: Token): Loc {
  return {
    start: {
      line: start.line + 1,
      column: start.column + 1,
      offset: start.offset,
    },
    end: {
      line: end.line + 1,
      column: end.column + end.lexeme.length + 1,
      offset: end.offset + end.lexeme.length,
    },
  };
}

/**
 * Create a new parser context for the given tokens
 */
export function createParseCtx(tokens: Token[]): AbctParseCtx {
  return new AbctParseCtx(tokens);
}
