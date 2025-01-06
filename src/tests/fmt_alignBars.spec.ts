import { assert } from "chai";
import { ABCContext } from "../parsers/Context";
import { Parser } from "../parsers/Parser";
import { Scanner } from "../parsers/Scanner";
import { alignBars, VoiceSplit } from "../Visitors/fmt/fmt_aligner";
import { resolveRules } from "../Visitors/fmt/fmt_rules_assignment";
import { mapTimePoints } from "../Visitors/fmt/fmt_timeMap";
import { findFmtblLines } from "../Visitors/fmt/fmt_timeMapHelpers";
import { AbcFormatter } from "../Visitors/Formatter";

describe("Formatter - align time points", () => {
  let stringifyVisitor: AbcFormatter;
  let ctx: ABCContext;

  beforeEach(() => {
    ctx = new ABCContext();
    stringifyVisitor = new AbcFormatter(ctx);
  });
  function format(input: string): string {
    const scanner = new Scanner(input, ctx);
    const tokens = scanner.scanTokens();
    const parser = new Parser(tokens, ctx);
    const ast = parser.parse();
    if (!ast) {
      throw new Error("Failed to parse");
    }
    let withRules = resolveRules(ast, ctx);

    withRules.tune = withRules.tune.map((tune) => {
      if (tune.tune_body && tune.tune_header.voices.length > 1) {
        tune.tune_body.sequence = tune.tune_body.sequence.map((system) => {
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
          // NOTE: we’re testing this step WITHOUT equalizing bar lengths.
          // voiceSplits = equalizeBarLengths(voiceSplits, ctx, stringifyVisitor);

          // Reconstruct system from aligned voices

          return voiceSplits.flatMap((split) => split.content);
        });
      }
      return tune;
    });

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

      assert.equal(
        result,
        `
X:1
V:1
V:2
V:1
CDEF GABC |
V:2
EFGA BCDE |`
      );
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

      assert.equal(
        result,
        `
X:1
V:1
V:2
V:1
C2 GABC |
V:2
CD GA |`
      );
    });
  });

  describe("complex cases", () => {
    it.skip("aligns tuplets with regular notes", () => {
      const result = format(`
X:1
V:1
V:2
V:1
(3CDE F|
V:2
C2   F|`);

      const expected = `
X:1
V:1
V:2
V:1
(3CDE F |
V:2
  C2  F |`;
      assert.include(result, expected, "Tuplet group should align with corresponding notes");
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

      const expected = `
X:1
V:1
V:2
V:1
{ag}F2 |
V:2
    C2 F |`;
      assert.include(result, expected, "Grace notes should align with corresponding notes");
    });

    it.skip("aligns chords with notes", () => {
      const result = format(`
X:1
V:1
V:2
V:1
[CEG]F|
V:2
C2   E|`);
      const expected = `
X:1
V:1
V:2
V:1
[CEG]F |
V:2
C2 E |`;
      assert.include(result, "[CEG]F|\nC2   E|", "Chords should align with corresponding notes");
    });
  });
});
