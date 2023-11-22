import assert from "assert";
import chai from "chai";
import {
  Annotation,
  BarLine,
  Beam,
  Chord,
  Comment,
  Decoration,
  File_header,
  File_structure,
  Grace_group,
  Info_line,
  Inline_field,
  MultiMeasureRest,
  Note,
  Nth_repeat,
  Pitch,
  Rest,
  Symbol,
  Tune_header,
  YSPACER
} from "../Expr";
import { Parser } from "../Parser";
import { Scanner } from "../Scanner";
import { isAnnotation, isBarLine, isBeam, isChord, isComment, isGraceGroup, isInfo_line, isInline_field, isMultiMeasureRest, isNote, isNthRepeat, isPitch, isRest, isRhythm, isSymbol, isToken, isYSPACER } from "../helpers";
import { Token } from "../token";
import { TokenType } from "../types";
import { buildParse } from "./RhythmTransform.spec";
const expect = chai.expect;

describe("Parser", () => {
  describe("File structure", () => {
    it("parse should return null if nothing goes inside of the parser", () => {
      const result = new Parser([]).parse();
      assert.equal(result, null);
    });

    // it should parse file header
    it("should parse file headers", () => {
      const result = new Parser(
        new Scanner("%abc-2.2\nX:1\n").scanTokens()
      ).parse();
      expect(result).to.be.an.instanceof(File_structure);
      expect(result?.file_header).to.be.an.instanceof(File_header);
    });
    // it should parse tune headers
    describe("tune headers", () => {
      it("should parse tune headers", () => {
        const result = buildParse("");
        expect(result).to.be.an.instanceof(File_structure);
        expect(result?.tune[0].tune_header).to.be.an.instanceof(Tune_header);
        expect(result?.tune[0].tune_header.info_lines[0]).to.be.an.instanceof(
          Info_line
        );
        expect(result?.tune[0].tune_header.info_lines[0].key.lexeme).to.equal(
          "X:"
        );
      });
      it("should parse info lines in header", () => {
        const result = buildParse("T:Test Song\n");
        expect(result).to.be.an.instanceof(File_structure);
        expect(result?.tune[0].tune_header.info_lines[0]).to.be.an.instanceof(
          Info_line
        );
        expect(result?.tune[0].tune_header.info_lines[0].key.lexeme).to.equal(
          "X:"
        );
        expect(result?.tune[0].tune_header.info_lines[1]).to.be.an.instanceof(
          Info_line
        );
        expect(result?.tune[0].tune_header.info_lines[1].key.lexeme).to.equal(
          "T:"
        );
      });
      it("should parse broken info line in header", () => {
        const result =
          buildParse("I:Some info here\n+:More info");
        expect(result?.tune[0].tune_header.info_lines[1]).to.be.an.instanceof(
          Info_line
        );
        expect(result?.tune[0].tune_header.info_lines[1].key.lexeme).to.equal(
          "I:"
        );
        expect(
          result?.tune[0].tune_header.info_lines[1].value[0].lexeme
        ).to.equal("Some info here\n+:More info");
      });
    });
  });
  describe("Tune body", () => {
    describe("music code", () => {
      describe("Note", () => {
        it("should parse pitch", () => {
          const musicCode = buildParse("C").tune[0].tune_body?.sequence[0];
          expect(musicCode).to.be.instanceOf(Note);
          if (isNote(musicCode)) {
            expect(musicCode.pitch).to.be.an.instanceof(Pitch);
          }
        });
        it("should parse tied note", () => {
          const musicCode = buildParse("C-C").tune[0].tune_body?.sequence[0];
          expect(musicCode).to.be.an.instanceof(Beam);
          if (isBeam(musicCode)) {
            const firstNote = musicCode.contents[0];
            expect(firstNote).to.be.an.instanceof(Note);
            if (isNote(firstNote)) {
              expect(firstNote.pitch).to.be.an.instanceof(Pitch);
              if (isPitch(firstNote.pitch)) {
                expect(firstNote.pitch.noteLetter.lexeme).to.equal("C");
                expect(firstNote.tie).to.be.true;
              }
            }
          }
        });
        it("should parse octave", () => {
          const musicCode = buildParse("C'").tune[0].tune_body?.sequence[0];
          expect(musicCode).to.be.an.instanceof(Note);
          if (isNote(musicCode) && isPitch(musicCode.pitch)) {
            expect(musicCode.pitch.octave).to.exist;
            expect(musicCode.pitch.octave?.lexeme).to.equal("'");
          }
        });
        it("should parse alteration", () => {
          const musicCode = buildParse("^C").tune[0].tune_body?.sequence[0];
          expect(musicCode).to.be.an.instanceof(Note);
          if (isNote(musicCode) && isPitch(musicCode.pitch)) {
            expect(musicCode.pitch.alteration).to.exist;
            expect(musicCode.pitch.alteration?.lexeme).to.equal("^");
          }
        });
        describe("rhythm", () => {
          it("should parse single slash", () => {
            const musicCode = buildParse("C/").tune[0].tune_body?.sequence[0];
            expect(musicCode).to.be.an.instanceof(Note);
            if (isNote(musicCode) && isPitch(musicCode.pitch)) {
              expect(musicCode.rhythm).to.exist;
              if (isRhythm(musicCode.rhythm)) {
                expect(musicCode.rhythm?.separator?.lexeme).to.equal("/");
              }
            }
          });
          it("should parse slash number", () => {
            const musicCode = buildParse("C/2").tune[0].tune_body?.sequence[0];
            expect(musicCode).to.be.an.instanceof(Note);
            if (isNote(musicCode) && isPitch(musicCode.pitch)) {
              expect(musicCode.rhythm).to.exist;
              if (isRhythm(musicCode.rhythm)) {
                expect(musicCode.rhythm.denominator).to.exist;
                expect(musicCode.rhythm.denominator?.lexeme).to.equal("2");
              }
            }
          });
          it("should parser number slash number", () => {
            const musicCode = buildParse("C2/2").tune[0].tune_body?.sequence[0];
            expect(musicCode).to.be.an.instanceof(Note);
            if (isNote(musicCode) && isPitch(musicCode.pitch)) {
              expect(musicCode.rhythm).to.exist;
              if (isRhythm(musicCode.rhythm)) {
                expect(musicCode.rhythm.numerator).to.exist;
                expect(musicCode.rhythm.numerator?.lexeme).to.equal("2");
                expect(musicCode.rhythm.denominator).to.exist;
                expect(musicCode.rhythm.denominator?.lexeme).to.equal("2");
              }
            }
          });
          it("should parse broken rhythm", () => {
            const musicCode = buildParse("C>>").tune[0].tune_body?.sequence[0];
            expect(musicCode).to.be.an.instanceof(Note);
            if (isNote(musicCode) && isPitch(musicCode.pitch)) {
              expect(musicCode.rhythm).to.exist;
              if (isRhythm(musicCode.rhythm)) {
                expect(musicCode.rhythm.broken).to.exist;
                expect(musicCode.rhythm.broken?.lexeme).to.equal(">>");
              }
            }
          });
          it("should parse broken rhythm with number", () => {
            const musicCode = buildParse("C2>").tune[0].tune_body?.sequence[0];
            expect(musicCode).to.be.an.instanceof(Note);
            if (isNote(musicCode) && isPitch(musicCode.pitch)) {
              expect(musicCode.rhythm).to.exist;
              if (isRhythm(musicCode.rhythm)) {
                expect(musicCode.rhythm.broken).to.exist;
                expect(musicCode.rhythm.broken?.lexeme).to.equal(">");
                expect(musicCode.rhythm.numerator).to.exist;
                expect(musicCode.rhythm.numerator?.lexeme).to.equal("2");
              }
            }
          });
        });
      });
      describe("beam", () => {
        it("should parse beam", () => {
          const musicCode = buildParse("CAB").tune[0].tune_body?.sequence[0];
          expect(musicCode).to.be.an.instanceof(Beam);
          if (isBeam(musicCode)) {
            expect(musicCode.contents).to.be.an.instanceof(Array);
            musicCode.contents.forEach((note) => {
              expect(note).to.be.an.instanceof(Note);
            });
          }
        });
        it("should parse beam spanning closing parens", () => {
          const musicCode = buildParse(`CA)B`).tune[0].tune_body?.sequence[0];
          expect(musicCode).to.be.an.instanceof(Beam);
          if (isBeam(musicCode)) {
            expect(musicCode.contents).to.be.an.instanceof(Array);
            expect(musicCode.contents[2]).to.be.an.instanceof(Token);
          }
        });

        it("should parse multiple beams spanning parens", () => {
          const musicCode = buildParse(`CA(B CD)E`).tune[0].tune_body?.sequence;
          expect(musicCode).to.be.an.instanceof(Array);
          if (Array.isArray(musicCode)) {
            const [beam1, ws, beam2, ...rest] = musicCode;
            expect(beam1).to.be.an.instanceof(Beam);
            expect(ws).to.be.an.instanceof(Token);
            if (isToken(ws)) {
              assert.equal(ws.type, TokenType.WHITESPACE);
            }
            expect(beam2).to.be.an.instanceof(Beam);
          }
        });
      });
      it("should parse barline", () => {
        const musicCode = buildParse("|").tune[0].tune_body?.sequence[0];
        expect(musicCode).to.be.an.instanceof(BarLine);
        if (isBarLine(musicCode)) {
          expect(musicCode.barline.lexeme).to.equal("|");
        }
      });
      it("should parse annotation", () => {
        const musicCode = buildParse('"string"').tune[0].tune_body?.sequence[0];
        expect(musicCode).to.be.an.instanceof(Annotation);
        if (isAnnotation(musicCode)) {
          expect(musicCode.text.lexeme).to.equal('"string"');
        }
      });
      it("should parse grace group", () => {
        const musicCode = buildParse("{g}").tune[0].tune_body?.sequence[0];
        expect(musicCode).to.be.an.instanceof(Grace_group);
        if (isGraceGroup(musicCode)) {
          expect(musicCode.notes[0]).to.be.an.instanceof(Note);
        }
      });
      it("should parse accaciatura", () => {
        const musicCode = buildParse("{/ac}").tune[0].tune_body?.sequence[0];
        expect(musicCode).to.be.an.instanceof(Grace_group);
        if (isGraceGroup(musicCode)) {
          expect(musicCode.isAccacciatura).to.be.true;
        }
      });
      it("should parse repeat barline", () => {
        const result = buildParse(":|1");
        const barline = result.tune[0].tune_body?.sequence[0];
        if (barline) {
          expect(barline).to.be.an.instanceof(BarLine);
          if (isBarLine(barline)) {
            expect(barline.barline.lexeme).to.equal(":|");
          }
        }
        const repeat = result.tune[0].tune_body?.sequence[1];
        if (repeat) {
          expect(repeat).to.be.an.instanceof(Nth_repeat);
          if (isNthRepeat(repeat)) {
            expect(repeat.repeat.lexeme).to.equal("1");
          }
        }
      });
      it("should parse repeat barline with number", () => {
        const result = buildParse("|2");
        const barline = result.tune[0].tune_body?.sequence[0];
        if (barline) {
          expect(barline).to.be.an.instanceof(BarLine);
          if (isBarLine(barline)) {
            expect(barline.barline.lexeme).to.equal("|");
          }
        }
        const repeat = result?.tune[0].tune_body?.sequence[1];
        if (repeat) {
          expect(repeat).to.be.an.instanceof(Nth_repeat);
          if (isNthRepeat(repeat)) {
            expect(repeat.repeat.lexeme).to.equal("2");
          }
        }
      });
      it("should parse Nth repeat", () => {
        const musicCode = buildParse("[1").tune[0].tune_body?.sequence[0];
        expect(musicCode).to.be.an.instanceof(Nth_repeat);
        if (isNthRepeat(musicCode)) {
          expect(musicCode.repeat.lexeme).to.equal("[1");
        }
      });
      it("should parse inline field", () => {
        const musicCode = buildParse("[M:3/4]").tune[0].tune_body?.sequence[0];
        expect(musicCode).to.be.an.instanceof(Inline_field);
        if (isInline_field(musicCode)) {
          expect(musicCode.field.lexeme).to.equal("M:");
          expect(musicCode.text[0].lexeme).to.equal("3");
        }
      });
      it("should parse info_line in body", () => {
        const musicCode = buildParse("K:C\nabc\nT:Title").tune[0].tune_body?.sequence[2];
        expect(musicCode).to.be.an.instanceof(Info_line);
        if (isInfo_line(musicCode)) {
          expect(musicCode.key.lexeme).to.equal("T:");
          expect(musicCode.value[0].lexeme).to.equal("Title");
        }
      });
      it("should parse chord", () => {
        const musicCode = buildParse('["suprise"C]4').tune[0].tune_body?.sequence[0];
        expect(musicCode).to.be.an.instanceof(Chord);
        if (isChord(musicCode)) {
          expect(musicCode.rhythm).to.exist;
          expect(musicCode.contents[0]).to.be.an.instanceof(Annotation);
          expect(musicCode.contents[1]).to.be.an.instanceof(Note);
        }
      });
      it("should parse beam", () => {
        const musicCode = buildParse("[CA]ABC").tune[0].tune_body?.sequence[0];
        expect(musicCode).to.be.an.instanceof(Beam);
        if (isBeam(musicCode)) {
          expect(musicCode.contents[0]).to.be.an.instanceof(Chord);;
          expect(musicCode.contents[1]).to.be.an.instanceof(Note);
        }
      });
      it("should parse symbol", () => {
        const musicCode = buildParse("!fff!").tune[0].tune_body?.sequence[0];
        expect(musicCode).to.be.an.instanceof(Symbol);
        if (isSymbol(musicCode)) {
          expect(musicCode.symbol.lexeme).to.equal("!fff!");
        }
      });
      it("should parse basic rests", () => {
        const musicCode = buildParse("z4").tune[0].tune_body?.sequence[0];
        expect(musicCode).to.be.an.instanceof(Note);
        if (isNote(musicCode)) {
          musicCode.pitch;
          expect(musicCode.pitch).to.be.an.instanceof(Rest);
          if (isRest(musicCode.pitch)) {
            expect(musicCode.pitch.rest.lexeme).to.equal("z");
          }
        }
      });
      it("should parse MultiMeasureRest", () => {
        const result = buildParse("Z4Z");
        const firstRest = result.tune[0].tune_body?.sequence[0];
        if (firstRest) {
          expect(firstRest).to.be.an.instanceof(MultiMeasureRest);
          if (isMultiMeasureRest(firstRest)) {
            expect(firstRest.rest.lexeme).to.equal("Z");
            expect(firstRest.length).to.exist;
            expect(firstRest.length?.lexeme).to.equal("4");
          }
        }
        const secondRest = result.tune[0].tune_body?.sequence[1];
        if (secondRest) {
          expect(secondRest).to.be.an.instanceof(MultiMeasureRest);
          if (isMultiMeasureRest(secondRest)) {
            expect(secondRest.rest.lexeme).to.equal("Z");
            expect(secondRest.length).to.not.exist;
          }
        }
      });
      it("should parse EOL", () => {
        const musicCode = buildParse("|\\\n\n").tune[0].tune_body?.sequence[1];
        expect(musicCode).to.be.an.instanceof(Token);
      });
      it("should parse decoration", () => {
        const musicCode = buildParse(".a2").tune[0].tune_body?.sequence[0];
        expect(musicCode).to.be.an.instanceof(Decoration);
        if (isToken(musicCode)) {
          expect(musicCode.lexeme).to.equal(".");
        }
      });
      it("should parse letter decoration", () => {
        const musicCode = buildParse("Ha2").tune[0].tune_body?.sequence[0];
        expect(musicCode).to.be.an.instanceof(Decoration);
        if (isToken(musicCode)) {
          expect(musicCode.lexeme).to.equal("H");
        }
      });
      it("should parse y spacer", () => {
        const musicCode = buildParse("y2").tune[0].tune_body?.sequence[0];
        if (musicCode) {
          expect(musicCode).to.be.an.instanceof(YSPACER);
          if (isYSPACER(musicCode)) {
            expect(musicCode.ySpacer.lexeme).to.equal("y");
            expect(musicCode.number?.lexeme).to.equal("2");
          }
        }
      });
    });
    describe("comments", () => {
      it("should parse comment", () => {
        const comment = buildParse("%comment").tune[0].tune_body?.sequence[0];
        if (isComment(comment)) {
          expect(comment.text).to.equal("%comment");
        }
      });
      it("should figure out the correct position for comments", () => {

        const comment = buildParse("A B\n%comment").tune[0].tune_body?.sequence[4];
        expect(comment).to.not.be.undefined;

        expect(comment).to.be.an.instanceof(Comment);
        if (isComment(comment)) {
          assert.equal(comment.token.type, TokenType.COMMENT);
          assert.equal(comment.token.lexeme, "%comment");
          assert.equal(comment.token.literal, null);
          assert.equal(comment.token.line, 2);
          assert.equal(comment.token.position, 0);
        }
      });
    });
  });
  describe("synchronize in case of error", () => {
    it("synchronize after an unexpected token", () => {
      const musicCode = buildParse("~23 a bc\na,,").tune[0].tune_body?.sequence[0];
      if (musicCode) {
        expect(musicCode).to.be.an.instanceof(Note);
      }
    });
  });


});

