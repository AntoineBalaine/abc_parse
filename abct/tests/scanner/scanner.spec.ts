/**
 * Tests for ABCT scanner integration and round-trip properties
 */

import { expect } from "chai";
import * as fc from "fast-check";
import { scan, AbctTT } from "../../src/scanner";
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

describe("ABCT Scanner Integration", () => {
  describe("scan function", () => {
    it("should scan simple identifier", () => {
      const result = scan("transpose");
      expect(result.tokens).to.have.length(2); // identifier + EOF
      expect(result.tokens[0].type).to.equal(AbctTT.IDENTIFIER);
      expect(result.tokens[1].type).to.equal(AbctTT.EOF);
    });

    it("should scan simple pipe expression", () => {
      const result = scan("file.abc | transpose 2");
      const types = result.tokens.map((t) => t.type);
      expect(types).to.include(AbctTT.IDENTIFIER);
      expect(types).to.include(AbctTT.PIPE);
      expect(types).to.include(AbctTT.NUMBER);
      expect(types[types.length - 1]).to.equal(AbctTT.EOF);
    });

    it("should scan assignment", () => {
      const result = scan("x = transpose 2");
      const types = result.tokens.map((t) => t.type);
      expect(types).to.include(AbctTT.IDENTIFIER);
      expect(types).to.include(AbctTT.EQ);
      expect(types[types.length - 1]).to.equal(AbctTT.EOF);
    });

    it("should scan ABC literal", () => {
      const result = scan("<<CDEF GABc>>");
      const types = result.tokens.map((t) => t.type);
      expect(types).to.include(AbctTT.LT_LT);
      expect(types).to.include(AbctTT.ABC_LITERAL);
      expect(types).to.include(AbctTT.GT_GT);
    });

    it("should scan selector", () => {
      const result = scan("@notes");
      const types = result.tokens.map((t) => t.type);
      expect(types).to.include(AbctTT.AT);
      expect(types).to.include(AbctTT.IDENTIFIER);
    });

    it("should scan complex expression", () => {
      const result = scan("file.abc | @notes |= transpose 2");
      expect(result.errors).to.have.length(0);
      expect(result.tokens.length).to.be.greaterThan(5);
    });

    it("should preserve whitespace tokens", () => {
      const result = scan("a   b");
      const wsTokens = result.tokens.filter((t) => t.type === AbctTT.WS);
      expect(wsTokens).to.have.length(1);
      expect(wsTokens[0].lexeme).to.equal("   ");
    });

    it("should preserve EOL tokens", () => {
      const result = scan("a\nb");
      const eolTokens = result.tokens.filter((t) => t.type === AbctTT.EOL);
      expect(eolTokens).to.have.length(1);
    });

    it("should preserve comment tokens", () => {
      const result = scan("a # comment\nb");
      const commentTokens = result.tokens.filter((t) => t.type === AbctTT.COMMENT);
      expect(commentTokens).to.have.length(1);
      expect(commentTokens[0].lexeme).to.equal("# comment");
    });
  });

  describe("error recovery", () => {
    it("should collect invalid characters", () => {
      const result = scan("$%^");
      expect(result.errors).to.have.length(1);
      expect(result.tokens.some((t) => t.type === AbctTT.INVALID)).to.be.true;
    });

    it("should continue scanning after invalid characters", () => {
      const result = scan("$%^ transpose");
      const identTokens = result.tokens.filter((t) => t.type === AbctTT.IDENTIFIER);
      expect(identTokens).to.have.length(1);
      expect(identTokens[0].lexeme).to.equal("transpose");
    });
  });

  describe("position tracking", () => {
    it("should track line numbers correctly", () => {
      const result = scan("a\nb\nc");
      const identTokens = result.tokens.filter((t) => t.type === AbctTT.IDENTIFIER);
      expect(identTokens[0].line).to.equal(0);
      expect(identTokens[1].line).to.equal(1);
      expect(identTokens[2].line).to.equal(2);
    });

    it("should track column numbers correctly", () => {
      const result = scan("ab cd");
      const identTokens = result.tokens.filter((t) => t.type === AbctTT.IDENTIFIER);
      expect(identTokens[0].column).to.equal(0);
      expect(identTokens[1].column).to.equal(3);
    });

    it("should track column correctly after newline", () => {
      const result = scan("ab\ncd");
      const identTokens = result.tokens.filter((t) => t.type === AbctTT.IDENTIFIER);
      expect(identTokens[0].column).to.equal(0);
      expect(identTokens[1].column).to.equal(0);
    });

    it("should track offset correctly", () => {
      const result = scan("ab cd");
      const identTokens = result.tokens.filter((t) => t.type === AbctTT.IDENTIFIER);
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
              genOperator.filter((op) => op !== "<" && op !== ">"), // Avoid << and >> confusion
              genWS
            ),
            { minLength: 1, maxLength: 10 }
          ),
          (parts) => {
            const source = parts.join("");
            const result = scan(source);
            // Remove EOF token for reconstruction
            const tokensWithoutEof = result.tokens.filter((t) => t.type !== AbctTT.EOF);
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
            const result = scan(source);
            const tokensWithoutEof = result.tokens.filter((t) => t.type !== AbctTT.EOF);
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
          const result = scan(source);
          const tokensWithoutEof = result.tokens.filter((t) => t.type !== AbctTT.EOF);
          const reconstructed = tokensWithoutEof.map((t) => t.lexeme).join("");
          return reconstructed === source;
        }),
        { numRuns: 1000 }
      );
    });

    it("property: comments reconstruct correctly", () => {
      fc.assert(
        fc.property(genComment, (source) => {
          const result = scan(source);
          const tokensWithoutEof = result.tokens.filter((t) => t.type !== AbctTT.EOF);
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
            const result = scan(source);
            const tokensWithoutEof = result.tokens.filter((t) => t.type !== AbctTT.EOF);
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
      const result = scan(source);
      expect(result.errors).to.have.length(0);
      const reconstructed = result.tokens
        .filter((t) => t.type !== AbctTT.EOF)
        .map((t) => t.lexeme)
        .join("");
      expect(reconstructed).to.equal(source);
    });

    it("should scan multi-line pipeline with comments", () => {
      const source = `file.abc # source file
| transpose 2
| retrograde`;
      const result = scan(source);
      expect(result.errors).to.have.length(0);
      const reconstructed = result.tokens
        .filter((t) => t.type !== AbctTT.EOF)
        .map((t) => t.lexeme)
        .join("");
      expect(reconstructed).to.equal(source);
    });

    it("should scan assignment with ABC literal", () => {
      const source = `theme = <<C D E F|G A B c>>`;
      const result = scan(source);
      expect(result.errors).to.have.length(0);
      const reconstructed = result.tokens
        .filter((t) => t.type !== AbctTT.EOF)
        .map((t) => t.lexeme)
        .join("");
      expect(reconstructed).to.equal(source);
    });

    it("should scan selector update", () => {
      const source = "@notes |= transpose 2";
      const result = scan(source);
      expect(result.errors).to.have.length(0);
    });

    it("should scan complex filter expression", () => {
      const source = "file.abc | @M:1-4 |= transpose 2";
      const result = scan(source);
      expect(result.errors).to.have.length(0);
    });

    it("should scan list", () => {
      const source = "[file1.abc, file2.abc, file3.abc]";
      const result = scan(source);
      expect(result.errors).to.have.length(0);
      expect(result.tokens.some((t) => t.type === AbctTT.LBRACKET)).to.be.true;
      expect(result.tokens.some((t) => t.type === AbctTT.RBRACKET)).to.be.true;
    });

    it("should scan boolean expression", () => {
      const source = "@notes and @rests or not @chords";
      const result = scan(source);
      expect(result.errors).to.have.length(0);
      expect(result.tokens.some((t) => t.type === AbctTT.AND)).to.be.true;
      expect(result.tokens.some((t) => t.type === AbctTT.OR)).to.be.true;
      expect(result.tokens.some((t) => t.type === AbctTT.NOT)).to.be.true;
    });
  });
});
