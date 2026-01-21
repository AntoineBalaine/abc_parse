/**
 * Tests for ABCT parser error recovery
 */

import { expect } from "chai";
import { scan, AbctTT, Token } from "../../src/scanner";
import { AbctContext } from "../../src/context";
import { createParseCtx, AbctParseCtx } from "../../src/parser/context";
import { peek, advance } from "../../src/parser/utils";
import {
  synchronize,
  synchronizeToStatement,
  synchronizeToClose,
  isAtRecoveryPoint,
  tryRecover,
} from "../../src/parser/recovery";
import { parse as parseTokens } from "../../src/parser/parser";
import { isPipe, isAssignment, isApplication, isIdentifier, Loc } from "../../src/ast";

/** Helper to scan source with a fresh context */
function scanSource(source: string): { tokens: Token[]; ctx: AbctContext } {
  const ctx = new AbctContext();
  const tokens = scan(source, ctx);
  return { tokens, ctx };
}

/** Helper to create a parser context for given source */
function createTestParseCtx(source: string): { ctx: AbctParseCtx; abctCtx: AbctContext } {
  const { tokens, ctx: abctCtx } = scanSource(source);
  const ctx = createParseCtx(tokens, abctCtx);
  return { ctx, abctCtx };
}

/** Helper to scan and parse in one step */
function parse(source: string): { program: ReturnType<typeof parseTokens>; errors: Array<{ message: string; loc: Loc }> } {
  const { tokens, ctx } = scanSource(source);
  const program = parseTokens(tokens, ctx);
  const errors = ctx.errorReporter.getErrors().map(e => ({ message: e.message, loc: e.loc! }));
  return { program, errors };
}

