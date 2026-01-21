/**
 * Comprehensive Scanner Round-Trip Tests
 *
 * Part 3: Verifies that all token types round-trip correctly through the scanner.
 * The scanner should produce tokens whose lexemes, when concatenated, equal the original source.
 */

import { expect } from "chai";
import * as fc from "fast-check";
import { scan, AbctTT } from "../../src/scanner";
import {
  genIdentifier,
  genKeyword,
  genNumber,
  genString,
  genSafeSingleOp,
  genDoubleOp,
  genWS,
  genComment,
  genTokenSequence,
  genAbcFence,
} from "./generators";

describe("Comprehensive Scanner Round-Trip Tests", () => {
  /**
   * Helper to extract token lexemes (excluding EOF) and join them
   */
  function reconstructSource(source: string): string | null {
    const result = scan(source);
    if (result.errors.length > 0) return null;
    return result.tokens
      .filter((t) => t.type !== AbctTT.EOF)
      .map((t) => t.lexeme)
      .join("");
  }

  describe("operator ambiguity edge cases", () => {
    const testCases = [
      { input: ">=<", expected: [">=", "<"] },
      { input: "<=>=", expected: ["<=", ">="] },
      { input: "|=|", expected: ["|=", "|"] },
      { input: "===", expected: ["==", "="] },
      { input: "!==", expected: ["!=", "="] },
      { input: "|=|=", expected: ["|=", "|="] },
      { input: "<<=", expected: ["<", "<="] },
      { input: ">>=", expected: [">", ">="] },
      { input: ">=<=", expected: [">=", "<="] },
      { input: "|=|=|", expected: ["|=", "|=", "|"] },
    ];

    testCases.forEach(({ input, expected }) => {
      it(`should scan "${input}" as ${expected.join(" + ")}`, () => {
        const result = scan(input);
        const lexemes = result.tokens
          .filter((t) => t.type !== AbctTT.EOF)
          .map((t) => t.lexeme);
        expect(lexemes).to.deep.equal(expected);
      });
    });

    it("should round-trip all ambiguous operator sequences", () => {
      for (const { input } of testCases) {
        const reconstructed = reconstructSource(input);
        expect(reconstructed).to.equal(
          input,
          `Round-trip failed for "${input}"`
        );
      }
    });
  });

  describe("individual token type round-trips", () => {
    it("property: identifiers round-trip correctly", () => {
      fc.assert(
        fc.property(genIdentifier, (id) => {
          const reconstructed = reconstructSource(id);
          return reconstructed === id;
        }),
        { numRuns: 500 }
      );
    });

    it("property: keywords round-trip correctly", () => {
      fc.assert(
        fc.property(genKeyword, (kw) => {
          const reconstructed = reconstructSource(kw);
          return reconstructed === kw;
        }),
        { numRuns: 100 }
      );
    });

    it("property: numbers round-trip correctly", () => {
      fc.assert(
        fc.property(genNumber, (num) => {
          const reconstructed = reconstructSource(num);
          return reconstructed === num;
        }),
        { numRuns: 500 }
      );
    });

    it("property: single operators round-trip correctly", () => {
      fc.assert(
        fc.property(genSafeSingleOp, (op) => {
          const reconstructed = reconstructSource(op);
          return reconstructed === op;
        }),
        { numRuns: 200 }
      );
    });

    it("property: double operators round-trip correctly", () => {
      fc.assert(
        fc.property(genDoubleOp, (op) => {
          const reconstructed = reconstructSource(op);
          return reconstructed === op;
        }),
        { numRuns: 100 }
      );
    });

    it("property: whitespace round-trips correctly", () => {
      fc.assert(
        fc.property(genWS, (ws) => {
          const reconstructed = reconstructSource(ws);
          return reconstructed === ws;
        }),
        { numRuns: 200 }
      );
    });

    it("property: ABC fences round-trip correctly", () => {
      fc.assert(
        fc.property(genAbcFence, (fence) => {
          const reconstructed = reconstructSource(fence);
          return reconstructed === fence;
        }),
        { numRuns: 200 }
      );
    });

    it("property: string literals round-trip correctly", () => {
      fc.assert(
        fc.property(genString, (str) => {
          const reconstructed = reconstructSource(str);
          return reconstructed === str;
        }),
        { numRuns: 300 }
      );
    });

    it("property: comments round-trip correctly when followed by newline", () => {
      fc.assert(
        fc.property(genComment, (comment) => {
          // Because comments consume until EOL, we must include a newline
          const source = comment + "\n";
          const reconstructed = reconstructSource(source);
          return reconstructed === source;
        }),
        { numRuns: 200 }
      );
    });
  });

  describe("operator sequences round-trip", () => {
    it("property: operator sequences round-trip correctly", () => {
      const genOpSequence = fc
        .array(fc.oneof(genSafeSingleOp, genDoubleOp), {
          minLength: 2,
          maxLength: 8,
        })
        .map((ops) => ops.join(""));

      fc.assert(
        fc.property(genOpSequence, (source) => {
          const reconstructed = reconstructSource(source);
          return reconstructed === source;
        }),
        { numRuns: 3000 }
      );
    });

    it("property: mixed single and double operators round-trip", () => {
      const genMixedOps = fc
        .tuple(genSafeSingleOp, genDoubleOp, genSafeSingleOp)
        .map(([a, b, c]) => a + b + c);

      fc.assert(
        fc.property(genMixedOps, (source) => {
          const reconstructed = reconstructSource(source);
          return reconstructed === source;
        }),
        { numRuns: 1000 }
      );
    });
  });

  describe("comprehensive round-trip", () => {
    it("property: all token types round-trip correctly", () => {
      fc.assert(
        fc.property(genTokenSequence, (source) => {
          const result = scan(source);
          if (result.errors.length > 0) return true; // Skip invalid inputs
          const tokensWithoutEof = result.tokens.filter(
            (t) => t.type !== AbctTT.EOF
          );
          const reconstructed = tokensWithoutEof.map((t) => t.lexeme).join("");
          return reconstructed === source;
        }),
        { numRuns: 5000 }
      );
    });

    it("property: mixed content round-trips correctly", () => {
      const genMixed = fc
        .array(
          fc.oneof(
            genIdentifier,
            genNumber,
            genSafeSingleOp,
            genDoubleOp,
            genWS,
            fc.constant("\n")
          ),
          { minLength: 5, maxLength: 30 }
        )
        .map((parts) => parts.join(""));

      fc.assert(
        fc.property(genMixed, (source) => {
          const result = scan(source);
          if (result.errors.length > 0) return true;
          const tokensWithoutEof = result.tokens.filter(
            (t) => t.type !== AbctTT.EOF
          );
          const reconstructed = tokensWithoutEof.map((t) => t.lexeme).join("");
          return reconstructed === source;
        }),
        { numRuns: 5000 }
      );
    });

    it("property: identifier followed by operator round-trips", () => {
      const genIdOp = fc
        .tuple(genIdentifier, genWS.map((s) => s || " "), genDoubleOp)
        .map(([id, ws, op]) => id + ws + op);

      fc.assert(
        fc.property(genIdOp, (source) => {
          const reconstructed = reconstructSource(source);
          return reconstructed === source;
        }),
        { numRuns: 1000 }
      );
    });

    it("property: number followed by operator round-trips", () => {
      const genNumOp = fc
        .tuple(genNumber, genSafeSingleOp)
        .map(([num, op]) => num + op);

      fc.assert(
        fc.property(genNumOp, (source) => {
          const reconstructed = reconstructSource(source);
          return reconstructed === source;
        }),
        { numRuns: 1000 }
      );
    });
  });

  describe("edge cases", () => {
    it("should handle empty input", () => {
      const result = scan("");
      expect(result.errors).to.have.length(0);
      expect(result.tokens).to.have.length(1); // Just EOF
      expect(result.tokens[0].type).to.equal(AbctTT.EOF);
    });

    it("should handle single character tokens", () => {
      const singles = ["|", "+", "=", "@", ":", "-", "(", ")", "[", "]", ".", ",", "<", ">"];
      for (const char of singles) {
        const reconstructed = reconstructSource(char);
        expect(reconstructed).to.equal(char, `Failed for "${char}"`);
      }
    });

    it("should handle consecutive comparison operators", () => {
      const inputs = ["<<", ">>", "<>", "><", "<=<", ">=>"];
      for (const input of inputs) {
        const reconstructed = reconstructSource(input);
        expect(reconstructed).to.equal(input, `Failed for "${input}"`);
      }
    });

    it("should handle identifiers with reserved word prefixes", () => {
      // Words that start with reserved words but aren't reserved
      const inputs = ["andromeda", "orchid", "nothing", "andre", "order"];
      for (const input of inputs) {
        const result = scan(input);
        expect(result.errors).to.have.length(0);
        expect(result.tokens[0].type).to.equal(AbctTT.IDENTIFIER);
        expect(result.tokens[0].lexeme).to.equal(input);
      }
    });

    it("should correctly distinguish reserved words", () => {
      const reserved = [
        { input: "and", type: AbctTT.AND },
        { input: "or", type: AbctTT.OR },
        { input: "not", type: AbctTT.NOT },
      ];
      for (const { input, type } of reserved) {
        const result = scan(input);
        expect(result.tokens[0].type).to.equal(type);
      }
    });

    it("should handle maximal munch for operators", () => {
      // |= should be one token, not | and =
      const result = scan("|=");
      const nonEof = result.tokens.filter((t) => t.type !== AbctTT.EOF);
      expect(nonEof).to.have.length(1);
      expect(nonEof[0].type).to.equal(AbctTT.PIPE_EQ);
      expect(nonEof[0].lexeme).to.equal("|=");
    });

    it("should handle fractions vs division ambiguity", () => {
      // 1/2 should be scanned as one NUMBER token (fraction)
      const result = scan("1/2");
      const nonEof = result.tokens.filter((t) => t.type !== AbctTT.EOF);
      expect(nonEof).to.have.length(1);
      expect(nonEof[0].type).to.equal(AbctTT.NUMBER);
      expect(nonEof[0].lexeme).to.equal("1/2");
    });

    it("should handle ABC fence with embedded content", () => {
      const input = "```abc\nX:1\nT:Test\nK:C\n[CEG]\n```";
      const reconstructed = reconstructSource(input);
      expect(reconstructed).to.equal(input);
    });
  });
});
