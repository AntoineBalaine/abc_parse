/**
 * interpreter-comparison.examples.spec.ts
 *
 * Example-based tests comparing our parser+interpreter output with abcjs
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import {
  parseWithYourParser,
  runBothParsers,
  runComparison,
  expectSimilarOutput,
  expectSameTuneCount,
  expectNoErrors,
  createSimpleTune,
  logComparisonResult,
} from "./test-helpers";

describe("Interpreter Comparison - Example Tests", () => {
  describe("Basic Tunes", () => {
    it("should parse a minimal tune identically", () => {
      const input = `X:1
T:Test
K:C
CDEF|`;

      // For now, just test that our parser works
      // TODO: Enable abcjs comparison once wrapper is implemented
      const { tunes, ctx } = parseWithYourParser(input);

      expect(tunes).to.have.length(1);
      expectNoErrors(ctx, "Your parser");

      // Verify basic structure
      const tune = tunes[0];
      expect(tune.metaText.title).to.equal("Test");
      expect(tune.lineNum).to.be.greaterThan(0);

      // TODO: Uncomment when abcjs wrapper is ready
      // const result = runComparison(input);
      // expect(result.matches).to.be.true;
    });

    it("should parse a simple melody", () => {
      const input = createSimpleTune({
        title: "Simple Melody",
        key: "G",
        meter: "3/4",
        music: "GAB c2d|e2f g2a|b2c' d'2e'|",
      });

      const { tunes, ctx } = parseWithYourParser(input);

      expect(tunes).to.have.length(1);
      expectNoErrors(ctx, "Your parser");

      const tune = tunes[0];
      expect(tune.metaText.title).to.equal("Simple Melody");

      // TODO: Add abcjs comparison
    });

    it("should handle multiple tunes in one file", () => {
      const input = `X:1
T:First Tune
K:C
CDEF|

X:2
T:Second Tune
K:G
GABc|`;

      const { tunes, ctx } = parseWithYourParser(input);

      expect(tunes).to.have.length(2);
      expectNoErrors(ctx, "Your parser");

      expect(tunes[0].metaText.title).to.equal("First Tune");
      expect(tunes[1].metaText.title).to.equal("Second Tune");

      // TODO: Add abcjs comparison
      // expectSameTuneCount(input);
    });
  });

  describe("Header Fields", () => {
    it("should parse tune header info lines", () => {
      const input = `X:1
T:Test Title
T:Subtitle
C:Composer Name
O:Origin Place
M:6/8
L:1/8
Q:1/4=120
K:D
DEF|`;

      const { tunes, ctx } = parseWithYourParser(input);

      expect(tunes).to.have.length(1);
      expectNoErrors(ctx, "Your parser");

      const tune = tunes[0];
      expect(tune.metaText.title).to.exist;
      expect(tune.metaText.composer).to.equal("Composer Name");
      expect(tune.metaText.origin).to.equal("Origin Place");

      // TODO: Add abcjs comparison
    });

    it("should handle file header directives", () => {
      const input = `%%abc-version 2.1
%%abc-creator My Parser
%%abc-copyright Public Domain

X:1
T:Test
K:C
CDEF|`;

      const { tunes, ctx } = parseWithYourParser(input);

      expect(tunes).to.have.length(1);
      expectNoErrors(ctx, "Your parser");

      const tune = tunes[0];
      expect(tune.version).to.exist;
      expect(tune.metaText["abc-creator"]).to.exist;
      expect(tune.metaText["abc-copyright"]).to.equal("Public Domain");

      // TODO: Add abcjs comparison
    });

    it.skip("should inherit file header defaults", () => {
      const input = `L:1/16
%%scale 0.75

X:1
T:First
K:C
CDEFGABC|

X:2
T:Second
K:G
GABcdefg|`;

      const { tunes, ctx } = parseWithYourParser(input);

      expect(tunes).to.have.length(2);

      // Both tunes should inherit L:1/16 from file header
      // TODO: Verify note length inheritance
      // TODO: Verify scale directive inheritance

      // TODO: Add abcjs comparison
    });
  });

  describe("Directives & Formatting", () => {
    it.skip("should handle font directives", () => {
      const input = `%%titlefont Times-Bold 20
%%composerfont Times-Roman 14

X:1
T:Test
C:Composer
K:C
CDEF|`;

      const { tunes, ctx } = parseWithYourParser(input);

      expect(tunes).to.have.length(1);

      // TODO: Verify font directives in formatting
      // TODO: Add abcjs comparison
    });

    it.skip("should handle layout directives", () => {
      const input = `%%scale 0.8
%%pagewidth 21cm
%%leftmargin 1.5cm

X:1
T:Test
K:C
CDEF|`;

      const { tunes, ctx } = parseWithYourParser(input);

      expect(tunes).to.have.length(1);

      // TODO: Verify layout directives
      // TODO: Add abcjs comparison
    });
  });

  describe("Musical Content", () => {
    it.skip("should handle notes with various rhythms", () => {
      const input = `X:1
T:Rhythm Test
M:4/4
L:1/8
K:C
C2 D E/2F/2 G3/2A/2 B4|`;

      const { tunes, ctx } = parseWithYourParser(input);

      expect(tunes).to.have.length(1);

      // TODO: Verify note durations (test float to rational conversion!)
      // TODO: Add abcjs comparison with tolerance
    });

    it.skip("should handle chords", () => {
      const input = `X:1
T:Chord Test
K:C
[CEG] [FAc] [GBd]|`;

      const { tunes, ctx } = parseWithYourParser(input);

      expect(tunes).to.have.length(1);

      // TODO: Verify chord structure
      // TODO: Add abcjs comparison
    });

    it.skip("should handle rests", () => {
      const input = `X:1
T:Rest Test
K:C
C z D z2 E z4|`;

      const { tunes, ctx } = parseWithYourParser(input);

      expect(tunes).to.have.length(1);

      // TODO: Verify rest durations
      // TODO: Add abcjs comparison
    });
  });

  describe("Voice & Staff", () => {
    it.skip("should handle multi-voice tunes", () => {
      const input = `X:1
T:Two Voices
M:4/4
L:1/4
K:C
V:1
C D E F|
V:2
C, E, G, C|`;

      const { tunes, ctx } = parseWithYourParser(input);

      expect(tunes).to.have.length(1);

      const tune = tunes[0];
      expect(tune.voiceNum).to.equal(2);

      // TODO: Add abcjs comparison
    });
  });

  describe("Edge Cases", () => {
    it.skip("should warn about tune-only properties in file header", () => {
      const input = `K:C
M:4/4

X:1
T:Test
K:G
CDEF|`;

      const { tunes, ctx } = parseWithYourParser(input);

      // Should have warnings about K: and M: in file header
      expect(ctx.errorReporter.hasErrors()).to.be.true;

      // But tune should still parse
      expect(tunes).to.have.length(1);
    });

    it.skip("should handle inline meter changes", () => {
      const input = `X:1
T:Meter Change
M:4/4
L:1/4
K:C
CDEF|[M:3/4] GAB|[M:4/4] cdef|`;

      const { tunes, ctx } = parseWithYourParser(input);

      expect(tunes).to.have.length(1);

      // TODO: Verify meter changes in body
      // TODO: Add abcjs comparison
    });
  });
});
