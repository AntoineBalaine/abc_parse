import { expect } from "chai";
import { ABCContext } from "../parsers/Context";
import { Token, TT } from "../parsers/scan2";
import { File_header, File_structure, Pitch } from "../types/Expr2";
import { AbcFormatter2, toMidiPitch } from "../Visitors/Formatter2";
import { fromMidiPitch, Transposer } from "../Visitors/Transposer";

describe("Transposer", () => {
  describe("fromMidiPitch", () => {
    const ctx = new ABCContext();
    const formatter = new AbcFormatter2(ctx);

    // Test cases for various MIDI pitch values
    const testCases = [
      { midiPitch: 60, expected: "C" }, // Middle C
      { midiPitch: 62, expected: "D" }, // D above middle C
      { midiPitch: 64, expected: "E" }, // E above middle C
      { midiPitch: 65, expected: "F" }, // F above middle C
      { midiPitch: 67, expected: "G" }, // G above middle C
      { midiPitch: 69, expected: "A" }, // A above middle C
      { midiPitch: 71, expected: "B" }, // B above middle C
      { midiPitch: 72, expected: "c" }, // C one octave above middle C
      { midiPitch: 84, expected: "c'" }, // C one octave above middle C
      { midiPitch: 59, expected: "B," }, // B below middle C
      { midiPitch: 57, expected: "A," }, // A below middle C
      { midiPitch: 55, expected: "G," }, // G below middle C
      { midiPitch: 48, expected: "C," }, // C one octave below middle C
      { midiPitch: 61, expected: "^C" }, // C# above middle C
      { midiPitch: 63, expected: "^D" }, // D# above middle C
      { midiPitch: 66, expected: "^F" }, // F# above middle C
      { midiPitch: 68, expected: "^G" }, // G# above middle C
      { midiPitch: 70, expected: "^A" }, // A# above middle C
    ];

    testCases.forEach(({ midiPitch, expected }) => {
      it(`should convert MIDI pitch ${midiPitch} to ABC notation "${expected}"`, () => {
        const pitch = fromMidiPitch(midiPitch, ctx);
        const formatted = pitch.accept(formatter);
        expect(formatted).to.equal(expected);
      });
    });

    it("should throw an error for invalid MIDI pitch numbers", () => {
      expect(() => fromMidiPitch(-1, ctx)).to.throw();
    });

    it("should handle very high octaves", () => {
      const highC = fromMidiPitch(108, ctx); // C8 (4 octaves above middle C)
      const formatted = highC.accept(formatter);
      expect(formatted).to.equal("c'''");
    });

    it("should handle very low octaves", () => {
      const lowC = fromMidiPitch(24, ctx); // C1 (3 octaves below middle C)
      const formatted = lowC.accept(formatter);
      expect(formatted).to.equal("C,,,");
    });
  });

  describe("Roundtrip conversion", () => {
    const ctx = new ABCContext();
    const formatter = new AbcFormatter2(ctx);

    // Test cases for roundtrip conversion (toMidiPitch -> fromMidiPitch)
    const abcNotations = [
      "c",
      "d",
      "e",
      "f",
      "g",
      "a",
      "b", // Middle octave
      "C",
      "D",
      "E",
      "F",
      "G",
      "A",
      "B", // Below middle octave
      "c'",
      "d'",
      "e'",
      "f'",
      "g'",
      "a'",
      "b'", // Above middle octave
      "C,",
      "D,",
      "E,",
      "F,",
      "G,",
      "A,",
      "B,", // Two octaves below middle
      "^c",
      "^d",
      "^f",
      "^g",
      "^a", // Sharps
      "_d",
      "_e",
      "_g",
      "_a",
      "_b", // Flats
    ];

    // Helper function to create a pitch from ABC notation
    const createPitchFromAbc = (abc: string) => {
      // This is a simplified approach - in a real implementation,
      // you would parse the ABC notation to create a proper Pitch object
      const tokens = abc.split("");
      let alteration, noteLetter, octave;

      if (tokens[0] === "^" || tokens[0] === "_") {
        alteration = tokens.shift();
      }

      noteLetter = tokens.shift();

      if (tokens.length > 0) {
        octave = tokens.join("");
      }

      // Create a mock pitch object for testing
      return {
        alteration: alteration ? { lexeme: alteration } : undefined,
        noteLetter: { lexeme: noteLetter },
        octave: octave ? { lexeme: octave } : undefined,
      };
    };

    abcNotations.forEach((abc) => {
      it(`should correctly roundtrip convert "${abc}"`, () => {
        // Create a mock pitch object
        const mockPitch = createPitchFromAbc(abc) as any;

        // Convert to MIDI pitch
        const midiPitch = toMidiPitch(mockPitch);

        // Convert back to ABC notation
        const convertedPitch = fromMidiPitch(midiPitch, ctx);

        // The formatted result might not be exactly the same as the input
        // due to different ways to represent the same pitch (e.g., ^F vs _G)
        // So we convert both to MIDI again to compare
        const originalMidi = toMidiPitch(mockPitch);
        const convertedMidi = toMidiPitch(convertedPitch);

        expect(convertedMidi).to.equal(originalMidi);
      });
    });
  });

  describe("Integration tests - Transposer class", () => {
    const ctx = new ABCContext();
    const formatter = new AbcFormatter2(ctx);

    // Helper function to create a pitch from ABC notation
    const createPitch = (noteLetter: string, alteration?: string, octave?: string): Pitch => {
      const id = ctx.generateId();

      const noteLetterToken = new Token(TT.NOTE_LETTER, noteLetter, ctx.generateId());
      const alterationToken = alteration ? new Token(TT.ACCIDENTAL, alteration, ctx.generateId()) : undefined;
      const octaveToken = octave ? new Token(TT.OCTAVE, octave, ctx.generateId()) : undefined;

      return new Pitch(id, {
        noteLetter: noteLetterToken,
        alteration: alterationToken,
        octave: octaveToken,
      });
    };

    // Create a minimal File_structure for the Transposer
    const createFileStructure = (): File_structure => {
      return new File_structure(ctx.generateId(), new File_header(ctx.generateId(), []), []);
    };

    it("should transpose C up by a semitone to C#", () => {
      // Create a pitch C
      const pitch = createPitch("C");

      // Create a transposer with a distance of 1 semitone
      const transposer = new Transposer(createFileStructure(), ctx);
      transposer.distance = 1;

      // Apply the transposition
      const transposedPitch = pitch.accept(transposer);

      // Format the result
      const formatted = transposedPitch.accept(formatter);

      // Verify the result
      expect(formatted).to.equal("^C");
    });

    it("should transpose C up by a whole tone to D", () => {
      const pitch = createPitch("C");

      const transposer = new Transposer(createFileStructure(), ctx);
      transposer.distance = 2;

      const transposedPitch = pitch.accept(transposer);
      const formatted = transposedPitch.accept(formatter);

      expect(formatted).to.equal("D");
    });

    it("should transpose C up by an octave to c", () => {
      const pitch = createPitch("C");

      const transposer = new Transposer(createFileStructure(), ctx);
      transposer.distance = 12;

      const transposedPitch = pitch.accept(transposer);
      const formatted = transposedPitch.accept(formatter);

      expect(formatted).to.equal("c");
    });

    it("should transpose c down by an octave to C", () => {
      const pitch = createPitch("c");

      const transposer = new Transposer(createFileStructure(), ctx);
      transposer.distance = -12;

      const transposedPitch = pitch.accept(transposer);
      const formatted = transposedPitch.accept(formatter);

      expect(formatted).to.equal("C");
    });

    it("should transpose F# up by a perfect fourth to B", () => {
      const pitch = createPitch("F", "^");

      const transposer = new Transposer(createFileStructure(), ctx);
      transposer.distance = 5; // Perfect fourth = 5 semitones

      const transposedPitch = pitch.accept(transposer);
      const formatted = transposedPitch.accept(formatter);

      expect(formatted).to.equal("B");
    });

    it("should transpose A down by a minor third to F#", () => {
      const pitch = createPitch("A");

      const transposer = new Transposer(createFileStructure(), ctx);
      transposer.distance = -3; // Minor third = 3 semitones

      const transposedPitch = pitch.accept(transposer);
      const formatted = transposedPitch.accept(formatter);

      expect(formatted).to.equal("^F");
    });

    it("should transpose across octave boundaries", () => {
      const pitch = createPitch("B");

      const transposer = new Transposer(createFileStructure(), ctx);
      transposer.distance = 1; // B to C crosses octave boundary

      const transposedPitch = pitch.accept(transposer);
      const formatted = transposedPitch.accept(formatter);

      expect(formatted).to.equal("c");
    });

    it("should handle complex transpositions with octave markers", () => {
      const pitch = createPitch("c", undefined, "'");

      const transposer = new Transposer(createFileStructure(), ctx);
      transposer.distance = 7; // Perfect fifth = 7 semitones

      const transposedPitch = pitch.accept(transposer);
      const formatted = transposedPitch.accept(formatter);

      expect(formatted).to.equal("g'");
    });

    it("should handle transpositions that result in double sharps or flats", () => {
      // This test is more for future consideration, as the current implementation
      // doesn't handle double sharps/flats in the fromMidiPitch function
      const pitch = createPitch("G", "^");

      const transposer = new Transposer(createFileStructure(), ctx);
      transposer.distance = 1; // G# to A

      const transposedPitch = pitch.accept(transposer);
      const formatted = transposedPitch.accept(formatter);

      expect(formatted).to.equal("A");
    });

    it("should handle multiple consecutive transpositions", () => {
      let pitch = createPitch("C");

      const transposer = new Transposer(createFileStructure(), ctx);
      transposer.distance = 2; // C to D

      // First transposition: C to D
      let transposedPitch = pitch.accept(transposer);
      let formatted = transposedPitch.accept(formatter);
      expect(formatted).to.equal("D");

      // Second transposition: D to E
      transposedPitch = transposedPitch.accept(transposer);
      formatted = transposedPitch.accept(formatter);
      expect(formatted).to.equal("E");

      // Third transposition: E to F#
      transposedPitch = transposedPitch.accept(transposer);
      formatted = transposedPitch.accept(formatter);
      expect(formatted).to.equal("^F");
    });
  });
});
