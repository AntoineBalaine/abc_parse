import assert from "assert";
import { describe, it } from "mocha";
import { Ctx, TT, scanTuneBody } from "../parsers/scan2";
import { AbcErrorReporter } from "../parsers/ErrorReporter";

// Helper function to create a Ctx object for testing
function createCtx(source: string): Ctx {
  return new Ctx(source, new AbcErrorReporter());
}

describe("scanTuneBody", () => {
  it("should tokenize a simple music pattern", () => {
    const ctx = createCtx("A2 B");
    scanTuneBody(ctx);

    // Check that we have the expected token types in the right order
    const expectedTypes = [TT.NOTE_LETTER, TT.RHY_NUMER, TT.WS, TT.NOTE_LETTER];

    assert.equal(ctx.tokens.length, expectedTypes.length, `Expected ${expectedTypes.length} tokens but got ${ctx.tokens.length}`);

    // Check the token types to make sure they match what we expect
    for (let i = 0; i < expectedTypes.length; i++) {
      assert.equal(ctx.tokens[i].type, expectedTypes[i], `Token at index ${i} should be ${expectedTypes[i]} but was ${ctx.tokens[i].type}`);
    }
  });

  it("should tokenize a line with chords and annotations", () => {
    const ctx = createCtx('[CEG] "Cmaj" [FAC] "Fmaj"');
    scanTuneBody(ctx);

    const expectedTypes = [
      TT.CHRD_LEFT_BRKT,
      TT.NOTE_LETTER,
      TT.NOTE_LETTER,
      TT.NOTE_LETTER,
      TT.CHRD_RIGHT_BRKT,
      TT.WS,
      TT.ANNOTATION,
      TT.WS,
      TT.CHRD_LEFT_BRKT,
      TT.NOTE_LETTER,
      TT.NOTE_LETTER,
      TT.NOTE_LETTER,
      TT.CHRD_RIGHT_BRKT,
      TT.WS,
      TT.ANNOTATION,
    ];

    assert.ok(ctx.tokens.length >= expectedTypes.length);

    for (let i = 0; i < Math.min(expectedTypes.length, ctx.tokens.length); i++) {
      assert.equal(ctx.tokens[i].type, expectedTypes[i], `Token at index ${i} should be ${expectedTypes[i]} but was ${ctx.tokens[i].type}`);
    }
  });

  it("should tokenize a line with grace notes and tuplets", () => {
    const ctx = createCtx("{/AC} (3DEF G2");
    scanTuneBody(ctx);

    const expectedTypes = [
      TT.GRC_GRP_LEFT_BRACE,
      TT.GRC_GRP_SLSH,
      TT.NOTE_LETTER,
      TT.NOTE_LETTER,
      TT.GRC_GRP_RGHT_BRACE,
      TT.WS,
      TT.TUPLET,
      TT.NOTE_LETTER,
      TT.NOTE_LETTER,
      TT.NOTE_LETTER,
      TT.WS,
      TT.NOTE_LETTER,
      TT.RHY_NUMER,
    ];

    assert.ok(ctx.tokens.length >= expectedTypes.length);

    for (let i = 0; i < Math.min(expectedTypes.length, ctx.tokens.length); i++) {
      assert.equal(ctx.tokens[i].type, expectedTypes[i], `Token at index ${i} should be ${expectedTypes[i]} but was ${ctx.tokens[i].type}`);
    }
  });

  it("should tokenize a line with barlines and inline fields", () => {
    const ctx = createCtx("| [M:3/4] A B C |");
    scanTuneBody(ctx);

    const expectedTypes = [
      TT.BARLINE,
      TT.WS,
      TT.INLN_FLD_LFT_BRKT,
      TT.INF_HDR,
      TT.INF_TXT,
      TT.INLN_FLD_RGT_BRKT,
      TT.WS,
      TT.NOTE_LETTER,
      TT.WS,
      TT.NOTE_LETTER,
      TT.WS,
      TT.NOTE_LETTER,
      TT.WS,
      TT.BARLINE,
    ];

    assert.ok(ctx.tokens.length >= expectedTypes.length);

    for (let i = 0; i < Math.min(expectedTypes.length, ctx.tokens.length); i++) {
      assert.equal(ctx.tokens[i].type, expectedTypes[i], `Token at index ${i} should be ${expectedTypes[i]} but was ${ctx.tokens[i].type}`);
    }
  });

  it("should tokenize a line with comments and directives", () => {
    const ctx = createCtx("A B C %comment\n%%directive");
    scanTuneBody(ctx);

    const expectedTypes = [TT.NOTE_LETTER, TT.WS, TT.NOTE_LETTER, TT.WS, TT.NOTE_LETTER, TT.WS, TT.COMMENT, TT.EOL, TT.STYLESHEET_DIRECTIVE];

    assert.ok(ctx.tokens.length >= expectedTypes.length);

    for (let i = 0; i < Math.min(expectedTypes.length, ctx.tokens.length); i++) {
      assert.equal(ctx.tokens[i].type, expectedTypes[i], `Token at index ${i} should be ${expectedTypes[i]} but was ${ctx.tokens[i].type}`);
    }
  });

  it("should tokenize a line with slurs and ties", () => {
    const ctx = createCtx("(A-B) C-D");
    scanTuneBody(ctx);

    const expectedTypes = [TT.SLUR, TT.NOTE_LETTER, TT.TIE, TT.NOTE_LETTER, TT.SLUR, TT.WS, TT.NOTE_LETTER, TT.TIE, TT.NOTE_LETTER];

    assert.ok(ctx.tokens.length >= expectedTypes.length);

    for (let i = 0; i < Math.min(expectedTypes.length, ctx.tokens.length); i++) {
      assert.equal(ctx.tokens[i].type, expectedTypes[i], `Token at index ${i} should be ${expectedTypes[i]} but was ${ctx.tokens[i].type}`);
    }
  });
});
