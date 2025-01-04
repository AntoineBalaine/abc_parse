import { assert } from "chai";
import { Music_code, Comment, Inline_field } from "../types/Expr";
import { System } from "../types/types";
import { Scanner } from "../parsers/Scanner";
import { Parser } from "../parsers/Parser";
import { ABCContext } from "../parsers/Context";
import { AbcFormatter } from "../Visitors/Formatter";

describe.skip("splitIntoVoices", () => {
  it("splits a simple two-voice system", () => {
    // Create tokens/expressions for a simple two-voice system
    const sample = `X:1
V:RH clef=treble
V:LH clef=bass
K:C
[V: RH]C|
[V: LH]G|`;
    const ctx = new ABCContext();
    const parse = new Parser(new Scanner(sample, ctx).scanTokens(), ctx).parse();
    const system: System = parse!.tune[0].tune_body!.sequence[0];

    const result = splitIntoVoices(system);

    assert.equal(result.length, 2, "Should split into two voices");

    // Check first voice
    assert.equal(result[0].length, 3, "First voice should have 3 elements");
    assert.isTrue(result[0][0] instanceof Inline_field, "Should start with voice marker");
    assert.isTrue(result[0][1] instanceof Music_code, "Should contain music");

    // Check second voice
    assert.equal(result[1].length, 3, "Second voice should have 2 elements");
    assert.isTrue(result[1][0] instanceof Inline_field, "Should start with voice marker");
    assert.isTrue(result[1][1] instanceof Music_code, "Should contain music");
  });

  it("handles comments in voices", () => {
    const sample = `X:1\nV:RH clef=treble\nK:C`;
    const ctx = new ABCContext();
    const parse = new Parser(new Scanner(sample, ctx).scanTokens(), ctx).parse();
    const system: System = parse!.tune[0].tune_body!.sequence[0];

    const result = splitIntoVoices(system);

    assert.equal(result.length, 1, "Should keep as one voice");
    assert.equal(result[0].length, 3, "Should contain voice marker, comment, and music");
    assert.isTrue(result[0][1] instanceof Comment, "Should preserve comment");
  });

  it("handles standalone comments between voices", () => {
    const sample = `X:1
V:RH clef=treble
V:LH clef=bass
K:C
[V: RH]C|
% between voices
[V: LH]G|`;
    const ctx = new ABCContext();
    const parse = new Parser(new Scanner(sample, ctx).scanTokens(), ctx).parse();
    const system: System = parse!.tune[0].tune_body!.sequence[0];

    const result = splitIntoVoices(system);

    assert.equal(result.length, 3, "Should split into three parts");
    assert.isTrue(result[1][0] instanceof Comment, "Middle part should be comment");
  });

  it("handles empty voice markers", () => {
    const sample = `X:1
V:RH clef=treble
V:LH clef=bass
K:C
[V: RH]
[V: LH]G|
`;
    const ctx = new ABCContext();
    const parse = new Parser(new Scanner(sample, ctx).scanTokens(), ctx).parse();
    const system: System = parse!.tune[0].tune_body!.sequence[0];

    const result = splitIntoVoices(system);

    assert.equal(result.length, 2, "Should create two voices");
    assert.equal(result[0].length, 2, "First voice should have marker and EOL");
  });
});
function splitIntoVoices(system: System): any {
  throw new Error("Function not implemented.");
}

describe("AbcFormatter.format() - single voice rules", () => {
  let formatter: AbcFormatter;
  let ctx: ABCContext;

  beforeEach(() => {
    ctx = new ABCContext();
    formatter = new AbcFormatter(ctx);
  });

  function format(input: string): string {
    const scanner = new Scanner(input, ctx);
    const tokens = scanner.scanTokens();
    const parser = new Parser(tokens, ctx);
    const ast = parser.parse();
    if (!ast) {
      throw new Error("Failed to parse");
    }
    return formatter.format(ast);
  }

  describe("basic spacing rules", () => {
    it("adds spaces around bar lines", () => {
      assert.equal(format("X:1\nCDEF|GABG|"), "X:1\nCDEF | GABG |");
    });

    it("preserves beamed notes without internal spaces", () => {
      assert.equal(format("X:1\nCDEF GABG|"), "X:1\nCDEF GABG |");
    });

    it("adds space after decoration", () => {
      assert.equal(format("X:1\n!p!CDEF|"), "X:1\n!p! CDEF |");
    });
  });

  describe("edge cases", () => {
    it("handles multiple decorations", () => {
      assert.equal(format("X:1\n!p!!f!CDEF|"), "X:1\n!p! !f! CDEF |");
    });

    it("handles grace notes", () => {
      assert.equal(format("X:1\n{ag}CDEF|"), "X:1\n{ag} CDEF |");
    });

    it("handles inline fields", () => {
      assert.equal(format("X:1\n[K:C]CDEF|"), "X:1\n[K:C] CDEF |");
    });

    it("preserves spaces in annotations", () => {
      assert.equal(format('X:1\n"swing feel"CDEF|'), 'X:1\n"swing feel" CDEF |');
    });

    it.skip("handles tuplets", () => {
      assert.equal(format("X:1\n(3 CDE CDEF|"), "X:1\n(3CDE CDEF |");
    });
  });

  describe("complex cases", () => {
    it("handles mix of beamed and single notes", () => {
      assert.equal(format("X:1\nCDEF G A|"), "X:1\nCDEF G A |");
    });

    it("handles notes with rhythm", () => {
      assert.equal(format("X:1\nC2D/2E/2F|"), "X:1\nC2D/2E/2F |");
    });

    it("handles broken rhythms", () => {
      assert.equal(format("X:1\nC>D E<F|"), "X:1\nC>D E<F |");
    });
  });

  describe("special notations", () => {
    it("handles multi-measure rests", () => {
      assert.equal(format("X:1\nZ2|"), "X:1\nZ2 |");
    });

    it.skip("handles symbol decorations", () => {
      assert.equal(format("X:1\n!trill!C!turn!D|"), "X:1\n!trill! C !turn! D |");
    });

    it("handles multiple voice markers in single voice", () => {
      assert.equal(format("X:1\n[V:1]CDEF|[V:1]GABG|"), "X:1\n[V:1] CDEF | [V:1] GABG |");
    });
  });

  describe("comments and whitespace", () => {
    it("preserves end-of-line comments", () => {
      assert.equal(format("X:1\nCDEF|% comment\nGABG|"), "X:1\nCDEF | % comment\nGABG |");
    });

    it("handles stylesheet directives", () => {
      assert.equal(format("X:1\n%%score 1\nCDEF|"), "X:1\n%%score 1\nCDEF |");
    });

    it("preserves empty lines", () => {
      assert.equal(format("X:1\nCDEF|\nGABG|"), "X:1\nCDEF |\nGABG |");
    });
  });
  describe("info lines in tune body", () => {
    it("preserves info lines in tune body", () => {
      assert.equal(
        format(`X:1
CDEF|
W: hello
GABG|`),
        `X:1
CDEF |
W: hello
GABG |`
      );
    });
  });
});

