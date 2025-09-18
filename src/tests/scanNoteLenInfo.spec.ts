import assert from "assert";
import * as fc from "fast-check";
import { describe, it } from "mocha";
import { Ctx, TT, Token } from "../parsers/scan2";
import { scanNoteLenInfo } from "../parsers/infoLines/scanNoteLenInfo";
import { ABCContext } from "../parsers/Context";
import { genNoteLenDenom, sharedContext } from "./scn_pbt.generators.spec";

function createTestContext(source: string): Ctx {
  const abcContext = new ABCContext();
  return new Ctx(source, abcContext);
}

describe("scanNoteLenInfo", () => {
  it("should scan simple note length with numerator and denominator", () => {
    const ctx = createTestContext("1/4");
    const result = scanNoteLenInfo(ctx);

    assert.equal(result, true);
    assert.equal(ctx.tokens.length, 3);
    assert.equal(ctx.tokens[0].type, TT.NOTE_LEN_NUM);
    assert.equal(ctx.tokens[0].lexeme, "1");
    assert.equal(ctx.tokens[1].type, TT.METER_SEPARATOR);
    assert.equal(ctx.tokens[1].lexeme, "/");
    assert.equal(ctx.tokens[2].type, TT.NOTE_LEN_DENOM);
    assert.equal(ctx.tokens[2].lexeme, "4");
  });

  it("should scan eighth note", () => {
    const ctx = createTestContext("1/8");
    const result = scanNoteLenInfo(ctx);

    assert.equal(result, true);
    assert.equal(ctx.tokens.length, 3);
    assert.equal(ctx.tokens[0].type, TT.NOTE_LEN_NUM);
    assert.equal(ctx.tokens[0].lexeme, "1");
    assert.equal(ctx.tokens[1].type, TT.METER_SEPARATOR);
    assert.equal(ctx.tokens[1].lexeme, "/");
    assert.equal(ctx.tokens[2].type, TT.NOTE_LEN_DENOM);
    assert.equal(ctx.tokens[2].lexeme, "8");
  });

  it("should scan sixteenth note", () => {
    const ctx = createTestContext("1/16");
    const result = scanNoteLenInfo(ctx);

    assert.equal(result, true);
    assert.equal(ctx.tokens.length, 3);
    assert.equal(ctx.tokens[0].type, TT.NOTE_LEN_NUM);
    assert.equal(ctx.tokens[0].lexeme, "1");
    assert.equal(ctx.tokens[1].type, TT.METER_SEPARATOR);
    assert.equal(ctx.tokens[1].lexeme, "/");
    assert.equal(ctx.tokens[2].type, TT.NOTE_LEN_DENOM);
    assert.equal(ctx.tokens[2].lexeme, "16");
  });

  it("should scan half note", () => {
    const ctx = createTestContext("1/2");
    const result = scanNoteLenInfo(ctx);

    assert.equal(result, true);
    assert.equal(ctx.tokens.length, 3);
    assert.equal(ctx.tokens[0].type, TT.NOTE_LEN_NUM);
    assert.equal(ctx.tokens[0].lexeme, "1");
    assert.equal(ctx.tokens[1].type, TT.METER_SEPARATOR);
    assert.equal(ctx.tokens[1].lexeme, "/");
    assert.equal(ctx.tokens[2].type, TT.NOTE_LEN_DENOM);
    assert.equal(ctx.tokens[2].lexeme, "2");
  });

  it("should scan whole note as 1/1", () => {
    const ctx = createTestContext("1/1");
    const result = scanNoteLenInfo(ctx);

    assert.equal(result, true);
    assert.equal(ctx.tokens.length, 3);
    assert.equal(ctx.tokens[0].type, TT.NOTE_LEN_NUM);
    assert.equal(ctx.tokens[0].lexeme, "1");
    assert.equal(ctx.tokens[1].type, TT.METER_SEPARATOR);
    assert.equal(ctx.tokens[1].lexeme, "/");
    assert.equal(ctx.tokens[2].type, TT.NOTE_LEN_DENOM);
    assert.equal(ctx.tokens[2].lexeme, "1");
  });

  it("should scan very short note lengths", () => {
    const testCases = ["1/32", "1/64", "1/128", "1/256", "1/512"];

    testCases.forEach((testCase) => {
      const ctx = createTestContext(testCase);
      const result = scanNoteLenInfo(ctx);
      const [num, denom] = testCase.split("/");

      assert.equal(result, true, `Failed for ${testCase}`);
      assert.equal(ctx.tokens.length, 3, `Wrong token count for ${testCase}`);
      assert.equal(ctx.tokens[0].type, TT.NOTE_LEN_NUM, `Wrong numerator token type for ${testCase}`);
      assert.equal(ctx.tokens[0].lexeme, num, `Wrong numerator lexeme for ${testCase}`);
      assert.equal(ctx.tokens[1].type, TT.METER_SEPARATOR, `Wrong separator token type for ${testCase}`);
      assert.equal(ctx.tokens[1].lexeme, "/", `Wrong separator lexeme for ${testCase}`);
      assert.equal(ctx.tokens[2].type, TT.NOTE_LEN_DENOM, `Wrong denominator token type for ${testCase}`);
      assert.equal(ctx.tokens[2].lexeme, denom, `Wrong denominator lexeme for ${testCase}`);
    });
  });

  it("should scan note length with larger numerator", () => {
    const ctx = createTestContext("3/4");
    const result = scanNoteLenInfo(ctx);

    assert.equal(result, true);
    assert.equal(ctx.tokens.length, 3);
    assert.equal(ctx.tokens[0].type, TT.NOTE_LEN_NUM);
    assert.equal(ctx.tokens[0].lexeme, "3");
    assert.equal(ctx.tokens[1].type, TT.METER_SEPARATOR);
    assert.equal(ctx.tokens[1].lexeme, "/");
    assert.equal(ctx.tokens[2].type, TT.NOTE_LEN_DENOM);
    assert.equal(ctx.tokens[2].lexeme, "4");
  });

  it("should scan note length with multi-digit numbers", () => {
    const ctx = createTestContext("12/16");
    const result = scanNoteLenInfo(ctx);

    assert.equal(result, true);
    assert.equal(ctx.tokens.length, 3);
    assert.equal(ctx.tokens[0].type, TT.NOTE_LEN_NUM);
    assert.equal(ctx.tokens[0].lexeme, "12");
    assert.equal(ctx.tokens[1].type, TT.METER_SEPARATOR);
    assert.equal(ctx.tokens[1].lexeme, "/");
    assert.equal(ctx.tokens[2].type, TT.NOTE_LEN_DENOM);
    assert.equal(ctx.tokens[2].lexeme, "16");
  });

  it("should handle whitespace around slash", () => {
    const ctx = createTestContext("1 / 4");
    const result = scanNoteLenInfo(ctx);

    assert.equal(result, true);
    assert.equal(ctx.tokens[0].type, TT.NOTE_LEN_NUM);
    assert.equal(ctx.tokens[0].lexeme, "1");
    assert.equal(ctx.tokens[2].type, TT.METER_SEPARATOR);
    assert.equal(ctx.tokens[2].lexeme, "/");
    assert.equal(ctx.tokens[4].type, TT.NOTE_LEN_DENOM);
    assert.equal(ctx.tokens[4].lexeme, "4");
  });

  it("should handle leading whitespace", () => {
    const ctx = createTestContext("  1/8  ");
    const result = scanNoteLenInfo(ctx);

    assert.equal(result, true);
    assert.equal(ctx.tokens[1].type, TT.NOTE_LEN_NUM);
    assert.equal(ctx.tokens[1].lexeme, "1");
    assert.equal(ctx.tokens[2].type, TT.METER_SEPARATOR);
    assert.equal(ctx.tokens[2].lexeme, "/");
    assert.equal(ctx.tokens[3].type, TT.NOTE_LEN_DENOM);
    assert.equal(ctx.tokens[3].lexeme, "8");
  });

  it("should return false for invalid format - no denominator", () => {
    const ctx = createTestContext("1/");
    const result = scanNoteLenInfo(ctx);

    assert.equal(result, false);
  });

  it("should return false for invalid format - denominator starting with 0", () => {
    const ctx = createTestContext("1/0");
    const result = scanNoteLenInfo(ctx);

    assert.equal(result, false);
  });

  it("should return false for invalid format - numerator starting with 0", () => {
    const ctx = createTestContext("0/4");
    const result = scanNoteLenInfo(ctx);

    assert.equal(result, false);
  });

  it("should return false for empty string", () => {
    const ctx = createTestContext("");
    const result = scanNoteLenInfo(ctx);

    assert.equal(result, false);
  });

  it("should return false for invalid characters", () => {
    const ctx = createTestContext("a/b");
    const result = scanNoteLenInfo(ctx);

    assert.equal(result, false);
  });

  it("should return true for slash and denom", () => {
    const ctx = createTestContext("/14");
    const result = scanNoteLenInfo(ctx);

    assert.equal(result, true);
  });
  it("should return true for denom-only", () => {
    const ctx = createTestContext("14");
    const result = scanNoteLenInfo(ctx);

    assert.equal(result, true);
  });
});

