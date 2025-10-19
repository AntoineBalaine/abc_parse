import chai, { assert } from "chai";
import { ABCContext } from "../parsers/Context";
import { ParseCtx, parseTune } from "../parsers/parse2";
import { Scanner2 } from "../parsers/scan2";
import { System } from "../types/Expr2";
import { AbcFormatter2 } from "../Visitors/Formatter2";

const expect = chai.expect;

function format(input: string, ctx: ABCContext, formatter: AbcFormatter2): string {
  const tokens = Scanner2(input, ctx);
  const parseCtx = new ParseCtx(tokens, ctx);
  const ast = parseTune(parseCtx);
  if (!ast) {
    throw new Error("Failed to parse");
  }
  return formatter.format(ast);
}

// Helper function to remove tune header for test assertions
function removeTuneHeader(testStr: string): string {
  return testStr.replace(/X:1\n/, "");
}

// Helper function for running system tests
function RunSystemTest(input: string, test: (systems: System[], expected: string) => void, expected: string): () => void {
  return () => {
    const ctx = new ABCContext();
    const formatter = new AbcFormatter2(ctx);
    const tokens = Scanner2(input, ctx);
    const parseCtx = new ParseCtx(tokens, ctx);
    const ast = parseTune(parseCtx);
    if (!ast || !ast.tune_body) {
      throw new Error("Failed to parse or no tune body");
    }
    test(ast.tune_body.sequence, expected);
  };
}

