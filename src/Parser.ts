import { tokenError } from "./error"
import { Pitch } from "./Expr"
import Token from "./token"
import { TokenType } from "./types"

export class Parser {
  private tokens: Array<Token>
  private current = 0
  constructor(tokens: Array<Token>) {
    this.tokens = tokens
  }

  parse() {
    try {
      return this.pitch()
    } catch {
      return null
    }
  }
  private pitch() {
    let alteration, noteLetter, octave
    if (
      this.match(
        TokenType.SHARP,
        TokenType.SHARP_DBL,
        TokenType.FLAT,
        TokenType.FLAT_DBL,
        TokenType.NATURAL
      )
    ) {
      //new Alteration
      alteration = this.previous()
    }
    if (this.match(TokenType.NOTE_LETTER)) {
      //new NoteLetter
      noteLetter = this.previous()
    } else {
      throw this.error(this.peek(), "Expected a note letter")
    }
    if (this.match(TokenType.COMMA, TokenType.APOSTROPHE)) {
      octave = this.previous()
    }
    return new Pitch({ alteration, noteLetter, octave })
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance()
    throw this.error(this.peek(), message)
  }

  private error(token: Token, message: string): Error {
    tokenError(token, message)
    return new Error()
  }

  /*   private synchronize() {
    this.advance()
    while (!this.isAtEnd()) {
      if (this.previous().type == TokenType.SEMICOLON) return
      switch (this.peek().type) {
        case TokenType.CLASS:
        case TokenType.FUN:
        case TokenType.VAR:
        case TokenType.FOR:
        case TokenType.IF:
        case TokenType.WHILE:
        case TokenType.PRINT:
        case TokenType.RETURN:
          return
      }
      this.advance()
    }
  } */
  private match(...types: Array<TokenType>): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance()
        return true
      }
    }
    return false
  }
  private check(type: TokenType) {
    if (this.isAtEnd()) return false
    return this.peek().type === type
  }
  private advance(): Token {
    if (!this.isAtEnd()) this.current++
    return this.previous()
  }
  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF
  }
  private peek(): Token {
    return this.tokens[this.current]
  }
  private previous(): Token {
    return this.tokens[this.current - 1]
  }
}
