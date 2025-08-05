import assert from "assert";
import * as fc from "fast-check";
import { describe, it } from "mocha";
import { Ctx, TT, Token } from "../parsers/scan2";
import { scanKeyInfo } from "../parsers/scanKeyInfo";
import { ABCContext } from "../parsers/Context";
import { sharedContext } from "./scn_pbt.generators.spec";

function createTestContext(source: string): Ctx {
  const abcContext = new ABCContext();
  return new Ctx(source, abcContext);
}

describe("scanKeyInfo", () => {
  it("should scan simple key root", () => {
    const ctx = createTestContext("C");
    const result = scanKeyInfo(ctx);

    assert.equal(result, true);
    assert.equal(ctx.tokens.length, 1);
    assert.equal(ctx.tokens[0].type, TT.KEY_ROOT);
    assert.equal(ctx.tokens[0].lexeme, "C");
  });

  it("should scan key with accidental", () => {
    const ctx = createTestContext("F#");
    const result = scanKeyInfo(ctx);

    assert.equal(result, true);
    assert.equal(ctx.tokens.length, 2);
    assert.equal(ctx.tokens[0].type, TT.KEY_ROOT);
    assert.equal(ctx.tokens[0].lexeme, "F");
    assert.equal(ctx.tokens[1].type, TT.KEY_ACCIDENTAL);
    assert.equal(ctx.tokens[1].lexeme, "#");
  });

  it("should scan key with mode", () => {
    const ctx = createTestContext("G major");
    const result = scanKeyInfo(ctx);

    assert.equal(result, true);
    assert.equal(ctx.tokens.length, 2);
    assert.equal(ctx.tokens[0].type, TT.KEY_ROOT);
    assert.equal(ctx.tokens[0].lexeme, "G");
    assert.equal(ctx.tokens[1].type, TT.KEY_MODE);
    assert.equal(ctx.tokens[1].lexeme, "major");
  });

  it("should scan key with accidental and mode", () => {
    const ctx = createTestContext("F# dorian");
    const result = scanKeyInfo(ctx);

    assert.equal(result, true);
    assert.equal(ctx.tokens.length, 3);
    assert.equal(ctx.tokens[0].type, TT.KEY_ROOT);
    assert.equal(ctx.tokens[0].lexeme, "F");
    assert.equal(ctx.tokens[1].type, TT.KEY_ACCIDENTAL);
    assert.equal(ctx.tokens[1].lexeme, "#");
    assert.equal(ctx.tokens[2].type, TT.KEY_MODE);
    assert.equal(ctx.tokens[2].lexeme, "dorian");
  });

  it("should scan key with explicit accidentals", () => {
    const ctx = createTestContext("C^c_b");
    const result = scanKeyInfo(ctx);

    assert.equal(result, true);
    assert.equal(ctx.tokens.length, 3);
    assert.equal(ctx.tokens[0].type, TT.KEY_ROOT);
    assert.equal(ctx.tokens[0].lexeme, "C");
    assert.equal(ctx.tokens[1].type, TT.KEY_EXPLICIT_ACC);
    assert.equal(ctx.tokens[1].lexeme, "^c");
    assert.equal(ctx.tokens[2].type, TT.KEY_EXPLICIT_ACC);
    assert.equal(ctx.tokens[2].lexeme, "_b");
  });

  it("should scan complex key signature", () => {
    const ctx = createTestContext("Bb minor ^f_e=g");
    const result = scanKeyInfo(ctx);

    assert.equal(result, true);
    assert.equal(ctx.tokens.length, 6);
    assert.equal(ctx.tokens[0].type, TT.KEY_ROOT);
    assert.equal(ctx.tokens[0].lexeme, "B");
    assert.equal(ctx.tokens[1].type, TT.KEY_ACCIDENTAL);
    assert.equal(ctx.tokens[1].lexeme, "b");
    assert.equal(ctx.tokens[2].type, TT.KEY_MODE);
    assert.equal(ctx.tokens[2].lexeme, "minor");
    assert.equal(ctx.tokens[3].type, TT.KEY_EXPLICIT_ACC);
    assert.equal(ctx.tokens[3].lexeme, "^f");
    assert.equal(ctx.tokens[4].type, TT.KEY_EXPLICIT_ACC);
    assert.equal(ctx.tokens[4].lexeme, "_e");
    assert.equal(ctx.tokens[5].type, TT.KEY_EXPLICIT_ACC);
    assert.equal(ctx.tokens[5].lexeme, "=g");
  });

  it('should scan "none" key signature', () => {
    const ctx = createTestContext("none");
    const result = scanKeyInfo(ctx);

    assert.equal(result, true);
    assert.equal(ctx.tokens.length, 1);
    assert.equal(ctx.tokens[0].type, TT.KEY_NONE);
    assert.equal(ctx.tokens[0].lexeme, "none");
  });

  it("should handle case-insensitive modes", () => {
    const ctx = createTestContext("D MINOR");
    const result = scanKeyInfo(ctx);

    assert.equal(result, true);
    assert.equal(ctx.tokens.length, 2);
    assert.equal(ctx.tokens[0].type, TT.KEY_ROOT);
    assert.equal(ctx.tokens[0].lexeme, "D");
    assert.equal(ctx.tokens[1].type, TT.KEY_MODE);
    assert.equal(ctx.tokens[1].lexeme, "MINOR");
  });

  it("should handle abbreviated modes", () => {
    const ctx = createTestContext("A min");
    const result = scanKeyInfo(ctx);

    assert.equal(result, true);
    assert.equal(ctx.tokens.length, 2);
    assert.equal(ctx.tokens[0].type, TT.KEY_ROOT);
    assert.equal(ctx.tokens[0].lexeme, "A");
    assert.equal(ctx.tokens[1].type, TT.KEY_MODE);
    assert.equal(ctx.tokens[1].lexeme, "min");
  });

  it("should handle whitespace correctly", () => {
    const ctx = createTestContext("  C  major  ^c  ");
    const result = scanKeyInfo(ctx);

    assert.equal(result, true);
    assert.equal(ctx.tokens.length, 3);
    assert.equal(ctx.tokens[0].type, TT.KEY_ROOT);
    assert.equal(ctx.tokens[0].lexeme, "C");
    assert.equal(ctx.tokens[1].type, TT.KEY_MODE);
    assert.equal(ctx.tokens[1].lexeme, "major");
    assert.equal(ctx.tokens[2].type, TT.KEY_EXPLICIT_ACC);
    assert.equal(ctx.tokens[2].lexeme, "^c");
  });

  it("should return false for invalid key root", () => {
    const ctx = createTestContext("X major");
    const result = scanKeyInfo(ctx);

    assert.equal(result, false);
    assert.equal(ctx.tokens.length, 0);
  });

  it("should return false for empty string", () => {
    const ctx = createTestContext("");
    const result = scanKeyInfo(ctx);

    assert.equal(result, false);
    assert.equal(ctx.tokens.length, 0);
  });

  it("should handle complex whitespace and correctly rescan", () => {
    const complexInput = " \t \t\t\t  F # mixolydian =g\t   \t \t\t ";
    const ctx = createTestContext(complexInput);
    const result = scanKeyInfo(ctx);

    assert.equal(result, true);
    assert.equal(ctx.tokens.length, 4);
    assert.equal(ctx.tokens[0].type, TT.KEY_ROOT);
    assert.equal(ctx.tokens[0].lexeme, "F");
    assert.equal(ctx.tokens[1].type, TT.KEY_ACCIDENTAL);
    assert.equal(ctx.tokens[1].lexeme, "#");
    assert.equal(ctx.tokens[2].type, TT.KEY_MODE);
    assert.equal(ctx.tokens[2].lexeme, "mixolydian");
    assert.equal(ctx.tokens[3].type, TT.KEY_EXPLICIT_ACC);
    assert.equal(ctx.tokens[3].lexeme, "=g");

    // Verify rescan works correctly by converting tokens back to string
    const recreatedInput = ctx.tokens.map((t) => t.lexeme).join("");
    const rescanCtx = createTestContext(recreatedInput);
    const rescanResult = scanKeyInfo(rescanCtx);

    assert.equal(rescanResult, true);
    assert.equal(rescanCtx.tokens.length, ctx.tokens.length);
    for (let i = 0; i < ctx.tokens.length; i++) {
      assert.equal(rescanCtx.tokens[i].type, ctx.tokens[i].type);
      assert.equal(rescanCtx.tokens[i].lexeme, ctx.tokens[i].lexeme);
    }
  });
});

