import { ABCContext, Pitch, toMidiPitch } from "abc-parser";
import { NATURAL_SEMITONES, LETTERS } from "abc-parser/music-theory/constants";
import { AccidentalType } from "abc-parser/types/abcjs-ast";
import { expect } from "chai";
import * as fc from "fast-check";
import { describe, it } from "mocha";
import { spellingToPitch, convertMeasureAccidentalsToSemitones } from "../src/transforms/pitchHelpers";

// ============================================================================
// Helper functions for tests
// ============================================================================

/**
 * Computes MIDI pitch for a given letter, octave, and alteration.
 * C4 = MIDI 60.
 */
function noteLetterToMidi(letter: string, octave: number): number {
  return NATURAL_SEMITONES[letter] + (octave + 1) * 12;
}

/**
 * Extracts the accidental string from a Pitch if present.
 */
function getAccidentalString(pitch: Pitch): string | null {
  return pitch.alteration ? pitch.alteration.lexeme : null;
}

/**
 * Extracts the letter (uppercase) from a Pitch.
 */
function getLetter(pitch: Pitch): string {
  return pitch.noteLetter.lexeme.toUpperCase();
}

/**
 * Checks if the letter is lowercase (octave 5+).
 */
function isLowercase(pitch: Pitch): boolean {
  return pitch.noteLetter.lexeme === pitch.noteLetter.lexeme.toLowerCase();
}

/**
 * Gets the octave marker string if present.
 */
function getOctaveMarker(pitch: Pitch): string {
  return pitch.octave ? pitch.octave.lexeme : "";
}

// ============================================================================
// Example-based tests for spellingToPitch
// ============================================================================

