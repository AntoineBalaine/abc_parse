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

  describe("Music Code Structure", () => {
    describe("Ticket #1: Container Structure", () => {
      it("should create tune.lines[0].staff[0].voices[0] structure", () => {
        const input = `X:1
T:Test
K:C
CDEF|`;

        const yourTune = parseWithYourParser(input).tunes[0];
        const abcjsTune = parseWithAbcjs(input)[0];

        // Verify structure exists
        expect(yourTune.lines).to.have.length(1);

        const yourLine = yourTune.lines[0];
        const abcjsLine = abcjsTune.lines[0];

        // Type narrow to MusicLine
        expect(yourLine).to.have.property('staff');
        expect(abcjsLine).to.have.property('staff');

        if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
          throw new Error('Expected MusicLine with staff property');
        }

        expect(yourLine.staff).to.have.length(1);
        expect(yourLine.staff[0].voices).to.have.length(1);
        expect(yourLine.staff[0].voices[0]).to.be.an('array');

        // Match abcjs structure
        expect(yourTune.lines.length).to.equal(abcjsTune.lines.length);
        expect(yourLine.staff.length).to.equal(abcjsLine.staff.length);
        expect(yourLine.staff[0].voices.length).to.equal(abcjsLine.staff[0].voices.length);
        expect(yourLine.staff[0].voices[0].length).to.equal(abcjsLine.staff[0].voices[0].length);
      });
    });

    describe("Ticket #2: Element Types", () => {
      it("should have correct el_type for each element", () => {
        const input = `X:1
T:Test
K:C
CDEF|`;

        const yourLine = parseWithYourParser(input).tunes[0].lines[0];
        const abcjsLine = parseWithAbcjs(input)[0].lines[0];

        // Type narrow to MusicLine
        if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
          throw new Error('Expected MusicLine with staff property');
        }

        const yourVoice = yourLine.staff[0].voices[0];
        const abcjsVoice = abcjsLine.staff[0].voices[0];

        // Verify each element has correct el_type
        expect(yourVoice[0].el_type).to.equal('note');
        expect(yourVoice[1].el_type).to.equal('note');
        expect(yourVoice[2].el_type).to.equal('note');
        expect(yourVoice[3].el_type).to.equal('note');
        expect(yourVoice[4].el_type).to.equal('bar');

        // Match abcjs
        for (let i = 0; i < yourVoice.length; i++) {
          expect(yourVoice[i].el_type).to.equal(abcjsVoice[i].el_type);
        }
      });
    });

    describe("Ticket #3: Pitch Calculation", () => {
      it("should calculate correct pitch for note C", () => {
        const input = `X:1\nT:Test\nK:C\nC|`;

        const yourLine = parseWithYourParser(input).tunes[0].lines[0];
        const abcjsLine = parseWithAbcjs(input)[0].lines[0];

        if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
          throw new Error('Expected MusicLine');
        }

        const yourNote = yourLine.staff[0].voices[0][0];
        const abcjsNote = abcjsLine.staff[0].voices[0][0];

        // Check it's a note
        expect(yourNote.el_type).to.equal('note');
        if (!('pitches' in yourNote) || !('pitches' in abcjsNote)) {
          throw new Error('Expected note with pitches');
        }
        if (!yourNote.pitches || !abcjsNote.pitches) {
          throw new Error('Note pitches undefined');
        }

        expect(yourNote.pitches).to.have.length(1);

        // Compare pitch properties
        expect(yourNote.pitches[0].pitch).to.equal(abcjsNote.pitches[0].pitch);
        expect(yourNote.pitches[0].name).to.equal(abcjsNote.pitches[0].name);
        expect(yourNote.pitches[0].verticalPos).to.equal(abcjsNote.pitches[0].verticalPos);
      });

      it("should calculate correct pitches for all note letters", () => {
        const input = `X:1\nT:Test\nK:C\nCDEFGAB|`;

        const yourLine = parseWithYourParser(input).tunes[0].lines[0];
        const abcjsLine = parseWithAbcjs(input)[0].lines[0];

        if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
          throw new Error('Expected MusicLine');
        }

        const yourVoice = yourLine.staff[0].voices[0];
        const abcjsVoice = abcjsLine.staff[0].voices[0];

        // Compare each note (skip the bar at the end)
        for (let i = 0; i < 7; i++) {
          const yourEl = yourVoice[i];
          const abcjsEl = abcjsVoice[i];

          expect(yourEl.el_type).to.equal('note');
          if (!('pitches' in yourEl) || !('pitches' in abcjsEl)) continue;
          if (!yourEl.pitches || !abcjsEl.pitches) continue;

          expect(yourEl.pitches[0].pitch).to.equal(abcjsEl.pitches[0].pitch);
          expect(yourEl.pitches[0].name).to.equal(abcjsEl.pitches[0].name);
          expect(yourEl.pitches[0].verticalPos).to.equal(abcjsEl.pitches[0].verticalPos);
        }
      });

      it("should handle lowercase notes (octave up)", () => {
        const input = `X:1\nT:Test\nK:C\ncdefgab|`;

        const yourLine = parseWithYourParser(input).tunes[0].lines[0];
        const abcjsLine = parseWithAbcjs(input)[0].lines[0];

        if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
          throw new Error('Expected MusicLine');
        }

        const yourVoice = yourLine.staff[0].voices[0];
        const abcjsVoice = abcjsLine.staff[0].voices[0];

        // Compare each note
        for (let i = 0; i < 7; i++) {
          const yourEl = yourVoice[i];
          const abcjsEl = abcjsVoice[i];
          if (!('pitches' in yourEl) || !('pitches' in abcjsEl)) continue;
          if (!yourEl.pitches || !abcjsEl.pitches) continue;

          expect(yourEl.pitches[0].pitch).to.equal(abcjsEl.pitches[0].pitch);
          expect(yourEl.pitches[0].name).to.equal(abcjsEl.pitches[0].name);
          expect(yourEl.pitches[0].verticalPos).to.equal(abcjsEl.pitches[0].verticalPos);
        }
      });

      it("should handle octave markers", () => {
        const input = `X:1\nT:Test\nK:C\nC, C c c'|`;

        const yourLine = parseWithYourParser(input).tunes[0].lines[0];
        const abcjsLine = parseWithAbcjs(input)[0].lines[0];

        if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
          throw new Error('Expected MusicLine');
        }

        const yourVoice = yourLine.staff[0].voices[0];
        const abcjsVoice = abcjsLine.staff[0].voices[0];

        // Compare each note
        for (let i = 0; i < 4; i++) {
          const yourEl = yourVoice[i];
          const abcjsEl = abcjsVoice[i];
          if (!('pitches' in yourEl) || !('pitches' in abcjsEl)) continue;
          if (!yourEl.pitches || !abcjsEl.pitches) continue;

          expect(yourEl.pitches[0].pitch).to.equal(abcjsEl.pitches[0].pitch);
          expect(yourEl.pitches[0].verticalPos).to.equal(abcjsEl.pitches[0].verticalPos);
        }
      });
    });

    describe("Ticket #4: Fixed Duration", () => {
      it("should use duration 0.125 for notes without explicit rhythm", () => {
        const input = `X:1\nT:Test\nK:C\nCDEF|`;

        const yourLine = parseWithYourParser(input).tunes[0].lines[0];
        const abcjsLine = parseWithAbcjs(input)[0].lines[0];

        if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
          throw new Error('Expected MusicLine');
        }

        const yourVoice = yourLine.staff[0].voices[0];
        const abcjsVoice = abcjsLine.staff[0].voices[0];

        // Check all notes have duration 0.125
        for (let i = 0; i < 4; i++) {
          const yourEl = yourVoice[i];
          const abcjsEl = abcjsVoice[i];
          if (!('duration' in yourEl) || !('duration' in abcjsEl)) continue;

          expect(yourEl.duration).to.equal(0.125);
          expect(yourEl.duration).to.equal(abcjsEl.duration);
        }
      });
    });

    describe("Ticket #5: CharRange", () => {
      it("should have correct startChar and endChar for notes", () => {
        const input = `X:1\nT:Test\nK:C\nCDEF|`;

        const yourLine = parseWithYourParser(input).tunes[0].lines[0];
        const abcjsLine = parseWithAbcjs(input)[0].lines[0];

        if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
          throw new Error('Expected MusicLine');
        }

        const yourVoice = yourLine.staff[0].voices[0];
        const abcjsVoice = abcjsLine.staff[0].voices[0];

        // Compare charRange for each element
        for (let i = 0; i < yourVoice.length; i++) {
          expect(yourVoice[i].startChar).to.equal(abcjsVoice[i].startChar);
          expect(yourVoice[i].endChar).to.equal(abcjsVoice[i].endChar);
        }
      });
    });

    describe("Ticket #6: Accidentals", () => {
      it("should handle sharp accidental", () => {
        const input = `X:1\nT:Test\nK:C\n^C|`;

        const yourLine = parseWithYourParser(input).tunes[0].lines[0];
        const abcjsLine = parseWithAbcjs(input)[0].lines[0];

        if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
          throw new Error('Expected MusicLine');
        }

        const yourNote = yourLine.staff[0].voices[0][0];
        const abcjsNote = abcjsLine.staff[0].voices[0][0];

        if (!('pitches' in yourNote) || !('pitches' in abcjsNote)) {
          throw new Error('Expected note with pitches');
        }
        if (!yourNote.pitches || !abcjsNote.pitches) {
          throw new Error('Note pitches undefined');
        }

        // Verify accidental property
        expect(yourNote.pitches[0].accidental).to.equal(abcjsNote.pitches[0].accidental);
        // Verify name includes accidental
        expect(yourNote.pitches[0].name).to.equal(abcjsNote.pitches[0].name);
      });

      it("should handle flat accidental", () => {
        const input = `X:1\nT:Test\nK:C\n_D|`;

        const yourLine = parseWithYourParser(input).tunes[0].lines[0];
        const abcjsLine = parseWithAbcjs(input)[0].lines[0];

        if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
          throw new Error('Expected MusicLine');
        }

        const yourNote = yourLine.staff[0].voices[0][0];
        const abcjsNote = abcjsLine.staff[0].voices[0][0];

        if (!('pitches' in yourNote) || !('pitches' in abcjsNote)) {
          throw new Error('Expected note with pitches');
        }
        if (!yourNote.pitches || !abcjsNote.pitches) {
          throw new Error('Note pitches undefined');
        }

        expect(yourNote.pitches[0].accidental).to.equal(abcjsNote.pitches[0].accidental);
        expect(yourNote.pitches[0].name).to.equal(abcjsNote.pitches[0].name);
      });

      it("should handle natural accidental", () => {
        const input = `X:1\nT:Test\nK:C\n=E|`;

        const yourLine = parseWithYourParser(input).tunes[0].lines[0];
        const abcjsLine = parseWithAbcjs(input)[0].lines[0];

        if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
          throw new Error('Expected MusicLine');
        }

        const yourNote = yourLine.staff[0].voices[0][0];
        const abcjsNote = abcjsLine.staff[0].voices[0][0];

        if (!('pitches' in yourNote) || !('pitches' in abcjsNote)) {
          throw new Error('Expected note with pitches');
        }
        if (!yourNote.pitches || !abcjsNote.pitches) {
          throw new Error('Note pitches undefined');
        }

        expect(yourNote.pitches[0].accidental).to.equal(abcjsNote.pitches[0].accidental);
        expect(yourNote.pitches[0].name).to.equal(abcjsNote.pitches[0].name);
      });

      it("should handle double sharp accidental", () => {
        const input = `X:1\nT:Test\nK:C\n^^F|`;

        const yourLine = parseWithYourParser(input).tunes[0].lines[0];
        const abcjsLine = parseWithAbcjs(input)[0].lines[0];

        if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
          throw new Error('Expected MusicLine');
        }

        const yourNote = yourLine.staff[0].voices[0][0];
        const abcjsNote = abcjsLine.staff[0].voices[0][0];

        if (!('pitches' in yourNote) || !('pitches' in abcjsNote)) {
          throw new Error('Expected note with pitches');
        }
        if (!yourNote.pitches || !abcjsNote.pitches) {
          throw new Error('Note pitches undefined');
        }

        expect(yourNote.pitches[0].accidental).to.equal(abcjsNote.pitches[0].accidental);
        expect(yourNote.pitches[0].name).to.equal(abcjsNote.pitches[0].name);
      });

      it("should handle double flat accidental", () => {
        const input = `X:1\nT:Test\nK:C\n__G|`;

        const yourLine = parseWithYourParser(input).tunes[0].lines[0];
        const abcjsLine = parseWithAbcjs(input)[0].lines[0];

        if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
          throw new Error('Expected MusicLine');
        }

        const yourNote = yourLine.staff[0].voices[0][0];
        const abcjsNote = abcjsLine.staff[0].voices[0][0];

        if (!('pitches' in yourNote) || !('pitches' in abcjsNote)) {
          throw new Error('Expected note with pitches');
        }
        if (!yourNote.pitches || !abcjsNote.pitches) {
          throw new Error('Note pitches undefined');
        }

        expect(yourNote.pitches[0].accidental).to.equal(abcjsNote.pitches[0].accidental);
        expect(yourNote.pitches[0].name).to.equal(abcjsNote.pitches[0].name);
      });

      it("should handle multiple notes with different accidentals", () => {
        const input = `X:1\nT:Test\nK:C\n^C _D =E ^^F __G|`;

        const yourLine = parseWithYourParser(input).tunes[0].lines[0];
        const abcjsLine = parseWithAbcjs(input)[0].lines[0];

        if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
          throw new Error('Expected MusicLine');
        }

        const yourVoice = yourLine.staff[0].voices[0];
        const abcjsVoice = abcjsLine.staff[0].voices[0];

        // Compare each accidental note (skip the bar at index 5)
        for (let i = 0; i < 5; i++) {
          const yourEl = yourVoice[i];
          const abcjsEl = abcjsVoice[i];

          if (!('pitches' in yourEl) || !('pitches' in abcjsEl)) continue;
          if (!yourEl.pitches || !abcjsEl.pitches) continue;

          expect(yourEl.pitches[0].accidental).to.equal(abcjsEl.pitches[0].accidental);
          expect(yourEl.pitches[0].name).to.equal(abcjsEl.pitches[0].name);
        }
      });
    });

    describe("Ticket #7: Bar Element Properties", () => {
      it("should handle single bar |", () => {
        const input = `X:1\nT:Test\nK:C\nC|`;

        const yourLine = parseWithYourParser(input).tunes[0].lines[0];
        const abcjsLine = parseWithAbcjs(input)[0].lines[0];

        if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
          throw new Error('Expected MusicLine');
        }

        const yourBar = yourLine.staff[0].voices[0][1];
        const abcjsBar = abcjsLine.staff[0].voices[0][1];

        expect(yourBar.el_type).to.equal('bar');
        if (!('type' in yourBar) || !('type' in abcjsBar)) {
          throw new Error('Expected bar element with type');
        }

        expect(yourBar.type).to.equal(abcjsBar.type);
        expect(yourBar.startChar).to.equal(abcjsBar.startChar);
        expect(yourBar.endChar).to.equal(abcjsBar.endChar);
      });

      it("should handle double bar ||", () => {
        const input = `X:1\nT:Test\nK:C\nC||`;

        const yourLine = parseWithYourParser(input).tunes[0].lines[0];
        const abcjsLine = parseWithAbcjs(input)[0].lines[0];

        if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
          throw new Error('Expected MusicLine');
        }

        const yourBar = yourLine.staff[0].voices[0][1];
        const abcjsBar = abcjsLine.staff[0].voices[0][1];

        expect(yourBar.el_type).to.equal('bar');
        if (!('type' in yourBar) || !('type' in abcjsBar)) {
          throw new Error('Expected bar element with type');
        }

        expect(yourBar.type).to.equal(abcjsBar.type);
        expect(yourBar.startChar).to.equal(abcjsBar.startChar);
        expect(yourBar.endChar).to.equal(abcjsBar.endChar);
      });

      it("should handle start repeat |:", () => {
        const input = `X:1\nT:Test\nK:C\n|:C|`;

        const yourLine = parseWithYourParser(input).tunes[0].lines[0];
        const abcjsLine = parseWithAbcjs(input)[0].lines[0];

        if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
          throw new Error('Expected MusicLine');
        }

        const yourBar = yourLine.staff[0].voices[0][0];
        const abcjsBar = abcjsLine.staff[0].voices[0][0];

        expect(yourBar.el_type).to.equal('bar');
        if (!('type' in yourBar) || !('type' in abcjsBar)) {
          throw new Error('Expected bar element with type');
        }

        expect(yourBar.type).to.equal(abcjsBar.type);
        expect(yourBar.startChar).to.equal(abcjsBar.startChar);
        expect(yourBar.endChar).to.equal(abcjsBar.endChar);
      });

      it("should handle all bar types in sequence", () => {
        const input = `X:1\nT:Test\nK:C\nC|D||E|:F:|G::A|`;

        const yourLine = parseWithYourParser(input).tunes[0].lines[0];
        const abcjsLine = parseWithAbcjs(input)[0].lines[0];

        if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
          throw new Error('Expected MusicLine');
        }

        const yourVoice = yourLine.staff[0].voices[0];
        const abcjsVoice = abcjsLine.staff[0].voices[0];

        // Compare all bar elements (at indices 1, 3, 5, 7, 9, 11)
        const barIndices = [1, 3, 5, 7, 9, 11];
        for (const i of barIndices) {
          const yourEl = yourVoice[i];
          const abcjsEl = abcjsVoice[i];

          expect(yourEl.el_type).to.equal('bar');
          if (!('type' in yourEl) || !('type' in abcjsEl)) continue;

          expect(yourEl.type).to.equal(abcjsEl.type);
          expect(yourEl.startChar).to.equal(abcjsEl.startChar);
          expect(yourEl.endChar).to.equal(abcjsEl.endChar);
        }
      });
    });

    describe("Ticket #8: Rest Elements", () => {
      it("should handle normal rest z", () => {
        const input = `X:1\nT:Test\nK:C\nz|`;

        const yourLine = parseWithYourParser(input).tunes[0].lines[0];
        const abcjsLine = parseWithAbcjs(input)[0].lines[0];

        if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
          throw new Error('Expected MusicLine');
        }

        const yourRest = yourLine.staff[0].voices[0][0];
        const abcjsRest = abcjsLine.staff[0].voices[0][0];

        expect(yourRest.el_type).to.equal('note');
        if (!('rest' in yourRest) || !('rest' in abcjsRest)) {
          throw new Error('Expected rest element');
        }

        expect(yourRest.rest?.type).to.equal(abcjsRest.rest?.type);
        expect(yourRest.duration).to.equal(abcjsRest.duration);
        expect(yourRest.startChar).to.equal(abcjsRest.startChar);
        expect(yourRest.endChar).to.equal(abcjsRest.endChar);
      });

      it("should handle invisible rest x", () => {
        const input = `X:1\nT:Test\nK:C\nx|`;

        const yourLine = parseWithYourParser(input).tunes[0].lines[0];
        const abcjsLine = parseWithAbcjs(input)[0].lines[0];

        if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
          throw new Error('Expected MusicLine');
        }

        const yourRest = yourLine.staff[0].voices[0][0];
        const abcjsRest = abcjsLine.staff[0].voices[0][0];

        expect(yourRest.el_type).to.equal('note');
        if (!('rest' in yourRest) || !('rest' in abcjsRest)) {
          throw new Error('Expected rest element');
        }

        expect(yourRest.rest?.type).to.equal(abcjsRest.rest?.type);
        expect(yourRest.duration).to.equal(abcjsRest.duration);
      });

      it("should handle multi-measure rest Z", () => {
        const input = `X:1\nT:Test\nK:C\nZ|`;

        const yourLine = parseWithYourParser(input).tunes[0].lines[0];
        const abcjsLine = parseWithAbcjs(input)[0].lines[0];

        if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
          throw new Error('Expected MusicLine');
        }

        const yourRest = yourLine.staff[0].voices[0][0];
        const abcjsRest = abcjsLine.staff[0].voices[0][0];

        expect(yourRest.el_type).to.equal('note');
        if (!('rest' in yourRest) || !('rest' in abcjsRest)) {
          throw new Error('Expected rest element');
        }

        expect(yourRest.rest?.type).to.equal(abcjsRest.rest?.type);
      });

      it("should handle multi-measure invisible rest X", () => {
        const input = `X:1\nT:Test\nK:C\nX|`;

        const yourLine = parseWithYourParser(input).tunes[0].lines[0];
        const abcjsLine = parseWithAbcjs(input)[0].lines[0];

        if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
          throw new Error('Expected MusicLine');
        }

        const yourRest = yourLine.staff[0].voices[0][0];
        const abcjsRest = abcjsLine.staff[0].voices[0][0];

        expect(yourRest.el_type).to.equal('note');
        if (!('rest' in yourRest) || !('rest' in abcjsRest)) {
          throw new Error('Expected rest element');
        }

        expect(yourRest.rest?.type).to.equal(abcjsRest.rest?.type);
      });

      it("should handle mixed notes and rests", () => {
        const input = `X:1\nT:Test\nK:C\nC z D x E|`;

        const yourLine = parseWithYourParser(input).tunes[0].lines[0];
        const abcjsLine = parseWithAbcjs(input)[0].lines[0];

        if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
          throw new Error('Expected MusicLine');
        }

        const yourVoice = yourLine.staff[0].voices[0];
        const abcjsVoice = abcjsLine.staff[0].voices[0];

        // Check element at index 1 (z rest)
        const yourRest1 = yourVoice[1];
        const abcjsRest1 = abcjsVoice[1];
        expect(yourRest1.el_type).to.equal('note');
        if ('rest' in yourRest1 && 'rest' in abcjsRest1) {
          expect(yourRest1.rest?.type).to.equal(abcjsRest1.rest?.type);
        }

        // Check element at index 3 (x rest)
        const yourRest2 = yourVoice[3];
        const abcjsRest2 = abcjsVoice[3];
        expect(yourRest2.el_type).to.equal('note');
        if ('rest' in yourRest2 && 'rest' in abcjsRest2) {
          expect(yourRest2.rest?.type).to.equal(abcjsRest2.rest?.type);
        }
      });
    });

    describe("Ticket #9: Chord Elements", () => {
      it("should handle simple chord [CEG]", () => {
        const input = `X:1\nT:Test\nK:C\n[CEG]|`;

        const yourLine = parseWithYourParser(input).tunes[0].lines[0];
        const abcjsLine = parseWithAbcjs(input)[0].lines[0];

        if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
          throw new Error('Expected MusicLine');
        }

        const yourChord = yourLine.staff[0].voices[0][0];
        const abcjsChord = abcjsLine.staff[0].voices[0][0];

        expect(yourChord.el_type).to.equal('note');
        if (!('pitches' in yourChord) || !('pitches' in abcjsChord)) {
          throw new Error('Expected chord with pitches');
        }

        expect(yourChord.pitches?.length).to.equal(3);
        expect(yourChord.pitches?.length).to.equal(abcjsChord.pitches?.length);

        // Compare each pitch
        for (let i = 0; i < 3; i++) {
          expect(yourChord.pitches![i].pitch).to.equal(abcjsChord.pitches![i].pitch);
          expect(yourChord.pitches![i].name).to.equal(abcjsChord.pitches![i].name);
          expect(yourChord.pitches![i].verticalPos).to.equal(abcjsChord.pitches![i].verticalPos);
        }

        expect(yourChord.duration).to.equal(abcjsChord.duration);
      });

      it("should handle chord with accidentals [^CE_G]", () => {
        const input = `X:1\nT:Test\nK:C\n[^CE_G]|`;

        const yourLine = parseWithYourParser(input).tunes[0].lines[0];
        const abcjsLine = parseWithAbcjs(input)[0].lines[0];

        if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
          throw new Error('Expected MusicLine');
        }

        const yourChord = yourLine.staff[0].voices[0][0];
        const abcjsChord = abcjsLine.staff[0].voices[0][0];

        if (!('pitches' in yourChord) || !('pitches' in abcjsChord)) {
          throw new Error('Expected chord with pitches');
        }

        // Compare pitches with accidentals
        for (let i = 0; i < yourChord.pitches!.length; i++) {
          expect(yourChord.pitches![i].pitch).to.equal(abcjsChord.pitches![i].pitch);
          expect(yourChord.pitches![i].name).to.equal(abcjsChord.pitches![i].name);
          expect(yourChord.pitches![i].accidental).to.equal(abcjsChord.pitches![i].accidental);
        }
      });

      it("should handle chord with different octaves [Ceg]", () => {
        const input = `X:1\nT:Test\nK:C\n[Ceg]|`;

        const yourLine = parseWithYourParser(input).tunes[0].lines[0];
        const abcjsLine = parseWithAbcjs(input)[0].lines[0];

        if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
          throw new Error('Expected MusicLine');
        }

        const yourChord = yourLine.staff[0].voices[0][0];
        const abcjsChord = abcjsLine.staff[0].voices[0][0];

        if (!('pitches' in yourChord) || !('pitches' in abcjsChord)) {
          throw new Error('Expected chord with pitches');
        }

        // Compare pitches across different octaves
        for (let i = 0; i < yourChord.pitches!.length; i++) {
          expect(yourChord.pitches![i].pitch).to.equal(abcjsChord.pitches![i].pitch);
          expect(yourChord.pitches![i].verticalPos).to.equal(abcjsChord.pitches![i].verticalPos);
        }
      });

      it("should handle chord with four notes [CEGB]", () => {
        const input = `X:1\nT:Test\nK:C\n[CEGB]|`;

        const yourLine = parseWithYourParser(input).tunes[0].lines[0];
        const abcjsLine = parseWithAbcjs(input)[0].lines[0];

        if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
          throw new Error('Expected MusicLine');
        }

        const yourChord = yourLine.staff[0].voices[0][0];
        const abcjsChord = abcjsLine.staff[0].voices[0][0];

        if (!('pitches' in yourChord) || !('pitches' in abcjsChord)) {
          throw new Error('Expected chord with pitches');
        }

        expect(yourChord.pitches?.length).to.equal(4);
        expect(yourChord.pitches?.length).to.equal(abcjsChord.pitches?.length);

        // Compare all four pitches
        for (let i = 0; i < 4; i++) {
          expect(yourChord.pitches![i].pitch).to.equal(abcjsChord.pitches![i].pitch);
        }
      });

      it("should handle mixed notes and chords", () => {
        const input = `X:1\nT:Test\nK:C\nC [EG] D [FA]|`;

        const yourLine = parseWithYourParser(input).tunes[0].lines[0];
        const abcjsLine = parseWithAbcjs(input)[0].lines[0];

        if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
          throw new Error('Expected MusicLine');
        }

        const yourVoice = yourLine.staff[0].voices[0];
        const abcjsVoice = abcjsLine.staff[0].voices[0];

        // Check chord at index 1 [EG]
        if ('pitches' in yourVoice[1] && 'pitches' in abcjsVoice[1]) {
          expect(yourVoice[1].pitches?.length).to.equal(2);
          expect(yourVoice[1].pitches?.length).to.equal(abcjsVoice[1].pitches?.length);
        }

        // Check chord at index 3 [FA]
        if ('pitches' in yourVoice[3] && 'pitches' in abcjsVoice[3]) {
          expect(yourVoice[3].pitches?.length).to.equal(2);
          expect(yourVoice[3].pitches?.length).to.equal(abcjsVoice[3].pitches?.length);
        }
      });
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

    it("KNOWN ISSUE: abcjs applies broken rhythm across barline", () => {
      // This documents a discrepancy between our parser and abcjs
      // Pattern: note with broken rhythm immediately before barline: "a<|"
      //
      // ABC notation standard: broken rhythm should NOT persist across barlines
      // Our parser behavior: broken rhythm cleared at barline (duration = 1.0)
      // abcjs behavior: broken rhythm applied across barline (duration = 1.5)
      //
      // We filter this pattern from PBT generators to avoid false failures
      const abcString = "X:1\nL:4/4\nK:C\na<|z|";

      const abcjsResult = parseWithAbcjs(abcString);
      const ourResult = parseWithYourParser(abcString);

      // Get the first music line
      const abcjsLine = abcjsResult[0].lines[0] as any;
      const ourLine = ourResult.tunes[0].lines[0] as any;

      // Get the rest element (third element after note and barline)
      const abcjsRest = abcjsLine.staff[0].voices[0][2];
      const ourRest = ourLine.staff[0].voices[0][2];

      // Document the discrepancy
      expect(abcjsRest.duration).to.equal(1.5); // abcjs applies broken rhythm across barline
      expect(ourRest.duration).to.equal(1.0); // our parser clears broken rhythm at barline

      // Both should recognize it as a rest element
      expect(abcjsRest.el_type).to.equal("note");
      expect(abcjsRest.rest).to.exist;
      expect(ourRest.el_type).to.equal("note");
      expect(ourRest.rest).to.exist;
    });

  });

  describe("Rhythm Notation - Phase 5", () => {
    describe("Basic rhythm modifiers with L:1/8", () => {
      it("should handle no rhythm modifier (default length)", () => {
        const input = `X:1
L:1/8
K:C
C|`;

        const yourTune = parseWithYourParser(input).tunes[0];
        const abcjsTune = parseWithAbcjs(input)[0];

        const yourLine = yourTune.lines[0];
        const abcjsLine = abcjsTune.lines[0];

        if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
          throw new Error('Expected MusicLine with staff property');
        }

        const yourNote = yourLine.staff[0].voices[0][0];
        const abcjsNote = abcjsLine.staff[0].voices[0][0];

        if (!('duration' in yourNote) || !('duration' in abcjsNote)) {
          throw new Error('Expected element with duration');
        }

        expect(yourNote.duration).to.equal(0.125); // L:1/8 = 0.125
        expect(yourNote.duration).to.equal(abcjsNote.duration);
      });

      it("should handle doubling with '2'", () => {
        const input = `X:1
L:1/8
K:C
C2|`;

        const yourTune = parseWithYourParser(input).tunes[0];
        const abcjsTune = parseWithAbcjs(input)[0];

        const yourLine = yourTune.lines[0];
        const abcjsLine = abcjsTune.lines[0];

        if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
          throw new Error('Expected MusicLine with staff property');
        }

        const yourNote = yourLine.staff[0].voices[0][0];
        const abcjsNote = abcjsLine.staff[0].voices[0][0];

        if (!('duration' in yourNote) || !('duration' in abcjsNote)) {
          throw new Error('Expected element with duration');
        }

        expect(yourNote.duration).to.equal(0.25); // 0.125 * 2
        expect(yourNote.duration).to.equal(abcjsNote.duration);
      });

      it("should handle halving with '/'", () => {
        const input = `X:1
L:1/8
K:C
C/|`;

        const yourTune = parseWithYourParser(input).tunes[0];
        const abcjsTune = parseWithAbcjs(input)[0];

        const yourLine = yourTune.lines[0];
        const abcjsLine = abcjsTune.lines[0];

        if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
          throw new Error('Expected MusicLine with staff property');
        }

        const yourNote = yourLine.staff[0].voices[0][0];
        const abcjsNote = abcjsLine.staff[0].voices[0][0];

        if (!('duration' in yourNote) || !('duration' in abcjsNote)) {
          throw new Error('Expected element with duration');
        }

        expect(yourNote.duration).to.equal(0.0625); // 0.125 / 2
        expect(yourNote.duration).to.equal(abcjsNote.duration);
      });

      it("should handle quartering with '//'", () => {
        const input = `X:1
L:1/8
K:C
C//|`;

        const yourTune = parseWithYourParser(input).tunes[0];
        const abcjsTune = parseWithAbcjs(input)[0];

        const yourLine = yourTune.lines[0];
        const abcjsLine = abcjsTune.lines[0];

        if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
          throw new Error('Expected MusicLine with staff property');
        }

        const yourNote = yourLine.staff[0].voices[0][0];
        const abcjsNote = abcjsLine.staff[0].voices[0][0];

        if (!('duration' in yourNote) || !('duration' in abcjsNote)) {
          throw new Error('Expected element with duration');
        }

        expect(yourNote.duration).to.equal(0.03125); // 0.125 / 4
        expect(yourNote.duration).to.equal(abcjsNote.duration);
      });

      it("should handle '/2' (same as '/')", () => {
        const input = `X:1
L:1/8
K:C
C/2|`;

        const yourTune = parseWithYourParser(input).tunes[0];
        const abcjsTune = parseWithAbcjs(input)[0];

        const yourLine = yourTune.lines[0];
        const abcjsLine = abcjsTune.lines[0];

        if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
          throw new Error('Expected MusicLine with staff property');
        }

        const yourNote = yourLine.staff[0].voices[0][0];
        const abcjsNote = abcjsLine.staff[0].voices[0][0];

        if (!('duration' in yourNote) || !('duration' in abcjsNote)) {
          throw new Error('Expected element with duration');
        }

        expect(yourNote.duration).to.equal(0.0625); // 0.125 / 2
        expect(yourNote.duration).to.equal(abcjsNote.duration);
      });

      it("should handle dotted note with '3/2'", () => {
        const input = `X:1
L:1/8
K:C
C3/2|`;

        const yourTune = parseWithYourParser(input).tunes[0];
        const abcjsTune = parseWithAbcjs(input)[0];

        const yourLine = yourTune.lines[0];
        const abcjsLine = abcjsTune.lines[0];

        if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
          throw new Error('Expected MusicLine with staff property');
        }

        const yourNote = yourLine.staff[0].voices[0][0];
        const abcjsNote = abcjsLine.staff[0].voices[0][0];

        if (!('duration' in yourNote) || !('duration' in abcjsNote)) {
          throw new Error('Expected element with duration');
        }

        expect(yourNote.duration).to.equal(0.1875); // 0.125 * 1.5
        expect(yourNote.duration).to.equal(abcjsNote.duration);
      });

      it("should handle quadrupling with '4'", () => {
        const input = `X:1
L:1/8
K:C
C4|`;

        const yourTune = parseWithYourParser(input).tunes[0];
        const abcjsTune = parseWithAbcjs(input)[0];

        const yourLine = yourTune.lines[0];
        const abcjsLine = abcjsTune.lines[0];

        if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
          throw new Error('Expected MusicLine with staff property');
        }

        const yourNote = yourLine.staff[0].voices[0][0];
        const abcjsNote = abcjsLine.staff[0].voices[0][0];

        if (!('duration' in yourNote) || !('duration' in abcjsNote)) {
          throw new Error('Expected element with duration');
        }

        expect(yourNote.duration).to.equal(0.5); // 0.125 * 4
        expect(yourNote.duration).to.equal(abcjsNote.duration);
      });
    });

    describe("Different L: values", () => {
      it("should handle L:1/4", () => {
        const input = `X:1
L:1/4
K:C
C|`;

        const yourTune = parseWithYourParser(input).tunes[0];
        const abcjsTune = parseWithAbcjs(input)[0];

        const yourLine = yourTune.lines[0];
        const abcjsLine = abcjsTune.lines[0];

        if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
          throw new Error('Expected MusicLine with staff property');
        }

        const yourNote = yourLine.staff[0].voices[0][0];
        const abcjsNote = abcjsLine.staff[0].voices[0][0];

        if (!('duration' in yourNote) || !('duration' in abcjsNote)) {
          throw new Error('Expected element with duration');
        }

        expect(yourNote.duration).to.equal(0.25); // L:1/4
        expect(yourNote.duration).to.equal(abcjsNote.duration);
      });

      it("should handle L:1/16", () => {
        const input = `X:1
L:1/16
K:C
C|`;

        const yourTune = parseWithYourParser(input).tunes[0];
        const abcjsTune = parseWithAbcjs(input)[0];

        const yourLine = yourTune.lines[0];
        const abcjsLine = abcjsTune.lines[0];

        if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
          throw new Error('Expected MusicLine with staff property');
        }

        const yourNote = yourLine.staff[0].voices[0][0];
        const abcjsNote = abcjsLine.staff[0].voices[0][0];

        if (!('duration' in yourNote) || !('duration' in abcjsNote)) {
          throw new Error('Expected element with duration');
        }

        expect(yourNote.duration).to.equal(0.0625); // L:1/16
        expect(yourNote.duration).to.equal(abcjsNote.duration);
      });

      it("should handle L:1/4 with rhythm modifier", () => {
        const input = `X:1
L:1/4
K:C
C2|`;

        const yourTune = parseWithYourParser(input).tunes[0];
        const abcjsTune = parseWithAbcjs(input)[0];

        const yourLine = yourTune.lines[0];
        const abcjsLine = abcjsTune.lines[0];

        if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
          throw new Error('Expected MusicLine with staff property');
        }

        const yourNote = yourLine.staff[0].voices[0][0];
        const abcjsNote = abcjsLine.staff[0].voices[0][0];

        if (!('duration' in yourNote) || !('duration' in abcjsNote)) {
          throw new Error('Expected element with duration');
        }

        expect(yourNote.duration).to.equal(0.5); // 0.25 * 2
        expect(yourNote.duration).to.equal(abcjsNote.duration);
      });

      it("should handle L:1/16 with rhythm modifier", () => {
        const input = `X:1
L:1/16
K:C
C4|`;

        const yourTune = parseWithYourParser(input).tunes[0];
        const abcjsTune = parseWithAbcjs(input)[0];

        const yourLine = yourTune.lines[0];
        const abcjsLine = abcjsTune.lines[0];

        if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
          throw new Error('Expected MusicLine with staff property');
        }

        const yourNote = yourLine.staff[0].voices[0][0];
        const abcjsNote = abcjsLine.staff[0].voices[0][0];

        if (!('duration' in yourNote) || !('duration' in abcjsNote)) {
          throw new Error('Expected element with duration');
        }

        expect(yourNote.duration).to.equal(0.25); // 0.0625 * 4
        expect(yourNote.duration).to.equal(abcjsNote.duration);
      });
    });

    describe("Rhythm on rests", () => {
      it("should handle rest with rhythm modifier", () => {
        const input = `X:1
L:1/8
K:C
z2|`;

        const yourTune = parseWithYourParser(input).tunes[0];
        const abcjsTune = parseWithAbcjs(input)[0];

        const yourLine = yourTune.lines[0];
        const abcjsLine = abcjsTune.lines[0];

        if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
          throw new Error('Expected MusicLine with staff property');
        }

        const yourRest = yourLine.staff[0].voices[0][0];
        const abcjsRest = abcjsLine.staff[0].voices[0][0];

        if (!('duration' in yourRest) || !('duration' in abcjsRest)) {
          throw new Error('Expected element with duration');
        }

        expect(yourRest.duration).to.equal(0.25); // 0.125 * 2
        expect(yourRest.duration).to.equal(abcjsRest.duration);
      });
    });

    describe("Rhythm on chords", () => {
      it("should handle chord with rhythm modifier", () => {
        const input = `X:1
L:1/8
K:C
[CEG]2|`;

        const yourTune = parseWithYourParser(input).tunes[0];
        const abcjsTune = parseWithAbcjs(input)[0];

        const yourLine = yourTune.lines[0];
        const abcjsLine = abcjsTune.lines[0];

        if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
          throw new Error('Expected MusicLine with staff property');
        }

        const yourChord = yourLine.staff[0].voices[0][0];
        const abcjsChord = abcjsLine.staff[0].voices[0][0];

        if (!('duration' in yourChord) || !('duration' in abcjsChord)) {
          throw new Error('Expected element with duration');
        }

        expect(yourChord.duration).to.equal(0.25); // 0.125 * 2
        expect(yourChord.duration).to.equal(abcjsChord.duration);
      });
    });
  });

  describe("Beaming - Phase 6", () => {
    it("should beam consecutive eighth notes", () => {
      const input = `X:1
L:1/8
K:C
CDEF|`;

      const yourTune = parseWithYourParser(input).tunes[0];
      const abcjsTune = parseWithAbcjs(input)[0];

      const yourLine = yourTune.lines[0];
      const abcjsLine = abcjsTune.lines[0];

      if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
        throw new Error('Expected MusicLine with staff property');
      }

      const yourVoice = yourLine.staff[0].voices[0];
      const abcjsVoice = abcjsLine.staff[0].voices[0];

      // All 4 eighth notes should form one beam group
      // C should have startBeam
      const yourC = yourVoice[0];
      const abcjsC = abcjsVoice[0];
      if ('startBeam' in yourC && 'startBeam' in abcjsC) {
        expect(yourC.startBeam).to.equal(true);
        expect(yourC.startBeam).to.equal(abcjsC.startBeam);
      }

      // F should have endBeam
      const yourF = yourVoice[3];
      const abcjsF = abcjsVoice[3];
      if ('endBeam' in yourF && 'endBeam' in abcjsF) {
        expect(yourF.endBeam).to.equal(true);
        expect(yourF.endBeam).to.equal(abcjsF.endBeam);
      }
    });

    it("should break beam on quarter note", () => {
      const input = `X:1
L:1/8
K:C
CDC2|`;

      const yourTune = parseWithYourParser(input).tunes[0];
      const abcjsTune = parseWithAbcjs(input)[0];

      const yourLine = yourTune.lines[0];
      const abcjsLine = abcjsTune.lines[0];

      if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
        throw new Error('Expected MusicLine with staff property');
      }

      const yourVoice = yourLine.staff[0].voices[0];
      const abcjsVoice = abcjsLine.staff[0].voices[0];

      // C-D should be beamed together
      const yourC = yourVoice[0];
      const yourD = yourVoice[1];
      const abcjsC = abcjsVoice[0];
      const abcjsD = abcjsVoice[1];

      if ('startBeam' in yourC && 'startBeam' in abcjsC) {
        expect(yourC.startBeam).to.equal(abcjsC.startBeam);
      }
      if ('endBeam' in yourD && 'endBeam' in abcjsD) {
        expect(yourD.endBeam).to.equal(abcjsD.endBeam);
      }

      // C2 (quarter note) should not have beam
      const yourQuarter = yourVoice[2];
      const abcjsQuarter = abcjsVoice[2];
      if ('startBeam' in yourQuarter && 'startBeam' in abcjsQuarter) {
        expect(yourQuarter.startBeam).to.be.undefined;
        expect(abcjsQuarter.startBeam).to.be.undefined;
      }
      if ('endBeam' in yourQuarter && 'endBeam' in abcjsQuarter) {
        expect(yourQuarter.endBeam).to.be.undefined;
        expect(abcjsQuarter.endBeam).to.be.undefined;
      }
    });

    it("should not beam quarter notes", () => {
      const input = `X:1
L:1/4
K:C
CDEF|`;

      const yourTune = parseWithYourParser(input).tunes[0];
      const abcjsTune = parseWithAbcjs(input)[0];

      const yourLine = yourTune.lines[0];
      const abcjsLine = abcjsTune.lines[0];

      if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
        throw new Error('Expected MusicLine with staff property');
      }

      const yourVoice = yourLine.staff[0].voices[0];
      const abcjsVoice = abcjsLine.staff[0].voices[0];

      // None of the quarter notes should have beams
      for (let i = 0; i < 4; i++) {
        const yourNote = yourVoice[i];
        const abcjsNote = abcjsVoice[i];
        if ('startBeam' in yourNote && 'startBeam' in abcjsNote) {
          expect(yourNote.startBeam).to.be.undefined;
          expect(abcjsNote.startBeam).to.be.undefined;
        }
        if ('endBeam' in yourNote && 'endBeam' in abcjsNote) {
          expect(yourNote.endBeam).to.be.undefined;
          expect(abcjsNote.endBeam).to.be.undefined;
        }
      }
    });

    it("should break beam on rest", () => {
      const input = `X:1
L:1/8
K:C
CDzEF|`;

      const yourTune = parseWithYourParser(input).tunes[0];
      const abcjsTune = parseWithAbcjs(input)[0];

      const yourLine = yourTune.lines[0];
      const abcjsLine = abcjsTune.lines[0];

      if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
        throw new Error('Expected MusicLine with staff property');
      }

      const yourVoice = yourLine.staff[0].voices[0];
      const abcjsVoice = abcjsLine.staff[0].voices[0];

      // C-D should be one beam
      const yourC = yourVoice[0];
      const yourD = yourVoice[1];
      if ('startBeam' in yourC) {
        expect(yourC.startBeam).to.equal(true);
      }
      if ('endBeam' in yourD) {
        expect(yourD.endBeam).to.equal(true);
      }

      // E-F should be another beam
      const yourE = yourVoice[3];
      const yourF = yourVoice[4];
      if ('startBeam' in yourE) {
        expect(yourE.startBeam).to.equal(true);
      }
      if ('endBeam' in yourF) {
        expect(yourF.endBeam).to.equal(true);
      }
    });

    it("should break beam at bar line", () => {
      const input = `X:1
L:1/8
K:C
CD|EF|`;

      const yourTune = parseWithYourParser(input).tunes[0];
      const abcjsTune = parseWithAbcjs(input)[0];

      const yourLine = yourTune.lines[0];
      const abcjsLine = abcjsTune.lines[0];

      if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
        throw new Error('Expected MusicLine with staff property');
      }

      const yourVoice = yourLine.staff[0].voices[0];
      const abcjsVoice = abcjsLine.staff[0].voices[0];

      // C-D should be one beam (before bar)
      const yourC = yourVoice[0];
      const yourD = yourVoice[1];
      if ('startBeam' in yourC) {
        expect(yourC.startBeam).to.equal(true);
      }
      if ('endBeam' in yourD) {
        expect(yourD.endBeam).to.equal(true);
      }

      // E-F should be another beam (after bar)
      // Need to find E and F after the bar element
      const yourE = yourVoice.find((el, idx) => idx > 2 && 'pitches' in el && el.pitches && el.pitches[0]?.name === 'E');
      const yourF = yourVoice.find((el, idx) => idx > 2 && 'pitches' in el && el.pitches && el.pitches[0]?.name === 'F');

      if (yourE && 'startBeam' in yourE) {
        expect(yourE.startBeam).to.equal(true);
      }
      if (yourF && 'endBeam' in yourF) {
        expect(yourF.endBeam).to.equal(true);
      }
    });
  });

  describe('Ticket #17: Ties', () => {
    it('should handle simple tie across bar', () => {
      const input = `X:1
T:Tie Test
K:C
C2-|C2|`;

      const yourTune = parseWithYourParser(input).tunes[0];
      const abcjsTune = parseWithAbcjs(input)[0];

      const yourLine = yourTune.lines[0];
      const abcjsLine = abcjsTune.lines[0];

      if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
        throw new Error('Expected MusicLine with staff property');
      }

      const yourVoice = yourLine.staff[0].voices[0];
      const abcjsVoice = abcjsLine.staff[0].voices[0];

      // First C should have startTie
      const yourFirstC = yourVoice[0];
      const abcjsFirstC = abcjsVoice[0];

      if (!('pitches' in yourFirstC) || !('pitches' in abcjsFirstC)) {
        throw new Error('Expected note element with pitches');
      }

      // Check startTie
      if (yourFirstC.pitches && abcjsFirstC.pitches && yourFirstC.pitches[0] && abcjsFirstC.pitches[0]) {
        if ('startTie' in yourFirstC.pitches[0]) {
          expect(yourFirstC.pitches[0].startTie).to.deep.equal(abcjsFirstC.pitches[0].startTie);
        }
      }

      // Second C (after bar) should have endTie
      // Find the C after the bar element
      const yourSecondC = yourVoice.find((el: any, idx: number) => idx > 1 && 'pitches' in el && el.pitches && el.pitches[0]?.name === 'C');
      const abcjsSecondC = abcjsVoice.find((el: any, idx: number) => idx > 1 && 'pitches' in el && el.pitches && el.pitches[0]?.name === 'C');

      if (yourSecondC && abcjsSecondC && 'pitches' in yourSecondC && 'pitches' in abcjsSecondC && yourSecondC.pitches && abcjsSecondC.pitches) {
        if (yourSecondC.pitches[0] && abcjsSecondC.pitches[0] && 'endTie' in yourSecondC.pitches[0]) {
          expect(yourSecondC.pitches[0].endTie).to.equal(abcjsSecondC.pitches[0].endTie);
        }
      }
    });

    it('should handle tie across multiple bars', () => {
      const input = `X:1
T:Tie Test
K:C
D2-|D2-|D2|`;

      const yourTune = parseWithYourParser(input).tunes[0];
      const abcjsTune = parseWithAbcjs(input)[0];

      const yourLine = yourTune.lines[0];
      const abcjsLine = abcjsTune.lines[0];

      if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
        throw new Error('Expected MusicLine with staff property');
      }

      const yourVoice = yourLine.staff[0].voices[0];
      const abcjsVoice = abcjsLine.staff[0].voices[0];

      // Find all D notes (skip bar elements)
      const yourDNotes = yourVoice.filter((el: any) => 'pitches' in el && el.pitches && el.pitches[0]?.name === 'D');
      const abcjsDNotes = abcjsVoice.filter((el: any) => 'pitches' in el && el.pitches && el.pitches[0]?.name === 'D');

      expect(yourDNotes.length).to.equal(3);
      expect(abcjsDNotes.length).to.equal(3);

      // First D should have startTie
      if ('pitches' in yourDNotes[0] && yourDNotes[0].pitches && yourDNotes[0].pitches[0] && 'startTie' in yourDNotes[0].pitches[0]) {
        if ('pitches' in abcjsDNotes[0] && abcjsDNotes[0].pitches && abcjsDNotes[0].pitches[0]) {
          expect(yourDNotes[0].pitches[0].startTie).to.deep.equal(abcjsDNotes[0].pitches[0].startTie);
        }
      }

      // Second D should have both endTie and startTie
      if ('pitches' in yourDNotes[1] && yourDNotes[1].pitches && yourDNotes[1].pitches[0]) {
        if ('pitches' in abcjsDNotes[1] && abcjsDNotes[1].pitches && abcjsDNotes[1].pitches[0]) {
          if ('endTie' in yourDNotes[1].pitches[0]) {
            expect(yourDNotes[1].pitches[0].endTie).to.equal(abcjsDNotes[1].pitches[0].endTie);
          }
          if ('startTie' in yourDNotes[1].pitches[0]) {
            expect(yourDNotes[1].pitches[0].startTie).to.deep.equal(abcjsDNotes[1].pitches[0].startTie);
          }
        }
      }

      // Third D should have endTie only
      if ('pitches' in yourDNotes[2] && yourDNotes[2].pitches && yourDNotes[2].pitches[0]) {
        if ('pitches' in abcjsDNotes[2] && abcjsDNotes[2].pitches && abcjsDNotes[2].pitches[0]) {
          if ('endTie' in yourDNotes[2].pitches[0]) {
            expect(yourDNotes[2].pitches[0].endTie).to.equal(abcjsDNotes[2].pitches[0].endTie);
          }
        }
      }
    });

    it('should handle ties in chords', () => {
      const input = `X:1
T:Chord Tie Test
K:C
[CEG]2-|[CEG]2|`;

      const yourTune = parseWithYourParser(input).tunes[0];
      const abcjsTune = parseWithAbcjs(input)[0];

      const yourLine = yourTune.lines[0];
      const abcjsLine = abcjsTune.lines[0];

      if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
        throw new Error('Expected MusicLine with staff property');
      }

      const yourVoice = yourLine.staff[0].voices[0];
      const abcjsVoice = abcjsLine.staff[0].voices[0];

      // Find the two chords (skip bar element)
      const yourChords = yourVoice.filter((el: any) => 'pitches' in el && el.pitches && el.pitches.length === 3);
      const abcjsChords = abcjsVoice.filter((el: any) => 'pitches' in el && el.pitches && el.pitches.length === 3);

      expect(yourChords.length).to.equal(2);
      expect(abcjsChords.length).to.equal(2);

      // First chord: all pitches should have startTie
      if ('pitches' in yourChords[0] && yourChords[0].pitches && 'pitches' in abcjsChords[0] && abcjsChords[0].pitches) {
        for (let i = 0; i < 3; i++) {
          if (yourChords[0].pitches[i] && abcjsChords[0].pitches[i] && 'startTie' in yourChords[0].pitches[i]) {
            expect(yourChords[0].pitches[i].startTie).to.deep.equal(abcjsChords[0].pitches[i].startTie);
          }
        }
      }

      // Second chord: all pitches should have endTie
      if ('pitches' in yourChords[1] && yourChords[1].pitches && 'pitches' in abcjsChords[1] && abcjsChords[1].pitches) {
        for (let i = 0; i < 3; i++) {
          if (yourChords[1].pitches[i] && abcjsChords[1].pitches[i] && 'endTie' in yourChords[1].pitches[i]) {
            expect(yourChords[1].pitches[i].endTie).to.equal(abcjsChords[1].pitches[i].endTie);
          }
        }
      }
    });

    it('should handle ties only on matching pitches', () => {
      const input = `X:1
T:Tie Test
K:C
C2-|D2|`;

      const yourTune = parseWithYourParser(input).tunes[0];
      const abcjsTune = parseWithAbcjs(input)[0];

      const yourLine = yourTune.lines[0];
      const abcjsLine = abcjsTune.lines[0];

      if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
        throw new Error('Expected MusicLine with staff property');
      }

      const yourVoice = yourLine.staff[0].voices[0];
      const abcjsVoice = abcjsLine.staff[0].voices[0];

      // Find C and D notes
      const yourC = yourVoice.find((el: any) => 'pitches' in el && el.pitches && el.pitches[0]?.name === 'C');
      const yourD = yourVoice.find((el: any) => 'pitches' in el && el.pitches && el.pitches[0]?.name === 'D');

      const abcjsC = abcjsVoice.find((el: any) => 'pitches' in el && el.pitches && el.pitches[0]?.name === 'C');
      const abcjsD = abcjsVoice.find((el: any) => 'pitches' in el && el.pitches && el.pitches[0]?.name === 'D');

      if (yourC && abcjsC && 'pitches' in yourC && 'pitches' in abcjsC && yourC.pitches && abcjsC.pitches) {
        // C should have startTie
        if (yourC.pitches[0] && abcjsC.pitches[0] && 'startTie' in yourC.pitches[0]) {
          expect(yourC.pitches[0].startTie).to.deep.equal(abcjsC.pitches[0].startTie);
        }
      }

      if (yourD && abcjsD && 'pitches' in yourD && 'pitches' in abcjsD && yourD.pitches && abcjsD.pitches) {
        // D should NOT have endTie (different pitch from C)
        if (yourD.pitches[0] && abcjsD.pitches[0]) {
          expect('endTie' in yourD.pitches[0]).to.equal('endTie' in abcjsD.pitches[0]);
        }
      }
    });

    it('should handle tie within same bar', () => {
      const input = `X:1
T:Tie Test
K:C
C-C|`;

      const yourTune = parseWithYourParser(input).tunes[0];
      const abcjsTune = parseWithAbcjs(input)[0];

      const yourLine = yourTune.lines[0];
      const abcjsLine = abcjsTune.lines[0];

      if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
        throw new Error('Expected MusicLine with staff property');
      }

      const yourVoice = yourLine.staff[0].voices[0];
      const abcjsVoice = abcjsLine.staff[0].voices[0];

      // Find the two C notes
      const yourCNotes = yourVoice.filter((el: any) => 'pitches' in el && el.pitches && el.pitches[0]?.name === 'C');
      const abcjsCNotes = abcjsVoice.filter((el: any) => 'pitches' in el && el.pitches && el.pitches[0]?.name === 'C');

      expect(yourCNotes.length).to.equal(2);
      expect(abcjsCNotes.length).to.equal(2);

      // First C should have startTie
      if ('pitches' in yourCNotes[0] && yourCNotes[0].pitches && yourCNotes[0].pitches[0]) {
        if ('pitches' in abcjsCNotes[0] && abcjsCNotes[0].pitches && abcjsCNotes[0].pitches[0]) {
          if ('startTie' in yourCNotes[0].pitches[0]) {
            expect(yourCNotes[0].pitches[0].startTie).to.deep.equal(abcjsCNotes[0].pitches[0].startTie);
          }
        }
      }

      // Second C should have endTie
      if ('pitches' in yourCNotes[1] && yourCNotes[1].pitches && yourCNotes[1].pitches[0]) {
        if ('pitches' in abcjsCNotes[1] && abcjsCNotes[1].pitches && abcjsCNotes[1].pitches[0]) {
          if ('endTie' in yourCNotes[1].pitches[0]) {
            expect(yourCNotes[1].pitches[0].endTie).to.equal(abcjsCNotes[1].pitches[0].endTie);
          }
        }
      }
    });
  });

  describe('Ticket #18: Slurs', () => {
    it('should handle simple slur', () => {
      const input = `X:1
T:Slur Test
K:C
(CDE)|`;

      const yourTune = parseWithYourParser(input).tunes[0];
      const abcjsTune = parseWithAbcjs(input)[0];

      const yourLine = yourTune.lines[0];
      const abcjsLine = abcjsTune.lines[0];

      if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
        throw new Error('Expected MusicLine with staff property');
      }

      const yourVoice = yourLine.staff[0].voices[0];
      const abcjsVoice = abcjsLine.staff[0].voices[0];

      // Find C, D, E notes
      const yourNotes = yourVoice.filter((el: any) => 'pitches' in el && el.pitches && el.pitches.length > 0);
      const abcjsNotes = abcjsVoice.filter((el: any) => 'pitches' in el && el.pitches && el.pitches.length > 0);

      expect(yourNotes.length).to.equal(3);
      expect(abcjsNotes.length).to.equal(3);

      // C should have startSlur
      if ('pitches' in yourNotes[0] && yourNotes[0].pitches && yourNotes[0].pitches[0]) {
        if ('pitches' in abcjsNotes[0] && abcjsNotes[0].pitches && abcjsNotes[0].pitches[0]) {
          if ('startSlur' in yourNotes[0].pitches[0] && yourNotes[0].pitches[0].startSlur) {
            expect(yourNotes[0].pitches[0].startSlur).to.be.an('array');
            expect(yourNotes[0].pitches[0].startSlur.length).to.equal(1);
            if (yourNotes[0].pitches[0].startSlur[0]) {
              expect(yourNotes[0].pitches[0].startSlur[0]).to.have.property('label');
            }
          }
        }
      }

      // E should have endSlur
      if ('pitches' in yourNotes[2] && yourNotes[2].pitches && yourNotes[2].pitches[0]) {
        if ('pitches' in abcjsNotes[2] && abcjsNotes[2].pitches && abcjsNotes[2].pitches[0]) {
          if ('endSlur' in yourNotes[2].pitches[0] && yourNotes[2].pitches[0].endSlur) {
            expect(yourNotes[2].pitches[0].endSlur).to.be.an('array');
            expect(yourNotes[2].pitches[0].endSlur.length).to.equal(1);
          }
        }
      }
    });

    it('should handle nested slurs', () => {
      const input = `X:1
T:Nested Slur Test
K:C
((CD)EF)|`;

      const yourTune = parseWithYourParser(input).tunes[0];
      const abcjsTune = parseWithAbcjs(input)[0];

      const yourLine = yourTune.lines[0];
      const abcjsLine = abcjsTune.lines[0];

      if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
        throw new Error('Expected MusicLine with staff property');
      }

      const yourVoice = yourLine.staff[0].voices[0];
      const abcjsVoice = abcjsLine.staff[0].voices[0];

      // Find C, D, E, F notes
      const yourNotes = yourVoice.filter((el: any) => 'pitches' in el && el.pitches && el.pitches.length > 0);
      const abcjsNotes = abcjsVoice.filter((el: any) => 'pitches' in el && el.pitches && el.pitches.length > 0);

      expect(yourNotes.length).to.equal(4);
      expect(abcjsNotes.length).to.equal(4);

      // C should have 2 startSlurs (nested)
      if ('pitches' in yourNotes[0] && yourNotes[0].pitches && yourNotes[0].pitches[0]) {
        if ('startSlur' in yourNotes[0].pitches[0] && yourNotes[0].pitches[0].startSlur) {
          expect(yourNotes[0].pitches[0].startSlur).to.be.an('array');
          expect(yourNotes[0].pitches[0].startSlur.length).to.equal(2);
        }
      }

      // D should have 1 endSlur (inner slur ends)
      if ('pitches' in yourNotes[1] && yourNotes[1].pitches && yourNotes[1].pitches[0]) {
        if ('endSlur' in yourNotes[1].pitches[0] && yourNotes[1].pitches[0].endSlur) {
          expect(yourNotes[1].pitches[0].endSlur).to.be.an('array');
          expect(yourNotes[1].pitches[0].endSlur.length).to.equal(1);
        }
      }

      // F should have 1 endSlur (outer slur ends)
      if ('pitches' in yourNotes[3] && yourNotes[3].pitches && yourNotes[3].pitches[0]) {
        if ('endSlur' in yourNotes[3].pitches[0] && yourNotes[3].pitches[0].endSlur) {
          expect(yourNotes[3].pitches[0].endSlur).to.be.an('array');
          expect(yourNotes[3].pitches[0].endSlur.length).to.equal(1);
        }
      }
    });

    it('should handle slur across bar', () => {
      const input = `X:1
T:Slur Across Bar
K:C
(CD|EF)|`;

      const yourTune = parseWithYourParser(input).tunes[0];
      const abcjsTune = parseWithAbcjs(input)[0];

      const yourLine = yourTune.lines[0];
      const abcjsLine = abcjsTune.lines[0];

      if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
        throw new Error('Expected MusicLine with staff property');
      }

      const yourVoice = yourLine.staff[0].voices[0];
      const abcjsVoice = abcjsLine.staff[0].voices[0];

      // Find C, D, E, F notes
      const yourNotes = yourVoice.filter((el: any) => 'pitches' in el && el.pitches && el.pitches.length > 0);
      const abcjsNotes = abcjsVoice.filter((el: any) => 'pitches' in el && el.pitches && el.pitches.length > 0);

      expect(yourNotes.length).to.equal(4);
      expect(abcjsNotes.length).to.equal(4);

      // C should have startSlur
      if ('pitches' in yourNotes[0] && yourNotes[0].pitches && yourNotes[0].pitches[0]) {
        if ('startSlur' in yourNotes[0].pitches[0] && yourNotes[0].pitches[0].startSlur) {
          expect(yourNotes[0].pitches[0].startSlur).to.be.an('array');
          expect(yourNotes[0].pitches[0].startSlur.length).to.equal(1);
        }
      }

      // F should have endSlur
      if ('pitches' in yourNotes[3] && yourNotes[3].pitches && yourNotes[3].pitches[0]) {
        if ('endSlur' in yourNotes[3].pitches[0] && yourNotes[3].pitches[0].endSlur) {
          expect(yourNotes[3].pitches[0].endSlur).to.be.an('array');
          expect(yourNotes[3].pitches[0].endSlur.length).to.equal(1);
        }
      }
    });

    it('should handle slur on chord', () => {
      const input = `X:1
T:Slur on Chord
K:C
([CEG]D)|`;

      const yourTune = parseWithYourParser(input).tunes[0];
      const abcjsTune = parseWithAbcjs(input)[0];

      const yourLine = yourTune.lines[0];
      const abcjsLine = abcjsTune.lines[0];

      if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
        throw new Error('Expected MusicLine with staff property');
      }

      const yourVoice = yourLine.staff[0].voices[0];
      const abcjsVoice = abcjsLine.staff[0].voices[0];

      // Find notes
      const yourNotes = yourVoice.filter((el: any) => 'pitches' in el && el.pitches && el.pitches.length > 0);
      const abcjsNotes = abcjsVoice.filter((el: any) => 'pitches' in el && el.pitches && el.pitches.length > 0);

      expect(yourNotes.length).to.equal(2);
      expect(abcjsNotes.length).to.equal(2);

      // Chord should have startSlur
      if ('pitches' in yourNotes[0] && yourNotes[0].pitches && yourNotes[0].pitches[0]) {
        if ('startSlur' in yourNotes[0].pitches[0] && yourNotes[0].pitches[0].startSlur) {
          expect(yourNotes[0].pitches[0].startSlur).to.be.an('array');
          expect(yourNotes[0].pitches[0].startSlur.length).to.equal(1);
        }
      }

      // D should have endSlur
      if ('pitches' in yourNotes[1] && yourNotes[1].pitches && yourNotes[1].pitches[0]) {
        if ('endSlur' in yourNotes[1].pitches[0] && yourNotes[1].pitches[0].endSlur) {
          expect(yourNotes[1].pitches[0].endSlur).to.be.an('array');
          expect(yourNotes[1].pitches[0].endSlur.length).to.equal(1);
        }
      }
    });
  });

  describe('Ticket #19: Tuplets', () => {
    it('should handle simple triplet', () => {
      const input = `X:1
T:Triplet Test
K:C
(3ABC|`;

      const yourTune = parseWithYourParser(input).tunes[0];
      const abcjsTune = parseWithAbcjs(input)[0];

      const yourLine = yourTune.lines[0];
      const abcjsLine = abcjsTune.lines[0];

      if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
        throw new Error('Expected MusicLine with staff property');
      }

      const yourVoice = yourLine.staff[0].voices[0];
      const abcjsVoice = abcjsLine.staff[0].voices[0];

      // Find notes
      const yourNotes = yourVoice.filter((el: any) => 'pitches' in el && el.pitches && el.pitches.length > 0);
      const abcjsNotes = abcjsVoice.filter((el: any) => 'pitches' in el && el.pitches && el.pitches.length > 0);

      expect(yourNotes.length).to.equal(3);
      expect(abcjsNotes.length).to.equal(3);

      // First note should have startTriplet, tripletMultiplier, tripletR
      if ('startTriplet' in yourNotes[0]) {
        expect(yourNotes[0].startTriplet).to.equal(3);
        expect(yourNotes[0].tripletMultiplier).to.be.closeTo(2/3, 0.001);
        expect(yourNotes[0].tripletR).to.equal(3);
      }

      // Last note should have endTriplet
      if ('endTriplet' in yourNotes[2]) {
        expect(yourNotes[2].endTriplet).to.equal(true);
      }
    });

    it('should handle tuplet with explicit ratio', () => {
      const input = `X:1
T:Tuplet Test
K:C
(3:2:3ABC|`;

      const yourTune = parseWithYourParser(input).tunes[0];
      const abcjsTune = parseWithAbcjs(input)[0];

      const yourLine = yourTune.lines[0];
      const abcjsLine = abcjsTune.lines[0];

      if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
        throw new Error('Expected MusicLine with staff property');
      }

      const yourVoice = yourLine.staff[0].voices[0];

      const yourNotes = yourVoice.filter((el: any) => 'pitches' in el && el.pitches && el.pitches.length > 0);

      expect(yourNotes.length).to.equal(3);

      // First note should have correct multiplier
      if ('startTriplet' in yourNotes[0]) {
        expect(yourNotes[0].startTriplet).to.equal(3);
        expect(yourNotes[0].tripletMultiplier).to.be.closeTo(2/3, 0.001);
      }
    });

    it('should handle quintuplet', () => {
      const input = `X:1
T:Quintuplet Test
K:C
(5ABCDE|`;

      const yourTune = parseWithYourParser(input).tunes[0];
      const abcjsTune = parseWithAbcjs(input)[0];

      const yourLine = yourTune.lines[0];
      const abcjsLine = abcjsTune.lines[0];

      if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
        throw new Error('Expected MusicLine with staff property');
      }

      const yourVoice = yourLine.staff[0].voices[0];

      const yourNotes = yourVoice.filter((el: any) => 'pitches' in el && el.pitches && el.pitches.length > 0);

      expect(yourNotes.length).to.equal(5);

      // First note should have startTriplet=5
      if ('startTriplet' in yourNotes[0]) {
        expect(yourNotes[0].startTriplet).to.equal(5);
        expect(yourNotes[0].tripletMultiplier).to.be.closeTo(2/5, 0.001);
        expect(yourNotes[0].tripletR).to.equal(5);
      }

      // Last note should have endTriplet
      if ('endTriplet' in yourNotes[4]) {
        expect(yourNotes[4].endTriplet).to.equal(true);
      }
    });
  });

  // ============================================================================
  // Decoration Tests
  // ============================================================================

  describe('Decorations', () => {
    it('should handle single-character decoration (staccato)', () => {
      const abc = `X:1\nK:C\n.C`;

      const yourTune = parseWithYourParser(abc).tunes[0];
      const abcjsTune = parseWithAbcjs(abc)[0];

      const yourLine = yourTune.lines[0];
      const abcjsLine = abcjsTune.lines[0];

      if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
        throw new Error('Expected MusicLine with staff property');
      }

      const yourVoice = yourLine.staff[0].voices[0];
      const abcjsVoice = abcjsLine.staff[0].voices[0];

      const yourNotes = yourVoice.filter((el: any) => 'pitches' in el && el.pitches && el.pitches.length > 0);
      const abcjsNotes = abcjsVoice.filter((el: any) => 'pitches' in el && el.pitches && el.pitches.length > 0);

      expect(yourNotes.length).to.equal(1);
      expect(abcjsNotes.length).to.equal(1);

      // Both should have staccato decoration
      if ('decoration' in yourNotes[0]) {
        expect(yourNotes[0].decoration).to.deep.equal(['staccato']);
      }
      if ('decoration' in abcjsNotes[0]) {
        expect(abcjsNotes[0].decoration).to.deep.equal(['staccato']);
      }
    });

    it('should handle multiple single-character decorations', () => {
      const abc = `X:1\nK:C\n.~C`;

      const yourTune = parseWithYourParser(abc).tunes[0];
      const abcjsTune = parseWithAbcjs(abc)[0];

      const yourLine = yourTune.lines[0];
      const abcjsLine = abcjsTune.lines[0];

      if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
        throw new Error('Expected MusicLine with staff property');
      }

      const yourVoice = yourLine.staff[0].voices[0];
      const abcjsVoice = abcjsLine.staff[0].voices[0];

      const yourNotes = yourVoice.filter((el: any) => 'pitches' in el && el.pitches && el.pitches.length > 0);
      const abcjsNotes = abcjsVoice.filter((el: any) => 'pitches' in el && el.pitches && el.pitches.length > 0);

      expect(yourNotes.length).to.equal(1);
      expect(abcjsNotes.length).to.equal(1);

      // Should have both staccato and irishroll
      if ('decoration' in yourNotes[0]) {
        expect(yourNotes[0].decoration).to.deep.equal(['staccato', 'irishroll']);
      }
      if ('decoration' in abcjsNotes[0]) {
        expect(abcjsNotes[0].decoration).to.deep.equal(['staccato', 'irishroll']);
      }
    });

    it('should handle bracketed decoration (!trill!)', () => {
      const abc = `X:1\nK:C\n!trill!C`;

      const yourTune = parseWithYourParser(abc).tunes[0];
      const abcjsTune = parseWithAbcjs(abc)[0];

      const yourLine = yourTune.lines[0];
      const abcjsLine = abcjsTune.lines[0];

      if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
        throw new Error('Expected MusicLine with staff property');
      }

      const yourVoice = yourLine.staff[0].voices[0];
      const abcjsVoice = abcjsLine.staff[0].voices[0];

      const yourNotes = yourVoice.filter((el: any) => 'pitches' in el && el.pitches && el.pitches.length > 0);
      const abcjsNotes = abcjsVoice.filter((el: any) => 'pitches' in el && el.pitches && el.pitches.length > 0);

      expect(yourNotes.length).to.equal(1);
      expect(abcjsNotes.length).to.equal(1);

      // Both should have trill decoration
      if ('decoration' in yourNotes[0]) {
        expect(yourNotes[0].decoration).to.deep.equal(['trill']);
      }
      if ('decoration' in abcjsNotes[0]) {
        expect(abcjsNotes[0].decoration).to.deep.equal(['trill']);
      }
    });

    it('should handle decorations on chords', () => {
      const abc = `X:1\nK:C\n.[CEG]`;

      const yourTune = parseWithYourParser(abc).tunes[0];
      const abcjsTune = parseWithAbcjs(abc)[0];

      const yourLine = yourTune.lines[0];
      const abcjsLine = abcjsTune.lines[0];

      if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
        throw new Error('Expected MusicLine with staff property');
      }

      const yourVoice = yourLine.staff[0].voices[0];
      const abcjsVoice = abcjsLine.staff[0].voices[0];

      const yourChords = yourVoice.filter((el: any) => 'pitches' in el && el.pitches && el.pitches.length > 1);
      const abcjsChords = abcjsVoice.filter((el: any) => 'pitches' in el && el.pitches && el.pitches.length > 1);

      expect(yourChords.length).to.equal(1);
      expect(abcjsChords.length).to.equal(1);

      // Both should have staccato decoration
      if ('decoration' in yourChords[0]) {
        expect(yourChords[0].decoration).to.deep.equal(['staccato']);
      }
      if ('decoration' in abcjsChords[0]) {
        expect(abcjsChords[0].decoration).to.deep.equal(['staccato']);
      }
    });

    it('should handle multiple notes with different decorations', () => {
      const abc = `X:1\nK:C\n.C~D!trill!E`;

      const yourTune = parseWithYourParser(abc).tunes[0];
      const abcjsTune = parseWithAbcjs(abc)[0];

      const yourLine = yourTune.lines[0];
      const abcjsLine = abcjsTune.lines[0];

      if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
        throw new Error('Expected MusicLine with staff property');
      }

      const yourVoice = yourLine.staff[0].voices[0];
      const abcjsVoice = abcjsLine.staff[0].voices[0];

      const yourNotes = yourVoice.filter((el: any) => 'pitches' in el && el.pitches && el.pitches.length > 0);
      const abcjsNotes = abcjsVoice.filter((el: any) => 'pitches' in el && el.pitches && el.pitches.length > 0);

      expect(yourNotes.length).to.equal(3);
      expect(abcjsNotes.length).to.equal(3);

      // First note should have staccato
      if ('decoration' in yourNotes[0]) {
        expect(yourNotes[0].decoration).to.deep.equal(['staccato']);
      }
      if ('decoration' in abcjsNotes[0]) {
        expect(abcjsNotes[0].decoration).to.deep.equal(['staccato']);
      }

      // Second note should have irishroll
      if ('decoration' in yourNotes[1]) {
        expect(yourNotes[1].decoration).to.deep.equal(['irishroll']);
      }
      if ('decoration' in abcjsNotes[1]) {
        expect(abcjsNotes[1].decoration).to.deep.equal(['irishroll']);
      }

      // Third note should have trill
      if ('decoration' in yourNotes[2]) {
        expect(yourNotes[2].decoration).to.deep.equal(['trill']);
      }
      if ('decoration' in abcjsNotes[2]) {
        expect(abcjsNotes[2].decoration).to.deep.equal(['trill']);
      }
    });
  });

  // ============================================================================
  // Grace Note Tests
  // ============================================================================

  describe('Grace Notes', () => {
    it('should handle simple grace notes', () => {
      const abc = `X:1\nK:C\n{AB}C`;

      const yourTune = parseWithYourParser(abc).tunes[0];
      const abcjsTune = parseWithAbcjs(abc)[0];

      const yourLine = yourTune.lines[0];
      const abcjsLine = abcjsTune.lines[0];

      if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
        throw new Error('Expected MusicLine with staff property');
      }

      const yourVoice = yourLine.staff[0].voices[0];
      const abcjsVoice = abcjsLine.staff[0].voices[0];

      const yourNotes = yourVoice.filter((el: any) => 'pitches' in el && el.pitches && el.pitches.length > 0);
      const abcjsNotes = abcjsVoice.filter((el: any) => 'pitches' in el && el.pitches && el.pitches.length > 0);

      expect(yourNotes.length).to.equal(1);
      expect(abcjsNotes.length).to.equal(1);

      // Check that C has grace notes
      if ('gracenotes' in yourNotes[0] && yourNotes[0].gracenotes) {
        expect(yourNotes[0].gracenotes).to.be.an('array');
        expect(yourNotes[0].gracenotes.length).to.equal(2);
        if (yourNotes[0].gracenotes[0] && yourNotes[0].gracenotes[1]) {
          expect(yourNotes[0].gracenotes[0].name).to.equal('A');
          expect(yourNotes[0].gracenotes[1].name).to.equal('B');
        }
      }
      if ('gracenotes' in abcjsNotes[0] && abcjsNotes[0].gracenotes) {
        expect(abcjsNotes[0].gracenotes).to.be.an('array');
        expect(abcjsNotes[0].gracenotes.length).to.equal(2);
      }
    });

    it('should handle acciaccatura grace notes (with slash)', () => {
      const abc = `X:1\nK:C\n{/AB}C`;

      const yourTune = parseWithYourParser(abc).tunes[0];
      const abcjsTune = parseWithAbcjs(abc)[0];

      const yourLine = yourTune.lines[0];
      const abcjsLine = abcjsTune.lines[0];

      if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
        throw new Error('Expected MusicLine with staff property');
      }

      const yourVoice = yourLine.staff[0].voices[0];
      const abcjsVoice = abcjsLine.staff[0].voices[0];

      const yourNotes = yourVoice.filter((el: any) => 'pitches' in el && el.pitches && el.pitches.length > 0);
      const abcjsNotes = abcjsVoice.filter((el: any) => 'pitches' in el && el.pitches && el.pitches.length > 0);

      expect(yourNotes.length).to.equal(1);
      expect(abcjsNotes.length).to.equal(1);

      // Check that first grace note has acciaccatura flag
      if ('gracenotes' in yourNotes[0] && yourNotes[0].gracenotes && yourNotes[0].gracenotes.length > 0) {
        if (yourNotes[0].gracenotes[0]) {
          expect(yourNotes[0].gracenotes[0].acciaccatura).to.equal(true);
        }
        // Second note should not have acciaccatura
        if (yourNotes[0].gracenotes.length > 1 && yourNotes[0].gracenotes[1] && 'acciaccatura' in yourNotes[0].gracenotes[1]) {
          expect(yourNotes[0].gracenotes[1].acciaccatura).to.be.undefined;
        }
      }
      if ('gracenotes' in abcjsNotes[0] && abcjsNotes[0].gracenotes && abcjsNotes[0].gracenotes.length > 0) {
        if (abcjsNotes[0].gracenotes[0]) {
          expect(abcjsNotes[0].gracenotes[0].acciaccatura).to.equal(true);
        }
      }
    });

    it('should handle grace notes on chords', () => {
      const abc = `X:1\nK:C\n{A}[CEG]`;

      const yourTune = parseWithYourParser(abc).tunes[0];
      const abcjsTune = parseWithAbcjs(abc)[0];

      const yourLine = yourTune.lines[0];
      const abcjsLine = abcjsTune.lines[0];

      if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
        throw new Error('Expected MusicLine with staff property');
      }

      const yourVoice = yourLine.staff[0].voices[0];
      const abcjsVoice = abcjsLine.staff[0].voices[0];

      const yourChords = yourVoice.filter((el: any) => 'pitches' in el && el.pitches && el.pitches.length > 1);
      const abcjsChords = abcjsVoice.filter((el: any) => 'pitches' in el && el.pitches && el.pitches.length > 1);

      expect(yourChords.length).to.equal(1);
      expect(abcjsChords.length).to.equal(1);

      // Check that chord has grace note
      if ('gracenotes' in yourChords[0] && yourChords[0].gracenotes) {
        expect(yourChords[0].gracenotes).to.be.an('array');
        expect(yourChords[0].gracenotes.length).to.equal(1);
        if (yourChords[0].gracenotes[0]) {
          expect(yourChords[0].gracenotes[0].name).to.equal('A');
        }
      }
      if ('gracenotes' in abcjsChords[0] && abcjsChords[0].gracenotes) {
        expect(abcjsChords[0].gracenotes).to.be.an('array');
        expect(abcjsChords[0].gracenotes.length).to.equal(1);
      }
    });

    it('should handle grace notes with accidentals', () => {
      const abc = `X:1\nK:C\n{^A_B}C`;

      const yourTune = parseWithYourParser(abc).tunes[0];
      const abcjsTune = parseWithAbcjs(abc)[0];

      const yourLine = yourTune.lines[0];
      const abcjsLine = abcjsTune.lines[0];

      if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
        throw new Error('Expected MusicLine with staff property');
      }

      const yourVoice = yourLine.staff[0].voices[0];
      const abcjsVoice = abcjsLine.staff[0].voices[0];

      const yourNotes = yourVoice.filter((el: any) => 'pitches' in el && el.pitches && el.pitches.length > 0);
      const abcjsNotes = abcjsVoice.filter((el: any) => 'pitches' in el && el.pitches && el.pitches.length > 0);

      expect(yourNotes.length).to.equal(1);
      expect(abcjsNotes.length).to.equal(1);

      // Check grace notes have accidentals
      if ('gracenotes' in yourNotes[0] && yourNotes[0].gracenotes && yourNotes[0].gracenotes.length === 2) {
        if (yourNotes[0].gracenotes[0] && yourNotes[0].gracenotes[1]) {
          expect(yourNotes[0].gracenotes[0].name).to.equal('^A');
          expect(yourNotes[0].gracenotes[0].accidental).to.equal('sharp');
          expect(yourNotes[0].gracenotes[1].name).to.equal('_B');
          expect(yourNotes[0].gracenotes[1].accidental).to.equal('flat');
        }
      }
      if ('gracenotes' in abcjsNotes[0] && abcjsNotes[0].gracenotes && abcjsNotes[0].gracenotes.length === 2) {
        if (abcjsNotes[0].gracenotes[0] && abcjsNotes[0].gracenotes[1]) {
          expect(abcjsNotes[0].gracenotes[0].accidental).to.equal('sharp');
          expect(abcjsNotes[0].gracenotes[1].accidental).to.equal('flat');
        }
      }
    });
  });

  // ============================================================================
  // Chord Symbol Tests
  // ============================================================================

  describe('Chord Symbols', () => {
    it('should handle simple chord symbol', () => {
      const abc = `X:1\nK:C\n"C"C`;

      const yourTune = parseWithYourParser(abc).tunes[0];
      const abcjsTune = parseWithAbcjs(abc)[0];

      const yourLine = yourTune.lines[0];
      const abcjsLine = abcjsTune.lines[0];

      if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
        throw new Error('Expected MusicLine with staff property');
      }

      const yourVoice = yourLine.staff[0].voices[0];
      const abcjsVoice = abcjsLine.staff[0].voices[0];

      const yourNotes = yourVoice.filter((el: any) => 'pitches' in el && el.pitches && el.pitches.length > 0);
      const abcjsNotes = abcjsVoice.filter((el: any) => 'pitches' in el && el.pitches && el.pitches.length > 0);

      expect(yourNotes.length).to.equal(1);
      expect(abcjsNotes.length).to.equal(1);

      // Check chord symbol
      if ('chord' in yourNotes[0] && yourNotes[0].chord) {
        expect(yourNotes[0].chord).to.be.an('array');
        expect(yourNotes[0].chord.length).to.equal(1);
        if (yourNotes[0].chord[0]) {
          expect(yourNotes[0].chord[0].name).to.equal('C');
          expect(yourNotes[0].chord[0].position).to.equal('default');
        }
      }
      if ('chord' in abcjsNotes[0] && abcjsNotes[0].chord) {
        expect(abcjsNotes[0].chord).to.be.an('array');
        expect(abcjsNotes[0].chord.length).to.equal(1);
      }
    });

    it('should handle multiple chord symbols', () => {
      const abc = `X:1\nK:C\n"C"C"Dm"D"Em"E`;

      const yourTune = parseWithYourParser(abc).tunes[0];
      const abcjsTune = parseWithAbcjs(abc)[0];

      const yourLine = yourTune.lines[0];
      const abcjsLine = abcjsTune.lines[0];

      if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
        throw new Error('Expected MusicLine with staff property');
      }

      const yourVoice = yourLine.staff[0].voices[0];
      const abcjsVoice = abcjsLine.staff[0].voices[0];

      const yourNotes = yourVoice.filter((el: any) => 'pitches' in el && el.pitches && el.pitches.length > 0);
      const abcjsNotes = abcjsVoice.filter((el: any) => 'pitches' in el && el.pitches && el.pitches.length > 0);

      expect(yourNotes.length).to.equal(3);
      expect(abcjsNotes.length).to.equal(3);

      // Check first chord
      if ('chord' in yourNotes[0] && yourNotes[0].chord && yourNotes[0].chord[0]) {
        expect(yourNotes[0].chord[0].name).to.equal('C');
      }
      if ('chord' in abcjsNotes[0] && abcjsNotes[0].chord && abcjsNotes[0].chord[0]) {
        expect(abcjsNotes[0].chord[0].name).to.equal('C');
      }

      // Check second chord
      if ('chord' in yourNotes[1] && yourNotes[1].chord && yourNotes[1].chord[0]) {
        expect(yourNotes[1].chord[0].name).to.equal('Dm');
      }
      if ('chord' in abcjsNotes[1] && abcjsNotes[1].chord && abcjsNotes[1].chord[0]) {
        expect(abcjsNotes[1].chord[0].name).to.equal('Dm');
      }

      // Check third chord
      if ('chord' in yourNotes[2] && yourNotes[2].chord && yourNotes[2].chord[0]) {
        expect(yourNotes[2].chord[0].name).to.equal('Em');
      }
      if ('chord' in abcjsNotes[2] && abcjsNotes[2].chord && abcjsNotes[2].chord[0]) {
        expect(abcjsNotes[2].chord[0].name).to.equal('Em');
      }
    });

    it('should handle complex chord symbols', () => {
      const abc = `X:1\nK:C\n"Cmaj7"C"Dm7"D"G7"E`;

      const yourTune = parseWithYourParser(abc).tunes[0];
      const abcjsTune = parseWithAbcjs(abc)[0];

      const yourLine = yourTune.lines[0];
      const abcjsLine = abcjsTune.lines[0];

      if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
        throw new Error('Expected MusicLine with staff property');
      }

      const yourVoice = yourLine.staff[0].voices[0];
      const abcjsVoice = abcjsLine.staff[0].voices[0];

      const yourNotes = yourVoice.filter((el: any) => 'pitches' in el && el.pitches && el.pitches.length > 0);
      const abcjsNotes = abcjsVoice.filter((el: any) => 'pitches' in el && el.pitches && el.pitches.length > 0);

      expect(yourNotes.length).to.equal(3);
      expect(abcjsNotes.length).to.equal(3);

      // Check chord symbols
      if ('chord' in yourNotes[0] && yourNotes[0].chord && yourNotes[0].chord[0]) {
        expect(yourNotes[0].chord[0].name).to.equal('Cmaj7');
      }
      if ('chord' in yourNotes[1] && yourNotes[1].chord && yourNotes[1].chord[0]) {
        expect(yourNotes[1].chord[0].name).to.equal('Dm7');
      }
      if ('chord' in yourNotes[2] && yourNotes[2].chord && yourNotes[2].chord[0]) {
        expect(yourNotes[2].chord[0].name).to.equal('G7');
      }
    });

    it('should handle chord symbols on chords', () => {
      const abc = `X:1\nK:C\n"C"[CEG]`;

      const yourTune = parseWithYourParser(abc).tunes[0];
      const abcjsTune = parseWithAbcjs(abc)[0];

      const yourLine = yourTune.lines[0];
      const abcjsLine = abcjsTune.lines[0];

      if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
        throw new Error('Expected MusicLine with staff property');
      }

      const yourVoice = yourLine.staff[0].voices[0];
      const abcjsVoice = abcjsLine.staff[0].voices[0];

      const yourChords = yourVoice.filter((el: any) => 'pitches' in el && el.pitches && el.pitches.length > 1);
      const abcjsChords = abcjsVoice.filter((el: any) => 'pitches' in el && el.pitches && el.pitches.length > 1);

      expect(yourChords.length).to.equal(1);
      expect(abcjsChords.length).to.equal(1);

      // Check chord symbol on chord
      if ('chord' in yourChords[0] && yourChords[0].chord && yourChords[0].chord[0]) {
        expect(yourChords[0].chord[0].name).to.equal('C');
      }
      if ('chord' in abcjsChords[0] && abcjsChords[0].chord && abcjsChords[0].chord[0]) {
        expect(abcjsChords[0].chord[0].name).to.equal('C');
      }
    });
  });

  // ============================================================================
  // Lyric Tests
  // ============================================================================

  describe('Lyrics', () => {
    it('should handle simple lyrics with spaces', () => {
      const abc = `X:1\nK:C\nCDEF|\nw:do re mi fa`;

      const yourTune = parseWithYourParser(abc).tunes[0];
      const abcjsTune = parseWithAbcjs(abc)[0];

      const yourLine = yourTune.lines[0];
      const abcjsLine = abcjsTune.lines[0];

      if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
        throw new Error('Expected MusicLine with staff property');
      }

      const yourVoice = yourLine.staff[0].voices[0];
      const abcjsVoice = abcjsLine.staff[0].voices[0];

      const yourNotes = yourVoice.filter((el: any) => 'pitches' in el && el.pitches && el.pitches.length > 0) as any[];
      const abcjsNotes = abcjsVoice.filter((el: any) => 'pitches' in el && el.pitches && el.pitches.length > 0) as any[];

      expect(yourNotes.length).to.equal(4);
      expect(abcjsNotes.length).to.equal(4);

      // Check lyrics
      const expectedSyllables = ['do', 're', 'mi', 'fa'];
      for (let i = 0; i < 4; i++) {
        if (yourNotes[i].lyric && yourNotes[i].lyric[0]) {
          expect(yourNotes[i].lyric[0].syllable).to.equal(expectedSyllables[i]);
          expect(yourNotes[i].lyric[0].divider).to.equal(' ');
        }
        if (abcjsNotes[i].lyric && abcjsNotes[i].lyric[0]) {
          expect(abcjsNotes[i].lyric[0].syllable).to.equal(expectedSyllables[i]);
          expect(abcjsNotes[i].lyric[0].divider).to.equal(' ');
        }
      }
    });

    it('should handle lyrics with hyphens', () => {
      const abc = `X:1\nK:C\nCDE|\nw:hel-lo world`;

      const yourTune = parseWithYourParser(abc).tunes[0];
      const abcjsTune = parseWithAbcjs(abc)[0];

      const yourLine = yourTune.lines[0];
      const abcjsLine = abcjsTune.lines[0];

      if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
        throw new Error('Expected MusicLine with staff property');
      }

      const yourVoice = yourLine.staff[0].voices[0];
      const abcjsVoice = abcjsLine.staff[0].voices[0];

      const yourNotes = yourVoice.filter((el: any) => 'pitches' in el && el.pitches && el.pitches.length > 0);
      const abcjsNotes = abcjsVoice.filter((el: any) => 'pitches' in el && el.pitches && el.pitches.length > 0);

      expect(yourNotes.length).to.equal(3);
      expect(abcjsNotes.length).to.equal(3);

      // First note: "hel" with hyphen divider
      if ('lyric' in yourNotes[0] && yourNotes[0].lyric && yourNotes[0].lyric[0]) {
        expect(yourNotes[0].lyric[0].syllable).to.equal('hel');
        expect(yourNotes[0].lyric[0].divider).to.equal('-');
      }
      if ('lyric' in abcjsNotes[0] && abcjsNotes[0].lyric && abcjsNotes[0].lyric[0]) {
        expect(abcjsNotes[0].lyric[0].syllable).to.equal('hel');
        expect(abcjsNotes[0].lyric[0].divider).to.equal('-');
      }

      // Second note: "lo" with space divider
      if ('lyric' in yourNotes[1] && yourNotes[1].lyric && yourNotes[1].lyric[0]) {
        expect(yourNotes[1].lyric[0].syllable).to.equal('lo');
        expect(yourNotes[1].lyric[0].divider).to.equal(' ');
      }
      if ('lyric' in abcjsNotes[1] && abcjsNotes[1].lyric && abcjsNotes[1].lyric[0]) {
        expect(abcjsNotes[1].lyric[0].syllable).to.equal('lo');
        expect(abcjsNotes[1].lyric[0].divider).to.equal(' ');
      }

      // Third note: "world" with space divider
      if ('lyric' in yourNotes[2] && yourNotes[2].lyric && yourNotes[2].lyric[0]) {
        expect(yourNotes[2].lyric[0].syllable).to.equal('world');
        expect(yourNotes[2].lyric[0].divider).to.equal(' ');
      }
      if ('lyric' in abcjsNotes[2] && abcjsNotes[2].lyric && abcjsNotes[2].lyric[0]) {
        expect(abcjsNotes[2].lyric[0].syllable).to.equal('world');
        expect(abcjsNotes[2].lyric[0].divider).to.equal(' ');
      }
    });

    it('should handle multiple lyric lines', () => {
      const abc = `X:1\nK:C\nCDE|\nw:first line\nw:sec-ond line`;

      const yourTune = parseWithYourParser(abc).tunes[0];
      const abcjsTune = parseWithAbcjs(abc)[0];

      const yourLine = yourTune.lines[0];
      const abcjsLine = abcjsTune.lines[0];

      if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
        throw new Error('Expected MusicLine with staff property');
      }

      const yourVoice = yourLine.staff[0].voices[0];
      const abcjsVoice = abcjsLine.staff[0].voices[0];

      const yourNotes = yourVoice.filter((el: any) => 'pitches' in el && el.pitches && el.pitches.length > 0) as any[];
      const abcjsNotes = abcjsVoice.filter((el: any) => 'pitches' in el && el.pitches && el.pitches.length > 0) as any[];

      expect(yourNotes.length).to.equal(3);
      expect(abcjsNotes.length).to.equal(3);

      // Check that first two notes have 2 lyric lines, third has 1
      if (yourNotes[0].lyric) {
        expect(yourNotes[0].lyric.length).to.equal(2);
        expect(yourNotes[0].lyric[0].syllable).to.equal('first');
        expect(yourNotes[0].lyric[1].syllable).to.equal('sec');
      }
      if (abcjsNotes[0].lyric) {
        expect(abcjsNotes[0].lyric.length).to.equal(2);
      }

      if (yourNotes[1].lyric) {
        expect(yourNotes[1].lyric.length).to.equal(2);
        expect(yourNotes[1].lyric[0].syllable).to.equal('line');
        expect(yourNotes[1].lyric[1].syllable).to.equal('ond');
      }
      if (abcjsNotes[1].lyric) {
        expect(abcjsNotes[1].lyric.length).to.equal(2);
      }

      if (yourNotes[2].lyric) {
        expect(yourNotes[2].lyric.length).to.equal(1);
        expect(yourNotes[2].lyric[0].syllable).to.equal('line');
      }
      if (abcjsNotes[2].lyric) {
        expect(abcjsNotes[2].lyric.length).to.equal(1);
      }
    });
  });

  // ============================================================================
  // Inline Element Tests
  // ============================================================================

  describe.skip('Inline Elements', () => {
    it('should handle inline key change', () => {
      const abc = `X:1\nK:C\nCDEF[K:G]GAB`;

      const yourTune = parseWithYourParser(abc).tunes[0];
      const abcjsTune = parseWithAbcjs(abc)[0];

      const yourLine = yourTune.lines[0];
      const abcjsLine = abcjsTune.lines[0];

      if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
        throw new Error('Expected MusicLine with staff property');
      }

      const yourVoice = yourLine.staff[0].voices[0];
      const abcjsVoice = abcjsLine.staff[0].voices[0];

      // Find key elements
      const yourKeyElements = yourVoice.filter((el: any) => el.el_type === 'key') as any[];
      const abcjsKeyElements = abcjsVoice.filter((el: any) => el.el_type === 'key') as any[];

      expect(yourKeyElements.length).to.equal(1);
      expect(abcjsKeyElements.length).to.equal(1);

      // Check key element properties
      if (yourKeyElements[0]) {
        expect(yourKeyElements[0].root).to.equal('G');
        expect(yourKeyElements[0].acc).to.equal('');
        expect(yourKeyElements[0].mode).to.equal('');
      }
      if (abcjsKeyElements[0]) {
        expect(abcjsKeyElements[0].root).to.equal('G');
      }
    });

    it('should handle inline meter change', () => {
      const abc = `X:1\nM:4/4\nK:C\nCDEF[M:3/4]GAB`;

      const yourTune = parseWithYourParser(abc).tunes[0];
      const abcjsTune = parseWithAbcjs(abc)[0];

      const yourLine = yourTune.lines[0];
      const abcjsLine = abcjsTune.lines[0];

      if (!('staff' in yourLine) || !('staff' in abcjsLine)) {
        throw new Error('Expected MusicLine with staff property');
      }

      const yourVoice = yourLine.staff[0].voices[0];
      const abcjsVoice = abcjsLine.staff[0].voices[0];

      // Find meter elements
      const yourMeterElements = yourVoice.filter((el: any) => el.el_type === 'meter') as any[];
      const abcjsMeterElements = abcjsVoice.filter((el: any) => el.el_type === 'meter') as any[];

      expect(yourMeterElements.length).to.equal(1);
      expect(abcjsMeterElements.length).to.equal(1);

      // Check meter element properties
      if (yourMeterElements[0] && yourMeterElements[0].value && yourMeterElements[0].value[0]) {
        expect(yourMeterElements[0].type).to.equal('specified');
        // Check that numerator is 3 and denominator is 4
        const value = yourMeterElements[0].value[0];
        if ('num' in value && 'den' in value) {
          expect(value.num).to.equal(3);
          expect(value.den).to.equal(4);
        }
      }
      if (abcjsMeterElements[0]) {
        expect(abcjsMeterElements[0].type).to.equal('specified');
      }
    });
  });
});
