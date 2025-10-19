import { expect } from "chai";
import { isChord } from "../helpers";
import { ABCContext } from "../parsers/Context";
import { ParseCtx, parseTune } from "../parsers/parse2";
import { Scanner2 } from "../parsers/scan2";
import { System } from "../types/Expr2";
import { alignBars } from "../Visitors/fmt2/fmt_aligner";
import { resolveRules } from "../Visitors/fmt2/fmt_rules_assignment";
import { mapTimePoints } from "../Visitors/fmt2/fmt_timeMap";
import { findFmtblLines, VoiceSplit } from "../Visitors/fmt2/fmt_timeMapHelpers";
import { AbcFormatter2 } from "../Visitors/Formatter2";

describe("Chord Alignment Tests", () => {
  let stringifyVisitor: AbcFormatter2;
  let ctx: ABCContext;

  beforeEach(() => {
    ctx = new ABCContext();
    stringifyVisitor = new AbcFormatter2(ctx);
  });

  function format(input: string): string {
    const tokens = Scanner2(input, ctx);
    const parseCtx = new ParseCtx(tokens, ctx);
    const ast = parseTune(parseCtx);
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

        // Reconstruct system from aligned voices
        return voiceSplits.flatMap((split) => split.content);
      });
    }

    // 3. Print using visitor
    return stringifyVisitor.stringify(withRules);
  }

  function parseSystem(input: string): System {
    const tokens = Scanner2(input, ctx);
    const parseCtx = new ParseCtx(tokens, ctx);
    const ast = parseTune(parseCtx);
    if (!ast) {
      throw new Error("Failed to parse");
    }

    const processedTune = resolveRules(ast, ctx);
    return processedTune.tune_body!.sequence[0];
  }

  function countChords(system: System): number {
    return system.filter((node) => isChord(node)).length;
  }

  describe("Chord Duration Calculation", () => {
    it("calculates chord duration correctly", () => {
      const system = parseSystem(`
X:1
[CEG]2 [FAC] |
`);

      // Verify we have chords in the system
      const chordCount = countChords(system);
      expect(chordCount).to.be.greaterThan(0, "System should contain chords");

      // Map time points
      const voiceSplits = findFmtblLines(system);
      const barTimeMaps = mapTimePoints(voiceSplits);

      // Check that we have time points for the chords
      expect(barTimeMaps.length).to.be.greaterThan(0, "Should have bar time maps");

      const firstBar = barTimeMaps[0];
      const timePoints = Array.from(firstBar.map.keys()).sort();

      // We should have at least one time point for the chord
      expect(firstBar.map.size).to.be.greaterThan(0, "Should have time points for chords");
    });

    it("calculates duration for chords with rhythm", () => {
      const system = parseSystem(`
X:1
[CEG]2 [FAC]/2 |
`);

      // Map time points
      const voiceSplits = findFmtblLines(system);
      const barTimeMaps = mapTimePoints(voiceSplits);

      const firstBar = barTimeMaps[0];
      const timePoints = Array.from(firstBar.map.keys()).sort();

      // We should have at least two time points for the chords with different durations
      expect(timePoints.length).to.be.greaterThan(1, "Should have multiple time points for chords with different durations");
    });

    it("handles chords in multi-voice context", () => {
      const result = mapTimePoints(
        findFmtblLines(
          parseSystem(`
X:1
V:1
V:2
V:1
[CEG]2 [FAC] |
V:2
CDEF |
`)
        )
      );

      // Check first bar
      const bar1 = result[0];
      const timePoints = Array.from(bar1.map.keys()).sort();

      // We should have at least two time points
      expect(timePoints.length).to.be.greaterThan(1, "Should have multiple time points");

      // Each time point should have locations
      timePoints.forEach((timePoint) => {
        const locations = bar1.map.get(timePoint)!;
        expect(locations.length).to.be.greaterThan(0, "Each time point should have locations");
      });
    });
  });

  describe("Chord Time Mapping Edge Cases", () => {
    it("handles chords with ties", () => {
      const system = parseSystem(`
X:1
[CEG]-[FAC] |
`);

      // Map time points
      const voiceSplits = findFmtblLines(system);
      const barTimeMaps = mapTimePoints(voiceSplits);

      const firstBar = barTimeMaps[0];

      // We should have time points for both chords
      expect(firstBar.map.size).to.be.equal(1, "Should have time points for tied chords");
    });

    it("handles chords in beams", () => {
      const system = parseSystem(`
X:1
[CEG][FAC] [GBD][ACE] |
`);

      // Map time points
      const voiceSplits = findFmtblLines(system);
      const barTimeMaps = mapTimePoints(voiceSplits);

      const firstBar = barTimeMaps[0];

      // We should have time points for all chords
      expect(firstBar.map.size).to.be.equal(2, "Should have time points for all beams");
    });
  });
});
