import assert from "assert";
import { describe, it } from "mocha";
import { Ctx, Scanner2, TT } from "../parsers/scan2";
import { scanTune } from "../parsers/scan_tunebody";
import { AbcErrorReporter } from "../parsers/ErrorReporter";

// Helper function to create a Ctx object for testing
function createCtx(source: string): Ctx {
  return new Ctx(source, new AbcErrorReporter());
}

describe("scanTuneBody", () => {
  it("should tokenize a simple music pattern", () => {
    const ctx = createCtx("A2 B");
    scanTune(ctx);

    // Check that we have the expected token types in the right order
    const expectedTypes = [TT.NOTE_LETTER, TT.RHY_NUMER, TT.WS, TT.NOTE_LETTER];

    assert.equal(ctx.tokens.length, expectedTypes.length, `Expected ${expectedTypes.length} tokens but got ${ctx.tokens.length}`);

    // Check the token types to make sure they match what we expect
    for (let i = 0; i < expectedTypes.length; i++) {
      assert.equal(ctx.tokens[i].type, expectedTypes[i], `Token at index ${i} should be ${expectedTypes[i]} but was ${ctx.tokens[i].type}`);
    }
  });

  it("should tokenize two consecutive tunes separated by a section break", () => {
    // Create a string with two simple tunes separated by \n\n
    const input = "X:1\nA B C\n\nX:2\nD E F";

    // Tokenize the input
    const tokens = Scanner2(input, new AbcErrorReporter());

    // Debug: Print out all tokens for inspection
    console.log("Actual tokens generated:");
    tokens.forEach((token, i) => {
      console.log(`${i}: ${TT[token.type]} - "${token.lexeme}"`);
    });

    // Expected tokens in order with both type and lexeme
    const expectedTokens = [
      // First tune
      { type: TT.INF_HDR, lexeme: "X:" },
      { type: TT.INFO_STR, lexeme: "1" },
      { type: TT.EOL, lexeme: "\n" },
      { type: TT.NOTE_LETTER, lexeme: "A" },
      { type: TT.WS, lexeme: " " },
      { type: TT.NOTE_LETTER, lexeme: "B" },
      { type: TT.WS, lexeme: " " },
      { type: TT.NOTE_LETTER, lexeme: "C" },

      // Section break
      { type: TT.SCT_BRK, lexeme: "\n\n" },

      // Second tune
      { type: TT.INF_HDR, lexeme: "X:" },
      { type: TT.INFO_STR, lexeme: "2" },
      { type: TT.EOL, lexeme: "\n" },
      { type: TT.NOTE_LETTER, lexeme: "D" },
      { type: TT.WS, lexeme: " " },
      { type: TT.NOTE_LETTER, lexeme: "E" },
      { type: TT.WS, lexeme: " " },
      { type: TT.NOTE_LETTER, lexeme: "F" },

      // EOF token
      { type: TT.EOF, lexeme: "" },
    ];

    // Verify the token count
    assert.equal(tokens.length, expectedTokens.length, `Expected ${expectedTokens.length} tokens but got ${tokens.length}`);

    // Check each token type and lexeme
    for (let i = 0; i < expectedTokens.length; i++) {
      assert.equal(tokens[i].type, expectedTokens[i].type, `Token at index ${i} should be ${TT[expectedTokens[i].type]} but was ${TT[tokens[i].type]}`);
      assert.equal(
        tokens[i].lexeme,
        expectedTokens[i].lexeme,
        `Token at index ${i} should have lexeme "${expectedTokens[i].lexeme}" but had "${tokens[i].lexeme}"`
      );
    }
  });

  it("should tokenize a line with chords and annotations", () => {
    const ctx = createCtx('[CEG] "Cmaj" [FAC] "Fmaj"');
    scanTune(ctx);

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
    scanTune(ctx);

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
    scanTune(ctx);

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
    scanTune(ctx);

    const expectedTypes = [TT.NOTE_LETTER, TT.WS, TT.NOTE_LETTER, TT.WS, TT.NOTE_LETTER, TT.WS, TT.COMMENT, TT.EOL, TT.STYLESHEET_DIRECTIVE];

    assert.ok(ctx.tokens.length >= expectedTypes.length);

    for (let i = 0; i < Math.min(expectedTypes.length, ctx.tokens.length); i++) {
      assert.equal(ctx.tokens[i].type, expectedTypes[i], `Token at index ${i} should be ${expectedTypes[i]} but was ${ctx.tokens[i].type}`);
    }
  });

  it("should tokenize a line with slurs and ties", () => {
    const ctx = createCtx("(A-B) C-D");
    scanTune(ctx);

    const expectedTypes = [TT.SLUR, TT.NOTE_LETTER, TT.TIE, TT.NOTE_LETTER, TT.SLUR, TT.WS, TT.NOTE_LETTER, TT.TIE, TT.NOTE_LETTER];

    assert.ok(ctx.tokens.length >= expectedTypes.length);

    for (let i = 0; i < Math.min(expectedTypes.length, ctx.tokens.length); i++) {
      assert.equal(ctx.tokens[i].type, expectedTypes[i], `Token at index ${i} should be ${expectedTypes[i]} but was ${ctx.tokens[i].type}`);
    }
  });
});
