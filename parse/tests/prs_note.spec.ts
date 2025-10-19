import { assert } from "chai";
import { parseNote } from "../parsers/parse2";
import { TT } from "../parsers/scan2";
import { Note, Pitch, Rhythm } from "../types/Expr2";
import { createToken, createParseCtx } from "./prs_music_code.spec";

describe("parseNote", () => {
  it("should parse a simple note", () => {
    const tokens = [createToken(TT.NOTE_LETTER, "C")];
    const ctx = createParseCtx(tokens);

    const result = parseNote(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, Note);
    assert.instanceOf(result?.pitch, Pitch);
    assert.equal((result?.pitch as Pitch).noteLetter.lexeme, "C");
    assert.isUndefined(result?.rhythm);
    assert.isUndefined(result?.tie);
  });

  it("should parse a note with an accidental", () => {
    const tokens = [createToken(TT.ACCIDENTAL, "^"), createToken(TT.NOTE_LETTER, "C")];
    const ctx = createParseCtx(tokens);

    const result = parseNote(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, Note);
    assert.instanceOf(result?.pitch, Pitch);
    assert.equal((result?.pitch as Pitch).noteLetter.lexeme, "C");
    assert.equal((result?.pitch as Pitch).alteration?.lexeme, "^");
    assert.isUndefined(result?.rhythm);
    assert.isUndefined(result?.tie);
  });

  it("should parse a note with an octave", () => {
    const tokens = [createToken(TT.NOTE_LETTER, "C"), createToken(TT.OCTAVE, "'")];
    const ctx = createParseCtx(tokens);

    const result = parseNote(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, Note);
    assert.instanceOf(result?.pitch, Pitch);
    assert.equal((result?.pitch as Pitch).noteLetter.lexeme, "C");
    assert.equal((result?.pitch as Pitch).octave?.lexeme, "'");
    assert.isUndefined(result?.rhythm);
    assert.isUndefined(result?.tie);
  });

  it("should parse a note with a rhythm", () => {
    const tokens = [createToken(TT.NOTE_LETTER, "C"), createToken(TT.RHY_NUMER, "2")];
    const ctx = createParseCtx(tokens);

    const result = parseNote(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, Note);
    assert.instanceOf(result?.pitch, Pitch);
    assert.equal((result?.pitch as Pitch).noteLetter.lexeme, "C");
    assert.instanceOf(result?.rhythm, Rhythm);
    assert.equal(result?.rhythm?.numerator?.lexeme, "2");
    assert.isUndefined(result?.tie);
  });

  it("should parse a note with a tie", () => {
    const tokens = [createToken(TT.NOTE_LETTER, "C"), createToken(TT.TIE, "-")];
    const ctx = createParseCtx(tokens);

    const result = parseNote(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, Note);
    assert.instanceOf(result?.pitch, Pitch);
    assert.equal((result?.pitch as Pitch).noteLetter.lexeme, "C");
    assert.isUndefined(result?.rhythm);
    assert.isDefined(result?.tie);
    assert.equal(result?.tie?.lexeme, "-");
  });

  it("should parse a note with a tie at the start", () => {
    const tokens = [createToken(TT.TIE, "-"), createToken(TT.NOTE_LETTER, "C")];
    const ctx = createParseCtx(tokens);

    const result = parseNote(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, Note);
    assert.instanceOf(result?.pitch, Pitch);
    assert.equal((result?.pitch as Pitch).noteLetter.lexeme, "C");
    assert.isUndefined(result?.rhythm);
    assert.isDefined(result?.tie);
    assert.equal(result?.tie?.lexeme, "-");
  });

  it("should parse a complex note with accidental, octave, rhythm, and tie", () => {
    const tokens = [
      createToken(TT.ACCIDENTAL, "^"),
      createToken(TT.NOTE_LETTER, "C"),
      createToken(TT.OCTAVE, "'"),
      createToken(TT.RHY_NUMER, "2"),
      createToken(TT.TIE, "-"),
    ];
    const ctx = createParseCtx(tokens);

    const result = parseNote(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, Note);
    assert.instanceOf(result?.pitch, Pitch);
    assert.equal((result?.pitch as Pitch).noteLetter.lexeme, "C");
    assert.equal((result?.pitch as Pitch).alteration?.lexeme, "^");
    assert.equal((result?.pitch as Pitch).octave?.lexeme, "'");
    assert.instanceOf(result?.rhythm, Rhythm);
    assert.equal(result?.rhythm?.numerator?.lexeme, "2");
    assert.isDefined(result?.tie);
    assert.equal(result?.tie?.lexeme, "-");
  });

  it("should return null for non-note tokens", () => {
    const tokens = [createToken(TT.BARLINE, "|")];
    const ctx = createParseCtx(tokens);

    const result = parseNote(ctx);

    assert.isNull(result);
    assert.equal(ctx.current, 0); // Should not advance the current position
  });

  it("should rewind if a tie is found but no pitch follows", () => {
    const tokens = [createToken(TT.TIE, "-"), createToken(TT.BARLINE, "|")];
    const ctx = createParseCtx(tokens);

    const result = parseNote(ctx);

    assert.isNull(result);
    assert.equal(ctx.current, 0); // Should rewind to the start
  });
});

