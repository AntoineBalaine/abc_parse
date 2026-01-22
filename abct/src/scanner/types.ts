/**
 * ABCT Scanner Token Types and Token Class
 *
 * Following the ABC scanner pattern from parse/parsers/scan2.ts
 */

/**
 * Token types for the ABCT language scanner
 */
export enum AbctTT {
  // Literals
  IDENTIFIER,
  NUMBER,
  STRING,

  // ABC fence literals (```abc ... ```)
  ABC_FENCE_OPEN, // ```abc or ```abc :location
  ABC_FENCE_CLOSE, // ```
  ABC_CONTENT, // content between fences (sanitized)

  // Operators
  PIPE, // |
  PIPE_EQ, // |=
  PLUS, // +
  EQ, // =
  AT, // @
  COLON, // :
  MINUS, // -
  DOT, // .
  COMMA, // ,
  LPAREN, // (
  RPAREN, // )
  LBRACKET, // [
  RBRACKET, // ]

  // Comparison operators
  GT, // >
  LT, // <
  GTE, // >=
  LTE, // <=
  EQEQ, // ==
  BANGEQ, // !=

  // Keywords
  AND,
  OR,
  NOT,
  FILTER,

  // Whitespace (preserved in AST for formatting)
  WS, // horizontal whitespace
  EOL, // end of line
  COMMENT, // # to end of line

  // Special
  EOF,
  INVALID, // error recovery token
}

/**
 * Source location for tokens
 */
export interface SourceLocation {
  line: number;
  column: number;
  offset: number;
}

/**
 * Token with position information.
 * All position values are 0-based.
 */
export class Token {
  public type: AbctTT;
  public lexeme: string;
  /** 0-based line number */
  public line: number;
  /** 0-based column number */
  public column: number;
  /** 0-based byte offset from start of source */
  public offset: number;

  constructor(
    type: AbctTT,
    lexeme: string,
    line: number,
    column: number,
    offset: number
  ) {
    this.type = type;
    this.lexeme = lexeme;
    this.line = line;
    this.column = column;
    this.offset = offset;
  }

  public toString(): string {
    return `${AbctTT[this.type]}(${JSON.stringify(this.lexeme)}) at ${this.line}:${this.column}`;
  }

  /**
   * Get the start location of this token
   */
  public get startLoc(): SourceLocation {
    return {
      line: this.line,
      column: this.column,
      offset: this.offset,
    };
  }

  /**
   * Get the end location of this token
   */
  public get endLoc(): SourceLocation {
    return {
      line: this.line,
      column: this.column + this.lexeme.length,
      offset: this.offset + this.lexeme.length,
    };
  }
}
