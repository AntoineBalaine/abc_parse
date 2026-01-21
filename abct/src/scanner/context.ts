/**
 * ABCT Scanner Context
 *
 * Following the ABC scanner pattern from parse/parsers/scan2.ts
 */

import { AbctTT, Token } from "./types";
import { AbctContext } from "../context";

/**
 * Scanner context that tracks position and accumulates tokens
 *
 * All scanner functions take this context and return boolean:
 * - true: matched and consumed input, pushed token(s)
 * - false: did not match, no state change
 */
export class AbctCtx {
  public source: string;
  public tokens: Token[];
  public start: number; // start of current token
  public current: number; // current position
  public line: number; // 0-based line number
  public lineStart: number; // offset of current line start (for column calculation)
  public abctContext: AbctContext;

  constructor(source: string, abctContext: AbctContext) {
    this.source = source;
    this.tokens = [];
    this.start = 0;
    this.current = 0;
    this.line = 0;
    this.lineStart = 0;
    this.abctContext = abctContext;
  }

  /**
   * Test if pattern matches at current position
   * @param pattern - RegExp or string to match
   * @returns true if pattern matches at current position
   */
  test(pattern: RegExp | string): boolean {
    if (pattern instanceof RegExp) {
      // Ensure pattern anchored to start
      const anchored = new RegExp(`^${pattern.source}`, pattern.flags);
      return anchored.test(this.source.substring(this.current));
    } else {
      return this.source.substring(this.current, this.current + pattern.length) === pattern;
    }
  }

  /**
   * Push a token from start to current position
   * @param tokenType - The type of token to push
   */
  push(tokenType: AbctTT): void {
    const lexeme = this.source.slice(this.start, this.current);
    const column = this.start - this.lineStart;
    const token = new Token(tokenType, lexeme, this.line, column, this.start);
    this.tokens.push(token);
    this.start = this.current;
  }

  /**
   * Report a scanner error
   * @param message - Error message
   */
  report(message: string): void {
    // Pass 0-based line/column to the error reporter
    this.abctContext.errorReporter.scannerError(
      message,
      this.line,
      this.current - this.lineStart,
      this.current
    );
  }

  /**
   * Get current column (0-based)
   */
  get column(): number {
    return this.current - this.lineStart;
  }
}

/**
 * Create a new scanner context for the given source
 */
export function createCtx(source: string, abctContext: AbctContext): AbctCtx {
  return new AbctCtx(source, abctContext);
}
