import { assert } from "chai";
import { parseChord } from "../parsers/parse2";
import { TT } from "../parsers/scan2";
import { Chord, Note, Annotation, Rhythm, Pitch } from "../types/Expr2";
import { createToken, createParseCtx } from "./prs_music_code.spec";

describe("parseChord", () => {
  it("should parse a simple chord with one note", () => {
    const tokens = [createToken(TT.CHRD_LEFT_BRKT, "["), createToken(TT.NOTE_LETTER, "C"), createToken(TT.CHRD_RIGHT_BRKT, "]")];
    const ctx = createParseCtx(tokens);

    const result = parseChord(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, Chord);
    assert.equal(result?.contents.length, 1);
    assert.instanceOf(result?.contents[0], Note);
    assert.isUndefined(result?.rhythm);
    assert.isUndefined(result?.tie);
  });

  it("should parse a chord with multiple notes", () => {
    const tokens = [
      createToken(TT.CHRD_LEFT_BRKT, "["),
      createToken(TT.NOTE_LETTER, "C"),
      createToken(TT.NOTE_LETTER, "E"),
      createToken(TT.NOTE_LETTER, "G"),
      createToken(TT.CHRD_RIGHT_BRKT, "]"),
    ];
    const ctx = createParseCtx(tokens);

    const result = parseChord(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, Chord);
    assert.equal(result?.contents.length, 3);
    assert.instanceOf(result?.contents[0], Note);
    assert.instanceOf(result?.contents[1], Note);
    assert.instanceOf(result?.contents[2], Note);
    assert.isUndefined(result?.rhythm);
    assert.isUndefined(result?.tie);
  });

  it("should parse a chord with an annotation", () => {
    const tokens = [
      createToken(TT.CHRD_LEFT_BRKT, "["),
      createToken(TT.ANNOTATION, '"C"'),
      createToken(TT.NOTE_LETTER, "C"),
      createToken(TT.CHRD_RIGHT_BRKT, "]"),
    ];
    const ctx = createParseCtx(tokens);

    const result = parseChord(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, Chord);
    assert.equal(result?.contents.length, 2);
    assert.instanceOf(result?.contents[0], Annotation);
    assert.instanceOf(result?.contents[1], Note);
    assert.isUndefined(result?.rhythm);
    assert.isUndefined(result?.tie);
  });

  it("should parse a chord with a rhythm", () => {
    const tokens = [
      createToken(TT.CHRD_LEFT_BRKT, "["),
      createToken(TT.NOTE_LETTER, "C"),
      createToken(TT.CHRD_RIGHT_BRKT, "]"),
      createToken(TT.RHY_NUMER, "2"),
    ];
    const ctx = createParseCtx(tokens);

    const result = parseChord(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, Chord);
    assert.equal(result?.contents.length, 1);
    assert.instanceOf(result?.contents[0], Note);
    assert.instanceOf(result?.rhythm, Rhythm);
    assert.equal(result?.rhythm?.numerator?.lexeme, "2");
    assert.isUndefined(result?.tie);
  });

  it("should parse a chord with a tie", () => {
    const tokens = [
      createToken(TT.CHRD_LEFT_BRKT, "["),
      createToken(TT.NOTE_LETTER, "C"),
      createToken(TT.CHRD_RIGHT_BRKT, "]"),
      createToken(TT.TIE, "-"),
    ];
    const ctx = createParseCtx(tokens);

    const result = parseChord(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, Chord);
    assert.equal(result?.contents.length, 1);
    assert.instanceOf(result?.contents[0], Note);
    assert.isUndefined(result?.rhythm);
    assert.isDefined(result?.tie);
    assert.equal(result?.tie?.lexeme, "-");
  });

  it("should parse a complex chord with multiple notes, rhythm, and tie", () => {
    const tokens = [
      createToken(TT.CHRD_LEFT_BRKT, "["),
      createToken(TT.NOTE_LETTER, "C"),
      createToken(TT.NOTE_LETTER, "E"),
      createToken(TT.NOTE_LETTER, "G"),
      createToken(TT.CHRD_RIGHT_BRKT, "]"),
      createToken(TT.RHY_NUMER, "2"),
      createToken(TT.TIE, "-"),
    ];
    const ctx = createParseCtx(tokens);

    const result = parseChord(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, Chord);
    assert.equal(result?.contents.length, 3);
    assert.instanceOf(result?.contents[0], Note);
    assert.instanceOf(result?.contents[1], Note);
    assert.instanceOf(result?.contents[2], Note);
    assert.instanceOf(result?.rhythm, Rhythm);
    assert.equal(result?.rhythm?.numerator?.lexeme, "2");
    assert.isDefined(result?.tie);
    assert.equal(result?.tie?.lexeme, "-");
  });

  it("should return null for non-chord tokens", () => {
    const tokens = [createToken(TT.NOTE_LETTER, "C")];
    const ctx = createParseCtx(tokens);

    const result = parseChord(ctx);

    assert.isNull(result);
    assert.equal(ctx.current, 0); // Should not advance the current position
  });

  it("should handle unterminated chords", () => {
    const tokens = [createToken(TT.CHRD_LEFT_BRKT, "["), createToken(TT.NOTE_LETTER, "C")];
    const ctx = createParseCtx(tokens);

    const result = parseChord(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, Chord);
    assert.equal(result?.contents.length, 1);
    assert.instanceOf(result?.contents[0], Note);
    assert.isUndefined(result?.rhythm);
    assert.isUndefined(result?.tie);
  });

  it("should parse a chord with accidental [^aa]", () => {
    // Create tokens for [^aa]
    const tokens = [
      createToken(TT.CHRD_LEFT_BRKT, "["),
      createToken(TT.ACCIDENTAL, "^"),
      createToken(TT.NOTE_LETTER, "a"),
      createToken(TT.NOTE_LETTER, "a"),
      createToken(TT.CHRD_RIGHT_BRKT, "]"),
      createToken(TT.EOL, "\n"),
    ];
    const ctx = createParseCtx(tokens);

    const result = parseChord(ctx);

    // Verify the result
    assert.isNotNull(result);
    assert.instanceOf(result, Chord);
    assert.equal(result?.contents.length, 2);

    // First note should have an accidental
    assert.instanceOf(result?.contents[0], Note);
    assert.instanceOf((result?.contents[0] as Note).pitch, Pitch);
    assert.equal(((result?.contents[0] as Note).pitch as Pitch).noteLetter.lexeme, "a");
    assert.equal(((result?.contents[0] as Note).pitch as Pitch).alteration?.lexeme, "^");

    // Second note should not have an accidental
    assert.instanceOf(result?.contents[1], Note);
    assert.instanceOf((result?.contents[1] as Note).pitch, Pitch);
    assert.equal(((result?.contents[1] as Note).pitch as Pitch).noteLetter.lexeme, "a");
    assert.isUndefined(((result?.contents[1] as Note).pitch as Pitch).alteration);
  });
});

