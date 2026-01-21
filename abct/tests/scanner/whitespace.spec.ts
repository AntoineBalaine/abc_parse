/**
 * Tests for ABCT scanner whitespace functions
 */

import { expect } from "chai";
import * as fc from "fast-check";
import { createCtx, AbctCtx } from "../../src/scanner/context";
import { AbctContext } from "../../src/context";
import { AbctTT } from "../../src/scanner/types";
import { WS, EOL, comment } from "../../src/scanner/whitespace";
import { genWS, genEOL, genComment } from "./generators";

/** Helper to create a scanner context with a fresh AbctContext */
function createTestCtx(source: string): AbctCtx {
  const abctCtx = new AbctContext();
  return createCtx(source, abctCtx);
}

describe("ABCT Scanner Whitespace", () => {
  describe("WS", () => {
    it("should scan spaces", () => {
      const ctx = createTestCtx("   ");
      const result = WS(ctx);
      expect(result).to.be.true;
      expect(ctx.tokens[0].type).to.equal(AbctTT.WS);
      expect(ctx.tokens[0].lexeme).to.equal("   ");
    });

    it("should scan tabs", () => {
      const ctx = createTestCtx("\t\t");
      const result = WS(ctx);
      expect(result).to.be.true;
      expect(ctx.tokens[0].lexeme).to.equal("\t\t");
    });

    it("should scan mixed spaces and tabs", () => {
      const ctx = createTestCtx(" \t ");
      const result = WS(ctx);
      expect(result).to.be.true;
      expect(ctx.tokens[0].lexeme).to.equal(" \t ");
    });

    it("should not scan newlines", () => {
      const ctx = createTestCtx("\n");
      const result = WS(ctx);
      expect(result).to.be.false;
    });

    it("should not scan non-whitespace", () => {
      const ctx = createTestCtx("abc");
      const result = WS(ctx);
      expect(result).to.be.false;
    });

    it("property: all generated whitespace scans correctly", () => {
      fc.assert(
        fc.property(genWS, (ws) => {
          const ctx = createTestCtx(ws);
          const result = WS(ctx);
          return result && ctx.tokens[0].type === AbctTT.WS && ctx.tokens[0].lexeme === ws;
        }),
        { numRuns: 1000 }
      );
    });
  });

  describe("EOL", () => {
    it("should scan LF", () => {
      const ctx = createTestCtx("\n");
      const result = EOL(ctx);
      expect(result).to.be.true;
      expect(ctx.tokens[0].type).to.equal(AbctTT.EOL);
      expect(ctx.tokens[0].lexeme).to.equal("\n");
      expect(ctx.line).to.equal(1);
    });

    it("should scan CR", () => {
      const ctx = createTestCtx("\r");
      const result = EOL(ctx);
      expect(result).to.be.true;
      expect(ctx.tokens[0].lexeme).to.equal("\r");
      expect(ctx.line).to.equal(1);
    });

    it("should scan CRLF", () => {
      const ctx = createTestCtx("\r\n");
      const result = EOL(ctx);
      expect(result).to.be.true;
      expect(ctx.tokens[0].lexeme).to.equal("\r\n");
      expect(ctx.line).to.equal(1);
    });

    it("should not scan spaces", () => {
      const ctx = createTestCtx("   ");
      const result = EOL(ctx);
      expect(result).to.be.false;
    });

    it("should track line start correctly", () => {
      const ctx = createTestCtx("\nabc");
      EOL(ctx);
      expect(ctx.lineStart).to.equal(1);
    });

    it("property: all generated EOL scans correctly", () => {
      fc.assert(
        fc.property(genEOL, (eol) => {
          const ctx = createTestCtx(eol);
          const result = EOL(ctx);
          return result && ctx.tokens[0].type === AbctTT.EOL && ctx.line === 1;
        })
      );
    });
  });

  describe("comment", () => {
    it("should scan comment to end of line", () => {
      const ctx = createTestCtx("# this is a comment");
      const result = comment(ctx);
      expect(result).to.be.true;
      expect(ctx.tokens[0].type).to.equal(AbctTT.COMMENT);
      expect(ctx.tokens[0].lexeme).to.equal("# this is a comment");
    });

    it("should not consume the newline", () => {
      const ctx = createTestCtx("# comment\ncode");
      const result = comment(ctx);
      expect(result).to.be.true;
      expect(ctx.tokens[0].lexeme).to.equal("# comment");
      expect(ctx.current).to.equal(9); // Position before newline
    });

    it("should scan empty comment", () => {
      const ctx = createTestCtx("#");
      const result = comment(ctx);
      expect(result).to.be.true;
      expect(ctx.tokens[0].lexeme).to.equal("#");
    });

    it("should not scan non-comment", () => {
      const ctx = createTestCtx("abc");
      const result = comment(ctx);
      expect(result).to.be.false;
    });

    it("property: all generated comments scan correctly", () => {
      fc.assert(
        fc.property(genComment, (cmt) => {
          const ctx = createTestCtx(cmt);
          const result = comment(ctx);
          return result && ctx.tokens[0].type === AbctTT.COMMENT && ctx.tokens[0].lexeme === cmt;
        }),
        { numRuns: 1000 }
      );
    });
  });

  describe("line tracking", () => {
    it("should track multiple lines", () => {
      const ctx = createTestCtx("a\nb\nc");
      // Simulate scanning through multiple lines
      ctx.current = 1;
      ctx.start = 1;
      EOL(ctx);
      expect(ctx.line).to.equal(1);

      ctx.current = 3;
      ctx.start = 3;
      EOL(ctx);
      expect(ctx.line).to.equal(2);
    });

    it("should calculate correct column after newline", () => {
      const ctx = createTestCtx("ab\ncd");
      ctx.current = 2;
      ctx.start = 2;
      EOL(ctx);

      // After newline, column calculation should use new lineStart
      expect(ctx.lineStart).to.equal(3);
      expect(ctx.column).to.equal(0);
    });
  });
});