// Type for system line tests
type SystemLineTest = {
  title: string;
  test: (systems: System[] | string, expected: string) => void;
  input: string;
  expected: string;
};
describe("AbcFormatter2", () => {
  describe("AbcFormatter2.format() - single voice rules", () => {
    let formatter: AbcFormatter2;
    let ctx: ABCContext;

    beforeEach(() => {
      ctx = new ABCContext();
      formatter = new AbcFormatter2(ctx);
    });

    describe("basic spacing rules", () => {
      it("adds spaces around bar lines", () => {
        assert.equal(format("X:1\nCDEF|GABG|", ctx, formatter), "X:1\nCDEF | GABG |");
      });

      it("preserves beamed notes without internal spaces", () => {
        assert.equal(format("X:1\nCDEF GABG|", ctx, formatter), "X:1\nCDEF GABG |");
      });

      it("adds space after decoration", () => {
        assert.equal(format("X:1\n!p!CDEF|", ctx, formatter), "X:1\n!p! CDEF |");
      });
    });

    describe("edge cases", () => {
      it("handles multiple decorations", () => {
        assert.equal(format("X:1\n!p!!f!CDEF|", ctx, formatter), "X:1\n!p! !f! CDEF |");
      });

      it("handles grace notes", () => {
        assert.equal(format("X:1\n{ag}CDEF|", ctx, formatter), "X:1\n{ag}CDEF |");
      });

      it("handles inline fields", () => {
        assert.equal(format("X:1\n[K:C]CDEF|", ctx, formatter), "X:1\n[K:C] CDEF |");
      });

      it("preserves spaces in annotations", () => {
        assert.equal(format('X:1\n"swing feel"CDEF|', ctx, formatter), 'X:1\n"swing feel" CDEF |');
      });

      it("handles tuplets", () => {
        assert.equal(format("X:1\n(3CDE CDEF|", ctx, formatter), "X:1\n(3CDE CDEF |");
      });
    });

    describe("complex cases", () => {
      it("handles mix of beamed and single notes", () => {
        assert.equal(format("X:1\nCDEF G A|", ctx, formatter), "X:1\nCDEF G A |");
      });

      it("handles notes with rhythm", () => {
        assert.equal(format("X:1\nC2D/2E/2F|", ctx, formatter), "X:1\nC2D/E/F |");
      });

      it("handles broken rhythms", () => {
        assert.equal(format("X:1\nC>D E<F|", ctx, formatter), "X:1\nC>D E<F |");
      });
    });

    describe("special notations", () => {
      it("handles multi-measure rests", () => {
        assert.equal(format("X:1\nZ2|", ctx, formatter), "X:1\nZ2 |");
      });

      it("handles symbol decorations", () => {
        assert.equal(format("X:1\n!trill!C!turn!D|", ctx, formatter), "X:1\n!trill! C!turn!D |");
      });

      it("handles multiple voice markers in single voice", () => {
        assert.equal(format("X:1\n[V:1]CDEF|[V:1]GABG|", ctx, formatter), "X:1\n[V:1] CDEF | [V:1] GABG |");
      });
    });

    describe("comments and whitespace", () => {
      it("preserves end-of-line comments", () => {
        assert.equal(format("X:1\nCDEF|% comment\nGABG|", ctx, formatter), "X:1\nCDEF | % comment\nGABG |");
      });

      it("handles stylesheet directives", () => {
        const fmt = format("X:1\n%%score 1\nCDEF|", ctx, formatter);
        assert.equal(fmt, "X:1\n%%score 1\nCDEF |");
      });

      it("preserves empty lines", () => {
        assert.equal(format("X:1\nCDEF|\nGABG|", ctx, formatter), "X:1\nCDEF |\nGABG |");
      });
    });
    describe("info lines in tune body", () => {
      it("preserves info lines in tune body", () => {
        assert.equal(
          format(
            `X:1
CDEF|
T: hello
GABG|`,
            ctx,
            formatter
          ),
          `X:1
CDEF |
T: hello
GABG |`
        );
      });
    });
  });

  describe("AbcFormatter2 multi-voice alignment", () => {
    let formatter: AbcFormatter2;
    let ctx: ABCContext;

    beforeEach(() => {
      ctx = new ABCContext();
      formatter = new AbcFormatter2(ctx);
    });

    describe("AbcFormatter2 - voice lines with metadata", () => {
      let formatter: AbcFormatter2;
      let ctx: ABCContext;

      beforeEach(() => {
        ctx = new ABCContext();
        formatter = new AbcFormatter2(ctx);
      });

      describe("voice lines with metadata", () => {
        it("preserves metadata in voice declaration", () => {
          const result = format(
            `
X:1
V:1 clef=treble
V:2 clef=bass
V:1
CDEF|GABC|
V:2
CDEF|GABC|`,
            ctx,
            formatter
          );

          assert.equal(
            result,
            `X:1
V:1 clef=treble
V:2 clef=bass
V:1
CDEF | GABC |
V:2
CDEF | GABC |`
          );
        });

        it("preserves complex metadata and comments", () => {
          const result = format(
            `X:1
V:RH clef=treble octave=4 % right hand
V:LH clef=bass octave=3 % left hand
V:RH
CDEF|GABC|
V:LH
C,D,E,F,|G,A,B,C,|`,
            ctx,
            formatter
          );

          assert.equal(
            result,
            `X:1
V:RH clef=treble octave=4 % right hand
V:LH clef=bass octave=3 % left hand
V:RH
CDEF     | GABC     |
V:LH
C,D,E,F, | G,A,B,C, |`
          );
        });

        it("handles voice names with spaces and metadata", () => {
          const result = format(
            `X:1
V:Right_Hand clef=treble % treble staff
V:Left_Hand clef=bass % bass staff
V:Right_Hand
CDEF|GABC|
V:Left_Hand
CDEF|GABC|`,
            ctx,
            formatter
          );

          assert.equal(
            result,
            `X:1
V:Right_Hand clef=treble % treble staff
V:Left_Hand clef=bass % bass staff
V:Right_Hand
CDEF | GABC |
V:Left_Hand
CDEF | GABC |`
          );
        });

        it("formats voice line with multiple key=value pairs without spaces around =", () => {
          const result = format(
            `X:1
V:RH clef=treble
V:LH clef=bass octave=-2
V:RH
CDEF|
V:LH
C,D,|`,
            ctx,
            formatter
          );

          assert.equal(
            result,
            `X:1
V:RH clef=treble
V:LH clef=bass octave=-2
V:RH
CDEF |
V:LH
C,D, |`
          );
        });
      });
    });

    describe("basic bar alignment", () => {
      it("aligns simple bars of equal length", () => {
        const result = format(
          `X:1
V:1
V:2
V:1
   CDEF|    GABC|
V:2
CDEF|GABC|`,
          ctx,
          formatter
        );

        assert.equal(
          result,
          `X:1
V:1
V:2
V:1
CDEF | GABC |
V:2
CDEF | GABC |`
        );
      });

      it("aligns bars of different lengths", () => {
        const result = format(
          `X:1
V:1
V:2
V:1
CD|GABC|
V:2
CDEF|GA|`,
          ctx,
          formatter
        );

        assert.equal(
          result,
          `X:1
V:1
V:2
V:1
CD   | GABC |
V:2
CDEF | GA   |`
        );
      });

      it("aligns bars with chords", () => {
        const result = format(
          `X:1
V:1
V:2
V:1
[CEG]D|GABC|
V:2
   CDEF|GABC|`,
          ctx,
          formatter
        );

        assert.equal(
          result,
          `X:1
V:1
V:2
V:1
[CEG]D | GABC |
V:2
CDEF   | GABC |`
        );
      });
    });

    describe("complex alignments", () => {
      it("aligns bars with decorations and grace notes", () => {
        const result = format(
          `X:1
V:1
V:2
V:1
!p!C {ag}D|GABC|
V:2
C DEF|GABC|`,
          ctx,
          formatter
        );

        assert.equal(
          result,
          `X:1
V:1
V:2
V:1
!p! C {ag}D   | GABC |
V:2
    C     DEF | GABC |`
        );
      });

      it("aligns bars with different note lengths", () => {
        const result = format(
          `X:1
V:1
V:2
V:1
C2D2|GABC|
V:2
CDEF|GABC|`,
          ctx,
          formatter
        );

        assert.equal(
          result,
          `X:1
V:1
V:2
V:1
C2D2 | GABC |
V:2
CDEF | GABC |`
        );
      });

      it("aligns bars with tuplets", () => {
        const result = format(
          `X:1
V:1
V:2
V:1
(3CDE CDEF|GABC|
V:2
CDEF|GABC|`,
          ctx,
          formatter
        );

        assert.equal(
          result,
          `X:1
V:1
V:2
V:1
(3CDE CDEF | GABC |
V:2
  CDEF     | GABC |`
        );
      });
      it("aligns bars that start with annotations", () => {
        const result = format(
          `X:1
V:1
V:2
V:1
"hello"CDEF|GABC|"again" DE
V:2
CDEF|"world"GABC|DE`,
          ctx,
          formatter
        );

        assert.equal(
          result,
          `X:1
V:1
V:2
V:1
"hello" CDEF |         GABC | "again" DE
V:2
        CDEF | "world" GABC |         DE`
        );
      });
    });

    describe("multi-measure rests", () => {
      it("aligns with expanded multi-measure rests", () => {
        const result = format(
          `X:1
V:1
V:2
V:1
Z4|
V:2
CDEF|GABC|CDEF|GABC|`,
          ctx,
          formatter
        );

        assert.equal(
          result,
          `X:1
V:1
V:2
V:1
Z    | Z    | Z    | Z    |
V:2
CDEF | GABC | CDEF | GABC |`
        );
      });
    });

    describe("edge cases", () => {
      it("handles empty bars", () => {
        const result = format(
          `X:1
V:1
V:2
V:1
CDEF| GABC| CDE
V:2
CDEF| |GABC|`,
          ctx,
          formatter
        );

        assert.equal(
          result,
          `X:1
V:1
V:2
V:1
CDEF | GABC | CDE
V:2
CDEF |      | GABC |`
        );
      });

      it("handles different numbers of bars per voice in a system", () => {
        const result = format(
          `X:1
V:1
V:2
V:3
V:1
CDEF|GABC|
V:2
CDEF|GABC|
V:3
CDEF|`,
          ctx,
          formatter
        );

        assert.equal(
          result,
          `X:1
V:1
V:2
V:3
V:1
CDEF | GABC |
V:2
CDEF | GABC |
V:3
CDEF |`
        );
      });

      it("preserves comments between voices", () => {
        const result = format(
          `X:1
V:1
V:2
V:1
CDEF|GABC|
% middle comment
V:2
CDEF|GABC|`,
          ctx,
          formatter
        );

        assert.equal(
          result,
          `X:1
V:1
V:2
V:1
CDEF | GABC |
% middle comment
V:2
CDEF | GABC |`
        );
      });

      it("handles bars with mixed note groupings", () => {
        const result = format(
          `X:1
V:1
V:2
V:1
CDEF GABC|CDEF|
V:2
CD EF GA|CDEF|`,
          ctx,
          formatter
        );

        assert.equal(
          result,
          `X:1
V:1
V:2
V:1
CDEF  GABC | CDEF |
V:2
CD EF GA   | CDEF |`
        );
      });
    });
  });

  describe("AbcFormatter2 - unmarked lines in multi-voice tunes", () => {
    let formatter: AbcFormatter2;
    let ctx: ABCContext;

    beforeEach(() => {
      ctx = new ABCContext();
      formatter = new AbcFormatter2(ctx);
    });

    it("preserves unmarked lines before voiced content", () => {
      const result = format(
        `X:1
% setup comment
This is some text
K:C
% another comment
V:1 name=voice1
V:2 name=voice2
CDEF|GABC|
EDC2|GFE2|
V:2
CDEF|GABC|`,
        ctx,
        formatter
      );

      assert.equal(
        result,
        `X:1
% setup comment
This is some text
K:C
% another comment
V:1 name=voice1
V:2 name=voice2
CDEF | GABC |
EDC2 | GFE2 |
V:2
CDEF | GABC |`
      );
    });
    it("preserves unmarked lines and line breaks", () => {
      const result = format(
        `X:1
V:SnareDrum stem=up
V:2 stem=up
K:C clef=perc stafflines=1
B8 z8 | 
CDEF|GABC|`,
        ctx,
        formatter
      );

      assert.equal(
        result,
        `X:1
V:SnareDrum stem=up
V:2 stem=up
K:C clef=perc stafflines=1
B8 z8 |
CDEF | GABC |`
      );
    });
  });
});

