import * as fc from "fast-check";
import { ABCContext } from "../parsers/Context";
import { Ctx, Scanner2, Token, TT } from "../parsers/scan2";
import { pDuration, pitch, pPitch, scanTune } from "../parsers/scan_tunebody";
import { genTokenSequence } from "./scan2_pbt.generators.spec";

describe("Scanner Property Tests", () => {
  // Arbitrary generators for ABC notation components
  const genInfoLine = fc
    .record({
      key: fc.constantFrom("T", "C", "M", "L", "K"),
      value: fc.string().filter((s) => !s.includes("\n")),
    })
    .map(({ key, value }) => `${key}:${value}`);

  const genComment = fc
    .string()
    .filter((s) => !s.includes("\n"))
    .map((s) => `%${s}`);

  const genDirective = fc
    .string()
    .filter((s) => !s.includes("\n"))
    .map((s) => `%%${s}`);

  const genTuneHeader = fc.nat().map((n) => `X:${n}`);

  // Generate a valid file header section
  const genFileHeader = fc.array(fc.oneof(genInfoLine, genComment, genDirective)).map((lines) => lines.join("\n"));

  // Generate a valid tune section
  const genTuneSection = fc
    .record({
      header: genTuneHeader,
      content: fc.array(fc.oneof(genInfoLine, genComment, genDirective)),
    })
    .map(({ header, content }) => [header, ...content].join("\n"));

  // Generate a complete ABC file
  const genAbcFile = fc
    .record({
      header: genFileHeader,
      tunes: fc.array(genTuneSection),
    })
    .map(({ header, tunes }) => [header, ...tunes].join("\n\n"));

  it("should preserve structural integrity", () => {
    fc.assert(
      fc.property(genAbcFile, (input) => {
        const ctx = new ABCContext();
        const tokens = Scanner2(input, ctx);
        // Property 1: Every section break should correspond to double newlines in input
        const sectionBreaks = tokens.filter((t) => t.type === TT.SCT_BRK);
        const inputBreaks = (input.match(/\n\n/g) || []).length;
        return sectionBreaks.length === inputBreaks;
      }),
      { verbose: true } // Enable verbose mode
    );
  });

  it("should maintain token position integrity", () => {
    fc.assert(
      fc.property(genAbcFile, (input) => {
        const ctx = new ABCContext();
        const tokens = Scanner2(input, ctx);

        // Property 2: Tokens should be sequential and non-overlapping
        for (let i = 0; i < tokens.length - 1; i++) {
          const current = tokens[i];
          if (current.type === TT.EOL || current.type === TT.SCT_BRK || current.type === TT.EOF) {
            return true;
          }
          const next = tokens[i + 1];
          if (current.line > next.line) {
            return false;
          }

          // Current token's end should not exceed next token's start
          if (current.line === next.line && current.position + current.lexeme.length - 1 > next.position) {
            return false;
          }
        }
        return true;
      }),
      { verbose: true }
    );
  });

  it("should properly identify tune sections", () => {
    fc.assert(
      fc.property(genAbcFile, (input) => {
        const ctx = new ABCContext();
        const tokens = Scanner2(input, ctx);

        // Property 3: Every X: line should start a new tune section
        const tuneHeaders = tokens.filter((t) => t.type === TT.INF_HDR && t.lexeme.startsWith("X:"));

        const expectedTuneCount = (input.match(/^X:\d+/gm) || []).length;
        return tuneHeaders.length === expectedTuneCount;
      })
    );
  });

  it("should never crash on valid input", () => {
    fc.assert(
      fc.property(genAbcFile, (input) => {
        try {
          const ctx = new ABCContext();
          Scanner2(input, ctx);
          return true;
        } catch (e) {
          return false;
        }
      })
    );
  });
});

