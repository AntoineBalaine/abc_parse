import { expect } from "chai";
import * as fc from "fast-check";
import {
  PitchContext,
  resolveMelodyPitch,
  pitchToNoteName,
  noteLetterToMidi,
  accidentalToSemitones,
  accidentalTypeToSemitones,
  semitonesToAccidentalString,
  getKeyAccidentalForPitch,
  midiToNaturalNote,
} from "../music-theory/pitchUtils";
import { KeySignature, AccidentalType, KeyRoot, KeyAccidental, Mode } from "../types/abcjs-ast";

// Helper to create a basic key signature
function makeKey(root: KeyRoot, acc: KeyAccidental, mode: Mode, accidentals: Array<{ note: string; acc: AccidentalType }> = []): KeySignature {
  return {
    root,
    acc,
    mode,
    accidentals: accidentals.map((a) => ({
      note: a.note as any,
      acc: a.acc,
      verticalPos: 0,
    })),
  };
}

// Common key signatures for testing
const C_MAJOR = makeKey(KeyRoot.C, KeyAccidental.None, Mode.Major);
const G_MAJOR = makeKey(KeyRoot.G, KeyAccidental.None, Mode.Major, [{ note: "F", acc: AccidentalType.Sharp }]);
const F_MAJOR = makeKey(KeyRoot.F, KeyAccidental.None, Mode.Major, [{ note: "B", acc: AccidentalType.Flat }]);
const D_MAJOR = makeKey(KeyRoot.D, KeyAccidental.None, Mode.Major, [
  { note: "F", acc: AccidentalType.Sharp },
  { note: "C", acc: AccidentalType.Sharp },
]);

