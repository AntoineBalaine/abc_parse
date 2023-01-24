import { Parser } from "../Parser"
import { TokenType } from "../types"
import { describe, expect } from "@jest/globals"
import { Pitch } from "../Expr"

describe("Pitch", () => {
  let parser: Parser

  test("parse should return a Pitch object", () => {
    const tokens = [
      { type: TokenType.SHARP, lexeme: "^", literal: null, line: 1 },
      { type: TokenType.NOTE_LETTER, lexeme: "C", literal: null, line: 1 },
      { type: TokenType.COMMA, lexeme: ",", literal: null, line: 1 },
    ]
    parser = new Parser(tokens)
    const result = parser.parse()
    expect(result).toBeInstanceOf(Pitch)
  })

  test("parse should return null if nothing goes inside of the parser", () => {
    parser = new Parser([])
    const result = parser.parse()
    expect(result).toBe(null)
  })

  test("pitch should throw an error if the first token is not a note letter", () => {
    const tokens = [
      { type: TokenType.LETTER, lexeme: "X", literal: null, line: 1 },
    ]
    parser = new Parser(tokens)
    expect(() => parser.parse()).toThrow()
  })
})