describe("gen scan from regex", () => {
  const genNote = fc.stringMatching(new RegExp(`^${pPitch.source}(${pDuration.source})?`));
  const genRhythm = fc.stringMatching(new RegExp(`^${pDuration.source}$`));
  it("PBT - pitch", () => {
    const genPitch = fc.stringMatching(new RegExp(`^${pPitch.source}$`));
    fc.assert(
      fc.property(genPitch, (pitchStr) => {
        const ctx = new Ctx(pitchStr, new ABCContext());
        const result = pitch(ctx);
        if (!result) {
          return false;
        }
        if (ctx.tokens.length > 3) return false;
        const token = ctx.tokens.find((token) => token.type === TT.NOTE_LETTER);
        if (token === undefined) return false;
        if (!pitchStr.includes(token.lexeme)) {
          return false;
        }
        return true;
      }),
      { verbose: true }
    );
  });
});
describe("Scanner Round-trip Tests", () => {
  // Basic token generators

  it("should produce equivalent tokens when rescanning concatenated lexemes", () => {
    fc.assert(
      fc.property(genTokenSequence, (originalTokens) => {
        // Define interfaces for token types
        interface TokenLike {
          type: number;
          lexeme: string;
        }

        interface NormalizedToken {
          type: number;
          lexeme: string;
        }

        function trimTokens(tokens: Array<Token>) {
          let i = 0;
          while (i < tokens.length && (tokens[i].type === TT.EOL || tokens[i].type === TT.WS)) i++;
          return tokens.slice(i);
        }
        const trimmedTokens = trimTokens(originalTokens);
        // Concatenate lexemes
        const input = ["X:1\n", ...trimmedTokens.map((t) => (t as TokenLike).lexeme)].join("");

        // Rescan
        const ctx = new Ctx(input, new ABCContext());
        scanTune(ctx);
        const rescannedTokens = ctx.tokens.slice(3);

        // Skip position-related properties in comparison
        const normalizeToken = (token: TokenLike): NormalizedToken => ({
          type: token.type,
          lexeme: token.lexeme,
        });

        // Compare token sequences
        const normalizedOriginal = trimmedTokens.map((t) => normalizeToken(t as TokenLike));
        const normalizedRescanned = rescannedTokens
          .filter((t) => t.type !== TT.EOF) // Exclude EOF token
          .map(normalizeToken);

        if (normalizedOriginal.length !== normalizedRescanned.length) {
          compareTokenArrays(trimmedTokens, rescannedTokens, input);
          console.log("Token count mismatch:", {
            input,
            original: normalizedOriginal,
            rescanned: normalizedRescanned,
          });
          return false;
        }

        const isEqual = normalizedOriginal.every((orig, i) => {
          const rescanned = normalizedRescanned[i];
          return orig.type === rescanned.type && orig.lexeme === rescanned.lexeme;
        });

        if (!isEqual) {
          compareTokenArrays(trimmedTokens, rescannedTokens, input);
          console.log("Token mismatch:", {
            input,
            original: normalizedOriginal,
            rescanned: normalizedRescanned,
          });
        }

        return isEqual;
      }),
      {
        verbose: false,
        numRuns: 10000,
      }
    );
  });
});

/**
 * Compares two arrays of tokens and returns true if they match.
 * Logs detailed diagnostic information for mismatches.
 */
function compareTokenArrays(
  originalTokens: Array<{ type: number; lexeme: string }>,
  rescannedTokens: Array<{ type: number; lexeme: string }>,
  input: string
): boolean {
  // Skip position-related properties in comparison
  const normalizeToken = (token: { type: number; lexeme: string }) => ({
    type: token.type,
    lexeme: token.lexeme,
  });

  // Compare token sequences
  const normalizedOriginal = originalTokens.map(normalizeToken);
  const normalizedRescanned = rescannedTokens
    .filter((t) => t.type !== TT.EOF) // Exclude EOF token
    .map(normalizeToken);

  if (normalizedOriginal.length !== normalizedRescanned.length) {
    console.log("Token count mismatch:", {
      input,
      original: normalizedOriginal.map((t) => `${TT[t.type]}:${t.lexeme}`),
      rescanned: normalizedRescanned.map((t) => `${TT[t.type]}:${t.lexeme}`),
      originalCount: normalizedOriginal.length,
      rescannedCount: normalizedRescanned.length,
    });
    return false;
  }

  // Find the first token that doesn't match
  let firstMismatchIndex = -1;
  for (let i = 0; i < normalizedOriginal.length; i++) {
    const orig = normalizedOriginal[i];
    const rescanned = normalizedRescanned[i];

    if (orig.type !== rescanned.type || orig.lexeme !== rescanned.lexeme) {
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

    console.log("Rescanned tokens (with context):");
    const rescannedContextEnd = Math.min(normalizedRescanned.length, firstMismatchIndex + 4);
    for (let i = contextStart; i < rescannedContextEnd; i++) {
      const t = normalizedRescanned[i];
      const marker = i === firstMismatchIndex ? ">>> " : "    ";
      console.log(`${marker}[${i}] ${TT[t.type]}: "${t.lexeme}"`);
    }

    return false;
  }

  return true;
}
