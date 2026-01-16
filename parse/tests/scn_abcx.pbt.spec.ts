/**
 * ABCx Scanner Property-Based Tests
 *
 * Tests the ABCx scanner using property-based testing.
 * Follows the same pattern as scn_pbt.spec.ts.
 *
 * Focus: Tests ONLY the new CHORD_SYMBOL token type.
 * All other token types (barlines, annotations, etc.) are tested in scn_pbt.spec.ts.
 */

import * as fc from "fast-check";
import { expect } from "chai";
import { ABCContext } from "../parsers/Context";
import { ScannerAbcx } from "../parsers/scan_abcx_tunebody";
import { Token, TT } from "../parsers/scan2";
import {
  genChordSymbolToken,
  genAbcxTokenSequence,
} from "./scn_abcx.generators.spec";

/**
 * ABCx-specific round-trip predicate.
 * Similar to createRoundTripPredicate but uses ScannerAbcx instead of scanTune.
 * This is necessary because CHORD_SYMBOL tokens are only valid in ABCx context.
 */
function createAbcxRoundTripPredicate(originalTokens: Token[]): boolean {
  // Trim leading whitespace/EOL tokens
  let i = 0;
  while (i < originalTokens.length && (originalTokens[i].type === TT.EOL || originalTokens[i].type === TT.WS)) {
    i++;
  }
  const trimmedTokens = originalTokens.slice(i);

  if (trimmedTokens.length === 0) return true;

  // Concatenate lexemes into a string with ABCx header
  const input = `X:1\nK:C\n${trimmedTokens.map((t) => t.lexeme).join("")}`;

  // Re-scan using ABCx scanner
  const ctx = new ABCContext();
  const rescannedTokens = ScannerAbcx(input, ctx);

  // Find where body starts (after K: line's EOL)
  const kLineIndex = rescannedTokens.findIndex(
    (t) => t.type === TT.INF_HDR && t.lexeme === "K:"
  );
  if (kLineIndex === -1) return true;

  let bodyStart = kLineIndex;
  while (bodyStart < rescannedTokens.length && rescannedTokens[bodyStart].type !== TT.EOL) {
    bodyStart++;
  }
  bodyStart++; // Skip the EOL itself

  const bodyTokens = rescannedTokens.slice(bodyStart);

  // Normalize tokens for comparison (ignore positions, whitespace, EOL, EOF)
  const normalizeToken = (t: Token) => ({ type: t.type, lexeme: t.lexeme });
  const filterToken = (t: Token) => t.type !== TT.WS && t.type !== TT.EOL && t.type !== TT.EOF && t.type !== TT.DISCARD;

  const normalizedOriginal = trimmedTokens.filter(filterToken).map(normalizeToken);
  const normalizedRescanned = bodyTokens.filter(filterToken).map(normalizeToken);

  if (normalizedOriginal.length !== normalizedRescanned.length) {
    return false;
  }

  return normalizedOriginal.every((orig, idx) => {
    const rescanned = normalizedRescanned[idx];
    return orig.type === rescanned.type && orig.lexeme === rescanned.lexeme;
  });
}

describe("ABCx Scanner Property Tests", () => {
  /**
   * Generate ABCx file string from tokens for scanning
   */
  const genAbcxFileString = fc
    .tuple(
      // Tune number
      fc.nat({ max: 999 }),
      // Key
      fc.constantFrom("C", "G", "D", "A", "F", "Am", "Em"),
      // Body: chord symbols and barlines
      fc.array(
        fc.oneof(
          genChordSymbolToken.map((t) => t.lexeme),
          fc.constantFrom("|", "||", "|]", "[|", "|:")
        ),
        { minLength: 1, maxLength: 20 }
      )
    )
    .map(([num, key, body]) => `X:${num}\nK:${key}\n${body.join(" ")}`);

  describe("Structure Integrity", () => {
    it("should preserve structural integrity", () => {
      fc.assert(
        fc.property(genAbcxFileString, (input) => {
          const ctx = new ABCContext();
          const tokens = ScannerAbcx(input, ctx);

          // Property: Every section break should correspond to double newlines in input
          const sectionBreaks = tokens.filter((t) => t.type === TT.SCT_BRK);
          const inputBreaks = (input.match(/\n\n/g) || []).length;

          return sectionBreaks.length === inputBreaks;
        }),
        { numRuns: 500 }
      );
    });
  });

  describe("Token Position Integrity", () => {
    it("should maintain token position integrity", () => {
      fc.assert(
        fc.property(genAbcxFileString, (input) => {
          const ctx = new ABCContext();
          const tokens = ScannerAbcx(input, ctx);

          // Property: Tokens should be sequential and non-overlapping
          for (let i = 0; i < tokens.length - 1; i++) {
            const current = tokens[i];
            if (current.type === TT.EOL || current.type === TT.SCT_BRK || current.type === TT.EOF) {
              continue;
            }
            const next = tokens[i + 1];
            if (next.type === TT.EOL || next.type === TT.SCT_BRK || next.type === TT.EOF) {
              continue;
            }

            // Line numbers should not decrease
            if (current.line > next.line) {
              return false;
            }

            // On same line, positions should not overlap
            if (current.line === next.line && current.position + current.lexeme.length - 1 > next.position) {
              return false;
            }
          }
          return true;
        }),
        { numRuns: 500 }
      );
    });
  });

  describe("Tune Section Identification", () => {
    it("should properly identify tune sections", () => {
      fc.assert(
        fc.property(genAbcxFileString, (input) => {
          const ctx = new ABCContext();
          const tokens = ScannerAbcx(input, ctx);

          // Property: Every X: line should be identified as tune header
          const tuneHeaders = tokens.filter(
            (t) => t.type === TT.INF_HDR && t.lexeme.startsWith("X:")
          );

          const expectedTuneCount = (input.match(/^X:\d+/gm) || []).length;
          return tuneHeaders.length === expectedTuneCount;
        }),
        { numRuns: 500 }
      );
    });
  });

  describe("No Crashes", () => {
    it("should never crash on valid input", () => {
      fc.assert(
        fc.property(genAbcxFileString, (input) => {
          try {
            const ctx = new ABCContext();
            ScannerAbcx(input, ctx);
            return true;
          } catch (e) {
            return false;
          }
        }),
        { numRuns: 1000 }
      );
    });
  });
});

