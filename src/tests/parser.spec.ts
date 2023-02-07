import { Parser } from "../Parser"
import {
  Annotation,
  BarLine,
  Chord,
  Comment,
  Symbol,
  Expr,
  File_header,
  File_structure,
  Grace_group,
  Info_line,
  Inline_field,
  Music_code,
  Note,
  Nth_repeat,
  Pitch,
  Tune_header,
  MultiMeasureRest,
  Slur_group,
  Rhythm,
} from "../Expr"
import chai from "chai"
import assert from "assert"
import Scanner from "../Scanner"
import Token from "../token"
const expect = chai.expect

describe("Parser", () => {
  describe("File structure", () => {
    it("parse should return null if nothing goes inside of the parser", () => {
      const result = new Parser([]).parse()
      assert.equal(result, null)
    })

    // it should parse file header
    it("should parse file headers", () => {
      const result = new Parser(
        new Scanner("%abc-2.2\nX:1\n").scanTokens()
      ).parse()
      expect(result).to.be.an.instanceof(File_structure)
      expect(result?.file_header).to.be.an.instanceof(File_header)
    })
    // it should parse tune headers
    it("should parse tune headers", () => {
      const result = new Parser(new Scanner("X:1\n").scanTokens()).parse()
      expect(result).to.be.an.instanceof(File_structure)
      expect(result?.tune[0].tune_header).to.be.an.instanceof(Tune_header)
      expect(result?.tune[0].tune_header.info_lines[0]).to.be.an.instanceof(
        Info_line
      )
      expect(result?.tune[0].tune_header.info_lines[0].key.lexeme).to.equal(
        "X:"
      )
    })
  })
  describe("Tune body", () => {
    describe("music code", () => {
      describe("Note", () => {
        it("should parse pitch", () => {
          const result = new Parser(new Scanner("X:1\nC").scanTokens()).parse()
          expect(result).to.be.an.instanceof(File_structure)
          const musicCode = result?.tune[0].tune_body?.sequence[0]
          expect(isMusicCode(musicCode)).to.be.true
          if (isMusicCode(musicCode)) {
            expect(musicCode.contents[0]).to.be.an.instanceof(Note)
            if (isNote(musicCode.contents[0])) {
              expect(musicCode.contents[0].pitch).to.be.an.instanceof(Pitch)
            }
          }
        })
        it("should parse octave", () => {
          const result = new Parser(new Scanner("X:1\nC'").scanTokens()).parse()
          const musicCode = result?.tune[0].tune_body?.sequence[0]
          if (isMusicCode(musicCode)) {
            expect(musicCode.contents[0]).to.be.an.instanceof(Note)
            if (
              isNote(musicCode.contents[0]) &&
              isPitch(musicCode.contents[0].pitch)
            ) {
              expect(musicCode.contents[0].pitch.octave).to.exist
              expect(musicCode.contents[0].pitch.octave?.lexeme).to.equal("'")
            }
          }
        })
        it("should parse alteration", () => {
          const result = new Parser(new Scanner("X:1\n^C").scanTokens()).parse()
          const musicCode = result?.tune[0].tune_body?.sequence[0]
          if (isMusicCode(musicCode)) {
            expect(musicCode.contents[0]).to.be.an.instanceof(Note)
            if (
              isNote(musicCode.contents[0]) &&
              isPitch(musicCode.contents[0].pitch)
            ) {
              expect(musicCode.contents[0].pitch.alteration).to.exist
              expect(musicCode.contents[0].pitch.alteration?.lexeme).to.equal(
                "^"
              )
            }
          }
        })
        describe("rhythm", () => {
          it("should parse single slash", () => {
            const result = new Parser(
              new Scanner("X:1\nC/").scanTokens()
            ).parse()
            const musicCode = result?.tune[0].tune_body?.sequence[0]
            if (isMusicCode(musicCode)) {
              expect(musicCode.contents[0]).to.be.an.instanceof(Note)
              if (isNote(musicCode.contents[0])) {
                expect(musicCode.contents[0].rhythm).to.exist
                if (isRhythm(musicCode.contents[0].rhythm)) {
                  expect(
                    musicCode.contents[0].rhythm?.separator?.lexeme
                  ).to.equal("/")
                }
              }
            }
          })
          it("should parse slash number", () => {
            const result = new Parser(
              new Scanner("X:1\nC/2").scanTokens()
            ).parse()
            const musicCode = result?.tune[0].tune_body?.sequence[0]
            if (isMusicCode(musicCode)) {
              expect(musicCode.contents[0]).to.be.an.instanceof(Note)
              if (isNote(musicCode.contents[0])) {
                expect(musicCode.contents[0].rhythm).to.exist
                if (isRhythm(musicCode.contents[0].rhythm)) {
                  expect(musicCode.contents[0].rhythm.denominator).to.exist
                  expect(
                    musicCode.contents[0].rhythm.denominator?.lexeme
                  ).to.equal("2")
                }
              }
            }
          })
          it("should parser number slash number", () => {
            const result = new Parser(
              new Scanner("X:1\nC2/2").scanTokens()
            ).parse()
            const musicCode = result?.tune[0].tune_body?.sequence[0]
            if (isMusicCode(musicCode)) {
              expect(musicCode.contents[0]).to.be.an.instanceof(Note)
              if (isNote(musicCode.contents[0])) {
                expect(musicCode.contents[0].rhythm).to.exist
                if (isRhythm(musicCode.contents[0].rhythm)) {
                  expect(musicCode.contents[0].rhythm.numerator).to.exist
                  expect(
                    musicCode.contents[0].rhythm.numerator?.lexeme
                  ).to.equal("2")
                  expect(musicCode.contents[0].rhythm.denominator).to.exist
                  expect(
                    musicCode.contents[0].rhythm.denominator?.lexeme
                  ).to.equal("2")
                }
              }
            }
          })
          it("should parse broken rhythm", () => {
            const result = new Parser(
              new Scanner("X:1\nC>>").scanTokens()
            ).parse()
            const musicCode = result?.tune[0].tune_body?.sequence[0]
            if (isMusicCode(musicCode)) {
              expect(musicCode.contents[0]).to.be.an.instanceof(Note)
              if (isNote(musicCode.contents[0])) {
                expect(musicCode.contents[0].rhythm).to.exist
                if (isRhythm(musicCode.contents[0].rhythm)) {
                  expect(musicCode.contents[0].rhythm.separator).to.exist
                  expect(
                    musicCode.contents[0].rhythm.separator?.lexeme
                  ).to.equal(">>")
                }
              }
            }
          })
        })
      })
      it("should parse barline", () => {
        const result = new Parser(new Scanner("X:1\n|").scanTokens()).parse()
        const musicCode = result?.tune[0].tune_body?.sequence[0]
        if (isMusicCode(musicCode)) {
          expect(musicCode.contents[0]).to.be.an.instanceof(BarLine)
          if (isBarLine(musicCode.contents[0])) {
            expect(musicCode.contents[0].barline.lexeme).to.equal("|")
          }
        }
      })
      it("should parse annotation", () => {
        const result = new Parser(
          new Scanner('X:1\n"string"').scanTokens()
        ).parse()
        const musicCode = result?.tune[0].tune_body?.sequence[0]
        if (isMusicCode(musicCode)) {
          expect(musicCode.contents[0]).to.be.an.instanceof(Annotation)
          if (isAnnotation(musicCode.contents[0])) {
            expect(musicCode.contents[0].text.lexeme).to.equal('"string"')
          }
        }
      })
      it("should parse grace group", () => {
        const result = new Parser(new Scanner("X:1\n{g}").scanTokens()).parse()
        const musicCode = result?.tune[0].tune_body?.sequence[0]
        if (isMusicCode(musicCode)) {
          expect(musicCode.contents[0]).to.be.an.instanceof(Grace_group)
          if (isGraceGroup(musicCode.contents[0])) {
            expect(musicCode.contents[0].notes[0]).to.be.an.instanceof(Note)
          }
        }
      })
      it("should parse Nth repeat", () => {
        const result = new Parser(new Scanner("X:1\n[1").scanTokens()).parse()
        const musicCode = result?.tune[0].tune_body?.sequence[0]
        if (isMusicCode(musicCode)) {
          expect(musicCode.contents[0]).to.be.an.instanceof(Nth_repeat)
          if (isNthRepeat(musicCode.contents[0])) {
            expect(musicCode.contents[0].repeat.lexeme).to.equal("[1")
          }
        }
      })
      it("should parse inline field", () => {
        const result = new Parser(
          new Scanner("X:1\n[M:3/4]").scanTokens()
        ).parse()
        const musicCode = result?.tune[0].tune_body?.sequence[0]
        if (isMusicCode(musicCode)) {
          expect(musicCode.contents[0]).to.be.an.instanceof(Inline_field)
          if (isInline_field(musicCode.contents[0])) {
            expect(musicCode.contents[0].field.lexeme).to.equal("M:")
            expect(musicCode.contents[0].text[0].lexeme).to.equal("3")
          }
        }
      })
      it("should parse chord", () => {
        const result = new Parser(new Scanner("X:1\n[C]").scanTokens()).parse()
        const musicCode = result?.tune[0].tune_body?.sequence[0]
        if (isMusicCode(musicCode)) {
          expect(musicCode.contents[0]).to.be.an.instanceof(Chord)
          if (isChord(musicCode.contents[0])) {
            expect(musicCode.contents[0].contents[0]).to.be.an.instanceof(Note)
          }
        }
      })
      it("should parse symbol", () => {
        const result = new Parser(
          new Scanner("X:1\n!fff!").scanTokens()
        ).parse()
        const musicCode = result?.tune[0].tune_body?.sequence[0]
        if (isMusicCode(musicCode)) {
          expect(musicCode.contents[0]).to.be.an.instanceof(Symbol)
          if (isSymbol(musicCode.contents[0])) {
            expect(musicCode.contents[0].symbol.lexeme).to.equal("!fff!")
          }
        }
      })
      it("should parse MultiMeasureRest", () => {
        const result = new Parser(new Scanner("X:1\nZ4").scanTokens()).parse()
        const musicCode = result?.tune[0].tune_body?.sequence[0]
        if (isMusicCode(musicCode)) {
          expect(musicCode.contents[0]).to.be.an.instanceof(MultiMeasureRest)
          if (isMultiMeasureRest(musicCode.contents[0])) {
            expect(musicCode.contents[0].rest.lexeme).to.equal("Z")
            expect(musicCode.contents[0].length).to.exist
            expect(musicCode.contents[0].length?.lexeme).to.equal("4")
          }
        }
      })
      it("should parse slur group", () => {
        const result = new Parser(
          new Scanner("X:1\n(abc)").scanTokens()
        ).parse()
        const musicCode = result?.tune[0].tune_body?.sequence[0]
        if (isMusicCode(musicCode)) {
          expect(musicCode.contents[0]).to.be.an.instanceof(Slur_group)
          if (isSlurGroup(musicCode.contents[0])) {
            expect(musicCode.contents[0].contents[0]).to.be.an.instanceof(Note)
          }
        }
      })
    })
    describe("comments", () => {
      it("should parse comment", () => {
        const result = new Parser(
          new Scanner("X:1\n%comment").scanTokens()
        ).parse()
        const comment = result?.tune[0].tune_body?.sequence[0]
        if (isComment(comment)) {
          expect(comment.text).to.equal("%comment")
        }
      })
    })
  })
})

