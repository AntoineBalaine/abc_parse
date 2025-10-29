import { assert } from "chai";
import * as fc from "fast-check";
import { describe, it } from "mocha";
import { prsMacroDecl, parseMacroInvocation } from "../parsers/parse2";
import { TT } from "../parsers/scan2";
import { Macro_decl, Macro_invocation } from "../types/Expr2";
import { createToken, createParseCtx } from "./prs_music_code.spec";
import * as ScannerGen from "./scn_pbt.generators.spec";

describe("prsMacroDecl", () => {
  it("should parse a simple macro declaration", () => {
    const tokens = [
      createToken(TT.MACRO_HDR, "m:"),
      createToken(TT.MACRO_VAR, "var"),
      createToken(TT.MACRO_STR, "content")
    ];
    const ctx = createParseCtx(tokens);

    const result = prsMacroDecl(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, Macro_decl);
    assert.equal(result!.header.lexeme, "m:");
    assert.equal(result!.variable.lexeme, "var");
    assert.equal(result!.content.lexeme, "content");
    assert.equal(ctx.current, 3); // Should have consumed all tokens
  });

  it("should parse macro with complex variable name", () => {
    const tokens = [
      createToken(TT.MACRO_HDR, "m:"),
      createToken(TT.MACRO_VAR, "var123~"),
      createToken(TT.MACRO_STR, "A B C")
    ];
    const ctx = createParseCtx(tokens);

    const result = prsMacroDecl(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, Macro_decl);
    assert.equal(result!.variable.lexeme, "var123~");
    assert.equal(result!.content.lexeme, "A B C");
  });

  it("should parse macro with musical notation content", () => {
    const tokens = [
      createToken(TT.MACRO_HDR, "m:"),
      createToken(TT.MACRO_VAR, "trill"),
      createToken(TT.MACRO_STR, "!trill!")
    ];
    const ctx = createParseCtx(tokens);

    const result = prsMacroDecl(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, Macro_decl);
    assert.equal(result!.variable.lexeme, "trill");
    assert.equal(result!.content.lexeme, "!trill!");
  });

  it("should return null for non-macro tokens", () => {
    const tokens = [createToken(TT.INF_HDR, "T:"), createToken(TT.INFO_STR, "Title")];
    const ctx = createParseCtx(tokens);

    const result = prsMacroDecl(ctx);

    assert.isNull(result);
    assert.equal(ctx.current, 0); // Should not advance the current position
  });

  it("should return null when missing macro variable", () => {
    const tokens = [
      createToken(TT.MACRO_HDR, "m:"),
      createToken(TT.MACRO_STR, "content") // Missing MACRO_VAR
    ];
    const ctx = createParseCtx(tokens);

    const result = prsMacroDecl(ctx);

    assert.isNull(result);
    assert.equal(ctx.current, 1); // Should have consumed only the header
  });

  it("should return null when missing macro content", () => {
    const tokens = [
      createToken(TT.MACRO_HDR, "m:"),
      createToken(TT.MACRO_VAR, "var")
      // Missing MACRO_STR
    ];
    const ctx = createParseCtx(tokens);

    const result = prsMacroDecl(ctx);

    assert.isNull(result);
    assert.equal(ctx.current, 2); // Should have consumed header and variable
  });

  it("should handle empty macro content", () => {
    const tokens = [
      createToken(TT.MACRO_HDR, "m:"),
      createToken(TT.MACRO_VAR, "empty"),
      createToken(TT.MACRO_STR, "")
    ];
    const ctx = createParseCtx(tokens);

    const result = prsMacroDecl(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, Macro_decl);
    assert.equal(result!.content.lexeme, "");
  });

  it("should parse macro with whitespace in content", () => {
    const tokens = [
      createToken(TT.MACRO_HDR, "m:"),
      createToken(TT.MACRO_VAR, "phrase"),
      createToken(TT.MACRO_STR, "C D E F ")
    ];
    const ctx = createParseCtx(tokens);

    const result = prsMacroDecl(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, Macro_decl);
    assert.equal(result!.content.lexeme, "C D E F ");
  });
});

describe("prsMacroDecl round-trip", () => {
  it("should parse and reconstruct macro declarations correctly", () => {
    fc.assert(
      fc.property(ScannerGen.genMacroDecl, (tokens) => {
        // Filter out EOL and whitespace tokens for parsing
        const macroTokens = tokens.filter(t => t.type !== TT.EOL && t.type !== TT.WS);
        
        // Parse the macro declaration
        const ctx = createParseCtx(macroTokens);
        const result = prsMacroDecl(ctx);
        
        // Should successfully parse
        if (!result) return false;
        
        // Verify the parsed result matches the original tokens
        assert.instanceOf(result, Macro_decl);
        
        // Check that parsing consumed the expected tokens
        const expectedTokens = macroTokens.filter(t => 
          t.type === TT.MACRO_HDR || t.type === TT.MACRO_VAR || t.type === TT.MACRO_STR
        );
        
        return ctx.current === expectedTokens.length;
      }),
      {
        verbose: false,
        numRuns: 100,
      }
    );
  });
})

describe("parseMacroInvocation", () => {
  it("should parse a simple macro invocation", () => {
    const tokens = [createToken(TT.MACRO_INVOCATION, "var")];
    const ctx = createParseCtx(tokens);

    const result = parseMacroInvocation(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, Macro_invocation);
    assert.equal(result!.variable.type, TT.MACRO_INVOCATION);
    assert.equal(result!.variable.lexeme, "var");
    assert.equal(ctx.current, 1); // Should have consumed the token
  });

  it("should parse macro invocation with complex variable name", () => {
    const tokens = [createToken(TT.MACRO_INVOCATION, "var123~")];
    const ctx = createParseCtx(tokens);

    const result = parseMacroInvocation(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, Macro_invocation);
    assert.equal(result!.variable.lexeme, "var123~");
  });

  it("should parse macro invocation with single character variable", () => {
    const tokens = [createToken(TT.MACRO_INVOCATION, "a")];
    const ctx = createParseCtx(tokens);

    const result = parseMacroInvocation(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, Macro_invocation);
    assert.equal(result!.variable.lexeme, "a");
  });

  it("should return null for non-macro-invocation tokens", () => {
    const tokens = [createToken(TT.NOTE_LETTER, "C")];
    const ctx = createParseCtx(tokens);

    const result = parseMacroInvocation(ctx);

    assert.isNull(result);
    assert.equal(ctx.current, 0); // Should not advance the current position
  });

  it("should return null for macro declaration tokens", () => {
    const tokens = [createToken(TT.MACRO_HDR, "m:")];
    const ctx = createParseCtx(tokens);

    const result = parseMacroInvocation(ctx);

    assert.isNull(result);
    assert.equal(ctx.current, 0); // Should not advance the current position
  });

  it("should parse multiple macro invocations in sequence", () => {
    const tokens = [
      createToken(TT.MACRO_INVOCATION, "first"),
      createToken(TT.MACRO_INVOCATION, "second")
    ];
    const ctx = createParseCtx(tokens);

    // Parse first invocation
    const result1 = parseMacroInvocation(ctx);
    assert.isNotNull(result1);
    assert.equal(result1!.variable.lexeme, "first");
    assert.equal(ctx.current, 1);

    // Parse second invocation
    const result2 = parseMacroInvocation(ctx);
    assert.isNotNull(result2);
    assert.equal(result2!.variable.lexeme, "second");
    assert.equal(ctx.current, 2);
  });
});
