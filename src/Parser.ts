import { EOF } from "dns"
import { tokenError } from "./error"
import { Binary, Expr, Grouping, Literal, Unary } from "./Expr"
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
      return this.expression()
    } catch {
      return null
    }
  }
  private expression() {
    return this.equality()
  }
  private equality() {
    let expr: Expr = this.comparison()
    while (this.match(TokenType.BANG_EQUAL, TokenType.EQUAL_EQUAL)) {
      const operator: Token = this.previous()
      const right: Expr = this.comparison()
      expr = new Binary(expr, operator, right)
    }
    return expr
  }
  private comparison() {
    let expr: Expr = this.term()
    while (
      this.match(
        TokenType.GREATER,
        TokenType.GREATER_EQUAL,
        TokenType.LESS,
        TokenType.LESS_EQUAL
      )
    ) {
      const operator: Token = this.previous()
      const right: Expr = this.term()
      expr = new Binary(expr, operator, right)
    }
    return expr
  }
  private term() {
    let expr: Expr = this.factor()
    while (this.match(TokenType.MINUS, TokenType.PLUS)) {
      const operator: Token = this.previous()
      const right: Expr = this.factor()
      expr = new Binary(expr, operator, right)
    }
    return expr
  }
  private factor() {
    let expr: Expr = this.unary()
    while (this.match(TokenType.SLASH, TokenType.STAR)) {
      const operator: Token = this.previous()
      const right: Expr | undefined = this.unary()
      expr = new Binary(expr, operator, right)
    }
    return expr
  }

  private unary() {
    if (this.match(TokenType.MINUS, TokenType.BANG)) {
      const operator: Token = this.previous()
      const right: Expr = this.unary()
      return new Unary(operator, right)
    }
    return this.primary()
  }

  private primary() {
    if (this.match(TokenType.FALSE)) return new Literal(false)
    if (this.match(TokenType.TRUE)) return new Literal(true)
    if (this.match(TokenType.NIL)) return new Literal(null)
    if (this.match(TokenType.NUMBER))
      return new Literal(this.previous().literal)
    if (this.match(TokenType.LEFT_PAREN)) {
      const expr: Expr = this.expression()
      this.consume(TokenType.RIGHT_PAREN, "Expect ')' after expression.")
      return new Grouping(expr)
    }
    throw this.error(this.peek(), "Expected expression")
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance()
    throw this.error(this.peek(), message)
  }

  private error(token: Token, message: string): Error {
    tokenError(token, message)
    return new Error()
  }

  private synchronize() {
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
  }
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
