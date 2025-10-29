import { assert } from "chai";
import { describe, it } from "mocha";
import { prsUserSymbolDecl, parseUserSymbolInvocation } from "../parsers/parse2";
import { TT } from "../parsers/scan2";
import { User_symbol_decl, User_symbol_invocation } from "../types/Expr2";
import { createToken, createParseCtx } from "./prs_music_code.spec";

describe("prsUserSymbolDecl", () => {
  it("should parse a simple user symbol declaration", () => {
    const tokens = [
      createToken(TT.USER_SY_HDR, "U:"),
      createToken(TT.USER_SY, "T"),
      createToken(TT.SYMBOL, "!trill!")
    ];
    const ctx = createParseCtx(tokens);

    const result = prsUserSymbolDecl(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, User_symbol_decl);
    assert.equal(result!.header.lexeme, "U:");
    assert.equal(result!.variable.lexeme, "T");
    assert.equal(result!.symbol.lexeme, "!trill!");
    assert.equal(ctx.current, 3); // Should have consumed all tokens
  });

  it("should parse user symbol with lowercase variable", () => {
    const tokens = [
      createToken(TT.USER_SY_HDR, "U:"),
      createToken(TT.USER_SY, "h"),
      createToken(TT.SYMBOL, "!fermata!")
    ];
    const ctx = createParseCtx(tokens);

    const result = prsUserSymbolDecl(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, User_symbol_decl);
    assert.equal(result!.variable.lexeme, "h");
    assert.equal(result!.symbol.lexeme, "!fermata!");
  });

  it("should parse user symbol with uppercase variable", () => {
    const tokens = [
      createToken(TT.USER_SY_HDR, "U:"),
      createToken(TT.USER_SY, "H"),
      createToken(TT.SYMBOL, "!staccato!")
    ];
    const ctx = createParseCtx(tokens);

    const result = prsUserSymbolDecl(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, User_symbol_decl);
    assert.equal(result!.variable.lexeme, "H");
    assert.equal(result!.symbol.lexeme, "!staccato!");
  });

  it("should parse user symbol with tilde variable", () => {
    const tokens = [
      createToken(TT.USER_SY_HDR, "U:"),
      createToken(TT.USER_SY, "~"),
      createToken(TT.SYMBOL, "!turn!")
    ];
    const ctx = createParseCtx(tokens);

    const result = prsUserSymbolDecl(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, User_symbol_decl);
    assert.equal(result!.variable.lexeme, "~");
    assert.equal(result!.symbol.lexeme, "!turn!");
  });

  it("should parse user symbol with plus notation", () => {
    const tokens = [
      createToken(TT.USER_SY_HDR, "U:"),
      createToken(TT.USER_SY, "T"),
      createToken(TT.SYMBOL, "+pizz+")
    ];
    const ctx = createParseCtx(tokens);

    const result = prsUserSymbolDecl(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, User_symbol_decl);
    assert.equal(result!.symbol.lexeme, "+pizz+");
  });

  it("should return null for non-user-symbol tokens", () => {
    const tokens = [createToken(TT.INF_HDR, "T:"), createToken(TT.INFO_STR, "Title")];
    const ctx = createParseCtx(tokens);

    const result = prsUserSymbolDecl(ctx);

    assert.isNull(result);
    assert.equal(ctx.current, 0); // Should not advance the current position
  });

  it("should return null when missing user symbol variable", () => {
    const tokens = [
      createToken(TT.USER_SY_HDR, "U:"),
      createToken(TT.SYMBOL, "!trill!") // Missing USER_SY
    ];
    const ctx = createParseCtx(tokens);

    const result = prsUserSymbolDecl(ctx);

    assert.isNull(result);
    assert.equal(ctx.current, 1); // Should have consumed only the header
  });

  it("should return null when missing symbol content", () => {
    const tokens = [
      createToken(TT.USER_SY_HDR, "U:"),
      createToken(TT.USER_SY, "T")
      // Missing SYMBOL
    ];
    const ctx = createParseCtx(tokens);

    const result = prsUserSymbolDecl(ctx);

    assert.isNull(result);
    assert.equal(ctx.current, 2); // Should have consumed header and variable
  });

  it("should parse user symbol with complex symbol notation", () => {
    const tokens = [
      createToken(TT.USER_SY_HDR, "U:"),
      createToken(TT.USER_SY, "T"),
      createToken(TT.SYMBOL, "!>!")
    ];
    const ctx = createParseCtx(tokens);

    const result = prsUserSymbolDecl(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, User_symbol_decl);
    assert.equal(result!.symbol.lexeme, "!>!");
  });

  it("should parse user symbol with decorated symbol", () => {
    const tokens = [
      createToken(TT.USER_SY_HDR, "U:"),
      createToken(TT.USER_SY, "w"),
      createToken(TT.SYMBOL, "!accent!")
    ];
    const ctx = createParseCtx(tokens);

    const result = prsUserSymbolDecl(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, User_symbol_decl);
    assert.equal(result!.variable.lexeme, "w");
    assert.equal(result!.symbol.lexeme, "!accent!");
  });
});

describe("parseUserSymbolInvocation", () => {
  it("should parse a simple user symbol invocation", () => {
    const tokens = [createToken(TT.USER_SY_INVOCATION, "T")];
    const ctx = createParseCtx(tokens);

    const result = parseUserSymbolInvocation(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, User_symbol_invocation);
    assert.equal(result!.variable.type, TT.USER_SY_INVOCATION);
    assert.equal(result!.variable.lexeme, "T");
    assert.equal(ctx.current, 1); // Should have consumed the token
  });

  it("should parse user symbol invocation with lowercase variable", () => {
    const tokens = [createToken(TT.USER_SY_INVOCATION, "h")];
    const ctx = createParseCtx(tokens);

    const result = parseUserSymbolInvocation(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, User_symbol_invocation);
    assert.equal(result!.variable.lexeme, "h");
  });

  it("should parse user symbol invocation with tilde variable", () => {
    const tokens = [createToken(TT.USER_SY_INVOCATION, "~")];
    const ctx = createParseCtx(tokens);

    const result = parseUserSymbolInvocation(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, User_symbol_invocation);
    assert.equal(result!.variable.lexeme, "~");
  });

  it("should return null for non-user-symbol-invocation tokens", () => {
    const tokens = [createToken(TT.NOTE_LETTER, "C")];
    const ctx = createParseCtx(tokens);

    const result = parseUserSymbolInvocation(ctx);

    assert.isNull(result);
    assert.equal(ctx.current, 0); // Should not advance the current position
  });

  it("should return null for user symbol declaration tokens", () => {
    const tokens = [createToken(TT.USER_SY_HDR, "U:")];
    const ctx = createParseCtx(tokens);

    const result = parseUserSymbolInvocation(ctx);

    assert.isNull(result);
    assert.equal(ctx.current, 0); // Should not advance the current position
  });

  it("should parse multiple user symbol invocations in sequence", () => {
    const tokens = [
      createToken(TT.USER_SY_INVOCATION, "T"),
      createToken(TT.USER_SY_INVOCATION, "H")
    ];
    const ctx = createParseCtx(tokens);

    // Parse first invocation
    const result1 = parseUserSymbolInvocation(ctx);
    assert.isNotNull(result1);
    assert.equal(result1!.variable.lexeme, "T");
    assert.equal(ctx.current, 1);

    // Parse second invocation
    const result2 = parseUserSymbolInvocation(ctx);
    assert.isNotNull(result2);
    assert.equal(result2!.variable.lexeme, "H");
    assert.equal(ctx.current, 2);
  });
});