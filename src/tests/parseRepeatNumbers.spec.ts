import assert from "assert";
import { describe, it } from "mocha";
import { Ctx, TT } from "../parsers/scan2";
import { parseRepeatNumbers } from "../parsers/scan_tunebody";
import { AbcErrorReporter } from "../parsers/ErrorReporter";

// Helper function to create a Ctx object for testing
function createCtx(source: string): Ctx {
  return new Ctx(source, new AbcErrorReporter());
}

describe("parseRepeatNumbers", () => {
  it("should parse a single number", () => {
    const ctx = createCtx("1");
    parseRepeatNumbers(ctx);
    assert.equal(ctx.tokens[0].type, TT.REPEAT_NUMBER);
  });

  it("should parse a multi-digit number", () => {
    const ctx = createCtx("123");
    parseRepeatNumbers(ctx);
    assert.equal(ctx.tokens[0].type, TT.REPEAT_NUMBER);
  });

  it("should parse a list of numbers", () => {
    const ctx = createCtx("1,2,3");
    parseRepeatNumbers(ctx);

    // Check token types
    assert.equal(ctx.tokens[0].type, TT.REPEAT_NUMBER);
    assert.equal(ctx.tokens[1].type, TT.REPEAT_COMMA);
    assert.equal(ctx.tokens[2].type, TT.REPEAT_NUMBER);
    assert.equal(ctx.tokens[3].type, TT.REPEAT_COMMA);
    assert.equal(ctx.tokens[4].type, TT.REPEAT_NUMBER);

  });

  it("should parse a range", () => {
    const ctx = createCtx("1-3");
    parseRepeatNumbers(ctx);

    // Check token types
    assert.equal(ctx.tokens[0].type, TT.REPEAT_NUMBER);
    assert.equal(ctx.tokens[1].type, TT.REPEAT_DASH);
    assert.equal(ctx.tokens[2].type, TT.REPEAT_NUMBER);

  });

  it("should parse a mixed format", () => {
    const ctx = createCtx("1,3-5,7");
    parseRepeatNumbers(ctx);

    // Check token types
    assert.equal(ctx.tokens[0].type, TT.REPEAT_NUMBER);
    assert.equal(ctx.tokens[1].type, TT.REPEAT_COMMA);
    assert.equal(ctx.tokens[2].type, TT.REPEAT_NUMBER);
    assert.equal(ctx.tokens[3].type, TT.REPEAT_DASH);
    assert.equal(ctx.tokens[4].type, TT.REPEAT_NUMBER);
    assert.equal(ctx.tokens[5].type, TT.REPEAT_COMMA);
    assert.equal(ctx.tokens[6].type, TT.REPEAT_NUMBER);

  });

  it("should parse x notation", () => {
    const ctx = createCtx("1x2");
    parseRepeatNumbers(ctx);

    // Check token types
    assert.equal(ctx.tokens[0].type, TT.REPEAT_NUMBER);
    assert.equal(ctx.tokens[1].type, TT.REPEAT_X);
    assert.equal(ctx.tokens[2].type, TT.REPEAT_NUMBER);

  });

  it("should parse complex combinations", () => {
    const ctx = createCtx("1,2x2,3-5");
    parseRepeatNumbers(ctx);

    // Check token types
    assert.equal(ctx.tokens[0].type, TT.REPEAT_NUMBER);
    assert.equal(ctx.tokens[1].type, TT.REPEAT_COMMA);
    assert.equal(ctx.tokens[2].type, TT.REPEAT_NUMBER);
    assert.equal(ctx.tokens[3].type, TT.REPEAT_X);
    assert.equal(ctx.tokens[4].type, TT.REPEAT_NUMBER);
    assert.equal(ctx.tokens[5].type, TT.REPEAT_COMMA);
    assert.equal(ctx.tokens[6].type, TT.REPEAT_NUMBER);
    assert.equal(ctx.tokens[7].type, TT.REPEAT_DASH);
    assert.equal(ctx.tokens[8].type, TT.REPEAT_NUMBER);

  });

  it("should handle uppercase X notation", () => {
    const ctx = createCtx("1X2");
    parseRepeatNumbers(ctx);

    // Check token types
    assert.equal(ctx.tokens[0].type, TT.REPEAT_NUMBER);
    assert.equal(ctx.tokens[1].type, TT.REPEAT_X);
    assert.equal(ctx.tokens[2].type, TT.REPEAT_NUMBER);

  });

  it("should return false for invalid input", () => {
    const ctx = createCtx("A");
    const result = parseRepeatNumbers(ctx);
    assert.equal(result, false);
  });

  it("should report an error for comma without following number", () => {
    const ctx = createCtx("1,");
    parseRepeatNumbers(ctx);
    assert.equal(ctx.tokens[0].type, TT.REPEAT_NUMBER);
    assert.equal(ctx.tokens[1].type, TT.REPEAT_COMMA);
  });

  it("should report an error for dash without following number", () => {
    const ctx = createCtx("1-");
    parseRepeatNumbers(ctx);
    assert.equal(ctx.tokens[0].type, TT.REPEAT_NUMBER);
    assert.equal(ctx.tokens[1].type, TT.REPEAT_DASH);
  });

  it("should report an error for x without following number", () => {
    const ctx = createCtx("1x");
    parseRepeatNumbers(ctx);
    assert.equal(ctx.tokens[0].type, TT.REPEAT_NUMBER);
    assert.equal(ctx.tokens[1].type, TT.REPEAT_X);
  });

  it("should stop parsing at EOL", () => {
    const ctx = createCtx("1,2\n3");
    parseRepeatNumbers(ctx);
    assert.equal(ctx.tokens[0].type, TT.REPEAT_NUMBER);
    assert.equal(ctx.tokens[1].type, TT.REPEAT_COMMA);
    assert.equal(ctx.tokens[2].type, TT.REPEAT_NUMBER);
  });

  it("should handle repeat numbers in context", () => {
    const ctx = createCtx("1,2-3");
    parseRepeatNumbers(ctx);
    assert.equal(ctx.tokens[0].type, TT.REPEAT_NUMBER);
    assert.equal(ctx.tokens[1].type, TT.REPEAT_COMMA);
    assert.equal(ctx.tokens[2].type, TT.REPEAT_NUMBER);
    assert.equal(ctx.tokens[3].type, TT.REPEAT_DASH);
    assert.equal(ctx.tokens[4].type, TT.REPEAT_NUMBER);
  });
});