describe("scanKeyInfo Property-Based Tests", () => {
  // Key signature component generators
  const genKeyRoot = fc.constantFrom("A", "B", "C", "D", "E", "F", "G").map((root) => new Token(TT.KEY_ROOT, root, sharedContext.generateId()));

  const genKeyAccidental = fc.constantFrom("#", "b").map((acc) => new Token(TT.KEY_ACCIDENTAL, acc, sharedContext.generateId()));

  const genKeyMode = fc
    .constantFrom(
      "major",
      "minor",
      "maj",
      "min",
      "m",
      "ionian",
      "dorian",
      "dor",
      "phrygian",
      "phr",
      "lydian",
      "lyd",
      "mixolydian",
      "mix",
      "aeolian",
      "aeo",
      "locrian",
      "loc"
    )
    .map((mode) => new Token(TT.KEY_MODE, mode, sharedContext.generateId()));

  const genExplicitAccidental = fc
    .tuple(fc.constantFrom("^", "_", "="), fc.constantFrom("a", "b", "c", "d", "e", "f", "g", "A", "B", "C", "D", "E", "F", "G"))
    .map(([accSymbol, note]) => new Token(TT.KEY_EXPLICIT_ACC, accSymbol + note, sharedContext.generateId()));

  const genKeyNone = fc.constantFrom("none", "NONE", "None").map((none) => new Token(TT.KEY_NONE, none, sharedContext.generateId()));

  const genWhitespace = fc.stringMatching(/^[ \t]+$/).map((ws) => new Token(TT.WS, ws, sharedContext.generateId()));

  // Single generator for complete key signatures with optional whitespace
  const genKeySignature = fc.oneof(
    // "none" key signature with optional leading/trailing whitespace
    fc.tuple(fc.option(genWhitespace), genKeyNone, fc.option(genWhitespace)).map(([leadingWs, none, trailingWs]) => {
      const tokens: Token[] = [];
      if (leadingWs) tokens.push(leadingWs);
      tokens.push(none);
      if (trailingWs) tokens.push(trailingWs);
      return tokens;
    }),

    // Regular key signatures: root [ws] [accidental] [ws] [mode] [ws] [explicit accidentals]
    fc
      .tuple(
        fc.option(genWhitespace), // leading whitespace
        genKeyRoot,
        fc.option(genKeyAccidental),
        fc.option(genKeyMode),
        fc.array(genExplicitAccidental, { maxLength: 5 }),
        fc.option(genWhitespace) // trailing whitespace
      )
      .map(([leadingWs, root, accidental, mode, explicitAccs, trailingWs]) => {
        const tokens: Token[] = [];

        if (leadingWs) tokens.push(leadingWs);
        tokens.push(root);

        if (accidental) {
          // Optional whitespace before accidental
          if (fc.sample(fc.boolean(), 1)[0]) {
            tokens.push(new Token(TT.WS, " ", sharedContext.generateId()));
          }
          tokens.push(accidental);
        }

        if (mode) {
          // Always add whitespace before mode if we have one
          tokens.push(new Token(TT.WS, " ", sharedContext.generateId()));
          tokens.push(mode);
        }

        if (explicitAccs.length > 0) {
          // Optional whitespace before explicit accidentals
          if (fc.sample(fc.boolean(), 1)[0]) {
            tokens.push(new Token(TT.WS, " ", sharedContext.generateId()));
          }
          tokens.push(...explicitAccs);
        }

        if (trailingWs) tokens.push(trailingWs);
        return tokens;
      })
  );

  function createRoundTripPredicate(tokens: Token[]): boolean {
    // Convert tokens to string
    const input = tokens.map((t) => t.lexeme).join("");

    // Scan the input
    const ctx = createTestContext(input);
    const result = scanKeyInfo(ctx);

    if (!result) {
      return false;
    }

    // Filter out whitespace tokens from both original and scanned
    const originalFiltered = tokens.filter((t) => t.type !== TT.WS);
    const scannedFiltered = ctx.tokens.filter((t) => t.type !== TT.WS);

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

  it("should produce equivalent tokens when rescanning key signatures", () => {
    fc.assert(fc.property(genKeySignature, createRoundTripPredicate), {
      verbose: false,
      numRuns: 1000,
    });
  });

  it("should always succeed on valid key signature patterns", () => {
    fc.assert(
      fc.property(genKeySignature, (tokens) => {
        const input = tokens.map((t) => t.lexeme).join("");
        const ctx = createTestContext(input);
        const result = scanKeyInfo(ctx);

        return result === true && ctx.tokens.length > 0;
      }),
      {
        verbose: false,
        numRuns: 1000,
      }
    );
  });

  it("should handle case variations in modes", () => {
    const genCaseVariations = fc
      .tuple(
        genKeyRoot,
        fc.option(genKeyAccidental),
        fc
          .constantFrom("major", "MAJOR", "Major", "minor", "MINOR", "Minor", "dorian", "DORIAN", "Dorian")
          .map((mode) => new Token(TT.KEY_MODE, mode, sharedContext.generateId()))
      )
      .map(([root, acc, mode]) => {
        const tokens = [root];
        if (acc) tokens.push(acc);
        tokens.push(mode);
        return tokens;
      });

    fc.assert(
      fc.property(genCaseVariations, (tokens) => {
        const input = tokens.map((t) => t.lexeme).join(" ");
        const ctx = createTestContext(input);
        const result = scanKeyInfo(ctx);

        return result === true && ctx.tokens.some((t) => t.type === TT.KEY_MODE);
      }),
      {
        verbose: false,
        numRuns: 100,
      }
    );
  });

  it("should handle multiple explicit accidentals", () => {
    const genMultipleExplicitAccs = fc
      .tuple(genKeyRoot, fc.array(genExplicitAccidental, { minLength: 1, maxLength: 7 }))
      .map(([root, explicitAccs]) => [root, ...explicitAccs]);

    fc.assert(
      fc.property(genMultipleExplicitAccs, (tokens) => {
        const input = tokens.map((t) => t.lexeme).join("");
        const ctx = createTestContext(input);
        const result = scanKeyInfo(ctx);

        const explicitAccCount = tokens.filter((t) => t.type === TT.KEY_EXPLICIT_ACC).length;
        const scannedExplicitAccCount = ctx.tokens.filter((t) => t.type === TT.KEY_EXPLICIT_ACC).length;

        return result === true && explicitAccCount === scannedExplicitAccCount;
      }),
      {
        verbose: false,
        numRuns: 500,
      }
    );
  });

  it("should never crash on generated key signatures", () => {
    fc.assert(
      fc.property(genKeySignature, (tokens) => {
        try {
          const input = tokens.map((t) => t.lexeme).join("");
          const ctx = createTestContext(input);
          scanKeyInfo(ctx);
          return true;
        } catch (e) {
          console.log("Crash on input:", tokens.map((t) => t.lexeme).join(""), e);
          return false;
        }
      }),
      {
        verbose: false,
        numRuns: 1000,
      }
    );
  });
});