describe("Format Info Lines in Tune Header", function () {
  const SystemLineTests: SystemLineTest[] = [
    {
      title: "format a tune header containing info lines only",
      test: (input, expected) => {
        const ctx = new ABCContext();
        const tokens = Scanner2(input as string, ctx);
        const parseCtx = new ParseCtx(tokens, ctx);
        const ast = parseTune(parseCtx);
        if (!ast) {
          throw new Error("Failed to parse");
        }
        const formatter = new AbcFormatter2(ctx);
        const fmt = formatter.visitTuneHeaderExpr(ast.tune_header);
        expect(fmt).to.not.be.undefined;
        assert.equal(fmt, expected);
      },
      input: `X:1
M:4/4
L:1/8
K:C
`,
      expected: `X:1
M:4/4
L:1/8
K:C`,
    },
    {
      title: "format a tune header containing comments",
      test: (input, expected) => {
        const ctx = new ABCContext();
        const tokens = Scanner2(input as string, ctx);
        const parseCtx = new ParseCtx(tokens, ctx);
        const ast = parseTune(parseCtx);
        if (!ast) {
          throw new Error("Failed to parse");
        }
        const formatter = new AbcFormatter2(ctx);
        const fmt = formatter.visitTuneHeaderExpr(ast.tune_header);
        expect(fmt).to.not.be.undefined;
        assert.equal(fmt, expected);
      },
      input: `X:1
M:4/4
L:1/8
%surprise
K:C
`,
      expected: `X:1
M:4/4
L:1/8
%surprise
K:C`,
    },
  ];

  SystemLineTests.forEach(({ title, test, input, expected }) => {
    it(title, () => {
      test(input, expected);
    });
  });
});

