import { assert } from "chai";
import { parseRhythm } from "../parsers/parse2";
import { TT } from "../parsers/scan2";
import { Rhythm } from "../types/Expr2";
import { createToken, createParseCtx } from "./prs_music_code.spec";

describe("parseRhythm", () => {
  it("should parse a numerator only", () => {
    const tokens = [createToken(TT.RHY_NUMER, "2")];
    const ctx = createParseCtx(tokens);

    const result = parseRhythm(ctx);

    assert.isDefined(result);
    assert.instanceOf(result, Rhythm);
    assert.equal(result?.numerator?.lexeme, "2");
    assert.isUndefined(result?.separator);
    assert.isNull(result?.denominator);
    assert.isNull(result?.broken);
  });

  it("should parse a separator only", () => {
    const tokens = [createToken(TT.RHY_SEP, "/")];
    const ctx = createParseCtx(tokens);

    const result = parseRhythm(ctx);

    assert.isDefined(result);
    assert.instanceOf(result, Rhythm);
    assert.isNull(result?.numerator);
    assert.equal(result?.separator?.lexeme, "/");
    assert.isNull(result?.denominator);
    assert.isNull(result?.broken);
  });

  it("should parse a separator and denominator", () => {
    const tokens = [createToken(TT.RHY_SEP, "/"), createToken(TT.RHY_DENOM, "2")];
    const ctx = createParseCtx(tokens);

    const result = parseRhythm(ctx);

    assert.isDefined(result);
    assert.instanceOf(result, Rhythm);
    assert.isNull(result?.numerator);
    assert.equal(result?.separator?.lexeme, "/");
    assert.equal(result?.denominator?.lexeme, "2");
    assert.isNull(result?.broken);
  });

  it("should parse a numerator, separator, and denominator", () => {
    const tokens = [createToken(TT.RHY_NUMER, "3"), createToken(TT.RHY_SEP, "/"), createToken(TT.RHY_DENOM, "2")];
    const ctx = createParseCtx(tokens);

    const result = parseRhythm(ctx);

    assert.isDefined(result);
    assert.instanceOf(result, Rhythm);
    assert.equal(result?.numerator?.lexeme, "3");
    assert.equal(result?.separator?.lexeme, "/");
    assert.equal(result?.denominator?.lexeme, "2");
    assert.isNull(result?.broken);
  });

  it("should parse a broken rhythm (>)", () => {
    const tokens = [createToken(TT.RHY_BRKN, ">")];
    const ctx = createParseCtx(tokens);

    const result = parseRhythm(ctx);

    assert.isDefined(result);
    assert.instanceOf(result, Rhythm);
    assert.isNull(result?.numerator);
    assert.isUndefined(result?.separator);
    assert.isNull(result?.denominator);
    assert.equal(result?.broken?.lexeme, ">");
  });

  it("should parse a broken rhythm (<)", () => {
    const tokens = [createToken(TT.RHY_BRKN, "<")];
    const ctx = createParseCtx(tokens);

    const result = parseRhythm(ctx);

    assert.isDefined(result);
    assert.instanceOf(result, Rhythm);
    assert.isNull(result?.numerator);
    assert.isUndefined(result?.separator);
    assert.isNull(result?.denominator);
    assert.equal(result?.broken?.lexeme, "<");
  });

  it("should parse a double broken rhythm (>>)", () => {
    const tokens = [createToken(TT.RHY_BRKN, ">>")];
    const ctx = createParseCtx(tokens);

    const result = parseRhythm(ctx);

    assert.isDefined(result);
    assert.instanceOf(result, Rhythm);
    assert.isNull(result?.numerator);
    assert.isUndefined(result?.separator);
    assert.isNull(result?.denominator);
    assert.equal(result?.broken?.lexeme, ">>");
  });

  it("should parse a numerator with broken rhythm", () => {
    const tokens = [createToken(TT.RHY_NUMER, "2"), createToken(TT.RHY_BRKN, ">")];
    const ctx = createParseCtx(tokens);

    const result = parseRhythm(ctx);

    assert.isDefined(result);
    assert.instanceOf(result, Rhythm);
    assert.equal(result?.numerator?.lexeme, "2");
    assert.isUndefined(result?.separator);
    assert.isNull(result?.denominator);
    assert.equal(result?.broken?.lexeme, ">");
  });

  it("should parse a complex rhythm with all components", () => {
    const tokens = [createToken(TT.RHY_NUMER, "3"), createToken(TT.RHY_SEP, "/"), createToken(TT.RHY_DENOM, "2"), createToken(TT.RHY_BRKN, ">")];
    const ctx = createParseCtx(tokens);

    const result = parseRhythm(ctx);

    assert.isDefined(result);
    assert.instanceOf(result, Rhythm);
    assert.equal(result?.numerator?.lexeme, "3");
    assert.equal(result?.separator?.lexeme, "/");
    assert.equal(result?.denominator?.lexeme, "2");
    assert.equal(result?.broken?.lexeme, ">");
  });

  it("should return undefined when no rhythm components are present", () => {
    const tokens = [createToken(TT.NOTE_LETTER, "C")];
    const ctx = createParseCtx(tokens);

    const result = parseRhythm(ctx);

    assert.isUndefined(result);
    assert.equal(ctx.current, 0); // Should not advance the current position
  });
});

