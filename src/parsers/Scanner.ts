import { Token } from "../types/token";
import { TokenType } from "../types/types";
import { ABCContext } from "./Context";
import { AbcErrorReporter } from "./ErrorReporter";

/**
 * Takes a source string (an ABC score),
 * scans all the characters in it,
 * and returns the array of {@link Token}s
 * when you call `scanTokens()`
 * eg:
 * ```typescript
 * const scanner = new Scanner(source).scanTokens();
 * ```
 *
 * The scanner optionnally takes an {@link AbcErrorReporter},
 * in the case you'd like to use the same error Reporter for the Scanner and the Parser.
 * ```typescript
 * const ctx.errorReporter = new AbcErrorReporter()
 * const scanner = new Scanner(source, ctx.errorReporter).scanTokens();
 * const errors = ctx.errorReporter.getErrors();
 * ```
 * Otherwise, you can just retrieve the Scanner's errors directly:
 * ```typescript
 * const scanner = new Scanner(source, ctx.errorReporter);
 * const tokens = scanner.scanTokens();
 * if (scanner.hasErrors()) {
 *  const errors = scanner.getErrors();
 * }
 * ```
 *
 */
export class Scanner {
  private source: string;
  private tokens: Array<Token> = new Array();
  private start = 0;
  private current = 0;
  private line = 0;
  private ctx: ABCContext;
  constructor(source: string, ctx: ABCContext) {
    this.source = String.raw`${source}`;
    // this.source = source;
    this.ctx = ctx;
  }

  hasErrors = () => this.ctx.errorReporter.hasErrors();
  resetErrors = () => this.ctx.errorReporter.resetErrors();
  getErrors = () => this.ctx.errorReporter.getErrors();

  /**
   * Scan all characters found in the source string into an array of tokens.
   * If the scanner runs across an unexpected token, it will throw a `scannerError`.
   */
  scanTokens = (): Array<Token> => {
    while (!this.isAtEnd()) {
      this.start = this.current;
      this.scanToken();
    }
    this.tokens.push(new Token(TokenType.EOF, "\n", null, this.line, this.start, this.ctx));
    return this.tokens;
  };

  private scanToken() {
    let c = this.advance();
    switch (c) {
      case "`":
        this.addToken(TokenType.BACKTICK);
        break;
      case "\\":
        if (/\s*\n/.test(this.source.substring(this.current)) || (this.peek() === "\n" && !this.isAtEnd())) {
          while (this.peek() !== "\n" && !this.isAtEnd()) {
            this.advance();
          }
          this.advance();
          this.addToken(TokenType.ANTISLASH_EOL);
          this.line++;
        } else {
          this.advance();
          this.addToken(TokenType.ESCAPED_CHAR);
        }
        break;
      case "&":
        this.addToken(TokenType.AMPERSAND);
        break;
      case "'":
        while (this.peek() === "'" && !this.isAtEnd()) {
          this.advance();
        }
        this.addToken(TokenType.APOSTROPHE);
        break;
      case "\\":
        if (this.peek() === "\n" && !this.isAtEnd()) {
          this.advance();
          this.addToken(TokenType.EOL);
        }
        break;
      case "|": {
        const pkd = this.peek();
        this.addToken(TokenType.BARLINE);
        break;
      }
      // is caret always a sharp?
      case "^":
        if (this.peek() === "^") {
          this.advance();
          this.addToken(TokenType.SHARP_DBL);
        } else if (this.peek() === "/") {
          this.advance();
          this.addToken(TokenType.SHARP_HALF);
        } else {
          this.addToken(TokenType.SHARP);
        }
        break;
      /**
       * TODO implement backticks in beams
       */
      case ":": {
        this.addToken(TokenType.COLON); // just :
        break;
      }
      case ",":
        while (this.peek() === "," && !this.isAtEnd()) {
          this.advance();
        }
        this.addToken(TokenType.COMMA);
        break;
      case "%":
        const pkd = this.peek();
        while (this.peek() !== "\n" && !this.isAtEnd()) {
          this.advance();
        }
        this.addToken(pkd === "%" ? TokenType.STYLESHEET_DIRECTIVE : TokenType.COMMENT);
        break;
      case ".":
        this.addToken(TokenType.DOT);
        break;
      case "\n":
        this.addToken(TokenType.EOL);
        this.line++;
        break;
      case "_":
        if (this.peek() === "_") {
          this.advance();
          this.addToken(TokenType.FLAT_DBL);
        } else if (this.peek() === "/") {
          this.advance();
          this.addToken(TokenType.FLAT_HALF);
        } else {
          this.addToken(TokenType.FLAT);
        }
        break;
      case "♭":
        this.addToken(TokenType.FLAT);
        break;
      case "𝄫":
        this.addToken(TokenType.FLAT_DBL);
        break;
      case ">":
        while (this.peek() === ">" && !this.isAtEnd()) {
          this.advance();
        }
        this.addToken(TokenType.GREATER);
        break;
      case "[": {
        this.addToken(TokenType.LEFTBRKT);
        break;
      }
      case "{":
        this.addToken(TokenType.LEFT_BRACE);
        break;
      case "(":
        if (this.isDigit(this.peek())) {
          while (this.isDigit(this.peek())) {
            this.advance();
          }
          this.addToken(TokenType.LEFTPAREN_NUMBER);
        } else {
          this.addToken(TokenType.LEFTPAREN);
        }
        break;
      case "<":
        while (this.peek() === "<" && !this.isAtEnd()) {
          this.advance();
        }
        this.addToken(TokenType.LESS);
        break;
      case "-":
        this.addToken(TokenType.MINUS);
        break;
      case "♮":
      case "=":
        this.addToken(TokenType.NATURAL);
        break;
      case "+":
        if (this.peek() === ":") {
          this.advance();
          this.addToken(TokenType.PLUS_COLON);
        } else {
          this.addToken(TokenType.PLUS);
        }
        break;
      case ")":
        this.addToken(TokenType.RIGHT_PAREN);
        break;
      case "}":
        this.addToken(TokenType.RIGHT_BRACE);
        break;
      case "]":
        this.addToken(TokenType.RIGHT_BRKT);
        break;
      case "♯":
        this.addToken(TokenType.SHARP);
        break;
      case "𝄪":
        this.addToken(TokenType.SHARP_DBL);
        break;
      case "/":
        while (this.peek() === "/" && !this.isAtEnd()) {
          this.advance();
        }
        this.addToken(TokenType.SLASH);
        break;
      case "!":
        while (this.peek() !== "!" && !this.isAtEnd()) {
          this.advance();
        }
        this.advance();
        this.addToken(TokenType.SYMBOL);
        break;
      case "~":
        this.addToken(TokenType.TILDE);
        break;
      /**
       * This case actually never triggers:
       * JS eats up line-continuation characters.
       */
      case "\\n":
        // Don't Ignore whitespace, the standard is space-sensitive
        this.addToken(TokenType.ANTISLASH_EOL);
        break;
      case " ":
      case "\r":
      case "\t":
        // Don't Ignore whitespace, the standard is space-sensitive
        this.addToken(TokenType.WHITESPACE);
        break;
      case '"':
        this.string();
        break;
      case "$":
        this.addToken(TokenType.DOLLAR);
        break;
      default:
        if (this.isDigit(c)) {
          this.number();
        } else if (this.isAlpha(c)) {
          const pkd = this.peek();
          if (this.match(":")) {
            this.addToken(TokenType.LETTER_COLON);
          } else if (/[a-gA-G]/.test(c)) {
            this.addToken(TokenType.NOTE_LETTER);
          } else {
            this.addToken(TokenType.LETTER);
          }
        } else if (this.isReservedChar(c)) {
          this.addToken(TokenType.RESERVED_CHAR);
        } else {
          this.addToken(TokenType.INVALID);
          this.ctx.errorReporter.ScannerError(c, this.createToken(TokenType.STRING));
        }
        break;
    }
  }

