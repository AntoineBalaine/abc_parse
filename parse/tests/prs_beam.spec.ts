import { assert } from "chai";
import { ABCContext } from "../parsers/Context";
import { parseNote, prcssBms } from "../parsers/parse2";
import { TT } from "../parsers/scan2";
import { Note, Beam, Pitch, BarLine, Chord, Rhythm } from "../types/Expr2";
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

  it("should not beam zero-duration notes (B0)", () => {
    const abcContext = new ABCContext();

    // Create a zero-duration note (B0)
    const zeroRhythm = new Rhythm(abcContext.generateId(), createToken(TT.RHY_NUMER, "0"));
    const zeroNote = new Note(
      abcContext.generateId(),
      new Pitch(abcContext.generateId(), { noteLetter: createToken(TT.NOTE_LETTER, "B") }),
      zeroRhythm
    );

    // Create regular notes
    const note1 = new Note(abcContext.generateId(), new Pitch(abcContext.generateId(), { noteLetter: createToken(TT.NOTE_LETTER, "C") }));
    const note2 = new Note(abcContext.generateId(), new Pitch(abcContext.generateId(), { noteLetter: createToken(TT.NOTE_LETTER, "D") }));

    const elements = [note1, zeroNote, note2];

    // Process beams
    const result = prcssBms(elements, abcContext);

    // Zero-duration note should break beams: C alone, B0 alone, D alone
    assert.equal(result.length, 3);
    assert.instanceOf(result[0], Note);
    assert.instanceOf(result[1], Note);
    assert.instanceOf(result[2], Note);
  });

  it("should break beam before and after zero-duration note (CDB0EF)", () => {
    const abcContext = new ABCContext();

    // Create notes: C, D, B0, E, F
    const noteC = new Note(abcContext.generateId(), new Pitch(abcContext.generateId(), { noteLetter: createToken(TT.NOTE_LETTER, "C") }));
    const noteD = new Note(abcContext.generateId(), new Pitch(abcContext.generateId(), { noteLetter: createToken(TT.NOTE_LETTER, "D") }));

    const zeroRhythm = new Rhythm(abcContext.generateId(), createToken(TT.RHY_NUMER, "0"));
    const zeroB = new Note(
      abcContext.generateId(),
      new Pitch(abcContext.generateId(), { noteLetter: createToken(TT.NOTE_LETTER, "B") }),
      zeroRhythm
    );

    const noteE = new Note(abcContext.generateId(), new Pitch(abcContext.generateId(), { noteLetter: createToken(TT.NOTE_LETTER, "E") }));
    const noteF = new Note(abcContext.generateId(), new Pitch(abcContext.generateId(), { noteLetter: createToken(TT.NOTE_LETTER, "F") }));

    const elements = [noteC, noteD, zeroB, noteE, noteF];

    // Process beams
    const result = prcssBms(elements, abcContext);

    // CD should be beamed, B0 alone, EF should be beamed
    assert.equal(result.length, 3);
    assert.instanceOf(result[0], Beam);
    assert.equal((result[0] as Beam).contents.length, 2);
    assert.instanceOf(result[1], Note); // B0 alone
    assert.instanceOf(result[2], Beam);
    assert.equal((result[2] as Beam).contents.length, 2);
  });

  it("should not beam consecutive zero-duration notes (B0 B0 B0)", () => {
    const abcContext = new ABCContext();

    // Create three zero-duration notes
    const notes = [1, 2, 3].map(() => {
      const zeroRhythm = new Rhythm(abcContext.generateId(), createToken(TT.RHY_NUMER, "0"));
      return new Note(
        abcContext.generateId(),
        new Pitch(abcContext.generateId(), { noteLetter: createToken(TT.NOTE_LETTER, "B") }),
        zeroRhythm
      );
    });

    // Process beams
    const result = prcssBms(notes, abcContext);

    // All three should remain as individual notes, no beaming
    assert.equal(result.length, 3);
    assert.instanceOf(result[0], Note);
    assert.instanceOf(result[1], Note);
    assert.instanceOf(result[2], Note);
  });

  it("should not beam zero-duration chord ([CEG]0)", () => {
    const abcContext = new ABCContext();

    // Create a zero-duration chord
    const chordNote1 = new Note(abcContext.generateId(), new Pitch(abcContext.generateId(), { noteLetter: createToken(TT.NOTE_LETTER, "C") }));
    const chordNote2 = new Note(abcContext.generateId(), new Pitch(abcContext.generateId(), { noteLetter: createToken(TT.NOTE_LETTER, "E") }));
    const chordNote3 = new Note(abcContext.generateId(), new Pitch(abcContext.generateId(), { noteLetter: createToken(TT.NOTE_LETTER, "G") }));
    const zeroRhythm = new Rhythm(abcContext.generateId(), createToken(TT.RHY_NUMER, "0"));
    const zeroChord = new Chord(abcContext.generateId(), [chordNote1, chordNote2, chordNote3], zeroRhythm);

    // Create regular notes around it
    const noteA = new Note(abcContext.generateId(), new Pitch(abcContext.generateId(), { noteLetter: createToken(TT.NOTE_LETTER, "A") }));
    const noteB = new Note(abcContext.generateId(), new Pitch(abcContext.generateId(), { noteLetter: createToken(TT.NOTE_LETTER, "B") }));

    const elements = [noteA, zeroChord, noteB];

    // Process beams
    const result = prcssBms(elements, abcContext);

    // A alone, [CEG]0 alone, B alone
    assert.equal(result.length, 3);
    assert.instanceOf(result[0], Note);
    assert.instanceOf(result[1], Chord);
    assert.instanceOf(result[2], Note);
  });

  it("should not beam chord with zero-duration first note ([C0EG])", () => {
    const abcContext = new ABCContext();

    // Create a chord where first note has zero duration
    const zeroRhythm = new Rhythm(abcContext.generateId(), createToken(TT.RHY_NUMER, "0"));
    const chordNote1 = new Note(
      abcContext.generateId(),
      new Pitch(abcContext.generateId(), { noteLetter: createToken(TT.NOTE_LETTER, "C") }),
      zeroRhythm
    );
    const chordNote2 = new Note(abcContext.generateId(), new Pitch(abcContext.generateId(), { noteLetter: createToken(TT.NOTE_LETTER, "E") }));
    const chordNote3 = new Note(abcContext.generateId(), new Pitch(abcContext.generateId(), { noteLetter: createToken(TT.NOTE_LETTER, "G") }));
    // Chord has no rhythm of its own, so first note's rhythm is used
    const chord = new Chord(abcContext.generateId(), [chordNote1, chordNote2, chordNote3]);

    // Create regular notes around it
    const noteA = new Note(abcContext.generateId(), new Pitch(abcContext.generateId(), { noteLetter: createToken(TT.NOTE_LETTER, "A") }));
    const noteB = new Note(abcContext.generateId(), new Pitch(abcContext.generateId(), { noteLetter: createToken(TT.NOTE_LETTER, "B") }));

    const elements = [noteA, chord, noteB];

    // Process beams
    const result = prcssBms(elements, abcContext);

    // A alone, [C0EG] alone, B alone
    assert.equal(result.length, 3);
    assert.instanceOf(result[0], Note);
    assert.instanceOf(result[1], Chord);
    assert.instanceOf(result[2], Note);
  });
});

