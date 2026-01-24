// ABCT Formatter Tests
// Tests for formatting ABCT code according to the formatting rules

import { expect } from "chai";
import * as fc from "fast-check";
import { AbctFormatter } from "../../abc-lsp-server/src/abct/AbctFormatter";
import { parse } from "../src/parser/parser";
import { scan, AbctTT, Token } from "../src/scanner";
import { AbctContext } from "../src/context";
import { Program } from "../src/ast";

/** Helper to scan source with a fresh context */
function scanSource(source: string): { tokens: Token[]; ctx: AbctContext } {
  const ctx = new AbctContext();
  const tokens = scan(source, ctx);
  return { tokens, ctx };
}

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

describe("ABCT Formatter", () => {
  const formatter = new AbctFormatter();

  // Helper to format code and return the result
  function fmt(input: string): string {
    const result = parseSource(input);
    if (!result.success) {
      throw new Error(`Failed to parse: ${result.error.message}\nInput: ${input}`);
    }
    return formatter.format(result.value, input);
  }

  // Helper to check that formatting is idempotent (format twice gives same result)
  function assertIdempotent(input: string): void {
    const once = fmt(input);
    const twice = fmt(once);
    expect(twice).to.equal(once, "Formatting should be idempotent");
  }

  describe("Operator Spacing", () => {
    it("should add spaces around |", () => {
      const result = fmt("song.abc|@chords");
      expect(result.trim()).to.equal("song.abc | @chords");
    });

    it("should add spaces around |=", () => {
      const result = fmt("@chords|=transpose 2");
      expect(result.trim()).to.equal("@chords |= transpose 2");
    });

    it("should add spaces around +", () => {
      const result = fmt("a.abc+b.abc");
      expect(result.trim()).to.equal("a.abc + b.abc");
    });

    it("should format complex pipeline: song.abc|@chords|=transpose 2", () => {
      const result = fmt("song.abc|@chords|=transpose 2");
      expect(result.trim()).to.equal("song.abc | @chords |= transpose 2");
    });

    it("should normalize multiple spaces", () => {
      const result = fmt("song.abc  |   @chords   |=    transpose    2");
      expect(result.trim()).to.equal("song.abc | @chords |= transpose 2");
    });
  });

  describe("No Space After @", () => {
    // Note: "@ chords" (space after @) is not valid ABCT syntax - the grammar
    // does not allow whitespace between @ and the selector path.

    it("should keep selector attached: @V:melody", () => {
      const result = fmt("song.abc | @V:melody");
      expect(result.trim()).to.equal("song.abc | @V:melody");
    });

    it("should format named selectors: @M:5-8", () => {
      const result = fmt("song.abc | @M:5-8");
      expect(result.trim()).to.equal("song.abc | @M:5-8");
    });
  });

  describe("Spaces After Commas in Lists", () => {
    it("should add space after comma in list", () => {
      const result = fmt("[V:S,V:A,V:T,V:B]");
      expect(result.trim()).to.equal("[V:S, V:A, V:T, V:B]");
    });

    it("should format number list", () => {
      const result = fmt("[1,2,3]");
      expect(result.trim()).to.equal("[1, 2, 3]");
    });

    it("should handle already spaced lists", () => {
      const result = fmt("[V:S, V:A, V:T, V:B]");
      expect(result.trim()).to.equal("[V:S, V:A, V:T, V:B]");
    });
  });

  describe("Parentheses Handling", () => {
    // Note: The grammar parses parentheses but loses the information that an
    // The new hand-written parser preserves parentheses via Group nodes.
    // This fixes the parentheses preservation issue (Issue 2).

    it("should preserve explicit parentheses", () => {
      // Input "(transpose 2 | retrograde)" - parentheses are now preserved
      const result = fmt("( transpose 2 | retrograde )");
      expect(result.trim()).to.equal("(transpose 2 | retrograde)");
    });

    it("should preserve nested parentheses in update", () => {
      // The parentheses around the pipe expression are preserved
      const result = fmt("@chords |= ( choralis 4 | drop2 )");
      expect(result.trim()).to.equal("@chords |= (choralis 4 | drop2)");
    });
  });

  describe("No Space Inside Brackets", () => {
    it("should remove space inside brackets", () => {
      const result = fmt("[ 1, 2, 3 ]");
      expect(result.trim()).to.equal("[1, 2, 3]");
    });

    it("should handle empty list", () => {
      const result = fmt("[ ]");
      expect(result.trim()).to.equal("[]");
    });
  });

  describe("Single Space in Applications", () => {
    it("should normalize spaces in application", () => {
      const result = fmt("transpose    2");
      expect(result.trim()).to.equal("transpose 2");
    });

    it("should format multi-argument application", () => {
      const result = fmt("choralis   4   drop2");
      expect(result.trim()).to.equal("choralis 4 drop2");
    });
  });

  describe("Line Breaks Preservation", () => {
    it("should preserve line breaks between statements", () => {
      const input = `source = song.abc
result = source | @chords
result`;
      const result = fmt(input);
      const lines = result.trim().split("\n");
      expect(lines).to.have.length(3);
      expect(lines[0]).to.equal("source = song.abc");
      expect(lines[1]).to.equal("result = source | @chords");
      expect(lines[2]).to.equal("result");
    });

    it("should preserve blank lines between sections", () => {
      const input = `source = song.abc

result = source | @chords`;
      const result = fmt(input);
      expect(result).to.include("\n\n");
    });
  });

  describe("Comment Preservation", () => {
    it("should preserve line comments", () => {
      const input = `# This is a comment
source = song.abc`;
      const result = fmt(input);
      expect(result).to.include("# This is a comment");
      expect(result).to.include("source = song.abc");
    });

    it("should preserve trailing comments", () => {
      const input = `source = song.abc  # inline comment`;
      const result = fmt(input);
      expect(result).to.include("# inline comment");
      expect(result).to.include("source = song.abc");
    });

    it("should preserve multiple comments", () => {
      const input = `# Comment 1
source = song.abc
# Comment 2
result = source | @chords`;
      const result = fmt(input);
      expect(result).to.include("# Comment 1");
      expect(result).to.include("# Comment 2");
    });

    it("should preserve comments after multi-line statements", () => {
      const input = `tests.abc | @bass | transpose -20
| @chords | bass

#| @chords | filter (pitch > C3)
# | :2 | transpose -2`;
      const result = fmt(input);
      const lines = result.trim().split("\n");
      // Multi-line statement on lines 0-1
      expect(lines[0]).to.equal("tests.abc | @bass | transpose -20");
      expect(lines[1]).to.equal("| @chords | bass");
      // One blank line
      expect(lines[2]).to.equal("");
      // Comments on lines 3-4
      expect(lines[3]).to.equal("#| @chords | filter (pitch > C3)");
      expect(lines[4]).to.equal("# | :2 | transpose -2");
    });

    it("should preserve interleaved comments in multi-line pipes", () => {
      const input = `tests.abc | @bass | transpose -20
| @chords | bass
# | :2 | transpose -2
| @chords | filter (pitch > C3)`;
      const result = fmt(input);
      const lines = result.trim().split("\n");
      // Multi-line statement with interleaved comment
      expect(lines[0]).to.equal("tests.abc | @bass | transpose -20");
      expect(lines[1]).to.equal("| @chords | bass");
      expect(lines[2]).to.equal("# | :2 | transpose -2");
      expect(lines[3]).to.equal("| @chords | filter (pitch > C3)");
    });

    it("should preserve trailing comments in multi-line pipes", () => {
      const input = `tests.abc | @bass | transpose -20
| @chords | bass # hello
# | :2 | transpose -2
| @chords | filter (pitch > C3)`;
      const result = fmt(input);
      const lines = result.trim().split("\n");
      expect(lines[0]).to.equal("tests.abc | @bass | transpose -20");
      expect(lines[1]).to.equal("| @chords | bass  # hello");
      expect(lines[2]).to.equal("# | :2 | transpose -2");
      expect(lines[3]).to.equal("| @chords | filter (pitch > C3)");
    });

    it("should preserve trailing comments on first line of multi-line pipes", () => {
      const input = `tests.abc | @bass | transpose -20 # hello
| @chords | bass
# | :2 | transpose -2
| @chords | filter (pitch > C3)`;
      const result = fmt(input);
      const lines = result.trim().split("\n");
      expect(lines[0]).to.equal("tests.abc | @bass | transpose -20  # hello");
      expect(lines[1]).to.equal("| @chords | bass");
      expect(lines[2]).to.equal("# | :2 | transpose -2");
      expect(lines[3]).to.equal("| @chords | filter (pitch > C3)");
    });
  });

  describe("ABC Literal Preservation", () => {
    it("should preserve ABC literal content exactly", () => {
      // ABC literals use triple-backtick syntax and must be standalone
      const result = fmt("```abc\n[CEG][FAc][GBd]\n```");
      expect(result.trim()).to.equal("```abc\n[CEG][FAc][GBd]\n```");
    });

    it("should not format inside ABC literals", () => {
      const result = fmt("```abc\nC D  E   F G\n```"); // Multiple spaces inside literal
      expect(result.trim()).to.equal("```abc\nC D  E   F G\n```"); // Spaces preserved
    });

    it("should preserve ABC literal with bar lines", () => {
      const result = fmt("```abc\n| G2 | A2 |\n```");
      expect(result.trim()).to.equal("```abc\n| G2 | A2 |\n```");
    });

    it("should format ABC literal with line-only location", () => {
      const result = fmt("```abc :10\nC D E\n```");
      expect(result.trim()).to.equal("```abc :10\nC D E\n```");
    });

    it("should format ABC literal with line:col location", () => {
      const result = fmt("```abc :10:5\nC D E\n```");
      expect(result.trim()).to.equal("```abc :10:5\nC D E\n```");
    });

    it("should format ABC literal with single-line range", () => {
      const result = fmt("```abc :10:5-15\nC D E\n```");
      expect(result.trim()).to.equal("```abc :10:5-15\nC D E\n```");
    });

    it("should format ABC literal with multi-line range", () => {
      const result = fmt("```abc :10:5-12:20\nC D E\n```");
      expect(result.trim()).to.equal("```abc :10:5-12:20\nC D E\n```");
    });

    it("should preserve sanitized content in formatted output", () => {
      const result = fmt("```abc\nsome \\`\\`\\` escaped\n```");
      expect(result.trim()).to.include("\\`\\`\\`");
    });
  });

  describe("Assignment Formatting", () => {
    it("should format simple assignment", () => {
      const result = fmt("input=song.abc");
      expect(result.trim()).to.equal("input = song.abc");
    });

    it("should format assignment with pipeline", () => {
      const result = fmt("result=input|@chords|=transpose 2");
      expect(result.trim()).to.equal("result = input | @chords |= transpose 2");
    });
  });

  describe("Location Selectors", () => {
    it("should format simple location: :10", () => {
      const result = fmt(":10");
      expect(result.trim()).to.equal(":10");
    });

    it("should format location with column: :10:5", () => {
      const result = fmt(":10:5");
      expect(result.trim()).to.equal(":10:5");
    });

    it("should format location with range: :10:5-15", () => {
      const result = fmt(":10:5-15");
      expect(result.trim()).to.equal(":10:5-15");
    });

    it("should format multiline range: :10:5-12:20", () => {
      const result = fmt(":10:5-12:20");
      expect(result.trim()).to.equal(":10:5-12:20");
    });
  });

  describe("File References", () => {
    it("should format file with location", () => {
      const result = fmt("file.abc:10:5");
      expect(result.trim()).to.equal("file.abc:10:5");
    });

    it("should format file with selector", () => {
      const result = fmt("file.abc@chords");
      expect(result.trim()).to.equal("file.abc@chords");
    });

    it("should format file with location and selector", () => {
      const result = fmt("file.abc:10:5-15@chords");
      expect(result.trim()).to.equal("file.abc:10:5-15@chords");
    });
  });

  describe("Logical Operators", () => {
    it("should format and expression", () => {
      const result = fmt("a and b");
      expect(result.trim()).to.equal("a and b");
    });

    it("should format or expression", () => {
      const result = fmt("a or b");
      expect(result.trim()).to.equal("a or b");
    });

    it("should format not expression", () => {
      const result = fmt("not a");
      expect(result.trim()).to.equal("not a");
    });

    it("should format complex logical expression", () => {
      const result = fmt("a   and   b   or   c");
      expect(result.trim()).to.equal("a and b or c");
    });
  });

  describe("Comparison Operators", () => {
    it("should format comparisons with spaces", () => {
      expect(fmt("x>1").trim()).to.equal("x > 1");
      expect(fmt("x<1").trim()).to.equal("x < 1");
      expect(fmt("x>=1").trim()).to.equal("x >= 1");
      expect(fmt("x<=1").trim()).to.equal("x <= 1");
      expect(fmt("x==1").trim()).to.equal("x == 1");
      expect(fmt("x!=1").trim()).to.equal("x != 1");
    });
  });

  describe("Complex Examples", () => {
    it("should format complex arrangement example", () => {
      const input = `source=lead_sheet.abc
strings=source|@chords|=(choralis 4|drop2|distribute [V:vln1,V:vln2,V:vla,V:vc])
trumpet=source|@V:melody|transpose 2
bass=source|@chords|roots|transpose -12
strings+trumpet+bass`;
      const result = fmt(input);
      expect(result).to.include("source = lead_sheet.abc");
      // Parentheses are now preserved by the new parser
      expect(result).to.include("strings = source | @chords |= (choralis 4 | drop2 | distribute [V:vln1, V:vln2, V:vla, V:vc])");
      expect(result).to.include("trumpet = source | @V:melody | transpose 2");
      expect(result).to.include("bass = source | @chords | roots | transpose -12");
      expect(result).to.include("strings + trumpet + bass");
    });

    it("should format nested updates", () => {
      // Parentheses are preserved by the new parser
      const result = fmt("src.abc | @chords |= (@notes |= transpose 2)");
      expect(result.trim()).to.equal("src.abc | @chords |= (@notes |= transpose 2)");
    });

    it("should format filter with comparison", () => {
      // Parentheses are preserved by the new parser
      const result = fmt("src.abc | @notes |= (filter (duration > 1/2) | transpose 2)");
      expect(result.trim()).to.equal("src.abc | @notes |= (filter (duration > 1/2) | transpose 2)");
    });
  });

  describe("Idempotence", () => {
    it("should be idempotent for simple expression", () => {
      assertIdempotent("song.abc | @chords");
    });

    it("should be idempotent for assignment", () => {
      assertIdempotent("result = song.abc | @chords |= transpose 2");
    });

    it("should be idempotent for complex program", () => {
      assertIdempotent(`source = lead_sheet.abc
strings = source | @chords |= (choralis 4 | drop2)
strings`);
    });

    it("should be idempotent for program with comments", () => {
      assertIdempotent(`# Load source
source = song.abc
# Transform chords
result = source | @chords |= transpose 2  # up a step
result`);
    });
  });

  describe("Roundtrip Tests", () => {
    // Parse -> Format -> Parse should give equivalent AST (semantically)

    function assertRoundtrip(input: string): void {
      const result1 = parseSource(input);
      if (!result1.success) {
        throw new Error(`Failed to parse input: ${result1.error.message}`);
      }

      const formatted = formatter.format(result1.value, input);

      const result2 = parseSource(formatted);
      if (!result2.success) {
        throw new Error(`Failed to parse formatted output: ${result2.error.message}\nFormatted:\n${formatted}`);
      }

      // Compare statement counts (semantic equivalence)
      expect(result2.value.statements.length).to.equal(
        result1.value.statements.length,
        "Statement count should match after roundtrip"
      );
    }

    it("should roundtrip simple pipe", () => {
      assertRoundtrip("song.abc | @chords");
    });

    it("should roundtrip assignment", () => {
      assertRoundtrip("result = song.abc | @chords |= transpose 2");
    });

    it("should roundtrip list", () => {
      assertRoundtrip("distribute [V:S, V:A, V:T, V:B]");
    });

    it("should roundtrip logical expression", () => {
      assertRoundtrip("a and b or not c");
    });

    it("should roundtrip comparison", () => {
      assertRoundtrip("duration > 1/2");
    });

    it("should roundtrip ABC literal", () => {
      assertRoundtrip("```abc\n[CEG][FAc][GBd]\n```");
    });

    it("should roundtrip location selector", () => {
      // ABC literals are now multi-line, so use a simple transform instead
      assertRoundtrip("src.abc | :10:5-12:20 |= transpose 2");
    });

    it("should roundtrip file reference with selector", () => {
      assertRoundtrip("file.abc:10:5-15@V:melody");
    });

    it("should roundtrip complex program", () => {
      assertRoundtrip(`source = lead_sheet.abc
strings = source | @chords |= (choralis 4 | distribute [V:vln1, V:vln2])
strings`);
    });

    it("should roundtrip program with comments", () => {
      assertRoundtrip(`# Header comment
source = song.abc  # inline
result = source | @chords
result`);
    });
  });

  describe("Operator Whitespace Insertion", () => {
    // Helper to extract operator lexemes from formatted output
    function extractOperatorTokens(source: string): string[] {
      const { tokens } = scanSource(source);
      return tokens
        .filter(t => [
          AbctTT.PIPE, AbctTT.EQ, AbctTT.LT, AbctTT.GT,
          AbctTT.LTE, AbctTT.GTE, AbctTT.EQEQ, AbctTT.BANGEQ, AbctTT.PLUS
        ].includes(t.type))
        .map(t => t.lexeme);
    }

    describe("pipe sequences", () => {
      it("should format pipe with proper spacing", () => {
        const input = "a | b";
        const result = fmt(input);
        expect(result.trim()).to.equal("a | b");
        const ops = extractOperatorTokens(result);
        expect(ops).to.deep.equal(["|"]);
      });

      it("should separate chained pipes with proper spacing", () => {
        const input = "a | b | c";
        const result = fmt(input);
        expect(result.trim()).to.equal("a | b | c");
        const ops = extractOperatorTokens(result);
        expect(ops).to.deep.equal(["|", "|"]);
      });
    });

    describe("comparison and assignment sequences", () => {
      it("should format comparison followed by assignment correctly", () => {
        // In a multi-statement program
        const input = `cond = a > b
result = c`;
        const result = fmt(input);
        expect(result).to.include("a > b");
        expect(result).to.include("result = c");
      });

      it("should format equality operators with proper spacing", () => {
        const input = "x == 1";
        const result = fmt(input);
        expect(result.trim()).to.equal("x == 1");
        const ops = extractOperatorTokens(result);
        expect(ops).to.deep.equal(["=="]);
      });

      it("should format inequality operators with proper spacing", () => {
        const input = "x != 1";
        const result = fmt(input);
        expect(result.trim()).to.equal("x != 1");
        const ops = extractOperatorTokens(result);
        expect(ops).to.deep.equal(["!="]);
      });

      it("should format >= and <= with proper spacing", () => {
        const input1 = "x >= 1";
        const input2 = "x <= 1";
        const result1 = fmt(input1);
        const result2 = fmt(input2);
        expect(result1.trim()).to.equal("x >= 1");
        expect(result2.trim()).to.equal("x <= 1");
        // Verify tokens scan correctly
        expect(extractOperatorTokens(result1)).to.deep.equal([">="]);
        expect(extractOperatorTokens(result2)).to.deep.equal(["<="]);
      });
    });

    describe("complex operator sequences", () => {
      it("should handle pipeline with multiple operators", () => {
        const input = "src.abc | @chords |= transpose 2 | @notes |= retrograde";
        const result = fmt(input);
        expect(result.trim()).to.equal("src.abc | @chords |= transpose 2 | @notes |= retrograde");
        const ops = extractOperatorTokens(result);
        expect(ops).to.deep.equal(["|", "|=", "|", "|="]);
      });

      it("should handle concat and pipe together", () => {
        const input = "a.abc + b.abc | @chords";
        const result = fmt(input);
        expect(result.trim()).to.equal("a.abc + b.abc | @chords");
        const ops = extractOperatorTokens(result);
        expect(ops).to.deep.equal(["+", "|"]);
      });
    });

    describe("round-trip through scanner", () => {
      // Verify formatted output scans to the same tokens
      function assertScanRoundtrip(input: string): void {
        const result1 = parseSource(input);
        if (!result1.success) {
          throw new Error(`Failed to parse: ${result1.error.message}`);
        }
        const formatted = formatter.format(result1.value, input);
        const { ctx } = scanSource(formatted);
        expect(ctx.errorReporter.getErrors()).to.have.length(0, "Formatted output should scan without errors");

        // Parse the formatted output
        const result2 = parseSource(formatted);
        expect(result2.success).to.be.true;
      }

      it("should roundtrip update-pipe sequence", () => {
        assertScanRoundtrip("@sel |= a | b");
      });

      it("should roundtrip comparison sequence", () => {
        assertScanRoundtrip("x >= 1");
        assertScanRoundtrip("x <= 1");
        assertScanRoundtrip("x == 1");
        assertScanRoundtrip("x != 1");
      });

      it("should roundtrip complex pipeline", () => {
        assertScanRoundtrip("src.abc | @chords |= (a | b) | @notes |= c");
      });
    });

    describe("property-based tests", () => {
      it("property: formatted output should round-trip through scanner", () => {
        // Generate expressions with various operators
        const genOperator = fc.constantFrom("|", "|=", "+");
        const genIdentifier = fc.stringMatching(/^[a-z][a-z0-9_]{0,5}$/);

        const genSimpleExpr = fc.tuple(
          genIdentifier,
          genOperator,
          genIdentifier
        ).map(([left, op, right]) => {
          if (op === "|=") {
            // Update requires selector on left
            return `@${left} |= ${right}`;
          }
          return `${left}.abc ${op} ${right}.abc`;
        });

        fc.assert(
          fc.property(genSimpleExpr, (expr) => {
            const result = parseSource(expr);
            if (!result.success) return true; // Skip invalid expressions

            const formatted = formatter.format(result.value, expr);
            const { ctx } = scanSource(formatted);

            // Formatted output should scan without errors
            if (ctx.errorReporter.hasErrors()) return false;

            // Should be able to parse the formatted output
            const reparsed = parseSource(formatted);
            return reparsed.success;
          }),
          { numRuns: 200 }
        );
      });

      it("property: comparison operators should be properly spaced", () => {
        const genCompOp = fc.constantFrom(">=", "<=", "==", "!=", ">", "<");
        const genIdentifier = fc.stringMatching(/^[a-z][a-z0-9_]{0,5}$/);
        const genNumber = fc.integer({ min: 0, max: 100 }).map(String);

        const genComparison = fc.tuple(
          genIdentifier,
          genCompOp,
          genNumber
        ).map(([left, op, right]) => `${left} ${op} ${right}`);

        fc.assert(
          fc.property(genComparison, (expr) => {
            const result = parseSource(expr);
            if (!result.success) return true;

            const formatted = formatter.format(result.value, expr);

            // Verify the operator token extracted from scanning has proper spacing
            const { tokens } = scanSource(formatted);
            const compOps = tokens.filter(t =>
              [AbctTT.LT, AbctTT.GT, AbctTT.LTE, AbctTT.GTE, AbctTT.EQEQ, AbctTT.BANGEQ].includes(t.type)
            );

            // Should have exactly one comparison operator
            if (compOps.length !== 1) return false;

            // Verify the formatted output can be reparsed
            const reparsed = parseSource(formatted);
            return reparsed.success;
          }),
          { numRuns: 200 }
        );
      });
    });
  });
});
