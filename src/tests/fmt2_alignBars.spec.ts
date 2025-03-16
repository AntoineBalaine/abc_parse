import { expect } from "chai";
import { ABCContext } from "../parsers/Context";
import { parseTune } from "../parsers/parse2";
import { Scanner2 } from "../parsers/scan2";
import { alignBars } from "../Visitors/fmt2/fmt_aligner";
import { VoiceSplit } from "../Visitors/fmt2/fmt_timeMapHelpers";
import { resolveRules } from "../Visitors/fmt2/fmt_rules_assignment";
import { mapTimePoints } from "../Visitors/fmt2/fmt_timeMap";
import { findFmtblLines } from "../Visitors/fmt2/fmt_timeMapHelpers";
import { AbcFormatter2 } from "../Visitors/Formatter2";

describe("Formatter2 - align time points", () => {
  let stringifyVisitor: AbcFormatter2;
  let ctx: ABCContext;

  beforeEach(() => {
    ctx = new ABCContext();
    stringifyVisitor = new AbcFormatter2(ctx);
  });

  function format(input: string): string {
    const tokens = Scanner2(input, ctx.errorReporter);
    const ast = parseTune(tokens, ctx);
    if (!ast) {
      throw new Error("Failed to parse");
    }

    // 1. Rules resolution phase
    let withRules = resolveRules(ast, ctx);

    // 2. Process each system in the tune body
    if (withRules.tune_body && withRules.tune_header.voices.length > 1) {
      withRules.tune_body.sequence = withRules.tune_body.sequence.map((system) => {
        // Split system into voices/noformat lines
        let voiceSplits: Array<VoiceSplit> = findFmtblLines(system);

        // Skip if no formattable content
        if (!voiceSplits.some((split) => split.type === "formatted")) {
          return system;
        }

        // Get bar-based alignment points
        const barTimeMaps = mapTimePoints(voiceSplits);

        // Process each bar
        for (const barTimeMap of barTimeMaps) {
          voiceSplits = alignBars(voiceSplits, barTimeMap, stringifyVisitor, ctx);
        }
        // NOTE: we're testing this step WITHOUT equalizing bar lengths.
        // voiceSplits = equalizeBarLengths(voiceSplits, ctx, stringifyVisitor);

        // Reconstruct system from aligned voices
        return voiceSplits.flatMap((split) => split.content);
      });
    }

    // 3. Print using visitor
    return stringifyVisitor.stringify(withRules);
  }

  describe("basic alignment cases", () => {
    it("aligns notes at time points within bar", () => {
      const result = format(`
X:1
V:1
V:2
V:1
CDEF GABC|
V:2
EFGA    BCDE|`);

      expect(result).to.equal(`X:1
V:1
V:2
V:1
CDEF GABC |
V:2
EFGA BCDE |`);
    });

    it("handles different note lengths", () => {
      const result = format(`
X:1
V:1
V:2
V:1
C2 GABC|
V:2
CD GA|`);

      expect(result).to.equal(`X:1
V:1
V:2
V:1
C2 GABC |
V:2
CD GA |`);
    });
  });

  describe("complex cases", () => {
    it("aligns tuplets with regular notes", () => {
      const result = format(`
X:1
V:1
V:2
V:1
(3CDE F|
V:2
C2   F|`);

      const expected = `X:1
V:1
V:2
V:1
(3CDE F |
V:2
  C2  F |`;
      expect(result).to.equal(expected, "Tuplet group should align with corresponding notes");
    });

    it("aligns grace notes with regular notes", () => {
      const result = format(`
X:1
V:1
V:2
V:1
{ag}F2|
V:2
C2  F|`);

      const expected = `X:1
V:1
V:2
V:1
{ag}F2   |
V:2
    C2 F |`;
      expect(result).to.equal(expected, "Grace notes should align with corresponding notes");
    });

    it("aligns chords with notes", () => {
      const result = format(`
X:1
V:1
V:2
V:1
[CEG]F|
V:2
C2   E|`);
      const expected = `X:1
V:1
V:2
V:1
[CEG]F |
V:2
C2 E   |`;
      expect(result).to.equal(expected, "Chords should align with corresponding notes");
    });
  });
});
