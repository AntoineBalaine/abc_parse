import { Parser } from "../Parser"
import { File_structure, Info_line, Pitch, Tune_header } from "../Expr"
import chai from "chai"
import assert from "assert"
import Scanner from "../Scanner"
const expect = chai.expect

describe("Pitch", () => {
  let parser: Parser

  it("parse should return null if nothing goes inside of the parser", () => {
    parser = new Parser([])
    const result = parser.parse()
    assert.equal(result, null)
  })

  it("should accept empty tunes", () => {
    let scanner = new Scanner("X:1\n")
    const tokens = scanner.scanTokens()
    parser = new Parser(tokens)
    const result = parser.parse()
    // assert result to be an instance of file structure
    // that only containes a tune
    // that only contains an info line
    expect(result).to.be.an.instanceof(File_structure)
    expect(result?.tune[0].tune_header).to.be.an.instanceof(Tune_header)
    expect(result?.tune[0].tune_header.info_lines[0]).to.be.an.instanceof(
      Info_line
    )
    expect(result?.tune[0].tune_header.info_lines[0].key.lexeme).to.equal("X:")
  })
})
