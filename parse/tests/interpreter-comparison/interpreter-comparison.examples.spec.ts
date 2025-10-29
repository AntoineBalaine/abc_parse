/**
 * interpreter-comparison.examples.spec.ts
 *
 * Example-based tests comparing our parser+interpreter output with abcjs
 */

import { expect } from "chai";
import { describe, it } from "mocha";
import { parseWithAbcjs } from "./abcjs-wrapper";
import {
  parseWithYourParser,
  runComparison,
  createSimpleTune,
} from "./test-helpers";

describe("Interpreter Comparison - Example Tests", () => {
  describe("MetaText Comparison", () => {
    describe("Title (T:)", () => {
      it("should parse simple title", () => {
        const input = `X:1
T:Simple Title
K:C
CDEF|`;

        const result = runComparison(input);
        const yourTune = parseWithYourParser(input).tunes[0];
        const abcjsTune = parseWithAbcjs(input)[0];

        expect(yourTune.metaText.title).to.equal("Simple Title");
        expect(abcjsTune.metaText.title).to.equal("Simple Title");
      });

      it("should parse title with special characters", () => {
        const input = `X:1
T:The Ümlaut's "Special" Title - Part 1
K:C
CDEF|`;

        const yourTune = parseWithYourParser(input).tunes[0];
        const abcjsTune = parseWithAbcjs(input)[0];

        expect(yourTune.metaText.title).to.equal(abcjsTune.metaText.title);
      });

      it("should handle multiple titles", () => {
        const input = `X:1
T:Main Title
T:Subtitle One
T:Subtitle Two
K:C
CDEF|`;

        const yourTune = parseWithYourParser(input).tunes[0];
        const abcjsTune = parseWithAbcjs(input)[0];

        // Both should have title (may be array or string depending on implementation)
        expect(yourTune.metaText.title).to.exist;
        expect(abcjsTune.metaText.title).to.exist;
      });
    });

    describe("Composer (C:)", () => {
      it("should parse simple composer", () => {
        const input = `X:1
T:Test
C:Johann Sebastian Bach
K:C
CDEF|`;

        const yourTune = parseWithYourParser(input).tunes[0];
        const abcjsTune = parseWithAbcjs(input)[0];

        expect(yourTune.metaText.composer).to.equal("Johann Sebastian Bach");
        expect(abcjsTune.metaText.composer).to.equal("Johann Sebastian Bach");
      });

      it("should handle composer with dates", () => {
        const input = `X:1
T:Test
C:Mozart (1756-1791)
K:C
CDEF|`;

        const yourTune = parseWithYourParser(input).tunes[0];
        const abcjsTune = parseWithAbcjs(input)[0];

        expect(yourTune.metaText.composer).to.equal(abcjsTune.metaText.composer);
      });

      it("should handle multiple composers", () => {
        const input = `X:1
T:Test
C:Bach
C:Handel
K:C
CDEF|`;

        const yourTune = parseWithYourParser(input).tunes[0];
        const abcjsTune = parseWithAbcjs(input)[0];

        expect(yourTune.metaText.composer).to.exist;
        expect(abcjsTune.metaText.composer).to.exist;
      });
    });

    describe("Origin (O:)", () => {
      it("should parse simple origin", () => {
        const input = `X:1
T:Test
O:Ireland
K:C
CDEF|`;

        const yourTune = parseWithYourParser(input).tunes[0];
        const abcjsTune = parseWithAbcjs(input)[0];

        expect(yourTune.metaText.origin).to.equal("Ireland");
        expect(abcjsTune.metaText.origin).to.equal("Ireland");
      });

      it("should handle complex origin", () => {
        const input = `X:1
T:Test
O:County Cork, Ireland
K:C
CDEF|`;

        const yourTune = parseWithYourParser(input).tunes[0];
        const abcjsTune = parseWithAbcjs(input)[0];

        expect(yourTune.metaText.origin).to.equal(abcjsTune.metaText.origin);
      });
    });

    describe("Rhythm (R:)", () => {
      it("should parse rhythm", () => {
        const input = `X:1
T:Test
R:Jig
K:C
CDEF|`;

        const yourTune = parseWithYourParser(input).tunes[0];
        const abcjsTune = parseWithAbcjs(input)[0];

        expect(yourTune.metaText.rhythm).to.equal("Jig");
        expect(abcjsTune.metaText.rhythm).to.equal("Jig");
      });

      it("should handle complex rhythm descriptions", () => {
        const input = `X:1
T:Test
R:Slow Air in 3/4
K:C
CDEF|`;

        const yourTune = parseWithYourParser(input).tunes[0];
        const abcjsTune = parseWithAbcjs(input)[0];

        expect(yourTune.metaText.rhythm).to.equal(abcjsTune.metaText.rhythm);
      });
    });

    describe("Book (B:)", () => {
      it("should parse book reference", () => {
        const input = `X:1
T:Test
B:O'Neill's Music of Ireland
K:C
CDEF|`;

        const yourTune = parseWithYourParser(input).tunes[0];
        const abcjsTune = parseWithAbcjs(input)[0];

        expect(yourTune.metaText.book).to.equal("O'Neill's Music of Ireland");
        expect(abcjsTune.metaText.book).to.equal("O'Neill's Music of Ireland");
      });
    });

    describe("Source (S:)", () => {
      it("should parse source", () => {
        const input = `X:1
T:Test
S:Collected from fieldwork
K:C
CDEF|`;

        const yourTune = parseWithYourParser(input).tunes[0];
        const abcjsTune = parseWithAbcjs(input)[0];

        expect(yourTune.metaText.source).to.equal("Collected from fieldwork");
        expect(abcjsTune.metaText.source).to.equal("Collected from fieldwork");
      });
    });

    describe("Discography (D:)", () => {
      it("should parse discography", () => {
        const input = `X:1
T:Test
D:The Chieftains - Album 1
K:C
CDEF|`;

        const yourTune = parseWithYourParser(input).tunes[0];
        const abcjsTune = parseWithAbcjs(input)[0];

        expect(yourTune.metaText.discography).to.equal("The Chieftains - Album 1");
        expect(abcjsTune.metaText.discography).to.equal("The Chieftains - Album 1");
      });
    });

    describe("Notes (N:)", () => {
      it("should parse notes", () => {
        const input = `X:1
T:Test
N:This is a test tune
K:C
CDEF|`;

        const yourTune = parseWithYourParser(input).tunes[0];
        const abcjsTune = parseWithAbcjs(input)[0];

        expect(yourTune.metaText.notes).to.equal("This is a test tune");
        expect(abcjsTune.metaText.notes).to.equal("This is a test tune");
      });
    });

    describe("Transcription (Z:)", () => {
      it("should parse transcription credit", () => {
        const input = `X:1
T:Test
Z:Transcribed by John Doe
K:C
CDEF|`;

        const yourTune = parseWithYourParser(input).tunes[0];
        const abcjsTune = parseWithAbcjs(input)[0];

        expect(yourTune.metaText.transcription).to.equal("Transcribed by John Doe");
        expect(abcjsTune.metaText.transcription).to.equal("Transcribed by John Doe");
      });
    });

    describe("History (H:)", () => {
      it("should parse history", () => {
        const input = `X:1
T:Test
H:This tune dates back to the 18th century
K:C
CDEF|`;

        const yourTune = parseWithYourParser(input).tunes[0];
        const abcjsTune = parseWithAbcjs(input)[0];

        expect(yourTune.metaText.history).to.equal("This tune dates back to the 18th century");
        expect(abcjsTune.metaText.history).to.equal("This tune dates back to the 18th century");
      });
    });

    describe("Author (A:)", () => {
      it("should parse author", () => {
        const input = `X:1
T:Test
A:Traditional, arr. by Jane Smith
K:C
CDEF|`;

        const yourTune = parseWithYourParser(input).tunes[0];
        const abcjsTune = parseWithAbcjs(input)[0];

        expect(yourTune.metaText.author).to.exist;
        expect(abcjsTune.metaText.author).to.exist;
      });
    });

    describe("Combined MetaText Fields", () => {
      it("should parse all common metaText fields together", () => {
        const input = `X:1
T:The Complete Test
T:Subtitle Version
C:Traditional
O:Ireland
R:Reel
B:O'Neill's
S:Fieldwork
D:The Chieftains
N:Fast tempo recommended
Z:John Doe, 2024
K:G
GFGA Bcde|`;

        const yourTune = parseWithYourParser(input).tunes[0];
        const abcjsTune = parseWithAbcjs(input)[0];

        // Title
        expect(yourTune.metaText.title).to.exist;
        expect(abcjsTune.metaText.title).to.exist;

        // Composer
        expect(yourTune.metaText.composer).to.equal("Traditional");
        expect(abcjsTune.metaText.composer).to.equal("Traditional");

        // Origin
        expect(yourTune.metaText.origin).to.equal("Ireland");
        expect(abcjsTune.metaText.origin).to.equal("Ireland");

        // Rhythm
        expect(yourTune.metaText.rhythm).to.equal("Reel");
        expect(abcjsTune.metaText.rhythm).to.equal("Reel");

        // Book
        expect(yourTune.metaText.book).to.equal("O'Neill's");
        expect(abcjsTune.metaText.book).to.equal("O'Neill's");

        // Source
        expect(yourTune.metaText.source).to.equal("Fieldwork");
        expect(abcjsTune.metaText.source).to.equal("Fieldwork");

        // Discography
        expect(yourTune.metaText.discography).to.equal("The Chieftains");
        expect(abcjsTune.metaText.discography).to.equal("The Chieftains");

        // Notes
        expect(yourTune.metaText.notes).to.equal("Fast tempo recommended");
        expect(abcjsTune.metaText.notes).to.equal("Fast tempo recommended");

        // Transcription
        expect(yourTune.metaText.transcription).to.equal("John Doe, 2024");
        expect(abcjsTune.metaText.transcription).to.equal("John Doe, 2024");
      });
    });
  });

  describe("Basic Tunes", () => {
    it.skip("should parse a minimal tune identically", () => {
      const input = `X:1
T:Test
K:C
CDEF|`;

      const { tunes, ctx } = parseWithYourParser(input);

      expect(tunes).to.have.length(1);

      const tune = tunes[0];
      expect(tune.metaText.title).to.equal("Test");
      expect(tune.lineNum).to.be.greaterThan(0);
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
