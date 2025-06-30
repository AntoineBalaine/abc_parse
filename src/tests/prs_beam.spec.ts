import { assert } from "chai";
import { ABCContext } from "../parsers/Context";
import { parseNote, prcssBms } from "../parsers/parse2";
import { TT } from "../parsers/scan2";
import { Note, Beam, Pitch, BarLine, Chord } from "../types/Expr2";
import { createToken, createParseCtx } from "./prs_music_code.spec";

describe("prcssBms", () => {
  it("should group consecutive notes into a beam", () => {
    const abcContext = new ABCContext();
    const tokens = [createToken(TT.NOTE_LETTER, "C"), createToken(TT.NOTE_LETTER, "D"), createToken(TT.NOTE_LETTER, "E")];

    // Create notes from tokens
    const notes = tokens
      .map((token) => {
        const ctx = createParseCtx([token]);
        return parseNote(ctx);
      })
      .filter((e): e is Note => e !== null);

    // Process beams
    const result = prcssBms(notes, abcContext);

    // Verify result
    assert.equal(result.length, 1);
    assert.instanceOf(result[0], Beam);
    assert.equal((result[0] as Beam).contents.length, 3);
  });

  it("should not beam notes separated by whitespace", () => {
    const abcContext = new ABCContext();
    const note1 = new Note(abcContext.generateId(), new Pitch(abcContext.generateId(), { noteLetter: createToken(TT.NOTE_LETTER, "C") }));
    const ws = createToken(TT.WS, " ");
    const note2 = new Note(abcContext.generateId(), new Pitch(abcContext.generateId(), { noteLetter: createToken(TT.NOTE_LETTER, "D") }));

    const elements = [note1, ws, note2];

    // Process beams
    const result = prcssBms(elements, abcContext);

    // Verify result
    assert.equal(result.length, 3);
    assert.instanceOf(result[0], Note);
    assert.equal(result[1], ws);
    assert.instanceOf(result[2], Note);
  });

  it("should not beam notes separated by barlines", () => {
    const abcContext = new ABCContext();
    const note1 = new Note(abcContext.generateId(), new Pitch(abcContext.generateId(), { noteLetter: createToken(TT.NOTE_LETTER, "C") }));
    const barline = new BarLine(abcContext.generateId(), [createToken(TT.BARLINE, "|")]);
    const note2 = new Note(abcContext.generateId(), new Pitch(abcContext.generateId(), { noteLetter: createToken(TT.NOTE_LETTER, "D") }));

    const elements = [note1, barline, note2];

    // Process beams
    const result = prcssBms(elements, abcContext);

    // Verify result
    assert.equal(result.length, 3);
    assert.instanceOf(result[0], Note);
    assert.instanceOf(result[1], BarLine);
    assert.instanceOf(result[2], Note);
  });

  it("should include chords in beams", () => {
    const abcContext = new ABCContext();

    // Create a note
    const note = new Note(abcContext.generateId(), new Pitch(abcContext.generateId(), { noteLetter: createToken(TT.NOTE_LETTER, "C") }));

    // Create a chord
    const chordNote1 = new Note(abcContext.generateId(), new Pitch(abcContext.generateId(), { noteLetter: createToken(TT.NOTE_LETTER, "E") }));
    const chordNote2 = new Note(abcContext.generateId(), new Pitch(abcContext.generateId(), { noteLetter: createToken(TT.NOTE_LETTER, "G") }));
    const chord = new Chord(abcContext.generateId(), [chordNote1, chordNote2]);

    const elements = [note, chord];

    // Process beams
    const result = prcssBms(elements, abcContext);

    // Verify result
    assert.equal(result.length, 1);
    assert.instanceOf(result[0], Beam);
    assert.equal((result[0] as Beam).contents.length, 2);
    assert.instanceOf((result[0] as Beam).contents[0], Note);
    assert.instanceOf((result[0] as Beam).contents[1], Chord);
  });

  it("should handle complex music with multiple beams", () => {
    const abcContext = new ABCContext();

    // Create notes and other elements
    const note1 = new Note(abcContext.generateId(), new Pitch(abcContext.generateId(), { noteLetter: createToken(TT.NOTE_LETTER, "C") }));
    const note2 = new Note(abcContext.generateId(), new Pitch(abcContext.generateId(), { noteLetter: createToken(TT.NOTE_LETTER, "D") }));
    const barline = new BarLine(abcContext.generateId(), [createToken(TT.BARLINE, "|")]);
    const note3 = new Note(abcContext.generateId(), new Pitch(abcContext.generateId(), { noteLetter: createToken(TT.NOTE_LETTER, "E") }));
    const note4 = new Note(abcContext.generateId(), new Pitch(abcContext.generateId(), { noteLetter: createToken(TT.NOTE_LETTER, "F") }));

    const elements = [note1, note2, barline, note3, note4];

    // Process beams
    const result = prcssBms(elements, abcContext);

    // Verify result
    assert.equal(result.length, 3);
    assert.instanceOf(result[0], Beam);
    assert.equal((result[0] as Beam).contents.length, 2);
    assert.instanceOf(result[1], BarLine);
    assert.instanceOf(result[2], Beam);
    assert.equal((result[2] as Beam).contents.length, 2);
  });
});

