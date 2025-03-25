import { assert } from "chai";
import { ABCContext } from "../parsers/Context";
import { parseTune } from "../parsers/parse2";
import { Scanner2 } from "../parsers/scan2";
import { System } from "../types/Expr2";
import { scanAlignPoints, alignTuneWithNewAlgorithm } from "../Visitors/fmt2/fmt_aligner3";
import { VoiceSplit, findFmtblLines } from "../Visitors/fmt2/fmt_timeMapHelpers";
import { AbcFormatter2 } from "../Visitors/Formatter2";

describe("Aligner3 - New Alignment Algorithm", () => {
  let ctx: ABCContext;
  let stringifyVisitor: AbcFormatter2;

  beforeEach(() => {
    ctx = new ABCContext();
    stringifyVisitor = new AbcFormatter2(ctx);
  });

  function parseSystem(input: string): System {
    const tokens = Scanner2(input, ctx.errorReporter);
    const ast = parseTune(tokens, ctx);
    if (!ast) {
      throw new Error("Failed to parse");
    }
    return ast.tune_body!.sequence[0];
  }

  describe.only("scanAlignPoints", () => {
    it("correctly identifies bar boundaries and time points", () => {
      const system = parseSystem(`
X:1
V:1
V:2
V:1
CDEF|GABC|
V:2
CDEF|GABC|`);

      // Split into formatted/non-formatted content
      const voiceSplits = findFmtblLines(system);

      // Scan alignment points
      const gCtx = scanAlignPoints(voiceSplits);

      // Verify that we have the correct number of bars
      assert.isTrue(gCtx.validate(), "Alignment points should be valid");

      // Convert to string for debugging
      console.log(gCtx.toString());

      // Convert to bar alignments
      const barAlignments = gCtx.toBarAlignments();

      // Verify that we have the correct number of bar alignments
      assert.equal(barAlignments.length, 3, "Should have 3 bar alignments");
    });

    it("handles voices with different numbers of bars", () => {
      const system = parseSystem(`
X:1
V:1
V:2
V:1
CD|GABC|
V:2
CDEF|`);

      // Split into formatted/non-formatted content
      const voiceSplits = findFmtblLines(system);

      // Scan alignment points
      const gCtx = scanAlignPoints(voiceSplits);

      // Verify that we have the correct number of bars
      assert.isTrue(gCtx.validate(), "Alignment points should be valid");

      // Convert to bar alignments
      const barAlignments = gCtx.toBarAlignments();

      // Verify that we have the correct number of bar alignments
      assert.equal(barAlignments.length, 3, "Should have 3 bar alignments");
    });
  });

  describe("alignTuneWithNewAlgorithm", () => {
    it("aligns bars with different note lengths", () => {
      const input = `
X:1
V:1
V:2
V:1
C2D2|GABC|
V:2
CDEF|GABC|`;

      const system = parseSystem(input);
      const alignedSystem = alignTuneWithNewAlgorithm(system, ctx, stringifyVisitor);

      // Convert to string for verification
      const result = alignedSystem.map((node) => stringifyVisitor.stringify(node)).join("");

      // Verify that the result contains the expected alignment
      assert.include(result, "C2D2", "Should contain C2D2");
      assert.include(result, "CDEF", "Should contain CDEF");
    });

    it("aligns grace notes with regular notes", () => {
      const input = `
X:1
V:1
V:2
V:1
{ag}F2|
V:2
C2 F|`;

      const system = parseSystem(input);
      const alignedSystem = alignTuneWithNewAlgorithm(system, ctx, stringifyVisitor);

      // Convert to string for verification
      const result = alignedSystem.map((node) => stringifyVisitor.stringify(node)).join("");

      // Verify that the result contains the expected alignment
      assert.include(result, "{ag}F2", "Should contain {ag}F2");
      assert.include(result, "C2 F", "Should contain C2 F");
    });

    it("aligns chords with notes", () => {
      const input = `
X:1
V:1
V:2
V:1
[CEG]F|
V:2
C2 E|`;

      const system = parseSystem(input);
      const alignedSystem = alignTuneWithNewAlgorithm(system, ctx, stringifyVisitor);

      // Convert to string for verification
      const result = alignedSystem.map((node) => stringifyVisitor.stringify(node)).join("");

      // Verify that the result contains the expected alignment
      assert.include(result, "[CEG]F", "Should contain [CEG]F");
      assert.include(result, "C2 E", "Should contain C2 E");
    });
  });
});
