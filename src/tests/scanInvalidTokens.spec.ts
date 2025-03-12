import assert from "assert";
import { describe, it } from "mocha";
import { Ctx, Scanner2, TT } from "../parsers/scan2";
import { scanTune } from "../parsers/scan_tunebody";
import { AbcErrorReporter } from "../parsers/ErrorReporter";

// Helper function to create a Ctx object for testing
function createCtx(source: string): Ctx {
  return new Ctx(source, new AbcErrorReporter());
}

describe("Invalid Token Handling in Scanner", () => {
  it("should tokenize invalid characters as INVALID tokens", () => {
    const ctx = createCtx("~123");
    scanTune(ctx);

    // Check that we have the expected token types in the right order
    assert.equal(ctx.tokens.length, 1, "Expected 1 token but got " + ctx.tokens.length);
    assert.equal(ctx.tokens[0].type, TT.INVALID, "Token should be INVALID but was " + ctx.tokens[0].type);
    assert.equal(ctx.tokens[0].lexeme, "~123", "Token lexeme should be '~123' but was '" + ctx.tokens[0].lexeme + "'");
  });

  it("should tokenize invalid characters mixed with valid ones", () => {
    const ctx = createCtx("A ~123 B");
    scanTune(ctx);

    // Check that we have the expected token types in the right order
    const expectedTypes = [TT.NOTE_LETTER, TT.WS, TT.INVALID, TT.WS, TT.NOTE_LETTER];
    const expectedLexemes = ["A", " ", "~123", " ", "B"];

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
    const ctx = createCtx("A ~123 @456 B");
    scanTune(ctx);

    // Check that we have the expected token types in the right order
    const expectedTypes = [TT.NOTE_LETTER, TT.WS, TT.INVALID, TT.WS, TT.INVALID, TT.WS, TT.NOTE_LETTER];
    const expectedLexemes = ["A", " ", "~123", " ", "@456", " ", "B"];

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
    const source = "A ~123 B";
    const ctx = createCtx(source);
    scanTune(ctx);

    // Concatenate all token lexemes to verify all characters are preserved
    const reconstructed = ctx.tokens.map((token) => token.lexeme).join("");
    assert.equal(reconstructed, source, `Reconstructed source "${reconstructed}" should match original source "${source}"`);
  });

  it("should handle invalid tokens at the beginning of a line", () => {
    const ctx = createCtx("~123 A");
    scanTune(ctx);

    // Check that we have the expected token types in the right order
    const expectedTypes = [TT.INVALID, TT.WS, TT.NOTE_LETTER];
    const expectedLexemes = ["~123", " ", "A"];

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
    const ctx = createCtx("A ~123");
    scanTune(ctx);

    // Check that we have the expected token types in the right order
    const expectedTypes = [TT.NOTE_LETTER, TT.WS, TT.INVALID];
    const expectedLexemes = ["A", " ", "~123"];

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
    const ctx = createCtx("A2 ~123 B | C ~456 D");
    scanTune(ctx);

    // Check that we have the expected token types in the right order
    const expectedTypes = [
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

    const expectedLexemes = ["A", "2", " ", "~123", " ", "B", " ", "|", " ", "C", " ", "~456", " ", "D"];

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
