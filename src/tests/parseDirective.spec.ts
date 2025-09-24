import * as fc from "fast-check";
import { ParseCtx } from "../parsers/parse2";
import { ABCContext } from "../parsers/Context";
import { AbcErrorReporter } from "../parsers/ErrorReporter";
import { parseDirective } from "../parsers/infoLines/parseDirective";
import { Annotation, Directive, KV, Measurement, Pitch, Rational } from "../types/Expr2";
import { Token, TT } from "../parsers/scan2";
import {
  genDirectiveContent,
  genStylesheetDirective,
  genDirectiveIdentifier,
  genMeasurementUnit,
  genNumberWithUnit,
  genDirectiveRational,
  genDirectiveAssignment,
} from "./scn_infoln_generators";
import { expect } from "chai";

describe.only("parseDirective - Directive Parser", () => {
  let context: ABCContext;

  beforeEach(() => {
    context = new ABCContext(new AbcErrorReporter());
  });

  describe("Basic directive parsing", () => {
    it("should parse simple directive with number", () => {
      const tokens = [
        new Token(TT.STYLESHEET_DIRECTIVE, "%%", context.generateId()),
        new Token(TT.IDENTIFIER, "scale", context.generateId()),
        new Token(TT.NUMBER, "0.75", context.generateId()),
      ];

      const ctx = new ParseCtx(tokens, context);
      const result = parseDirective(ctx);

      expect(result).to.not.be.null;
      expect(result).to.be.an.instanceof(Directive);
      expect(result!.key?.lexeme).to.equal("scale");
      expect(result!.values).to.have.length(1);
      expect(result!.values![0]).to.be.an.instanceof(Token);
      expect((result!.values![0] as Token).lexeme).to.equal("0.75");
    });

    it("should parse directive with measurement", () => {
      const tokens = [
        new Token(TT.STYLESHEET_DIRECTIVE, "%%", context.generateId()),
        new Token(TT.IDENTIFIER, "pagewidth", context.generateId()),
        new Token(TT.NUMBER, "21", context.generateId()),
        new Token(TT.MEASUREMENT_UNIT, "cm", context.generateId()),
      ];

      const ctx = new ParseCtx(tokens, context);
      const result = parseDirective(ctx);

      expect(result).to.not.be.null;
      expect(result!.key?.lexeme).to.equal("pagewidth");
      expect(result!.values).to.have.length(1);
      expect(result!.values![0]).to.be.an.instanceof(Measurement);

      const measurement = result!.values![0] as Measurement;
      expect(measurement.value.lexeme).to.equal("21");
      expect(measurement.scale.lexeme).to.equal("cm");
    });

    it("should parse directive with rational number", () => {
      const tokens = [
        new Token(TT.STYLESHEET_DIRECTIVE, "%%", context.generateId()),
        new Token(TT.IDENTIFIER, "scale", context.generateId()),
        new Token(TT.NUMBER, "3", context.generateId()),
        new Token(TT.SLASH, "/", context.generateId()),
        new Token(TT.NUMBER, "4", context.generateId()),
      ];

      const ctx = new ParseCtx(tokens, context);
      const result = parseDirective(ctx);

      expect(result).to.not.be.null;
      expect(result!.key?.lexeme).to.equal("scale");
      expect(result!.values).to.have.length(1);
      expect(result!.values![0]).to.be.an.instanceof(Rational);

      const rational = result!.values![0] as Rational;
      expect(rational.numerator.lexeme).to.equal("3");
      expect(rational.separator.lexeme).to.equal("/");
      expect(rational.denominator.lexeme).to.equal("4");
    });

    it("should parse directive with pitch", () => {
      const tokens = [
        new Token(TT.STYLESHEET_DIRECTIVE, "%%", context.generateId()),
        new Token(TT.IDENTIFIER, "transpose", context.generateId()),
        new Token(TT.ACCIDENTAL, "^", context.generateId()),
        new Token(TT.NOTE_LETTER, "c", context.generateId()),
      ];

      const ctx = new ParseCtx(tokens, context);
      const result = parseDirective(ctx);

      expect(result).to.not.be.null;
      expect(result!.key?.lexeme).to.equal("transpose");
      expect(result!.values).to.have.length(1);
      expect(result!.values![0]).to.be.an.instanceof(Pitch);

      const pitch = result!.values![0] as Pitch;
      expect(pitch.alteration?.lexeme).to.equal("^");
      expect(pitch.noteLetter.lexeme).to.equal("c");
      expect(pitch.octave).to.be.undefined;
    });

    it("should parse directive with string literal", () => {
      const tokens = [
        new Token(TT.STYLESHEET_DIRECTIVE, "%%", context.generateId()),
        new Token(TT.IDENTIFIER, "title", context.generateId()),
        new Token(TT.ANNOTATION, '"My Song"', context.generateId()),
      ];

      const ctx = new ParseCtx(tokens, context);
      const result = parseDirective(ctx);

      expect(result).to.not.be.null;
      expect(result!.key?.lexeme).to.equal("title");
      expect(result!.values).to.have.length(1);
      expect(result!.values![0]).to.be.an.instanceof(Annotation);
      expect((result!.values![0] as Annotation).text.lexeme).to.equal('"My Song"');
    });

    it("should parse directive with standalone identifier", () => {
      const tokens = [new Token(TT.STYLESHEET_DIRECTIVE, "%%", context.generateId()), new Token(TT.IDENTIFIER, "landscape", context.generateId())];

      const ctx = new ParseCtx(tokens, context);
      const result = parseDirective(ctx);

      expect(result).to.not.be.null;
      expect(result!.key?.lexeme).to.equal("landscape");
      expect(result!.values).to.have.length(0);
    });

    it("should parse directive with multiple values", () => {
      const tokens = [
        new Token(TT.STYLESHEET_DIRECTIVE, "%%", context.generateId()),
        new Token(TT.IDENTIFIER, "margins", context.generateId()),
        new Token(TT.NUMBER, "2", context.generateId()),
        new Token(TT.MEASUREMENT_UNIT, "cm", context.generateId()),
        new Token(TT.NUMBER, "1.5", context.generateId()),
        new Token(TT.MEASUREMENT_UNIT, "cm", context.generateId()),
      ];

      const ctx = new ParseCtx(tokens, context);
      const result = parseDirective(ctx);

      expect(result).to.not.be.null;
      expect(result!.key?.lexeme).to.equal("margins");
      expect(result!.values).to.have.length(2);

      expect(result!.values![0]).to.be.an.instanceof(Measurement);
      expect(result!.values![1]).to.be.an.instanceof(Measurement);

      const measurement1 = result!.values![0] as Measurement;
      const measurement2 = result!.values![1] as Measurement;

      expect(measurement1.value.lexeme).to.equal("2");
      expect(measurement1.scale.lexeme).to.equal("cm");
      expect(measurement2.value.lexeme).to.equal("1.5");
      expect(measurement2.scale.lexeme).to.equal("cm");
    });
  });

  describe("Complex directive parsing", () => {
    it("should parse directive with mixed value types", () => {
      const tokens = [
        new Token(TT.STYLESHEET_DIRECTIVE, "%%", context.generateId()),
        new Token(TT.IDENTIFIER, "complex", context.generateId()),
        new Token(TT.NUMBER, "3", context.generateId()),
        new Token(TT.SLASH, "/", context.generateId()),
        new Token(TT.NUMBER, "4", context.generateId()),
        new Token(TT.NUMBER, "12", context.generateId()),
        new Token(TT.MEASUREMENT_UNIT, "pt", context.generateId()),
        new Token(TT.ACCIDENTAL, "^", context.generateId()),
        new Token(TT.NOTE_LETTER, "c", context.generateId()),
      ];

      const ctx = new ParseCtx(tokens, context);
      const result = parseDirective(ctx);

      expect(result).to.not.be.null;
      expect(result!.key?.lexeme).to.equal("complex");
      expect(result!.values).to.have.length(3);

      // Should contain Rational, Measurement, and Pitch
      expect(result!.values![0]).to.be.an.instanceof(Rational);
      expect(result!.values![1]).to.be.an.instanceof(Measurement);
      expect(result!.values![2]).to.be.an.instanceof(Pitch);
    });
  });

  describe("Error handling", () => {
    it("should return null for non-directive input", () => {
      const tokens = [new Token(TT.IDENTIFIER, "not-directive", context.generateId())];
      const ctx = new ParseCtx(tokens, context);
      const result = parseDirective(ctx);

      expect(result).to.be.null;
    });

    it("should return null for directive without identifier", () => {
      const tokens = [new Token(TT.STYLESHEET_DIRECTIVE, "%%", context.generateId()), new Token(TT.NUMBER, "123", context.generateId())];
      const ctx = new ParseCtx(tokens, context);
      const result = parseDirective(ctx);

      expect(result).to.be.null;
    });

    it("should handle empty directive", () => {
      const tokens = [new Token(TT.STYLESHEET_DIRECTIVE, "%%", context.generateId())];
      const ctx = new ParseCtx(tokens, context);
      const result = parseDirective(ctx);

      expect(result).to.be.null;
    });

    it("should handle invalid tokens in directive", () => {
      const tokens = [
        new Token(TT.STYLESHEET_DIRECTIVE, "%%", context.generateId()),
        new Token(TT.IDENTIFIER, "test", context.generateId()),
        new Token(TT.INVALID, "???", context.generateId()),
        new Token(TT.NUMBER, "123", context.generateId()),
      ];

      const ctx = new ParseCtx(tokens, context);
      const result = parseDirective(ctx);

      expect(result).to.not.be.null;
      expect(result!.key?.lexeme).to.equal("test");
      expect(result!.values).to.have.length(2);

      // Invalid token should be included in values
      expect(result!.values![0]).to.be.an.instanceof(Token);
      expect((result!.values![0] as Token).type).to.equal(TT.INVALID);
      expect((result!.values![0] as Token).lexeme).to.equal("???");

      expect(result!.values![1]).to.be.an.instanceof(Token);
      expect((result!.values![1] as Token).lexeme).to.equal("123");
    });
  });

  describe("Property-based testing with generated directives", () => {
    it("should handle generated directive identifiers", () => {
      fc.assert(
        fc.property(genDirectiveIdentifier, (identifier) => {
          const tokens = [new Token(TT.STYLESHEET_DIRECTIVE, "%%", context.generateId()), identifier];

          const ctx = new ParseCtx(tokens, context);
          const result = parseDirective(ctx);

          expect(result).to.not.be.null;
          expect(result!.key?.lexeme).to.equal(identifier.lexeme);
          expect(result!.values).to.have.length(0);
        })
      );
    });

    it("should handle generated measurements", () => {
      fc.assert(
        fc.property(genNumberWithUnit, (tokens) => {
          const directiveTokens = [
            new Token(TT.STYLESHEET_DIRECTIVE, "%%", context.generateId()),
            new Token(TT.IDENTIFIER, "test", context.generateId()),
            ...tokens,
          ];

          const ctx = new ParseCtx(directiveTokens, context);
          const result = parseDirective(ctx);

          expect(result).to.not.be.null;
          expect(result!.key?.lexeme).to.equal("test");
          expect(result!.values).to.have.length(1);
          expect(result!.values![0]).to.be.an.instanceof(Measurement);
        })
      );
    });

    it("should handle generated rationals", () => {
      fc.assert(
        fc.property(genDirectiveRational, (tokens) => {
          const directiveTokens = [
            new Token(TT.STYLESHEET_DIRECTIVE, "%%", context.generateId()),
            new Token(TT.IDENTIFIER, "test", context.generateId()),
            ...tokens,
          ];

          const ctx = new ParseCtx(directiveTokens, context);
          const result = parseDirective(ctx);

          expect(result).to.not.be.null;
          expect(result!.key?.lexeme).to.equal("test");
          expect(result!.values).to.have.length(1);
          expect(result!.values![0]).to.be.an.instanceof(Rational);
        })
      );
    });

    it("should handle generated directive content", () => {
      fc.assert(
        fc.property(genDirectiveContent, (contentTokens) => {
          const directiveTokens = [
            new Token(TT.STYLESHEET_DIRECTIVE, "%%", context.generateId()),
            new Token(TT.IDENTIFIER, "test", context.generateId()),
            ...contentTokens,
          ];

          const ctx = new ParseCtx(directiveTokens, context);

          expect(() => {
            const result = parseDirective(ctx);
            // Should either return a valid Directive or null, but not crash
            if (result !== null) {
              expect(result).to.be.an.instanceof(Directive);
              expect(result.key).to.not.be.undefined;
              expect(Array.isArray(result.values)).to.be.true;
            }
          }).to.not.throw();
        }),
        { numRuns: 100 }
      );
    });

    it("should handle generated directive assignments", () => {
      fc.assert(
        fc.property(genDirectiveAssignment, (tokens) => {
          const directiveTokens = [
            new Token(TT.STYLESHEET_DIRECTIVE, "%%", context.generateId()),
            new Token(TT.IDENTIFIER, "test", context.generateId()),
            ...tokens,
          ];

          const ctx = new ParseCtx(directiveTokens, context);
          const result = parseDirective(ctx);

          expect(result).to.not.be.null;
          expect(result!.key?.lexeme).to.equal("test");
          expect(result!.values).to.have.length(1);

          // Should create a KV expression for assignments like transpose=2
          expect(result!.values![0]).to.be.an.instanceof(KV);
          const kv = result!.values![0] as KV;
          expect(kv.key).to.not.be.undefined;
          expect(kv.equals).to.not.be.undefined;
          expect(kv.value).to.not.be.undefined;
        })
      );
    });

    it("should handle generated measurement units", () => {
      fc.assert(
        fc.property(genMeasurementUnit, (unitToken) => {
          const directiveTokens = [
            new Token(TT.STYLESHEET_DIRECTIVE, "%%", context.generateId()),
            new Token(TT.IDENTIFIER, "test", context.generateId()),
            new Token(TT.NUMBER, "12", context.generateId()),
            unitToken,
          ];

          const ctx = new ParseCtx(directiveTokens, context);
          const result = parseDirective(ctx);

          expect(result).to.not.be.null;
          expect(result!.key?.lexeme).to.equal("test");
          expect(result!.values).to.have.length(1);
          expect(result!.values![0]).to.be.an.instanceof(Measurement);

          const measurement = result!.values![0] as Measurement;
          expect(measurement.value.lexeme).to.equal("12");
          expect(measurement.scale.lexeme).to.equal(unitToken.lexeme);
        })
      );
    });

    it("should parse any valid directive without crashing", () => {
      fc.assert(
        fc.property(genStylesheetDirective, (tokens) => {
          // Filter out EOL tokens that are used for scanner testing but not parser testing
          const filteredTokens = tokens.filter((t) => t.type !== TT.EOL);

          const ctx = new ParseCtx(filteredTokens, context);

          expect(() => {
            const result = parseDirective(ctx);
            // Should either return a valid Directive or null, but not crash
            if (result !== null) {
              expect(result).to.be.an.instanceof(Directive);
              expect(result.key).to.not.be.undefined;
              expect(Array.isArray(result.values)).to.be.true;
            }
          }).to.not.throw();
        }),
        { numRuns: 50 }
      );
    });
  });
});
