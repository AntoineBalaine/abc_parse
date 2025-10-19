import { assert } from "chai";
import { parseBarline } from "../parsers/parse2";
import { TT } from "../parsers/scan2";
import { BarLine } from "../types/Expr2";
import { createParseCtx, createToken } from "./prs_music_code.spec";

describe("parseBarline", () => {
  it("should parse a simple barline", () => {
    const tokens = [createToken(TT.BARLINE, "|")];
    const ctx = createParseCtx(tokens);

    const result = parseBarline(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, BarLine);
    assert.equal(result?.barline[0].lexeme, "|");
    assert.isUndefined(result?.repeatNumbers);
  });

  it("should parse a double barline", () => {
    const tokens = [createToken(TT.BARLINE, "||")];
    const ctx = createParseCtx(tokens);

    const result = parseBarline(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, BarLine);
    assert.equal(result?.barline[0].lexeme, "||");
    assert.isUndefined(result?.repeatNumbers);
  });

  it("should parse a repeat start barline", () => {
    const tokens = [createToken(TT.BARLINE, "|:")];
    const ctx = createParseCtx(tokens);

    const result = parseBarline(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, BarLine);
    assert.equal(result?.barline[0].lexeme, "|:");
    assert.isUndefined(result?.repeatNumbers);
  });

  it("should parse a repeat end barline", () => {
    const tokens = [createToken(TT.BARLINE, ":|")];
    const ctx = createParseCtx(tokens);

    const result = parseBarline(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, BarLine);
    assert.equal(result?.barline[0].lexeme, ":|");
    assert.isUndefined(result?.repeatNumbers);
  });

  it("should parse a barline with repeat numbers", () => {
    const tokens = [createToken(TT.BARLINE, "|"), createToken(TT.REPEAT_NUMBER, "1")];
    const ctx = createParseCtx(tokens);

    const result = parseBarline(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, BarLine);
    assert.equal(result?.barline[0].lexeme, "|");
    assert.isDefined(result?.repeatNumbers);
    assert.equal(result?.repeatNumbers?.[0].lexeme, "1");
  });

  it("should parse a barline with multiple repeat numbers", () => {
    const tokens = [
      createToken(TT.BARLINE, "|"),
      createToken(TT.REPEAT_NUMBER, "1"),
      createToken(TT.REPEAT_COMMA, ","),
      createToken(TT.REPEAT_NUMBER, "2"),
    ];
    const ctx = createParseCtx(tokens);

    const result = parseBarline(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, BarLine);
    assert.equal(result?.barline[0].lexeme, "|");
    assert.isDefined(result?.repeatNumbers);
    assert.equal(result?.repeatNumbers?.length, 3);
    assert.equal(result?.repeatNumbers?.[0].lexeme, "1");
    assert.equal(result?.repeatNumbers?.[1].lexeme, ",");
    assert.equal(result?.repeatNumbers?.[2].lexeme, "2");
  });

  it("should return null for non-barline tokens", () => {
    const tokens = [createToken(TT.NOTE_LETTER, "C")];
    const ctx = createParseCtx(tokens);

    const result = parseBarline(ctx);

    assert.isNull(result);
    assert.equal(ctx.current, 0); // Should not advance the current position
  });
});

