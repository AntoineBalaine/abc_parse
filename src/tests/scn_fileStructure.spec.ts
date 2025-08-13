import assert from "assert";
import { describe, it } from "mocha";
import { TT, fileHeader } from "../parsers/scan2";
import { scanTune } from "../parsers/scan_tunebody";
import { Expr } from "../types/Expr2";
import { createCtx } from "./scn_tuneBodyTokens.spec";

describe("fileHeader", () => {
  it("should parse a file header with info lines, comments, and stylesheet directives", () => {
    const ctx = createCtx(`%%directive
%comment
T:Title
`);
    fileHeader(ctx);

    // Check that we have the expected token types in the right order
    const expectedTypes = [TT.STYLESHEET_DIRECTIVE, TT.EOL, TT.COMMENT, TT.EOL, TT.INF_HDR, TT.INFO_STR, TT.EOL];

    assert.equal(ctx.tokens.length, expectedTypes.length, `Expected ${expectedTypes.length} tokens but got ${ctx.tokens.length}`);

    // Check the token types to make sure they match what we expect
    for (let i = 0; i < expectedTypes.length; i++) {
      assert.equal(ctx.tokens[i].type, expectedTypes[i], `Token at index ${i} should be ${expectedTypes[i]} but was ${ctx.tokens[i].type}`);
    }
  });

  it("should stop parsing when it encounters a tune header start", () => {
    const ctx = createCtx(`%%directive
%comment
X:1
T:Title
`);
    fileHeader(ctx);

    // Check that we have the expected token types in the right order
    const expectedTypes: Array<TT | Expr> = [];

    assert.equal(ctx.tokens.length, expectedTypes.length, `Expected ${expectedTypes.length} tokens but got ${ctx.tokens.length}`);

    // Check the token types to make sure they match what we expect
    for (let i = 0; i < expectedTypes.length; i++) {
      assert.equal(ctx.tokens[i].type, expectedTypes[i], `Token at index ${i} should be ${expectedTypes[i]} but was ${ctx.tokens[i].type}`);
    }
  });

  it("should handle free text lines correctly", () => {
    const ctx = createCtx(`This is free text
%%directive
`);
    fileHeader(ctx);

    // Check that we have the expected token types in the right order
    const expectedTypes = [TT.FREE_TXT, TT.EOL, TT.STYLESHEET_DIRECTIVE, TT.EOL];

    assert.equal(ctx.tokens.length, expectedTypes.length, `Expected ${expectedTypes.length} tokens but got ${ctx.tokens.length}`);

    // Check the token types to make sure they match what we expect
    for (let i = 0; i < expectedTypes.length; i++) {
      assert.equal(ctx.tokens[i].type, expectedTypes[i], `Token at index ${i} should be ${expectedTypes[i]} but was ${ctx.tokens[i].type}`);
    }

    // Check the lexeme of the free text token
    assert.equal(ctx.tokens[0].lexeme, "This is free text");
  });
});

describe("scan tune", () => {
  it("should parse a tune header with info lines, comments, and stylesheet directives", () => {
    const ctx = createCtx(`X:1
T:Title
K:C
%%directive
%comment
`);
    scanTune(ctx);

    // Check that we have the expected token types in the right order
    const expectedTypes = [
      TT.INF_HDR,
      TT.INFO_STR,
      TT.EOL,
      TT.INF_HDR,
      TT.INFO_STR,
      TT.EOL,
      TT.INF_HDR,
      TT.KEY_ROOT,
      TT.EOL,
      TT.STYLESHEET_DIRECTIVE,
      TT.EOL,
      TT.COMMENT,
      TT.EOL,
    ];

    assert.equal(ctx.tokens.length, expectedTypes.length, `Expected ${expectedTypes.length} tokens but got ${ctx.tokens.length}`);

    // Check the token types to make sure they match what we expect
    for (let i = 0; i < expectedTypes.length; i++) {
      assert.equal(ctx.tokens[i].type, expectedTypes[i], `Token at index ${i} should be ${expectedTypes[i]} but was ${ctx.tokens[i].type}`);
    }
  });

  it("should tokenize a tune with both header and body content", () => {
    const ctx = createCtx(`X:1
T:Test Tune
K:C
ABC DEF|`);
    scanTune(ctx);

    // Check that we have tokens for both header and body content
    const headerTokenTypes = [
      TT.INF_HDR,
      TT.INFO_STR,
      TT.EOL, // X:1
      TT.INF_HDR,
      TT.INFO_STR,
      TT.EOL, // M:4/4
      TT.INF_HDR,
      TT.KEY_ROOT,
      TT.EOL, // K:C
    ];

    const bodyTokenTypes = [
      TT.NOTE_LETTER,
      TT.NOTE_LETTER,
      TT.NOTE_LETTER, // ABC
      TT.WS, // space
      TT.NOTE_LETTER,
      TT.NOTE_LETTER,
      TT.NOTE_LETTER, // DEF
      TT.BARLINE, // |
    ];

    const expectedTypes = [...headerTokenTypes, ...bodyTokenTypes];

    assert.equal(ctx.tokens.length, expectedTypes.length, `Expected ${expectedTypes.length} tokens but got ${ctx.tokens.length}`);

    // Check the token types to make sure they match what we expect
    for (let i = 0; i < expectedTypes.length; i++) {
      assert.equal(ctx.tokens[i].type, expectedTypes[i], `Token at index ${i} should be ${expectedTypes[i]} but was ${ctx.tokens[i].type}`);
    }
  });

  it("should stop parsing when it encounters a section break", () => {
    // Create a tune with a section break followed by more content
    const ctx = createCtx(`X:1
T:Test Tune
K:C
ABC DEF|

`);
    scanTune(ctx);

    // Check that we have tokens up to the section break
    const expectedTypes = [
      TT.INF_HDR,
      TT.INFO_STR,
      TT.EOL, // X:1
      TT.INF_HDR,
      TT.INFO_STR,
      TT.EOL, // T:Test Tune
      TT.INF_HDR,
      TT.KEY_ROOT,
      TT.EOL, // K:C
      TT.NOTE_LETTER,
      TT.NOTE_LETTER,
      TT.NOTE_LETTER, // ABC
      TT.WS, // space
      TT.NOTE_LETTER,
      TT.NOTE_LETTER,
      TT.NOTE_LETTER, // DEF
      TT.BARLINE, // |
      // TT.SCT_BRK, // \n\n
    ];

    assert.equal(ctx.tokens.length, expectedTypes.length, `Expected ${expectedTypes.length} tokens but got ${ctx.tokens.length}`);

    // Check the token types to make sure they match what we expect
    for (let i = 0; i < expectedTypes.length; i++) {
      assert.equal(ctx.tokens[i].type, expectedTypes[i], `Token at index ${i} should be ${expectedTypes[i]} but was ${ctx.tokens[i].type}`);
    }
  });
});
