import { expect } from "chai";
import { ABCContext } from "../parsers/Context";
import { Token, TT } from "../parsers/scan2";
import { File_header, File_structure, Note, Pitch, Tune, Tune_Body, Tune_header } from "../types/Expr2";
import { Range } from "../types/types";
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

  describe("Range-based transposition", () => {
    const ctx = new ABCContext();
    const formatter = new AbcFormatter2(ctx);

    // Helper function to create a note with position information
    const createNote = (noteLetter: string, line: number, position: number, alteration?: string, octave?: string): Note => {
      const id = ctx.generateId();

      const noteLetterToken = new Token(TT.NOTE_LETTER, noteLetter, ctx.generateId());
      noteLetterToken.line = line;
      noteLetterToken.position = position;

      const alterationToken = alteration ? new Token(TT.ACCIDENTAL, alteration, ctx.generateId()) : undefined;
      if (alterationToken) {
        alterationToken.line = line;
        alterationToken.position = position - 1;
      }

      const octaveToken = octave ? new Token(TT.OCTAVE, octave, ctx.generateId()) : undefined;
      if (octaveToken) {
        octaveToken.line = line;
        octaveToken.position = position + 1;
      }

      const pitch = new Pitch(ctx.generateId(), {
        noteLetter: noteLetterToken,
        alteration: alterationToken,
        octave: octaveToken,
      });

      return new Note(id, pitch);
    };

    // Create a tune with multiple notes at different positions
    const createTuneWithNotes = (): Tune => {
      const tuneId = ctx.generateId();
      const tuneHeaderId = ctx.generateId();
      const tuneBodyId = ctx.generateId();

      // Create notes at different positions
      const note1 = createNote("C", 1, 0); // C at line 1, position 0
      const note2 = createNote("D", 1, 2); // D at line 1, position 2
      const note3 = createNote("E", 1, 4); // E at line 1, position 4
      const note4 = createNote("F", 1, 6); // F at line 1, position 6
      const note5 = createNote("G", 1, 8); // G at line 1, position 8

      // Create a tune body with the notes
      const tuneBody = new Tune_Body(tuneBodyId, [[note1, note2, note3, note4, note5]]);

      // Create a tune with the tune body
      const tune = new Tune(tuneId, new Tune_header(tuneHeaderId, []), tuneBody);

      return tune;
    };

    // Create a file structure with the tune
    const createFileStructureWithTune = (): File_structure => {
      const fileStructureId = ctx.generateId();
      const fileHeaderId = ctx.generateId();

      const tune = createTuneWithNotes();

      return new File_structure(fileStructureId, new File_header(fileHeaderId, []), [tune]);
    };

    it("should transpose only notes within the specified range", () => {
      // Create a file structure with notes
      const fileStructure = createFileStructureWithTune();

      // Define a range that includes only the middle notes (D and E)
      const range: Range = {
        start: { line: 1, character: 2 },
        end: { line: 1, character: 5 },
      };

      // Create a transposer and transpose with the range
      const transposer = new Transposer(fileStructure, ctx);
      const transposedFileStructure = transposer.transpose(2, range); // Transpose up by a whole tone

      // Get the transposed notes
      const transposedTune = transposedFileStructure.contents[0] as Tune;
      const transposedNotes = transposedTune.tune_body?.sequence[0] as Note[];

      // Format the notes to check their values
      const formattedNotes = transposedNotes.map((note) => {
        if (note instanceof Note) {
          return note.pitch.accept(formatter);
        }
        return null;
      });

      // Verify that only the notes within the range were transposed
      expect(formattedNotes[0]).to.equal("C"); // Not transposed
      expect(formattedNotes[1]).to.equal("E"); // D -> E
      expect(formattedNotes[2]).to.equal("^F"); // E -> F#
      expect(formattedNotes[3]).to.equal("F"); // Not transposed
      expect(formattedNotes[4]).to.equal("G"); // Not transposed
    });

    it("should transpose all notes when no range is specified", () => {
      // Create a file structure with notes
      const fileStructure = createFileStructureWithTune();

      // Create a transposer and transpose without a range
      const transposer = new Transposer(fileStructure, ctx);
      const transposedFileStructure = transposer.transpose(2); // Transpose up by a whole tone

      // Get the transposed notes
      const transposedTune = transposedFileStructure.contents[0] as Tune;
      const transposedNotes = transposedTune.tune_body?.sequence[0] as Note[];

      // Format the notes to check their values
      const formattedNotes = transposedNotes.map((note) => {
        if (note instanceof Note) {
          return note.pitch.accept(formatter);
        }
        return null;
      });

      // Verify that all notes were transposed
      expect(formattedNotes[0]).to.equal("D"); // C -> D
      expect(formattedNotes[1]).to.equal("E"); // D -> E
      expect(formattedNotes[2]).to.equal("^F"); // E -> F#
      expect(formattedNotes[3]).to.equal("G"); // F -> G
      expect(formattedNotes[4]).to.equal("A"); // G -> A
    });

    it("should handle range that partially overlaps with notes", () => {
      // Create a file structure with notes
      const fileStructure = createFileStructureWithTune();

      // Define a range that partially overlaps with the first note
      const range: Range = {
        start: { line: 0, character: 0 },
        end: { line: 1, character: 1 },
      };

      // Create a transposer and transpose with the range
      const transposer = new Transposer(fileStructure, ctx);
      const transposedFileStructure = transposer.transpose(2, range); // Transpose up by a whole tone

      // Get the transposed notes
      const transposedTune = transposedFileStructure.contents[0] as Tune;
      const transposedNotes = transposedTune.tune_body?.sequence[0] as Note[];

      // Format the notes to check their values
      const formattedNotes = transposedNotes.map((note) => {
        if (note instanceof Note) {
          return note.pitch.accept(formatter);
        }
        return null;
      });

      // Verify that only the first note was transposed
      expect(formattedNotes[0]).to.equal("D"); // C -> D
      expect(formattedNotes[1]).to.equal("D"); // Not transposed
      expect(formattedNotes[2]).to.equal("E"); // Not transposed
      expect(formattedNotes[3]).to.equal("F"); // Not transposed
      expect(formattedNotes[4]).to.equal("G"); // Not transposed
    });

    it("should handle range that doesn't include any notes", () => {
      // Create a file structure with notes
      const fileStructure = createFileStructureWithTune();

      // Define a range that doesn't include any notes
      const range: Range = {
        start: { line: 2, character: 0 },
        end: { line: 3, character: 10 },
      };

      // Create a transposer and transpose with the range
      const transposer = new Transposer(fileStructure, ctx);
      const transposedFileStructure = transposer.transpose(2, range); // Transpose up by a whole tone

      // Get the transposed notes
      const transposedTune = transposedFileStructure.contents[0] as Tune;
      const transposedNotes = transposedTune.tune_body?.sequence[0] as Note[];

      // Format the notes to check their values
      const formattedNotes = transposedNotes.map((note) => {
        if (note instanceof Note) {
          return note.pitch.accept(formatter);
        }
        return null;
      });

      // Verify that no notes were transposed
      expect(formattedNotes[0]).to.equal("C"); // Not transposed
      expect(formattedNotes[1]).to.equal("D"); // Not transposed
      expect(formattedNotes[2]).to.equal("E"); // Not transposed
      expect(formattedNotes[3]).to.equal("F"); // Not transposed
      expect(formattedNotes[4]).to.equal("G"); // Not transposed
    });
  });
});
