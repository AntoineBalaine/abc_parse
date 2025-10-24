import { assert } from "chai";
import { isNote } from "../helpers";
import { ABCContext } from "../parsers/Context";
import { ParseCtx, parseTune } from "../parsers/parse2";
import { Scanner } from "../parsers/scan2";
import { Beam, System } from "../types/Expr2";
import { preprocessTune } from "../Visitors/fmt2/fmt_rules_assignment";
import { mapTimePoints } from "../Visitors/fmt2/fmt_timeMap";
import { findFmtblLines, getNodeId, VoiceSplit } from "../Visitors/fmt2/fmt_timeMapHelpers";

describe("TimeMapper (fmt2)", () => {
  let ctx: ABCContext;

  beforeEach(() => {
    ctx = new ABCContext();
  });

  function parseSystem(input: string): System {
    const tokens = Scanner(input, ctx);
    const parseCtx = new ParseCtx(tokens, ctx);
    const ast = parseTune(parseCtx);
    if (!ast) {
      throw new Error("Failed to parse");
    }

    const processedTune = preprocessTune(ast, ctx);
    return processedTune.tune_body!.sequence[0];
  }

  function mapTime(input: string) {
    const system = parseSystem(input);
    const voices: Array<VoiceSplit> = findFmtblLines(system);
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

      assert.isAtLeast(result.length, 4, "Should have at least 4 bars");

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

  it("correctly maps time points when bar starts with annotation", () => {
    const system = parseSystem(`
X:1
V:1
V:2
V:1
"hello" CDEF | GABC |
V:2
CDEF | GABC |`);

    // Split into formatted/non-formatted content
    const voiceSplits = findFmtblLines(system);

    // Map to bar-based time points
    const barTimePoints = mapTimePoints(voiceSplits);

    // Check first bar
    const firstBar = barTimePoints[0];
    const timePoints = Array.from(firstBar.map.keys()).sort();

    assert.equal(timePoints.length, 1, "Should have one time point for first bar");

    // Get locations at this time point
    const locations = firstBar.map.get(timePoints[0])!;
    assert.equal(locations.length, 2, "Both voices should have a time point");

    // Verify we've mapped the first notes (CDEF) in each voice
    locations.forEach((loc) => {
      const voice = voiceSplits[loc.voiceIdx].content;
      const node = voice.find((n) => getNodeId(n) === loc.nodeID);
      assert.isTrue(node && (isNote(node) || node instanceof Beam), "Should be the note/beam containing CDEF");
    });
  });
});
