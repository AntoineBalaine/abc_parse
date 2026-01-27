import { expect } from "chai";
import * as fc from "fast-check";
import { ABCContext } from "../parsers/Context";
import { AbcErrorReporter } from "../parsers/ErrorReporter";
import { parseInfoLine2 } from "../parsers/infoLines/parseInfoLine2";
import { ParseCtx, prsInfoLine } from "../parsers/parse2";
import { Token, TT } from "../parsers/scan2";
import { KV, Binary, Unary, Grouping, Info_line, AbsolutePitch, Pitch } from "../types/Expr2";
import {
  genKVExpr,
  genBinaryExpr,
  genExprArray,
  genKeyExprArray,
  genMeterExprArray,
  genGenericInfoLine,
  genKeyInfoLine2,
  genMeterInfoLine2,
  genNoteLenInfoLine2,
  genTempoInfoLine2,
} from "./scn_infoln_generators";

describe("parseInfoLine2 - Unified Info Line Parser", () => {
  let context: ABCContext;

  beforeEach(() => {
    context = new ABCContext(new AbcErrorReporter());
  });

  describe("Basic expression parsing", () => {
    it("should parse KV expressions with keys", () => {
      const tokens = [
        new Token(TT.IDENTIFIER, "clef", context.generateId()),
        new Token(TT.EQL, "=", context.generateId()),
        new Token(TT.IDENTIFIER, "treble", context.generateId()),
      ];

      const ctx = new ParseCtx(tokens, context);
      const expressions = parseInfoLine2(ctx);

      expect(expressions.length).to.equal(1);
      expect(expressions[0]).to.be.an.instanceof(KV);
      const kv = expressions[0] as KV;
      expect((kv.key! as Token).lexeme).to.equal("clef");
      expect(kv.value).to.be.an.instanceof(Token);
      expect((kv.value as Token).lexeme).to.equal("treble");
    });

    it("should parse KV expressions with whitespace around equals", () => {
      // Regression test: whitespace around = should not break KV parsing
      const tokens = [
        new Token(TT.IDENTIFIER, "clef", context.generateId()),
        new Token(TT.WS, " ", context.generateId()),
        new Token(TT.EQL, "=", context.generateId()),
        new Token(TT.WS, " ", context.generateId()),
        new Token(TT.IDENTIFIER, "treble", context.generateId()),
      ];

      const ctx = new ParseCtx(tokens, context);
      const expressions = parseInfoLine2(ctx);

      expect(expressions.length).to.equal(1);
      expect(expressions[0]).to.be.an.instanceof(KV);
      const kv = expressions[0] as KV;
      expect(kv.key).to.not.be.undefined;
      expect((kv.key! as Token).lexeme).to.equal("clef");
      expect(kv.equals!.lexeme).to.equal("=");
      expect((kv.value as Token).lexeme).to.equal("treble");
    });

    it("should parse KV expressions without keys", () => {
      const tokens = [new Token(TT.IDENTIFIER, "major", context.generateId())];

      const ctx = new ParseCtx(tokens, context);
      const expressions = parseInfoLine2(ctx);

      expect(expressions.length).to.equal(1);
      expect(expressions[0]).to.be.an.instanceof(KV);
      const kv = expressions[0] as KV;
      expect(kv.key).to.be.undefined;
      expect(kv.value).to.be.an.instanceof(Token);
      expect((kv.value as Token).lexeme).to.equal("major");
    });

    it("should parse binary expressions", () => {
      const tokens = [
        new Token(TT.NUMBER, "1", context.generateId()),
        new Token(TT.SLASH, "/", context.generateId()),
        new Token(TT.NUMBER, "4", context.generateId()),
      ];

      const ctx = new ParseCtx(tokens, context);
      const expressions = parseInfoLine2(ctx);

      expect(expressions.length).to.equal(1);
      expect(expressions[0]).to.be.an.instanceof(Binary);
      const binary = expressions[0] as Binary;
      expect((binary.left as Token).lexeme).to.equal("1");
      expect(binary.operator.lexeme).to.equal("/");
      expect((binary.right as Token).lexeme).to.equal("4");
    });

    it("should parse parenthesized expressions", () => {
      const tokens = [
        new Token(TT.LPAREN, "(", context.generateId()),
        new Token(TT.NUMBER, "2", context.generateId()),
        new Token(TT.PLUS, "+", context.generateId()),
        new Token(TT.NUMBER, "3", context.generateId()),
        new Token(TT.RPAREN, ")", context.generateId()),
        new Token(TT.SLASH, "/", context.generateId()),
        new Token(TT.NUMBER, "8", context.generateId()),
      ];

      const ctx = new ParseCtx(tokens, context);
      const expressions = parseInfoLine2(ctx);

      expect(expressions[0]).to.be.an.instanceof(Binary);
      const outerBinary = expressions[0] as Binary;
      expect(outerBinary.operator.lexeme).to.equal("/");
      expect((outerBinary.right as Token).lexeme).to.equal("8");

      // Left side should be the Grouping expression containing (2+3)
      expect(outerBinary.left).to.be.an.instanceof(Grouping);
      const grouping = outerBinary.left as Grouping;
      expect(grouping.expression).to.be.an.instanceof(Binary);
      const innerBinary = grouping.expression as Binary;
      expect((innerBinary.left as Token).lexeme).to.equal("2");
      expect(innerBinary.operator.lexeme).to.equal("+");
      expect((innerBinary.right as Token).lexeme).to.equal("3");
    });

    it("should parse mixed expressions", () => {
      const tokens = [
        new Token(TT.IDENTIFIER, "C", context.generateId()),
        new Token(TT.WS, " ", context.generateId()),
        new Token(TT.IDENTIFIER, "major", context.generateId()),
        new Token(TT.WS, " ", context.generateId()),
        new Token(TT.IDENTIFIER, "clef", context.generateId()),
        new Token(TT.EQL, "=", context.generateId()),
        new Token(TT.IDENTIFIER, "treble", context.generateId()),
      ];

      const ctx = new ParseCtx(tokens, context);
      const expressions = parseInfoLine2(ctx);

      expect(expressions.length).to.equal(3);
      expect(expressions[0]).to.be.an.instanceof(KV);
      expect(expressions[1]).to.be.an.instanceof(KV);
      expect(expressions[2]).to.be.an.instanceof(KV);

      const kv1 = expressions[0] as KV;
      const kv2 = expressions[1] as KV;
      const kv3 = expressions[2] as KV;

      expect(kv1.value).to.be.an.instanceof(Token);
      expect((kv1.value as Token).lexeme).to.equal("C");
      expect(kv1.key).to.be.undefined;

      expect(kv2.value).to.be.an.instanceof(Token);
      expect((kv2.value as Token).lexeme).to.equal("major");
      expect(kv2.key).to.be.undefined;

      expect(kv3.value).to.be.an.instanceof(Token);
      expect((kv3.value as Token).lexeme).to.equal("treble");

      expect((kv3.key! as Token).lexeme).to.equal("clef");
    });
  });

  describe("Property-based testing with generated expressions", () => {
    it("should handle generated KV expressions", () => {
      fc.assert(
        fc.property(genKVExpr, (expr) => {
          // This test verifies our generator works correctly
          expect(expr).to.be.an.instanceof(KV);
          expect(expr.value).to.not.be.undefined;

          if (expr.key) {
            expect(expr.equals).to.not.be.undefined;
          } else {
            expect(expr.equals).to.be.undefined;
          }
        })
      );
    });

    it("should handle generated Binary expressions", () => {
      fc.assert(
        fc.property(genBinaryExpr, (expr) => {
          expect(expr).to.be.an.instanceof(Binary);
          expect(expr.left).to.not.be.undefined;
          expect(expr.operator).to.not.be.undefined;
          expect(expr.right).to.not.be.undefined;
          expect([TT.PLUS, TT.SLASH]).to.include(expr.operator.type);
        })
      );
    });

    it("should handle mixed expression arrays", () => {
      fc.assert(
        fc.property(genExprArray, (expressions) => {
          expect(expressions.length).to.be.greaterThan(0);

          expressions.forEach((expr) => {
            expect(expr).to.satisfy((e: any) => e instanceof KV || e instanceof Binary);
          });
        })
      );
    });

    it("should handle key info expression patterns", () => {
      fc.assert(
        fc.property(genKeyExprArray, (expressions) => {
          expect(expressions.length).to.be.greaterThan(0);

          expressions.forEach((expr) => {
            expect(expr).to.be.an.instanceof(KV);
          });
        })
      );
    });

    it("should handle meter info expression patterns", () => {
      fc.assert(
        fc.property(genMeterExprArray, (expressions) => {
          expect(expressions.length).to.be.greaterThan(0);

          expressions.forEach((expr) => {
            expect(expr).to.satisfy((e: any) => e instanceof KV || e instanceof Binary);
          });
        })
      );
    });
  });

  describe("Error handling", () => {
    it("should handle empty token arrays", () => {
      const ctx = new ParseCtx([], context);
      const expressions = parseInfoLine2(ctx);
      expect(expressions).to.deep.equal([]);
    });

    it("should handle malformed expressions gracefully", () => {
      // Missing value after equals
      const tokens = [new Token(TT.IDENTIFIER, "clef", context.generateId()), new Token(TT.EQL, "=", context.generateId())];

      const ctx = new ParseCtx(tokens, context);
      const expressions = parseInfoLine2(ctx);

      // Should not crash, may produce partial results
      expect(expressions).to.not.be.undefined;
    });

    it("should handle incomplete binary expressions", () => {
      // Missing right operand
      const tokens = [new Token(TT.NUMBER, "1", context.generateId()), new Token(TT.SLASH, "/", context.generateId())];

      const ctx = new ParseCtx(tokens, context);
      const expressions = parseInfoLine2(ctx);

      // Should not crash
      expect(expressions).to.not.be.undefined;
    });
  });

  describe("Whitespace handling", () => {
    it("should skip whitespace tokens", () => {
      const tokens = [
        new Token(TT.WS, " ", context.generateId()),
        new Token(TT.IDENTIFIER, "major", context.generateId()),
        new Token(TT.WS, "  ", context.generateId()),
      ];

      const ctx = new ParseCtx(tokens, context);
      const expressions = parseInfoLine2(ctx);

      expect(expressions.length).to.equal(1);
      expect(expressions[0]).to.be.an.instanceof(KV);
      const kv = expressions[0] as KV;
      expect(kv.value).to.be.an.instanceof(Token);
      expect((kv.value as Token).lexeme).to.equal("major");
    });
  });

  describe("Special token types", () => {
    it("should handle string literals", () => {
      const tokens = [new Token(TT.ANNOTATION, '"Allegro"', context.generateId())];

      const ctx = new ParseCtx(tokens, context);
      const expressions = parseInfoLine2(ctx);

      expect(expressions.length).to.equal(1);
      expect(expressions[0]).to.be.an.instanceof(KV);
      const kv = expressions[0] as KV;
      expect(kv.value).to.be.an.instanceof(Token);
      expect((kv.value as Token).lexeme).to.equal('"Allegro"');
    });

    it("should handle special literals", () => {
      const tokens = [new Token(TT.SPECIAL_LITERAL, "C|", context.generateId())];

      const ctx = new ParseCtx(tokens, context);
      const expressions = parseInfoLine2(ctx);

      expect(expressions.length).to.equal(1);
      expect(expressions[0]).to.be.an.instanceof(KV);
      const kv = expressions[0] as KV;
      expect(kv.value).to.be.an.instanceof(Token);
      expect((kv.value as Token).lexeme).to.equal("C|");
    });
  });

  describe("Property-based integration testing with prsInfoLine", () => {
    it("should handle generic info lines with prsInfoLine", () => {
      fc.assert(
        fc.property(genGenericInfoLine, (tokens) => {
          // Filter out EOL tokens that are used for scanner testing but not parser testing
          const filteredTokens = tokens.filter((t) => t.type !== TT.EOL);

          // Create ParseCtx with the filtered tokens
          const ctx = new ParseCtx(filteredTokens, context);

          // Call prsInfoLine (which internally uses parseInfoLine2)
          const result = prsInfoLine(ctx);

          // Verify basic structure
          expect(result).to.not.be.null;
          expect(result).to.be.an.instanceof(Info_line);

          if (result) {
            // Verify the result has a proper key (info line header)
            expect(result.key).to.not.be.undefined;
            expect(result.key.type).to.equal(TT.INF_HDR);

            // Verify tokens were consumed properly
            expect(result.value).to.not.be.undefined;
            expect(result.value).to.be.an("array");

            // For generic info lines, value2 should be present
            expect(result.value2).to.not.be.undefined;
            expect(result.value2).to.be.an("array");
          }

          return true;
        }),
        {
          numRuns: 50,
          verbose: false,
        }
      );
    });

    it("should handle specific info lines with parsed expressions", () => {
      const specificInfoLineGen = fc.oneof(genKeyInfoLine2, genMeterInfoLine2, genNoteLenInfoLine2, genTempoInfoLine2);

      fc.assert(
        fc.property(specificInfoLineGen, (tokens) => {
          // Filter out EOL tokens and flatten nested arrays from generators
          const flattenedTokens = tokens.flat().filter((t) => t && t.type !== TT.EOL);

          // Create ParseCtx with the flattened tokens
          const ctx = new ParseCtx(flattenedTokens, context);

          // Call prsInfoLine (which internally uses parseInfoLine2)
          const result = prsInfoLine(ctx);

          // Verify basic structure
          expect(result).to.not.be.null;
          expect(result).to.be.an.instanceof(Info_line);

          if (result) {
            // Verify the result has a proper key (info line header)
            expect(result.key).to.not.be.undefined;
            expect(result.key.type).to.equal(TT.INF_HDR);

            // Verify tokens were consumed properly
            expect(result.value).to.not.be.undefined;
            expect(result.value).to.be.an("array");

            // For specific info lines, value2 should contain parsed structures
            expect(result.value2).to.not.be.undefined;
            expect(result.value2).to.be.an("array");

            // Verify each expression is a valid parsed expression (if any)
            result.value2?.forEach((expr) => {
              // For debugging: check what we actually got
              expect(expr).to.satisfy(
                (e: any) =>
                  e instanceof KV ||
                  e instanceof Binary ||
                  e instanceof Grouping ||
                  e instanceof Token ||
                  e instanceof AbsolutePitch ||
                  e instanceof Pitch // Allow tokens for now
              );
            });
          }

          return true;
        }),
        {
          numRuns: 50,
          verbose: false,
        }
      );
    });
  });

  describe("Complex musical syntax cases", () => {
    it("should handle key signature: K:F#", () => {
      const tokens = [
        new Token(TT.INF_HDR, "K:", context.generateId()),
        new Token(TT.NOTE_LETTER, "F", context.generateId()),
        new Token(TT.ACCIDENTAL, "#", context.generateId()),
      ];

      const ctx = new ParseCtx(tokens, context);
      const result = prsInfoLine(ctx);

      expect(result).to.not.be.null;
      expect(result!.key.lexeme).to.equal("K:");
      expect(result!.value2).to.have.length(1);

      const expr = result!.value2![0];
      expect(expr).to.be.an.instanceof(AbsolutePitch);
      const absolutePitch = expr as AbsolutePitch;
      expect(absolutePitch.noteLetter.lexeme).to.equal("F");
      expect(absolutePitch.alteration?.lexeme).to.equal("#");
      expect(absolutePitch.octave).to.be.undefined;
    });

    it("should handle key signature: K:G major", () => {
      const tokens = [
        new Token(TT.INF_HDR, "K:", context.generateId()),
        new Token(TT.NOTE_LETTER, "G", context.generateId()),
        new Token(TT.WS, " ", context.generateId()),
        new Token(TT.IDENTIFIER, "major", context.generateId()),
      ];

      const ctx = new ParseCtx(tokens, context);
      const result = prsInfoLine(ctx);

      expect(result).to.not.be.null;
      expect(result!.key.lexeme).to.equal("K:");
      expect(result!.value2).to.have.length(2);

      // First expression should be AbsolutePitch for "G"
      const firstExpr = result!.value2![0];
      expect(firstExpr).to.be.an.instanceof(AbsolutePitch);
      const absolutePitch = firstExpr as AbsolutePitch;
      expect(absolutePitch.noteLetter.lexeme).to.equal("G");
      expect(absolutePitch.alteration).to.be.undefined;

      // Second expression should be KV for "major"
      const secondExpr = result!.value2![1];
      expect(secondExpr).to.be.an.instanceof(KV);
      const kv = secondExpr as KV;
      expect(kv.value).to.be.an.instanceof(Token);
      expect((kv.value as Token).lexeme).to.equal("major");
      expect(kv.key).to.be.undefined;
    });

    it("should handle key signature with explicit accidentals: K:C ^c_b", () => {
      const tokens = [
        new Token(TT.INF_HDR, "K:", context.generateId()),
        new Token(TT.SPECIAL_LITERAL, "C", context.generateId()),
        new Token(TT.WS, " ", context.generateId()),
        new Token(TT.ACCIDENTAL, "^", context.generateId()),
        new Token(TT.NOTE_LETTER, "c", context.generateId()),
        new Token(TT.ACCIDENTAL, "_", context.generateId()),
        new Token(TT.NOTE_LETTER, "b", context.generateId()),
      ];

      const ctx = new ParseCtx(tokens, context);
      const result = prsInfoLine(ctx);

      expect(result).to.not.be.null;
      expect(result!.key.lexeme).to.equal("K:");
      expect(result!.value2).to.have.length(3);

      // First should be KV for "C"
      const firstExpr = result!.value2![0];
      expect(firstExpr).to.be.an.instanceof(KV);
      const firstKV = firstExpr as KV;
      expect(firstKV.value).to.be.an.instanceof(Token);
      expect((firstKV.value as Token).lexeme).to.equal("C");

      // Second should be Pitch for "^c"
      const secondExpr = result!.value2![1];
      expect(secondExpr).to.be.an.instanceof(Pitch);
      const pitch1 = secondExpr as Pitch;
      expect(pitch1.alteration?.lexeme).to.equal("^");
      expect(pitch1.noteLetter.lexeme).to.equal("c");

      // Third should be Pitch for "_b"
      const thirdExpr = result!.value2![2];
      expect(thirdExpr).to.be.an.instanceof(Pitch);
      const pitch2 = thirdExpr as Pitch;
      expect(pitch2.alteration?.lexeme).to.equal("_");
      expect(pitch2.noteLetter.lexeme).to.equal("b");
    });

    it('should handle "none" key signature: K:none', () => {
      const tokens = [new Token(TT.INF_HDR, "K:", context.generateId()), new Token(TT.IDENTIFIER, "none", context.generateId())];

      const ctx = new ParseCtx(tokens, context);
      const result = prsInfoLine(ctx);

      expect(result).to.not.be.null;
      expect(result!.key.lexeme).to.equal("K:");
      expect(result!.value2).to.have.length(1);

      const expr = result!.value2![0];
      expect(expr).to.be.an.instanceof(KV);
      const kv = expr as KV;
      expect(kv.value).to.be.an.instanceof(Token);
      expect((kv.value as Token).lexeme).to.equal("none");
      expect(kv.key).to.be.undefined;
    });

    it("should handle tempo with absolute pitch: Q:G4=96", () => {
      const tokens = [
        new Token(TT.INF_HDR, "Q:", context.generateId()),
        new Token(TT.NOTE_LETTER, "G", context.generateId()),
        new Token(TT.NUMBER, "4", context.generateId()),
        new Token(TT.EQL, "=", context.generateId()),
        new Token(TT.NUMBER, "96", context.generateId()),
      ];

      const ctx = new ParseCtx(tokens, context);
      const result = prsInfoLine(ctx);

      expect(result).to.not.be.null;
      expect(result!.key.lexeme).to.equal("Q:");
      expect(result!.value2).to.have.length(1);

      // Should be Binary expression: AbsolutePitch = Number
      const expr = result!.value2![0];
      expect(expr).to.be.an.instanceof(KV);
      const binary = expr as KV;

      // Left side should be AbsolutePitch
      expect(binary.key!).to.be.an.instanceof(AbsolutePitch);
      const absolutePitch = binary.key! as AbsolutePitch;
      expect(absolutePitch.noteLetter.lexeme).to.equal("G");
      expect(absolutePitch.octave?.lexeme).to.equal("4");
      expect(absolutePitch.alteration).to.be.undefined;

      // Right side should be Token with BPM
      expect(binary.value).to.be.an.instanceof(Token);
      const bpm = binary.value as Token;
      expect(bpm.lexeme).to.equal("96");
    });

    it("should handle clef identifier with octave shift: clef=Ctreble,", () => {
      const tokens = [
        new Token(TT.IDENTIFIER, "clef", context.generateId()),
        new Token(TT.EQL, "=", context.generateId()),
        new Token(TT.IDENTIFIER, "Ctreble", context.generateId()),
        new Token(TT.IDENTIFIER, ",", context.generateId()),
      ];

      const ctx = new ParseCtx(tokens, context);
      const expressions = parseInfoLine2(ctx);

      expect(expressions).to.have.length(2);

      // First should be KV expression: clef=Ctreble
      const firstExpr = expressions[0];
      expect(firstExpr).to.be.an.instanceof(KV);
      const kv = firstExpr as KV;
      expect((kv.key! as Token).lexeme).to.equal("clef");
      expect(kv.value).to.be.an.instanceof(Token);
      expect((kv.value as Token).lexeme).to.equal("Ctreble");

      // Second should be KV expression for comma (octave shift)
      const secondExpr = expressions[1];
      expect(secondExpr).to.be.an.instanceof(KV);
      const commaKv = secondExpr as KV;
      expect(commaKv.value).to.be.an.instanceof(Token);
      expect((commaKv.value as Token).lexeme).to.equal(",");
      expect(commaKv.key).to.be.undefined;
    });

    it("should handle voice info line: V:LH clef=bass octave=-2", () => {
      const tokens = [
        new Token(TT.INF_HDR, "V:", context.generateId()),
        new Token(TT.IDENTIFIER, "LH", context.generateId()),
        new Token(TT.WS, " ", context.generateId()),
        new Token(TT.IDENTIFIER, "clef", context.generateId()),
        new Token(TT.EQL, "=", context.generateId()),
        new Token(TT.IDENTIFIER, "bass", context.generateId()),
        new Token(TT.WS, " ", context.generateId()),
        new Token(TT.IDENTIFIER, "octave", context.generateId()),
        new Token(TT.EQL, "=", context.generateId()),
        new Token(TT.MINUS, "-", context.generateId()),
        new Token(TT.NUMBER, "2", context.generateId()),
      ];

      const ctx = new ParseCtx(tokens, context);
      const result = prsInfoLine(ctx);

      expect(result).to.not.be.null;
      expect(result!.key.lexeme).to.equal("V:");
      expect(result!.value2).to.have.length(3);

      // First expression should be KV for voice name "LH"
      const firstExpr = result!.value2![0];
      expect(firstExpr).to.be.an.instanceof(KV);
      const voiceKv = firstExpr as KV;
      expect(voiceKv.value).to.be.an.instanceof(Token);
      expect((voiceKv.value as Token).lexeme).to.equal("LH");
      expect(voiceKv.key).to.be.undefined;

      // Second expression should be KV for clef=bass
      const secondExpr = result!.value2![1];
      expect(secondExpr).to.be.an.instanceof(KV);
      const clefKv = secondExpr as KV;
      expect((clefKv.key! as Token).lexeme).to.equal("clef");
      expect(clefKv.value).to.be.an.instanceof(Token);
      expect((clefKv.value as Token).lexeme).to.equal("bass");

      // Third expression should be KV for octave=-2
      const thirdExpr = result!.value2![2];
      expect(thirdExpr).to.be.an.instanceof(KV);
      const octaveKv = thirdExpr as KV;
      expect((octaveKv.key! as Token).lexeme).to.equal("octave");

      // Value should be a Unary expression
      expect(octaveKv.value).to.be.an.instanceof(Unary);
      const unaryValue = octaveKv.value as Unary;
      expect(unaryValue.operator.lexeme).to.equal("-");
      expect((unaryValue.operand as Token).lexeme).to.equal("2");
    });

    it("should preserve INVALID tokens and format them correctly", () => {
      const tokens = [
        new Token(TT.INF_HDR, "V:", context.generateId()),
        new Token(TT.IDENTIFIER, "LH", context.generateId()),
        new Token(TT.WS, " ", context.generateId()),
        new Token(TT.INVALID, "@#$", context.generateId()),
        new Token(TT.WS, " ", context.generateId()),
        new Token(TT.IDENTIFIER, "clef", context.generateId()),
        new Token(TT.EQL, "=", context.generateId()),
        new Token(TT.IDENTIFIER, "bass", context.generateId()),
      ];

      const ctx = new ParseCtx(tokens, context);
      const result = prsInfoLine(ctx);

      expect(result).to.not.be.null;
      expect(result!.key.lexeme).to.equal("V:");
      expect(result!.value2).to.have.length(3);

      // First expression should be KV for voice name "LH"
      const firstExpr = result!.value2![0];
      expect(firstExpr).to.be.an.instanceof(KV);
      const firstKV = firstExpr as KV;
      expect(firstKV.value).to.be.an.instanceof(Token);
      expect((firstKV.value as Token).lexeme).to.equal("LH");

      // Second should be the INVALID token preserved as a Token
      const secondExpr = result!.value2![1];
      expect(secondExpr).to.be.an.instanceof(Token);
      expect((secondExpr as Token).type).to.equal(TT.INVALID);
      expect((secondExpr as Token).lexeme).to.equal("@#$");

      // Third expression should be KV for clef=bass
      const thirdExpr = result!.value2![2];
      expect(thirdExpr).to.be.an.instanceof(KV);
      const clefKv = thirdExpr as KV;
      expect((clefKv.key! as Token).lexeme).to.equal("clef");
      expect(clefKv.value).to.be.an.instanceof(Token);
      expect((clefKv.value as Token).lexeme).to.equal("bass");

      // Test formatting - verify INVALID token is included with proper spacing
      const { AbcFormatter } = require("../Visitors/Formatter2");
      const formatter = new AbcFormatter(context);
      const formattedOutput = formatter.visitInfoLineExpr(result!);

      expect(formattedOutput).to.include("@#$");
      expect(formattedOutput).to.equal("V:LH @#$ clef=bass");
    });
  });
});