const isMusicCode = (expr: Expr | undefined): expr is Music_code => {
  return expr instanceof Music_code
}
const isNote = (expr: Expr | undefined | Token): expr is Note => {
  return expr instanceof Note
}
const isBarLine = (expr: Expr | undefined | Token): expr is BarLine => {
  return expr instanceof BarLine
}
const isAnnotation = (expr: Expr | undefined | Token): expr is Annotation => {
  return expr instanceof Annotation
}
const isGraceGroup = (expr: Expr | undefined | Token): expr is Grace_group => {
  return expr instanceof Grace_group
}
const isNthRepeat = (expr: Expr | undefined | Token): expr is Nth_repeat => {
  return expr instanceof Nth_repeat
}
const isInline_field = (
  expr: Expr | undefined | Token
): expr is Inline_field => {
  return expr instanceof Inline_field
}
const isChord = (expr: Expr | undefined | Token): expr is Chord => {
  return expr instanceof Chord
}
const isSymbol = (expr: Expr | undefined | Token): expr is Symbol => {
  return expr instanceof Symbol
}
const isMultiMeasureRest = (
  expr: Expr | undefined | Token
): expr is MultiMeasureRest => {
  return expr instanceof MultiMeasureRest
}
const isSlurGroup = (expr: Expr | undefined | Token): expr is Slur_group => {
  return expr instanceof Slur_group
}
const isComment = (expr: Expr | undefined | Token): expr is Comment => {
  return expr instanceof Comment
}
const isPitch = (expr: Expr | undefined | Token): expr is Pitch => {
  return expr instanceof Pitch
}
const isRhythm = (expr: Expr | undefined | Token): expr is Rhythm => {
  return expr instanceof Rhythm
}
