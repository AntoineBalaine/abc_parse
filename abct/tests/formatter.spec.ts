// ABCT Formatter Tests
// Tests for formatting ABCT code according to the formatting rules

import { expect } from "chai";
import { AbctFormatter } from "../../abc-lsp-server/src/abct/AbctFormatter";
import { parse } from "../src/parser";

describe("ABCT Formatter", () => {
  const formatter = new AbctFormatter();

  // Helper to format code and return the result
  function fmt(input: string): string {
    const result = parse(input);
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
      const result1 = parse(input);
      if (!result1.success) {
        throw new Error(`Failed to parse input: ${result1.error.message}`);
      }

      const formatted = formatter.format(result1.value, input);

      const result2 = parse(formatted);
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
});