describe("Format Info Lines in Tune Body", function () {
  const SystemLineTests: SystemLineTest[] = [
    {
      title: "format a tune body containing info lines",
      test: (input, expected) => {
        const ctx = new ABCContext();
        const tokens = Scanner2(input as string, ctx);
        const parseCtx = new ParseCtx(tokens, ctx);
        const ast = parseTune(parseCtx);
        if (!ast || !ast.tune_body) {
          throw new Error("Failed to parse or no tune body");
        }
        const formatter = new AbcFormatter2(ctx);
        const fmt = formatter.visitTuneBodyExpr(ast.tune_body);
        expect(fmt).to.not.be.undefined;
        assert.equal(fmt, expected);
      },
      input: `X:1
abc
M:4/4
L:1/8
K:C
`,
      expected: `abc
M:4/4
L:1/8
K:C
`,
    },
  ];

  SystemLineTests.forEach(({ title, test, input, expected }) => {
    it(title, () => {
      test(input, expected);
    });
  });
});

describe("Formatter2", function () {
  describe("formats text", function () {
    const input = "X:1\n[V:T1] (B2c2 d2g2)   | f6e2   |   (d2c2 d2)e2 | d4 c2z2 |";
    const expected_no_format = "[V:T1] (B2c2 d2g2)   | f6e2   |   (d2c2 d2)e2 | d4 c2z2 |";
    const expected_fmt = "[V:T1] (B2c2 d2g2) | f6e2 | (d2c2 d2)e2 | d4 c2 z2 |";

    it("can visit the tree without modifying source", function () {
      const ctx = new ABCContext();
      const tokens = Scanner2(input, ctx);
      const parseCtx = new ParseCtx(tokens, ctx);
      const ast = parseTune(parseCtx);
      if (!ast) {
        throw new Error("Failed to parse");
      }
      const fmt = new AbcFormatter2(ctx).stringify(ast);
      assert.equal(removeTuneHeader(fmt).trim(), expected_no_format);
    });

    it("removes useless double spaces", function () {
      const ctx = new ABCContext();
      const tokens = Scanner2(input, ctx);
      const parseCtx = new ParseCtx(tokens, ctx);
      const ast = parseTune(parseCtx);
      if (!ast) {
        throw new Error("Failed to parse");
      }
      const fmt = new AbcFormatter2(ctx).format(ast);
      assert.equal(removeTuneHeader(fmt).trim(), expected_fmt);
    });
  });
});

