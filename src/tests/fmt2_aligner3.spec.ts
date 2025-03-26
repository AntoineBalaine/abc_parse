import { assert } from "chai";
import { ABCContext } from "../parsers/Context";
import { parseTune } from "../parsers/parse2";
import { Scanner2, Token } from "../parsers/scan2";
import { Expr, System, Tune } from "../types/Expr2";
import { scanAlignPoints, aligner } from "../Visitors/fmt2/fmt_aligner3";
import { VoiceSplit, findFmtblLines } from "../Visitors/fmt2/fmt_timeMapHelpers";
import { AbcFormatter2 } from "../Visitors/Formatter2";
import { resolveRules } from "../Visitors/fmt2/fmt_rules_assignment";

describe("Aligner3", () => {
  let ctx: ABCContext;
  let stringifyVisitor: AbcFormatter2;

  beforeEach(() => {
    ctx = new ABCContext();
    stringifyVisitor = new AbcFormatter2(ctx);
  });

  // Helper function to parse ABC notation into a system
  function parseSystem(input: string): System {
    const tokens = Scanner2(input, ctx.errorReporter);
    const ast = parseTune(tokens, ctx);
    if (!ast) {
      throw new Error("Failed to parse");
    }
    return ast.tune_body!.sequence[0];
  }

  // Helper function to format the result for easier comparison
  function formatResult(result: string): string {
    // Remove X:1 header and trim whitespace
    return result.replace(/X:1\n/, "").trim();
  }

  function setup(input: string) {
    const system = parseSystem(input);

    // Create a temporary Tune object to apply rules
    const tempTune = {
      tune_header: { voices: ["1", "2"] }, // Assume multi-voice for rules
      tune_body: { sequence: [system] },
    } as Tune;

    // Apply rules to the tune
    const processedTune = resolveRules(tempTune, ctx);

    // Get the processed system with rules applied
    const processedSystem = processedTune.tune_body!.sequence[0];

    // Split the processed system into voices
    const voiceSplits = findFmtblLines(processedSystem);

    return voiceSplits;
  }

  // Helper function to test alignment
  function testAlignment(input: string, expected: string): void {
    const system = parseSystem(input);

    // Create a temporary Tune object to apply rules
    const tempTune = {
      tune_header: { voices: ["1", "2"] }, // Assume multi-voice for rules
      tune_body: { sequence: [system] },
    } as Tune;

    // Apply rules to the tune
    const processedTune = resolveRules(tempTune, ctx);

    // Get the processed system with rules applied
    const processedSystem = processedTune.tune_body!.sequence[0];

    // Split the processed system into voices
    const voiceSplits = findFmtblLines(processedSystem);

    // Get alignment points
    const gCtx = scanAlignPoints(voiceSplits);

    // Apply the aligner function
    const alignedVoiceSplits = aligner(gCtx, voiceSplits, stringifyVisitor);

    // Reconstruct the system and convert to string
    const alignedSystem = alignedVoiceSplits.flatMap((split) => split.content);
    const result = alignedSystem.map((node) => stringifyVisitor.stringify(node)).join("");

    // Compare with expected result
    assert.equal(formatResult(result), expected);
  }

  // Basic alignment tests
  describe("basic alignment", () => {
    it("aligns simple notes at the same time points", () => {
      const input = `
X:1
V:1
V:2
V:1
CDEF GABC|
V:2
EFGA BCDE|`;

      const expected = `V:1
CDEF GABC |
V:2
EFGA BCDE |`;

      testAlignment(input, expected);
    });

    it("aligns bars with different note lengths", () => {
      const input = `
X:1
V:1
V:2
V:1
C2D2|GABC|
V:2
CDEF|GABC|`;

      const expected = `V:1
C2D2 | GABC |
V:2
CDEF | GABC |`;

      testAlignment(input, expected);
    });

    it("aligns notes with different rhythms", () => {
      const input = `
X:1
V:1
V:2
V:1
C2 D/2E/2 F|
V:2
C D E/2F/2|`;

      const expected = `V:1
C2  D/2E/2 F |
V:2
C D E/2F/2   |`;

      const voiceSplits = setup(input);
      // Get alignment points
      const gCtx = scanAlignPoints(voiceSplits);

      // Apply the aligner function
      const alignedVoiceSplits = aligner(gCtx, voiceSplits, stringifyVisitor);

      // Reconstruct the system and convert to string
      const alignedSystem = alignedVoiceSplits.flatMap((split) => split.content);
      const result = alignedSystem.map((node) => stringifyVisitor.stringify(node)).join("");
      assert.equal(formatResult(result), expected);
    });
  });

  // Complex musical notation tests
  describe("complex musical notation", () => {
    it("aligns grace notes with regular notes", () => {
      const input = `
X:1
V:1
V:2
V:1
{ag}F2|
V:2
C2 F|`;

      const expected = `V:1
{ag}F2   |
V:2
    C2 F |`;

      testAlignment(input, expected);
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

      const expected = `V:1
[CEG]F |
V:2
C2 E   |`;

      testAlignment(input, expected);
    });

    it("aligns decorations and annotations", () => {
      const input = `
X:1
V:1
V:2
V:1
!p!C "swing"D|
V:2
C D|`;

      const expected = `V:1
!p! C "swing" D |
V:2
    C         D |`;

      testAlignment(input, expected);
    });

    it("aligns tuplets with regular notes", () => {
      const input = `
X:1
V:1
V:2
V:1
(3CDE F|
V:2
C2 F|`;

      const expected = `V:1
(3CDE F |
V:2
  C2 F  |`;

      testAlignment(input, expected);
    });
  });

  // Tests for failing cases in Formatter2
  describe("formatter2 failing cases", () => {
    it("aligns bars that start with annotations", () => {
      const input = `
X:1
V:1
V:2
V:1
"hello"CDEF|GABC|"again" DE
V:2
CDEF|"world"GABC|DE`;

      const expected = `V:1
"hello" CDEF |         GABC | "again" DE
V:2
        CDEF | "world" GABC |         DE`;

      const voiceSplits = setup(input);
      // Get alignment points
      const gCtx = scanAlignPoints(voiceSplits);

      // Apply the aligner function
      const alignedVoiceSplits = aligner(gCtx, voiceSplits, stringifyVisitor);

      // Reconstruct the system and convert to string
      const alignedSystem = alignedVoiceSplits.flatMap((split) => split.content);
      const result = alignedSystem.map((node) => stringifyVisitor.stringify(node)).join("");
      assert.equal(formatResult(result), expected);
    });

    it("aligns with expanded multi-measure rests", () => {
      const input = `
X:1
V:1
V:2
V:1
Z4|
V:2
CDEF|GABC|CDEF|GABC|`;

      const expected = `V:1
Z    | Z    | Z    | Z    |
V:2
CDEF | GABC | CDEF | GABC |`;

      testAlignment(input, expected);
    });

    it("handles empty bars", () => {
      const input = `
X:1
V:1
V:2
V:1
CDEF| GABC| CDE
V:2
CDEF| |GABC|`;

      const expected = `V:1
CDEF | GABC | CDE
V:2
CDEF |      | GABC |`;

      testAlignment(input, expected);
    });
  });

  // Edge case tests
  describe("edge cases", () => {
    it("handles empty voices", () => {
      const input = `
X:1
V:1
V:2
V:1
CDEF|
V:2
|`;

      const expected = `V:1
CDEF |
V:2
     |`;

      testAlignment(input, expected);
    });

    it("preserves comments between voices", () => {
      const input = `
X:1
V:1
V:2
V:1
CDEF|
% A comment
V:2
CDEF|`;

      const expected = `V:1
CDEF |
% A comment
V:2
CDEF |`;

      testAlignment(input, expected);
    });
  });

  // Regression tests
  describe("regression tests", () => {
    it("fixes the padding space issue in bar alignment", () => {
      const input = `
X:1
V:1
V:2
V:1
CDEF  GABC|
V:2
EFGA BCDE|`;

      const expected = `V:1
CDEF GABC |
V:2
EFGA BCDE |`;

      testAlignment(input, expected);
    });

    it("fixes the grace notes alignment issue", () => {
      const input = `
X:1
V:1
V:2
V:1
{ag}F2|
V:2
    C2 F|`;

      const expected = `V:1
{ag}F2   |
V:2
    C2 F |`;

      testAlignment(input, expected);
    });

    it("fixes the chord alignment issue", () => {
      const input = `
X:1
V:1
V:2
V:1
[CEG]F|
V:2
C2 E  |`;

      const expected = `V:1
[CEG]F |
V:2
C2 E   |`;

      testAlignment(input, expected);
    });
  });
});
