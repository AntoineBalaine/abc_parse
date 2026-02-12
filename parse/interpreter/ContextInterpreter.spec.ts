import { expect } from "chai";
import * as fc from "fast-check";
import {
  encode,
  binarySearchFloor,
  ContextInterpreter,
  getSnapshot,
  getRangeSnapshots,
  getSnapshotAtPosition,
} from "./ContextInterpreter";
import { ABCContext } from "../parsers/Context";
import { AbcErrorReporter } from "../parsers/ErrorReporter";
import { Scanner } from "../parsers/scan2";
import { parse } from "../parsers/parse2";
import { SemanticAnalyzer, SemanticData } from "../analyzers/semantic-analyzer";
import { File_structure, Tune } from "../types/Expr2";
import { MeterType } from "../types/abcjs-ast";

// ============================================================================
// Test Helpers
// ============================================================================

function parseWithSemantics(input: string): { ast: File_structure; semanticData: Map<number, SemanticData>; ctx: ABCContext } {
  const ctx = new ABCContext(new AbcErrorReporter());
  const tokens = Scanner(input, ctx);
  const ast = parse(tokens, ctx);
  const analyzer = new SemanticAnalyzer(ctx);
  ast.accept(analyzer);
  return { ast, semanticData: analyzer.data, ctx };
}

// ============================================================================
// Phase 1: Utility Function Tests
// ============================================================================

