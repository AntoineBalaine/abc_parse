import { assert } from "chai";
import { parseRest } from "../parsers/parse2";
import { TT } from "../parsers/scan2";
import { Rest, Rhythm, MultiMeasureRest } from "../types/Expr2";
import { createToken, createParseCtx } from "./prs_music_code.spec";

describe("parseRest", () => {
  it("should parse a simple rest", () => {
    const tokens = [createToken(TT.REST, "z")];
    const ctx = createParseCtx(tokens);

    const result = parseRest(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, Rest);
    assert.equal(result?.rest.lexeme, "z");
  });

  it("should parse a rest with rhythm", () => {
    const tokens = [createToken(TT.REST, "z"), createToken(TT.RHY_NUMER, "2")];
    const ctx = createParseCtx(tokens);

    const result = parseRest(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, Rest);
    assert.equal(result?.rest.lexeme, "z");
    assert.instanceOf(result?.rhythm, Rhythm);
    assert.equal(result?.rhythm?.numerator?.lexeme, "2");
  });

  it("should parse a multi-measure rest (uppercase Z)", () => {
    const tokens = [createToken(TT.REST, "Z"), createToken(TT.RHY_NUMER, "4")];
    const ctx = createParseCtx(tokens);

    const result = parseRest(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, MultiMeasureRest);
    assert.equal(result?.rest.lexeme, "Z");
    assert.isDefined(result?.length);
    assert.equal(result?.length?.lexeme, "4");
  });

  it("should parse an invisible multi-measure rest (uppercase X)", () => {
    const tokens = [createToken(TT.REST, "X"), createToken(TT.RHY_NUMER, "4")];
    const ctx = createParseCtx(tokens);

    const result = parseRest(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, MultiMeasureRest);
    assert.equal(result?.rest.lexeme, "X");
    assert.isDefined(result?.length);
    assert.equal(result?.length?.lexeme, "4");
  });

  it("should parse a multi-measure rest without length", () => {
    const tokens = [createToken(TT.REST, "Z")];
    const ctx = createParseCtx(tokens);

    const result = parseRest(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, MultiMeasureRest);
    assert.equal(result?.rest.lexeme, "Z");
    assert.isUndefined(result?.length);
  });

  it("should parse a multi-measure rest with length", () => {
    const tokens = [createToken(TT.REST, "Z"), createToken(TT.RHY_NUMER, "2")];
    const ctx = createParseCtx(tokens);

    const result = parseRest(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, MultiMeasureRest);
    assert.equal(result?.rest.lexeme, "Z");
    assert.isDefined(result?.length);
    assert.equal(result?.length.lexeme, "2");
  });

  it("should report an error for multi-measure rest with complex rhythm", () => {
    const tokens = [createToken(TT.REST, "Z"), createToken(TT.RHY_NUMER, "3"), createToken(TT.RHY_SEP, "/"), createToken(TT.RHY_DENOM, "2")];
    const ctx = createParseCtx(tokens);

    const result = parseRest(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, MultiMeasureRest);
    assert.equal(result?.rest.lexeme, "Z");
    assert.isDefined(result?.length);
    assert.equal(result?.length?.lexeme, "3");
  });

  it("should return null for non-rest tokens", () => {
    const tokens = [createToken(TT.NOTE_LETTER, "C")];
    const ctx = createParseCtx(tokens);

    const result = parseRest(ctx);

    assert.isNull(result);
    assert.equal(ctx.current, 0); // Should not advance the current position
  });
});