describe("spellingToPitch", () => {
  let ctx: ABCContext;

  beforeEach(() => {
    ctx = new ABCContext();
  });

  describe("standard cases", () => {
    it("C natural in octave 4 produces correct tokens", () => {
      const pitch = spellingToPitch({ letter: "C", alteration: 0 }, 60, false, ctx);
      expect(getLetter(pitch)).to.equal("C");
      expect(isLowercase(pitch)).to.be.false;
      expect(getAccidentalString(pitch)).to.be.null;
      expect(getOctaveMarker(pitch)).to.equal("");
    });

    it("F# in octave 4 with explicit accidental", () => {
      const pitch = spellingToPitch({ letter: "F", alteration: 1 }, 66, true, ctx);
      expect(getAccidentalString(pitch)).to.equal("^");
      expect(getLetter(pitch)).to.equal("F");
      expect(isLowercase(pitch)).to.be.false;
      expect(getOctaveMarker(pitch)).to.equal("");
    });

    it("Bb in octave 3 produces comma marker", () => {
      const pitch = spellingToPitch({ letter: "B", alteration: -1 }, 58, true, ctx);
      expect(getAccidentalString(pitch)).to.equal("_");
      expect(getLetter(pitch)).to.equal("B");
      expect(isLowercase(pitch)).to.be.false;
      expect(getOctaveMarker(pitch)).to.equal(",");
    });

    it("d in octave 5 produces lowercase letter", () => {
      const pitch = spellingToPitch({ letter: "D", alteration: 0 }, 74, false, ctx);
      expect(getLetter(pitch)).to.equal("D");
      expect(isLowercase(pitch)).to.be.true;
      expect(getAccidentalString(pitch)).to.be.null;
      expect(getOctaveMarker(pitch)).to.equal("");
    });

    it("A in octave 2 produces two commas", () => {
      const pitch = spellingToPitch({ letter: "A", alteration: 0 }, 45, false, ctx);
      expect(getLetter(pitch)).to.equal("A");
      expect(isLowercase(pitch)).to.be.false;
      expect(getOctaveMarker(pitch)).to.equal(",,");
    });

    it("g in octave 6 produces one apostrophe", () => {
      const pitch = spellingToPitch({ letter: "G", alteration: 0 }, 91, false, ctx);
      expect(getLetter(pitch)).to.equal("G");
      expect(isLowercase(pitch)).to.be.true;
      expect(getOctaveMarker(pitch)).to.equal("'");
    });
  });

  describe("enharmonic edge cases - octave boundary", () => {
    it("B# in octave 4 (MIDI 72) produces uppercase B with sharp", () => {
      // B#4 = C5 = MIDI 72, but we want it spelled as B# in octave 4 notation
      const pitch = spellingToPitch({ letter: "B", alteration: 1 }, 72, true, ctx);
      expect(getAccidentalString(pitch)).to.equal("^");
      expect(getLetter(pitch)).to.equal("B");
      expect(isLowercase(pitch)).to.be.false;
      expect(getOctaveMarker(pitch)).to.equal("");
    });

    it("Cb in octave 5 (MIDI 71) produces lowercase c with flat", () => {
      // Cb5 = B4 = MIDI 71, but we want it spelled as Cb in octave 5 notation
      const pitch = spellingToPitch({ letter: "C", alteration: -1 }, 71, true, ctx);
      expect(getAccidentalString(pitch)).to.equal("_");
      expect(getLetter(pitch)).to.equal("C");
      expect(isLowercase(pitch)).to.be.true;
      expect(getOctaveMarker(pitch)).to.equal("");
    });

    it("B# in octave 3 (MIDI 60) produces uppercase B with comma", () => {
      // B#3 = C4 = MIDI 60 = middle C, but spelled as B#
      const pitch = spellingToPitch({ letter: "B", alteration: 1 }, 60, true, ctx);
      expect(getAccidentalString(pitch)).to.equal("^");
      expect(getLetter(pitch)).to.equal("B");
      expect(isLowercase(pitch)).to.be.false;
      expect(getOctaveMarker(pitch)).to.equal(",");
    });

    it("Cb in octave 4 (MIDI 59) produces uppercase C with flat, no octave marker", () => {
      // Cb4 = B3 = MIDI 59, one below middle C, but spelled as Cb in octave 4
      const pitch = spellingToPitch({ letter: "C", alteration: -1 }, 59, true, ctx);
      expect(getAccidentalString(pitch)).to.equal("_");
      expect(getLetter(pitch)).to.equal("C");
      expect(isLowercase(pitch)).to.be.false;
      expect(getOctaveMarker(pitch)).to.equal("");
    });
  });

  describe("double accidentals", () => {
    it("C## in octave 4 (MIDI 62) produces correct tokens", () => {
      const pitch = spellingToPitch({ letter: "C", alteration: 2 }, 62, true, ctx);
      expect(getAccidentalString(pitch)).to.equal("^^");
      expect(getLetter(pitch)).to.equal("C");
    });

    it("Dbb in octave 4 (MIDI 60) produces correct tokens", () => {
      const pitch = spellingToPitch({ letter: "D", alteration: -2 }, 60, true, ctx);
      expect(getAccidentalString(pitch)).to.equal("__");
      expect(getLetter(pitch)).to.equal("D");
    });
  });

  describe("double accidentals at octave boundaries", () => {
    it("B## in octave 4 (MIDI 73) produces uppercase B with double sharp", () => {
      // B##4 = C#5 = MIDI 73, but spelled as B## in octave 4 notation
      const pitch = spellingToPitch({ letter: "B", alteration: 2 }, 73, true, ctx);
      expect(getAccidentalString(pitch)).to.equal("^^");
      expect(getLetter(pitch)).to.equal("B");
      expect(isLowercase(pitch)).to.be.false;
      expect(getOctaveMarker(pitch)).to.equal("");
    });

    it("Cbb in octave 5 (MIDI 70) produces lowercase c with double flat", () => {
      // Cbb5 = Bb4 = MIDI 70, but spelled as Cbb in octave 5 notation
      const pitch = spellingToPitch({ letter: "C", alteration: -2 }, 70, true, ctx);
      expect(getAccidentalString(pitch)).to.equal("__");
      expect(getLetter(pitch)).to.equal("C");
      expect(isLowercase(pitch)).to.be.true;
      expect(getOctaveMarker(pitch)).to.equal("");
    });
  });

  describe("natural accidentals", () => {
    it("F natural with explicit accidental produces = symbol", () => {
      const pitch = spellingToPitch({ letter: "F", alteration: 0 }, 65, true, ctx);
      expect(getAccidentalString(pitch)).to.equal("=");
      expect(getLetter(pitch)).to.equal("F");
    });
  });
});

// ============================================================================
// Example-based tests for convertMeasureAccidentalsToSemitones
// ============================================================================