describe("Formatter2: Stringify", () => {
  describe("stringify grace groups", () => {
    const sample = [
      ["X:1\n{b}c", "{b}c"],
      ["X:1\n{/b}c", "{/b}c"],
    ];
    sample.forEach(([input, expected]) => {
      it(`should stringify ${input} into ${expected}`, () => {
        const ctx = new ABCContext();
        const tokens = Scanner2(input, ctx);
        const parseCtx = new ParseCtx(tokens, ctx);
        const ast = parseTune(parseCtx);
        if (!ast) {
          throw new Error("Failed to parse");
        }
        const fmt = new AbcFormatter2(ctx).stringify(ast);
        assert.equal(removeTuneHeader(fmt).trim(), expected);
      });
    });
  });

  describe("stringify notes with ties", () => {
    const sample = [["X:1\na-", "a-"]];
    sample.forEach(([input, expected]) => {
      it(`should stringify ${input} into ${expected}`, () => {
        const ctx = new ABCContext();
        const tokens = Scanner2(input, ctx);
        const parseCtx = new ParseCtx(tokens, ctx);
        const ast = parseTune(parseCtx);
        if (!ast) {
          throw new Error("Failed to parse");
        }
        const fmt = new AbcFormatter2(ctx).stringify(ast);
        assert.equal(removeTuneHeader(fmt).trim(), expected);
      });
    });
  });
});