describe("ABCx Scanner - ChordSymbol Token Tests", () => {
  /**
   * Example-based tests for CHORD_SYMBOL token - the ONE new token type
   */
  describe("ChordSymbol Token Scanning", () => {
    const testChordSymbol = (chord: string) => {
      const source = `X:1\nK:C\n${chord} |`;
      const ctx = new ABCContext();
      const tokens = ScannerAbcx(source, ctx);
      const chordTokens = tokens.filter((t) => t.type === TT.CHORD_SYMBOL);
      expect(chordTokens.length).to.be.greaterThanOrEqual(1);
      expect(chordTokens.some((t) => t.lexeme === chord)).to.be.true;
    };

    it("should scan basic chord 'C'", () => testChordSymbol("C"));
    it("should scan minor chord 'Am'", () => testChordSymbol("Am"));
    it("should scan seventh chord 'G7'", () => testChordSymbol("G7"));
    it("should scan major seventh 'Cmaj7'", () => testChordSymbol("Cmaj7"));
    it("should scan half-diminished 'Dm7b5'", () => testChordSymbol("Dm7b5"));
    it("should scan slash chord 'G/B'", () => testChordSymbol("G/B"));
    it("should scan sharp chord 'F#m7'", () => testChordSymbol("F#m7"));
    it("should scan flat chord 'Bb'", () => testChordSymbol("Bb"));
    it("should scan complex chord 'Cmaj7#11'", () => testChordSymbol("Cmaj7#11"));
  });

  /**
   * Property-based tests for CHORD_SYMBOL token
   */
  describe("ChordSymbol Token Properties", () => {
    it("property: all generated chord symbols should be scanned correctly", () => {
      fc.assert(
        fc.property(genChordSymbolToken, (chordToken) => {
          const source = `X:1\nK:C\n${chordToken.lexeme} |`;
          const ctx = new ABCContext();
          const tokens = ScannerAbcx(source, ctx);

          const chordTokens = tokens.filter((t) => t.type === TT.CHORD_SYMBOL);
          return chordTokens.some((t) => t.lexeme === chordToken.lexeme);
        }),
        { numRuns: 500 }
      );
    });

    it("property: chord symbol lexeme should be preserved exactly", () => {
      fc.assert(
        fc.property(genChordSymbolToken, (chordToken) => {
          const source = `X:1\nK:C\n${chordToken.lexeme} |`;
          const ctx = new ABCContext();
          const tokens = ScannerAbcx(source, ctx);

          const scannedChord = tokens.find(
            (t) => t.type === TT.CHORD_SYMBOL && t.lexeme === chordToken.lexeme
          );
          return scannedChord !== undefined;
        }),
        { numRuns: 500 }
      );
    });

    it("property: multiple chords should produce multiple chord tokens", () => {
      fc.assert(
        fc.property(
          fc.array(genChordSymbolToken, { minLength: 2, maxLength: 8 }),
          (chordTokens) => {
            const chords = chordTokens.map((t) => t.lexeme);
            const source = `X:1\nK:C\n${chords.join(" | ")} |`;
            const ctx = new ABCContext();
            const tokens = ScannerAbcx(source, ctx);

            const scannedChordTokens = tokens.filter((t) => t.type === TT.CHORD_SYMBOL);
            return scannedChordTokens.length >= chordTokens.length;
          }
        ),
        { numRuns: 200 }
      );
    });
  });
});

describe("ABCx Scanner Round-trip Tests", () => {
  /**
   * Round-trip test: Generate tokens -> Concatenate lexemes -> Re-scan -> Compare
   * This is the MOST IMPORTANT test.
   * Uses ABCx-specific predicate because CHORD_SYMBOL tokens require ABCx scanner.
   */
  it("should produce equivalent tokens when rescanning concatenated lexemes", () => {
    fc.assert(fc.property(genAbcxTokenSequence, createAbcxRoundTripPredicate), {
      verbose: false,
      numRuns: 1000,
    });
  });
});
