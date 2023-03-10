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
  Rest,
  Decoration,
  YSPACER,
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
    describe("tune headers", () => {
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
      it("should parse info lines in header", () => {
        const result = new Parser(
          new Scanner("X:1\nT:Test Song\n").scanTokens()
        ).parse()
        expect(result).to.be.an.instanceof(File_structure)
        expect(result?.tune[0].tune_header.info_lines[0]).to.be.an.instanceof(
          Info_line
        )
        expect(result?.tune[0].tune_header.info_lines[0].key.lexeme).to.equal(
          "X:"
        )
        expect(result?.tune[0].tune_header.info_lines[1]).to.be.an.instanceof(
          Info_line
        )
        expect(result?.tune[0].tune_header.info_lines[1].key.lexeme).to.equal(
          "T:"
        )
      })
      it("should parse broken info line in header", () => {
        const result = new Parser(
          new Scanner("X:1\nI:Some info here\n+:More info").scanTokens()
        ).parse()
        expect(result?.tune[0].tune_header.info_lines[1]).to.be.an.instanceof(
          Info_line
        )
        expect(result?.tune[0].tune_header.info_lines[1].key.lexeme).to.equal(
          "I:"
        )
        expect(
          result?.tune[0].tune_header.info_lines[1].value[0].lexeme
        ).to.equal("Some info here\n+:More info")
      })
    })
  })
  describe("Tune body", () => {
    describe("music code", () => {
      describe("Note", () => {
        it("should parse pitch", () => {
          const result = new Parser(new Scanner("X:1\nC").scanTokens()).parse()
          expect(result).to.be.an.instanceof(File_structure)
          const musicCode = result?.tune[0].tune_body?.sequence[0]
          if (musicCode) {
            expect(musicCode).to.be.instanceOf(Note)
            if (isNote(musicCode)) {
              expect(musicCode.pitch).to.be.an.instanceof(Pitch)
            }
          }
        })
        it("should parse tied note", () => {
          const result = new Parser(
            new Scanner("X:1\nC-C").scanTokens()
          ).parse()
          const musicCode = result?.tune[0].tune_body?.sequence[0]
          if (musicCode) {
            expect(musicCode).to.be.an.instanceof(Note)
            if (isNote(musicCode)) {
              expect(musicCode.pitch).to.be.an.instanceof(Pitch)
              if (isPitch(musicCode.pitch)) {
                expect(musicCode.pitch.noteLetter.lexeme).to.equal("C")
                expect(musicCode.tie).to.be.true
              }
            }
          }
        })
        it("should parse octave", () => {
          const result = new Parser(new Scanner("X:1\nC'").scanTokens()).parse()
          const musicCode = result?.tune[0].tune_body?.sequence[0]
          if (musicCode) {
            expect(musicCode).to.be.an.instanceof(Note)
            if (isNote(musicCode) && isPitch(musicCode.pitch)) {
              expect(musicCode.pitch.octave).to.exist
              expect(musicCode.pitch.octave?.lexeme).to.equal("'")
            }
          }
        })
        it("should parse alteration", () => {
          const result = new Parser(new Scanner("X:1\n^C").scanTokens()).parse()
          const musicCode = result?.tune[0].tune_body?.sequence[0]
          if (musicCode) {
            expect(musicCode).to.be.an.instanceof(Note)
            if (isNote(musicCode) && isPitch(musicCode.pitch)) {
              expect(musicCode.pitch.alteration).to.exist
              expect(musicCode.pitch.alteration?.lexeme).to.equal("^")
            }
          }
        })
        describe("rhythm", () => {
          it("should parse single slash", () => {
            const result = new Parser(
              new Scanner("X:1\nC/").scanTokens()
            ).parse()
            const musicCode = result?.tune[0].tune_body?.sequence[0]
            if (musicCode) {
              expect(musicCode).to.be.an.instanceof(Note)
              if (isNote(musicCode) && isPitch(musicCode.pitch)) {
                expect(musicCode.rhythm).to.exist
                if (isRhythm(musicCode.rhythm)) {
                  expect(musicCode.rhythm?.separator?.lexeme).to.equal("/")
                }
              }
            }
          })
          it("should parse slash number", () => {
            const result = new Parser(
              new Scanner("X:1\nC/2").scanTokens()
            ).parse()
            const musicCode = result?.tune[0].tune_body?.sequence[0]
            if (musicCode) {
              expect(musicCode).to.be.an.instanceof(Note)
              if (isNote(musicCode) && isPitch(musicCode.pitch)) {
                expect(musicCode.rhythm).to.exist
                if (isRhythm(musicCode.rhythm)) {
                  expect(musicCode.rhythm.denominator).to.exist
                  expect(musicCode.rhythm.denominator?.lexeme).to.equal("2")
                }
              }
            }
          })
          it("should parser number slash number", () => {
            const result = new Parser(
              new Scanner("X:1\nC2/2").scanTokens()
            ).parse()
            const musicCode = result?.tune[0].tune_body?.sequence[0]
            if (musicCode) {
              expect(musicCode).to.be.an.instanceof(Note)
              if (isNote(musicCode) && isPitch(musicCode.pitch)) {
                expect(musicCode.rhythm).to.exist
                if (isRhythm(musicCode.rhythm)) {
                  expect(musicCode.rhythm.numerator).to.exist
                  expect(musicCode.rhythm.numerator?.lexeme).to.equal("2")
                  expect(musicCode.rhythm.denominator).to.exist
                  expect(musicCode.rhythm.denominator?.lexeme).to.equal("2")
                }
              }
            }
          })
          it("should parse broken rhythm", () => {
            const result = new Parser(
              new Scanner("X:1\nC>>").scanTokens()
            ).parse()
            const musicCode = result?.tune[0].tune_body?.sequence[0]
            if (musicCode) {
              expect(musicCode).to.be.an.instanceof(Note)
              if (isNote(musicCode) && isPitch(musicCode.pitch)) {
                expect(musicCode.rhythm).to.exist
                if (isRhythm(musicCode.rhythm)) {
                  expect(musicCode.rhythm.broken).to.exist
                  expect(musicCode.rhythm.broken?.lexeme).to.equal(">>")
                }
              }
            }
          })
          it("should parse broken rhythm with number", () => {
            const result = new Parser(
              new Scanner("X:1\nC2>").scanTokens()
            ).parse()
            const musicCode = result?.tune[0].tune_body?.sequence[0]
            if (musicCode) {
              expect(musicCode).to.be.an.instanceof(Note)
              if (isNote(musicCode) && isPitch(musicCode.pitch)) {
                expect(musicCode.rhythm).to.exist
                if (isRhythm(musicCode.rhythm)) {
                  expect(musicCode.rhythm.broken).to.exist
                  expect(musicCode.rhythm.broken?.lexeme).to.equal(">")
                  expect(musicCode.rhythm.numerator).to.exist
                  expect(musicCode.rhythm.numerator?.lexeme).to.equal("2")
                }
              }
            }
          })
        })
      })
      it("should parse barline", () => {
        const result = new Parser(new Scanner("X:1\n|").scanTokens()).parse()
        const musicCode = result?.tune[0].tune_body?.sequence[0]
        if (musicCode) {
          expect(musicCode).to.be.an.instanceof(BarLine)
          if (isBarLine(musicCode)) {
            expect(musicCode.barline.lexeme).to.equal("|")
          }
        }
      })
      it("should parse annotation", () => {
        const result = new Parser(
          new Scanner('X:1\n"string"').scanTokens()
        ).parse()
        const musicCode = result?.tune[0].tune_body?.sequence[0]
        if (musicCode) {
          expect(musicCode).to.be.an.instanceof(Annotation)
          if (isAnnotation(musicCode)) {
            expect(musicCode.text.lexeme).to.equal('"string"')
          }
        }
      })
      it("should parse grace group", () => {
        const result = new Parser(new Scanner("X:1\n{g}").scanTokens()).parse()
        const musicCode = result?.tune[0].tune_body?.sequence[0]
        if (musicCode) {
          expect(musicCode).to.be.an.instanceof(Grace_group)
          if (isGraceGroup(musicCode)) {
            expect(musicCode.notes[0]).to.be.an.instanceof(Note)
          }
        }
      })
      it("should parse accaciatura", () => {
        const result = new Parser(
          new Scanner("X:1\n{/ac}").scanTokens()
        ).parse()
        const musicCode = result?.tune[0].tune_body?.sequence[0]
        if (musicCode) {
          expect(musicCode).to.be.an.instanceof(Grace_group)
          if (isGraceGroup(musicCode)) {
            expect(musicCode.isAccacciatura).to.be.true
          }
        }
      })
      it("should parse repeat barline", () => {
        const result = new Parser(new Scanner("X:1\n:|1").scanTokens()).parse()
        const barline = result?.tune[0].tune_body?.sequence[0]
        if (barline) {
          expect(barline).to.be.an.instanceof(BarLine)
          if (isBarLine(barline)) {
            expect(barline.barline.lexeme).to.equal(":|")
          }
        }
        const repeat = result?.tune[0].tune_body?.sequence[1]
        if (repeat) {
          expect(repeat).to.be.an.instanceof(Nth_repeat)
          if (isNthRepeat(repeat)) {
            expect(repeat.repeat.lexeme).to.equal("1")
          }
        }
      })
      it("should parse repeat barline with number", () => {
        const result = new Parser(new Scanner("X:1\n|2").scanTokens()).parse()
        const barline = result?.tune[0].tune_body?.sequence[0]
        if (barline) {
          expect(barline).to.be.an.instanceof(BarLine)
          if (isBarLine(barline)) {
            expect(barline.barline.lexeme).to.equal("|")
          }
        }
        const repeat = result?.tune[0].tune_body?.sequence[1]
        if (repeat) {
          expect(repeat).to.be.an.instanceof(Nth_repeat)
          if (isNthRepeat(repeat)) {
            expect(repeat.repeat.lexeme).to.equal("2")
          }
        }
      })
      it("should parse Nth repeat", () => {
        const result = new Parser(new Scanner("X:1\n[1").scanTokens()).parse()
        const musicCode = result?.tune[0].tune_body?.sequence[0]
        if (musicCode) {
          expect(musicCode).to.be.an.instanceof(Nth_repeat)
          if (isNthRepeat(musicCode)) {
            expect(musicCode.repeat.lexeme).to.equal("[1")
          }
        }
      })
      it("should parse inline field", () => {
        const result = new Parser(
          new Scanner("X:1\n[M:3/4]").scanTokens()
        ).parse()
        const musicCode = result?.tune[0].tune_body?.sequence[0]
        if (musicCode) {
          expect(musicCode).to.be.an.instanceof(Inline_field)
          if (isInline_field(musicCode)) {
            expect(musicCode.field.lexeme).to.equal("M:")
            expect(musicCode.text[0].lexeme).to.equal("3")
          }
        }
      })
      it("should parse info_line in body", () => {
        const result = new Parser(
          new Scanner("X:1\nK:C\nabc\nT:Title").scanTokens()
        ).parse()
        const musicCode = result?.tune[0].tune_body?.sequence[4]
        if (musicCode) {
          expect(musicCode).to.be.an.instanceof(Info_line)
          if (isInfo_line(musicCode)) {
            expect(musicCode.key.lexeme).to.equal("T:")
            expect(musicCode.value[0].lexeme).to.equal("Title")
          }
        }
      })
      it("should parse chord", () => {
        const result = new Parser(
          new Scanner('X:1\n["suprise"C]4').scanTokens()
        ).parse()
        const musicCode = result?.tune[0].tune_body?.sequence[0]
        if (musicCode) {
          expect(musicCode).to.be.an.instanceof(Chord)
          if (isChord(musicCode)) {
            expect(musicCode.rhythm).to.exist
            expect(musicCode.contents[0]).to.be.an.instanceof(Annotation)
            expect(musicCode.contents[1]).to.be.an.instanceof(Note)
          }
        }
      })
      it("should parse symbol", () => {
        const result = new Parser(
          new Scanner("X:1\n!fff!").scanTokens()
        ).parse()
        const musicCode = result?.tune[0].tune_body?.sequence[0]
        if (musicCode) {
          expect(musicCode).to.be.an.instanceof(Symbol)
          if (isSymbol(musicCode)) {
            expect(musicCode.symbol.lexeme).to.equal("!fff!")
          }
        }
      })
      it("should parse basic rests", () => {
        const result = new Parser(new Scanner("X:1\nz4").scanTokens()).parse()
        const musicCode = result?.tune[0].tune_body?.sequence[0]
        if (musicCode) {
          expect(musicCode).to.be.an.instanceof(Note)
          if (isNote(musicCode)) {
            musicCode.pitch
            expect(musicCode.pitch).to.be.an.instanceof(Rest)
            if (isRest(musicCode.pitch)) {
              expect(musicCode.pitch.rest.lexeme).to.equal("z")
            }
          }
        }
      })
      it("should parse MultiMeasureRest", () => {
        const result = new Parser(new Scanner("X:1\nZ4Z").scanTokens()).parse()
        const firstRest = result?.tune[0].tune_body?.sequence[0]
        if (firstRest) {
          expect(firstRest).to.be.an.instanceof(MultiMeasureRest)
          if (isMultiMeasureRest(firstRest)) {
            expect(firstRest.rest.lexeme).to.equal("Z")
            expect(firstRest.length).to.exist
            expect(firstRest.length?.lexeme).to.equal("4")
          }
        }
        const secondRest = result?.tune[0].tune_body?.sequence[1]
        if (secondRest) {
          expect(secondRest).to.be.an.instanceof(MultiMeasureRest)
          if (isMultiMeasureRest(secondRest)) {
            expect(secondRest.rest.lexeme).to.equal("Z")
            expect(secondRest.length).to.not.exist
          }
        }
      })
      it("should parse slur group", () => {
        const result = new Parser(
          new Scanner("X:1\n(abc)").scanTokens()
        ).parse()
        const musicCode = result?.tune[0].tune_body?.sequence[0]
        if (musicCode) {
          expect(musicCode).to.be.an.instanceof(Slur_group)
          if (isSlurGroup(musicCode)) {
            expect(musicCode.contents[0]).to.be.an.instanceof(Note)
          }
        }
      })
      it("should parse EOL", () => {
        const result = new Parser(
          new Scanner("X:1\n|\\\n\n").scanTokens()
        ).parse()
        const musicCode = result?.tune[0].tune_body?.sequence[1]
        if (musicCode) {
          expect(musicCode).to.be.an.instanceof(Token)
        }
      })
      it("should parse decoration", () => {
        const result = new Parser(new Scanner("X:1\n.a2").scanTokens()).parse()
        const musicCode = result?.tune[0].tune_body?.sequence[0]
        if (musicCode) {
          expect(musicCode).to.be.an.instanceof(Decoration)
          if (isToken(musicCode)) {
            expect(musicCode.lexeme).to.equal(".")
          }
        }
      })
      it("should parse letter decoration", () => {
        const result = new Parser(new Scanner("X:1\nHa2").scanTokens()).parse()
        const musicCode = result?.tune[0].tune_body?.sequence[0]
        if (musicCode) {
          expect(musicCode).to.be.an.instanceof(Decoration)
          if (isToken(musicCode)) {
            expect(musicCode.lexeme).to.equal("H")
          }
        }
      })
      it("should parse y spacer", () => {
        const result = new Parser(new Scanner("X:1\ny2").scanTokens()).parse()
        const musicCode = result?.tune[0].tune_body?.sequence[0]
        if (musicCode) {
          expect(musicCode).to.be.an.instanceof(YSPACER)
          if (isYSPACER(musicCode)) {
            expect(musicCode.ySpacer.lexeme).to.equal("y")
            expect(musicCode.number?.lexeme).to.equal("2")
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
  describe("synchronize in case of error", () => {
    it("synchronize after an unexpected token", () => {
      const result = new Parser(
        new Scanner("X:1\n~23 a bc\na,,").scanTokens()
      ).parse()
      const musicCode = result?.tune[0].tune_body?.sequence[0]
      if (musicCode) {
        expect(musicCode).to.be.an.instanceof(Note)
      }
    })
  })
})

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
const isRest = (expr: Expr | undefined | Token): expr is Rest => {
  return expr instanceof Rest
}
const isToken = (expr: Expr | undefined | Token): expr is Token => {
  return expr instanceof Token
}
const isInfo_line = (expr: Expr | undefined | Token): expr is Info_line => {
  return expr instanceof Info_line
}
function isYSPACER(expr: Expr | Token): expr is YSPACER {
  return expr instanceof YSPACER
}
