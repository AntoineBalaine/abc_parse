import { TokenType } from "./types"

export default class Token {
  public type: TokenType
  public lexeme: string
  public literal: any | null
  public line: number
  public position: number
  public toString = () => {
    return this.type + " " + this.lexeme + " " + this.literal
  }
  constructor(
    type: TokenType,
    lexeme: string,
    literal: any | null,
    line: number,
    position: number
  ) {
    this.type = type
    this.lexeme = lexeme
    this.literal = literal
    this.line = line
    this.toString = toString
    this.position = position
  }
}
