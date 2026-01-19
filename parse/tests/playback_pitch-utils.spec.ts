import { expect } from "chai";
import { AccidentalType } from "../types/abcjs-ast";
import {
  abcPitchToMidi,
  accidentalToCents,
  midiToNoteName,
  abcPitchToNoteName,
} from "../playback/pitch-utils";

describe("playback/pitch-utils", () => {
  describe("abcPitchToMidi", () => {
    describe("natural notes around middle C", () => {
      const testCases = [
        { verticalPos: 0, expected: 60, note: "C4" },
        { verticalPos: 1, expected: 62, note: "D4" },
        { verticalPos: 2, expected: 64, note: "E4" },
        { verticalPos: 3, expected: 65, note: "F4" },
        { verticalPos: 4, expected: 67, note: "G4" },
        { verticalPos: 5, expected: 69, note: "A4" },
        { verticalPos: 6, expected: 71, note: "B4" },
      ];

      testCases.forEach(({ verticalPos, expected, note }) => {
        it(`should convert position ${verticalPos} to MIDI ${expected} (${note})`, () => {
          expect(abcPitchToMidi(verticalPos)).to.equal(expected);
        });
      });
    });

    describe("octave above middle C", () => {
      const testCases = [
        { verticalPos: 7, expected: 72, note: "C5" },
        { verticalPos: 8, expected: 74, note: "D5" },
        { verticalPos: 9, expected: 76, note: "E5" },
        { verticalPos: 10, expected: 77, note: "F5" },
        { verticalPos: 11, expected: 79, note: "G5" },
        { verticalPos: 12, expected: 81, note: "A5" },
        { verticalPos: 13, expected: 83, note: "B5" },
        { verticalPos: 14, expected: 84, note: "C6" },
      ];

      testCases.forEach(({ verticalPos, expected, note }) => {
        it(`should convert position ${verticalPos} to MIDI ${expected} (${note})`, () => {
          expect(abcPitchToMidi(verticalPos)).to.equal(expected);
        });
      });
    });

    describe("octave below middle C", () => {
      const testCases = [
        { verticalPos: -1, expected: 59, note: "B3" },
        { verticalPos: -2, expected: 57, note: "A3" },
        { verticalPos: -3, expected: 55, note: "G3" },
        { verticalPos: -4, expected: 53, note: "F3" },
        { verticalPos: -5, expected: 52, note: "E3" },
        { verticalPos: -6, expected: 50, note: "D3" },
        { verticalPos: -7, expected: 48, note: "C3" },
        { verticalPos: -8, expected: 47, note: "B2" },
      ];

      testCases.forEach(({ verticalPos, expected, note }) => {
        it(`should convert position ${verticalPos} to MIDI ${expected} (${note})`, () => {
          expect(abcPitchToMidi(verticalPos)).to.equal(expected);
        });
      });
    });

    describe("with accidentals", () => {
      it("should add 1 semitone for sharp", () => {
        // C4 sharp = C#4 = MIDI 61
        expect(abcPitchToMidi(0, AccidentalType.Sharp)).to.equal(61);
      });

      it("should subtract 1 semitone for flat", () => {
        // D4 flat = Db4 = MIDI 61
        expect(abcPitchToMidi(1, AccidentalType.Flat)).to.equal(61);
      });

      it("should add 2 semitones for double sharp", () => {
        // C4 double sharp = D4 = MIDI 62
        expect(abcPitchToMidi(0, AccidentalType.DblSharp)).to.equal(62);
      });

      it("should subtract 2 semitones for double flat", () => {
        // D4 double flat = C4 = MIDI 60
        expect(abcPitchToMidi(1, AccidentalType.DblFlat)).to.equal(60);
      });

      it("should not change pitch for natural", () => {
        expect(abcPitchToMidi(0, AccidentalType.Natural)).to.equal(60);
      });

      it("should not change pitch for quarter sharp (handled via cents)", () => {
        expect(abcPitchToMidi(0, AccidentalType.QuarterSharp)).to.equal(60);
      });

      it("should not change pitch for quarter flat (handled via cents)", () => {
        expect(abcPitchToMidi(0, AccidentalType.QuarterFlat)).to.equal(60);
      });
    });
  });

  describe("accidentalToCents", () => {
    it("should return 0 for undefined accidental", () => {
      expect(accidentalToCents(undefined)).to.equal(0);
    });

    it("should return 0 for standard accidentals", () => {
      expect(accidentalToCents(AccidentalType.Sharp)).to.equal(0);
      expect(accidentalToCents(AccidentalType.Flat)).to.equal(0);
      expect(accidentalToCents(AccidentalType.Natural)).to.equal(0);
      expect(accidentalToCents(AccidentalType.DblSharp)).to.equal(0);
      expect(accidentalToCents(AccidentalType.DblFlat)).to.equal(0);
    });

    it("should return 50 for quarter sharp", () => {
      expect(accidentalToCents(AccidentalType.QuarterSharp)).to.equal(50);
    });

    it("should return -50 for quarter flat", () => {
      expect(accidentalToCents(AccidentalType.QuarterFlat)).to.equal(-50);
    });
  });

  describe("midiToNoteName", () => {
    const testCases = [
      { midi: 60, expected: "C4" },
      { midi: 61, expected: "C#4" },
      { midi: 62, expected: "D4" },
      { midi: 63, expected: "D#4" },
      { midi: 64, expected: "E4" },
      { midi: 65, expected: "F4" },
      { midi: 66, expected: "F#4" },
      { midi: 67, expected: "G4" },
      { midi: 68, expected: "G#4" },
      { midi: 69, expected: "A4" },
      { midi: 70, expected: "A#4" },
      { midi: 71, expected: "B4" },
      { midi: 72, expected: "C5" },
      { midi: 48, expected: "C3" },
      { midi: 84, expected: "C6" },
      { midi: 21, expected: "A0" },  // Lowest piano key
      { midi: 108, expected: "C8" }, // Highest piano key
    ];

    testCases.forEach(({ midi, expected }) => {
      it(`should convert MIDI ${midi} to "${expected}"`, () => {
        expect(midiToNoteName(midi)).to.equal(expected);
      });
    });
  });

  describe("abcPitchToNoteName", () => {
    it("should convert position 0 to C4", () => {
      expect(abcPitchToNoteName(0)).to.equal("C4");
    });

    it("should handle sharps", () => {
      expect(abcPitchToNoteName(0, AccidentalType.Sharp)).to.equal("C#4");
    });

    it("should handle flats", () => {
      expect(abcPitchToNoteName(1, AccidentalType.Flat)).to.equal("C#4");
    });
  });
});
