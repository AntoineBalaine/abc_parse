import { assert } from "chai";
import * as fc from "fast-check";
import { describe, it } from "mocha";
import { Ctx, TT, Token } from "../parsers/scan2";
import { scanMeterInfo } from "../parsers/infoLines/scanMeterInfo";
import { ABCContext } from "../parsers/Context";
import { sharedContext } from "./scn_pbt.generators.spec";

function createTestContext(source: string): Ctx {
  const abcContext = new ABCContext();
  return new Ctx(source, abcContext);
}

describe("scanMeterInfo", () => {
  it("should scan simple meter 4/4", () => {
    const ctx = createTestContext("4/4");
    const result = scanMeterInfo(ctx);

    assert.equal(result, true);
    assert.equal(ctx.tokens.length, 3);
    assert.equal(ctx.tokens[0].type, TT.METER_NUMBER);
    assert.equal(ctx.tokens[0].lexeme, "4");
    assert.equal(ctx.tokens[1].type, TT.METER_SEPARATOR);
    assert.equal(ctx.tokens[1].lexeme, "/");
    assert.equal(ctx.tokens[2].type, TT.METER_NUMBER);
    assert.equal(ctx.tokens[2].lexeme, "4");
  });

  it("should scan meter 6/8", () => {
    const ctx = createTestContext("6/8");
    const result = scanMeterInfo(ctx);

    assert.equal(result, true);
    assert.equal(ctx.tokens.length, 3);
    assert.equal(ctx.tokens[0].type, TT.METER_NUMBER);
    assert.equal(ctx.tokens[0].lexeme, "6");
    assert.equal(ctx.tokens[1].type, TT.METER_SEPARATOR);
    assert.equal(ctx.tokens[1].lexeme, "/");
    assert.equal(ctx.tokens[2].type, TT.METER_NUMBER);
    assert.equal(ctx.tokens[2].lexeme, "8");
  });

  it("should scan common time C", () => {
    const ctx = createTestContext("C");
    const result = scanMeterInfo(ctx);

    assert.equal(result, true);
    assert.equal(ctx.tokens.length, 1);
    assert.equal(ctx.tokens[0].type, TT.METER_C);
    assert.equal(ctx.tokens[0].lexeme, "C");
  });

  it("should scan cut time C|", () => {
    const ctx = createTestContext("C|");
    const result = scanMeterInfo(ctx);

    assert.equal(result, true);
    assert.equal(ctx.tokens.length, 1);
    assert.equal(ctx.tokens[0].type, TT.METER_C_BAR);
    assert.equal(ctx.tokens[0].lexeme, "C|");
  });

  it("should scan complex meter (2+3+2)/8", () => {
    const ctx = createTestContext("(2+3+2)/8");
    const result = scanMeterInfo(ctx);

    assert.equal(result, true);
    assert.equal(ctx.tokens.length, 9);
    assert.equal(ctx.tokens[0].type, TT.METER_LPAREN);
    assert.equal(ctx.tokens[0].lexeme, "(");
    assert.equal(ctx.tokens[1].type, TT.METER_NUMBER);
    assert.equal(ctx.tokens[1].lexeme, "2");
    assert.equal(ctx.tokens[2].type, TT.METER_PLUS);
    assert.equal(ctx.tokens[2].lexeme, "+");
    assert.equal(ctx.tokens[3].type, TT.METER_NUMBER);
    assert.equal(ctx.tokens[3].lexeme, "3");
    assert.equal(ctx.tokens[4].type, TT.METER_PLUS);
    assert.equal(ctx.tokens[4].lexeme, "+");
    assert.equal(ctx.tokens[5].type, TT.METER_NUMBER);
    assert.equal(ctx.tokens[5].lexeme, "2");
    assert.equal(ctx.tokens[6].type, TT.METER_RPAREN);
    assert.equal(ctx.tokens[6].lexeme, ")");
    assert.equal(ctx.tokens[7].type, TT.METER_SEPARATOR);
    assert.equal(ctx.tokens[7].lexeme, "/");
  });

  it("should scan complex meter without parentheses 2+3+2/8", () => {
    const ctx = createTestContext("2+3+2/8");
    const result = scanMeterInfo(ctx);

    assert.equal(result, true);
    assert.equal(ctx.tokens.length, 7);
    assert.equal(ctx.tokens[0].type, TT.METER_NUMBER);
    assert.equal(ctx.tokens[0].lexeme, "2");
    assert.equal(ctx.tokens[1].type, TT.METER_PLUS);
    assert.equal(ctx.tokens[1].lexeme, "+");
    assert.equal(ctx.tokens[2].type, TT.METER_NUMBER);
    assert.equal(ctx.tokens[2].lexeme, "3");
    assert.equal(ctx.tokens[3].type, TT.METER_PLUS);
    assert.equal(ctx.tokens[3].lexeme, "+");
    assert.equal(ctx.tokens[4].type, TT.METER_NUMBER);
    assert.equal(ctx.tokens[4].lexeme, "2");
    assert.equal(ctx.tokens[5].type, TT.METER_SEPARATOR);
    assert.equal(ctx.tokens[5].lexeme, "/");
    assert.equal(ctx.tokens[6].type, TT.METER_NUMBER);
    assert.equal(ctx.tokens[6].lexeme, "8");
  });

  it("should handle whitespace correctly", () => {
    const ctx = createTestContext("  4 / 4  ");
    const result = scanMeterInfo(ctx);

    assert.equal(result, true);
    assert.equal(ctx.tokens.length, 3);
    assert.equal(ctx.tokens[0].type, TT.METER_NUMBER);
    assert.equal(ctx.tokens[0].lexeme, "4");
    assert.equal(ctx.tokens[1].type, TT.METER_SEPARATOR);
    assert.equal(ctx.tokens[1].lexeme, "/");
    assert.equal(ctx.tokens[2].type, TT.METER_NUMBER);
    assert.equal(ctx.tokens[2].lexeme, "4");
  });

  it("should handle whitespace in complex meters", () => {
    const ctx = createTestContext("  ( 2 + 3 + 2 ) / 8  ");
    const result = scanMeterInfo(ctx);

    assert.equal(result, true);
    assert.equal(ctx.tokens.length, 9);
    assert.equal(ctx.tokens[0].type, TT.METER_LPAREN);
    assert.equal(ctx.tokens[1].type, TT.METER_NUMBER);
    assert.equal(ctx.tokens[1].lexeme, "2");
    assert.equal(ctx.tokens[2].type, TT.METER_PLUS);
    assert.equal(ctx.tokens[3].type, TT.METER_NUMBER);
    assert.equal(ctx.tokens[3].lexeme, "3");
    assert.equal(ctx.tokens[4].type, TT.METER_PLUS);
    assert.equal(ctx.tokens[5].type, TT.METER_NUMBER);
    assert.equal(ctx.tokens[5].lexeme, "2");
    assert.equal(ctx.tokens[6].type, TT.METER_RPAREN);
    assert.equal(ctx.tokens[7].type, TT.METER_SEPARATOR);
  });

  it("should handle multi-digit numbers", () => {
    const ctx = createTestContext("12/16");
    const result = scanMeterInfo(ctx);

    assert.equal(result, true);
    assert.equal(ctx.tokens.length, 3);
    assert.equal(ctx.tokens[0].type, TT.METER_NUMBER);
    assert.equal(ctx.tokens[0].lexeme, "12");
    assert.equal(ctx.tokens[1].type, TT.METER_SEPARATOR);
    assert.equal(ctx.tokens[1].lexeme, "/");
    assert.equal(ctx.tokens[2].type, TT.METER_NUMBER);
    assert.equal(ctx.tokens[2].lexeme, "16");
  });

  it("should handle empty input", () => {
    const ctx = createTestContext("");
    const result = scanMeterInfo(ctx);

    assert.equal(result, true);
    assert.equal(ctx.tokens.length, 0);
  });

  it("should handle whitespace-only input", () => {
    const ctx = createTestContext("   ");
    const result = scanMeterInfo(ctx);

    assert.equal(result, true);
    assert.equal(ctx.tokens.length, 0);
  });

  it("should handle invalid tokens", () => {
    const ctx = createTestContext("4/4x");
    const result = scanMeterInfo(ctx);

    assert.equal(result, true);
    // Should have 4, /, 4, and then an INVALID token for 'x'
    assert.isTrue(ctx.tokens.length >= 3);
    assert.equal(ctx.tokens[0].type, TT.METER_NUMBER);
    assert.equal(ctx.tokens[0].lexeme, "4");
    assert.equal(ctx.tokens[1].type, TT.METER_SEPARATOR);
    assert.equal(ctx.tokens[1].lexeme, "/");
    assert.equal(ctx.tokens[2].type, TT.METER_NUMBER);
    assert.equal(ctx.tokens[2].lexeme, "4");
    // The invalid token should be present
    const hasInvalidToken = ctx.tokens.some((token) => token.type === TT.INVALID);
    assert.isTrue(hasInvalidToken);
  });

  it("should handle numbers starting with zero (invalid)", () => {
    const ctx = createTestContext("04/4");
    const result = scanMeterInfo(ctx);

    assert.equal(result, true);
    // Should produce an INVALID token since numbers can't start with 0
    const hasInvalidToken = ctx.tokens.some((token) => token.type === TT.INVALID);
    assert.isTrue(hasInvalidToken);
  });

  it("should handle complex real-world examples", () => {
    const ctx = createTestContext("(3+2+3)/8");
    const result = scanMeterInfo(ctx);

    assert.equal(result, true);
    assert.equal(ctx.tokens.length, 9);

    const expectedTokens = [
      { type: TT.METER_LPAREN, lexeme: "(" },
      { type: TT.METER_NUMBER, lexeme: "3" },
      { type: TT.METER_PLUS, lexeme: "+" },
      { type: TT.METER_NUMBER, lexeme: "2" },
      { type: TT.METER_PLUS, lexeme: "+" },
      { type: TT.METER_NUMBER, lexeme: "3" },
      { type: TT.METER_RPAREN, lexeme: ")" },
      { type: TT.METER_SEPARATOR, lexeme: "/" },
      { type: TT.METER_NUMBER, lexeme: "8" },
    ];

    expectedTokens.forEach((expected, i) => {
      assert.equal(ctx.tokens[i].type, expected.type);
      assert.equal(ctx.tokens[i].lexeme, expected.lexeme);
    });
  });

  it("should handle comments at the end", () => {
    const ctx = createTestContext("4/4 % this is a comment");
    const result = scanMeterInfo(ctx);

    assert.equal(result, true);
    // Should have meter tokens plus a comment token
    assert.isTrue(ctx.tokens.length >= 3);
    assert.equal(ctx.tokens[0].type, TT.METER_NUMBER);
    assert.equal(ctx.tokens[0].lexeme, "4");
    assert.equal(ctx.tokens[1].type, TT.METER_SEPARATOR);
    assert.equal(ctx.tokens[1].lexeme, "/");
    assert.equal(ctx.tokens[2].type, TT.METER_NUMBER);
    assert.equal(ctx.tokens[2].lexeme, "4");

    // Should have a comment token
    const hasCommentToken = ctx.tokens.some((token) => token.type === TT.COMMENT);
    assert.isTrue(hasCommentToken);
  });
});

