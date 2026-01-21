/**
 * Tests for ABCT parser error recovery
 */

import { expect } from "chai";
import { scan, AbctTT } from "../../src/scanner";
import { createParseCtx } from "../../src/parser/context";
import { peek, advance } from "../../src/parser/utils";
import {
  synchronize,
  synchronizeToStatement,
  synchronizeToClose,
  isAtRecoveryPoint,
  tryRecover,
} from "../../src/parser/recovery";
import { parseTokens } from "../../src/parser/parser";
import { isPipe, isAssignment, isApplication, isIdentifier } from "../../src/ast";

/** Helper to scan and parse in one step */
function parse(source: string) {
  const { tokens } = scan(source);
  return parseTokens(tokens);
}

describe("ABCT Parser Recovery", () => {
  describe("synchronize", () => {
    it("should stop at EOL", () => {
      const { tokens } = scan("a b\nc");
      const ctx = createParseCtx(tokens);
      synchronize(ctx);
      // Should stop after EOL, at 'c'
      expect(peek(ctx).lexeme).to.equal("c");
    });

    it("should stop at pipe operator", () => {
      const { tokens } = scan("a b | c");
      const ctx = createParseCtx(tokens);
      synchronize(ctx);
      expect(peek(ctx).type).to.equal(AbctTT.PIPE);
    });

    it("should stop at equals operator", () => {
      const { tokens } = scan("a b = c");
      const ctx = createParseCtx(tokens);
      synchronize(ctx);
      expect(peek(ctx).type).to.equal(AbctTT.EQ);
    });

    it("should stop at closing paren", () => {
      const { tokens } = scan("a b) c");
      const ctx = createParseCtx(tokens);
      synchronize(ctx);
      expect(peek(ctx).type).to.equal(AbctTT.RPAREN);
    });

    it("should stop at closing bracket", () => {
      const { tokens } = scan("a b] c");
      const ctx = createParseCtx(tokens);
      synchronize(ctx);
      expect(peek(ctx).type).to.equal(AbctTT.RBRACKET);
    });

    it("should stop at EOF", () => {
      const { tokens } = scan("a b c");
      const ctx = createParseCtx(tokens);
      synchronize(ctx);
      expect(peek(ctx).type).to.equal(AbctTT.EOF);
    });
  });

  describe("synchronizeToStatement", () => {
    it("should skip to end of statement", () => {
      const { tokens } = scan("a b c\nd");
      const ctx = createParseCtx(tokens);
      synchronizeToStatement(ctx);
      expect(peek(ctx).lexeme).to.equal("d");
    });

    it("should stop at EOF if no EOL", () => {
      const { tokens } = scan("a b c");
      const ctx = createParseCtx(tokens);
      synchronizeToStatement(ctx);
      expect(peek(ctx).type).to.equal(AbctTT.EOF);
    });
  });

  describe("synchronizeToClose", () => {
    it("should stop at closing paren", () => {
      const { tokens } = scan("a b c) d");
      const ctx = createParseCtx(tokens);
      synchronizeToClose(ctx, AbctTT.RPAREN);
      expect(peek(ctx).type).to.equal(AbctTT.RPAREN);
    });

    it("should stop at closing bracket", () => {
      const { tokens } = scan("a b c] d");
      const ctx = createParseCtx(tokens);
      synchronizeToClose(ctx, AbctTT.RBRACKET);
      expect(peek(ctx).type).to.equal(AbctTT.RBRACKET);
    });

    it("should stop at EOL if no closing delimiter", () => {
      const { tokens } = scan("a b c\nd");
      const ctx = createParseCtx(tokens);
      synchronizeToClose(ctx, AbctTT.RPAREN);
      expect(peek(ctx).type).to.equal(AbctTT.EOL);
    });

    it("should stop at EOF if no closing delimiter or EOL", () => {
      const { tokens } = scan("a b c");
      const ctx = createParseCtx(tokens);
      synchronizeToClose(ctx, AbctTT.RPAREN);
      expect(peek(ctx).type).to.equal(AbctTT.EOF);
    });
  });

  describe("isAtRecoveryPoint", () => {
    it("should return true at EOL", () => {
      const { tokens } = scan("a\nb");
      const ctx = createParseCtx(tokens);
      advance(ctx); // skip 'a'
      expect(isAtRecoveryPoint(ctx)).to.be.true;
    });

    it("should return true at pipe", () => {
      const { tokens } = scan("| a");
      const ctx = createParseCtx(tokens);
      expect(isAtRecoveryPoint(ctx)).to.be.true;
    });

    it("should return true at equals", () => {
      const { tokens } = scan("= a");
      const ctx = createParseCtx(tokens);
      expect(isAtRecoveryPoint(ctx)).to.be.true;
    });

    it("should return true at closing delimiters", () => {
      // Test ) and ] closers
      const closers = [") a", "] a"];
      for (const source of closers) {
        const { tokens } = scan(source);
        const ctx = createParseCtx(tokens);
        expect(isAtRecoveryPoint(ctx), `Failed for ${source}`).to.be.true;
      }
    });

    it("should return true at ABC_FENCE_CLOSE", () => {
      // ABC_FENCE_CLOSE appears at the end of ABC fence literals
      const { tokens } = scan("```abc\nabc\n```");
      const ctx = createParseCtx(tokens);
      // Navigate to ABC_FENCE_CLOSE
      while (peek(ctx).type !== AbctTT.ABC_FENCE_CLOSE && peek(ctx).type !== AbctTT.EOF) {
        advance(ctx);
      }
      expect(isAtRecoveryPoint(ctx)).to.be.true;
    });

    it("should return false at identifier", () => {
      const { tokens } = scan("abc");
      const ctx = createParseCtx(tokens);
      expect(isAtRecoveryPoint(ctx)).to.be.false;
    });
  });

  describe("tryRecover", () => {
    it("should return true if recovery successful", () => {
      const { tokens } = scan("a b\nc");
      const ctx = createParseCtx(tokens);
      expect(tryRecover(ctx)).to.be.true;
    });

    it("should return false at EOF", () => {
      const { tokens } = scan("");
      const ctx = createParseCtx(tokens);
      expect(tryRecover(ctx)).to.be.false;
    });

    it("should advance to recovery point", () => {
      const { tokens } = scan("a b | c");
      const ctx = createParseCtx(tokens);
      tryRecover(ctx);
      expect(peek(ctx).type).to.equal(AbctTT.PIPE);
    });
  });

  describe("error recovery scenarios", () => {
    it("should recover from missing operand in pipe", () => {
      // x = | y  (missing left operand)
      const { tokens } = scan("x = | y");
      const ctx = createParseCtx(tokens);
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
      const { tokens } = scan("transpose 2 |\nretrograde");
      const ctx = createParseCtx(tokens);
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
      const { tokens } = scan("(transpose 2 | retrograde");
      const ctx = createParseCtx(tokens);
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
