import assert from "assert";
import { describe, it } from "mocha";
import { ABCContext } from "../parsers/Context";
import { Ctx, TT, Token, macro_decl } from "../parsers/scan2";

/** starts by pushing an EOL token to simulate being at the start of a line */
function createMacroCtx(source: string): Ctx {
  const ctx = new Ctx(source, new ABCContext());
  ctx.tokens.push(new Token(TT.EOL, "\n", ctx.abcContext.generateId()));
  return ctx;
}

describe("macro function", () => {
  it("should parse a simple macro definition", () => {
    const ctx = createMacroCtx("m:var=content");
    const result = macro_decl(ctx);

    assert.equal(result, true, "macro function should return true for valid macro");

    // Check tokens generated (excluding the initial EOL we added)
    const tokens = ctx.tokens.slice(1);
    assert.equal(tokens.length, 3);

    assert.equal(tokens[0].type, TT.MACRO_HDR);
    assert.equal(tokens[0].lexeme, "m:");

    assert.equal(tokens[1].type, TT.MACRO_VAR);
    assert.equal(tokens[1].lexeme, "var");

    assert.equal(tokens[2].type, TT.MACRO_STR);
    assert.equal(tokens[2].lexeme, "content");
  });

  it("should parse macro with spaces around equals sign", () => {
    const ctx = createMacroCtx("m:var = content with spaces");
    const result = macro_decl(ctx);

    assert.equal(result, true);

    const tokens = ctx.tokens.slice(1);

    assert.equal(tokens[0].type, TT.MACRO_HDR);
    assert.equal(tokens[0].lexeme, "m:");

    assert.equal(tokens[1].type, TT.MACRO_VAR);
    assert.equal(tokens[1].lexeme, "var");

    assert.equal(tokens[2].type, TT.MACRO_STR);
    assert.equal(tokens[2].lexeme, "content with spaces");
  });

  it("should parse macro variable with numbers and tildes", () => {
    const ctx = createMacroCtx("m:var123~ = musical notation");
    const result = macro_decl(ctx);

    assert.equal(result, true);

    const tokens = ctx.tokens.slice(1);
    const macroVarToken = tokens.find((t) => t.type === TT.MACRO_VAR);
    assert.equal(macroVarToken?.lexeme, "var123~");

    const macroStrToken = tokens.find((t) => t.type === TT.MACRO_STR);
    assert.equal(macroStrToken?.lexeme, "musical notation");
  });

  it("should handle macro with trailing comment", () => {
    const ctx = createMacroCtx("m:var=content % this is a comment");
    const result = macro_decl(ctx);

    assert.equal(result, true);

    const tokens = ctx.tokens.slice(1);
    const macroStrToken = tokens.find((t) => t.type === TT.MACRO_STR);
    assert.equal(macroStrToken?.lexeme, "content ");

    const commentToken = tokens.find((t) => t.type === TT.COMMENT);
    assert.equal(commentToken?.lexeme, "% this is a comment");
  });

  it("should handle macro with colon variation", () => {
    const ctx = createMacroCtx("m: var=content");
    const result = macro_decl(ctx);

    assert.equal(result, true);

    const tokens = ctx.tokens.slice(1);
    assert.equal(tokens[0].type, TT.MACRO_HDR);
    assert.equal(tokens[0].lexeme, "m:");
  });

  it("should handle macro with no content after equals", () => {
    const ctx = createMacroCtx("m:var=");
    const result = macro_decl(ctx);

    assert.equal(result, true);

    const tokens = ctx.tokens.slice(1);
    assert.equal(tokens[0].type, TT.MACRO_HDR);
    assert.equal(tokens[1].type, TT.MACRO_VAR);
    assert.equal(tokens[1].lexeme, "var");

    // Should not have MACRO_STR token when there's no content
    const macroStrTokens = tokens.filter((t) => t.type === TT.MACRO_STR);
    assert.equal(macroStrTokens.length, 0);
  });

  it("should generate invalid token for macro without equals sign", () => {
    const ctx = createMacroCtx("m:var content");
    const result = macro_decl(ctx);

    assert.equal(result, true);

    const tokens = ctx.tokens.slice(1);
    const invalidToken = tokens.find((t) => t.type === TT.INVALID);
    assert(invalidToken, "Should generate INVALID token for malformed macro");
  });

  it("should generate invalid token for macro without variable", () => {
    const ctx = createMacroCtx("m:=content");
    const result = macro_decl(ctx);

    assert.equal(result, true);

    const tokens = ctx.tokens.slice(1);
    const invalidToken = tokens.find((t) => t.type === TT.INVALID);
    assert(invalidToken, "Should generate INVALID token for macro without variable");
  });

  it("should return false for non-macro input", () => {
    const ctx = createMacroCtx("X:1");
    const result = macro_decl(ctx);

    assert.equal(result, false, "macro function should return false for non-macro input");

    // Should only have the initial EOL token
    assert.equal(ctx.tokens.length, 1);
    assert.equal(ctx.tokens[0].type, TT.EOL);
  });

  it("should return false when not preceded by EOL", () => {
    const ctx = new Ctx("m:var=content", new ABCContext());
    // Don't add EOL token - macro should not be recognized
    const result = macro_decl(ctx);

    assert.equal(result, false, "macro function should return false when not preceded by EOL");
  });
});