describe("convertMeasureAccidentalsToSemitones", () => {
  it("returns null for undefined input", () => {
    expect(convertMeasureAccidentalsToSemitones(undefined)).to.be.null;
  });

  it("converts empty map to empty map", () => {
    const result = convertMeasureAccidentalsToSemitones(new Map());
    expect(result).to.deep.equal(new Map());
  });

  it("converts Sharp to 1", () => {
    const input = new Map([["F", AccidentalType.Sharp]]);
    const result = convertMeasureAccidentalsToSemitones(input);
    expect(result?.get("F")).to.equal(1);
  });

  it("converts Flat to -1", () => {
    const input = new Map([["B", AccidentalType.Flat]]);
    const result = convertMeasureAccidentalsToSemitones(input);
    expect(result?.get("B")).to.equal(-1);
  });

  it("converts Natural to 0", () => {
    const input = new Map([["F", AccidentalType.Natural]]);
    const result = convertMeasureAccidentalsToSemitones(input);
    expect(result?.get("F")).to.equal(0);
  });

  it("converts DblSharp to 2", () => {
    const input = new Map([["C", AccidentalType.DblSharp]]);
    const result = convertMeasureAccidentalsToSemitones(input);
    expect(result?.get("C")).to.equal(2);
  });

  it("converts DblFlat to -2", () => {
    const input = new Map([["D", AccidentalType.DblFlat]]);
    const result = convertMeasureAccidentalsToSemitones(input);
    expect(result?.get("D")).to.equal(-2);
  });

  it("converts multiple entries", () => {
    const input = new Map<string, AccidentalType>([
      ["F", AccidentalType.Sharp],
      ["B", AccidentalType.Flat],
    ]);
    const result = convertMeasureAccidentalsToSemitones(input);
    expect(result?.get("F")).to.equal(1);
    expect(result?.get("B")).to.equal(-1);
  });
});

// ============================================================================
// Property-based tests for spellingToPitch
// ============================================================================

describe("spellingToPitch properties", () => {
  let ctx: ABCContext;

  beforeEach(() => {
    ctx = new ABCContext();
  });

  it("round-trip: spellingToPitch output resolves to original MIDI", () => {
    fc.assert(
      fc.property(fc.constantFrom(...LETTERS), fc.integer({ min: -2, max: 2 }), fc.integer({ min: 2, max: 7 }), (letter, alteration, octave) => {
        const midi = noteLetterToMidi(letter, octave) + alteration;

        // Skip if MIDI is out of valid range
        if (midi < 0 || midi > 127) return true;

        const pitch = spellingToPitch({ letter, alteration }, midi, true, ctx);
        const resolvedMidi = toMidiPitch(pitch);

        return resolvedMidi === midi;
      }),
      { numRuns: 500 }
    );
  });

  it("octave marker count matches expected octave", () => {
    fc.assert(
      fc.property(fc.constantFrom(...LETTERS), fc.integer({ min: -2, max: 2 }), fc.integer({ min: 2, max: 7 }), (letter, alteration, octave) => {
        const midi = noteLetterToMidi(letter, octave) + alteration;

        // Skip if MIDI is out of valid range
        if (midi < 0 || midi > 127) return true;

        const pitch = spellingToPitch({ letter, alteration }, midi, true, ctx);

        // Determine expected octave marker based on the formula
        const letterSemitone = NATURAL_SEMITONES[letter];
        const expectedOctave = Math.round((midi - letterSemitone - 60) / 12) + 4;

        if (expectedOctave <= 4) {
          // Should be uppercase with commas
          const isUpper = pitch.noteLetter.lexeme === pitch.noteLetter.lexeme.toUpperCase();
          const expectedCommas = 4 - expectedOctave;
          const commaCount = pitch.octave ? pitch.octave.lexeme.length : 0;

          return isUpper && commaCount === expectedCommas;
        } else {
          // Should be lowercase with apostrophes
          const isLower = pitch.noteLetter.lexeme === pitch.noteLetter.lexeme.toLowerCase();
          const expectedApostrophes = expectedOctave - 5;
          const apostropheCount = pitch.octave ? pitch.octave.lexeme.length : 0;

          return isLower && apostropheCount === expectedApostrophes;
        }
      }),
      { numRuns: 500 }
    );
  });

  it("letter in output matches input spelling letter", () => {
    fc.assert(
      fc.property(fc.constantFrom(...LETTERS), fc.integer({ min: -2, max: 2 }), fc.integer({ min: 2, max: 7 }), (letter, alteration, octave) => {
        const midi = noteLetterToMidi(letter, octave) + alteration;

        // Skip if MIDI is out of valid range
        if (midi < 0 || midi > 127) return true;

        const pitch = spellingToPitch({ letter, alteration }, midi, true, ctx);
        return pitch.noteLetter.lexeme.toUpperCase() === letter;
      }),
      { numRuns: 500 }
    );
  });
});
