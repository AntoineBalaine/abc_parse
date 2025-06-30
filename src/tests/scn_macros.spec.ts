import assert from "assert";
import { describe, it } from "mocha";
import * as fc from "fast-check";
import { ABCContext } from "../parsers/Context";
import { Ctx, TT, Token, macro_decl, macro_invocation } from "../parsers/scan2";
import { scanTune } from "../parsers/scan_tunebody";
import { createRoundTripPredicate } from "./scn_pbt.spec";
import {
  genMacroHeader,
  genMacroVariable,
  genMacroString,
  genEOL,
  genCommentToken,
  genNote,
  genRest,
  genBarline,
  genWhitespace,
  sharedContext,
  applyTokenFiltering,
  genAmpersand,
  genAnnotation,
  genBcktckSpc,
  genChord,
  genDecorationWithFollower,
  genGraceGroupWithFollower,
  genInfoLine,
  genLyricLine,
  genSlur,
  genStylesheetDirective,
  genSymbol,
  genTuplet,
  genVoiceOvrlay,
  genYspacer
} from "./scn_pbt.generators.spec";

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

describe("macro invocation function", () => {
  it("should recognize macro invocation after declaration", () => {
    // First declare a macro
    const ctx = createMacroCtx("m:myvar=A B C");
    const declResult = macro_decl(ctx);
    assert.equal(declResult, true, "macro declaration should succeed");

    // Now test invocation
    ctx.current = 0; // Reset position
    ctx.start = 0;
    ctx.source = "myvar"; // Set source to just the variable name

    const result = macro_invocation(ctx);
    assert.equal(result, true, "macro invocation should be recognized");

    // Check that MACRO_INVOCATION token was created
    const invocationToken = ctx.tokens.find(t => t.type === TT.MACRO_INVOCATION);
    assert(invocationToken, "Should create MACRO_INVOCATION token");
    assert.equal(invocationToken.lexeme, "myvar");
  });

  it("should not recognize undeclared variables", () => {
    const ctx = new Ctx("undeclared", new ABCContext());
    const result = macro_invocation(ctx);

    assert.equal(result, false, "should not recognize undeclared variables");
  });

  it("should not match partial words", () => {
    // Declare a macro
    const ctx = createMacroCtx("m:var=content");
    macro_decl(ctx);

    // Test with a longer word that contains the variable
    ctx.current = 0;
    ctx.start = 0;
    ctx.source = "variable"; // Contains "var" but is longer

    const result = macro_invocation(ctx);
    assert.equal(result, false, "should not match partial words");
  });

  it("should match variable at word boundary", () => {
    // Declare a macro
    const ctx = createMacroCtx("m:var=ABC");
    macro_decl(ctx);

    // Test with variable followed by space
    ctx.current = 0;
    ctx.start = 0;
    ctx.source = "var ";

    const result = macro_invocation(ctx);
    assert.equal(result, true, "should match at word boundary");

    const invocationToken = ctx.tokens.find(t => t.type === TT.MACRO_INVOCATION);
    assert.equal(invocationToken?.lexeme, "var");
  });

  it("should handle multiple macro declarations", () => {
    const ctx = new Ctx("", new ABCContext());

    // Manually add macros to test multiple declarations
    ctx.macros = new Map();
    ctx.macros.set("var1", "ABC");
    ctx.macros.set("var2", "DEF");

    // Test first variable
    ctx.source = "var1";
    ctx.current = 0;
    ctx.start = 0;

    let result = macro_invocation(ctx);
    assert.equal(result, true, "should recognize first variable");

    // Test second variable
    ctx.source = "var2";
    ctx.current = 0;
    ctx.start = 0;

    result = macro_invocation(ctx);
    assert.equal(result, true, "should recognize second variable");
  });

  it("should handle variables with numbers and tildes", () => {
    const ctx = createMacroCtx("m:var123~=content");
    macro_decl(ctx);

    ctx.current = 0;
    ctx.start = 0;
    ctx.source = "var123~";

    const result = macro_invocation(ctx);
    assert.equal(result, true, "should recognize variables with numbers and tildes");

    const invocationToken = ctx.tokens.find(t => t.type === TT.MACRO_INVOCATION);
    assert.equal(invocationToken?.lexeme, "var123~");
  });
});

// Property-based tests for macro round-trip scenarios
describe("macro round-trip property tests", () => {
  // Generate a macro line that returns both tokens and the variable name
  const genMacroLine = fc
    .tuple(
      genEOL,
      genMacroHeader,
      genMacroVariable,
      genMacroString,
      fc.option(genCommentToken.map(([comment]) => comment)),
      genEOL
    )
    .map(([eol1, header, variable, macroStr, comment, eol2]) => {
      const tokens = [eol1, header, variable, macroStr];
      if (comment) tokens.push(comment);
      tokens.push(eol2);
      return { tokens, variable: variable.lexeme };
    });

  // Generate a scenario with macro declaration followed by music that may use the macro
  const genMacroScenario = genMacroLine
    .chain(({ tokens: macroTokens, variable }) => {
      // Create invocation generator using the specific variable from this macro
      const genInvocation = fc.constantFrom(
        new Token(TT.MACRO_INVOCATION, variable, sharedContext.generateId())
      ).map(token => [token]);

      // Generate music tokens that may include the macro invocation
      const genMusicTokens = fc.array(
        fc.oneof(
          // Include macro invocation with higher weight
          { arbitrary: genInvocation, weight: 2 },
          // Regular music tokens
          genNote,
          genRest.map((rest) => [rest]),
          genBarline.map((bar) => [bar]),
          // genTie.map((tie) => [tie])
          genAmpersand.map((amp) => amp),
          genVoiceOvrlay.map((ovrlay) => [ovrlay]),
          genWhitespace.map((ws) => [ws]),
          genTuplet, // Now returns an array of tokens directly
          genSlur.map((slur) => [slur]),
          genDecorationWithFollower,
          genSymbol.map((sym) => [sym]),
          genYspacer,
          genBcktckSpc.map((bck) => [bck]),
          genGraceGroupWithFollower,
          genChord,
          genAnnotation,
          { arbitrary: genInfoLine, weight: 1 },
          { arbitrary: genStylesheetDirective, weight: 1 },
          { arbitrary: genCommentToken, weight: 2 },
          { arbitrary: genLyricLine, weight: 1 },
        )
      );

      return genMusicTokens.map(musicTokenArrays => {
        const allTokens = [
          ...macroTokens,
          ...musicTokenArrays.flat()
        ];
        return applyTokenFiltering(allTokens);
      });
    });


  it("should produce equivalent tokens when rescanning macro scenarios", () => {
    fc.assert(
      fc.property(genMacroScenario, createRoundTripPredicate),
      {
        verbose: false,
        numRuns: 100,
      }
    );
  });
});
