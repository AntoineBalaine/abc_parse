/**
 * Tests for ABCT scanner integration and round-trip properties
 */

import { expect } from "chai";
import * as fc from "fast-check";
import { scan, AbctTT, Token } from "../../src/scanner";
import { AbctContext } from "../../src/context";
import {
  genIdentifier,
  genNumber,
  genSimpleString,
  genAbcLiteral,
  genWS,
  genEOL,
  genComment,
  genOperator,
} from "./generators";

/** Helper to scan source with a fresh context */
function scanSource(source: string): { tokens: Token[]; ctx: AbctContext } {
  const ctx = new AbctContext();
  const tokens = scan(source, ctx);
  return { tokens, ctx };
}

describe("ABCT Scanner Integration", () => {
  describe("scan function", () => {
    it("should scan simple identifier", () => {
      const { tokens, ctx } = scanSource("transpose");
      expect(tokens).to.have.length(2); // identifier + EOF
      expect(tokens[0].type).to.equal(AbctTT.IDENTIFIER);
      expect(tokens[1].type).to.equal(AbctTT.EOF);
    });

    it("should scan simple pipe expression", () => {
      const { tokens, ctx } = scanSource("file.abc | transpose 2");
      const types = tokens.map((t) => t.type);
      expect(types).to.include(AbctTT.IDENTIFIER);
      expect(types).to.include(AbctTT.PIPE);
      expect(types).to.include(AbctTT.NUMBER);
      expect(types[types.length - 1]).to.equal(AbctTT.EOF);
    });

    it("should scan assignment", () => {
      const { tokens, ctx } = scanSource("x = transpose 2");
      const types = tokens.map((t) => t.type);
      expect(types).to.include(AbctTT.IDENTIFIER);
      expect(types).to.include(AbctTT.EQ);
      expect(types[types.length - 1]).to.equal(AbctTT.EOF);
    });

    it("should scan ABC fence literal", () => {
      const { tokens, ctx } = scanSource("```abc\nCDEF GABc\n```");
      const types = tokens.map((t) => t.type);
      expect(types).to.include(AbctTT.ABC_FENCE_OPEN);
      expect(types).to.include(AbctTT.ABC_CONTENT);
      expect(types).to.include(AbctTT.ABC_FENCE_CLOSE);
    });

    it("should scan selector", () => {
      const { tokens, ctx } = scanSource("@notes");
      const types = tokens.map((t) => t.type);
      expect(types).to.include(AbctTT.AT);
      expect(types).to.include(AbctTT.IDENTIFIER);
    });

    it("should scan complex expression", () => {
      const { tokens, ctx } = scanSource("file.abc | @notes |= transpose 2");
      expect(ctx.errorReporter.getErrors()).to.have.length(0);
      expect(tokens.length).to.be.greaterThan(5);
    });

    it("should preserve whitespace tokens", () => {
      const { tokens, ctx } = scanSource("a   b");
      const wsTokens = tokens.filter((t) => t.type === AbctTT.WS);
      expect(wsTokens).to.have.length(1);
      expect(wsTokens[0].lexeme).to.equal("   ");
    });

    it("should preserve EOL tokens", () => {
      const { tokens, ctx } = scanSource("a\nb");
      const eolTokens = tokens.filter((t) => t.type === AbctTT.EOL);
      expect(eolTokens).to.have.length(1);
    });

    it("should preserve comment tokens", () => {
      const { tokens, ctx } = scanSource("a # comment\nb");
      const commentTokens = tokens.filter((t) => t.type === AbctTT.COMMENT);
      expect(commentTokens).to.have.length(1);
      expect(commentTokens[0].lexeme).to.equal("# comment");
    });
  });

  describe("error recovery", () => {
    it("should collect invalid characters", () => {
      const { tokens, ctx } = scanSource("$%^");
      expect(ctx.errorReporter.getErrors()).to.have.length(1);
      expect(tokens.some((t) => t.type === AbctTT.INVALID)).to.be.true;
    });

    it("should continue scanning after invalid characters", () => {
      const { tokens, ctx } = scanSource("$%^ transpose");
      const identTokens = tokens.filter((t) => t.type === AbctTT.IDENTIFIER);
      expect(identTokens).to.have.length(1);
      expect(identTokens[0].lexeme).to.equal("transpose");
    });
  });

  describe("position tracking", () => {
    it("should track line numbers correctly", () => {
      const { tokens, ctx } = scanSource("a\nb\nc");
      const identTokens = tokens.filter((t) => t.type === AbctTT.IDENTIFIER);
      expect(identTokens[0].line).to.equal(0);
      expect(identTokens[1].line).to.equal(1);
      expect(identTokens[2].line).to.equal(2);
    });

    it("should track column numbers correctly", () => {
      const { tokens, ctx } = scanSource("ab cd");
      const identTokens = tokens.filter((t) => t.type === AbctTT.IDENTIFIER);
      expect(identTokens[0].column).to.equal(0);
      expect(identTokens[1].column).to.equal(3);
    });

    it("should track column correctly after newline", () => {
      const { tokens, ctx } = scanSource("ab\ncd");
      const identTokens = tokens.filter((t) => t.type === AbctTT.IDENTIFIER);
      expect(identTokens[0].column).to.equal(0);
      expect(identTokens[1].column).to.equal(0);
    });

    it("should track offset correctly", () => {
      const { tokens, ctx } = scanSource("ab cd");
      const identTokens = tokens.filter((t) => t.type === AbctTT.IDENTIFIER);
      expect(identTokens[0].offset).to.equal(0);
      expect(identTokens[1].offset).to.equal(3);
    });
  });

  describe("round-trip property", () => {
    it("property: tokens reconstruct source exactly", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.oneof(
              genIdentifier,
              genNumber,
              genOperator.filter((op) => op !== "<" && op !== ">"), // Avoid <= and >= combining unexpectedly
              genWS
            ),
            { minLength: 1, maxLength: 10 }
          ),
          (parts) => {
            const source = parts.join("");
            const { tokens, ctx } = scanSource(source);
            // Remove EOF token for reconstruction
            const tokensWithoutEof = tokens.filter((t) => t.type !== AbctTT.EOF);
            const reconstructed = tokensWithoutEof.map((t) => t.lexeme).join("");
            return reconstructed === source;
          }
        ),
        { numRuns: 1000 }
      );
    });

    it("property: single tokens reconstruct correctly", () => {
      fc.assert(
        fc.property(
          fc.oneof(genIdentifier, genNumber, genSimpleString),
          (source) => {
            const { tokens, ctx } = scanSource(source);
            const tokensWithoutEof = tokens.filter((t) => t.type !== AbctTT.EOF);
            const reconstructed = tokensWithoutEof.map((t) => t.lexeme).join("");
            return reconstructed === source;
          }
        ),
        { numRuns: 1000 }
      );
    });

    it("property: ABC literals reconstruct correctly", () => {
      fc.assert(
        fc.property(genAbcLiteral, (source) => {
          const { tokens, ctx } = scanSource(source);
          const tokensWithoutEof = tokens.filter((t) => t.type !== AbctTT.EOF);
          const reconstructed = tokensWithoutEof.map((t) => t.lexeme).join("");
          return reconstructed === source;
        }),
        { numRuns: 1000 }
      );
    });

    it("property: comments reconstruct correctly", () => {
      fc.assert(
        fc.property(genComment, (source) => {
          const { tokens, ctx } = scanSource(source);
          const tokensWithoutEof = tokens.filter((t) => t.type !== AbctTT.EOF);
          const reconstructed = tokensWithoutEof.map((t) => t.lexeme).join("");
          return reconstructed === source;
        }),
        { numRuns: 1000 }
      );
    });

    it("property: whitespace and EOL reconstruct correctly", () => {
      fc.assert(
        fc.property(
          fc.array(fc.oneof(genWS, genEOL, genIdentifier), {
            minLength: 1,
            maxLength: 10,
          }),
          (parts) => {
            const source = parts.join("");
            const { tokens, ctx } = scanSource(source);
            const tokensWithoutEof = tokens.filter((t) => t.type !== AbctTT.EOF);
            const reconstructed = tokensWithoutEof.map((t) => t.lexeme).join("");
            return reconstructed === source;
          }
        ),
        { numRuns: 1000 }
      );
    });
  });

  describe("real-world examples", () => {
    it("should scan simple pipeline", () => {
      const source = "file.abc | transpose 2";
      const { tokens, ctx } = scanSource(source);
      expect(ctx.errorReporter.getErrors()).to.have.length(0);
      const reconstructed = tokens
        .filter((t) => t.type !== AbctTT.EOF)
        .map((t) => t.lexeme)
        .join("");
      expect(reconstructed).to.equal(source);
    });

    it("should scan multi-line pipeline with comments", () => {
      const source = `file.abc # source file
| transpose 2
| retrograde`;
      const { tokens, ctx } = scanSource(source);
      expect(ctx.errorReporter.getErrors()).to.have.length(0);
      const reconstructed = tokens
        .filter((t) => t.type !== AbctTT.EOF)
        .map((t) => t.lexeme)
        .join("");
      expect(reconstructed).to.equal(source);
    });

    it("should scan assignment with ABC literal", () => {
      // Note: ABC literals now use triple-backtick syntax on their own line
      // Assignment to ABC literal requires multi-line format
      const source = "```abc\nC D E F|G A B c\n```";
      const { tokens, ctx } = scanSource(source);
      expect(ctx.errorReporter.getErrors()).to.have.length(0);
      const reconstructed = tokens
        .filter((t) => t.type !== AbctTT.EOF)
        .map((t) => t.lexeme)
        .join("");
      expect(reconstructed).to.equal(source);
    });

    it("should scan selector update", () => {
      const source = "@notes |= transpose 2";
      const { tokens, ctx } = scanSource(source);
      expect(ctx.errorReporter.getErrors()).to.have.length(0);
    });

    it("should scan complex filter expression", () => {
      const source = "file.abc | @M:1-4 |= transpose 2";
      const { tokens, ctx } = scanSource(source);
      expect(ctx.errorReporter.getErrors()).to.have.length(0);
    });

    it("should scan list", () => {
      const source = "[file1.abc, file2.abc, file3.abc]";
      const { tokens, ctx } = scanSource(source);
      expect(ctx.errorReporter.getErrors()).to.have.length(0);
      expect(tokens.some((t) => t.type === AbctTT.LBRACKET)).to.be.true;
      expect(tokens.some((t) => t.type === AbctTT.RBRACKET)).to.be.true;
    });

    it("should scan boolean expression", () => {
      const source = "@notes and @rests or not @chords";
      const { tokens, ctx } = scanSource(source);
      expect(ctx.errorReporter.getErrors()).to.have.length(0);
      expect(tokens.some((t) => t.type === AbctTT.AND)).to.be.true;
      expect(tokens.some((t) => t.type === AbctTT.OR)).to.be.true;
      expect(tokens.some((t) => t.type === AbctTT.NOT)).to.be.true;
    });
  });
});
