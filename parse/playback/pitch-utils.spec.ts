/**
 * Tests for pitch conversion utilities
 */

import { expect } from "chai";
import { AccidentalType } from "../types/abcjs-ast";
import {
  abcPitchToMidi,
  accidentalToCents,
  midiToNoteName,
  abcPitchToNoteName,
} from "./pitch-utils";

describe("Pitch Utils", () => {
  describe("abcPitchToMidi", () => {
    describe("basic pitch conversion", () => {
      it("should convert C4 (position 0) to MIDI 60", () => {
        expect(abcPitchToMidi(0)).to.equal(60);
      });

      it("should convert D4 (position 1) to MIDI 62", () => {
        expect(abcPitchToMidi(1)).to.equal(62);
      });

      it("should convert E4 (position 2) to MIDI 64", () => {
        expect(abcPitchToMidi(2)).to.equal(64);
      });

      it("should convert F4 (position 3) to MIDI 65", () => {
        expect(abcPitchToMidi(3)).to.equal(65);
      });

      it("should convert G4 (position 4) to MIDI 67", () => {
        expect(abcPitchToMidi(4)).to.equal(67);
      });

      it("should convert A4 (position 5) to MIDI 69", () => {
        expect(abcPitchToMidi(5)).to.equal(69);
      });

      it("should convert B4 (position 6) to MIDI 71", () => {
        expect(abcPitchToMidi(6)).to.equal(71);
      });
    });

    describe("octave handling", () => {
      it("should convert C5 (position 7) to MIDI 72", () => {
        expect(abcPitchToMidi(7)).to.equal(72);
      });

      it("should convert C6 (position 14) to MIDI 84", () => {
        expect(abcPitchToMidi(14)).to.equal(84);
      });

      it("should convert C3 (position -7) to MIDI 48", () => {
        expect(abcPitchToMidi(-7)).to.equal(48);
      });

      it("should convert C2 (position -14) to MIDI 36", () => {
        expect(abcPitchToMidi(-14)).to.equal(36);
      });
    });

    describe("negative positions", () => {
      it("should convert B3 (position -1) to MIDI 59", () => {
        expect(abcPitchToMidi(-1)).to.equal(59);
      });

      it("should convert A3 (position -2) to MIDI 57", () => {
        expect(abcPitchToMidi(-2)).to.equal(57);
      });

      it("should convert G3 (position -3) to MIDI 55", () => {
        expect(abcPitchToMidi(-3)).to.equal(55);
      });
    });

    describe("accidentals", () => {
      it("should add 1 semitone for sharp", () => {
        expect(abcPitchToMidi(0, AccidentalType.Sharp)).to.equal(61); // C#4
      });

      it("should subtract 1 semitone for flat", () => {
        expect(abcPitchToMidi(0, AccidentalType.Flat)).to.equal(59); // Cb4
      });

      it("should add 2 semitones for double sharp", () => {
        expect(abcPitchToMidi(0, AccidentalType.DblSharp)).to.equal(62); // C##4
      });

      it("should subtract 2 semitones for double flat", () => {
        expect(abcPitchToMidi(0, AccidentalType.DblFlat)).to.equal(58); // Cbb4
      });

      it("should not change pitch for natural", () => {
        expect(abcPitchToMidi(0, AccidentalType.Natural)).to.equal(60);
      });

      it("should not change MIDI pitch for quarter sharp (handled via cents)", () => {
        expect(abcPitchToMidi(0, AccidentalType.QuarterSharp)).to.equal(60);
      });

      it("should not change MIDI pitch for quarter flat (handled via cents)", () => {
        expect(abcPitchToMidi(0, AccidentalType.QuarterFlat)).to.equal(60);
      });
    });

    describe("combined octave and accidental", () => {
      it("should handle F#5 correctly", () => {
        // F5 is position 10 (7 + 3), MIDI 77, +1 for sharp = 78
        expect(abcPitchToMidi(10, AccidentalType.Sharp)).to.equal(78);
      });

      it("should handle Bb3 correctly", () => {
        // B3 is position -1, MIDI 59, -1 for flat = 58
        expect(abcPitchToMidi(-1, AccidentalType.Flat)).to.equal(58);
      });
    });
  });

  describe("accidentalToCents", () => {
    it("should return 0 for no accidental", () => {
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
    it("should convert MIDI 60 to C4", () => {
      expect(midiToNoteName(60)).to.equal("C4");
    });

    it("should convert MIDI 69 to A4", () => {
      expect(midiToNoteName(69)).to.equal("A4");
    });

    it("should convert MIDI 61 to C#4", () => {
      expect(midiToNoteName(61)).to.equal("C#4");
    });

    it("should convert MIDI 48 to C3", () => {
      expect(midiToNoteName(48)).to.equal("C3");
    });

    it("should convert MIDI 72 to C5", () => {
      expect(midiToNoteName(72)).to.equal("C5");
    });
  });

  describe("abcPitchToNoteName", () => {
    it("should convert position 0 to C4", () => {
      expect(abcPitchToNoteName(0)).to.equal("C4");
    });

    it("should convert position 0 with sharp to C#4", () => {
      expect(abcPitchToNoteName(0, AccidentalType.Sharp)).to.equal("C#4");
    });

    it("should convert position 7 to C5", () => {
      expect(abcPitchToNoteName(7)).to.equal("C5");
    });

    it("should indicate quarter flat in name", () => {
      const name = abcPitchToNoteName(0, AccidentalType.QuarterFlat);
      expect(name).to.include("q");
    });

    it("should indicate quarter sharp in name", () => {
      const name = abcPitchToNoteName(0, AccidentalType.QuarterSharp);
      expect(name).to.include("q");
    });
  });
});
