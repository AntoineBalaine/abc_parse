import { assert } from "chai";
import chai from "chai";
import { Parser } from "../parsers/Parser";
import { Scanner } from "../parsers/Scanner";
import { AbcFormatter } from "../Visitors/Formatter";
import {
  isAnnotation,
  isBarLine,
  isBeam,
  isChord,
  isComment,
  isGraceGroup,
  isInfo_line,
  isInline_field,
  isMultiMeasureRest,
  isNote,
  isPitch,
  isRest,
  isRhythm,
  isSymbol,
  isToken,
  isVoice_overlay,
  isYSPACER,
} from "../helpers";
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
  Pitch,
  Rest,
  Symbol,
  Tune_header,
  Tuplet,
  Voice_overlay,
  YSPACER,
} from "../types/Expr";
import { Token } from "../types/token";
import { TokenType } from "../types/types";
import { buildParse, tuneHeader } from "./RhythmTransform.spec";
import { ABCContext } from "../parsers/Context";
const expect = chai.expect;

describe("Parser", () => {
  describe("File structure", () => {
    it("parse should return null if nothing goes inside of the parser", () => {
      const ctx = new ABCContext();
      const result = new Parser([], ctx).parse();
      assert.equal(result, null);
    });

    // it should parse file header
    it("should parse file headers", () => {
      const ctx = new ABCContext();
      const result = new Parser(new Scanner("%abc-2.2\nX:1\n", ctx).scanTokens(), ctx).parse();
      expect(result).to.be.an.instanceof(File_structure);
      expect(result?.file_header).to.be.an.instanceof(File_header);
    });
    // it should parse tune headers
    describe("tune headers", () => {
      it("should parse tune headers", () => {
        const ctx = new ABCContext();
        const result = buildParse("", ctx);
        expect(result).to.be.an.instanceof(File_structure);
        expect(result?.tune[0].tune_header).to.be.an.instanceof(Tune_header);
        expect(result?.tune[0].tune_header.info_lines[0]).to.be.an.instanceof(Info_line);
        const infoLine = result?.tune[0].tune_header.info_lines[0];
        if (isInfo_line(infoLine)) {
          expect(infoLine.key.lexeme).to.equal("X:");
        }
      });
      it("should parse info lines in header", () => {
        const ctx = new ABCContext();
        const result = buildParse("T:Test Song\n", ctx);
        expect(result).to.be.an.instanceof(File_structure);
        expect(result?.tune[0].tune_header.info_lines[0]).to.be.an.instanceof(Info_line);
        const infoLine1 = result?.tune[0].tune_header.info_lines[0];
        if (isInfo_line(infoLine1)) {
          expect(infoLine1.key.lexeme).to.equal("X:");
        }
        expect(result?.tune[0].tune_header.info_lines[1]).to.be.an.instanceof(Info_line);
        const infoLine2 = result?.tune[0].tune_header.info_lines[1];
        if (isInfo_line(infoLine2)) {
          expect(infoLine2.key.lexeme).to.equal("T:");
        }
      });
      it("should parse broken info line in header", () => {
        const ctx = new ABCContext();
        const result = buildParse("I:Some info here\n+:More info", ctx);
        expect(result?.tune[0].tune_header.info_lines[1]).to.be.an.instanceof(Info_line);
        const infoLine1 = result?.tune[0].tune_header.info_lines[1];
        if (isInfo_line(infoLine1)) {
          expect(infoLine1.key.lexeme).to.equal("I:");
        }
        const infoLine2 = result?.tune[0].tune_header.info_lines[1];
        if (isInfo_line(infoLine2)) {
          expect(infoLine2.value[0].lexeme).to.equal("Some info here\n+:More info");
        }
      });
    });
  });
  describe("Tune body", () => {
    describe("music code", () => {
      describe("Note", () => {
        it("should parse pitch", () => {
          const ctx = new ABCContext();
          const musicCode = buildParse("C", ctx).tune[0].tune_body?.sequence[0][0];
          expect(musicCode).to.be.instanceOf(Note);
          if (isNote(musicCode)) {
            expect(musicCode.pitch).to.be.an.instanceof(Pitch);
          }
        });
        it("should parse tied note", () => {
          const ctx = new ABCContext();
          const musicCode = buildParse("C-C", ctx).tune[0].tune_body?.sequence[0][0];
          expect(musicCode).to.be.an.instanceof(Beam);
          if (isBeam(musicCode)) {
            const firstNote = musicCode.contents[0];
            expect(firstNote).to.be.an.instanceof(Note);
            if (isNote(firstNote)) {
              expect(firstNote.pitch).to.be.an.instanceof(Pitch);
              if (isPitch(firstNote.pitch)) {
                expect(firstNote.pitch.noteLetter.lexeme).to.equal("C");
                expect(firstNote.tie).to.be.instanceof(Token);
              }
            }
          }
        });
        it("should parse voice overlay", () => {
          const ctx = new ABCContext();
          const musicCode = buildParse("&&&", ctx).tune[0].tune_body?.sequence[0][0];
          expect(musicCode).to.be.an.instanceof(Voice_overlay);
          if (isVoice_overlay(musicCode)) {
            expect(musicCode.contents[0].lexeme).to.equal("&");
          }
        });
        it("should parse octave", () => {
          const ctx = new ABCContext();
          const musicCode = buildParse("C'", ctx).tune[0].tune_body?.sequence[0][0];
          expect(musicCode).to.be.an.instanceof(Note);
          if (isNote(musicCode) && isPitch(musicCode.pitch)) {
            expect(musicCode.pitch.octave).to.exist;
            expect(musicCode.pitch.octave?.lexeme).to.equal("'");
          }
        });
        it("should parse alteration", () => {
          ["^C", "_C", "=C", "^/C", "_/C"].forEach((input) => {
            const ctx = new ABCContext();
            const musicCode = buildParse(input, ctx).tune[0].tune_body?.sequence[0][0];
            expect(musicCode).to.be.an.instanceof(Note);
            if (isNote(musicCode) && isPitch(musicCode.pitch)) {
              expect(musicCode.pitch.alteration).to.exist;
              expect(musicCode.pitch.alteration?.lexeme).to.equal(input.substring(0, input.length - 1));
            }
          });
        });
        describe("rhythm", () => {
          it("should parse single slash", () => {
            const ctx = new ABCContext();
            const musicCode = buildParse("C/", ctx).tune[0].tune_body?.sequence[0][0];
            expect(musicCode).to.be.an.instanceof(Note);
            if (isNote(musicCode) && isPitch(musicCode.pitch)) {
              expect(musicCode.rhythm).to.exist;
              if (isRhythm(musicCode.rhythm)) {
                expect(musicCode.rhythm?.separator?.lexeme).to.equal("/");
              }
            }
          });
          it("should parse slash number", () => {
            const ctx = new ABCContext();
            const musicCode = buildParse("C/2", ctx).tune[0].tune_body?.sequence[0][0];
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
            const ctx = new ABCContext();
            const musicCode = buildParse("C2/2", ctx).tune[0].tune_body?.sequence[0][0];
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
          describe("should parse broken rhythm", () => {
            const cases = [
              ["C>>", ">>"],
              ["C<<", "<<"],
              ["C>", ">"],
            ];
            cases.forEach(([input, expected]) => {
              it(`should find broken rhythm ${expected} in ${input}`, () => {
                const ctx = new ABCContext();
                const musicCode = buildParse(input, ctx).tune[0].tune_body?.sequence[0][0];
                expect(musicCode).to.be.an.instanceof(Note);
                if (isNote(musicCode) && isPitch(musicCode.pitch)) {
                  expect(musicCode.rhythm).to.exist;
                  if (isRhythm(musicCode.rhythm)) {
                    expect(musicCode.rhythm.broken).to.exist;
                    expect(musicCode.rhythm.broken?.lexeme).to.equal(expected);
                  }
                }
              });
            });
          });
          it("should parse broken rhythm with number", () => {
            const ctx = new ABCContext();
            const musicCode = buildParse("C2>", ctx).tune[0].tune_body?.sequence[0][0];
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
          const ctx = new ABCContext();
          const musicCode = buildParse("CAB", ctx).tune[0].tune_body?.sequence[0][0];
          expect(musicCode).to.be.an.instanceof(Beam);
          if (isBeam(musicCode)) {
            expect(musicCode.contents).to.be.an.instanceof(Array);
            musicCode.contents.forEach((note) => {
              expect(note).to.be.an.instanceof(Note);
            });
          }
        });
        it("should parse beam spanning closing parens", () => {
          const ctx = new ABCContext();
          const musicCode = buildParse(`CA,)B`, ctx).tune[0].tune_body?.sequence[0][0];
          expect(musicCode).to.be.an.instanceof(Beam);
          if (isBeam(musicCode)) {
            expect(musicCode.contents).to.be.an.instanceof(Array);
            expect(musicCode.contents[2]).to.be.an.instanceof(Token);
          }
        });
        it("should parse beam containing backticks", () => {
          const ctx = new ABCContext();
          const musicCode = buildParse("C`A,`B", ctx).tune[0].tune_body?.sequence[0][0];
          expect(musicCode).to.be.an.instanceof(Beam);
        });

        it("should parse multiple beams spanning parens", () => {
          const ctx = new ABCContext();
          const musicCode = buildParse(`CA(B CD)E`, ctx).tune[0].tune_body?.sequence[0];
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
        const ctx = new ABCContext();
        const musicCode = buildParse("|", ctx).tune[0].tune_body?.sequence[0][0];
        expect(musicCode).to.be.an.instanceof(BarLine);
        if (isBarLine(musicCode)) {
          expect(musicCode.barline[0].lexeme).to.equal("|");
        }
      });
      it("should parse annotation", () => {
        const ctx = new ABCContext();
        const musicCode = buildParse('"string"', ctx).tune[0].tune_body?.sequence[0][0];
        expect(musicCode).to.be.an.instanceof(Annotation);
        if (isAnnotation(musicCode)) {
          expect(musicCode.text.lexeme).to.equal('"string"');
        }
      });
      it("should parse grace group", () => {
        const ctx = new ABCContext();
        const musicCode = buildParse("{g}", ctx).tune[0].tune_body?.sequence[0][0];
        expect(musicCode).to.be.an.instanceof(Grace_group);
        if (isGraceGroup(musicCode)) {
          expect(musicCode.notes[0]).to.be.an.instanceof(Note);
        }
      });
      it("should parse accaciatura", () => {
        const ctx = new ABCContext();
        const musicCode = buildParse("{/ac}", ctx).tune[0].tune_body?.sequence[0][0];
        expect(musicCode).to.be.an.instanceof(Grace_group);
        if (isGraceGroup(musicCode)) {
          expect(musicCode.isAccacciatura).to.be.true;
        }
      });
      describe("Barlines", () => {
        it("should parse repeat barline", () => {
          const ctx = new ABCContext();
          const result = buildParse(":|1", ctx);
          const barline = result.tune[0].tune_body?.sequence[0][0];
          if (barline) {
            expect(barline).to.be.an.instanceof(BarLine);
            if (isBarLine(barline)) {
              expect(barline.barline.map((t) => t.lexeme).join("")).to.equal(":|");
              expect(barline.repeatNumbers).to.exist;
              expect(barline.repeatNumbers![0].lexeme).to.equal("1");
            }
          }
        });
        it("should parse repeat barline with number", () => {
          const ctx = new ABCContext();
          const result = buildParse("|2", ctx);
          const barline = result.tune[0].tune_body?.sequence[0][0];
          if (barline) {
            expect(barline).to.be.an.instanceof(BarLine);
            if (isBarLine(barline)) {
              expect(barline.barline[0].lexeme).to.equal("|");
              expect(barline.repeatNumbers).to.exist;
              expect(barline.repeatNumbers![0].lexeme).to.equal("2");
            }
          }
        });
        it("should parse Nth repeat", () => {
          const ctx = new ABCContext();
          const musicCode = buildParse("[1", ctx).tune[0].tune_body?.sequence[0][0];
          expect(musicCode).to.be.an.instanceof(BarLine);
          if (isBarLine(musicCode)) {
            const fmt = [musicCode.barline, musicCode.repeatNumbers].flatMap((e) => e?.map((t) => t.lexeme)).join("");
            expect(fmt).to.equal("[1");
          }
        });
      });
      it("should parse inline field", () => {
        const ctx = new ABCContext();
        const musicCode = buildParse("[M:3/4]", ctx).tune[0].tune_body?.sequence[0][0];
        expect(musicCode).to.be.an.instanceof(Inline_field);
        if (isInline_field(musicCode)) {
          expect(musicCode.field.lexeme).to.equal("M:");
          expect(musicCode.text[0].lexeme).to.equal("3");
        }
      });
      it("should parse comment in info line", () => {
        const ctx = new ABCContext();
        const tune_body = buildParse("K:C\nabc\nT:Title %surprise", ctx).tune[0].tune_body;
        const info_line = tune_body?.sequence[1][0];
        expect(isInfo_line(info_line)).to.be.true;
        if (isInfo_line(info_line)) {
          const len = info_line.value.length;
          const last = info_line.value[len - 1];
          expect(last.type).to.equal(TokenType.COMMENT);
        }
      });
      it("should parse info_line in body", () => {
        const ctx = new ABCContext();
        const musicCode = buildParse("K:C\nabc\nT:Title", ctx).tune[0].tune_body?.sequence[1][0];
        expect(musicCode).to.be.an.instanceof(Info_line);
        if (isInfo_line(musicCode)) {
          expect(musicCode.key.lexeme).to.equal("T:");
          expect(musicCode.value[0].lexeme).to.equal("Title");
        }
      });
      it("should parse info_line at start of body", () => {
        const ctx = new ABCContext();
        const tune_body = buildParse("K:C\nV:1\nabc\nT:Title", ctx).tune[0].tune_body;
        const musicCode = tune_body?.sequence[0][0];
        expect(musicCode).to.be.an.instanceof(Info_line);
        if (isInfo_line(musicCode)) {
          expect(musicCode.key.lexeme).to.equal("V:");
          expect(musicCode.value[0].lexeme).to.equal("1");
        }
      });
      it("should parse chord", () => {
        const ctx = new ABCContext();
        const musicCode = buildParse('["suprise"C]4-', ctx).tune[0].tune_body?.sequence[0][0];
        expect(musicCode).to.be.an.instanceof(Chord);
        if (isChord(musicCode)) {
          expect(musicCode.rhythm).to.exist;
          expect(musicCode.contents[0]).to.be.an.instanceof(Annotation);
          expect(musicCode.contents[1]).to.be.an.instanceof(Note);
          expect(musicCode.tie).to.not.be.undefined;
          expect(musicCode.tie).to.be.an.instanceof(Token);
        }
      });
      it("should parse beam", () => {
        const ctx = new ABCContext();
        const musicCode = buildParse("[CA]ABC", ctx).tune[0].tune_body?.sequence[0][0];
        expect(musicCode).to.be.an.instanceof(Beam);
        if (isBeam(musicCode)) {
          expect(musicCode.contents[0]).to.be.an.instanceof(Chord);
          expect(musicCode.contents[1]).to.be.an.instanceof(Note);
        }
      });
      it("should parse symbol", () => {
        const ctx = new ABCContext();
        const musicCode = buildParse("!fff!", ctx).tune[0].tune_body?.sequence[0][0];
        expect(musicCode).to.be.an.instanceof(Symbol);
        if (isSymbol(musicCode)) {
          expect(musicCode.symbol.lexeme).to.equal("!fff!");
        }
      });
      it("should parse basic rests", () => {
        const ctx = new ABCContext();
        const musicCode = buildParse("z4", ctx).tune[0].tune_body?.sequence[0][0];
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
        const ctx = new ABCContext();
        const result = buildParse("Z4Z", ctx);
        const firstRest = result.tune[0].tune_body?.sequence[0][0];
        if (firstRest) {
          expect(firstRest).to.be.an.instanceof(MultiMeasureRest);
          if (isMultiMeasureRest(firstRest)) {
            expect(firstRest.rest.lexeme).to.equal("Z");
            expect(firstRest.length).to.exist;
            expect(firstRest.length?.lexeme).to.equal("4");
          }
        }
        const secondRest = result.tune[0].tune_body?.sequence[0][1];
        if (secondRest) {
          expect(secondRest).to.be.an.instanceof(MultiMeasureRest);
          if (isMultiMeasureRest(secondRest)) {
            expect(secondRest.rest.lexeme).to.equal("Z");
            expect(secondRest.length).to.not.exist;
          }
        }
      });
      it("should parse EOL", () => {
        const ctx = new ABCContext();
        const musicCode = buildParse("|\\\n\n", ctx).tune[0].tune_body?.sequence[0][1];
        expect(musicCode).to.be.an.instanceof(Token);
      });
      it("should parse decoration", () => {
        const ctx = new ABCContext();
        const musicCode = buildParse(".a2", ctx).tune[0].tune_body?.sequence[0][0];
        expect(musicCode).to.be.an.instanceof(Decoration);
        if (isToken(musicCode)) {
          expect(musicCode.lexeme).to.equal(".");
        }
      });
      it("should parse letter decoration", () => {
        const ctx = new ABCContext();
        const musicCode = buildParse("Ha2", ctx).tune[0].tune_body?.sequence[0][0];
        expect(musicCode).to.be.an.instanceof(Decoration);
        if (isToken(musicCode)) {
          expect(musicCode.lexeme).to.equal("H");
        }
      });
      it("should parse y spacer", () => {
        const ctx = new ABCContext();
        const music_cd = buildParse(".y/2", ctx).tune[0].tune_body?.sequence[0];
        const decoration = music_cd![0];
        const ySpacer = music_cd![1];
        if (ySpacer) {
          expect(decoration).to.be.an.instanceof(Decoration);
          expect(ySpacer).to.be.an.instanceof(YSPACER);
          if (isYSPACER(ySpacer)) {
            expect(ySpacer.ySpacer.lexeme).to.equal("y");
            expect(ySpacer.rhythm).to.not.be.undefined;
          }
        }
      });
    });
    describe("comments", () => {
      it("should parse comment", () => {
        const ctx = new ABCContext();
        const comment = buildParse("%comment", ctx).tune[0].tune_body?.sequence[0][0];
        if (isComment(comment)) {
          expect(comment.text).to.equal("%comment");
        }
      });
      it("should parse stylesheet indications", () => {
        const ctx = new ABCContext();
        const parse = buildParse("T:SOMETITLE\n%%gchordfont Verdana 20\nM:4/4\nabcde", ctx);
        const comment = parse.tune[0].tune_header.info_lines[2];
        if (isComment(comment)) {
          expect(comment.text).to.equal("%%gchordfont Verdana 20");
        }
      });
      const mixed_tune_header = `X:1
T:After You've Gone
%%gchordfont Verdana 20
M:4/4
L:1/8`;

      it("should parse mixed tune headers", () => {
        const ctx = new ABCContext();
        const parse = buildParse(mixed_tune_header, ctx);
        const comment = parse.tune[0].tune_header.info_lines[2];
        if (isComment(comment)) {
          expect(comment.text).to.equal("%%comment");
        }
      });
      it("should figure out the correct position for comments", () => {
        const ctx = new ABCContext();
        const comment = buildParse("A B\n%comment", ctx).tune[0].tune_body?.sequence[1][0];
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
      it("should survive a bang in middle of an info line", () => {
        const input = "T: TEST: ABC2WIN ! in middle of line.\n";
        const ctx = new ABCContext();
        const parse = buildParse(input, ctx);
        const info_line = parse.tune[0].tune_header.info_lines[0];
        // expect there to be only 1 info line.
        // expect the info line to correspond to the input string, without its last line break
        expect(info_line).to.not.be.undefined;
        expect(info_line).to.be.an.instanceof(Info_line);
        if (isInfo_line(info_line)) {
          const ctx = new ABCContext();
          const fmt = new AbcFormatter(ctx).stringify(parse);
          const tune_head = tuneHeader(input);
          assert.equal(fmt.substring(0, tune_head.length - 1), tune_head.substring(0, tune_head.length - 1));
        }
      });
    });

    describe("Tuplets", () => {
      const samples: Array<string> = [
        //fmt
        "(3abc",
        "(3:2abc",
        "(3::abc",
        "(3::2abc",
        "(3:2:3abc",
      ];
      samples.forEach((input) => {
        it(`can parse tuplets in ${input}`, () => {
          const fmtHeader = tuneHeader(input);
          const ctx = new ABCContext();
          const scan = new Scanner(fmtHeader, ctx).scanTokens();
          const parse = new Parser(scan, ctx).parse();
          expect(parse).to.not.be.null;
          if (parse === null) {
            return;
          }
          const system = parse.tune[0].tune_body?.sequence[0];
          expect(system).to.not.be.undefined;
          expect(system).to.not.be.empty;
          if (!system) {
            return;
          }
          expect(system[0]).to.be.instanceof(Tuplet);
        });
      });
    });
    describe("misc.", () => {
      // this case doesn't work because JS' parser discards line continuation chars.
      it("antislashes before EOF", () => {
        const input = String.raw`A2 | \
D4`;
        const ctx = new ABCContext();
        const parse = buildParse(input, ctx);
        const system = parse.tune[0].tune_body?.sequence[0];
        expect(system).to.not.be.undefined;
        if (system) {
          expect(system.length).to.equal(6);
        }
      });
      const with_decorations = [
        '"Cmaj7b5"HJLMOPRSTuvc"2 ',
        "THcd",
        /**
         * Removing these two cases, that are not valid: fermata and bowing have to apply to notes.
         */
        /*         "Hy2",
                "u2", */
        "uTg",
        ".A",
        ".[Ace]",
      ];
      with_decorations.forEach((input) => {
        it(`can parse multiple decorations in ${input}`, () => {
          const fmtHeader = tuneHeader(input);
          const ctx = new ABCContext();
          const scan = new Scanner(fmtHeader, ctx).scanTokens();
          const parse = new Parser(scan, ctx).parse();
          expect(parse).to.not.be.null;
          if (parse === null) {
            return;
          }
          expect(parse.tune[0].tune_body?.sequence).to.not.be.empty;
        });
      });
    });
  });
});
describe("Parser - tuplet parsing", () => {
  let ctx: ABCContext;

  beforeEach(() => {
    ctx = new ABCContext();
  });

  function parse(input: string) {
    const scanner = new Scanner(input, ctx);
    const tokens = scanner.scanTokens();
    const parser = new Parser(tokens, ctx);
    const ast = parser.parse();
    if (!ast) throw new Error("Failed to parse");
    return ast;
  }

  describe("extended tuplet syntax", () => {
    it("parses basic tuplet with notes", () => {
      const ast = parse("X:1\n(3abc");
      // Verify p value only
      const tuplet = findFirstTuplet(ast);
      assert.equal(tuplet.p.lexeme, "(3");
      assert.isUndefined(tuplet.q);
      assert.isUndefined(tuplet.r);
    });
    it("parses (p:q form", () => {
      const ast = parse("X:1\n(3:2abc");
      const tuplet = findFirstTuplet(ast);
      assert.equal(tuplet.p.lexeme, "(3");

      assert.equal(tuplet.q?.map((q) => q.lexeme).join(""), ":2");
      assert.isUndefined(tuplet.r);
    });

    it("parses (p:: form", () => {
      const ast = parse("X:1\n(3::abc");
      const tuplet = findFirstTuplet(ast);
      assert.equal(tuplet.p.lexeme, "(3");
      assert.equal(tuplet.q?.map((q) => q.lexeme).join(""), ":");
      assert.equal(tuplet.r?.map((q) => q.lexeme).join(""), ":");
    });

    it("parses (p::r form", () => {
      const ast = parse("X:1\n(3::2abc");
      const tuplet = findFirstTuplet(ast);
      assert.equal(tuplet.p.lexeme, "(3");
      assert.equal(tuplet.q?.map((q) => q.lexeme).join(""), ":");
      assert.equal(tuplet.r?.map((q) => q.lexeme).join(""), ":2");
    });

    it("parses (p:q:r form", () => {
      const ast = parse("X:1\n(3:2:2abc");
      const tuplet = findFirstTuplet(ast);
      assert.equal(tuplet.p.lexeme, "(3");
      assert.equal(tuplet.q?.map((q) => q.lexeme).join(""), ":2");
      assert.equal(tuplet.r?.map((q) => q.lexeme).join(""), ":2");
    });
  });

  describe("tuplet with valid prefixes", () => {
    it("accepts whitespace after tuplet", () => {
      const ast = parse("X:1\n(3 abc");
      assert.isDefined(findFirstTuplet(ast));
    });

    it("accepts grace notes after tuplet", () => {
      const ast = parse("X:1\n(3{d}abc");
      assert.isDefined(findFirstTuplet(ast));
    });

    it("accepts decorations after tuplet", () => {
      const ast = parse("X:1\n(3!p!abc");
      assert.isDefined(findFirstTuplet(ast));
    });

    it("accepts annotations after tuplet", () => {
      const ast = parse('X:1\n(3"text"abc');
      assert.isDefined(findFirstTuplet(ast));
    });

    it("accepts chords after tuplet", () => {
      const ast = parse("X:1\n(3[CEG]");
      assert.isDefined(findFirstTuplet(ast));
    });
  });
});

// Helper function to find first tuplet in AST
function findFirstTuplet(ast: File_structure): Tuplet {
  let firstTuplet: Tuplet | undefined;

  // Navigate to first tuplet in music content
  const tuneBody = ast.tune[0].tune_body;
  if (!tuneBody) throw new Error("No tune body found");

  tuneBody.sequence[0].forEach((expr) => {
    if (expr instanceof Tuplet && !firstTuplet) {
      firstTuplet = expr;
    }
  });

  if (!firstTuplet) throw new Error("No tuplet found");
  return firstTuplet;
}
describe("Parser - decoration sequences", () => {
  let ctx: ABCContext;

  beforeEach(() => {
    ctx = new ABCContext();
  });

  function parse(input: string) {
    const scanner = new Scanner(input, ctx);
    const tokens = scanner.scanTokens();
    const parser = new Parser(tokens, ctx);
    const ast = parser.parse();
    if (!ast) throw new Error("Failed to parse");
    return ast;
  }

  describe("multiple decorations before note", () => {
    it("handles annotation, symbol and decoration before note", () => {
      const ast = parse('X:1\n"C"TL!tenuto!.c');

      // Navigate to the music content
      const musicContent = ast.tune[0].tune_body!.sequence[0];

      // Get the sequence of elements
      const elements = musicContent.filter((el) => el instanceof Annotation || el instanceof Decoration || el instanceof Note);

      // Verify sequence
      assert.equal(elements.length, 5);
      assert.isTrue(elements[0] instanceof Annotation); // "C"
      assert.isTrue(elements[1] instanceof Decoration); // T
      assert.isTrue(elements[2] instanceof Decoration); // L
      assert.isTrue(elements[3] instanceof Decoration); // !tenuto!.
      assert.isTrue(elements[4] instanceof Note); // c
    });

    it("handles multiple decorations in different orders", () => {
      const samples = ["X:1\n.!tenuto!c", 'X:1\n"text"!tenuto!.c', "X:1\nH!tenuto!.c", "X:1\n~!tenuto!.c", "X:1\nT.!tenuto!c"];

      samples.forEach((sample) => {
        assert.doesNotThrow(() => parse(sample));
      });
    });

    it("handles decorations before chord", () => {
      const ast = parse('X:1\n"C"TL!tenuto!.[CEG]');
      const musicContent = ast.tune[0].tune_body!.sequence[0];

      const elements = musicContent.filter((el) => el instanceof Annotation || el instanceof Decoration || el instanceof Chord);

      assert.isTrue(elements[elements.length - 1] instanceof Chord);
    });
  });
});
