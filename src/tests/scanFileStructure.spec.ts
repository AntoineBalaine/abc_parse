import assert from "assert";
import { describe, it } from "mocha";
import { TT, fileHeader, scanTuneHeader } from "../parsers/scan2";
import { createCtx } from "./scanTuneBodyTokens.spec";

describe("fileHeader", () => {
  it("should parse a file header with info lines, comments, and stylesheet directives", () => {
    const ctx = createCtx("%%directive\n%comment\nT:Title\n");
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
    const ctx = createCtx("%%directive\n%comment\nX:1\nT:Title\n");
    fileHeader(ctx);

    // Check that we have the expected token types in the right order
    const expectedTypes = [TT.STYLESHEET_DIRECTIVE, TT.EOL, TT.COMMENT, TT.EOL];

    assert.equal(ctx.tokens.length, expectedTypes.length, `Expected ${expectedTypes.length} tokens but got ${ctx.tokens.length}`);

    // Check the token types to make sure they match what we expect
    for (let i = 0; i < expectedTypes.length; i++) {
      assert.equal(ctx.tokens[i].type, expectedTypes[i], `Token at index ${i} should be ${expectedTypes[i]} but was ${ctx.tokens[i].type}`);
    }

    // Check that the current position is at the start of the tune header
    assert.equal(ctx.source.substring(ctx.current), "X:1\nT:Title\n");
  });

  it("should handle free text lines correctly", () => {
    const ctx = createCtx("This is free text\n%%directive\n");
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

describe("scanTuneHeader", () => {
  it("should parse a tune header with info lines, comments, and stylesheet directives", () => {
    const ctx = createCtx("X:1\nT:Title\nM:4/4\nK:C\n%%directive\n%comment\n");
    scanTuneHeader(ctx);

    // Check that we have the expected token types in the right order
    const expectedTypes = [
      TT.INF_HDR,
      TT.INFO_STR,
      TT.EOL,
      TT.INF_HDR,
      TT.INFO_STR,
      TT.EOL,
      TT.INF_HDR,
      TT.INFO_STR,
      TT.EOL,
      TT.INF_HDR,
      TT.INFO_STR,
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

  it("should stop parsing when it encounters something that's not part of the tune header", () => {
    const ctx = createCtx("X:1\nT:Title\nM:4/4\nK:C\nABC\n");
    scanTuneHeader(ctx);

    // Check that we have the expected token types in the right order
    const expectedTypes = [
      TT.INF_HDR,
      TT.INFO_STR,
      TT.EOL,
      TT.INF_HDR,
      TT.INFO_STR,
      TT.EOL,
      TT.INF_HDR,
      TT.INFO_STR,
      TT.EOL,
      TT.INF_HDR,
      TT.INFO_STR,
      TT.EOL,
    ];

    assert.equal(ctx.tokens.length, expectedTypes.length, `Expected ${expectedTypes.length} tokens but got ${ctx.tokens.length}`);

    // Check the token types to make sure they match what we expect
    for (let i = 0; i < expectedTypes.length; i++) {
      assert.equal(ctx.tokens[i].type, expectedTypes[i], `Token at index ${i} should be ${expectedTypes[i]} but was ${ctx.tokens[i].type}`);
    }

    // Check that the current position is at the start of the non-header content
    assert.equal(ctx.source.substring(ctx.current), "ABC\n");
  });

  it("should stop parsing when it encounters a section break", () => {
    const ctx = createCtx("X:1\nT:Title\n\n\nM:4/4\n");
    scanTuneHeader(ctx);

    // Check that we have the expected token types in the right order
    const expectedTypes = [TT.INF_HDR, TT.INFO_STR, TT.EOL, TT.INF_HDR, TT.INFO_STR];

    assert.equal(ctx.tokens.length, expectedTypes.length, `Expected ${expectedTypes.length} tokens but got ${ctx.tokens.length}`);

    // Check the token types to make sure they match what we expect
    for (let i = 0; i < expectedTypes.length; i++) {
      assert.equal(ctx.tokens[i].type, expectedTypes[i], `Token at index ${i} should be ${expectedTypes[i]} but was ${ctx.tokens[i].type}`);
    }

    // Check that the current position is at the start of the section break
    assert.equal(ctx.source.substring(ctx.current), "\n\n\nM:4/4\n");
  });
});
