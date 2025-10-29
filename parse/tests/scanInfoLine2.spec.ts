import { expect } from "chai";
import * as fc from "fast-check";
import { ABCContext } from "../parsers/Context";
import { AbcErrorReporter } from "../parsers/ErrorReporter";
import { scanInfoLine2 } from "../parsers/infoLines/scanInfoLine2";
import { Ctx, TT } from "../parsers/scan2";
import { info_line } from "../parsers/scan2";
import { genInfoLine2, genKeyInfoLine2, genMeterInfoLine2, genNoteLenInfoLine2, genTempoInfoLine2, genGenericInfoLine } from "./scn_infoln_generators";

/**
 * Pretty print token arrays for debugging mismatches
 */
function compareTokenArraysDetailed(
  originalTokens: Array<{ type: number; lexeme: string }>,
  scannedTokens: Array<{ type: number; lexeme: string }>,
  input: string
): boolean {
  // Skip position-related properties in comparison
  const normalizeToken = (token: { type: number; lexeme: string }) => ({
    type: token.type,
    lexeme: token.lexeme,
  });

  // Compare token sequences
  const normalizedOriginal = originalTokens.map(normalizeToken);
  const normalizedScanned = scannedTokens.map(normalizeToken);

  if (normalizedOriginal.length !== normalizedScanned.length) {
    console.log("Token count mismatch:", {
      input,
      original: normalizedOriginal.map((t) => `${TT[t.type]}:${t.lexeme}`),
      scanned: normalizedScanned.map((t) => `${TT[t.type]}:${t.lexeme}`),
      originalCount: normalizedOriginal.length,
      scannedCount: normalizedScanned.length,
    });
    return false;
  }

  // Find the first token that doesn't match
  let firstMismatchIndex = -1;
  for (let i = 0; i < normalizedOriginal.length; i++) {
    const orig = normalizedOriginal[i];
    const scanned = normalizedScanned[i];

    if (orig.type !== scanned.type || orig.lexeme !== scanned.lexeme) {
      firstMismatchIndex = i;
      break;
    }
  }

  if (firstMismatchIndex !== -1) {
    // Show the mismatch with some context (3 tokens before and after)
    const contextStart = Math.max(0, firstMismatchIndex - 3);
    const contextEnd = Math.min(normalizedOriginal.length, firstMismatchIndex + 4);

    console.log("Token mismatch at position", firstMismatchIndex);
    console.log("Input string:", input);

    console.log("Original tokens (with context):");
    for (let i = contextStart; i < contextEnd; i++) {
      const t = normalizedOriginal[i];
      const marker = i === firstMismatchIndex ? ">>> " : "    ";
      console.log(`${marker}[${i}] ${TT[t.type]}: "${t.lexeme}"`);
    }

    console.log("Scanned tokens (with context):");
    const scannedContextEnd = Math.min(normalizedScanned.length, firstMismatchIndex + 4);
    for (let i = contextStart; i < scannedContextEnd; i++) {
      const t = normalizedScanned[i];
      const marker = i === firstMismatchIndex ? ">>> " : "    ";
      console.log(`${marker}[${i}] ${TT[t.type]}: "${t.lexeme}"`);
    }

    return false;
  }

  return true;
}

