import assert from "assert";
import { describe, it } from "mocha";
import { ABCContext } from "../parsers/Context";
import { Ctx, TT, Token, userSymbol } from "../parsers/scan2";

/** starts by pushing an EOL token to simulate being at the start of a line */
function createUserSymbolCtx(source: string): Ctx {
  const ctx = new Ctx(source, new ABCContext());
  ctx.tokens.push(new Token(TT.EOL, "\n", ctx.abcContext.generateId()));
  return ctx;
}

describe.only("userSymbol function", () => {
  it("should parse a simple user symbol definition", () => {
    const ctx = createUserSymbolCtx("U:T=!trill!");
    const result = userSymbol(ctx);

    assert.equal(result, true, "userSymbol function should return true for valid user symbol");

    // Check tokens generated (excluding the initial EOL we added)
    const tokens = ctx.tokens.slice(1);
    assert.equal(tokens.length, 3);

    assert.equal(tokens[0].type, TT.INF_HDR);
    assert.equal(tokens[0].lexeme, "U:");

    assert.equal(tokens[1].type, TT.USER_SY);
    assert.equal(tokens[1].lexeme, "T");

    assert.equal(tokens[2].type, TT.SYMBOL);
    assert.equal(tokens[2].lexeme, "!trill!");
  });

  it("should parse user symbol with spaces around equals sign", () => {
    const ctx = createUserSymbolCtx("U:h = !fermata!");
    const result = userSymbol(ctx);

    assert.equal(result, true);

    const tokens = ctx.tokens.slice(1);

    assert.equal(tokens[0].type, TT.INF_HDR);
    assert.equal(tokens[0].lexeme, "U:");

    assert.equal(tokens[1].type, TT.USER_SY);
    assert.equal(tokens[1].lexeme, "h");

    assert.equal(tokens[2].type, TT.SYMBOL);
    assert.equal(tokens[2].lexeme, "!fermata!");
  });

  it("should parse user symbol with lowercase variable", () => {
    const ctx = createUserSymbolCtx("U:w=!accent!");
    const result = userSymbol(ctx);

    assert.equal(result, true);

    const tokens = ctx.tokens.slice(1);
    const userSymToken = tokens.find((t) => t.type === TT.USER_SY);
    assert.equal(userSymToken?.lexeme, "w");

    const symbolToken = tokens.find((t) => t.type === TT.SYMBOL);
    assert.equal(symbolToken?.lexeme, "!accent!");
  });

  it("should parse user symbol with uppercase variable", () => {
    const ctx = createUserSymbolCtx("U:H=!staccato!");
    const result = userSymbol(ctx);

    assert.equal(result, true);

    const tokens = ctx.tokens.slice(1);
    const userSymToken = tokens.find((t) => t.type === TT.USER_SY);
    assert.equal(userSymToken?.lexeme, "H");

    const symbolToken = tokens.find((t) => t.type === TT.SYMBOL);
    assert.equal(symbolToken?.lexeme, "!staccato!");
  });

  it("should parse user symbol with tilde variable", () => {
    const ctx = createUserSymbolCtx("U:~=!turn!");
    const result = userSymbol(ctx);

    assert.equal(result, true);

    const tokens = ctx.tokens.slice(1);
    const userSymToken = tokens.find((t) => t.type === TT.USER_SY);
    assert.equal(userSymToken?.lexeme, "~");

    const symbolToken = tokens.find((t) => t.type === TT.SYMBOL);
    assert.equal(symbolToken?.lexeme, "!turn!");
  });

  it("should parse user symbol with plus notation", () => {
    const ctx = createUserSymbolCtx("U:T=+pizz+");
    const result = userSymbol(ctx);

    assert.equal(result, true);

    const tokens = ctx.tokens.slice(1);
    const symbolToken = tokens.find((t) => t.type === TT.SYMBOL);
    assert.equal(symbolToken?.lexeme, "+pizz+");
  });

  it("should handle user symbol with trailing comment", () => {
    const ctx = createUserSymbolCtx("U:T=!trill! % this is a comment");
    const result = userSymbol(ctx);

    assert.equal(result, true);

    const tokens = ctx.tokens.slice(1);
    const symbolToken = tokens.find((t) => t.type === TT.SYMBOL);
    assert.equal(symbolToken?.lexeme, "!trill!");
  });

  it("should handle user symbol with colon variation", () => {
    const ctx = createUserSymbolCtx("U: T=!trill!");
    const result = userSymbol(ctx);

    assert.equal(result, true);

    const tokens = ctx.tokens.slice(1);
    assert.equal(tokens[0].type, TT.INF_HDR);
    assert.equal(tokens[0].lexeme, "U:");
  });

  it("should generate invalid token for user symbol without equals sign", () => {
    const ctx = createUserSymbolCtx("U:T !trill!");
    const result = userSymbol(ctx);

    assert.equal(result, true);

    const tokens = ctx.tokens.slice(1);
    const invalidToken = tokens.find((t) => t.type === TT.INVALID);
    assert(invalidToken, "Should generate INVALID token for malformed user symbol");
  });

  it("should generate invalid token for user symbol without variable", () => {
    const ctx = createUserSymbolCtx("U:=!trill!");
    const result = userSymbol(ctx);

    assert.equal(result, true);

    const tokens = ctx.tokens.slice(1);
    const invalidToken = tokens.find((t) => t.type === TT.INVALID);
    assert(invalidToken, "Should generate INVALID token for user symbol without variable");
  });

  it("should generate invalid token for invalid variable character", () => {
    const ctx = createUserSymbolCtx("U:x=!trill!");
    const result = userSymbol(ctx);

    assert.equal(result, true);

    const tokens = ctx.tokens.slice(1);
    const invalidToken = tokens.find((t) => t.type === TT.INVALID);
    assert(invalidToken, "Should generate INVALID token for invalid variable character");
  });

  it("should generate invalid token for user symbol without content", () => {
    const ctx = createUserSymbolCtx("U:T= %hello");
    const result = userSymbol(ctx);

    assert.equal(result, true);

    const tokens = ctx.tokens.slice(1);
    const invalidToken = tokens.find((t) => t.type === TT.INVALID);
    assert(invalidToken, "Should generate INVALID token for user symbol without content");
  });

  it("should return false for non-user-symbol input", () => {
    const ctx = createUserSymbolCtx("X:1");
    const result = userSymbol(ctx);

    assert.equal(result, false, "userSymbol function should return false for non-user-symbol input");

    // Should only have the initial EOL token
    assert.equal(ctx.tokens.length, 1);
    assert.equal(ctx.tokens[0].type, TT.EOL);
  });

  it("should return false when not preceded by EOL", () => {
    const ctx = new Ctx("U:T=!trill!", new ABCContext());
    // Don't add EOL token - user symbol should not be recognized
    const result = userSymbol(ctx);

    assert.equal(result, false, "userSymbol function should return false when not preceded by EOL");
  });

  it("should return false for invalid user symbol pattern", () => {
    const ctx = createUserSymbolCtx("V:1");
    const result = userSymbol(ctx);

    assert.equal(result, false, "userSymbol function")
  });
});

