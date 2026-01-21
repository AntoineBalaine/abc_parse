// Example-based tests for ABCT grammar
// All examples from plans/9.abct-language-spec.md must parse successfully

import { expect } from "chai";
import { parse, parseOrThrow } from "../src/parser";
import {
  isPipe,
  isUpdate,
  isConcat,
  isSelector,
  isLocationSelector,
  isIdentifier,
  isFileRef,
  isApplication,
  isComparison,
  isList,
  isAbcLiteral,
  isAssignment,
  isGroup,
} from "../src/ast";

describe("ABCT Grammar Examples", () => {
  // Helper to assert successful parse
  function assertParses(input: string, description?: string) {
    const result = parse(input);
    if (!result.success) {
      throw new Error(
        `Failed to parse${description ? ` (${description})` : ""}: ${result.error.message}\nInput: ${input}`
      );
    }
    return result.value;
  }

  describe("Basic Extraction vs Update", () => {
    it("should parse: src.abc | @chords", () => {
      const program = assertParses("src.abc | @chords");
      expect(program.statements).to.have.length(1);
      const expr = program.statements[0];
      expect(isPipe(expr)).to.be.true;
    });

    it("should parse: src.abc | @chords |= transpose 2", () => {
      const program = assertParses("src.abc | @chords |= transpose 2");
      expect(program.statements).to.have.length(1);
      const expr = program.statements[0];
      expect(isPipe(expr)).to.be.true;
    });
  });

  describe("Chaining Transforms", () => {
    it("should parse: src.abc | @chords |= choralis 4 | @bass |= transpose -12", () => {
      const program = assertParses(
        "src.abc | @chords |= choralis 4 | @bass |= transpose -12"
      );
      expect(program.statements).to.have.length(1);
    });

    it("should parse: src.abc | @chords |= (choralis 4 | drop2 | spread 2)", () => {
      const program = assertParses(
        "src.abc | @chords |= (choralis 4 | drop2 | spread 2)"
      );
      expect(program.statements).to.have.length(1);
    });
  });

  describe("Nested Selections", () => {
    it("should parse: src.abc | @chords |= (@notes |= transpose 2)", () => {
      const program = assertParses(
        "src.abc | @chords |= (@notes |= transpose 2)"
      );
      expect(program.statements).to.have.length(1);
    });
  });

  describe("Extract, Transform, Discard Context", () => {
    it("should parse: src.abc | @chords | choralis 4 | drop2", () => {
      const program = assertParses("src.abc | @chords | choralis 4 | drop2");
      expect(program.statements).to.have.length(1);
    });
  });

  describe("Mixed Pipeline", () => {
    it("should parse: src.abc | @chords |= choralis 4 | transpose 2", () => {
      const program = assertParses(
        "src.abc | @chords |= choralis 4 | transpose 2"
      );
      expect(program.statements).to.have.length(1);
    });
  });

  describe("Variables and Step-by-Step", () => {
    it("should parse: input = song.abc", () => {
      const program = assertParses("input = song.abc");
      expect(program.statements).to.have.length(1);
      expect(isAssignment(program.statements[0])).to.be.true;
    });

    it("should parse: step1 = input | @chords |= choralis 4", () => {
      const program = assertParses("step1 = input | @chords |= choralis 4");
      expect(program.statements).to.have.length(1);
      expect(isAssignment(program.statements[0])).to.be.true;
    });

    it("should parse multi-line program with variables", () => {
      const input = `input = song.abc
step1 = input | @chords |= choralis 4
step2 = step1 | @chords |= drop2
result = step2 | @bass |= transpose -12
result`;
      const program = assertParses(input);
      expect(program.statements).to.have.length(5);
    });
  });

  describe("Voice Distribution", () => {
    it("should parse: src.abc | @chords |= (choralis 4 | distribute [V:soprano, V:alto, V:tenor, V:bass])", () => {
      const program = assertParses(
        "src.abc | @chords |= (choralis 4 | distribute [V:soprano, V:alto, V:tenor, V:bass])"
      );
      expect(program.statements).to.have.length(1);
    });

    it("should parse: distribute [V:S, V:A, V:T, V:B]", () => {
      const program = assertParses("distribute [V:S, V:A, V:T, V:B]");
      expect(program.statements).to.have.length(1);
    });
  });

  describe("Inline Patch", () => {
    // Note: ABC literals now use triple-backtick syntax which requires line start,
    // so we use a variable to hold the patch in multi-line programs
    it("should parse: patch via variable with src.abc | :1:5-20 |= patch", () => {
      const program = assertParses("patch = transpose 2\nsrc.abc | :1:5-20 |= patch");
      expect(program.statements).to.have.length(2);
      const expr = program.statements[1];
      expect(isPipe(expr)).to.be.true;
    });
  });

  describe("Location Selectors", () => {
    it("should parse: src.abc | :10 |= transform", () => {
      const program = assertParses("src.abc | :10 |= transpose 2");
      expect(program.statements).to.have.length(1);
    });

    it("should parse: src.abc | :10:5-15 |= transform", () => {
      const program = assertParses("src.abc | :10:5-15 |= transpose 2");
      expect(program.statements).to.have.length(1);
    });

    it("should parse: src.abc | :10:5-12:20 |= transform", () => {
      const program = assertParses("src.abc | :10:5-12:20 |= transpose 2");
      expect(program.statements).to.have.length(1);
    });

    it("should parse standalone location selector: :5:10", () => {
      const program = assertParses(":5:10");
      expect(program.statements).to.have.length(1);
      const expr = program.statements[0];
      expect(isLocationSelector(expr)).to.be.true;
    });
  });

  describe("Filtering (Extract Subset)", () => {
    it("should parse: src.abc | @V:melody", () => {
      const program = assertParses("src.abc | @V:melody");
      expect(program.statements).to.have.length(1);
    });

    it("should parse: src.abc | @V:melody | @M:5-12", () => {
      const program = assertParses("src.abc | @V:melody | @M:5-12");
      expect(program.statements).to.have.length(1);
    });
  });

  describe("Selectors", () => {
    it("should parse short selectors: @c, @n, @r, @b, @v, @d, @m", () => {
      for (const sel of ["@c", "@n", "@r", "@b", "@v", "@d", "@m"]) {
        const program = assertParses(`src.abc | ${sel}`);
        expect(program.statements).to.have.length(1);
      }
    });

    it("should parse full selectors: @chords, @notes, @rests, @bars, @voices, @decorations, @measures", () => {
      for (const sel of [
        "@chords",
        "@notes",
        "@rests",
        "@bars",
        "@voices",
        "@decorations",
        "@measures",
      ]) {
        const program = assertParses(`src.abc | ${sel}`);
        expect(program.statements).to.have.length(1);
      }
    });

    it("should parse named selectors: @V:melody, @V:1, @M:5-8", () => {
      assertParses("src.abc | @V:melody");
      assertParses("src.abc | @V:1");
      assertParses("src.abc | @M:5-8");
    });
  });

  describe("Combining Files", () => {
    it("should parse: intro.abc + verse.abc + chorus.abc | @chords |= choralis 4", () => {
      const program = assertParses(
        "intro.abc + verse.abc + chorus.abc | @chords |= choralis 4"
      );
      expect(program.statements).to.have.length(1);
      const expr = program.statements[0];
      // The outer expression should be a pipe
      expect(isPipe(expr)).to.be.true;
    });
  });

  describe("Complex Arrangement", () => {
    it("should parse the complex arrangement example", () => {
      const input = `source = lead_sheet.abc

# Voice lead chords and distribute to strings
strings = source | @chords |= (choralis 4 | drop2 | distribute [V:vln1, V:vln2, V:vla, V:vc])

# Transpose melody for trumpet
trumpet = source | @V:melody | transpose 2

# Bass line from chord roots
bass = source | @chords | roots | transpose -12

# Combine (outputs concatenated result)
strings + trumpet + bass`;
      const program = assertParses(input);
      // 5 statements: 4 assignments + 1 expression
      expect(program.statements).to.have.length(5);
    });
  });

  describe("Conditional-like Patterns", () => {
    it("should parse: src.abc | @notes |= (filter (duration > 1/2) | transpose 2)", () => {
      const program = assertParses(
        "src.abc | @notes |= (filter (duration > 1/2) | transpose 2)"
      );
      expect(program.statements).to.have.length(1);
    });

    it("should parse comparison operators", () => {
      assertParses("x > 1");
      assertParses("x < 1");
      assertParses("x >= 1");
      assertParses("x <= 1");
      assertParses("x == 1");
      assertParses("x != 1");
    });
  });

  describe("Debugging", () => {
    it("should parse: src.abc | @chords |= (choralis 4 | debug | drop2)", () => {
      const program = assertParses(
        "src.abc | @chords |= (choralis 4 | debug | drop2)"
      );
      expect(program.statements).to.have.length(1);
    });
  });

  describe("File References", () => {
    it("should parse file with location: file.abc:10", () => {
      const program = assertParses("file.abc:10");
      expect(program.statements).to.have.length(1);
      const expr = program.statements[0];
      expect(isFileRef(expr)).to.be.true;
    });

    it("should parse file with line and column: file.abc:10:5", () => {
      const program = assertParses("file.abc:10:5");
      expect(program.statements).to.have.length(1);
    });

    it("should parse file with column range: file.abc:10:5-15", () => {
      const program = assertParses("file.abc:10:5-15");
      expect(program.statements).to.have.length(1);
    });

    it("should parse file with multi-line range: file.abc:10:5-12:20", () => {
      const program = assertParses("file.abc:10:5-12:20");
      expect(program.statements).to.have.length(1);
    });

    it("should parse file with selector: file.abc@chords", () => {
      const program = assertParses("file.abc@chords");
      expect(program.statements).to.have.length(1);
    });

    it("should parse file with location and selector: file.abc:10:5-15@chords", () => {
      const program = assertParses("file.abc:10:5-15@chords");
      expect(program.statements).to.have.length(1);
    });
  });

  describe("ABC Literals", () => {
    it("should parse ABC fence literal", () => {
      const program = assertParses("```abc\n[CEG][FAc][GBd]\n```");
      expect(program.statements).to.have.length(1);
      const expr = program.statements[0];
      expect(isAbcLiteral(expr)).to.be.true;
    });

    it("should parse ABC literal with various characters", () => {
      assertParses("```abc\nC D E F G A B c\n```");
      assertParses("```abc\n[CEG]2 [FAc]2\n```");
      assertParses("```abc\n| G2 | A2 |\n```");
    });
  });

  describe("Precedence", () => {
    it("should parse @chords |= f | g as (@chords |= f) | g", () => {
      const program = assertParses("@chords |= f | g");
      expect(program.statements).to.have.length(1);
      const expr = program.statements[0];
      // Outer should be pipe
      expect(isPipe(expr)).to.be.true;
      if (isPipe(expr)) {
        // Left side should be update
        expect(isUpdate(expr.left)).to.be.true;
        // Right side should be identifier
        expect(isIdentifier(expr.right)).to.be.true;
      }
    });

    it("should parse @chords |= (f | g) with grouped pipeline", () => {
      const program = assertParses("@chords |= (f | g)");
      expect(program.statements).to.have.length(1);
      const expr = program.statements[0];
      // Should be just an update (no outer pipe)
      expect(isUpdate(expr)).to.be.true;
      if (isUpdate(expr)) {
        // Transform should be a Group containing a Pipe (parentheses preserved)
        expect(isGroup(expr.transform)).to.be.true;
        if (isGroup(expr.transform)) {
          expect(isPipe(expr.transform.expr)).to.be.true;
        }
      }
    });

    it("should parse a + b | c as (a + b) | c", () => {
      const program = assertParses("a.abc + b.abc | c");
      expect(program.statements).to.have.length(1);
      const expr = program.statements[0];
      // Outer should be pipe
      expect(isPipe(expr)).to.be.true;
      if (isPipe(expr)) {
        // Left side should be concat
        expect(isConcat(expr.left)).to.be.true;
      }
    });
  });

  describe("Lists", () => {
    it("should parse empty list: []", () => {
      const program = assertParses("[]");
      expect(program.statements).to.have.length(1);
      expect(isList(program.statements[0])).to.be.true;
    });

    it("should parse single item list: [a]", () => {
      const program = assertParses("[a]");
      expect(program.statements).to.have.length(1);
    });

    it("should parse multi-item list: [a, b, c]", () => {
      const program = assertParses("[a, b, c]");
      expect(program.statements).to.have.length(1);
    });

    it("should parse nested expressions in list", () => {
      assertParses("[V:soprano, V:alto]");
      assertParses("[1, 2, 3]");
    });
  });

  describe("Logical Operators", () => {
    it("should parse: a and b", () => {
      const program = assertParses("a and b");
      expect(program.statements).to.have.length(1);
    });

    it("should parse: a or b", () => {
      const program = assertParses("a or b");
      expect(program.statements).to.have.length(1);
    });

    it("should parse: not a", () => {
      const program = assertParses("not a");
      expect(program.statements).to.have.length(1);
    });

    it("should parse: a and b or c", () => {
      assertParses("a and b or c");
    });

    it("should parse: not a and b", () => {
      assertParses("not a and b");
    });
  });

  describe("Comments", () => {
    it("should ignore line comments", () => {
      const program = assertParses(`# This is a comment
src.abc | @chords`);
      expect(program.statements).to.have.length(1);
    });

    it("should ignore inline comments", () => {
      const program = assertParses("src.abc | @chords # select chords");
      expect(program.statements).to.have.length(1);
    });
  });

  describe("Numbers", () => {
    it("should parse positive integers", () => {
      assertParses("transpose 2");
      assertParses("transpose 12");
    });

    it("should parse negative integers", () => {
      assertParses("transpose -12");
      assertParses("transpose -1");
    });

    it("should parse fractions", () => {
      assertParses("duration > 1/2");
      assertParses("duration == 3/4");
    });
  });
});