describe("ContextInterpreter", () => {
  describe("encode()", () => {
    it("should encode (0, 0) as 0", () => {
      expect(encode(0, 0)).to.equal(0);
    });

    it("should encode (1, 0) as 1_000_000", () => {
      expect(encode(1, 0)).to.equal(1_000_000);
    });

    it("should encode (0, 5) as 5", () => {
      expect(encode(0, 5)).to.equal(5);
    });

    it("should encode (2, 10) as 2_000_010", () => {
      expect(encode(2, 10)).to.equal(2_000_010);
    });

    it("property: encode() preserves lexicographic ordering", () => {
      fc.assert(
        fc.property(
          fc.nat(100000),
          fc.nat(999999),
          fc.nat(100000),
          fc.nat(999999),
          (line1, char1, line2, char2) => {
            // Compare (line1, char1) with (line2, char2) lexicographically
            const cmp1 = line1 < line2 || (line1 === line2 && char1 < char2);
            const cmp2 = encode(line1, char1) < encode(line2, char2);

            // If (line1, char1) < (line2, char2), then encode(line1, char1) < encode(line2, char2)
            if (cmp1) {
              return cmp2 === true;
            }
            // If (line1, char1) > (line2, char2), then encode(line1, char1) > encode(line2, char2)
            const cmp3 = line1 > line2 || (line1 === line2 && char1 > char2);
            if (cmp3) {
              return encode(line1, char1) > encode(line2, char2);
            }
            // If equal, encoded values should be equal
            return encode(line1, char1) === encode(line2, char2);
          }
        ),
        { numRuns: 1000 }
      );
    });
  });

  describe("binarySearchFloor()", () => {
    it("should return -1 for empty array", () => {
      expect(binarySearchFloor([], 10)).to.equal(-1);
    });

    it("should return -1 when target is less than all positions", () => {
      const snapshots = [{ pos: 10 }, { pos: 20 }, { pos: 30 }];
      expect(binarySearchFloor(snapshots, 5)).to.equal(-1);
    });

    it("should return 0 when target equals first position", () => {
      const snapshots = [{ pos: 10 }, { pos: 20 }, { pos: 30 }];
      expect(binarySearchFloor(snapshots, 10)).to.equal(0);
    });

    it("should return last index when target is greater than all positions", () => {
      const snapshots = [{ pos: 10 }, { pos: 20 }, { pos: 30 }];
      expect(binarySearchFloor(snapshots, 100)).to.equal(2);
    });

    it("should return correct index for intermediate target", () => {
      const snapshots = [{ pos: 10 }, { pos: 20 }, { pos: 30 }];
      expect(binarySearchFloor(snapshots, 25)).to.equal(1);
    });

    it("should return correct index for exact match", () => {
      const snapshots = [{ pos: 10 }, { pos: 20 }, { pos: 30 }];
      expect(binarySearchFloor(snapshots, 20)).to.equal(1);
    });

    it("property: binarySearchFloor returns the largest index where pos <= target", () => {
      fc.assert(
        fc.property(
          // Generate sorted array of positions
          fc.array(fc.nat(1000000), { minLength: 1, maxLength: 50 }).map((arr) => [...new Set(arr)].sort((a, b) => a - b)),
          fc.nat(1000000),
          (positions, target) => {
            const snapshots = positions.map((p) => ({ pos: p }));
            const result = binarySearchFloor(snapshots, target);

            if (result === -1) {
              // All positions should be greater than target
              return positions.every((p) => p > target);
            } else {
              // snapshots[result].pos <= target
              if (snapshots[result].pos > target) return false;
              // If there's a next element, it should be > target
              if (result + 1 < snapshots.length) {
                return snapshots[result + 1].pos > target;
              }
              return true;
            }
          }
        ),
        { numRuns: 1000 }
      );
    });
  });

  // ============================================================================
  // Phase 2: Interpreter Tests
  // ============================================================================

  describe("ContextInterpreter.interpret()", () => {
    it("should create snapshots for M:, K: directives", () => {
      const input = "X:1\nM:4/4\nK:G\n|C D E F|";
      const { ast, semanticData, ctx } = parseWithSemantics(input);
      const interpreter = new ContextInterpreter();
      const result = interpreter.interpret(ast, semanticData, ctx);

      // Get the first tune from the AST
      const tune = ast.contents.find((c) => c instanceof Tune) as Tune;
      expect(tune).to.not.be.undefined;

      const tuneSnapshots = result.get(tune.id);
      expect(tuneSnapshots).to.not.be.undefined;

      // Default voice should have snapshots
      const snapshots = tuneSnapshots!.byVoice.get("")!;
      expect(snapshots.length).to.be.greaterThan(0);

      // Check that we have a snapshot with the key signature
      const lastSnapshot = snapshots[snapshots.length - 1].snapshot;
      expect(lastSnapshot.key.root).to.equal("G");
    });

    it("should increment measureNumber on barlines", () => {
      const input = "X:1\nM:4/4\nK:C\n|C D E F|G A B c|d e f g|";
      const { ast, semanticData, ctx } = parseWithSemantics(input);
      const interpreter = new ContextInterpreter();
      interpreter.interpret(ast, semanticData, ctx);

      // We have 4 barlines (including leading barline), so measureNumber should be 5 (1 + 4)
      expect(interpreter.state.measureNumber).to.equal(5);
    });

    it("should track meter change via inline field", () => {
      const input = "X:1\nM:4/4\nK:C\n|C D [M:3/4] E F|";
      const { ast, semanticData, ctx } = parseWithSemantics(input);
      const result = new ContextInterpreter().interpret(ast, semanticData, ctx);

      const tune = ast.contents.find((c) => c instanceof Tune) as Tune;
      const tuneSnapshots = result.get(tune.id)!;
      const snapshots = tuneSnapshots.byVoice.get("")!;

      // Should have snapshots for: initial body snapshot (with M:4/4, K:C) + [M:3/4] inline field
      // Header directives (M:4/4, K:C) are accumulated into one initial snapshot at body start
      expect(snapshots.length).to.equal(2);

      // First snapshot: initial body state with 4/4 meter
      expect(snapshots[0].snapshot.meter.value![0].numerator).to.equal(4);
      expect(snapshots[0].snapshot.meter.value![0].denominator).to.equal(4);

      // Second snapshot: after [M:3/4] inline field
      const lastSnapshot = snapshots[snapshots.length - 1].snapshot;
      expect(lastSnapshot.meter.type).to.equal(MeterType.Specified);
      expect(lastSnapshot.meter.value![0].numerator).to.equal(3);
      expect(lastSnapshot.meter.value![0].denominator).to.equal(4);
    });

    it("should track tempo change via Q: directive", () => {
      const input = "X:1\nM:4/4\nQ:120\nK:C\n|C D E F|";
      const { ast, semanticData, ctx } = parseWithSemantics(input);
      const result = new ContextInterpreter().interpret(ast, semanticData, ctx);

      const tune = ast.contents.find((c) => c instanceof Tune) as Tune;
      const tuneSnapshots = result.get(tune.id)!;
      const snapshots = tuneSnapshots.byVoice.get("")!;

      // Should have 1 snapshot: initial body snapshot (with M:4/4, Q:120, K:C accumulated)
      // Header directives don't create individual snapshots; they're captured at body start
      expect(snapshots.length).to.equal(1);

      // Check that the initial body snapshot has the accumulated tempo
      const snapshot = snapshots[0].snapshot;
      expect(snapshot.tempo).to.not.be.undefined;
      expect(snapshot.tempo.bpm).to.equal(120);
    });

    it("property: measureNumber equals barline count + 1", () => {
      const genNote = fc.constantFrom("C", "D", "E", "F", "G", "A", "B");

      const genTuneBodyWithBarlines = fc
        .tuple(
          fc.array(genNote, { minLength: 1, maxLength: 20 }),
          fc.array(fc.integer({ min: 0, max: 25 }), { minLength: 0, maxLength: 10 })
        )
        .map(([notes, barlinePositions]) => {
          // Deduplicate and sort positions, then clamp to valid range
          const uniquePositions = [...new Set(barlinePositions)]
            .map((p) => Math.min(p, notes.length))
            .sort((a, b) => b - a); // Sort descending to insert from right to left

          const elements: string[] = [...notes];
          for (const pos of uniquePositions) {
            elements.splice(pos, 0, "|");
          }

          return {
            tuneString: `X:1\nM:4/4\nK:C\n${elements.join(" ")}\n`,
            expectedMeasureNumber: uniquePositions.length + 1,
          };
        });

      fc.assert(
        fc.property(genTuneBodyWithBarlines, ({ tuneString, expectedMeasureNumber }) => {
          const { ast, semanticData, ctx } = parseWithSemantics(tuneString);
          const interpreter = new ContextInterpreter();
          interpreter.interpret(ast, semanticData, ctx);
          return interpreter.state.measureNumber === expectedMeasureNumber;
        }),
        { numRuns: 100 }
      );
    });

    it("property: initial body snapshot captures all header context", () => {
      const genMeter = fc.constantFrom("4/4", "3/4", "6/8", "2/4");
      const genKey = fc.constantFrom("C", "G", "D", "Am", "Em");

      const genTuneWithDirectives = fc
        .tuple(genMeter, genKey, fc.array(fc.constantFrom("C", "D", "E"), { minLength: 1, maxLength: 10 }))
        .map(([meter, key, notes]) => {
          const header = `X:1\nM:${meter}\nK:${key}\n`;
          const body = notes.join(" ") + "\n";

          const [num, denom] = meter.split("/").map(Number);

          return {
            tuneString: header + body,
            expectedMeterNum: num,
            expectedMeterDenom: denom,
            expectedKeyRoot: key.replace("m", ""), // "Am" -> "A"
          };
        });

      fc.assert(
        fc.property(genTuneWithDirectives, ({ tuneString, expectedMeterNum, expectedMeterDenom, expectedKeyRoot }) => {
          const { ast, semanticData, ctx } = parseWithSemantics(tuneString);
          const result = new ContextInterpreter().interpret(ast, semanticData, ctx);

          const tune = ast.contents.find((c) => c instanceof Tune) as Tune;
          const tuneSnapshots = result.get(tune.id);
          const snapshots = tuneSnapshots?.byVoice.get("") ?? [];

          // Should have exactly 1 snapshot (initial body snapshot)
          if (snapshots.length !== 1) return false;

          const snapshot = snapshots[0].snapshot;

          // Verify header context was captured
          if (snapshot.meter.value![0].numerator !== expectedMeterNum) return false;
          if (snapshot.meter.value![0].denominator !== expectedMeterDenom) return false;
          if (snapshot.key.root !== expectedKeyRoot) return false;

          return true;
        }),
        { numRuns: 100 }
      );
    });
  });

  // ============================================================================
  // Phase 3: Query Function Tests
  // ============================================================================

  describe("getSnapshot()", () => {
    it("should return null for unknown voice", () => {
      const input = "X:1\nM:4/4\nK:C\n|C D E F|";
      const { ast, semanticData, ctx } = parseWithSemantics(input);
      const result = new ContextInterpreter().interpret(ast, semanticData, ctx);

      const tune = ast.contents.find((c) => c instanceof Tune) as Tune;
      const tuneSnapshots = result.get(tune.id)!;
      const snapshot = getSnapshot(tuneSnapshots, encode(10, 0), "nonexistent");
      expect(snapshot).to.be.null;
    });

    it("should return null for position before all snapshots", () => {
      const input = "X:1\nM:4/4\nK:C\n|C D E F|";
      const { ast, semanticData, ctx } = parseWithSemantics(input);
      const result = new ContextInterpreter().interpret(ast, semanticData, ctx);

      const tune = ast.contents.find((c) => c instanceof Tune) as Tune;
      const tuneSnapshots = result.get(tune.id)!;
      // Position (0, 0) is before M: on line 1
      const snapshot = getSnapshot(tuneSnapshots, encode(0, 0), "");
      expect(snapshot).to.be.null;
    });

    it("should return snapshot for position after all snapshots", () => {
      const input = "X:1\nM:4/4\nK:C\n|C D E F|";
      const { ast, semanticData, ctx } = parseWithSemantics(input);
      const result = new ContextInterpreter().interpret(ast, semanticData, ctx);

      const tune = ast.contents.find((c) => c instanceof Tune) as Tune;
      const tuneSnapshots = result.get(tune.id)!;
      const snapshot = getSnapshot(tuneSnapshots, encode(100, 0), "");
      expect(snapshot).to.not.be.null;
      expect(snapshot!.key.root).to.equal("C");
    });
  });

  describe("getRangeSnapshots()", () => {
    it("should return snapshots within range", () => {
      const input = `X:1
M:4/4
K:C
|C D [M:3/4] E F| [K:G] G A|
`;
      const { ast, semanticData, ctx } = parseWithSemantics(input);
      const result = new ContextInterpreter().interpret(ast, semanticData, ctx);

      const tune = ast.contents.find((c) => c instanceof Tune) as Tune;
      const tuneSnapshots = result.get(tune.id)!;
      const range = {
        start: { line: 3, character: 0 },
        end: { line: 3, character: 30 },
      };

      const rangeSnapshots = getRangeSnapshots(tuneSnapshots, range);

      expect(rangeSnapshots.length).to.be.greaterThan(0);
      expect(rangeSnapshots.every((s) => s.pos <= encode(range.end.line, range.end.character))).to.be.true;
    });
  });

  describe("per-voice isolation", () => {
    it("should maintain different keys per voice", () => {
      const input = `X:1
M:4/4
K:C
V:1
K:G
|C D E F|
V:2
K:D
|A B c d|
`;
      const { ast, semanticData, ctx } = parseWithSemantics(input);
      const result = new ContextInterpreter().interpret(ast, semanticData, ctx);

      const tune = ast.contents.find((c) => c instanceof Tune) as Tune;
      const tuneSnapshots = result.get(tune.id)!;
      const endPos = encode(100, 0);

      const snapshot1 = getSnapshot(tuneSnapshots, endPos, "1");
      const snapshot2 = getSnapshot(tuneSnapshots, endPos, "2");

      expect(snapshot1).to.not.be.null;
      expect(snapshot2).to.not.be.null;
      expect(snapshot1!.key.root).to.equal("G");
      expect(snapshot2!.key.root).to.equal("D");
    });

    it("should persist voice context across switches", () => {
      const input = `X:1
M:4/4
K:C
V:1
K:G
|C D|
V:2
K:D
|E F|
V:1
|G A|
`;
      const { ast, semanticData, ctx } = parseWithSemantics(input);
      const result = new ContextInterpreter().interpret(ast, semanticData, ctx);

      const tune = ast.contents.find((c) => c instanceof Tune) as Tune;
      const tuneSnapshots = result.get(tune.id)!;
      const endPos = encode(100, 0);
      const snapshot = getSnapshot(tuneSnapshots, endPos, "1");

      expect(snapshot).to.not.be.null;
      // Voice 1's key should still be G after switching back
      expect(snapshot!.key.root).to.equal("G");
    });
  });

  describe("multiple tunes", () => {
    it("should index tunes by Tune.id", () => {
      const input = `X:1
M:4/4
K:C
|C D E F|

X:5
M:3/4
K:G
|G A B|
`;
      const { ast, semanticData, ctx } = parseWithSemantics(input);
      const result = new ContextInterpreter().interpret(ast, semanticData, ctx);

      // Get both tunes from the AST
      const tunes = ast.contents.filter((c) => c instanceof Tune) as Tune[];
      expect(tunes.length).to.equal(2);

      const tune1 = tunes[0];
      const tune2 = tunes[1];

      expect(result.has(tune1.id)).to.be.true;
      expect(result.has(tune2.id)).to.be.true;

      const tune1Snapshots = result.get(tune1.id)!;
      const tune2Snapshots = result.get(tune2.id)!;

      // Tune 1 should have 4/4 meter, tune 2 should have 3/4
      const snapshot1 = getSnapshot(tune1Snapshots, encode(100, 0), "");
      const snapshot2 = getSnapshot(tune2Snapshots, encode(100, 0), "");

      expect(snapshot1!.meter.value![0].numerator).to.equal(4);
      expect(snapshot2!.meter.value![0].numerator).to.equal(3);
    });
  });

  // ============================================================================
  // Flat Snapshot List Tests
  // ============================================================================

  describe("flat snapshot list (all)", () => {
    it("should contain all snapshots from all voices in document order", () => {
      const input = `X:1
M:4/4
K:C
V:1
K:G
|C D|
V:2
K:D
|E F|
`;
      const { ast, semanticData, ctx } = parseWithSemantics(input);
      const result = new ContextInterpreter().interpret(ast, semanticData, ctx);

      const tune = ast.contents.find((c) => c instanceof Tune) as Tune;
      const tuneSnapshots = result.get(tune.id)!;

      // allSnapshots should have entries for M:, K:C, V:1/K:G, V:2/K:D
      expect(tuneSnapshots.all.length).to.be.greaterThanOrEqual(4);

      // Should be sorted by position
      for (let i = 1; i < tuneSnapshots.all.length; i++) {
        expect(tuneSnapshots.all[i].pos).to.be.greaterThanOrEqual(tuneSnapshots.all[i - 1].pos);
      }
    });

    it("should allow getSnapshotAtPosition to return voice context at position", () => {
      const input = `X:1
M:4/4
K:C
V:1
|C D|
V:2
|E F|
`;
      const { ast, semanticData, ctx } = parseWithSemantics(input);
      const result = new ContextInterpreter().interpret(ast, semanticData, ctx);

      const tune = ast.contents.find((c) => c instanceof Tune) as Tune;
      const tuneSnapshots = result.get(tune.id)!;

      // Query at a position after V:2 (line 6, 0-indexed)
      const posAfterV2 = encode(6, 0);
      const snapshot = getSnapshotAtPosition(tuneSnapshots, posAfterV2);

      expect(snapshot).to.not.be.null;
      expect(snapshot!.voiceId).to.equal("2");
    });

    it("should maintain getSnapshot with voiceId after type change", () => {
      const input = `X:1
M:4/4
K:C
V:1
K:G
|C D|
`;
      const { ast, semanticData, ctx } = parseWithSemantics(input);
      const result = new ContextInterpreter().interpret(ast, semanticData, ctx);

      const tune = ast.contents.find((c) => c instanceof Tune) as Tune;
      const tuneSnapshots = result.get(tune.id)!;

      const snapshot = getSnapshot(tuneSnapshots, encode(100, 0), "1");
      expect(snapshot).to.not.be.null;
      expect(snapshot!.key.root).to.equal("G");
    });

    it("should return consistent results between flat and per-voice queries", () => {
      const input = `X:1
M:4/4
K:C
V:1
K:G
|C D|
`;
      const { ast, semanticData, ctx } = parseWithSemantics(input);
      const result = new ContextInterpreter().interpret(ast, semanticData, ctx);

      const tune = ast.contents.find((c) => c instanceof Tune) as Tune;
      const tuneSnapshots = result.get(tune.id)!;

      const pos = encode(5, 0); // After K:G
      const snapshotFlat = getSnapshotAtPosition(tuneSnapshots, pos);
      const snapshotVoice = getSnapshot(tuneSnapshots, pos, "1");

      // The flat snapshot should match the per-voice snapshot for voice "1"
      expect(snapshotFlat).to.not.be.null;
      expect(snapshotVoice).to.not.be.null;
      expect(snapshotFlat!.voiceId).to.equal(snapshotVoice!.voiceId);
      expect(snapshotFlat!.key.root).to.equal(snapshotVoice!.key.root);
    });

    it("should create one initial snapshot capturing all header context", () => {
      const input = `X:1
M:4/4
K:C
|C D E F|
`;
      const { ast, semanticData, ctx } = parseWithSemantics(input);
      const result = new ContextInterpreter().interpret(ast, semanticData, ctx);

      const tune = ast.contents.find((c) => c instanceof Tune) as Tune;
      const tuneSnapshots = result.get(tune.id)!;

      // Should have exactly 1 snapshot: initial body snapshot capturing M: and K: context
      // Header directives don't create individual snapshots; they're accumulated into body start
      expect(tuneSnapshots.all.length).to.equal(1);

      // Verify it captured the header context
      const snapshot = tuneSnapshots.all[0].snapshot;
      expect(snapshot.meter.value![0].numerator).to.equal(4);
      expect(snapshot.meter.value![0].denominator).to.equal(4);
      expect(snapshot.key.root).to.equal("C");
    });
  });
});
