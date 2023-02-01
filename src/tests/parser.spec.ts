import { Parser } from "../Parser"
import { TokenType } from "../types"
import { Pitch } from "../Expr"
import Token from "../token"
import chai from "chai"
import assert from "assert"
const expect = chai.expect

describe("Pitch", () => {
  let parser: Parser

  it("parse should return null if nothing goes inside of the parser", () => {
    parser = new Parser([])
    const result = parser.parse()
    assert.equal(result, null)
  })

  it("pitch should throw an error if the first token is not a note letter", () => {
    const tokens: Array<Token> = [
      {
        type: TokenType.LETTER,
        lexeme: "X",
        literal: null,
        line: 1,
        position: 0,
      },
    ]
    parser = new Parser(tokens)
    expect(() => parser.parse()).to.throw()
  })
})
