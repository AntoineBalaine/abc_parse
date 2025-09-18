import { assert } from "chai";
import * as fc from "fast-check";
import { describe, it } from "mocha";
import { Ctx, TT, Token } from "../parsers/scan2";
import { scanInfoLine } from "../parsers/infoLines/scanInfoLine";
import { ABCContext } from "../parsers/Context";
import { AbcErrorReporter } from "../parsers/ErrorReporter";

// Create a local shared context to avoid circular dependency
const sharedContext = new ABCContext(new AbcErrorReporter());

import { genInfoLine } from "./scn_pbt.generators.spec";

function createTestContext(source: string): Ctx {
  const abcContext = new ABCContext();
  const ctx = new Ctx(source, abcContext);
  // Add an EOL token to simulate proper context precedence
  ctx.tokens.push(new Token(TT.EOL, "\n", abcContext.generateId()));
  return ctx;
}

describe("scanInfoLine Integration Tests", () => {
  describe("Basic Integration Tests", () => {
    it("should delegate to scanKeyInfo for K: headers", () => {
      const ctx = createTestContext("K:C major");
      const result = scanInfoLine(ctx);

      assert.equal(result, true);
      assert.equal(ctx.tokens[ctx.tokens.length - 3].type, TT.INF_HDR);
      assert.equal(ctx.tokens[ctx.tokens.length - 3].lexeme, "K:");
      assert.equal(ctx.tokens[ctx.tokens.length - 2].type, TT.KEY_ROOT);
      assert.equal(ctx.tokens[ctx.tokens.length - 2].lexeme, "C");
      assert.equal(ctx.tokens[ctx.tokens.length - 1].type, TT.KEY_MODE);
      assert.equal(ctx.tokens[ctx.tokens.length - 1].lexeme, "major");
    });

    it("should delegate to scanMeterInfo for M: headers", () => {
      const ctx = createTestContext("M:4/4");
      const result = scanInfoLine(ctx);

      assert.equal(result, true);
      assert.equal(ctx.tokens[ctx.tokens.length - 4].type, TT.INF_HDR);
      assert.equal(ctx.tokens[ctx.tokens.length - 4].lexeme, "M:");
      assert.equal(ctx.tokens[ctx.tokens.length - 3].type, TT.METER_NUMBER);
      assert.equal(ctx.tokens[ctx.tokens.length - 3].lexeme, "4");
      assert.equal(ctx.tokens[ctx.tokens.length - 2].type, TT.METER_SEPARATOR);
      assert.equal(ctx.tokens[ctx.tokens.length - 2].lexeme, "/");
      assert.equal(ctx.tokens[ctx.tokens.length - 1].type, TT.METER_NUMBER);
      assert.equal(ctx.tokens[ctx.tokens.length - 1].lexeme, "4");
    });

    it("should delegate to scanNoteLenInfo for L: headers", () => {
      const ctx = createTestContext("L:1/8");
      const result = scanInfoLine(ctx);

      assert.equal(result, true);
      assert.equal(ctx.tokens[ctx.tokens.length - 3].type, TT.INF_HDR);
      assert.equal(ctx.tokens[ctx.tokens.length - 3].lexeme, "L:");
      assert.equal(ctx.tokens[ctx.tokens.length - 2].type, TT.NOTE_LEN_NUM);
      assert.equal(ctx.tokens[ctx.tokens.length - 2].lexeme, "1");
      assert.equal(ctx.tokens[ctx.tokens.length - 1].type, TT.NOTE_LEN_DENOM);
      assert.equal(ctx.tokens[ctx.tokens.length - 1].lexeme, "8");
    });

    it("should delegate to scanTempoInfo for Q: headers", () => {
      const ctx = createTestContext("Q:120");
      const result = scanInfoLine(ctx);

      assert.equal(result, true);
      assert.equal(ctx.tokens[ctx.tokens.length - 2].type, TT.INF_HDR);
      assert.equal(ctx.tokens[ctx.tokens.length - 2].lexeme, "Q:");
      assert.equal(ctx.tokens[ctx.tokens.length - 1].type, TT.TEMPO_BPM);
      assert.equal(ctx.tokens[ctx.tokens.length - 1].lexeme, "120");
    });

    it("should delegate to scanVoiceInfo for V: headers", () => {
      const ctx = createTestContext("V:1 name=Melody");
      const result = scanInfoLine(ctx);

      assert.equal(result, true);
      assert.equal(ctx.tokens[ctx.tokens.length - 5].type, TT.INF_HDR);
      assert.equal(ctx.tokens[ctx.tokens.length - 5].lexeme, "V:");
      assert.equal(ctx.tokens[ctx.tokens.length - 4].type, TT.VX_ID);
      assert.equal(ctx.tokens[ctx.tokens.length - 4].lexeme, "1");
      assert.equal(ctx.tokens[ctx.tokens.length - 3].type, TT.VX_K);
      assert.equal(ctx.tokens[ctx.tokens.length - 3].lexeme, "name");
      assert.equal(ctx.tokens[ctx.tokens.length - 1].type, TT.VX_V);
      assert.equal(ctx.tokens[ctx.tokens.length - 1].lexeme, "Melody");
    });

    it("should handle unknown info line types with INFO_STR", () => {
      const ctx = createTestContext("T:My Title");
      const result = scanInfoLine(ctx);

      assert.equal(result, true);
      assert.equal(ctx.tokens[ctx.tokens.length - 2].type, TT.INF_HDR);
      assert.equal(ctx.tokens[ctx.tokens.length - 2].lexeme, "T:");
      assert.equal(ctx.tokens[ctx.tokens.length - 1].type, TT.INFO_STR);
      assert.equal(ctx.tokens[ctx.tokens.length - 1].lexeme, "My Title");
    });

    it("should handle comments after info lines", () => {
      const ctx = createTestContext("K:C major % This is a comment");
      const result = scanInfoLine(ctx);

      assert.equal(result, true);

      // Find the comment token
      const commentToken = ctx.tokens.find((t) => t.type === TT.COMMENT);
      assert.isDefined(commentToken);
      assert.equal(commentToken!.lexeme, "% This is a comment");
    });

    it("should handle empty info lines", () => {
      const ctx = createTestContext("T:");
      const result = scanInfoLine(ctx);

      assert.equal(result, true);
      assert.equal(ctx.tokens[ctx.tokens.length - 1].type, TT.INF_HDR);
      assert.equal(ctx.tokens[ctx.tokens.length - 1].lexeme, "T:");
    });

    it("should return false for non-info line input", () => {
      const ctx = createTestContext("ABC");
      const result = scanInfoLine(ctx);

      assert.equal(result, false);
    });
  });

  describe("Property-Based Integration Round-Trip Tests", () => {
    function createRoundTripPredicate(tokens: Token[]): boolean {
      // Convert tokens to string
      const input = tokens
        .filter((t) => t.type != TT.EOL)
        .map((t) => t.lexeme)
        .join("");

      // Skip empty inputs
      if (input.trim() === "") return true;

      // Scan the input
      const ctx = createTestContext(input);
      const result = scanInfoLine(ctx);

      if (!result) {
        console.log("scanInfoLine returned false for input:", {
          input,
          tokens: tokens.map((t) => `${TT[t.type]}:${t.lexeme}`),
        });
        return false;
      }

      // Filter out the initial EOL token we added for context
      const scannedTokens = ctx.tokens.slice(1);

      // Filter out whitespace tokens from both original and scanned
      const originalFiltered = tokens.filter((t) => t.type !== TT.WS && t.type !== TT.EOL && t.type !== TT.DISCARD);
      const scannedFiltered = scannedTokens.filter((t) => t.type !== TT.WS && t.type !== TT.EOL && t.type !== TT.DISCARD);

      // Compare token counts
      if (originalFiltered.length !== scannedFiltered.length) {
        console.log("Token count mismatch:", {
          input,
          originalCount: originalFiltered.length,
          scannedCount: scannedFiltered.length,
          original: originalFiltered.map((t) => `${TT[t.type]}:${t.lexeme}`),
          scanned: scannedFiltered.map((t) => `${TT[t.type]}:${t.lexeme}`),
        });
        return false;
      }

      // Compare token types and lexemes
      for (let i = 0; i < originalFiltered.length; i++) {
        const orig = originalFiltered[i];
        const scanned = scannedFiltered[i];

        if (orig.type !== scanned.type || orig.lexeme !== scanned.lexeme) {
          console.log("Token mismatch at position", i, {
            input,
            original: `${TT[orig.type]}:${orig.lexeme}`,
            scanned: `${TT[scanned.type]}:${scanned.lexeme}`,
          });
          return false;
        }
      }

      return true;
    }

    it("should produce equivalent tokens when rescanning all info line types", () => {
      fc.assert(fc.property(genInfoLine, createRoundTripPredicate), {
        verbose: false,
        numRuns: 1000,
      });
    });
  });
});
