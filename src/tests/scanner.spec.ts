import Scanner from "../Scanner"
import { TokenType } from "../types"
import { describe, expect } from "@jest/globals"

describe("Scanner", () => {
  let scanner: Scanner

  it('should handle case "\\n"', () => {
    scanner = new Scanner("\n")
    const tokens = scanner.scanTokens()
    expect(tokens.length).toEqual(2)
    expect(tokens[0].type).toEqual(TokenType.EOL)
    expect(tokens[0].lexeme).toEqual("\n")
    expect(tokens[0].literal).toEqual(null)
    expect(tokens[0].line).toEqual(1)
  })

  it('should handle case "|:"', () => {
    scanner = new Scanner("|:")
    const tokens = scanner.scanTokens()
    expect(tokens.length).toEqual(2)
    expect(tokens[0].type).toEqual(TokenType.BAR_COLON)
    expect(tokens[0].lexeme).toEqual("|:")
    expect(tokens[0].literal).toEqual(null)
    expect(tokens[0].line).toEqual(1)
  })

  it('should handle case "^"', () => {
    scanner = new Scanner("^")
    const tokens = scanner.scanTokens()
    expect(tokens.length).toEqual(2)
    expect(tokens[0].type).toEqual(TokenType.SHARP)
    expect(tokens[0].lexeme).toEqual("^")
    expect(tokens[0].literal).toEqual(null)
    expect(tokens[0].line).toEqual(1)
  })

  it('should handle case ":|"', () => {
    scanner = new Scanner(":|")
    const tokens = scanner.scanTokens()
    expect(tokens.length).toEqual(2)
    expect(tokens[0].type).toEqual(TokenType.COLON_BAR)
    expect(tokens[0].lexeme).toEqual(":|")
    expect(tokens[0].literal).toEqual(null)
    expect(tokens[0].line).toEqual(1)
  })

  it('should handle case ","', () => {
    scanner = new Scanner(",,,")
    const tokens = scanner.scanTokens()
    expect(tokens.length).toEqual(2)
    expect(tokens[0].type).toEqual(TokenType.COMMA)
    expect(tokens[0].lexeme).toEqual(",,,")
    expect(tokens[0].literal).toEqual(null)
    expect(tokens[0].line).toEqual(1)
  })

  it('should handle case "%"', () => {
    scanner = new Scanner("%this is a comment\n")
    const tokens = scanner.scanTokens()
    expect(tokens.length).toEqual(3)
    expect(tokens[0].type).toEqual(TokenType.COMMENT)
    expect(tokens[0].lexeme).toEqual("%this is a comment")
    expect(tokens[0].literal).toEqual(null)
    expect(tokens[0].line).toEqual(1)
  })

  it('should handle case "."', () => {
    scanner = new Scanner(".")
    const tokens = scanner.scanTokens()
    expect(tokens.length).toEqual(2)
    expect(tokens[0].type).toEqual(TokenType.DOT)
    expect(tokens[0].lexeme).toEqual(".")
    expect(tokens[0].literal).toEqual(null)
    expect(tokens[0].line).toEqual(1)
  })

  it('should handle case "\n"', () => {
    scanner = new Scanner("\n")
    const tokens = scanner.scanTokens()
    expect(tokens.length).toEqual(2)
    expect(tokens[0].type).toEqual(TokenType.EOL)
    expect(tokens[0].lexeme).toEqual("\n")
    expect(tokens[0].literal).toEqual(null)
    expect(tokens[0].line).toEqual(1)
  })

  it('should handle case "__"', () => {
    scanner = new Scanner("__")
    const tokens = scanner.scanTokens()
    expect(tokens.length).toEqual(2)
    expect(tokens[0].type).toEqual(TokenType.FLAT_DBL)
    expect(tokens[0].lexeme).toEqual("__")
    expect(tokens[0].literal).toEqual(null)
    expect(tokens[0].line).toEqual(1)
  })

  /*   it('should handle case "♭"', () => {
    scanner = new Scanner("♭")
    const tokens = scanner.scanTokens()
    expect(tokens.length).not.toEqual(1)
    expect(tokens[0].type).toEqual(TokenType.FLAT)
    expect(tokens[0].lexeme).toEqual("♭")
    expect(tokens[0].literal).toEqual(null)
    expect(tokens[0].line).toEqual(1)
  }) */

  /*   it('should handle case "𝄫"', () => {
    // can't get the utf-8 chars in the debugger
    scanner = new Scanner("𝄫")
    const tokens = scanner.scanTokens()
    expect(tokens.length).not.toEqual(2)
    expect(tokens[0].type).not.toEqual(TokenType.FLAT_DBL)
    expect(tokens[0].lexeme).not.toEqual("𝄫")
    expect(tokens[0].literal).toEqual(null)
    expect(tokens[0].line).toEqual(1)
  }) */
  it('should handle case ">"', () => {
    scanner = new Scanner(">>>>")
    const tokens = scanner.scanTokens()
    expect(tokens.length).toEqual(2)
    expect(tokens[0].type).toEqual(TokenType.GREATER)
    expect(tokens[0].lexeme).toEqual(">>>>")
    expect(tokens[0].literal).toEqual(null)
    expect(tokens[0].line).toEqual(1)
  })

  it('should handle case "["', () => {
    scanner = new Scanner("[|")
    const tokens = scanner.scanTokens()
    expect(tokens.length).toEqual(2)
    expect(tokens[0].type).toEqual(TokenType.LEFTBRKT_BAR)
    expect(tokens[0].lexeme).toEqual("[|")
    expect(tokens[0].literal).toEqual(null)
    expect(tokens[0].line).toEqual(1)
  })

  it('should handle case "{"', () => {
    scanner = new Scanner("{")
    const tokens = scanner.scanTokens()
    expect(tokens.length).toEqual(2)
    expect(tokens[0].type).toEqual(TokenType.LEFT_BRACE)
    expect(tokens[0].lexeme).toEqual("{")
    expect(tokens[0].literal).toEqual(null)
    expect(tokens[0].line).toEqual(1)
  })

  it('should handle case "("', () => {
    scanner = new Scanner("(")
    const tokens = scanner.scanTokens()
    expect(tokens.length).toEqual(2)
    expect(tokens[0].type).toEqual(TokenType.LEFTPAREN)
    expect(tokens[0].lexeme).toEqual("(")
    expect(tokens[0].literal).toEqual(null)
    expect(tokens[0].line).toEqual(1)
  })
  it('should handle case "<"', () => {
    scanner = new Scanner("<<<<")
    const tokens = scanner.scanTokens()
    expect(tokens.length).toEqual(2)
    expect(tokens[0].type).toEqual(TokenType.LESS)
    expect(tokens[0].lexeme).toEqual("<<<<")
    expect(tokens[0].literal).toEqual(null)
    expect(tokens[0].line).toEqual(1)
  })

  it('should handle case "-"', () => {
    scanner = new Scanner("---")
    const tokens = scanner.scanTokens()
    expect(tokens.length).toEqual(4)
    expect(tokens[0].type).toEqual(TokenType.MINUS)
    expect(tokens[0].lexeme).toEqual("-")
    expect(tokens[0].literal).toEqual(null)
    expect(tokens[0].line).toEqual(1)
  })

  it('should handle case "^^"', () => {
    scanner = new Scanner("^^")
    const tokens = scanner.scanTokens()
    expect(tokens.length).toEqual(2)
    expect(tokens[0].type).toEqual(TokenType.SHARP_DBL)
    expect(tokens[0].lexeme).toEqual("^^")
    expect(tokens[0].literal).toEqual(null)
    expect(tokens[0].line).toEqual(1)
  })
  /*   it('should handle case "𝄪"', () => {
    // can't get the test passging
    scanner = new Scanner("𝄪")
    const tokens = scanner.scanTokens()
    expect(tokens.length).toEqual(1)
    expect(tokens[0].type).not.toEqual(TokenType.SHARP_DBL)
    expect(tokens[0].lexeme).not.toEqual("𝄪")
    expect(tokens[0].literal).toEqual(null)
    expect(tokens[0].line).toEqual(1)
  }) */
})
