import { expect } from "chai";
import { ABCContext } from "../parsers/Context";
import { parse } from "../parsers/parse2";
import { Scanner } from "../parsers/scan2";
import { File_structure, Tune } from "../types/Expr2";
import { AbcFormatter } from "../Visitors/Formatter2";

function parseFile(input: string, ctx: ABCContext): File_structure {
  const tokens = Scanner(input, ctx);
  return parse(tokens, ctx);
}

describe("Formatter voice-markers configuration", () => {
  let formatter: AbcFormatter;
  let ctx: ABCContext;

  beforeEach(() => {
    ctx = new ABCContext();
    formatter = new AbcFormatter(ctx);
  });

  describe("infoline to inline conversion", () => {
    it("converts V:1 info line to [V:1] inline when voice-markers=inline", () => {
      const input = `X:1
%%abcls-fmt voice-markers=inline
K:C
V:1
CDEF|`;

      const ast = parseFile(input, ctx);
      const result = formatter.formatFile(ast);

      expect(result).to.include("[V:1]");
      expect(result).to.not.match(/V:1\n/);
    });

    it("converts V:1 with parameters to [V:1 params] inline", () => {
      const input = `X:1
%%abcls-fmt voice-markers=inline
K:C
V:1 clef=bass
CDEF|`;

      const ast = parseFile(input, ctx);
      const result = formatter.formatFile(ast);

      expect(result).to.include("[V:1 clef=bass]");
    });

    it("converts multiple V: info lines to inline fields", () => {
      const input = `X:1
V:1
V:2
%%abcls-fmt voice-markers=inline
K:C
V:1
CDEF|
V:2
GABC|`;

      const ast = parseFile(input, ctx);
      const result = formatter.formatFile(ast);

      expect(result).to.include("[V:1]");
      expect(result).to.include("[V:2]");
    });
  });

  describe("inline to infoline conversion", () => {
    it("converts [V:1] inline to V:1 info line when voice-markers=infoline", () => {
      const input = `X:1
%%abcls-fmt voice-markers=infoline
K:C
[V:1] CDEF|`;

      const ast = parseFile(input, ctx);
      const result = formatter.formatFile(ast);

      expect(result).to.match(/V:1\n/);
      expect(result).to.not.include("[V:1]");
    });

    it("converts [V:1 params] inline to V:1 params info line", () => {
      const input = `X:1
%%abcls-fmt voice-markers=infoline
K:C
[V:1 clef=treble] CDEF|`;

      const ast = parseFile(input, ctx);
      const result = formatter.formatFile(ast);

      expect(result).to.include("V:1 clef=treble");
      expect(result).to.not.include("[V:1");
    });

    it("converts multiple [V:] inline fields to info lines", () => {
      const input = `X:1
V:1
V:2
%%abcls-fmt voice-markers=infoline
K:C
[V:1] CDEF|
[V:2] GABC|`;

      const ast = parseFile(input, ctx);
      const result = formatter.formatFile(ast);

      // Because the formatting adds bar spacing, we look for V:1 and V:2 patterns
      expect(result).to.match(/V:1\n/);
      expect(result).to.match(/V:2\n/);
      expect(result).to.not.include("[V:1]");
      expect(result).to.not.include("[V:2]");
    });
  });

  describe("no conversion when style matches or no directive", () => {
    it("preserves infoline when no directive is present", () => {
      const input = `X:1
K:C
V:1
CDEF|`;

      const ast = parseFile(input, ctx);
      const result = formatter.formatFile(ast);

      // V:1 should still be present as infoline
      expect(result).to.match(/V:1\n/);
    });

    it("preserves inline when no directive is present", () => {
      const input = `X:1
K:C
[V:1] CDEF|`;

      const ast = parseFile(input, ctx);
      const result = formatter.formatFile(ast);

      // [V:1] should still be present as inline
      expect(result).to.include("[V:1]");
    });

    it("keeps infoline when voice-markers=infoline is set", () => {
      const input = `X:1
%%abcls-fmt voice-markers=infoline
K:C
V:1
CDEF|`;

      const ast = parseFile(input, ctx);
      const result = formatter.formatFile(ast);

      // Should still have V:1 as infoline
      expect(result).to.match(/V:1\n/);
    });

    it("keeps inline when voice-markers=inline is set", () => {
      const input = `X:1
%%abcls-fmt voice-markers=inline
K:C
[V:1] CDEF|`;

      const ast = parseFile(input, ctx);
      const result = formatter.formatFile(ast);

      // Should still have [V:1] as inline
      expect(result).to.include("[V:1]");
    });
  });

  describe("file-level directive inheritance", () => {
    it("applies file-level directive to all tunes", () => {
      const input = `%%abcls-fmt voice-markers=inline

X:1
K:C
V:1
CDEF|

X:2
K:G
V:2
GABG|`;

      const ast = parseFile(input, ctx);
      const result = formatter.formatFile(ast);

      // Both tunes should have inline voice markers
      expect(result).to.include("[V:1]");
      expect(result).to.include("[V:2]");
    });

    it("allows tune-level directive to override file-level", () => {
      const input = `%%abcls-fmt voice-markers=inline

X:1
%%abcls-fmt voice-markers=infoline
K:C
[V:1] CDEF|`;

      const ast = parseFile(input, ctx);
      const result = formatter.formatFile(ast);

      // Tune-level directive says infoline, so [V:1] should be converted to V:1
      expect(result).to.match(/V:1\n/);
      expect(result).to.not.include("[V:1]");
    });
  });

  describe("edge cases", () => {
    it("handles tune with no voice markers", () => {
      const input = `X:1
%%abcls-fmt voice-markers=inline
K:C
CDEF|GABC|`;

      const ast = parseFile(input, ctx);
      const result = formatter.formatFile(ast);

      // Should format without error
      expect(result).to.include("CDEF");
      expect(result).to.include("GABC");
    });

    it("preserves non-voice inline fields", () => {
      const input = `X:1
%%abcls-fmt voice-markers=infoline
K:C
[V:1] CD [L:1/4] EF|`;

      const ast = parseFile(input, ctx);
      const result = formatter.formatFile(ast);

      // V:1 should be converted to infoline
      expect(result).to.match(/V:1\n/);
      // L:1/4 should remain as inline
      expect(result).to.include("[L:");
    });

    it("preserves non-voice info lines", () => {
      const input = `X:1
%%abcls-fmt voice-markers=inline
K:C
V:1
L:1/8
CDEF|`;

      const ast = parseFile(input, ctx);
      const result = formatter.formatFile(ast);

      // V:1 should be converted to inline
      expect(result).to.include("[V:1]");
      // L:1/8 should remain as info line
      expect(result).to.include("L:");
    });
  });
});