describe("AbcFormatter multi-voice alignment", () => {
  let formatter: AbcFormatter;
  let ctx: ABCContext;

  beforeEach(() => {
    ctx = new ABCContext();
    formatter = new AbcFormatter(ctx);
  });

  function format(input: string): string {
    const scanner = new Scanner(input, ctx);
    const tokens = scanner.scanTokens();
    const parser = new Parser(tokens, ctx);
    const ast = parser.parse();
    if (!ast) {
      throw new Error("Failed to parse");
    }
    return formatter.format(ast);
  }

  describe("basic bar alignment", () => {
    it("aligns simple bars of equal length", () => {
      const result = format(`
X:1
V:1
V:2
V:1
CDEF|GABC|
V:2
CDEF|GABC|`);

      assert.equal(
        result,
        `
X:1
V:1
CDEF | GABC |
V:2
CDEF | GABC |`
      );
    });

    it("aligns bars of different lengths", () => {
      const result = format(`
X:1
V:1
V:2
V:1
CD|GABC|
V:2
CDEF|GA|`);

      assert.equal(
        result,
        `
X:1
V:1
V:2
V:1
CD   | GABC |
V:2
CDEF | GA   |`
      );
    });

    it("aligns bars with chords", () => {
      const result = format(`
X:1
V:1
[CEG]D|GABC|
V:2
CDEF|GABC|`);

      assert.equal(
        result,
        `
X:1
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
      const result = format(`
X:1
V:1
V:2
V:1
!p!C{ag}D|GABC|
V:2
CDEF|GABC|`);

      assert.equal(
        result,
        `
X:1
V:1
V:2
V:1
!p!C{ag}D | GABC |
V:2
CDEF      | GABC |`
      );
    });

    it("aligns bars with different note lengths", () => {
      const result = format(`
X:1
V:1
V:2
V:1
C2D2|GABC|
V:2
CDEF|GABC|`);

      assert.equal(
        result,
        `
X:1
V:1
V:2
V:1
C2D2 | GABC |
V:2
CDEF | GABC |`
      );
    });

    it("aligns bars with tuplets", () => {
      const result = format(`
X:1
V:1
V:2
V:1
(3CDECDEF|GABC|
V:2
CDEF|GABC|`);

      assert.equal(
        result,
        `
X:1
V:1
V:2
V:1
(3CDECDEF | GABC |
V:2
CDEF      | GABC |`
      );
    });
  });

  describe("multi-measure rests", () => {
    it("aligns with expanded multi-measure rests", () => {
      const result = format(`
X:1
V:1
V:2
V:1
Z4|
V:2
CDEF|GABC|CDEF|GABC|`);

      assert.equal(
        result,
        `
X:1
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
      const result = format(`
X:1
V:1
V:2
V:1
CDEF||GABC|
V:2
CDEF||GABC|`);

      assert.equal(
        result,
        `
X:1
V:1
V:2
V:1
CDEF | | GABC |
V:2
CDEF | | GABC |`
      );
    });

    it("handles different numbers of voices per system", () => {
      const result = format(`
X:1
V:1
V:2
V:1
CDEF|GABC|
V:2
CDEF|GABC|
V:3
CDEF|`);

      assert.equal(
        result,
        `
X:1
V:1
V:2
V:1
CDEF | GABC |
V:2
CDEF | GABC |
V:3
CDEF |`
      );
    });

    it("preserves comments between voices", () => {
      const result = format(`
X:1
V:1
V:2
V:1
CDEF|GABC|
% middle comment
V:2
CDEF|GABC|`);

      assert.equal(
        result,
        `
X:1
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
      const result = format(`
X:1
V:1
V:2
V:1
CDEF GABC|CDEF|
V:2
CD EF GA|CDEF|`);

      assert.equal(
        result,
        `
X:1
V:1
V:2
V:1
CDEF GABC | CDEF |
V:2
CD EF GA  | CDEF |`
      );
    });
  });
});