// Meter component generators
const genMeterNumber = fc.integer({ min: 1, max: 32 }).map((n) => new Token(TT.METER_NUMBER, n.toString(), sharedContext.generateId()));

const genMeterC = fc.constantFrom("C").map((c) => new Token(TT.METER_C, c, sharedContext.generateId()));

const genMeterCBar = fc.constantFrom("C|").map((cb) => new Token(TT.METER_C_BAR, cb, sharedContext.generateId()));

const genMeterSeparator = fc.constantFrom("/").map((sep) => new Token(TT.METER_SEPARATOR, sep, sharedContext.generateId()));

const genMeterPlus = fc.constantFrom("+").map((plus) => new Token(TT.METER_PLUS, plus, sharedContext.generateId()));

const genMeterLParen = fc.constantFrom("(").map((lp) => new Token(TT.METER_LPAREN, lp, sharedContext.generateId()));

const genMeterRParen = fc.constantFrom(")").map((rp) => new Token(TT.METER_RPAREN, rp, sharedContext.generateId()));

const genMeterWhitespace = fc.stringMatching(/^[ \t]+$/).map((ws) => new Token(TT.WS, ws, sharedContext.generateId()));

// Simple meter generator (numerator/denominator)
const genSimpleMeter = fc
  .tuple(
    fc.option(genMeterWhitespace),
    genMeterNumber,
    fc.option(genMeterWhitespace),
    genMeterSeparator,
    fc.option(genMeterWhitespace),
    genMeterNumber,
    fc.option(genMeterWhitespace)
  )
  .map(([leadingWs, num1, ws1, sep, ws2, num2, trailingWs]) => {
    const tokens: Token[] = [];
    if (leadingWs) tokens.push(leadingWs);
    tokens.push(num1);
    if (ws1) tokens.push(ws1);
    tokens.push(sep);
    if (ws2) tokens.push(ws2);
    tokens.push(num2);
    if (trailingWs) tokens.push(trailingWs);
    return tokens;
  });