// Import the generators from the main generators file
import { genNoteLenSignature } from "./scn_pbt.generators.spec";

describe("scanNoteLenInfo Property-Based Tests", () => {
  function createRoundTripPredicate(tokens: Token[]): boolean {
    const input = tokens.map((t) => t.lexeme).join("");

    // Scan the input
    const ctx = createTestContext(input);
    const result = scanNoteLenInfo(ctx);

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

  it("should produce equivalent tokens when rescanning note length signatures", () => {
    fc.assert(fc.property(genNoteLenSignature, createRoundTripPredicate), {
      verbose: false,
      numRuns: 1000,
    });
  });

  it("should always succeed on valid note length patterns", () => {
    fc.assert(
      fc.property(genNoteLenSignature, (tokens) => {
        const input = tokens
          .map((t) => {
            if (t.lexeme === "/") return "/";
            return t.lexeme;
          })
          .join("");
        const ctx = createTestContext(input);
        const result = scanNoteLenInfo(ctx);

        return result === true && ctx.tokens.length >= 2;
      }),
      {
        verbose: false,
        numRuns: 1000,
      }
    );
  });

  it("should handle various numerator values", () => {
    const genVariousNumerators = fc
      .tuple(fc.integer({ min: 1, max: 16 }), genNoteLenDenom)
      .map(([num, denom]) => [new Token(TT.NOTE_LEN_NUM, num.toString(), sharedContext.generateId()), denom]);

    fc.assert(
      fc.property(genVariousNumerators, (tokens) => {
        const input = `${tokens[0].lexeme}/${tokens[1].lexeme}`;
        const ctx = createTestContext(input);
        const result = scanNoteLenInfo(ctx);

        const numToken = ctx.tokens.find((t) => t.type === TT.NOTE_LEN_NUM);
        const denomToken = ctx.tokens.find((t) => t.type === TT.NOTE_LEN_DENOM);

        return result === true && numToken?.lexeme === tokens[0].lexeme && denomToken?.lexeme === tokens[1].lexeme;
      }),
      {
        verbose: false,
        numRuns: 500,
      }
    );
  });

  it("should handle standard ABC note length denominators", () => {
    const standardDenominators = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512];

    fc.assert(
      fc.property(fc.constantFrom(...standardDenominators), fc.integer({ min: 1, max: 8 }), (denom, num) => {
        const input = `${num}/${denom}`;
        const ctx = createTestContext(input);
        const result = scanNoteLenInfo(ctx);

        return result === true && ctx.tokens.length === 3;
      }),
      {
        verbose: false,
        numRuns: 200,
      }
    );
  });

  it("should never crash on generated note length signatures", () => {
    fc.assert(
      fc.property(genNoteLenSignature, (tokens) => {
        try {
          const input = tokens
            .map((t) => {
              if (t.lexeme === "/") return "/";
              return t.lexeme;
            })
            .join("");
          const ctx = createTestContext(input);
          scanNoteLenInfo(ctx);
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