describe("pitchUtils", () => {
  describe("noteLetterToMidi", () => {
    it("should return 60 for C4 (middle C)", () => {
      expect(noteLetterToMidi("C", 4)).to.equal(60);
    });

    it("should return 69 for A4 (concert A)", () => {
      expect(noteLetterToMidi("A", 4)).to.equal(69);
    });

    it("should return 48 for C3", () => {
      expect(noteLetterToMidi("C", 3)).to.equal(48);
    });

    it("should return 72 for C5", () => {
      expect(noteLetterToMidi("C", 5)).to.equal(72);
    });

    it("should handle lowercase letters", () => {
      expect(noteLetterToMidi("c", 4)).to.equal(60);
    });

    it("should return correct values for all notes in octave 4", () => {
      expect(noteLetterToMidi("C", 4)).to.equal(60);
      expect(noteLetterToMidi("D", 4)).to.equal(62);
      expect(noteLetterToMidi("E", 4)).to.equal(64);
      expect(noteLetterToMidi("F", 4)).to.equal(65);
      expect(noteLetterToMidi("G", 4)).to.equal(67);
      expect(noteLetterToMidi("A", 4)).to.equal(69);
      expect(noteLetterToMidi("B", 4)).to.equal(71);
    });

    it("should fall back to C for invalid pitch class", () => {
      expect(noteLetterToMidi("X", 4)).to.equal(60); // Falls back to C4
    });
  });

  describe("accidentalToSemitones", () => {
    it("should return 2 for double sharp", () => {
      expect(accidentalToSemitones("^^")).to.equal(2);
    });

    it("should return 1 for sharp", () => {
      expect(accidentalToSemitones("^")).to.equal(1);
    });

    it("should return 0 for natural", () => {
      expect(accidentalToSemitones("=")).to.equal(0);
    });

    it("should return -1 for flat", () => {
      expect(accidentalToSemitones("_")).to.equal(-1);
    });

    it("should return -2 for double flat", () => {
      expect(accidentalToSemitones("__")).to.equal(-2);
    });
  });

  describe("accidentalTypeToSemitones", () => {
    it("should return 0 for null", () => {
      expect(accidentalTypeToSemitones(null)).to.equal(0);
    });

    it("should return correct values for all accidental types", () => {
      expect(accidentalTypeToSemitones(AccidentalType.DblSharp)).to.equal(2);
      expect(accidentalTypeToSemitones(AccidentalType.Sharp)).to.equal(1);
      expect(accidentalTypeToSemitones(AccidentalType.Natural)).to.equal(0);
      expect(accidentalTypeToSemitones(AccidentalType.Flat)).to.equal(-1);
      expect(accidentalTypeToSemitones(AccidentalType.DblFlat)).to.equal(-2);
    });
  });

  describe("semitonesToAccidentalString", () => {
    it("should return correct ABC strings", () => {
      expect(semitonesToAccidentalString(2)).to.equal("^^");
      expect(semitonesToAccidentalString(1)).to.equal("^");
      expect(semitonesToAccidentalString(0)).to.equal("=");
      expect(semitonesToAccidentalString(-1)).to.equal("_");
      expect(semitonesToAccidentalString(-2)).to.equal("__");
    });
  });

  describe("getKeyAccidentalForPitch", () => {
    it("should return null for C in C major", () => {
      expect(getKeyAccidentalForPitch("C", C_MAJOR)).to.be.null;
    });

    it("should return Sharp for F in G major", () => {
      expect(getKeyAccidentalForPitch("F", G_MAJOR)).to.equal(AccidentalType.Sharp);
    });

    it("should return Flat for B in F major", () => {
      expect(getKeyAccidentalForPitch("B", F_MAJOR)).to.equal(AccidentalType.Flat);
    });

    it("should return Sharp for both F and C in D major", () => {
      expect(getKeyAccidentalForPitch("F", D_MAJOR)).to.equal(AccidentalType.Sharp);
      expect(getKeyAccidentalForPitch("C", D_MAJOR)).to.equal(AccidentalType.Sharp);
    });

    it("should handle lowercase pitch class", () => {
      expect(getKeyAccidentalForPitch("f", G_MAJOR)).to.equal(AccidentalType.Sharp);
    });
  });

  describe("midiToNaturalNote", () => {
    it("should return C4 for MIDI 60", () => {
      const result = midiToNaturalNote(60);
      expect(result.naturalNote).to.equal("C");
      expect(result.octave).to.equal(4);
      expect(result.semitoneOffset).to.equal(0);
    });

    it("should return C4 with offset 1 for MIDI 61 (C#)", () => {
      const result = midiToNaturalNote(61);
      expect(result.naturalNote).to.equal("C");
      expect(result.octave).to.equal(4);
      expect(result.semitoneOffset).to.equal(1);
    });

    it("should return D4 for MIDI 62", () => {
      const result = midiToNaturalNote(62);
      expect(result.naturalNote).to.equal("D");
      expect(result.octave).to.equal(4);
      expect(result.semitoneOffset).to.equal(0);
    });

    it("should return A4 for MIDI 69", () => {
      const result = midiToNaturalNote(69);
      expect(result.naturalNote).to.equal("A");
      expect(result.octave).to.equal(4);
      expect(result.semitoneOffset).to.equal(0);
    });
  });

  describe("resolveMelodyPitch", () => {
    it("should return 60 for C in C major with no accidentals", () => {
      const ctx: PitchContext = { key: C_MAJOR, transpose: 0 };
      expect(resolveMelodyPitch("C", 4, null, ctx)).to.equal(60);
    });

    it("should return 66 for F in G major (F#)", () => {
      const ctx: PitchContext = { key: G_MAJOR, transpose: 0 };
      expect(resolveMelodyPitch("F", 4, null, ctx)).to.equal(66);
    });

    it("should return 65 for F natural in G major with explicit natural", () => {
      const ctx: PitchContext = { key: G_MAJOR, transpose: 0 };
      expect(resolveMelodyPitch("F", 4, "=", ctx)).to.equal(65);
    });

    it("should return 65 for F in G major with measure accidental natural", () => {
      const measureAccidentals = new Map<string, AccidentalType>();
      measureAccidentals.set("F", AccidentalType.Natural);
      const ctx: PitchContext = { key: G_MAJOR, measureAccidentals, transpose: 0 };
      expect(resolveMelodyPitch("F", 4, null, ctx)).to.equal(65);
    });

    it("should return 70 for B in F major (Bb)", () => {
      const ctx: PitchContext = { key: F_MAJOR, transpose: 0 };
      expect(resolveMelodyPitch("B", 4, null, ctx)).to.equal(70);
    });

    it("should apply transpose offset", () => {
      const ctx: PitchContext = { key: C_MAJOR, transpose: 12 };
      expect(resolveMelodyPitch("C", 4, null, ctx)).to.equal(72);
    });

    it("should apply negative transpose offset", () => {
      const ctx: PitchContext = { key: C_MAJOR, transpose: -12 };
      expect(resolveMelodyPitch("C", 4, null, ctx)).to.equal(48);
    });

    it("should handle explicit sharp", () => {
      const ctx: PitchContext = { key: C_MAJOR, transpose: 0 };
      expect(resolveMelodyPitch("F", 4, "^", ctx)).to.equal(66);
    });

    it("should handle explicit flat", () => {
      const ctx: PitchContext = { key: C_MAJOR, transpose: 0 };
      expect(resolveMelodyPitch("B", 4, "_", ctx)).to.equal(70);
    });

    it("should handle explicit double sharp", () => {
      const ctx: PitchContext = { key: C_MAJOR, transpose: 0 };
      expect(resolveMelodyPitch("C", 4, "^^", ctx)).to.equal(62);
    });

    it("should handle explicit double flat", () => {
      const ctx: PitchContext = { key: C_MAJOR, transpose: 0 };
      expect(resolveMelodyPitch("D", 4, "__", ctx)).to.equal(60);
    });
  });

  describe("pitchToNoteName", () => {
    it("should return F with no accidental for 66 in G major", () => {
      const ctx: PitchContext = { key: G_MAJOR, transpose: 0 };
      const result = pitchToNoteName(66, ctx);
      expect(result.noteLetter).to.equal("F");
      expect(result.octave).to.equal(4);
      expect(result.accidental).to.equal("");
    });

    it("should return F with sharp accidental for 66 in C major", () => {
      const ctx: PitchContext = { key: C_MAJOR, transpose: 0 };
      const result = pitchToNoteName(66, ctx);
      expect(result.noteLetter).to.equal("F");
      expect(result.octave).to.equal(4);
      expect(result.accidental).to.equal("^");
    });

    it("should return F with no accidental for 65 in G major with measure natural", () => {
      const measureAccidentals = new Map<string, AccidentalType>();
      measureAccidentals.set("F", AccidentalType.Natural);
      const ctx: PitchContext = { key: G_MAJOR, measureAccidentals, transpose: 0 };
      const result = pitchToNoteName(65, ctx);
      expect(result.noteLetter).to.equal("F");
      expect(result.octave).to.equal(4);
      expect(result.accidental).to.equal("");
    });

    it("should handle transpose correctly", () => {
      const ctx: PitchContext = { key: C_MAJOR, transpose: 12 };
      // MIDI 72 with transpose 12 means written pitch is 60 (C4)
      const result = pitchToNoteName(72, ctx);
      expect(result.noteLetter).to.equal("C");
      expect(result.octave).to.equal(4);
      expect(result.accidental).to.equal("");
    });

    it("should return C with no accidental for 60 in C major", () => {
      const ctx: PitchContext = { key: C_MAJOR, transpose: 0 };
      const result = pitchToNoteName(60, ctx);
      expect(result.noteLetter).to.equal("C");
      expect(result.octave).to.equal(4);
      expect(result.accidental).to.equal("");
    });

    it("should return A with sharp for 70 in C major (prefers sharps over flats)", () => {
      const ctx: PitchContext = { key: C_MAJOR, transpose: 0 };
      const result = pitchToNoteName(70, ctx);
      expect(result.noteLetter).to.equal("A");
      expect(result.octave).to.equal(4);
      expect(result.accidental).to.equal("^");
    });

    it("should return B with no accidental for 70 in F major", () => {
      const ctx: PitchContext = { key: F_MAJOR, transpose: 0 };
      const result = pitchToNoteName(70, ctx);
      expect(result.noteLetter).to.equal("B");
      expect(result.octave).to.equal(4);
      expect(result.accidental).to.equal("");
    });
  });

  describe("property tests", () => {
    const noteLetterArb = fc.constantFrom("C", "D", "E", "F", "G", "A", "B");
    const octaveArb = fc.integer({ min: 0, max: 8 });
    const accidentalArb = fc.constantFrom(null, "^", "_", "=", "^^", "__");
    const transposeArb = fc.integer({ min: -24, max: 24 });

    it("property: resolveMelodyPitch returns value in valid MIDI range", () => {
      fc.assert(
        fc.property(noteLetterArb, octaveArb, accidentalArb, transposeArb, (note, octave, acc, transpose) => {
          const ctx: PitchContext = { key: C_MAJOR, transpose };
          const result = resolveMelodyPitch(note, octave, acc, ctx);
          // MIDI pitch should be reasonable (allowing for transpose)
          return result >= -24 && result <= 151;
        })
      );
    });

    it("property: noteLetterToMidi + accidental is reversible via midiToNaturalNote", () => {
      fc.assert(
        fc.property(noteLetterArb, octaveArb, (note, octave) => {
          const midi = noteLetterToMidi(note, octave);
          const { naturalNote, octave: resultOctave, semitoneOffset } = midiToNaturalNote(midi);
          // The natural note should match and semitone offset should be 0 for natural notes
          return naturalNote === note && resultOctave === octave && semitoneOffset === 0;
        })
      );
    });

    it("property: accidentalToSemitones and semitonesToAccidentalString are inverses for standard accidentals", () => {
      const standardAccidentals = fc.constantFrom("^", "_", "=", "^^", "__");
      fc.assert(
        fc.property(standardAccidentals, (acc) => {
          const semitones = accidentalToSemitones(acc);
          const result = semitonesToAccidentalString(semitones);
          return result === acc;
        })
      );
    });

    it("property: resolveMelodyPitch then pitchToNoteName produces equivalent pitch", () => {
      fc.assert(
        fc.property(noteLetterArb, octaveArb, transposeArb, (note, octave, transpose) => {
          const ctx: PitchContext = { key: C_MAJOR, transpose };

          // Resolve the pitch
          const midiPitch = resolveMelodyPitch(note, octave, null, ctx);

          // Convert back to note name
          const { noteLetter, octave: resultOctave, accidental } = pitchToNoteName(midiPitch, ctx);

          // Resolve the result again - should give same MIDI pitch
          const roundtripMidi = resolveMelodyPitch(noteLetter, resultOctave, accidental || null, ctx);

          return midiPitch === roundtripMidi;
        })
      );
    });

    it("property: transpose is correctly applied and removed", () => {
      fc.assert(
        fc.property(noteLetterArb, octaveArb, transposeArb, (note, octave, transpose) => {
          const ctxWithTranspose: PitchContext = { key: C_MAJOR, transpose };
          const ctxNoTranspose: PitchContext = { key: C_MAJOR, transpose: 0 };

          const withTranspose = resolveMelodyPitch(note, octave, null, ctxWithTranspose);
          const withoutTranspose = resolveMelodyPitch(note, octave, null, ctxNoTranspose);

          return withTranspose === withoutTranspose + transpose;
        })
      );
    });
  });
});