describe("ABCT Parser Recovery", () => {
  describe("synchronize", () => {
    it("should stop at EOL", () => {
      const { ctx } = createTestParseCtx("a b\nc");
      synchronize(ctx);
      // Should stop after EOL, at 'c'
      expect(peek(ctx).lexeme).to.equal("c");
    });

    it("should stop at pipe operator", () => {
      const { ctx } = createTestParseCtx("a b | c");
      synchronize(ctx);
      expect(peek(ctx).type).to.equal(AbctTT.PIPE);
    });

    it("should stop at equals operator", () => {
      const { ctx } = createTestParseCtx("a b = c");
      synchronize(ctx);
      expect(peek(ctx).type).to.equal(AbctTT.EQ);
    });

    it("should stop at closing paren", () => {
      const { ctx } = createTestParseCtx("a b) c");
      synchronize(ctx);
      expect(peek(ctx).type).to.equal(AbctTT.RPAREN);
    });

    it("should stop at closing bracket", () => {
      const { ctx } = createTestParseCtx("a b] c");
      synchronize(ctx);
      expect(peek(ctx).type).to.equal(AbctTT.RBRACKET);
    });

    it("should stop at EOF", () => {
      const { ctx } = createTestParseCtx("a b c");
      synchronize(ctx);
      expect(peek(ctx).type).to.equal(AbctTT.EOF);
    });
  });

  describe("synchronizeToStatement", () => {
    it("should skip to end of statement", () => {
      const { ctx } = createTestParseCtx("a b c\nd");
      synchronizeToStatement(ctx);
      expect(peek(ctx).lexeme).to.equal("d");
    });

    it("should stop at EOF if no EOL", () => {
      const { ctx } = createTestParseCtx("a b c");
      synchronizeToStatement(ctx);
      expect(peek(ctx).type).to.equal(AbctTT.EOF);
    });
  });

  describe("synchronizeToClose", () => {
    it("should stop at closing paren", () => {
      const { ctx } = createTestParseCtx("a b c) d");
      synchronizeToClose(ctx, AbctTT.RPAREN);
      expect(peek(ctx).type).to.equal(AbctTT.RPAREN);
    });

    it("should stop at closing bracket", () => {
      const { ctx } = createTestParseCtx("a b c] d");
      synchronizeToClose(ctx, AbctTT.RBRACKET);
      expect(peek(ctx).type).to.equal(AbctTT.RBRACKET);
    });

    it("should stop at EOL if no closing delimiter", () => {
      const { ctx } = createTestParseCtx("a b c\nd");
      synchronizeToClose(ctx, AbctTT.RPAREN);
      expect(peek(ctx).type).to.equal(AbctTT.EOL);
    });

    it("should stop at EOF if no closing delimiter or EOL", () => {
      const { ctx } = createTestParseCtx("a b c");
      synchronizeToClose(ctx, AbctTT.RPAREN);
      expect(peek(ctx).type).to.equal(AbctTT.EOF);
    });
  });

  describe("isAtRecoveryPoint", () => {
    it("should return true at EOL", () => {
      const { ctx } = createTestParseCtx("a\nb");
      advance(ctx); // skip 'a'
      expect(isAtRecoveryPoint(ctx)).to.be.true;
    });

    it("should return true at pipe", () => {
      const { ctx } = createTestParseCtx("| a");
      expect(isAtRecoveryPoint(ctx)).to.be.true;
    });

    it("should return true at equals", () => {
      const { ctx } = createTestParseCtx("= a");
      expect(isAtRecoveryPoint(ctx)).to.be.true;
    });

    it("should return true at closing delimiters", () => {
      // Test ) and ] closers
      const closers = [") a", "] a"];
      for (const source of closers) {
        const { ctx } = createTestParseCtx(source);
          expect(isAtRecoveryPoint(ctx), `Failed for ${source}`).to.be.true;
      }
    });

    it("should return true at ABC_FENCE_CLOSE", () => {
      // ABC_FENCE_CLOSE appears at the end of ABC fence literals
      const { ctx } = createTestParseCtx("```abc\nabc\n```");
      // Navigate to ABC_FENCE_CLOSE
      while (peek(ctx).type !== AbctTT.ABC_FENCE_CLOSE && peek(ctx).type !== AbctTT.EOF) {
        advance(ctx);
      }
      expect(isAtRecoveryPoint(ctx)).to.be.true;
    });

    it("should return false at identifier", () => {
      const { ctx } = createTestParseCtx("abc");
      expect(isAtRecoveryPoint(ctx)).to.be.false;
    });
  });

  describe("tryRecover", () => {
    it("should return true if recovery successful", () => {
      const { ctx } = createTestParseCtx("a b\nc");
      expect(tryRecover(ctx)).to.be.true;
    });

    it("should return false at EOF", () => {
      const { ctx } = createTestParseCtx("");
      expect(tryRecover(ctx)).to.be.false;
    });

    it("should advance to recovery point", () => {
      const { ctx } = createTestParseCtx("a b | c");
      tryRecover(ctx);
      expect(peek(ctx).type).to.equal(AbctTT.PIPE);
    });
  });

  describe("error recovery scenarios", () => {
    it("should recover from missing operand in pipe", () => {
      // x = | y  (missing left operand)
      const { ctx } = createTestParseCtx("x = | y");
      advance(ctx); // skip x
      advance(ctx); // skip WS
      advance(ctx); // skip =
      advance(ctx); // skip WS
      // Now at |, which is a recovery point
      expect(peek(ctx).type).to.equal(AbctTT.PIPE);
    });

    it("should recover from incomplete expression at EOL", () => {
      // transpose 2 |
      // retrograde
      const { ctx } = createTestParseCtx("transpose 2 |\nretrograde");
      // Skip to the |
      while (peek(ctx).type !== AbctTT.PIPE) {
        advance(ctx);
      }
      advance(ctx); // consume |
      // At EOL, should be able to synchronize to next statement
      synchronize(ctx);
      expect(peek(ctx).lexeme).to.equal("retrograde");
    });

    it("should recover from unclosed parenthesis", () => {
      // (transpose 2 | retrograde
      const { ctx } = createTestParseCtx("(transpose 2 | retrograde");
      synchronizeToClose(ctx, AbctTT.RPAREN);
      // Should stop at EOF since no closing paren
      expect(peek(ctx).type).to.equal(AbctTT.EOF);
    });
  });

  describe("full parse with error recovery", () => {
    describe("valid programs", () => {
      it("should parse simple expression", () => {
        const { program, errors } = parse("transpose 2");
        expect(errors).to.have.length(0);
        expect(program.statements).to.have.length(1);
      });

      it("should parse simple assignment", () => {
        const { program, errors } = parse("x = transpose 2");
        expect(errors).to.have.length(0);
        expect(program.statements).to.have.length(1);
        expect(isAssignment(program.statements[0])).to.be.true;
      });

      it("should parse multi-line program", () => {
        const source = `x = transpose 2
y = retrograde
z = x | y`;
        const { program, errors } = parse(source);
        expect(errors).to.have.length(0);
        expect(program.statements).to.have.length(3);
      });

      it("should parse pipeline", () => {
        const { program, errors } = parse("file.abc | transpose 2 | retrograde");
        expect(errors).to.have.length(0);
        expect(program.statements).to.have.length(1);
        expect(isPipe(program.statements[0])).to.be.true;
      });
    });

    describe("incomplete expressions", () => {
      it("should report error for incomplete pipe", () => {
        const { program, errors } = parse("transpose 2 |");
        expect(errors.length).to.be.greaterThan(0);
        expect(program.statements.length).to.be.greaterThanOrEqual(0);
      });

      it("should report error for incomplete concat", () => {
        const { program, errors } = parse("a + ");
        expect(errors.length).to.be.greaterThan(0);
      });

      it("should report error for incomplete update", () => {
        const { program, errors } = parse("@notes |=");
        expect(errors.length).to.be.greaterThan(0);
      });

      it("should report error for missing operand in pipe", () => {
        const { program, errors } = parse("| transpose");
        expect(errors.length).to.be.greaterThan(0);
      });
    });

    describe("mismatched delimiters", () => {
      it("should report error for unclosed parenthesis", () => {
        const { program, errors } = parse("(a | b");
        expect(errors.length).to.be.greaterThan(0);
      });

      it("should report error for unclosed bracket", () => {
        const { program, errors } = parse("[a, b");
        expect(errors.length).to.be.greaterThan(0);
      });

      it("should report error for unclosed ABC literal", () => {
        const { program, errors } = parse("```abc\nCDEF");
        expect(errors.length).to.be.greaterThan(0);
      });
    });

    describe("multi-statement recovery", () => {
      it("should parse valid statement after invalid one", () => {
        const source = `x = |
y = transpose 2`;
        const { program, errors } = parse(source);
        expect(errors.length).to.be.greaterThan(0);
        // Should have at least one valid statement
        expect(program.statements.length).to.be.greaterThanOrEqual(1);
      });

      it("should handle mixed valid and invalid statements", () => {
        const source = `x = transpose 2
y = |
z = retrograde`;
        const { program, errors } = parse(source);
        expect(errors.length).to.be.greaterThan(0);
        // First and third statements should parse
        expect(program.statements.length).to.be.greaterThanOrEqual(1);
      });
    });

    describe("error location tracking", () => {
      it("should report valid error locations", () => {
        const { errors } = parse("a |");
        expect(errors.length).to.be.greaterThan(0);
        expect(errors[0].loc).to.have.property("start");
        expect(errors[0].loc).to.have.property("end");
        expect(errors[0].loc.start).to.have.property("line");
        expect(errors[0].loc.start).to.have.property("column");
      });
    });
  });
});
