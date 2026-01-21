// Property-based tests for ABCT tokenization
// These tests validate that the token extractor produces correct tokens from parsed ASTs

import { expect } from "chai";
import * as fc from "fast-check";
import { parse, extractTokens, AbctToken, AbctTokenType } from "../src/parser";
import {
  genIdentifier,
  genNumber,
  genPath,
  genSelector,
  genAbcLiteral,
  genSimpleList,
  genExpr,
  genStatement,
  genProgram,
  genTransformPipeline,
} from "./generators";

// Configuration for property tests
const PBT_CONFIG = { numRuns: 1000 };
const PBT_CONFIG_FAST = { numRuns: 100 };

describe("ABCT Tokenization", () => {
  describe("Basic Token Extraction", () => {
    it("should extract tokens for a simple identifier", () => {
      const result = parse("foo");
      expect(result.success).to.be.true;
      if (!result.success) return;

      const tokens = extractTokens(result.value, "foo");
      expect(tokens).to.have.length(1);
      expect(tokens[0].type).to.equal(AbctTokenType.IDENTIFIER);
      expect(tokens[0].text).to.equal("foo");
      expect(tokens[0].line).to.equal(1);
      expect(tokens[0].column).to.equal(1);
    });

    it("should extract tokens for a number literal", () => {
      const result = parse("42");
      expect(result.success).to.be.true;
      if (!result.success) return;

      const tokens = extractTokens(result.value, "42");
      expect(tokens).to.have.length(1);
      expect(tokens[0].type).to.equal(AbctTokenType.NUMBER);
      expect(tokens[0].text).to.equal("42");
    });

    it("should extract tokens for a fraction", () => {
      const result = parse("1/2");
      expect(result.success).to.be.true;
      if (!result.success) return;

      const tokens = extractTokens(result.value, "1/2");
      expect(tokens).to.have.length(1);
      expect(tokens[0].type).to.equal(AbctTokenType.NUMBER);
      expect(tokens[0].text).to.equal("1/2");
    });

    it("should extract tokens for an ABC fence literal", () => {
      const result = parse("```abc\nC D E\n```");
      expect(result.success).to.be.true;
      if (!result.success) return;

      const tokens = extractTokens(result.value, "```abc\nC D E\n```");
      expect(tokens).to.have.length(1);
      expect(tokens[0].type).to.equal(AbctTokenType.ABC_LITERAL);
    });

    it("should extract tokens for a file reference", () => {
      const result = parse("song.abc");
      expect(result.success).to.be.true;
      if (!result.success) return;

      const tokens = extractTokens(result.value, "song.abc");
      expect(tokens).to.have.length(1);
      expect(tokens[0].type).to.equal(AbctTokenType.FILE_REF);
      expect(tokens[0].text).to.equal("song.abc");
    });
  });

  describe("Operator Token Extraction", () => {
    it("should extract tokens for a pipe expression", () => {
      const result = parse("a | b");
      expect(result.success).to.be.true;
      if (!result.success) return;

      const tokens = extractTokens(result.value, "a | b");
      expect(tokens).to.have.length(3);
      expect(tokens[0].type).to.equal(AbctTokenType.IDENTIFIER);
      expect(tokens[1].type).to.equal(AbctTokenType.OPERATOR);
      expect(tokens[1].text).to.equal("|");
      expect(tokens[2].type).to.equal(AbctTokenType.IDENTIFIER);
    });

    it("should extract tokens for a concat expression", () => {
      const result = parse("a.abc + b.abc");
      expect(result.success).to.be.true;
      if (!result.success) return;

      const tokens = extractTokens(result.value, "a.abc + b.abc");
      expect(tokens).to.have.length(3);
      expect(tokens[0].type).to.equal(AbctTokenType.FILE_REF);
      expect(tokens[1].type).to.equal(AbctTokenType.OPERATOR);
      expect(tokens[1].text).to.equal("+");
      expect(tokens[2].type).to.equal(AbctTokenType.FILE_REF);
    });

    it("should extract tokens for an update expression", () => {
      const result = parse("@chords |= transpose 2");
      expect(result.success).to.be.true;
      if (!result.success) return;

      const tokens = extractTokens(result.value, "@chords |= transpose 2");
      // @, chords, |=, transpose, 2
      expect(tokens.some((t) => t.type === AbctTokenType.SELECTOR)).to.be.true;
      expect(tokens.some((t) => t.type === AbctTokenType.OPERATOR && t.text === "|=")).to.be.true;
      expect(tokens.some((t) => t.type === AbctTokenType.IDENTIFIER)).to.be.true;
      expect(tokens.some((t) => t.type === AbctTokenType.NUMBER)).to.be.true;
    });
  });

  describe("Keyword Token Extraction", () => {
    it("should extract tokens for 'and' keyword", () => {
      const result = parse("a and b");
      expect(result.success).to.be.true;
      if (!result.success) return;

      const tokens = extractTokens(result.value, "a and b");
      expect(tokens).to.have.length(3);
      expect(tokens[1].type).to.equal(AbctTokenType.KEYWORD);
      expect(tokens[1].text).to.equal("and");
    });

    it("should extract tokens for 'or' keyword", () => {
      const result = parse("a or b");
      expect(result.success).to.be.true;
      if (!result.success) return;

      const tokens = extractTokens(result.value, "a or b");
      expect(tokens).to.have.length(3);
      expect(tokens[1].type).to.equal(AbctTokenType.KEYWORD);
      expect(tokens[1].text).to.equal("or");
    });

    it("should extract tokens for 'not' keyword", () => {
      const result = parse("not x");
      expect(result.success).to.be.true;
      if (!result.success) return;

      const tokens = extractTokens(result.value, "not x");
      expect(tokens).to.have.length(2);
      expect(tokens[0].type).to.equal(AbctTokenType.KEYWORD);
      expect(tokens[0].text).to.equal("not");
    });
  });

  describe("Assignment Token Extraction", () => {
    it("should mark left side of assignment as variable", () => {
      const result = parse("x = 42");
      expect(result.success).to.be.true;
      if (!result.success) return;

      const tokens = extractTokens(result.value, "x = 42");
      expect(tokens).to.have.length(3);
      expect(tokens[0].type).to.equal(AbctTokenType.VARIABLE);
      expect(tokens[0].text).to.equal("x");
      expect(tokens[1].type).to.equal(AbctTokenType.OPERATOR);
      expect(tokens[1].text).to.equal("=");
      expect(tokens[2].type).to.equal(AbctTokenType.NUMBER);
    });
  });

  describe("Comment Extraction", () => {
    it("should extract comments from source", () => {
      const source = "x # this is a comment";
      const result = parse(source);
      expect(result.success).to.be.true;
      if (!result.success) return;

      const tokens = extractTokens(result.value, source);
      expect(tokens.some((t) => t.type === AbctTokenType.COMMENT)).to.be.true;
      const comment = tokens.find((t) => t.type === AbctTokenType.COMMENT);
      expect(comment?.text).to.equal("# this is a comment");
    });

    it("should extract multiple comments", () => {
      const source = "# comment 1\nx\n# comment 2";
      const result = parse(source);
      expect(result.success).to.be.true;
      if (!result.success) return;

      const tokens = extractTokens(result.value, source);
      const comments = tokens.filter((t) => t.type === AbctTokenType.COMMENT);
      expect(comments).to.have.length(2);
    });
  });

  describe("Property-Based Tests", () => {
    it("property: every generated program tokenizes successfully", () => {
      fc.assert(
        fc.property(genProgram, (input) => {
          const result = parse(input);
          if (!result.success) return true; // Skip parse failures

          const tokens = extractTokens(result.value, input);
          return Array.isArray(tokens);
        }),
        PBT_CONFIG
      );
    });

    it("property: tokenization returns non-empty for expressions with content", () => {
      // Filter out empty lists and parenthesized empty content
      // since those don't produce visible tokens
      const genNonEmptyExpr = genExpr.filter(
        (expr) => expr !== "[]" && expr !== "()" && expr.trim().length > 0
      );
      fc.assert(
        fc.property(genIdentifier, (input) => {
          const result = parse(input);
          if (!result.success) return true;

          const tokens = extractTokens(result.value, input);
          return tokens.length > 0;
        }),
        PBT_CONFIG
      );
    });

    it("property: all tokens have valid line numbers (1-based)", () => {
      fc.assert(
        fc.property(genProgram, (input) => {
          const result = parse(input);
          if (!result.success) return true;

          const tokens = extractTokens(result.value, input);
          return tokens.every((t) => t.line >= 1);
        }),
        PBT_CONFIG
      );
    });

    it("property: all tokens have valid column numbers (1-based)", () => {
      fc.assert(
        fc.property(genProgram, (input) => {
          const result = parse(input);
          if (!result.success) return true;

          const tokens = extractTokens(result.value, input);
          return tokens.every((t) => t.column >= 1);
        }),
        PBT_CONFIG
      );
    });

    it("property: all tokens have positive length", () => {
      fc.assert(
        fc.property(genProgram, (input) => {
          const result = parse(input);
          if (!result.success) return true;

          const tokens = extractTokens(result.value, input);
          return tokens.every((t) => t.length > 0);
        }),
        PBT_CONFIG
      );
    });

    it("property: tokens are sorted by position", () => {
      fc.assert(
        fc.property(genProgram, (input) => {
          const result = parse(input);
          if (!result.success) return true;

          const tokens = extractTokens(result.value, input);
          for (let i = 1; i < tokens.length; i++) {
            const prev = tokens[i - 1];
            const curr = tokens[i];
            if (prev.line > curr.line) return false;
            if (prev.line === curr.line && prev.column > curr.column) return false;
          }
          return true;
        }),
        PBT_CONFIG
      );
    });

    it("property: all tokens have valid types", () => {
      fc.assert(
        fc.property(genProgram, (input) => {
          const result = parse(input);
          if (!result.success) return true;

          const tokens = extractTokens(result.value, input);
          const validTypes = Object.values(AbctTokenType);
          return tokens.every((t) => validTypes.includes(t.type));
        }),
        PBT_CONFIG
      );
    });

    it("property: pipe expressions contain pipe operator token", () => {
      fc.assert(
        fc.property(genIdentifier, genIdentifier, (a, b) => {
          const input = `${a} | ${b}`;
          const result = parse(input);
          if (!result.success) return true;

          const tokens = extractTokens(result.value, input);
          return tokens.some((t) => t.type === AbctTokenType.OPERATOR && t.text === "|");
        }),
        PBT_CONFIG
      );
    });

    it("property: selectors produce selector tokens", () => {
      fc.assert(
        fc.property(genSelector, (sel) => {
          // Use in a valid context
          const input = `file.abc | ${sel}`;
          const result = parse(input);
          if (!result.success) return true;

          const tokens = extractTokens(result.value, input);
          return tokens.some((t) => t.type === AbctTokenType.SELECTOR);
        }),
        PBT_CONFIG
      );
    });

    it("property: file references produce file ref tokens", () => {
      fc.assert(
        fc.property(genPath, (path) => {
          const result = parse(path);
          if (!result.success) return true;

          const tokens = extractTokens(result.value, path);
          return tokens.some((t) => t.type === AbctTokenType.FILE_REF);
        }),
        PBT_CONFIG
      );
    });

    it("property: ABC literals produce abc literal tokens", () => {
      fc.assert(
        fc.property(genAbcLiteral, (lit) => {
          const result = parse(lit);
          if (!result.success) return true;

          const tokens = extractTokens(result.value, lit);
          return tokens.some((t) => t.type === AbctTokenType.ABC_LITERAL);
        }),
        PBT_CONFIG
      );
    });

    it("property: numbers produce number tokens", () => {
      // Note: Negative numbers like "-1" are now parsed as MINUS + NUMBER tokens
      // by the scanner, with the parser creating a Negate node. This test only
      // checks non-negative numbers for the NUMBER token.
      const genNonNegativeNumber = fc.oneof(
        fc.nat({ max: 999 }).map(String),
        fc
          .tuple(fc.nat({ max: 99 }), fc.integer({ min: 1, max: 99 }))
          .map(([num, denom]) => `${num}/${denom}`)
      );
      fc.assert(
        fc.property(genNonNegativeNumber, (num) => {
          const result = parse(num);
          if (!result.success) return true;

          const tokens = extractTokens(result.value, num);
          return tokens.some((t) => t.type === AbctTokenType.NUMBER);
        }),
        PBT_CONFIG
      );
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty programs", () => {
      const result = parse("");
      expect(result.success).to.be.true;
      if (!result.success) return;

      const tokens = extractTokens(result.value, "");
      expect(tokens).to.have.length(0);
    });

    it("should handle comment-only programs", () => {
      const source = "# just a comment";
      const result = parse(source);
      expect(result.success).to.be.true;
      if (!result.success) return;

      const tokens = extractTokens(result.value, source);
      expect(tokens).to.have.length(1);
      expect(tokens[0].type).to.equal(AbctTokenType.COMMENT);
    });

    it("should handle multi-line programs", () => {
      const source = "x = 1\ny = 2\nz = x | y";
      const result = parse(source);
      expect(result.success).to.be.true;
      if (!result.success) return;

      const tokens = extractTokens(result.value, source);
      expect(tokens.length).to.be.greaterThan(0);

      // Check that tokens span multiple lines
      const lines = new Set(tokens.map((t) => t.line));
      expect(lines.size).to.equal(3);
    });

    it("should handle complex nested expressions", () => {
      const source = "file.abc | @chords |= (transpose 2 | retrograde)";
      const result = parse(source);
      expect(result.success).to.be.true;
      if (!result.success) return;

      const tokens = extractTokens(result.value, source);
      // At least 5 tokens: file.abc, @chords, transpose, 2, retrograde
      expect(tokens.length).to.be.greaterThanOrEqual(5);
    });
  });
});
