import * as fc from "fast-check";
import { ParseCtx } from "../parsers/parse2";
import { ABCContext } from "../parsers/Context";
import { AbcErrorReporter } from "../parsers/ErrorReporter";
import { parseInfoLine2 } from "../parsers/infoLines/parseInfoLine2";
import { KV, Binary, Grouping } from "../types/Expr2";
import { Token, TT } from "../parsers/scan2";
import { genKVExpr, genBinaryExpr, genMixedExpr, genExprArray, genKeyExprArray, genMeterExprArray, sharedContext } from "./scn_infoln_generators";
import { expect } from "chai";

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
      expect(kv.key?.lexeme).to.equal("clef");
      expect(kv.value.lexeme).to.equal("treble");
    });

    it("should parse KV expressions without keys", () => {
      const tokens = [new Token(TT.IDENTIFIER, "major", context.generateId())];

      const ctx = new ParseCtx(tokens, context);
      const expressions = parseInfoLine2(ctx);

      expect(expressions.length).to.equal(1);
      expect(expressions[0]).to.be.an.instanceof(KV);
      const kv = expressions[0] as KV;
      expect(kv.key).to.be.undefined;
      expect(kv.value.lexeme).to.equal("major");
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

      expect(kv1.value.lexeme).to.equal("C");
      expect(kv1.key).to.be.undefined;

      expect(kv2.value.lexeme).to.equal("major");
      expect(kv2.key).to.be.undefined;

      expect(kv3.value.lexeme).to.equal("treble");
      expect(kv3.key?.lexeme).to.equal("clef");
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
      expect(kv.value.lexeme).to.equal("major");
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
      expect(kv.value.lexeme).to.equal('"Allegro"');
    });

    it("should handle special literals", () => {
      const tokens = [new Token(TT.SPECIAL_LITERAL, "C|", context.generateId())];

      const ctx = new ParseCtx(tokens, context);
      const expressions = parseInfoLine2(ctx);

      expect(expressions.length).to.equal(1);
      expect(expressions[0]).to.be.an.instanceof(KV);
      const kv = expressions[0] as KV;
      expect(kv.value.lexeme).to.equal("C|");
    });
  });
});