describe("Formatter2: Whitespace handling", () => {
  const errorSamples = [
    {
      title: "removes trailing whitespaces",
      input: "X:1\nab | \\   ",
      expected: "ab | \\",
    },
    {
      title: "handles slurs correctly",
      input: "X:1\na| (d4 e2)|",
      expected: "a | (d4 e2) |",
    },
  ];

  describe("using format()", () => {
    errorSamples.forEach(({ title, input, expected }) => {
      it(title, () => {
        const ctx = new ABCContext();
        const formatter = new AbcFormatter2(ctx);
        const tokens = Scanner2(input, ctx);
        const parseCtx = new ParseCtx(tokens, ctx);
        const ast = parseTune(parseCtx);
        if (!ast) {
          throw new Error("Failed to parse");
        }
        const result = formatter.format(ast);
        assert.equal(removeTuneHeader(result).trim(), expected);
      });
    });
  });
});

describe("Formatter2: Error Preservation", () => {
  const errorSamples = [
    {
      title: "preserves invalid decoration",
      input: "X:1\n~23 abc",
      expected: "~23 abc",
    },
    {
      title: "preserves invalid escaped character",
      input: "X:1\nabc \\e def",
      expected: "abc \\e def",
    },
    {
      title: "preserves error tokens while formatting valid parts",
      input: "X:1\nabc ~23 | def",
      expected: "abc ~23 | def",
    },
    {
      title: "removes trailing whitespaces",
      input: "X:1\nab | \\   ",
      expected: "ab | \\",
    },
    { title: "error at end of input", input: "X:1\nabcî", expected: "abcî", fmt_expected: "abc î" },
  ];

  // Test both stringify and format methods
  describe("using stringify()", () => {
    errorSamples.forEach(({ title, input, expected }) => {
      it(title, () => {
        const ctx = new ABCContext();
        const formatter = new AbcFormatter2(ctx);
        const tokens = Scanner2(input, ctx);
        const parseCtx = new ParseCtx(tokens, ctx);
        const ast = parseTune(parseCtx);
        if (!ast) {
          throw new Error("Failed to parse");
        }
        const result = formatter.stringify(ast);
        assert.equal(removeTuneHeader(result).trim(), expected);
      });
    });
  });

  describe("using format()", () => {
    errorSamples.forEach(({ title, input, expected, fmt_expected }) => {
      it(title, () => {
        const ctx = new ABCContext();
        const formatter = new AbcFormatter2(ctx);
        const tokens = Scanner2(input, ctx);
        const parseCtx = new ParseCtx(tokens, ctx);
        const ast = parseTune(parseCtx);
        if (!ast) {
          throw new Error("Failed to parse");
        }
        const result = formatter.format(ast);
        assert.equal(removeTuneHeader(result).trim(), fmt_expected ?? expected);
      });
    });
  });

  // Test that errors are preserved even in complex contexts
  it("preserves errors in multi-voice context", () => {
    const input = `X:1\n[V:1]abc ~23 |\n[V:2]def \\e |\n`;
    const expected = `[V:1] abc ~23 |\n[V:2] def \\e |`;

    const ctx = new ABCContext();
    const formatter = new AbcFormatter2(ctx);
    const tokens = Scanner2(input, ctx);
    const parseCtx = new ParseCtx(tokens, ctx);
    const ast = parseTune(parseCtx);
    if (!ast) {
      throw new Error("Failed to parse");
    }
    const result = formatter.format(ast);
    assert.equal(removeTuneHeader(result).trim(), expected);
  });

  // Test that error nodes don't break formatting of surrounding valid code
  it("maintains formatting of valid code around errors", () => {
    const input = "X:1\nabc  ~23  def  |  ghi";
    const expected = "abc ~23 def | g hi";

    const ctx = new ABCContext();
    const formatter = new AbcFormatter2(ctx);
    const tokens = Scanner2(input, ctx);
    const parseCtx = new ParseCtx(tokens, ctx);
    const ast = parseTune(parseCtx);
    if (!ast) {
      throw new Error("Failed to parse");
    }
    const result = formatter.format(ast);
    assert.equal(removeTuneHeader(result).trim(), expected);
  });
});