  private number() {
    // only INTEGERS
    while (this.isDigit(this.peek())) {
      this.advance();
    }
    this.addToken(TokenType.NUMBER, Number(this.source.substring(this.start, this.current)));
  }
  private string() {
    //jump to end of string
    while (this.peek() !== '"' && !this.isAtEnd()) {
      if (this.peek() === "\n") {
        this.line++;
      }
      this.advance();
    }
    if (this.isAtEnd()) {
      this.ctx.errorReporter.ScannerError("Unterminated string", this.createToken(TokenType.EOF));
      return;
    }
    // the closing ".
    this.advance();
    // trim the surrounding quotes
    const value = this.source.substring(this.start + 1, this.current - 1);
    this.addToken(TokenType.STRING, value);
  }

  private match(expected: string): boolean {
    if (this.isAtEnd()) {
      return false;
    }
    if (this.source.charAt(this.current) !== expected) {
      return false;
    }
    this.current++;
    return true;
  }

  private peek() {
    if (this.isAtEnd()) {
      return "\0";
    }
    return this.source.charAt(this.current);
  }

  // could provided peek() with the capability to
  // have arbitrary size lookahead, but no.
  private peekNext() {
    if (this.current + 1 >= this.source.length) {
      return "\0";
    }
    return this.source.charAt(this.current + 1);
  }

  private isReservedChar(c: string) {
    //# * ; ? @
    return /[#\*;\?@]/.test(c);
  }
  private isAlpha(c: string) {
    return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "_" || c === "&";
  }

  private isAlphaNumeric(c: string) {
    return this.isAlpha(c) || this.isDigit(c);
  }

  private isDigit(c: string) {
    return c >= "0" && c <= "9";
  }

  private isAtEnd() {
    return this.current >= this.source.length;
  }

  private advance() {
    return this.source.charAt(this.current++);
  }

  private createToken(type: TokenType, literal?: any | null) {
    const text = this.source.substring(this.start, this.current);
    let lineBreak = this.line === 0 ? 0 : this.source.lastIndexOf("\n", this.start) + 1;

    let charPos = this.start - lineBreak;
    const token = new Token(type, text, literal || null, this.line, charPos, this.ctx);
    return token;
  }

  private addToken(type: TokenType, literal?: any | null) {
    this.tokens.push(this.createToken(type, literal));
  }
}
