import { assert } from "chai";
import { Comment, Inline_field } from "../types/Expr2";
import { System } from "../types/Expr2";
import { Scanner2 } from "../parsers/scan2";
import { parseTune } from "../parsers/parse2";
import { ABCContext } from "../parsers/Context";
import { AbcFormatter2 } from "../Visitors/Formatter2";

function format(input: string, ctx: ABCContext, formatter: AbcFormatter2): string {
  const tokens = Scanner2(input, ctx.errorReporter);
  const ast = parseTune(tokens, ctx);
  if (!ast) {
    throw new Error("Failed to parse");
  }
  return formatter.format(ast);
}
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
        assert.equal(format("X:1\n(3CDE CDEF|", ctx, formatter), "X:1\n(3 CDE CDEF |");
      });
    });

    describe("complex cases", () => {
      it("handles mix of beamed and single notes", () => {
        assert.equal(format("X:1\nCDEF G A|", ctx, formatter), "X:1\nCDEF G A |");
      });

      it("handles notes with rhythm", () => {
        assert.equal(format("X:1\nC2D/2E/2F|", ctx, formatter), "X:1\nC2D/2E/2F |");
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
        assert.equal(format("X:1\n%%score 1\nCDEF|", ctx, formatter), "X:1\n%%score 1\nCDEF |");
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
W: hello
GABG|`,
            ctx,
            formatter
          ),
          `X:1
CDEF |
W: hello
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
V:Right Hand clef=treble % treble staff
V:Left Hand clef=bass % bass staff
V:Right Hand
CDEF|GABC|
V:Left Hand
CDEF|GABC|`,
            ctx,
            formatter
          );

          assert.equal(
            result,
            `X:1
V:Right Hand clef=treble % treble staff
V:Left Hand clef=bass % bass staff
V:Right Hand
CDEF | GABC |
V:Left Hand
CDEF | GABC |`
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
(3 CDE CDEF | GABC |
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
