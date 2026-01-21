/**
 * ABCT Context - Shared context for scanner and parser
 *
 * Provides a unified error reporter that both scanner and parser use,
 * eliminating the need to collect and re-map errors at each step.
 */

import { Token } from "./scanner/types";
import { Loc } from "./ast";

/**
 * Error reported during scanning, parsing, or validation
 */
export interface AbctError {
  message: string;
  token?: Token;
  loc?: Loc;
  origin: "scanner" | "parser" | "validator";
}

/**
 * Error reporter shared across scanner and parser
 */
export class AbctErrorReporter {
  private errors: AbctError[] = [];

  /**
   * Report a scanner error
   */
  scannerError(message: string, line: number, column: number, offset: number): void {
    this.errors.push({
      message,
      loc: {
        start: { line, column, offset },
        end: { line, column: column + 1, offset: offset + 1 },
      },
      origin: "scanner",
    });
  }

  /**
   * Report a parser error at a token
   */
  parserError(message: string, token: Token): void {
    // Convert from 0-based token positions to 1-based Loc positions
    this.errors.push({
      message,
      token,
      loc: {
        start: { line: token.line + 1, column: token.column + 1, offset: token.offset },
        end: {
          line: token.line + 1,
          column: token.column + token.lexeme.length + 1,
          offset: token.offset + token.lexeme.length,
        },
      },
      origin: "parser",
    });
  }

  /**
   * Report a validation error at a location
   */
  validatorError(message: string, loc: Loc): void {
    this.errors.push({ message, loc, origin: "validator" });
  }

  /**
   * Get all collected errors
   */
  getErrors(): AbctError[] {
    return this.errors;
  }

  /**
   * Check if any errors have been reported
   */
  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  /**
   * Reset the error list (call before a new analysis)
   */
  resetErrors(): void {
    this.errors = [];
  }
}

/**
 * Shared context for ABCT scanner and parser
 */
export class AbctContext {
  public errorReporter: AbctErrorReporter;

  constructor(errorReporter?: AbctErrorReporter) {
    this.errorReporter = errorReporter ?? new AbctErrorReporter();
  }
}
