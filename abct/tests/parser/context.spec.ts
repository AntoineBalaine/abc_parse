/**
 * Tests for ABCT parser context
 */

import { expect } from "chai";
import { scan, AbctTT, Token } from "../../src/scanner";
import { AbctContext } from "../../src/context";
import { createParseCtx, tokenToLoc, spanLoc, AbctParseCtx } from "../../src/parser/context";
import {
  isAtEnd,
  peek,
  peekNext,
  previous,
  advance,
  check,
  checkAny,
  match,
  tryConsume,
  skipWS,
  skipWSAndEOL,
} from "../../src/parser/utils";

/** Helper to scan and create parse context */
function createTestCtx(source: string): { ctx: AbctParseCtx; abctCtx: AbctContext; tokens: Token[] } {
  const abctCtx = new AbctContext();
  const tokens = scan(source, abctCtx);
  const ctx = createParseCtx(tokens, abctCtx);
  return { ctx, abctCtx, tokens };
}

describe("ABCT Parser Context", () => {
  describe("createParseCtx", () => {
    it("should create context with tokens", () => {
      const { ctx, tokens, abctCtx } = createTestCtx("a b c");
      expect(ctx.tokens).to.equal(tokens);
      expect(ctx.current).to.equal(0);
      expect(abctCtx.errorReporter.hasErrors()).to.be.false;
    });
  });

  describe("navigation", () => {
    it("peek should return current token", () => {
      const { ctx } = createTestCtx("a b");
      expect(peek(ctx).type).to.equal(AbctTT.IDENTIFIER);
      expect(peek(ctx).lexeme).to.equal("a");
    });

    it("peekNext should return next token", () => {
      const { ctx } = createTestCtx("a b");
      expect(peekNext(ctx).type).to.equal(AbctTT.WS);
    });

    it("advance should move to next token", () => {
      const { ctx } = createTestCtx("a b");
      advance(ctx);
      expect(peek(ctx).type).to.equal(AbctTT.WS);
    });

    it("advance should return previous token", () => {
      const { ctx } = createTestCtx("a b");
      const prev = advance(ctx);
      expect(prev.type).to.equal(AbctTT.IDENTIFIER);
      expect(prev.lexeme).to.equal("a");
    });

    it("previous should return last consumed token", () => {
      const { ctx } = createTestCtx("a b");
      advance(ctx);
      expect(previous(ctx).lexeme).to.equal("a");
    });

    it("isAtEnd should return true at EOF", () => {
      const { ctx } = createTestCtx("a");
      expect(isAtEnd(ctx)).to.be.false;
      advance(ctx); // a
      expect(isAtEnd(ctx)).to.be.true;
    });
  });

  describe("check and match", () => {
    it("check should return true for matching type", () => {
      const { ctx } = createTestCtx("a");
      expect(check(ctx, AbctTT.IDENTIFIER)).to.be.true;
      expect(check(ctx, AbctTT.NUMBER)).to.be.false;
    });

    it("checkAny should return true for any matching type", () => {
      const { ctx } = createTestCtx("a");
      expect(checkAny(ctx, AbctTT.NUMBER, AbctTT.IDENTIFIER)).to.be.true;
      expect(checkAny(ctx, AbctTT.NUMBER, AbctTT.PIPE)).to.be.false;
    });

    it("match should consume on match", () => {
      const { ctx } = createTestCtx("a b");
      expect(match(ctx, AbctTT.IDENTIFIER)).to.be.true;
      expect(peek(ctx).type).to.equal(AbctTT.WS);
    });

    it("match should not consume on no match", () => {
      const { ctx } = createTestCtx("a b");
      expect(match(ctx, AbctTT.NUMBER)).to.be.false;
      expect(peek(ctx).type).to.equal(AbctTT.IDENTIFIER);
    });

    it("match should work with multiple types", () => {
      const { ctx } = createTestCtx("a b");
      expect(match(ctx, AbctTT.NUMBER, AbctTT.IDENTIFIER)).to.be.true;
      expect(peek(ctx).type).to.equal(AbctTT.WS);
    });

    it("tryConsume should return token on match", () => {
      const { ctx } = createTestCtx("a b");
      const token = tryConsume(ctx, AbctTT.IDENTIFIER);
      expect(token).to.not.be.null;
      expect(token!.lexeme).to.equal("a");
    });

    it("tryConsume should return null on no match", () => {
      const { ctx } = createTestCtx("a b");
      const token = tryConsume(ctx, AbctTT.NUMBER);
      expect(token).to.be.null;
    });
  });

  describe("skipWS", () => {
    it("should skip whitespace", () => {
      const { ctx } = createTestCtx("   a");
      const skipped = skipWS(ctx);
      expect(skipped).to.be.true;
      expect(peek(ctx).type).to.equal(AbctTT.IDENTIFIER);
    });

    it("should skip comments", () => {
      const { ctx } = createTestCtx("# comment\na");
      const skipped = skipWS(ctx);
      expect(skipped).to.be.true;
      expect(peek(ctx).type).to.equal(AbctTT.EOL);
    });

    it("should not skip EOL", () => {
      const { ctx } = createTestCtx("\na");
      const skipped = skipWS(ctx);
      expect(skipped).to.be.false;
      expect(peek(ctx).type).to.equal(AbctTT.EOL);
    });
  });

  describe("skipWSAndEOL", () => {
    it("should skip whitespace and EOL", () => {
      const { ctx } = createTestCtx("  \n  a");
      const skipped = skipWSAndEOL(ctx);
      expect(skipped).to.be.true;
      expect(peek(ctx).type).to.equal(AbctTT.IDENTIFIER);
    });

    it("should skip multiple EOLs", () => {
      const { ctx } = createTestCtx("\n\n\na");
      skipWSAndEOL(ctx);
      expect(peek(ctx).type).to.equal(AbctTT.IDENTIFIER);
    });
  });

  describe("error reporting", () => {
    it("should record errors", () => {
      const { ctx, abctCtx } = createTestCtx("a");
      ctx.error("Test error");
      const errors = abctCtx.errorReporter.getErrors();
      expect(errors).to.have.length(1);
      expect(errors[0].message).to.equal("Test error");
    });

    it("should include token in error", () => {
      const { ctx, abctCtx } = createTestCtx("a");
      ctx.error("Test error");
      const errors = abctCtx.errorReporter.getErrors();
      expect(errors[0].token!.lexeme).to.equal("a");
    });

    it("should include location in error", () => {
      const { ctx, abctCtx } = createTestCtx("a");
      ctx.error("Test error");
      const errors = abctCtx.errorReporter.getErrors();
      expect(errors[0].loc!.start.line).to.equal(0);
      expect(errors[0].loc!.start.column).to.equal(0);
    });
  });

  describe("tokenToLoc", () => {
    it("should convert token to location", () => {
      const { tokens } = createTestCtx("abc");
      const loc = tokenToLoc(tokens[0]);
      expect(loc.start.line).to.equal(0);
      expect(loc.start.column).to.equal(0);
      expect(loc.end.column).to.equal(3);
    });

    it("should handle tokens on different lines", () => {
      const { tokens } = createTestCtx("a\nb");
      // b is on line 1 (0-based)
      const bToken = tokens.find(t => t.lexeme === "b");
      const loc = tokenToLoc(bToken!);
      expect(loc.start.line).to.equal(1);
    });
  });

  describe("spanLoc", () => {
    it("should create location spanning tokens", () => {
      const { tokens } = createTestCtx("abc def");
      const first = tokens[0];
      const last = tokens[2]; // "def"
      const loc = spanLoc(first, last);
      expect(loc.start.column).to.equal(0);
      expect(loc.end.column).to.equal(7);
    });
  });
});
