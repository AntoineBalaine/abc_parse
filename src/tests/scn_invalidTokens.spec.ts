import assert from "assert";
import { describe, it } from "mocha";
import { ABCContext } from "../parsers/Context";
import { Ctx, TT } from "../parsers/scan2";
import { scanTune } from "../parsers/scan_tunebody";

// Helper function to create a Ctx object for testing
function createCtx(source: string): Ctx {
  return new Ctx(source, new ABCContext());
}

describe("Invalid Token Handling in Scanner", () => {
  it("should tokenize invalid characters as INVALID tokens", () => {
    const ctx = createCtx("X:1\n~123");
    scanTune(ctx);

    // Check that we have the expected token types in the right order
    assert.equal(ctx.tokens[3].type, TT.INVALID, "Token should be INVALID but was " + ctx.tokens[3].type);
    assert.equal(ctx.tokens[3].lexeme, "~123", "Token lexeme should be '~123' but was '" + ctx.tokens[3].lexeme + "'");
  });

  it("should tokenize invalid characters mixed with valid ones", () => {
    const ctx = createCtx("X:1\nA ~123 B");
    scanTune(ctx);

    // Check that we have the expected token types in the right order
    const expectedTypes = [TT.INF_HDR, TT.INFO_STR, TT.EOL, TT.NOTE_LETTER, TT.WS, TT.INVALID, TT.WS, TT.NOTE_LETTER];
    const expectedLexemes = ["X:", "1", "\n", "A", " ", "~123", " ", "B"];

    assert.equal(ctx.tokens.length, expectedTypes.length, `Expected ${expectedTypes.length} tokens but got ${ctx.tokens.length}`);

    // Check the token types and lexemes to make sure they match what we expect
    for (let i = 0; i < expectedTypes.length; i++) {
      assert.equal(ctx.tokens[i].type, expectedTypes[i], `Token at index ${i} should be ${expectedTypes[i]} but was ${ctx.tokens[i].type}`);
      assert.equal(
        ctx.tokens[i].lexeme,
        expectedLexemes[i],
        `Token at index ${i} should have lexeme "${expectedLexemes[i]}" but had "${ctx.tokens[i].lexeme}"`
      );
    }
  });

  it("should tokenize multiple invalid tokens separately", () => {
    const ctx = createCtx("X:1\nA ~123 @456 B");
    scanTune(ctx);

    // Check that we have the expected token types in the right order
    const expectedTypes = [TT.INF_HDR, TT.INFO_STR, TT.EOL, TT.NOTE_LETTER, TT.WS, TT.INVALID, TT.WS, TT.INVALID, TT.WS, TT.NOTE_LETTER];
    const expectedLexemes = ["X:", "1", "\n", "A", " ", "~123", " ", "@456", " ", "B"];

    assert.equal(ctx.tokens.length, expectedTypes.length, `Expected ${expectedTypes.length} tokens but got ${ctx.tokens.length}`);

    // Check the token types and lexemes to make sure they match what we expect
    for (let i = 0; i < expectedTypes.length; i++) {
      assert.equal(ctx.tokens[i].type, expectedTypes[i], `Token at index ${i} should be ${expectedTypes[i]} but was ${ctx.tokens[i].type}`);
      assert.equal(
        ctx.tokens[i].lexeme,
        expectedLexemes[i],
        `Token at index ${i} should have lexeme "${expectedLexemes[i]}" but had "${ctx.tokens[i].lexeme}"`
      );
    }
  });

  it("should preserve all characters from the source in the tokens", () => {
    const source = "X:1\nA ~123 B";
    const ctx = createCtx(source);
    scanTune(ctx);

    // Concatenate all token lexemes to verify all characters are preserved
    const reconstructed = ctx.tokens.map((token) => token.lexeme).join("");
    assert.equal(reconstructed, source, `Reconstructed source "${reconstructed}" should match original source "${source}"`);
  });

  it("should handle invalid tokens at the beginning of a line", () => {
    const ctx = createCtx("X:1\n~123 A");
    scanTune(ctx);

    // Check that we have the expected token types in the right order
    const expectedTypes = [TT.INF_HDR, TT.INFO_STR, TT.EOL, TT.INVALID, TT.WS, TT.NOTE_LETTER];
    const expectedLexemes = ["X:", "1", "\n", "~123", " ", "A"];

    assert.equal(ctx.tokens.length, expectedTypes.length, `Expected ${expectedTypes.length} tokens but got ${ctx.tokens.length}`);

    // Check the token types and lexemes to make sure they match what we expect
    for (let i = 0; i < expectedTypes.length; i++) {
      assert.equal(ctx.tokens[i].type, expectedTypes[i], `Token at index ${i} should be ${expectedTypes[i]} but was ${ctx.tokens[i].type}`);
      assert.equal(
        ctx.tokens[i].lexeme,
        expectedLexemes[i],
        `Token at index ${i} should have lexeme "${expectedLexemes[i]}" but had "${ctx.tokens[i].lexeme}"`
      );
    }
  });

  it("should handle invalid tokens at the end of a line", () => {
    const ctx = createCtx("X:1\nA ~123");
    scanTune(ctx);

    // Check that we have the expected token types in the right order
    const expectedTypes = [TT.INF_HDR, TT.INFO_STR, TT.EOL, TT.NOTE_LETTER, TT.WS, TT.INVALID];
    const expectedLexemes = ["X:", "1", "\n", "A", " ", "~123"];

    assert.equal(ctx.tokens.length, expectedTypes.length, `Expected ${expectedTypes.length} tokens but got ${ctx.tokens.length}`);

    // Check the token types and lexemes to make sure they match what we expect
    for (let i = 0; i < expectedTypes.length; i++) {
      assert.equal(ctx.tokens[i].type, expectedTypes[i], `Token at index ${i} should be ${expectedTypes[i]} but was ${ctx.tokens[i].type}`);
      assert.equal(
        ctx.tokens[i].lexeme,
        expectedLexemes[i],
        `Token at index ${i} should have lexeme "${expectedLexemes[i]}" but had "${ctx.tokens[i].lexeme}"`
      );
    }
  });

  it("should handle invalid tokens in a complex music pattern", () => {
    const ctx = createCtx("X:1\nA2 ~123 B | C ~456 D");
    scanTune(ctx);

    // Check that we have the expected token types in the right order
    const expectedTypes = [
      TT.INF_HDR,
      TT.INFO_STR,
      TT.EOL,
      TT.NOTE_LETTER,
      TT.RHY_NUMER,
      TT.WS,
      TT.INVALID,
      TT.WS,
      TT.NOTE_LETTER,
      TT.WS,
      TT.BARLINE,
      TT.WS,
      TT.NOTE_LETTER,
      TT.WS,
      TT.INVALID,
      TT.WS,
      TT.NOTE_LETTER,
    ];

    const expectedLexemes = ["X:", "1", "\n", "A", "2", " ", "~123", " ", "B", " ", "|", " ", "C", " ", "~456", " ", "D"];

    assert.equal(ctx.tokens.length, expectedTypes.length, `Expected ${expectedTypes.length} tokens but got ${ctx.tokens.length}`);

    // Check the token types and lexemes to make sure they match what we expect
    for (let i = 0; i < expectedTypes.length; i++) {
      assert.equal(ctx.tokens[i].type, expectedTypes[i], `Token at index ${i} should be ${expectedTypes[i]} but was ${ctx.tokens[i].type}`);
      assert.equal(
        ctx.tokens[i].lexeme,
        expectedLexemes[i],
        `Token at index ${i} should have lexeme "${expectedLexemes[i]}" but had "${ctx.tokens[i].lexeme}"`
      );
    }
  });
});
