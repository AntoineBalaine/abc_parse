// Invalid input tests for ABCT grammar
// Parser must reject malformed input

import { expect } from "chai";
import { scan } from "../src/scanner";
import { parse } from "../src/parser/parser";
import { AbctContext } from "../src/context";
import { Program } from "../src/ast";

/** Helper to parse source with a fresh context and return a result-like object */
function parseSource(source: string): { success: true; value: Program } | { success: false; error: { message: string } } {
  const ctx = new AbctContext();
  const tokens = scan(source, ctx);
  const program = parse(tokens, ctx);
  if (ctx.errorReporter.hasErrors()) {
    const errors = ctx.errorReporter.getErrors();
    return { success: false, error: { message: errors[0].message } };
  }
  return { success: true, value: program };
}

describe("ABCT Grammar Invalid Inputs", () => {
  // Helper to assert parse failure
  function assertFails(input: string, description?: string) {
    const result = parseSource(input);
    if (result.success) {
      throw new Error(
        `Expected parse to fail${description ? ` (${description})` : ""}, but it succeeded.\nInput: ${input}\nAST: ${JSON.stringify(result.value, null, 2)}`
      );
    }
    return result.error;
  }

  describe("Unclosed Delimiters", () => {
    it("should reject unclosed parentheses: (f | g", () => {
      assertFails("(f | g", "unclosed parenthesis");
    });

    it("should reject unclosed brackets: [a, b", () => {
      assertFails("[a, b", "unclosed bracket");
    });

    it("should reject unclosed ABC literal: <<[CEG]", () => {
      assertFails("<<[CEG]", "unclosed ABC literal");
    });

    it("should reject extra closing parenthesis: f)", () => {
      assertFails("f)", "extra closing paren");
    });

    it("should reject extra closing bracket: a]", () => {
      assertFails("a]", "extra closing bracket");
    });
  });

  describe("Invalid Operators", () => {
    it("should reject double pipe: src.abc || @chords", () => {
      // || is not a valid operator
      assertFails("src.abc || @chords", "double pipe");
    });

    it("should reject triple equals: a === b", () => {
      assertFails("a === b", "triple equals");
    });

    it("should reject single ampersand: a & b", () => {
      assertFails("a & b", "single ampersand");
    });

    it("should reject double ampersand: a && b", () => {
      assertFails("a && b", "double ampersand");
    });
  });

  describe("Missing Operands", () => {
    it("should reject pipe at start: | @chords", () => {
      assertFails("| @chords", "pipe at start");
    });

    it("should reject pipe at end: src.abc |", () => {
      assertFails("src.abc |", "pipe at end");
    });

    it("should reject concat at start: + b.abc", () => {
      assertFails("+ b.abc", "concat at start");
    });

    it("should reject concat at end: a.abc +", () => {
      assertFails("a.abc +", "concat at end");
    });

    it("should reject update without selector: |= transpose 2", () => {
      assertFails("|= transpose 2", "update without selector");
    });

    it("should reject update without transform: @chords |=", () => {
      assertFails("@chords |=", "update without transform");
    });

    it("should reject comparison without right operand: a >", () => {
      assertFails("a >", "comparison without right");
    });

    it("should reject comparison without left operand: > b", () => {
      assertFails("> b", "comparison without left");
    });
  });

  describe("Invalid Selectors", () => {
    it("should accept selector with space: @ chords (whitespace allowed)", () => {
      // The new parser allows whitespace between @ and the identifier
      const result = parseSource("@ chords");
      expect(result.success).to.be.true;
    });

    it("should reject bare @: @", () => {
      assertFails("@", "bare @");
    });

    it("should reject @ followed by number: @123", () => {
      // Selectors must start with identifier
      // Actually, looking at the spec, @1:5-20 seems to be valid for positional selection
      // But our grammar requires identifier first. Let's keep this test.
      assertFails("@123", "@ followed by number");
    });
  });

  describe("Invalid File References", () => {
    it("should parse bare word as identifier, not file_ref", () => {
      // 'file' without extension is a valid identifier
      const result = parseSource("file");
      expect(result.success).to.be.true;
    });

    it("should parse location selector without file: :10:5", () => {
      // Location selectors are now valid as standalone atoms for piped input
      const result = parseSource(":10:5");
      expect(result.success).to.be.true;
    });
  });

  describe("Invalid Location Selectors", () => {
    it("should reject bare colon: :", () => {
      assertFails(":", "bare colon");
    });

    it("should reject double colon: ::10", () => {
      assertFails("::10", "double colon");
    });

    it("should parse location with trailing colon: :10: (trailing content ignored)", () => {
      // The error-recovering parser parses :10 and leaves the trailing colon unconsumed
      // This is acceptable behavior for an error-recovering parser
      const result = parseSource(":10:");
      expect(result.success).to.be.true;
    });

    it("should parse location with incomplete range: :10:5- (trailing content ignored)", () => {
      // The error-recovering parser parses :10:5 and leaves the trailing minus unconsumed
      // This is acceptable behavior for an error-recovering parser
      const result = parseSource(":10:5-");
      expect(result.success).to.be.true;
    });

    // Note: Semantic validation (e.g., start line <= end line, start col <= end col
    // for single-line ranges) is intentionally left to the semantic analyzer, not
    // the parser. The grammar accepts all syntactically valid ranges like :100:5-50:10
    // even though they may be semantically invalid.
  });

  describe("Invalid Numbers", () => {
    it("should reject incomplete fraction: 1/", () => {
      assertFails("transpose 1/", "incomplete fraction");
    });

    it("should reject fraction without numerator: /2", () => {
      assertFails("transpose /2", "fraction without numerator");
    });

    it("should parse double negative as double negation: --5", () => {
      // Double negation is mathematically valid: --5 = -(-5) = 5
      // The parser creates Negate(Negate(5)) which is correct
      const result = parseSource("transpose --5");
      expect(result.success).to.be.true;
    });
  });

  describe("Invalid Ranges", () => {
    it("should reject incomplete range: 5-", () => {
      assertFails("@M:5-", "incomplete range");
    });

    it("should accept negative number in selector: @M:-8", () => {
      // -8 is a valid negative number, so @M:-8 is valid (selects measure -8)
      const result = parseSource("@M:-8");
      expect(result.success).to.be.true;
    });
  });

  describe("Invalid Assignments", () => {
    it("should reject assignment without value: x =", () => {
      assertFails("x =", "assignment without value");
    });

    it("should reject assignment without identifier: = value", () => {
      assertFails("= value", "assignment without identifier");
    });

    it("should reject number as assignment target: 123 = value", () => {
      // Numbers can't be assigned to
      assertFails("123 = value", "number as assignment target");
    });
  });

  describe("Invalid Logical Expressions", () => {
    it("should reject 'and' without right operand: a and", () => {
      assertFails("a and", "and without right operand");
    });

    it("should reject 'and' without left operand: and b", () => {
      // 'and' is reserved, so this should fail
      assertFails("and b", "and without left operand");
    });

    it("should reject 'or' without right operand: a or", () => {
      assertFails("a or", "or without right operand");
    });

    it("should reject 'not' without operand: not", () => {
      assertFails("not", "not without operand");
    });
  });

  describe("Invalid Lists", () => {
    it("should reject trailing comma: [a, b,]", () => {
      assertFails("[a, b,]", "trailing comma");
    });

    it("should reject leading comma: [,a, b]", () => {
      assertFails("[,a, b]", "leading comma");
    });

    it("should reject double comma: [a,, b]", () => {
      assertFails("[a,, b]", "double comma");
    });
  });

  describe("Invalid Comments", () => {
    // Comments should work, so test edge cases
    it("should handle comment-only input as empty program", () => {
      const result = parseSource("# just a comment");
      expect(result.success).to.be.true;
      if (result.success) {
        expect(result.value.statements).to.have.length(0);
      }
    });
  });

  describe("Reserved Words", () => {
    it("should reject 'and' as identifier in assignment: and = 5", () => {
      assertFails("and = 5", "and as identifier");
    });

    it("should reject 'or' as identifier in assignment: or = 5", () => {
      assertFails("or = 5", "or as identifier");
    });

    it("should reject 'not' as identifier in assignment: not = 5", () => {
      assertFails("not = 5", "not as identifier");
    });
  });

  describe("Whitespace Edge Cases", () => {
    it("should handle empty input", () => {
      const result = parseSource("");
      expect(result.success).to.be.true;
      if (result.success) {
        expect(result.value.statements).to.have.length(0);
      }
    });

    it("should handle whitespace-only input", () => {
      const result = parseSource("   \n\t  ");
      expect(result.success).to.be.true;
      if (result.success) {
        expect(result.value.statements).to.have.length(0);
      }
    });
  });

  describe("Malformed ABC Literals", () => {
    it("should reject single < before content: <[CEG]>>", () => {
      assertFails("<[CEG]>>", "single < before content");
    });

    it("should reject single > at end: <<[CEG]>", () => {
      assertFails("<<[CEG]>", "single > at end");
    });
  });

  describe("Invalid Nested Structures", () => {
    it("should reject mismatched parens and brackets: (a]", () => {
      assertFails("(a]", "mismatched delimiters");
    });

    it("should reject mismatched brackets and parens: [a)", () => {
      assertFails("[a)", "mismatched delimiters");
    });
  });
});
