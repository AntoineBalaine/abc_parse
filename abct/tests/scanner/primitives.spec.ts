/**
 * Tests for ABCT scanner primitive functions
 */

import { expect } from "chai";
import * as fc from "fast-check";
import { createCtx } from "../../src/scanner/context";
import { AbctTT } from "../../src/scanner/types";
import {
  identifier,
  number,
  string,
  abcLiteral,
  operator,
  collectInvalid,
} from "../../src/scanner/primitives";
import {
  genIdentifier,
  genKeyword,
  genInteger,
  genDecimal,
  genFraction,
  genSimpleString,
  genAbcLiteral,
  genSingleOp,
  genDoubleOp,
} from "./generators";

describe("ABCT Scanner Primitives", () => {
  describe("identifier", () => {
    it("should scan simple identifier 'transpose'", () => {
      const ctx = createCtx("transpose");
      const result = identifier(ctx);
      expect(result).to.be.true;
      expect(ctx.tokens).to.have.length(1);
      expect(ctx.tokens[0].type).to.equal(AbctTT.IDENTIFIER);
      expect(ctx.tokens[0].lexeme).to.equal("transpose");
    });

    it("should scan identifier starting with underscore", () => {
      const ctx = createCtx("_private");
      const result = identifier(ctx);
      expect(result).to.be.true;
      expect(ctx.tokens[0].type).to.equal(AbctTT.IDENTIFIER);
      expect(ctx.tokens[0].lexeme).to.equal("_private");
    });

    it("should scan identifier with numbers", () => {
      const ctx = createCtx("voice2");
      const result = identifier(ctx);
      expect(result).to.be.true;
      expect(ctx.tokens[0].lexeme).to.equal("voice2");
    });

    it("should not scan number as identifier", () => {
      const ctx = createCtx("123");
      const result = identifier(ctx);
      expect(result).to.be.false;
      expect(ctx.tokens).to.have.length(0);
    });

    it("should scan 'and' as AND keyword", () => {
      const ctx = createCtx("and");
      const result = identifier(ctx);
      expect(result).to.be.true;
      expect(ctx.tokens[0].type).to.equal(AbctTT.AND);
    });

    it("should scan 'or' as OR keyword", () => {
      const ctx = createCtx("or");
      const result = identifier(ctx);
      expect(result).to.be.true;
      expect(ctx.tokens[0].type).to.equal(AbctTT.OR);
    });

    it("should scan 'not' as NOT keyword", () => {
      const ctx = createCtx("not");
      const result = identifier(ctx);
      expect(result).to.be.true;
      expect(ctx.tokens[0].type).to.equal(AbctTT.NOT);
    });

    it("property: all generated identifiers scan correctly", () => {
      fc.assert(
        fc.property(genIdentifier, (id) => {
          const ctx = createCtx(id);
          const result = identifier(ctx);
          return result && ctx.tokens[0].type === AbctTT.IDENTIFIER && ctx.tokens[0].lexeme === id;
        }),
        { numRuns: 1000 }
      );
    });

    it("property: keywords scan to their specific types", () => {
      fc.assert(
        fc.property(genKeyword, (kw) => {
          const ctx = createCtx(kw);
          const result = identifier(ctx);
          if (!result) return false;
          const expectedType = kw === "and" ? AbctTT.AND : kw === "or" ? AbctTT.OR : AbctTT.NOT;
          return ctx.tokens[0].type === expectedType;
        })
      );
    });
  });

  describe("number", () => {
    it("should scan positive integer", () => {
      const ctx = createCtx("42");
      const result = number(ctx);
      expect(result).to.be.true;
      expect(ctx.tokens[0].type).to.equal(AbctTT.NUMBER);
      expect(ctx.tokens[0].lexeme).to.equal("42");
    });

    it("should not scan negative integer (let parser handle unary minus)", () => {
      const ctx = createCtx("-5");
      const result = number(ctx);
      // Number scanner should not match leading minus
      expect(result).to.be.false;
    });

    it("should scan decimal number", () => {
      const ctx = createCtx("3.14");
      const result = number(ctx);
      expect(result).to.be.true;
      expect(ctx.tokens[0].lexeme).to.equal("3.14");
    });

    it("should scan fraction", () => {
      const ctx = createCtx("1/4");
      const result = number(ctx);
      expect(result).to.be.true;
      expect(ctx.tokens[0].lexeme).to.equal("1/4");
    });

    it("should not scan identifier as number", () => {
      const ctx = createCtx("abc");
      const result = number(ctx);
      expect(result).to.be.false;
    });

    it("property: all generated integers scan correctly", () => {
      fc.assert(
        fc.property(genInteger, (num) => {
          const ctx = createCtx(num);
          const result = number(ctx);
          return result && ctx.tokens[0].type === AbctTT.NUMBER;
        }),
        { numRuns: 1000 }
      );
    });

    it("property: all generated decimals scan correctly", () => {
      fc.assert(
        fc.property(genDecimal, (num) => {
          const ctx = createCtx(num);
          const result = number(ctx);
          return result && ctx.tokens[0].type === AbctTT.NUMBER;
        }),
        { numRuns: 1000 }
      );
    });

    it("property: all generated fractions scan correctly", () => {
      fc.assert(
        fc.property(genFraction, (num) => {
          const ctx = createCtx(num);
          const result = number(ctx);
          return result && ctx.tokens[0].type === AbctTT.NUMBER;
        }),
        { numRuns: 1000 }
      );
    });
  });

  describe("string", () => {
    it("should scan simple string", () => {
      const ctx = createCtx('"hello"');
      const result = string(ctx);
      expect(result).to.be.true;
      expect(ctx.tokens[0].type).to.equal(AbctTT.STRING);
      expect(ctx.tokens[0].lexeme).to.equal('"hello"');
    });

    it("should scan string with escape sequences", () => {
      const ctx = createCtx('"hello\\nworld"');
      const result = string(ctx);
      expect(result).to.be.true;
      expect(ctx.tokens[0].lexeme).to.equal('"hello\\nworld"');
    });

    it("should report unterminated string", () => {
      const ctx = createCtx('"unterminated');
      const result = string(ctx);
      expect(result).to.be.true;
      expect(ctx.errors).to.have.length(1);
      expect(ctx.errors[0].message).to.include("Unterminated");
    });

    it("should not scan non-string", () => {
      const ctx = createCtx("abc");
      const result = string(ctx);
      expect(result).to.be.false;
    });

    it("property: all generated simple strings scan correctly", () => {
      fc.assert(
        fc.property(genSimpleString, (str) => {
          const ctx = createCtx(str);
          const result = string(ctx);
          return result && ctx.tokens[0].type === AbctTT.STRING;
        }),
        { numRuns: 1000 }
      );
    });
  });

  describe("abcLiteral", () => {
    it("should scan simple ABC literal", () => {
      const ctx = createCtx("<<CDEF>>");
      const result = abcLiteral(ctx);
      expect(result).to.be.true;
      // Should produce: LT_LT, ABC_LITERAL, GT_GT
      expect(ctx.tokens).to.have.length(3);
      expect(ctx.tokens[0].type).to.equal(AbctTT.LT_LT);
      expect(ctx.tokens[1].type).to.equal(AbctTT.ABC_LITERAL);
      expect(ctx.tokens[1].lexeme).to.equal("CDEF");
      expect(ctx.tokens[2].type).to.equal(AbctTT.GT_GT);
    });

    it("should scan empty ABC literal", () => {
      const ctx = createCtx("<<>>");
      const result = abcLiteral(ctx);
      expect(result).to.be.true;
      // Should produce: LT_LT, GT_GT (no ABC_LITERAL for empty content)
      expect(ctx.tokens).to.have.length(2);
      expect(ctx.tokens[0].type).to.equal(AbctTT.LT_LT);
      expect(ctx.tokens[1].type).to.equal(AbctTT.GT_GT);
    });

    it("should scan multi-line ABC literal", () => {
      const ctx = createCtx("<<C D E\nF G A>>");
      const result = abcLiteral(ctx);
      expect(result).to.be.true;
      expect(ctx.tokens[1].lexeme).to.equal("C D E\nF G A");
      expect(ctx.line).to.equal(1); // Line should increment
    });

    it("should report unterminated ABC literal", () => {
      const ctx = createCtx("<<CDEF");
      const result = abcLiteral(ctx);
      expect(result).to.be.true;
      expect(ctx.errors).to.have.length(1);
      expect(ctx.errors[0].message).to.include("Unterminated ABC literal");
    });

    it("should not scan non-ABC literal", () => {
      const ctx = createCtx("abc");
      const result = abcLiteral(ctx);
      expect(result).to.be.false;
    });

    it("property: all generated ABC literals scan correctly", () => {
      fc.assert(
        fc.property(genAbcLiteral, (lit) => {
          const ctx = createCtx(lit);
          const result = abcLiteral(ctx);
          return result && ctx.tokens.length >= 2;
        }),
        { numRuns: 1000 }
      );
    });
  });

  describe("operator", () => {
    it("should scan pipe operator", () => {
      const ctx = createCtx("|");
      const result = operator(ctx);
      expect(result).to.be.true;
      expect(ctx.tokens[0].type).to.equal(AbctTT.PIPE);
    });

    it("should scan pipe-equals operator", () => {
      const ctx = createCtx("|=");
      const result = operator(ctx);
      expect(result).to.be.true;
      expect(ctx.tokens[0].type).to.equal(AbctTT.PIPE_EQ);
      expect(ctx.tokens[0].lexeme).to.equal("|=");
    });

    it("should scan comparison operators", () => {
      const tests: [string, AbctTT][] = [
        [">", AbctTT.GT],
        ["<", AbctTT.LT],
        [">=", AbctTT.GTE],
        ["<=", AbctTT.LTE],
        ["==", AbctTT.EQEQ],
        ["!=", AbctTT.BANGEQ],
      ];
      for (const [op, expected] of tests) {
        const ctx = createCtx(op);
        const result = operator(ctx);
        expect(result, `Failed for ${op}`).to.be.true;
        expect(ctx.tokens[0].type, `Wrong type for ${op}`).to.equal(expected);
      }
    });

    it("should scan single-character operators", () => {
      const tests: [string, AbctTT][] = [
        ["+", AbctTT.PLUS],
        ["=", AbctTT.EQ],
        ["@", AbctTT.AT],
        [":", AbctTT.COLON],
        ["-", AbctTT.MINUS],
        ["(", AbctTT.LPAREN],
        [")", AbctTT.RPAREN],
        ["[", AbctTT.LBRACKET],
        ["]", AbctTT.RBRACKET],
      ];
      for (const [op, expected] of tests) {
        const ctx = createCtx(op);
        const result = operator(ctx);
        expect(result, `Failed for ${op}`).to.be.true;
        expect(ctx.tokens[0].type, `Wrong type for ${op}`).to.equal(expected);
      }
    });

    it("should not scan identifier as operator", () => {
      const ctx = createCtx("abc");
      const result = operator(ctx);
      expect(result).to.be.false;
    });

    it("property: all single operators scan correctly", () => {
      fc.assert(
        fc.property(genSingleOp, (op) => {
          const ctx = createCtx(op);
          const result = operator(ctx);
          return result && ctx.tokens.length === 1;
        })
      );
    });

    it("property: all double operators scan correctly", () => {
      fc.assert(
        fc.property(genDoubleOp, (op) => {
          const ctx = createCtx(op);
          const result = operator(ctx);
          return result && ctx.tokens[0].lexeme === op;
        })
      );
    });
  });

  describe("collectInvalid", () => {
    it("should collect invalid characters", () => {
      const ctx = createCtx("$%^");
      const result = collectInvalid(ctx);
      expect(result).to.be.true;
      expect(ctx.tokens[0].type).to.equal(AbctTT.INVALID);
      expect(ctx.errors).to.have.length(1);
    });

    it("should stop at whitespace", () => {
      const ctx = createCtx("$%^ abc");
      const result = collectInvalid(ctx);
      expect(result).to.be.true;
      expect(ctx.tokens[0].lexeme).to.equal("$%^");
    });

    it("should return false at EOF", () => {
      const ctx = createCtx("");
      const result = collectInvalid(ctx);
      expect(result).to.be.false;
    });
  });
});
