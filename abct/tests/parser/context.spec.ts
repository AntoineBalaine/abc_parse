/**
 * Tests for ABCT parser context
 */

import { expect } from "chai";
import { scan, AbctTT } from "../../src/scanner";
import { createParseCtx, tokenToLoc, spanLoc } from "../../src/parser/context";
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

describe("ABCT Parser Context", () => {
  describe("createParseCtx", () => {
    it("should create context with tokens", () => {
      const { tokens } = scan("a b c");
      const ctx = createParseCtx(tokens);
      expect(ctx.tokens).to.equal(tokens);
      expect(ctx.current).to.equal(0);
      expect(ctx.errors).to.have.length(0);
    });
  });

  describe("navigation", () => {
    it("peek should return current token", () => {
      const { tokens } = scan("a b");
      const ctx = createParseCtx(tokens);
      expect(peek(ctx).type).to.equal(AbctTT.IDENTIFIER);
      expect(peek(ctx).lexeme).to.equal("a");
    });

    it("peekNext should return next token", () => {
      const { tokens } = scan("a b");
      const ctx = createParseCtx(tokens);
      expect(peekNext(ctx).type).to.equal(AbctTT.WS);
    });

    it("advance should move to next token", () => {
      const { tokens } = scan("a b");
      const ctx = createParseCtx(tokens);
      advance(ctx);
      expect(peek(ctx).type).to.equal(AbctTT.WS);
    });

    it("advance should return previous token", () => {
      const { tokens } = scan("a b");
      const ctx = createParseCtx(tokens);
      const prev = advance(ctx);
      expect(prev.type).to.equal(AbctTT.IDENTIFIER);
      expect(prev.lexeme).to.equal("a");
    });

    it("previous should return last consumed token", () => {
      const { tokens } = scan("a b");
      const ctx = createParseCtx(tokens);
      advance(ctx);
      expect(previous(ctx).lexeme).to.equal("a");
    });

    it("isAtEnd should return true at EOF", () => {
      const { tokens } = scan("a");
      const ctx = createParseCtx(tokens);
      expect(isAtEnd(ctx)).to.be.false;
      advance(ctx); // a
      expect(isAtEnd(ctx)).to.be.true;
    });
  });

  describe("check and match", () => {
    it("check should return true for matching type", () => {
      const { tokens } = scan("a");
      const ctx = createParseCtx(tokens);
      expect(check(ctx, AbctTT.IDENTIFIER)).to.be.true;
      expect(check(ctx, AbctTT.NUMBER)).to.be.false;
    });

    it("checkAny should return true for any matching type", () => {
      const { tokens } = scan("a");
      const ctx = createParseCtx(tokens);
      expect(checkAny(ctx, AbctTT.NUMBER, AbctTT.IDENTIFIER)).to.be.true;
      expect(checkAny(ctx, AbctTT.NUMBER, AbctTT.PIPE)).to.be.false;
    });

    it("match should consume on match", () => {
      const { tokens } = scan("a b");
      const ctx = createParseCtx(tokens);
      expect(match(ctx, AbctTT.IDENTIFIER)).to.be.true;
      expect(peek(ctx).type).to.equal(AbctTT.WS);
    });

    it("match should not consume on no match", () => {
      const { tokens } = scan("a b");
      const ctx = createParseCtx(tokens);
      expect(match(ctx, AbctTT.NUMBER)).to.be.false;
      expect(peek(ctx).type).to.equal(AbctTT.IDENTIFIER);
    });

    it("match should work with multiple types", () => {
      const { tokens } = scan("a b");
      const ctx = createParseCtx(tokens);
      expect(match(ctx, AbctTT.NUMBER, AbctTT.IDENTIFIER)).to.be.true;
      expect(peek(ctx).type).to.equal(AbctTT.WS);
    });

    it("tryConsume should return token on match", () => {
      const { tokens } = scan("a b");
      const ctx = createParseCtx(tokens);
      const token = tryConsume(ctx, AbctTT.IDENTIFIER);
      expect(token).to.not.be.null;
      expect(token!.lexeme).to.equal("a");
    });

    it("tryConsume should return null on no match", () => {
      const { tokens } = scan("a b");
      const ctx = createParseCtx(tokens);
      const token = tryConsume(ctx, AbctTT.NUMBER);
      expect(token).to.be.null;
    });
  });

  describe("skipWS", () => {
    it("should skip whitespace", () => {
      const { tokens } = scan("   a");
      const ctx = createParseCtx(tokens);
      const skipped = skipWS(ctx);
      expect(skipped).to.be.true;
      expect(peek(ctx).type).to.equal(AbctTT.IDENTIFIER);
    });

    it("should skip comments", () => {
      const { tokens } = scan("# comment\na");
      const ctx = createParseCtx(tokens);
      const skipped = skipWS(ctx);
      expect(skipped).to.be.true;
      expect(peek(ctx).type).to.equal(AbctTT.EOL);
    });

    it("should not skip EOL", () => {
      const { tokens } = scan("\na");
      const ctx = createParseCtx(tokens);
      const skipped = skipWS(ctx);
      expect(skipped).to.be.false;
      expect(peek(ctx).type).to.equal(AbctTT.EOL);
    });
  });

  describe("skipWSAndEOL", () => {
    it("should skip whitespace and EOL", () => {
      const { tokens } = scan("  \n  a");
      const ctx = createParseCtx(tokens);
      const skipped = skipWSAndEOL(ctx);
      expect(skipped).to.be.true;
      expect(peek(ctx).type).to.equal(AbctTT.IDENTIFIER);
    });

    it("should skip multiple EOLs", () => {
      const { tokens } = scan("\n\n\na");
      const ctx = createParseCtx(tokens);
      skipWSAndEOL(ctx);
      expect(peek(ctx).type).to.equal(AbctTT.IDENTIFIER);
    });
  });

  describe("error reporting", () => {
    it("should record errors", () => {
      const { tokens } = scan("a");
      const ctx = createParseCtx(tokens);
      ctx.error("Test error");
      expect(ctx.errors).to.have.length(1);
      expect(ctx.errors[0].message).to.equal("Test error");
    });

    it("should include token in error", () => {
      const { tokens } = scan("a");
      const ctx = createParseCtx(tokens);
      ctx.error("Test error");
      expect(ctx.errors[0].token.lexeme).to.equal("a");
    });

    it("should include location in error", () => {
      const { tokens } = scan("a");
      const ctx = createParseCtx(tokens);
      ctx.error("Test error");
      expect(ctx.errors[0].loc.start.line).to.equal(1);
      expect(ctx.errors[0].loc.start.column).to.equal(1);
    });
  });

  describe("tokenToLoc", () => {
    it("should convert token to location", () => {
      const { tokens } = scan("abc");
      const loc = tokenToLoc(tokens[0]);
      expect(loc.start.line).to.equal(1);
      expect(loc.start.column).to.equal(1);
      expect(loc.end.column).to.equal(4);
    });

    it("should handle tokens on different lines", () => {
      const { tokens } = scan("a\nb");
      // b is on line 2 (1 in 0-based, 2 in 1-based)
      const bToken = tokens.find(t => t.lexeme === "b");
      const loc = tokenToLoc(bToken!);
      expect(loc.start.line).to.equal(2);
    });
  });

  describe("spanLoc", () => {
    it("should create location spanning tokens", () => {
      const { tokens } = scan("abc def");
      const first = tokens[0];
      const last = tokens[2]; // "def"
      const loc = spanLoc(first, last);
      expect(loc.start.column).to.equal(1);
      expect(loc.end.column).to.equal(8);
    });
  });
});
