import { expect } from "chai";
import { ABCContext } from "../parsers/Context";
import { Scanner } from "../parsers/scan2";
import { parse } from "../parsers/parse2";
import { Tune, Tune_Body } from "../types/Expr2";
import { AbcFormatter } from "./Formatter2";
import { VoiceMarkerStyleVisitor } from "./VoiceMarkerStyleVisitor";

/**
 * Helper to parse ABC input and extract the tune body.
 */
function parseTuneBody(input: string): { tuneBody: Tune_Body; ctx: ABCContext } {
  const ctx = new ABCContext();
  const tokens = Scanner(input, ctx);
  const ast = parse(tokens, ctx);
  const tune = ast.contents[0] as Tune;
  if (!tune.tune_body) {
    throw new Error("Tune has no body");
  }
  return { tuneBody: tune.tune_body, ctx };
}

/**
 * Helper to format a tune body back to string for comparison.
 */
function formatTuneBody(tuneBody: Tune_Body, ctx: ABCContext): string {
  const formatter = new AbcFormatter(ctx);
  return formatter.visitTuneBodyExpr(tuneBody);
}

describe("VoiceMarkerStyleVisitor", () => {
  describe("convertInfoLinesToInline", () => {
    it("converts single V:1 info line to [V:1] inline", () => {
      const input = `X:1
K:C
V:1
CDEF|
`;
      const { tuneBody, ctx } = parseTuneBody(input);
      const visitor = new VoiceMarkerStyleVisitor(ctx, "inline");
      const transformed = visitor.transformTuneBody(tuneBody);
      const output = formatTuneBody(transformed, ctx);

      expect(output).to.include("[V:1]");
      expect(output).to.not.include("V:1\n");
    });

    it("converts V:1 with parameters", () => {
      const input = `X:1
K:C
V:1 clef=bass
CDEF|
`;
      const { tuneBody, ctx } = parseTuneBody(input);
      const visitor = new VoiceMarkerStyleVisitor(ctx, "inline");
      const transformed = visitor.transformTuneBody(tuneBody);
      const output = formatTuneBody(transformed, ctx);

      expect(output).to.include("[V:1 clef=bass]");
    });

    it("converts multiple consecutive V: info lines", () => {
      const input = `X:1
V:1
V:2
K:C
V:1
CDEF|
V:2
GABC|
`;
      const { tuneBody, ctx } = parseTuneBody(input);
      const visitor = new VoiceMarkerStyleVisitor(ctx, "inline");
      const transformed = visitor.transformTuneBody(tuneBody);
      const output = formatTuneBody(transformed, ctx);

      expect(output).to.include("[V:1]");
      expect(output).to.include("[V:2]");
    });

    it("preserves non-voice info lines", () => {
      const input = `X:1
K:C
V:1
L:1/8
CDEF|
`;
      const { tuneBody, ctx } = parseTuneBody(input);
      const visitor = new VoiceMarkerStyleVisitor(ctx, "inline");
      const transformed = visitor.transformTuneBody(tuneBody);
      const output = formatTuneBody(transformed, ctx);

      // V:1 should be converted to inline
      expect(output).to.include("[V:1]");
      // L:1/8 should remain as info line (not converted)
      expect(output).to.include("L:");
    });
  });

  describe("convertInlineToInfoLines", () => {
    it("converts single [V:1] inline to V:1 info line", () => {
      const input = `X:1
K:C
[V:1] CDEF|
`;
      const { tuneBody, ctx } = parseTuneBody(input);
      const visitor = new VoiceMarkerStyleVisitor(ctx, "infoline");
      const transformed = visitor.transformTuneBody(tuneBody);
      const output = formatTuneBody(transformed, ctx);

      expect(output).to.include("V:1\n");
      expect(output).to.not.include("[V:1]");
    });

    it("converts [V:1] with parameters", () => {
      const input = `X:1
K:C
[V:1 clef=treble] CDEF|
`;
      const { tuneBody, ctx } = parseTuneBody(input);
      const visitor = new VoiceMarkerStyleVisitor(ctx, "infoline");
      const transformed = visitor.transformTuneBody(tuneBody);
      const output = formatTuneBody(transformed, ctx);

      expect(output).to.include("V:1 clef=treble");
      expect(output).to.not.include("[V:1");
    });

    it("converts multiple consecutive [V:] inline fields", () => {
      const input = `X:1
V:1
V:2
K:C
[V:1] CDEF|
[V:2] GABC|
`;
      const { tuneBody, ctx } = parseTuneBody(input);
      const visitor = new VoiceMarkerStyleVisitor(ctx, "infoline");
      const transformed = visitor.transformTuneBody(tuneBody);
      const output = formatTuneBody(transformed, ctx);

      // Check that inline fields are converted to info lines
      expect(output.match(/V:1\n/g)?.length).to.be.greaterThanOrEqual(1);
      expect(output.match(/V:2\n/g)?.length).to.be.greaterThanOrEqual(1);
    });

    it("does not modify non-voice inline fields", () => {
      const input = `X:1
K:C
[V:1] CD [L:1/4] EF|
`;
      const { tuneBody, ctx } = parseTuneBody(input);
      const visitor = new VoiceMarkerStyleVisitor(ctx, "infoline");
      const transformed = visitor.transformTuneBody(tuneBody);
      const output = formatTuneBody(transformed, ctx);

      // V:1 should be converted to info line
      expect(output).to.include("V:1\n");
      // L:1/4 should remain as inline field (not converted)
      expect(output).to.include("[L:");
    });
  });

  describe("no transformation when style matches", () => {
    it("infoline input with infoline style stays unchanged", () => {
      const input = `X:1
K:C
V:1
CDEF|
`;
      const { tuneBody, ctx } = parseTuneBody(input);
      const visitor = new VoiceMarkerStyleVisitor(ctx, "infoline");
      const transformed = visitor.transformTuneBody(tuneBody);
      const output = formatTuneBody(transformed, ctx);

      // Should still have V:1 as info line (with EOL after it)
      expect(output).to.include("V:1\n");
    });

    it("inline input with inline style stays unchanged", () => {
      const input = `X:1
K:C
[V:1] CDEF|
`;
      const { tuneBody, ctx } = parseTuneBody(input);
      const visitor = new VoiceMarkerStyleVisitor(ctx, "inline");
      const transformed = visitor.transformTuneBody(tuneBody);
      const output = formatTuneBody(transformed, ctx);

      // Should still have [V:1] inline
      expect(output).to.include("[V:1]");
    });
  });

  describe("roundtrip", () => {
    it("infoline to inline and back preserves voice IDs", () => {
      const input = `X:1
V:1
V:2
K:C
V:1
CDEF|
V:2
GABC|
`;
      const { tuneBody, ctx } = parseTuneBody(input);

      // Convert to inline
      const toInline = new VoiceMarkerStyleVisitor(ctx, "inline");
      const inlined = toInline.transformTuneBody(tuneBody);

      // Convert back to infoline
      const toInfoline = new VoiceMarkerStyleVisitor(ctx, "infoline");
      const backToInfoline = toInfoline.transformTuneBody(inlined);

      const output = formatTuneBody(backToInfoline, ctx);

      // Should have V:1 and V:2 as info lines
      expect(output).to.include("V:1");
      expect(output).to.include("V:2");
    });

    it("inline to infoline and back preserves voice IDs", () => {
      const input = `X:1
V:1
V:2
K:C
[V:1] CDEF|
[V:2] GABC|
`;
      const { tuneBody, ctx } = parseTuneBody(input);

      // Convert to infoline
      const toInfoline = new VoiceMarkerStyleVisitor(ctx, "infoline");
      const infolined = toInfoline.transformTuneBody(tuneBody);

      // Convert back to inline
      const toInline = new VoiceMarkerStyleVisitor(ctx, "inline");
      const backToInline = toInline.transformTuneBody(infolined);

      const output = formatTuneBody(backToInline, ctx);

      // Should have [V:1] and [V:2] as inline fields
      expect(output).to.include("[V:1]");
      expect(output).to.include("[V:2]");
    });
  });

  describe("edge cases", () => {
    it("handles empty tune body", () => {
      const input = `X:1
K:C
`;
      const { tuneBody, ctx } = parseTuneBody(input);
      const visitor = new VoiceMarkerStyleVisitor(ctx, "inline");
      const transformed = visitor.transformTuneBody(tuneBody);

      // Should not throw
      expect(transformed.sequence).to.be.an("array");
    });

    it("handles tune with no voice markers", () => {
      const input = `X:1
K:C
CDEF|GABC|
`;
      const { tuneBody, ctx } = parseTuneBody(input);
      const visitor = new VoiceMarkerStyleVisitor(ctx, "inline");
      const transformed = visitor.transformTuneBody(tuneBody);
      const output = formatTuneBody(transformed, ctx);

      // Should contain the music unchanged
      expect(output).to.include("CDEF");
      expect(output).to.include("GABC");
    });

    it("handles voice marker with complex parameters", () => {
      const input = `X:1
K:C
V:T1 name="Tenor" clef=treble-8 transpose=-12
CDEF|
`;
      const { tuneBody, ctx } = parseTuneBody(input);
      const visitor = new VoiceMarkerStyleVisitor(ctx, "inline");
      const transformed = visitor.transformTuneBody(tuneBody);
      const output = formatTuneBody(transformed, ctx);

      // Should preserve all parameters
      expect(output).to.include("[V:T1");
      expect(output).to.include("name=");
      expect(output).to.include("clef=");
    });
  });
});
