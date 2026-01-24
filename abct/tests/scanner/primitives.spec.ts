/**
 * Tests for ABCT scanner primitive functions
 */

import { expect } from "chai";
import * as fc from "fast-check";
import { createCtx, AbctCtx } from "../../src/scanner/context";
import { AbctContext } from "../../src/context";
import { AbctTT, Token } from "../../src/scanner/types";
import { scan } from "../../src/scanner/scanner";
import {
  identifier,
  number,
  string,
  abcFence,
  abcLiteral,
  operator,
  collectInvalid,
  sanitizeAbcContent,
  desanitizeAbcContent,
} from "../../src/scanner/primitives";
import {
  genIdentifier,
  genKeyword,
  genInteger,
  genDecimal,
  genFraction,
  genSimpleString,
  genAbcFence,
  genAbcFenceWithLocation,
  genAbcLiteral,
  genSingleOp,
  genDoubleOp,
  genSafeSingleOp,
  genWS,
  genNumber,
  genString,
  genAnyToken,
} from "./generators";

/** Helper to create a scanner context with a fresh AbctContext */
function createTestCtx(source: string): { ctx: AbctCtx; abctCtx: AbctContext } {
  const abctCtx = new AbctContext();
  const ctx = createCtx(source, abctCtx);
  return { ctx, abctCtx };
}

/** Helper to scan source with a fresh context */
function scanSource(source: string): { tokens: Token[]; ctx: AbctContext } {
  const ctx = new AbctContext();
  const tokens = scan(source, ctx);
  return { tokens, ctx };
}

/** Helper to reconstruct source from tokens */
function reconstructSource(source: string): string | null {
  const { tokens, ctx } = scanSource(source);
  if (ctx.errorReporter.hasErrors()) return null;
  return tokens
    .filter((t) => t.type !== AbctTT.EOF)
    .map((t) => t.lexeme)
    .join("");
}

