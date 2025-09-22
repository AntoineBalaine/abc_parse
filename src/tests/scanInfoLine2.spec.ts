import * as fc from "fast-check";
import { Ctx, TT } from "../parsers/scan2";
import { ABCContext } from "../parsers/Context";
import { AbcErrorReporter } from "../parsers/ErrorReporter";
import { scanInfoLine2 } from "../parsers/infoLines/scanInfoLine2";
import { genUnifiedInfoLine, genKeyInfoLine2, genMeterInfoLine2, genNoteLenInfoLine2, genTempoInfoLine2 } from "./scn_infoln_generators";
import { expect } from "chai";

describe.only("scanInfoLine2 - Unified Info Line Scanner", () => {
  let context: ABCContext;

  beforeEach(() => {
    context = new ABCContext(new AbcErrorReporter());
  });

  describe("Basic token recognition", () => {
    it("should scan identifiers correctly", () => {
      fc.assert(
        fc.property(fc.constantFrom("K:treble", "K:major", "K:clef", "K:transpose"), (input) => {
          const ctx = new Ctx(input, context);
          const result = scanInfoLine2(ctx);

          expect(result).to.be.true;
          expect(ctx.tokens.length).greaterThan(1);
          expect(ctx.tokens[0].type).to.equal(TT.INF_HDR);
          expect(ctx.tokens[0].lexeme).to.equal("K:");
          expect(ctx.tokens[1].type).to.equal(TT.IDENTIFIER);
          expect(["treble", "major", "clef", "transpose"]).contain(ctx.tokens[1].lexeme);
        })
      );
    });

    it("should scan numbers correctly", () => {
      fc.assert(
        fc.property(fc.constantFrom("M:4", "L:1", "Q:120"), (input) => {
          const ctx = new Ctx(input, context);
          const result = scanInfoLine2(ctx);

          expect(result).to.be.true;
          expect(ctx.tokens.length).greaterThan(1);
          expect(ctx.tokens[0].type).to.equal(TT.INF_HDR);
          expect(ctx.tokens[1].type).to.equal(TT.NUMBER);
          expect(["4", "1", "120"]).contain(ctx.tokens[1].lexeme);
        })
      );
    });

    it("should scan string literals correctly", () => {
      fc.assert(
        fc.property(fc.constantFrom('Q:"Allegro"', 'V:"Tenor 1"'), (input) => {
          const ctx = new Ctx(input, context);
          const result = scanInfoLine2(ctx);

          expect(result).to.be.true;
          expect(ctx.tokens.length).greaterThan(1);
          expect(ctx.tokens[0].type).to.equal(TT.INF_HDR);
          expect(ctx.tokens[1].type).to.equal(TT.STRING_LITERAL);
          expect(['"Allegro"', '"Tenor 1"']).contain(ctx.tokens[1].lexeme);
        })
      );
    });

    it("should scan special literals correctly", () => {
      fc.assert(
        fc.property(fc.constantFrom("M:C", "M:C|"), (input) => {
          const ctx = new Ctx(input, context);
          const result = scanInfoLine2(ctx);

          expect(ctx.tokens[0].type).to.equal(TT.INF_HDR);
          expect(ctx.tokens[1].type).to.equal(TT.SPECIAL_LITERAL);
          expect(["C", "C|"]).contain(ctx.tokens[1].lexeme);
        })
      );
    });

    it("should scan punctuation correctly", () => {
      fc.assert(
        fc.property(fc.constantFrom("K:clef=treble", "M:(2+3)/8", "L:1/4"), (input) => {
          const ctx = new Ctx(input, context);
          const result = scanInfoLine2(ctx);

          expect(result).to.be.true;
          const punctuationTypes = ctx.tokens.filter((t) => [TT.EQL, TT.PLUS, TT.SLASH, TT.LPAREN, TT.RPAREN].includes(t.type)).map((t) => t.type);

          expect(punctuationTypes.length).greaterThan(0);
        })
      );
    });
  });

  describe("Round-trip testing with generated data", () => {
    it("should handle key info lines", () => {
      fc.assert(
        fc.property(genKeyInfoLine2, (tokens) => {
          const source = tokens.map((t) => t.lexeme).join("");
          const ctx = new Ctx(source, context);
          const result = scanInfoLine2(ctx);

          expect(result).to.be.true;
          expect(ctx.tokens.length).to.equal(tokens.length);
          expect(ctx.tokens[0].type).to.equal(TT.INF_HDR);
          expect(ctx.tokens[0].lexeme).to.equal("K:");
        })
      );
    });

    it("should handle meter info lines", () => {
      fc.assert(
        fc.property(genMeterInfoLine2, (tokens) => {
          const source = tokens.map((t) => t.lexeme).join("");
          const ctx = new Ctx(source, context);
          const result = scanInfoLine2(ctx);

          expect(result).to.be.true;
          expect(ctx.tokens.length).to.equal(tokens.length);
          expect(ctx.tokens[0].type).to.equal(TT.INF_HDR);
          expect(ctx.tokens[0].lexeme).to.equal("M:");
        })
      );
    });

    it("should handle note length info lines", () => {
      fc.assert(
        fc.property(genNoteLenInfoLine2, (tokens) => {
          const source = tokens.map((t) => t.lexeme).join("");
          const ctx = new Ctx(source, context);
          const result = scanInfoLine2(ctx);

          expect(result).to.be.true;
          expect(ctx.tokens.length).to.equal(tokens.length);
          expect(ctx.tokens[0].type).to.equal(TT.INF_HDR);
          expect(ctx.tokens[0].lexeme).to.equal("L:");
        })
      );
    });

    it("should handle tempo info lines", () => {
      fc.assert(
        fc.property(genTempoInfoLine2, (tokens) => {
          const source = tokens.map((t) => t.lexeme).join("");
          const ctx = new Ctx(source, context);
          const result = scanInfoLine2(ctx);

          expect(result).to.be.true;
          expect(ctx.tokens.length).to.equal(tokens.length);
          expect(ctx.tokens[0].type).to.equal(TT.INF_HDR);
          expect(ctx.tokens[0].lexeme).to.equal("Q:");
        })
      );
    });
  });

  describe("Error handling", () => {
    it("should handle invalid tokens gracefully", () => {
      const invalidInputs = [
        "K:@#$",
        "L:0/4", // Number starting with 0 should be invalid
        'Q:"unclosed string',
      ];

      invalidInputs.forEach((input) => {
        const ctx = new Ctx(input, context);
        const result = scanInfoLine2(ctx);
        // Should not throw, should produce some tokens including possibly INVALID tokens
        expect(result).to.be.true;
        expect(ctx.tokens.length).greaterThan(0);
        expect(ctx.tokens[0].type).to.equal(TT.INF_HDR);
      });
    });
  });

  describe("Special cases", () => {
    it("should distinguish C from C| correctly", () => {
      const inputC = "M:C ";
      const inputCBar = "M:C| ";

      const ctxC = new Ctx(inputC, context);
      const ctxCBar = new Ctx(inputCBar, context);

      const resultC = scanInfoLine2(ctxC);
      const resultCBar = scanInfoLine2(ctxCBar);

      expect(resultC).to.be.true;
      expect(resultCBar).to.be.true;
      expect(ctxC.tokens[1].lexeme).to.equal("C");
      expect(ctxCBar.tokens[1].lexeme).to.equal("C|");
    });

    it("should handle comments after info lines", () => {
      const input = "K:C major % this is a comment";
      const ctx = new Ctx(input, context);
      const result = scanInfoLine2(ctx);

      expect(result).to.be.true;
      // Note: Comments are handled by the main scanner, not scanInfoLine2
      // scanInfoLine2 should stop at the % character
      const lastToken = ctx.tokens[ctx.tokens.length - 1];
      expect(lastToken.lexeme).to.not.contain("%");
    });

    it("should stop at end of line", () => {
      const input = "K:C major\nM:4/4";
      const ctx = new Ctx(input, context);
      const result = scanInfoLine2(ctx);

      expect(result).to.be.true;
      // scanInfoLine2 should only process the first line
      const tokens = ctx.tokens;
      expect(tokens[0].type).to.equal(TT.INF_HDR);
      expect(tokens[0].lexeme).to.equal("K:");
      // Should not contain tokens from the second line
      const hasSecondInfoHeader = tokens.some((t) => t.lexeme === "M:");
      expect(hasSecondInfoHeader).to.be.false;
    });
  });
});
