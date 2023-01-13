import { stringify } from "querystring"
import { error } from "./error"
import Token from "./token"
import { Keywords, TokenType } from "./types"

export default class Scanner {
  private source: string
  private tokens: Array<Token> = new Array()
  private start = 0
  private current = 0
  private line = 1
  constructor(source: string) {
    this.source = source
  }

  scanTokens = (): Array<Token> => {
    while (!this.isAtEnd()) {
      this.start = this.current
      this.scanToken()
    }
    this.tokens.push(new Token(TokenType.EOF, "", null, this.line))
    return this.tokens
  }

  private scanToken() {
    let c = this.advance()
    switch (c) {
      case "(":
        this.addToken(TokenType.LEFT_PAREN)
        break
      case ")":
        this.addToken(TokenType.RIGHT_PAREN)
        break
      case "{":
        this.addToken(TokenType.LEFT_BRACE)
        break
      case "}":
        this.addToken(TokenType.RIGHT_BRACE)
        break
      case ",":
        this.addToken(TokenType.COMMA)
        break
      case ".":
        this.addToken(TokenType.DOT)
        break
      case "-":
        this.addToken(TokenType.MINUS)
        break
      case "+":
        this.addToken(TokenType.PLUS)
        break
      case ";":
        this.addToken(TokenType.SEMICOLON)
        break
      case "*":
        this.addToken(TokenType.STAR)
        break
      case "!":
        this.addToken(this.match("=") ? TokenType.BANG_EQUAL : TokenType.BANG)
        break
      case "=":
        this.addToken(this.match("=") ? TokenType.EQUAL_EQUAL : TokenType.EQUAL)
        break
      case "<":
        this.addToken(this.match("=") ? TokenType.LESS_EQUAL : TokenType.LESS)
        break
      case ">":
        this.addToken(
          this.match("=") ? TokenType.GREATER_EQUAL : TokenType.GREATER
        )
        break
      case "/":
        // second slash means it's a comment
        // so we keep consuming chars til EOL
        if (this.match("/")) {
          while (this.peek() != "\n" && !this.isAtEnd()) this.advance()
        } else {
          this.addToken(TokenType.SLASH)
        }
        break
      case " ":
      case "\r":
      case "\t":
        // Ignore whitespace.
        break
      case "\n":
        this.line++
        break
      case '"':
        this.string()
        break
      default:
        if (this.isDigit(c)) {
          this.number()
        } else if (this.isAlpha(c)) {
          this.identifier()
        } else {
          error(this.line, "unexpected character")
        }
        break
    }
  }

  private identifier() {
    while (this.isAlphaNumeric(this.peek())) this.advance()
    const text = this.source.substring(this.start, this.current)

    let type = Keywords.get(text)
    if (type == null) type = TokenType.IDENTIFIER

    this.addToken(type)
  }

  private number() {
    while (this.isDigit(this.peek())) this.advance()
    // look for a fractional part
    if (this.peek() == "." && this.isDigit(this.peekNext())) {
      // consume the "."
      this.advance()
      while (this.isDigit(this.peek())) this.advance()
    }
    this.addToken(
      TokenType.NUMBER,
      Number(this.source.substring(this.start, this.current))
    )
  }
  private string() {
    //jump to end of string
    while (this.peek() != '"' && !this.isAtEnd()) {
      if (this.peek() == "\n") this.line++
      this.advance()
    }
    if (this.isAtEnd()) {
      error(this.line, "Unterminated string")
      return
    }
    // the closing ".
    this.advance()
    // trim the surrounding quotes
    const value = this.source.substring(this.start + 1, this.current - 1)
    this.addToken(TokenType.STRING, value)
  }

  private match(expected: string): boolean {
    if (this.isAtEnd()) return false
    if (this.source.charAt(this.current) !== expected) {
      return false
    }
    this.current++
    return true
  }

  private peek() {
    if (this.isAtEnd()) return "\0"
    return this.source.charAt(this.current)
  }

  // could provided peek() with the capability to
  // have arbitrary size lookahead, but no.
  private peekNext() {
    if (this.current + 1 >= this.source.length) return "\0"
    return this.source.charAt(this.current + 1)
  }

  private isAlpha(c: string) {
    return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c == "_"
  }

  private isAlphaNumeric(c: string) {
    return this.isAlpha(c) || this.isDigit(c)
  }

  private isDigit(c: string) {
    return c >= "0" && c <= "9"
  }

  private isAtEnd() {
    return this.current >= this.source.length
  }

  private advance() {
    return this.source.charAt(this.current++)
  }

  private addToken(type: TokenType, literal?: any | null) {
    const text = this.source.substring(this.start, this.current)
    this.tokens.push(new Token(type, text, literal || null, this.line))
  }
}