describe("ABCT Scanner Primitives", () => {
  describe("identifier", () => {
    it("should scan simple identifier 'transpose'", () => {
      const { ctx, abctCtx } = createTestCtx("transpose");
      const result = identifier(ctx);
      expect(result).to.be.true;
      expect(ctx.tokens).to.have.length(1);
      expect(ctx.tokens[0].type).to.equal(AbctTT.IDENTIFIER);
      expect(ctx.tokens[0].lexeme).to.equal("transpose");
    });

    it("should scan identifier starting with underscore", () => {
      const { ctx, abctCtx } = createTestCtx("_private");
      const result = identifier(ctx);
      expect(result).to.be.true;
      expect(ctx.tokens[0].type).to.equal(AbctTT.IDENTIFIER);
      expect(ctx.tokens[0].lexeme).to.equal("_private");
    });

    it("should scan identifier with numbers", () => {
      const { ctx, abctCtx } = createTestCtx("voice2");
      const result = identifier(ctx);
      expect(result).to.be.true;
      expect(ctx.tokens[0].lexeme).to.equal("voice2");
    });

    it("should not scan number as identifier", () => {
      const { ctx, abctCtx } = createTestCtx("123");
      const result = identifier(ctx);
      expect(result).to.be.false;
      expect(ctx.tokens).to.have.length(0);
    });

    it("should scan 'and' as AND keyword", () => {
      const { ctx, abctCtx } = createTestCtx("and");
      const result = identifier(ctx);
      expect(result).to.be.true;
      expect(ctx.tokens[0].type).to.equal(AbctTT.AND);
    });

    it("should scan 'or' as OR keyword", () => {
      const { ctx, abctCtx } = createTestCtx("or");
      const result = identifier(ctx);
      expect(result).to.be.true;
      expect(ctx.tokens[0].type).to.equal(AbctTT.OR);
    });

    it("should scan 'not' as NOT keyword", () => {
      const { ctx, abctCtx } = createTestCtx("not");
      const result = identifier(ctx);
      expect(result).to.be.true;
      expect(ctx.tokens[0].type).to.equal(AbctTT.NOT);
    });

    it("should scan 'fn' as FN keyword", () => {
      const { ctx } = createTestCtx("fn");
      identifier(ctx);
      expect(ctx.tokens[0].type).to.equal(AbctTT.FN);
    });

    it("should scan 'match' as MATCH keyword", () => {
      const { ctx } = createTestCtx("match");
      identifier(ctx);
      expect(ctx.tokens[0].type).to.equal(AbctTT.MATCH);
    });

    it("should scan 'over' as OVER keyword", () => {
      const { ctx } = createTestCtx("over");
      identifier(ctx);
      expect(ctx.tokens[0].type).to.equal(AbctTT.OVER);
    });

    it("should scan 'let' as LET keyword", () => {
      const { ctx } = createTestCtx("let");
      identifier(ctx);
      expect(ctx.tokens[0].type).to.equal(AbctTT.LET);
    });

    it("should scan 'if' as IF keyword", () => {
      const { ctx } = createTestCtx("if");
      identifier(ctx);
      expect(ctx.tokens[0].type).to.equal(AbctTT.IF);
    });

    it("should scan 'then' as THEN keyword", () => {
      const { ctx } = createTestCtx("then");
      identifier(ctx);
      expect(ctx.tokens[0].type).to.equal(AbctTT.THEN);
    });

    it("should scan 'else' as ELSE keyword", () => {
      const { ctx } = createTestCtx("else");
      identifier(ctx);
      expect(ctx.tokens[0].type).to.equal(AbctTT.ELSE);
    });

    it("should scan 'topdown' as TOPDOWN keyword", () => {
      const { ctx } = createTestCtx("topdown");
      identifier(ctx);
      expect(ctx.tokens[0].type).to.equal(AbctTT.TOPDOWN);
    });

    it("should scan 'bottomup' as BOTTOMUP keyword", () => {
      const { ctx } = createTestCtx("bottomup");
      identifier(ctx);
      expect(ctx.tokens[0].type).to.equal(AbctTT.BOTTOMUP);
    });

    it("should scan 'oncetd' as ONCETD keyword", () => {
      const { ctx } = createTestCtx("oncetd");
      identifier(ctx);
      expect(ctx.tokens[0].type).to.equal(AbctTT.ONCETD);
    });

    it("should scan 'alltd' as ALLTD keyword", () => {
      const { ctx } = createTestCtx("alltd");
      identifier(ctx);
      expect(ctx.tokens[0].type).to.equal(AbctTT.ALLTD);
    });

    it("should scan 'load' as LOAD keyword", () => {
      const { ctx } = createTestCtx("load");
      identifier(ctx);
      expect(ctx.tokens[0].type).to.equal(AbctTT.LOAD);
    });

    it("should scan 'function' as IDENTIFIER, not FN", () => {
      const { ctx } = createTestCtx("function");
      identifier(ctx);
      expect(ctx.tokens[0].type).to.equal(AbctTT.IDENTIFIER);
      expect(ctx.tokens[0].lexeme).to.equal("function");
    });

    it("should scan 'overture' as IDENTIFIER, not OVER", () => {
      const { ctx } = createTestCtx("overture");
      identifier(ctx);
      expect(ctx.tokens[0].type).to.equal(AbctTT.IDENTIFIER);
    });

    it("should scan 'loading' as IDENTIFIER, not LOAD", () => {
      const { ctx } = createTestCtx("loading");
      identifier(ctx);
      expect(ctx.tokens[0].type).to.equal(AbctTT.IDENTIFIER);
    });

    it("should scan 'iffy' as IDENTIFIER, not IF", () => {
      const { ctx } = createTestCtx("iffy");
      identifier(ctx);
      expect(ctx.tokens[0].type).to.equal(AbctTT.IDENTIFIER);
    });

    it("should scan 'letter' as IDENTIFIER, not LET", () => {
      const { ctx } = createTestCtx("letter");
      identifier(ctx);
      expect(ctx.tokens[0].type).to.equal(AbctTT.IDENTIFIER);
    });

    it("property: all generated identifiers scan correctly", () => {
      fc.assert(
        fc.property(genIdentifier, (id) => {
          const { ctx, abctCtx } = createTestCtx(id);
          const result = identifier(ctx);
          return result && ctx.tokens[0].type === AbctTT.IDENTIFIER && ctx.tokens[0].lexeme === id;
        }),
        { numRuns: 1000 }
      );
    });

    it("property: all generated keywords scan to keyword tokens", () => {
      fc.assert(
        fc.property(genKeyword, (kw) => {
          const { ctx } = createTestCtx(kw);
          identifier(ctx);
          return ctx.tokens[0].type !== AbctTT.IDENTIFIER;
        }),
        { numRuns: 1000 }
      );
    });

    it("property: generated identifiers never produce keyword tokens", () => {
      fc.assert(
        fc.property(genIdentifier, (id) => {
          const { ctx } = createTestCtx(id);
          identifier(ctx);
          return ctx.tokens[0].type === AbctTT.IDENTIFIER;
        }),
        { numRuns: 5000 }
      );
    });
  });

  describe("number", () => {
    it("should scan positive integer", () => {
      const { ctx, abctCtx } = createTestCtx("42");
      const result = number(ctx);
      expect(result).to.be.true;
      expect(ctx.tokens[0].type).to.equal(AbctTT.NUMBER);
      expect(ctx.tokens[0].lexeme).to.equal("42");
    });

    it("should not scan negative integer (let parser handle unary minus)", () => {
      const { ctx, abctCtx } = createTestCtx("-5");
      const result = number(ctx);
      // Number scanner should not match leading minus
      expect(result).to.be.false;
    });

    it("should scan decimal number", () => {
      const { ctx, abctCtx } = createTestCtx("3.14");
      const result = number(ctx);
      expect(result).to.be.true;
      expect(ctx.tokens[0].lexeme).to.equal("3.14");
    });

    it("should scan fraction", () => {
      const { ctx, abctCtx } = createTestCtx("1/4");
      const result = number(ctx);
      expect(result).to.be.true;
      expect(ctx.tokens[0].lexeme).to.equal("1/4");
    });

    it("should not scan identifier as number", () => {
      const { ctx, abctCtx } = createTestCtx("abc");
      const result = number(ctx);
      expect(result).to.be.false;
    });

    it("property: all generated integers scan correctly", () => {
      fc.assert(
        fc.property(genInteger, (num) => {
          const { ctx, abctCtx } = createTestCtx(num);
          const result = number(ctx);
          return result && ctx.tokens[0].type === AbctTT.NUMBER;
        }),
        { numRuns: 1000 }
      );
    });

    it("property: all generated decimals scan correctly", () => {
      fc.assert(
        fc.property(genDecimal, (num) => {
          const { ctx, abctCtx } = createTestCtx(num);
          const result = number(ctx);
          return result && ctx.tokens[0].type === AbctTT.NUMBER;
        }),
        { numRuns: 1000 }
      );
    });

    it("property: all generated fractions scan correctly", () => {
      fc.assert(
        fc.property(genFraction, (num) => {
          const { ctx, abctCtx } = createTestCtx(num);
          const result = number(ctx);
          return result && ctx.tokens[0].type === AbctTT.NUMBER;
        }),
        { numRuns: 1000 }
      );
    });
  });

  describe("string", () => {
    it("should scan simple string", () => {
      const { ctx, abctCtx } = createTestCtx('"hello"');
      const result = string(ctx);
      expect(result).to.be.true;
      expect(ctx.tokens[0].type).to.equal(AbctTT.STRING);
      expect(ctx.tokens[0].lexeme).to.equal('"hello"');
    });

    it("should scan string with escape sequences", () => {
      const { ctx, abctCtx } = createTestCtx('"hello\\nworld"');
      const result = string(ctx);
      expect(result).to.be.true;
      expect(ctx.tokens[0].lexeme).to.equal('"hello\\nworld"');
    });

    it("should report unterminated string", () => {
      const { ctx, abctCtx } = createTestCtx('"unterminated');
      const result = string(ctx);
      expect(result).to.be.true;
      expect(abctCtx.errorReporter.getErrors()).to.have.length(1);
      expect(abctCtx.errorReporter.getErrors()[0].message).to.include("Unterminated");
    });

    it("should not scan non-string", () => {
      const { ctx, abctCtx } = createTestCtx("abc");
      const result = string(ctx);
      expect(result).to.be.false;
    });

    it("property: all generated simple strings scan correctly", () => {
      fc.assert(
        fc.property(genSimpleString, (str) => {
          const { ctx, abctCtx } = createTestCtx(str);
          const result = string(ctx);
          return result && ctx.tokens[0].type === AbctTT.STRING;
        }),
        { numRuns: 1000 }
      );
    });
  });

  describe("abcFence", () => {
    it("should scan basic ABC fence", () => {
      const { ctx, abctCtx } = createTestCtx("```abc\nCDEF\n```");
      const result = abcFence(ctx);
      expect(result).to.be.true;
      // Should produce: ABC_FENCE_OPEN, ABC_CONTENT, ABC_FENCE_CLOSE
      expect(ctx.tokens).to.have.length(3);
      expect(ctx.tokens[0].type).to.equal(AbctTT.ABC_FENCE_OPEN);
      expect(ctx.tokens[0].lexeme).to.equal("```abc\n"); // Includes trailing newline for round-trip
      expect(ctx.tokens[1].type).to.equal(AbctTT.ABC_CONTENT);
      expect(ctx.tokens[1].lexeme).to.equal("CDEF\n"); // Includes trailing newline for round-trip
      expect(ctx.tokens[2].type).to.equal(AbctTT.ABC_FENCE_CLOSE);
      expect(ctx.tokens[2].lexeme).to.equal("```");
    });

    it("should scan ABC fence with line-only location", () => {
      const { ctx, abctCtx } = createTestCtx("```abc :10\nCDEF\n```");
      const result = abcFence(ctx);
      expect(result).to.be.true;
      expect(ctx.tokens[0].type).to.equal(AbctTT.ABC_FENCE_OPEN);
      expect(ctx.tokens[0].lexeme).to.equal("```abc :10\n"); // Includes trailing newline
    });

    it("should scan ABC fence with line:col location", () => {
      const { ctx, abctCtx } = createTestCtx("```abc :10:5\nCDEF\n```");
      const result = abcFence(ctx);
      expect(result).to.be.true;
      expect(ctx.tokens[0].lexeme).to.equal("```abc :10:5\n"); // Includes trailing newline
    });

    it("should scan ABC fence with single-line range", () => {
      const { ctx, abctCtx } = createTestCtx("```abc :10:5-15\nCDEF\n```");
      const result = abcFence(ctx);
      expect(result).to.be.true;
      expect(ctx.tokens[0].lexeme).to.equal("```abc :10:5-15\n"); // Includes trailing newline
    });

    it("should scan ABC fence with multi-line range", () => {
      const { ctx, abctCtx } = createTestCtx("```abc :10:5-12:20\nCDEF\n```");
      const result = abcFence(ctx);
      expect(result).to.be.true;
      expect(ctx.tokens[0].lexeme).to.equal("```abc :10:5-12:20\n"); // Includes trailing newline
    });

    it("should scan ABC fence without language specifier", () => {
      const { ctx, abctCtx } = createTestCtx("```\nCDEF\n```");
      const result = abcFence(ctx);
      expect(result).to.be.true;
      expect(ctx.tokens).to.have.length(3);
      expect(ctx.tokens[0].type).to.equal(AbctTT.ABC_FENCE_OPEN);
      expect(ctx.tokens[0].lexeme).to.equal("```\n");
      expect(ctx.tokens[1].type).to.equal(AbctTT.ABC_CONTENT);
      expect(ctx.tokens[1].lexeme).to.equal("CDEF\n");
      expect(ctx.tokens[2].type).to.equal(AbctTT.ABC_FENCE_CLOSE);
    });

    it("should scan ABC fence without language specifier but with location", () => {
      const { ctx, abctCtx } = createTestCtx("``` :10:5\nCDEF\n```");
      const result = abcFence(ctx);
      expect(result).to.be.true;
      expect(ctx.tokens[0].type).to.equal(AbctTT.ABC_FENCE_OPEN);
      expect(ctx.tokens[0].lexeme).to.equal("``` :10:5\n");
    });

    it("should scan empty ABC fence", () => {
      const { ctx, abctCtx } = createTestCtx("```abc\n```");
      const result = abcFence(ctx);
      expect(result).to.be.true;
      // Should produce: ABC_FENCE_OPEN, ABC_FENCE_CLOSE (no ABC_CONTENT for empty content)
      expect(ctx.tokens).to.have.length(2);
      expect(ctx.tokens[0].type).to.equal(AbctTT.ABC_FENCE_OPEN);
      expect(ctx.tokens[1].type).to.equal(AbctTT.ABC_FENCE_CLOSE);
    });

    it("should scan multi-line ABC fence", () => {
      const { ctx, abctCtx } = createTestCtx("```abc\nC D E\nF G A\n```");
      const result = abcFence(ctx);
      expect(result).to.be.true;
      expect(ctx.tokens[1].lexeme).to.equal("C D E\nF G A\n"); // Includes trailing newline
    });

    it("should handle leading whitespace before fence", () => {
      const { ctx, abctCtx } = createTestCtx("  ```abc\nCDEF\n```");
      const result = abcFence(ctx);
      expect(result).to.be.true;
      expect(ctx.tokens[0].type).to.equal(AbctTT.ABC_FENCE_OPEN);
    });

    it("should not close on non-line-start backticks", () => {
      const { ctx, abctCtx } = createTestCtx("```abc\nsome ``` content\n```");
      const result = abcFence(ctx);
      expect(result).to.be.true;
      // Content should include the inline ``` (sanitized)
      const contentToken = ctx.tokens.find((t) => t.type === AbctTT.ABC_CONTENT);
      expect(contentToken?.lexeme).to.include("\\`\\`\\`");
    });

    it("should sanitize triple backticks in content", () => {
      const { ctx, abctCtx } = createTestCtx("```abc\nsome ``` in content\n```");
      const result = abcFence(ctx);
      expect(result).to.be.true;
      const contentToken = ctx.tokens.find((t) => t.type === AbctTT.ABC_CONTENT);
      expect(contentToken?.lexeme).to.equal("some \\`\\`\\` in content\n"); // Includes trailing newline
    });

    it("should report unterminated ABC fence", () => {
      const { ctx, abctCtx } = createTestCtx("```abc\nCDEF");
      const result = abcFence(ctx);
      expect(result).to.be.true;
      expect(abctCtx.errorReporter.getErrors()).to.have.length(1);
      expect(abctCtx.errorReporter.getErrors()[0].message).to.include("Unterminated ABC fence");
    });

    it("should not scan when not at line start", () => {
      const { ctx, abctCtx } = createTestCtx("x ```abc\nCDEF\n```");
      // Advance past the first character
      ctx.current = 2;
      ctx.start = 2;
      const result = abcFence(ctx);
      expect(result).to.be.false;
    });

    it("should not scan non-ABC fence", () => {
      const { ctx, abctCtx } = createTestCtx("abc");
      const result = abcFence(ctx);
      expect(result).to.be.false;
    });

    it("property: all generated ABC fences scan correctly", () => {
      fc.assert(
        fc.property(genAbcFence, (lit) => {
          const { ctx, abctCtx } = createTestCtx(lit);
          const result = abcFence(ctx);
          return result && ctx.tokens.length >= 2;
        }),
        { numRuns: 1000 }
      );
    });

    it("property: ABC fences with location scan correctly", () => {
      fc.assert(
        fc.property(genAbcFenceWithLocation, (lit) => {
          const { ctx, abctCtx } = createTestCtx(lit);
          const result = abcFence(ctx);
          return result && ctx.tokens[0].lexeme.includes(":");
        }),
        { numRuns: 1000 }
      );
    });
  });

  describe("sanitization utilities", () => {
    it("should sanitize triple backticks", () => {
      expect(sanitizeAbcContent("A ``` B")).to.equal("A \\`\\`\\` B");
    });

    it("should sanitize hash symbols", () => {
      expect(sanitizeAbcContent("F#G A|B")).to.equal("F\\#G A|B");
    });

    it("should sanitize both backticks and hash", () => {
      expect(sanitizeAbcContent("F# ``` G#")).to.equal("F\\# \\`\\`\\` G\\#");
    });

    it("should desanitize escaped backticks", () => {
      expect(desanitizeAbcContent("A \\`\\`\\` B")).to.equal("A ``` B");
    });

    it("should desanitize escaped hash", () => {
      expect(desanitizeAbcContent("F\\#G A|B")).to.equal("F#G A|B");
    });

    it("should round-trip correctly", () => {
      const original = "X:1\n```\nK:C";
      const sanitized = sanitizeAbcContent(original);
      const desanitized = desanitizeAbcContent(sanitized);
      expect(desanitized).to.equal(original);
    });

    it("should round-trip ABC with sharps correctly", () => {
      const original = "F#G ^A|B c# D";
      const sanitized = sanitizeAbcContent(original);
      const desanitized = desanitizeAbcContent(sanitized);
      expect(desanitized).to.equal(original);
    });

    it("property: sanitization round-trips correctly", () => {
      fc.assert(
        fc.property(fc.string({ minLength: 0, maxLength: 200 }), (original) => {
          const sanitized = sanitizeAbcContent(original);
          const desanitized = desanitizeAbcContent(sanitized);
          return desanitized === original;
        }),
        { numRuns: 1000 }
      );
    });
  });

  describe("operator", () => {
    it("should scan pipe operator", () => {
      const { ctx, abctCtx } = createTestCtx("|");
      const result = operator(ctx);
      expect(result).to.be.true;
      expect(ctx.tokens[0].type).to.equal(AbctTT.PIPE);
    });

    it("should scan '=>' as ARROW", () => {
      const { ctx } = createTestCtx("=>");
      const result = operator(ctx);
      expect(result).to.be.true;
      expect(ctx.tokens[0].type).to.equal(AbctTT.ARROW);
      expect(ctx.tokens[0].lexeme).to.equal("=>");
    });

    it("should scan '{' as LBRACE", () => {
      const { ctx } = createTestCtx("{");
      const result = operator(ctx);
      expect(result).to.be.true;
      expect(ctx.tokens[0].type).to.equal(AbctTT.LBRACE);
    });

    it("should scan '}' as RBRACE", () => {
      const { ctx } = createTestCtx("}");
      const result = operator(ctx);
      expect(result).to.be.true;
      expect(ctx.tokens[0].type).to.equal(AbctTT.RBRACE);
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
        const { ctx, abctCtx } = createTestCtx(op);
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
        const { ctx, abctCtx } = createTestCtx(op);
        const result = operator(ctx);
        expect(result, `Failed for ${op}`).to.be.true;
        expect(ctx.tokens[0].type, `Wrong type for ${op}`).to.equal(expected);
      }
    });

    it("should not scan identifier as operator", () => {
      const { ctx, abctCtx } = createTestCtx("abc");
      const result = operator(ctx);
      expect(result).to.be.false;
    });

    it("property: all single operators scan correctly", () => {
      fc.assert(
        fc.property(genSingleOp, (op) => {
          const { ctx, abctCtx } = createTestCtx(op);
          const result = operator(ctx);
          return result && ctx.tokens.length === 1;
        })
      );
    });

    it("property: all double operators scan correctly", () => {
      fc.assert(
        fc.property(genDoubleOp, (op) => {
          const { ctx, abctCtx } = createTestCtx(op);
          const result = operator(ctx);
          return result && ctx.tokens[0].lexeme === op;
        })
      );
    });
  });

  describe("collectInvalid", () => {
    it("should collect invalid characters", () => {
      const { ctx, abctCtx } = createTestCtx("$%^");
      const result = collectInvalid(ctx);
      expect(result).to.be.true;
      expect(ctx.tokens[0].type).to.equal(AbctTT.INVALID);
      expect(abctCtx.errorReporter.getErrors()).to.have.length(1);
    });

    it("should stop at whitespace", () => {
      const { ctx, abctCtx } = createTestCtx("$%^ abc");
      const result = collectInvalid(ctx);
      expect(result).to.be.true;
      expect(ctx.tokens[0].lexeme).to.equal("$%^");
    });

    it("should return false at EOF", () => {
      const { ctx, abctCtx } = createTestCtx("");
      const result = collectInvalid(ctx);
      expect(result).to.be.false;
    });
  });

  describe("abcLiteral", () => {
    it("should scan a simple ABC literal", () => {
      const { ctx } = createTestCtx("`CEG A2`");
      abcLiteral(ctx);
      expect(ctx.tokens).to.have.length(3);
      expect(ctx.tokens[0].type).to.equal(AbctTT.ABC_LITERAL_OPEN);
      expect(ctx.tokens[0].lexeme).to.equal("`");
      expect(ctx.tokens[1].type).to.equal(AbctTT.ABC_LITERAL_CONTENT);
      expect(ctx.tokens[1].lexeme).to.equal("CEG A2");
      expect(ctx.tokens[2].type).to.equal(AbctTT.ABC_LITERAL_CLOSE);
      expect(ctx.tokens[2].lexeme).to.equal("`");
    });

    it("should scan an empty ABC literal", () => {
      const { ctx } = createTestCtx("``");
      abcLiteral(ctx);
      expect(ctx.tokens).to.have.length(3);
      expect(ctx.tokens[1].type).to.equal(AbctTT.ABC_LITERAL_CONTENT);
      expect(ctx.tokens[1].lexeme).to.equal("");
    });

    it("should handle a backtick followed by more backticks gracefully", () => {
      // When abcFence runs first in scanToken and rejects the input,
      // abcLiteral treats the first backtick as a literal opening
      const { ctx } = createTestCtx("```abc");
      const result = abcLiteral(ctx);
      expect(result).to.be.true;
      expect(ctx.tokens[0].type).to.equal(AbctTT.ABC_LITERAL_OPEN);
    });

    it("should handle unclosed ABC literal at end of input", () => {
      const { ctx } = createTestCtx("`CEG A2");
      abcLiteral(ctx);
      expect(ctx.tokens).to.have.length(2);
      expect(ctx.tokens[0].type).to.equal(AbctTT.ABC_LITERAL_OPEN);
      expect(ctx.tokens[1].type).to.equal(AbctTT.ABC_LITERAL_CONTENT);
    });

    it("should stop at newline without closing", () => {
      const { ctx } = createTestCtx("`CEG\nA2`");
      abcLiteral(ctx);
      expect(ctx.tokens).to.have.length(2);
      expect(ctx.tokens[1].lexeme).to.equal("CEG");
    });

    it("should stop at carriage return without closing", () => {
      const { ctx } = createTestCtx("`CEG\rA2`");
      abcLiteral(ctx);
      expect(ctx.tokens).to.have.length(2);
      expect(ctx.tokens[1].lexeme).to.equal("CEG");
    });

    it("property: ABC literals round-trip", () => {
      fc.assert(
        fc.property(genAbcLiteral, (literal) => {
          const { tokens } = scanSource(literal);
          const reconstructed = tokens.map(t => t.lexeme).join("");
          return reconstructed === literal;
        }),
        { numRuns: 5000 }
      );
    });
  });

  describe("arrow operator properties", () => {
    it("property: '=>' followed by any token scans as ARROW + remainder", () => {
      fc.assert(
        fc.property(genAnyToken, (suffix) => {
          const source = "=>" + suffix;
          const { tokens } = scanSource(source);
          return tokens[0].type === AbctTT.ARROW && tokens[0].lexeme === "=>";
        }),
        { numRuns: 5000 }
      );
    });

    it("property: token sequences with braces round-trip", () => {
      const genTokenWithBraces: fc.Arbitrary<string> = fc.oneof(
        genIdentifier, genKeyword, genNumber, genString,
        genSafeSingleOp, genDoubleOp, genWS
      );

      fc.assert(
        fc.property(
          fc.array(genTokenWithBraces, { minLength: 1, maxLength: 15 }),
          (parts) => {
            const source = parts.join("");
            const reconstructed = reconstructSource(source);
            // Skip inputs that produce errors (token merging can create invalid sequences)
            return reconstructed === null || reconstructed === source;
          }
        ),
        { numRuns: 5000 }
      );
    });
  });
});