// Complete meter definition generator (simplified, no compound meters for integration tests)
export const genMeterDefinition = fc.oneof(
  // Common time
  fc.tuple(fc.option(genMeterWhitespace), genMeterC, fc.option(genMeterWhitespace)).map(([leadingWs, c, trailingWs]) => {
    const tokens: Token[] = [];
    if (leadingWs) tokens.push(leadingWs);
    tokens.push(c);
    if (trailingWs) tokens.push(trailingWs);
    return tokens;
  }),

  // Cut time
  fc.tuple(fc.option(genMeterWhitespace), genMeterCBar, fc.option(genMeterWhitespace)).map(([leadingWs, cb, trailingWs]) => {
    const tokens: Token[] = [];
    if (leadingWs) tokens.push(leadingWs);
    tokens.push(cb);
    if (trailingWs) tokens.push(trailingWs);
    return tokens;
  }),

  // Simple meters
  genSimpleMeter
);

describe("scanMeterInfo Property-Based Tests", () => {
  // Complex meter generator (with parentheses and addition) - kept for existing tests
  const genComplexMeter = fc
    .tuple(
      fc.option(genMeterWhitespace),
      fc.option(genMeterLParen),
      genMeterNumber,
      fc.array(fc.tuple(fc.option(genMeterWhitespace), genMeterPlus, fc.option(genMeterWhitespace), genMeterNumber), { minLength: 1, maxLength: 3 }),
      fc.option(genMeterRParen),
      fc.option(genMeterWhitespace),
      genMeterSeparator,
      fc.option(genMeterWhitespace),
      genMeterNumber,
      fc.option(genMeterWhitespace)
    )
    .map(([leadingWs, lparen, firstNum, additions, rparen, ws1, sep, ws2, denominator, trailingWs]) => {
      const tokens: Token[] = [];
      if (leadingWs) tokens.push(leadingWs);
      if (lparen) tokens.push(lparen);
      tokens.push(firstNum);

      for (const [ws3, plus, ws4, num] of additions) {
        if (ws3) tokens.push(ws3);
        tokens.push(plus);
        if (ws4) tokens.push(ws4);
        tokens.push(num);
      }

      if (rparen) tokens.push(rparen);
      if (ws1) tokens.push(ws1);
      tokens.push(sep);
      if (ws2) tokens.push(ws2);
      tokens.push(denominator);
      if (trailingWs) tokens.push(trailingWs);
      return tokens;
    });

  // Complete meter definition generator including complex meters for internal tests
  const genFullMeterDefinition = fc.oneof(
    // Common time
    fc.tuple(fc.option(genMeterWhitespace), genMeterC, fc.option(genMeterWhitespace)).map(([leadingWs, c, trailingWs]) => {
      const tokens: Token[] = [];
      if (leadingWs) tokens.push(leadingWs);
      tokens.push(c);
      if (trailingWs) tokens.push(trailingWs);
      return tokens;
    }),

    // Cut time
    fc.tuple(fc.option(genMeterWhitespace), genMeterCBar, fc.option(genMeterWhitespace)).map(([leadingWs, cb, trailingWs]) => {
      const tokens: Token[] = [];
      if (leadingWs) tokens.push(leadingWs);
      tokens.push(cb);
      if (trailingWs) tokens.push(trailingWs);
      return tokens;
    }),

    // Simple meters
    genSimpleMeter,

    // Complex meters
    genComplexMeter
  );

  function createRoundTripPredicate(tokens: Token[]): boolean {
    // Convert tokens to string
    const input = tokens.map((t) => t.lexeme).join("");

    // Skip empty inputs
    if (input.trim() === "") return true;

    // Scan the input
    const ctx = createTestContext(input);
    const result = scanMeterInfo(ctx);

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

  it("should produce equivalent tokens when rescanning meter definitions", () => {
    fc.assert(fc.property(genMeterDefinition, createRoundTripPredicate), {
      verbose: false,
      numRuns: 1000,
    });
  });

  it("should always succeed on valid meter patterns", () => {
    fc.assert(
      fc.property(genMeterDefinition, (tokens) => {
        const input = tokens.map((t) => t.lexeme).join("");
        if (input.trim() === "") return true;

        const ctx = createTestContext(input);
        const result = scanMeterInfo(ctx);

        return result === true;
      }),
      {
        verbose: false,
        numRuns: 1000,
      }
    );
  });

  it("should handle various number ranges correctly", () => {
    const genNumberTest = fc.tuple(fc.integer({ min: 1, max: 99 }), fc.integer({ min: 1, max: 32 }));

    fc.assert(
      fc.property(genNumberTest, ([numerator, denominator]) => {
        const input = `${numerator}/${denominator}`;
        const ctx = createTestContext(input);
        const result = scanMeterInfo(ctx);

        return (
          result === true &&
          ctx.tokens.length === 3 &&
          ctx.tokens[0].type === TT.METER_NUMBER &&
          ctx.tokens[0].lexeme === numerator.toString() &&
          ctx.tokens[1].type === TT.METER_SEPARATOR &&
          ctx.tokens[2].type === TT.METER_NUMBER &&
          ctx.tokens[2].lexeme === denominator.toString()
        );
      }),
      {
        verbose: false,
        numRuns: 500,
      }
    );
  });

  it("should never crash on generated meter definitions", () => {
    fc.assert(
      fc.property(genMeterDefinition, (tokens) => {
        try {
          const input = tokens.map((t) => t.lexeme).join("");
          const ctx = createTestContext(input);
          scanMeterInfo(ctx);
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

  it("should handle whitespace variations correctly", () => {
    const genWhitespaceVariations = fc.tuple(genMeterNumber, genMeterNumber).map(([num1, num2]) => {
      // Generate different whitespace patterns
      return fc.sample(
        fc.oneof(
          // Normal spacing
          fc.constant([num1, new Token(TT.METER_SEPARATOR, "/", sharedContext.generateId()), num2]),
          // Extra spaces
          fc.constant([
            new Token(TT.WS, "  ", sharedContext.generateId()),
            num1,
            new Token(TT.WS, " ", sharedContext.generateId()),
            new Token(TT.METER_SEPARATOR, "/", sharedContext.generateId()),
            new Token(TT.WS, " ", sharedContext.generateId()),
            num2,
            new Token(TT.WS, "  ", sharedContext.generateId()),
          ])
        ),
        1
      )[0];
    });

    fc.assert(
      fc.property(genWhitespaceVariations, (tokens) => {
        const input = tokens.map((t) => t.lexeme).join("");
        const ctx = createTestContext(input);
        const result = scanMeterInfo(ctx);

        // Should successfully parse and produce expected token types
        const nonWhitespaceTokens = ctx.tokens.filter((t) => t.type !== TT.WS);
        return (
          result === true &&
          nonWhitespaceTokens.length === 3 &&
          nonWhitespaceTokens[0].type === TT.METER_NUMBER &&
          nonWhitespaceTokens[1].type === TT.METER_SEPARATOR &&
          nonWhitespaceTokens[2].type === TT.METER_NUMBER
        );
      }),
      {
        verbose: false,
        numRuns: 500,
      }
    );
  });
});