describe("scanInfoLine2 - Unified Info Line Scanner", () => {
  let context: ABCContext;

  beforeEach(() => {
    context = new ABCContext(new AbcErrorReporter());
  });

  describe("Basic token recognition", () => {
    it("should scan identifiers correctly", () => {
      fc.assert(
        fc.property(fc.constantFrom("K:treble", "K:major", "K:clef", "K:transpose"), (input) => {
          const ctx = new Ctx(input, context);
          const result = scanInfoLine2(ctx);

          expect(result).to.be.true;
          expect(ctx.tokens.length).greaterThan(1);
          expect(ctx.tokens[0].type).to.equal(TT.INF_HDR);
          expect(ctx.tokens[0].lexeme).to.equal("K:");
          expect(ctx.tokens[1].type).to.equal(TT.IDENTIFIER);
          expect(["treble", "major", "clef", "transpose"]).contain(ctx.tokens[1].lexeme);
        })
      );
    });

    it("should scan numbers correctly", () => {
      fc.assert(
        fc.property(fc.constantFrom("M:4", "L:1", "Q:120"), (input) => {
          const ctx = new Ctx(input, context);
          const result = scanInfoLine2(ctx);

          expect(result).to.be.true;
          expect(ctx.tokens.length).greaterThan(1);
          expect(ctx.tokens[0].type).to.equal(TT.INF_HDR);
          expect(ctx.tokens[1].type).to.equal(TT.NUMBER);
          expect(["4", "1", "120"]).contain(ctx.tokens[1].lexeme);
        })
      );
    });

    it("should scan string literals correctly", () => {
      fc.assert(
        fc.property(fc.constantFrom('Q:"Allegro"', 'V:"Tenor 1"'), (input) => {
          const ctx = new Ctx(input, context);
          const result = scanInfoLine2(ctx);

          expect(result).to.be.true;
          expect(ctx.tokens.length).greaterThan(1);
          expect(ctx.tokens[0].type).to.equal(TT.INF_HDR);
          expect(ctx.tokens[1].type).to.equal(TT.ANNOTATION);
          expect(['"Allegro"', '"Tenor 1"']).contain(ctx.tokens[1].lexeme);
        })
      );
    });

    it("should scan special literals correctly", () => {
      fc.assert(
        fc.property(fc.constantFrom("M:C", "M:C|"), (input) => {
          const ctx = new Ctx(input, context);
          const result = scanInfoLine2(ctx);

          expect(ctx.tokens[0].type).to.equal(TT.INF_HDR);
          expect(ctx.tokens[1].type).to.equal(TT.SPECIAL_LITERAL);
          expect(["C", "C|"]).contain(ctx.tokens[1].lexeme);
        })
      );
    });

    it("should scan punctuation correctly", () => {
      fc.assert(
        fc.property(fc.constantFrom("K:clef=treble", "M:(2+3)/8", "L:1/4"), (input) => {
          const ctx = new Ctx(input, context);
          const result = scanInfoLine2(ctx);

          expect(result).to.be.true;
          const punctuationTypes = ctx.tokens.filter((t) => [TT.EQL, TT.PLUS, TT.SLASH, TT.LPAREN, TT.RPAREN].includes(t.type)).map((t) => t.type);

          expect(punctuationTypes.length).greaterThan(0);
        })
      );
    });
  });

  describe("Specific scanner failure cases", () => {
    it("should correctly scan tempo line Q:A0=1 with absolute pitch", () => {
      const ctx = new Ctx("Q:A0=1\t", context);
      const result = scanInfoLine2(ctx);

      expect(result).to.be.true;
      expect(ctx.tokens.length).to.equal(6);

      // Verify exact token sequence
      expect(ctx.tokens[0].type).to.equal(TT.INF_HDR);
      expect(ctx.tokens[0].lexeme).to.equal("Q:");

      expect(ctx.tokens[1].type).to.equal(TT.NOTE_LETTER);
      expect(ctx.tokens[1].lexeme).to.equal("A");

      expect(ctx.tokens[2].type).to.equal(TT.NUMBER);
      expect(ctx.tokens[2].lexeme).to.equal("0");

      expect(ctx.tokens[3].type).to.equal(TT.EQL);
      expect(ctx.tokens[3].lexeme).to.equal("=");

      expect(ctx.tokens[4].type).to.equal(TT.NUMBER);
      expect(ctx.tokens[4].lexeme).to.equal("1");

      expect(ctx.tokens[5].type).to.equal(TT.WS);
      expect(ctx.tokens[5].lexeme).to.equal("\t");
    });

    it("should correctly scan voice line V:LH clef=bass octave=-2", () => {
      const ctx = new Ctx("V:LH clef=bass octave=-2", context);
      const result = scanInfoLine2(ctx);

      expect(result).to.be.true;

      // Verify exact token sequence
      expect(ctx.tokens[0].type).to.equal(TT.INF_HDR);
      expect(ctx.tokens[0].lexeme).to.equal("V:");

      expect(ctx.tokens[1].type).to.equal(TT.IDENTIFIER);
      expect(ctx.tokens[1].lexeme).to.equal("LH");

      expect(ctx.tokens[2].type).to.equal(TT.WS);
      expect(ctx.tokens[2].lexeme).to.equal(" ");

      expect(ctx.tokens[3].type).to.equal(TT.IDENTIFIER);
      expect(ctx.tokens[3].lexeme).to.equal("clef");

      expect(ctx.tokens[4].type).to.equal(TT.EQL);
      expect(ctx.tokens[4].lexeme).to.equal("=");

      expect(ctx.tokens[5].type).to.equal(TT.IDENTIFIER);
      expect(ctx.tokens[5].lexeme).to.equal("bass");

      expect(ctx.tokens[6].type).to.equal(TT.WS);
      expect(ctx.tokens[6].lexeme).to.equal(" ");

      expect(ctx.tokens[7].type).to.equal(TT.IDENTIFIER);
      expect(ctx.tokens[7].lexeme).to.equal("octave");

      expect(ctx.tokens[8].type).to.equal(TT.EQL);
      expect(ctx.tokens[8].lexeme).to.equal("=");

      expect(ctx.tokens[9].type).to.equal(TT.MINUS);
      expect(ctx.tokens[9].lexeme).to.equal("-");
      expect(ctx.tokens[10].type).to.equal(TT.NUMBER);
      expect(ctx.tokens[10].lexeme).to.equal("2");
    });
  });

  describe("Round-trip testing with generated data", () => {
    it("should handle key info lines", () => {
      fc.assert(
        fc.property(genKeyInfoLine2, (tokens) => {
          const source = tokens.map((t) => t.lexeme).join("");
          const ctx = new Ctx(source, context);
          const result = scanInfoLine2(ctx);

          expect(result).to.be.true;

          // Use detailed comparison for debugging
          if (ctx.tokens.length !== tokens.length) {
            const source = tokens.map((t) => t.lexeme).join("");
            compareTokenArraysDetailed(tokens, ctx.tokens, source);
            throw new Error(`Token count mismatch: expected ${tokens.length}, got ${ctx.tokens.length}`);
          }

          // Check for token type/content mismatches
          const mismatchExists = !tokens.every((expectedToken, i) => {
            const actualToken = ctx.tokens[i];
            return expectedToken.type === actualToken.type && expectedToken.lexeme === actualToken.lexeme;
          });

          if (mismatchExists) {
            const source = tokens.map((t) => t.lexeme).join("");
            compareTokenArraysDetailed(tokens, ctx.tokens, source);
          }

          expect(ctx.tokens.length).to.equal(tokens.length);
          expect(ctx.tokens[0].type).to.equal(TT.INF_HDR);
          expect(ctx.tokens[0].lexeme).to.equal("K:");
        })
      );
    });

    it("should handle meter info lines", () => {
      fc.assert(
        fc.property(genMeterInfoLine2, (tokens) => {
          const source = tokens.map((t) => t.lexeme).join("");
          const ctx = new Ctx(source, context);
          const result = scanInfoLine2(ctx);

          expect(result).to.be.true;

          // Use detailed comparison for debugging
          if (ctx.tokens.length !== tokens.length) {
            const source = tokens.map((t) => t.lexeme).join("");
            compareTokenArraysDetailed(tokens, ctx.tokens, source);
            throw new Error(`Token count mismatch: expected ${tokens.length}, got ${ctx.tokens.length}`);
          }

          // Check for token type/content mismatches
          const mismatchExists = !tokens.every((expectedToken, i) => {
            const actualToken = ctx.tokens[i];
            return expectedToken.type === actualToken.type && expectedToken.lexeme === actualToken.lexeme;
          });

          if (mismatchExists) {
            const source = tokens.map((t) => t.lexeme).join("");
            compareTokenArraysDetailed(tokens, ctx.tokens, source);
          }

          expect(ctx.tokens.length).to.equal(tokens.length);
          expect(ctx.tokens[0].type).to.equal(TT.INF_HDR);
          expect(ctx.tokens[0].lexeme).to.equal("M:");
        })
      );
    });

    it("should handle note length info lines", () => {
      fc.assert(
        fc.property(genNoteLenInfoLine2, (tokens) => {
          const source = tokens.map((t) => t.lexeme).join("");
          const ctx = new Ctx(source, context);
          const result = scanInfoLine2(ctx);

          expect(result).to.be.true;

          // Use detailed comparison for debugging
          if (ctx.tokens.length !== tokens.length) {
            const source = tokens.map((t) => t.lexeme).join("");
            compareTokenArraysDetailed(tokens, ctx.tokens, source);
            throw new Error(`Token count mismatch: expected ${tokens.length}, got ${ctx.tokens.length}`);
          }

          // Check for token type/content mismatches
          const mismatchExists = !tokens.every((expectedToken, i) => {
            const actualToken = ctx.tokens[i];
            return expectedToken.type === actualToken.type && expectedToken.lexeme === actualToken.lexeme;
          });

          if (mismatchExists) {
            const source = tokens.map((t) => t.lexeme).join("");
            compareTokenArraysDetailed(tokens, ctx.tokens, source);
          }

          expect(ctx.tokens.length).to.equal(tokens.length);
          expect(ctx.tokens[0].type).to.equal(TT.INF_HDR);
          expect(ctx.tokens[0].lexeme).to.equal("L:");
        })
      );
    });

    it("should handle tempo info lines", () => {
      fc.assert(
        fc.property(genTempoInfoLine2, (tokens) => {
          const source = tokens.map((t) => t.lexeme).join("");
          const ctx = new Ctx(source, context);
          const result = scanInfoLine2(ctx);

          expect(result).to.be.true;

          // Use detailed comparison for debugging
          if (ctx.tokens.length !== tokens.length) {
            const source = tokens.map((t) => t.lexeme).join("");
            compareTokenArraysDetailed(tokens, ctx.tokens, source);
            throw new Error(`Token count mismatch: expected ${tokens.length}, got ${ctx.tokens.length}`);
          }

          // Check for token type/content mismatches
          const mismatchExists = !tokens.every((expectedToken, i) => {
            const actualToken = ctx.tokens[i];
            return expectedToken.type === actualToken.type && expectedToken.lexeme === actualToken.lexeme;
          });

          if (mismatchExists) {
            const source = tokens.map((t) => t.lexeme).join("");
            compareTokenArraysDetailed(tokens, ctx.tokens, source);
          }

          expect(ctx.tokens.length).to.equal(tokens.length);
          expect(ctx.tokens[0].type).to.equal(TT.INF_HDR);
          expect(ctx.tokens[0].lexeme).to.equal("Q:");
        })
      );
    });

    it("should handle generic info lines", () => {
      fc.assert(
        fc.property(genGenericInfoLine, (tokens) => {
          const source = "\n" + tokens.map((t) => t.lexeme).join(""); // Add newline prefix since info_line expects to be preceded by EOL
          const ctx = new Ctx(source, context);
          // Simulate that we've already processed the EOL token by adding it to ctx.tokens
          ctx.push(TT.EOL);
          ctx.start = 1; // Skip the newline we added
          ctx.current = 1; // Skip the newline we added
          const result = info_line(ctx);

          expect(result).to.be.true;
          // We expect tokens.length + 1 because of the EOL we added
          expect(ctx.tokens.length).to.equal(tokens.length + 1);
          expect(ctx.tokens[1].type).to.equal(TT.INF_HDR); // Second token after EOL
          expect(ctx.tokens[2].type).to.equal(TT.INFO_STR);
        })
      );
    });

    it("should handle all info line types with unified generator", () => {
      fc.assert(
        fc.property(genInfoLine2, (tokens) => {
          // genInfoLine2 now generates [EOL, ...infoLineTokens, EOL]
          // Extract just the info line part (skip first and last EOL)
          const infoLineTokens = tokens.slice(1, -1);
          const source = "\n" + infoLineTokens.map((t) => t.lexeme).join("");

          const ctx = new Ctx(source, context);
          // Simulate that we've already processed the EOL token
          ctx.push(TT.EOL);
          ctx.start = 1; // Skip the newline we added
          ctx.current = 1; // Skip the newline we added

          // Use info_line which dispatches to the correct scanner
          const result = info_line(ctx);

          if (!result) {
            console.log("info_line returned false for input:", source);
            console.log(
              "Generated tokens:",
              tokens.map((t) => `${TT[t.type]}:"${t.lexeme}"`)
            );
            console.log(
              "Info line tokens:",
              infoLineTokens.map((t) => `${TT[t.type]}:"${t.lexeme}"`)
            );
          }

          expect(result).to.be.true;

          // Use detailed comparison for debugging
          if (ctx.tokens.length !== infoLineTokens.length + 1) {
            compareTokenArraysDetailed(infoLineTokens, ctx.tokens.slice(1), source); // Skip the first EOL we added
            throw new Error(`Token count mismatch: expected ${infoLineTokens.length + 1}, got ${ctx.tokens.length}`);
          }

          // Check for token type/content mismatches (skip the first EOL we added)
          const actualInfoTokens = ctx.tokens.slice(1);
          const mismatchExists = !infoLineTokens.every((expectedToken, i) => {
            const actualToken = actualInfoTokens[i];
            return expectedToken.type === actualToken.type && expectedToken.lexeme === actualToken.lexeme;
          });

          if (mismatchExists) {
            compareTokenArraysDetailed(infoLineTokens, actualInfoTokens, source);
          }

          expect(ctx.tokens.length).to.equal(infoLineTokens.length + 1); // +1 for the EOL we added
          expect(ctx.tokens[1].type).to.equal(TT.INF_HDR); // Second token after EOL

          // Verify the header matches known info line types
          const header = ctx.tokens[1].lexeme;
          const validHeaders = ["K:", "M:", "L:", "Q:", "T:", "A:", "C:", "O:", "P:", "S:", "W:", "N:", "G:", "H:", "R:", "B:", "D:", "F:", "I:", "Z:"];
          expect(validHeaders).to.include(header);
        })
      );
    });
  });

  describe("Error handling", () => {
    it("should handle invalid tokens gracefully", () => {
      const invalidInputs = [
        "K:@#$",
        "L:0/4", // Number starting with 0 should be invalid
        'Q:"unclosed string',
      ];

      invalidInputs.forEach((input) => {
        const ctx = new Ctx(input, context);
        const result = scanInfoLine2(ctx);
        // Should not throw, should produce some tokens including possibly INVALID tokens
        expect(result).to.be.true;
        expect(ctx.tokens.length).greaterThan(0);
        expect(ctx.tokens[0].type).to.equal(TT.INF_HDR);
      });
    });
  });

  describe("Special cases", () => {
    it("should distinguish C from C| correctly", () => {
      const inputC = "M:C ";
      const inputCBar = "M:C| ";

      const ctxC = new Ctx(inputC, context);
      const ctxCBar = new Ctx(inputCBar, context);

      const resultC = scanInfoLine2(ctxC);
      const resultCBar = scanInfoLine2(ctxCBar);

      expect(resultC).to.be.true;
      expect(resultCBar).to.be.true;
      expect(ctxC.tokens[1].lexeme).to.equal("C");
      expect(ctxCBar.tokens[1].lexeme).to.equal("C|");
    });

    it("should handle comments after info lines", () => {
      const input = "K:C major % this is a comment";
      const ctx = new Ctx(input, context);
      const result = scanInfoLine2(ctx);

      expect(result).to.be.true;
      // Note: Comments are handled by the main scanner, not scanInfoLine2
      // scanInfoLine2 should stop at the % character
      const lastToken = ctx.tokens[ctx.tokens.length - 1];
      expect(lastToken.lexeme).to.not.contain("%");
    });

    it("should stop at end of line", () => {
      const input = "K:C major\nM:4/4";
      const ctx = new Ctx(input, context);
      const result = scanInfoLine2(ctx);

      expect(result).to.be.true;
      // scanInfoLine2 should only process the first line
      const tokens = ctx.tokens;
      expect(tokens[0].type).to.equal(TT.INF_HDR);
      expect(tokens[0].lexeme).to.equal("K:");
      // Should not contain tokens from the second line
      const hasSecondInfoHeader = tokens.some((t) => t.lexeme === "M:");
      expect(hasSecondInfoHeader).to.be.false;
    });
  });
});
