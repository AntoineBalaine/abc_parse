import { assert } from "chai";
import { ABCContext } from "../parsers/Context";
import { Parser } from "../parsers/Parser";
import { Scanner } from "../parsers/Scanner";
import { System } from "../types/types";
import { TimeMapper } from "../Visitors/fmt/fmt_timeMapper";
import { mapTimePoints } from "../Visitors/fmt/fmt_tmPts";
import { VoiceSplit } from "../Visitors/fmt/fmt_aligner";
import { preprocessTune } from "../Visitors/fmt/fmt_rules_assignment";

describe("TimeMapper", () => {
  let ctx: ABCContext;

  beforeEach(() => {
    ctx = new ABCContext();
  });

  function parseSystem(input: string): System {
    const scanner = new Scanner(input, ctx);
    const tokens = scanner.scanTokens();
    const parser = new Parser(tokens, ctx);
    const ast = parser.parse();
    if (!ast) {
      throw new Error("Failed to parse");
    }

    ast.tune = ast.tune.map((tune) => preprocessTune(tune, ctx));
    return ast.tune[0].tune_body!.sequence[0];
  }

  function mapTime(input: string) {
    const system = parseSystem(input);
    const voices: Array<VoiceSplit> = new TimeMapper().mapVoices(system);
    return mapTimePoints(voices);
  }

  describe("time alignment points", () => {
    it("finds concordant points in simple bars of equal length", () => {
      const result = mapTime(`
X:1
V:1
V:2
V:1
CDEF|GABC|
V:2
CDEF|GABC|`);

      // Bar 1
      const bar1 = result[0];
      assert.equal(bar1.map.size, 1, "Should have 1 time point");
      const timePoint1 = Array.from(bar1.map.keys())[0];
      const locations1 = bar1.map.get(timePoint1)!;
      assert.equal(locations1.length, 2, "Both voices should have point");

      // Bar 2
      const bar2 = result[1];
      assert.equal(bar2.map.size, 1, "Should have 1 time point");
      const timePoint2 = Array.from(bar2.map.keys())[0];
      const locations2 = bar2.map.get(timePoint2)!;
      assert.equal(locations2.length, 2, "Both voices should have point");
    });

    it("handles bars of different lengths", () => {
      const result = mapTime(`
X:1
V:1
V:2
V:1
CD|GABC|
V:2
CDEF|GA|`);

      // Check first bar
      const bar1 = result[0];
      const timePoint1 = Array.from(bar1.map.keys())[0];
      const locations1 = bar1.map.get(timePoint1)!;
      assert.equal(locations1.length, 2, "Both voices should align at start");
    });

    it("handles bars with chords", () => {
      const result = mapTime(`
X:1
V:1
V:2
V:1
[CEG]D|GABC|
V:2
CDEF|GABC|`);

      // Check chord bar
      const bar1 = result[0];
      const timePoint1 = Array.from(bar1.map.keys())[0];
      const locations1 = bar1.map.get(timePoint1)!;
      assert.equal(locations1.length, 2, "Chord should align with first note");
    });

    it("handles grace notes and decorations", () => {
      const result = mapTime(`
X:1
V:1
V:2
V:1
!p!C{ag}D|GABC|
V:2
CDEF|GABC|`);

      // Check first bar
      const bar1 = result[0];
      const timePoint1 = Array.from(bar1.map.keys())[0];
      const locations1 = bar1.map.get(timePoint1)!;
      assert.equal(locations1.length, 2, "Decorated notes should align");
    });

    it("handles different note lengths", () => {
      const result = mapTime(`
X:1
V:1
V:2
V:1
C2D2|GABC|
V:2
CDEF|GABC|`);

      // Check first bar timing
      const bar1 = result[0];
      const timePoints = Array.from(bar1.map.keys());
      assert.equal(timePoints.length, 1, "Should have one alignment point");
      assert.equal(bar1.map.get(timePoints[0])!.length, 2, "Both voices should align");
    });

    it("handles tuplets", () => {
      const result = mapTime(`
X:1
V:1
V:2
V:1
(3CDE CDEF|GABC|
V:2
CDEF|GABC|`);

      // Check first bar
      const bar1 = result[0];
      const timePoints = Array.from(bar1.map.keys());
      assert.equal(timePoints.length, 2, "Should have two time points");

      // First time point should align both voices
      const locations1 = bar1.map.get(timePoints[0])!;
      assert.equal(locations1.length, 2, "Both voices should align at start");
    });

    it("handles expanded multi-measure rests", () => {
      const result = mapTime(`
X:1
V:1
V:2
V:1
Z4|
V:2
CDEF|GABC|CDEF|GABC|`);

      assert.equal(result.length, 5, "Should have 5 bars");

      // Each bar should have alignment points
      result.slice(0, 4).forEach((bar, idx) => {
        const timePoints = Array.from(bar.map.keys());
        assert.equal(timePoints.length, 1, `Bar ${idx + 1} should have one time point`);
        const locations = bar.map.get(timePoints[0])!;
        assert.equal(locations.length, 2, "Both voices should have point");
      });
    });

    it("handles different numbers of voices per system", () => {
      const result = mapTime(`
X:1
V:1
V:2
V:3
V:1
CDEF|GABC|
V:3
CDEF|`);

      // Check first bar alignment
      const bar1 = result[0];
      const timePoints = Array.from(bar1.map.keys());
      const locations = bar1.map.get(timePoints[0])!;
      assert.equal(locations.length, 2, "V1 and V3 should align");
    });

    it("handles mixed note groupings", () => {
      const result = mapTime(`
X:1
V:1
V:2
V:1
CDEF GABC|CDEF|
V:2
CD EF GA|CDEF|`);

      // Check first bar
      const bar1 = result[0];
      const timePoints = Array.from(bar1.map.keys()).sort();

      // First and last points should align between voices
      assert.equal(bar1.map.get(timePoints[0])!.length, 2, "Start should align");
      assert.equal(bar1.map.get(timePoints[timePoints.length - 1])!.length, 2, "End should align");
    });
  });
});
