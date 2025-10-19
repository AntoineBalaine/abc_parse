import { assert } from "chai";
import { parsePitch } from "../parsers/parse2";
import { TT } from "../parsers/scan2";
import { Pitch } from "../types/Expr2";
import { createToken, createParseCtx } from "./prs_music_code.spec";

describe("parsePitch", () => {
  it("should parse a simple pitch", () => {
    const tokens = [createToken(TT.NOTE_LETTER, "C")];
    const ctx = createParseCtx(tokens);

    const result = parsePitch(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, Pitch);
    assert.equal(result?.noteLetter.lexeme, "C");
    assert.isUndefined(result?.alteration);
    assert.isUndefined(result?.octave);
  });

  it("should parse a pitch with an accidental", () => {
    const tokens = [createToken(TT.ACCIDENTAL, "^"), createToken(TT.NOTE_LETTER, "C")];
    const ctx = createParseCtx(tokens);

    const result = parsePitch(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, Pitch);
    assert.equal(result?.noteLetter.lexeme, "C");
    assert.equal(result?.alteration?.lexeme, "^");
    assert.isUndefined(result?.octave);
  });

  it("should parse a pitch with an octave", () => {
    const tokens = [createToken(TT.NOTE_LETTER, "C"), createToken(TT.OCTAVE, "'")];
    const ctx = createParseCtx(tokens);

    const result = parsePitch(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, Pitch);
    assert.equal(result?.noteLetter.lexeme, "C");
    assert.isUndefined(result?.alteration);
    assert.equal(result?.octave?.lexeme, "'");
  });

  it("should parse a pitch with an accidental and octave", () => {
    const tokens = [createToken(TT.ACCIDENTAL, "^"), createToken(TT.NOTE_LETTER, "C"), createToken(TT.OCTAVE, "'")];
    const ctx = createParseCtx(tokens);

    const result = parsePitch(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, Pitch);
    assert.equal(result?.noteLetter.lexeme, "C");
    assert.equal(result?.alteration?.lexeme, "^");
    assert.equal(result?.octave?.lexeme, "'");
  });

  it("should return null for non-note tokens", () => {
    const tokens = [createToken(TT.BARLINE, "|")];
    const ctx = createParseCtx(tokens);

    const result = parsePitch(ctx);

    assert.isNull(result);
    assert.equal(ctx.current, 0); // Should not advance the current position
  });

  it("should rewind if an accidental is found but no note letter follows", () => {
    const tokens = [createToken(TT.ACCIDENTAL, "^"), createToken(TT.BARLINE, "|")];
    const ctx = createParseCtx(tokens);

    const result = parsePitch(ctx);

    assert.isNull(result);
    assert.equal(ctx.current, 0); // Should rewind to the start
  });
});

