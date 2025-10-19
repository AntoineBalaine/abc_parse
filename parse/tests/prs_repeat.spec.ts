import { assert } from "chai";
import { parseRepeatNumbers } from "../parsers/parse2";
import { TT } from "../parsers/scan2";
import { createToken, createParseCtx } from "./prs_music_code.spec";

describe("parseRepeatNumbers", () => {
  it("should parse a single repeat number", () => {
    const tokens = [createToken(TT.REPEAT_NUMBER, "1")];
    const ctx = createParseCtx(tokens);

    const result = parseRepeatNumbers(ctx);

    assert.isArray(result);
    assert.equal(result.length, 1);
    assert.equal(result[0].type, TT.REPEAT_NUMBER);
    assert.equal(result[0].lexeme, "1");
  });

  it("should parse multiple repeat numbers with commas", () => {
    const tokens = [createToken(TT.REPEAT_NUMBER, "1"), createToken(TT.REPEAT_COMMA, ","), createToken(TT.REPEAT_NUMBER, "2")];
    const ctx = createParseCtx(tokens);

    const result = parseRepeatNumbers(ctx);

    assert.isArray(result);
    assert.equal(result.length, 3);
    assert.equal(result[0].type, TT.REPEAT_NUMBER);
    assert.equal(result[0].lexeme, "1");
    assert.equal(result[1].type, TT.REPEAT_COMMA);
    assert.equal(result[1].lexeme, ",");
    assert.equal(result[2].type, TT.REPEAT_NUMBER);
    assert.equal(result[2].lexeme, "2");
  });

  it("should parse a number range with dash", () => {
    const tokens = [createToken(TT.REPEAT_NUMBER, "1"), createToken(TT.REPEAT_DASH, "-"), createToken(TT.REPEAT_NUMBER, "3")];
    const ctx = createParseCtx(tokens);

    const result = parseRepeatNumbers(ctx);

    assert.isArray(result);
    assert.equal(result.length, 3);
    assert.equal(result[0].type, TT.REPEAT_NUMBER);
    assert.equal(result[0].lexeme, "1");
    assert.equal(result[1].type, TT.REPEAT_DASH);
    assert.equal(result[1].lexeme, "-");
    assert.equal(result[2].type, TT.REPEAT_NUMBER);
    assert.equal(result[2].lexeme, "3");
  });

  it("should parse x notation", () => {
    const tokens = [createToken(TT.REPEAT_NUMBER, "1"), createToken(TT.REPEAT_X, "x"), createToken(TT.REPEAT_NUMBER, "2")];
    const ctx = createParseCtx(tokens);

    const result = parseRepeatNumbers(ctx);

    assert.isArray(result);
    assert.equal(result.length, 3);
    assert.equal(result[0].type, TT.REPEAT_NUMBER);
    assert.equal(result[0].lexeme, "1");
    assert.equal(result[1].type, TT.REPEAT_X);
    assert.equal(result[1].lexeme, "x");
    assert.equal(result[2].type, TT.REPEAT_NUMBER);
    assert.equal(result[2].lexeme, "2");
  });

  it("should parse complex combinations of repeat numbers", () => {
    const tokens = [
      createToken(TT.REPEAT_NUMBER, "1"),
      createToken(TT.REPEAT_COMMA, ","),
      createToken(TT.REPEAT_NUMBER, "2"),
      createToken(TT.REPEAT_DASH, "-"),
      createToken(TT.REPEAT_NUMBER, "4"),
      createToken(TT.REPEAT_COMMA, ","),
      createToken(TT.REPEAT_NUMBER, "5"),
      createToken(TT.REPEAT_X, "x"),
      createToken(TT.REPEAT_NUMBER, "2"),
    ];
    const ctx = createParseCtx(tokens);

    const result = parseRepeatNumbers(ctx);

    assert.isArray(result);
    assert.equal(result.length, 9);

    // Check first part: "1,"
    assert.equal(result[0].type, TT.REPEAT_NUMBER);
    assert.equal(result[0].lexeme, "1");
    assert.equal(result[1].type, TT.REPEAT_COMMA);
    assert.equal(result[1].lexeme, ",");

    // Check second part: "2-4,"
    assert.equal(result[2].type, TT.REPEAT_NUMBER);
    assert.equal(result[2].lexeme, "2");
    assert.equal(result[3].type, TT.REPEAT_DASH);
    assert.equal(result[3].lexeme, "-");
    assert.equal(result[4].type, TT.REPEAT_NUMBER);
    assert.equal(result[4].lexeme, "4");
    assert.equal(result[5].type, TT.REPEAT_COMMA);
    assert.equal(result[5].lexeme, ",");

    // Check third part: "5x2"
    assert.equal(result[6].type, TT.REPEAT_NUMBER);
    assert.equal(result[6].lexeme, "5");
    assert.equal(result[7].type, TT.REPEAT_X);
    assert.equal(result[7].lexeme, "x");
    assert.equal(result[8].type, TT.REPEAT_NUMBER);
    assert.equal(result[8].lexeme, "2");
  });

  it("should stop parsing at non-repeat tokens", () => {
    const tokens = [
      createToken(TT.REPEAT_NUMBER, "1"),
      createToken(TT.REPEAT_COMMA, ","),
      createToken(TT.REPEAT_NUMBER, "2"),
      createToken(TT.NOTE_LETTER, "C"),
    ];
    const ctx = createParseCtx(tokens);

    const result = parseRepeatNumbers(ctx);

    assert.isArray(result);
    assert.equal(result.length, 3);
    assert.equal(ctx.current, 3); // Should stop at the NOTE_LETTER token
  });

  it("should return an empty array if no repeat numbers are present", () => {
    const tokens = [createToken(TT.NOTE_LETTER, "C")];
    const ctx = createParseCtx(tokens);

    const result = parseRepeatNumbers(ctx);

    assert.isArray(result);
    assert.equal(result.length, 0);
    assert.equal(ctx.current, 0); // Should not advance the current position
  });
});

