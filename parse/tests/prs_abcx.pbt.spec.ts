/**
 * ABCx Parser Property-Based Tests
 *
 * Tests the ABCx parser using property-based testing.
 * Follows the same pattern as prs_pbt.spec.ts.
 *
 * Focus: Tests ONLY the new ChordSymbol expression type.
 * All other expression types (barlines, annotations, etc.) are tested in prs_pbt.spec.ts.
 */

import * as fc from "fast-check";
import { expect } from "chai";
import { ABCContext } from "../parsers/Context";
import { ScannerAbcx } from "../parsers/scan_abcx_tunebody";
import { parseAbcx } from "../parsers/parse_abcx";
import { Token, TT } from "../parsers/scan2";
import { AbcFormatter } from "../Visitors/Formatter2";
import { ChordSymbol, Tune, File_structure } from "../types/Expr2";
import {
  sharedContext,
  genChordSymbolExpr,
  genAbcxMusicSequence,
  genAbcxMultiBarSequence,
} from "./prs_abcx.generators.spec";

/**
 * Helper: Parse ABCx string into AST
 */
function parseAbcxString(source: string): File_structure {
  const ctx = new ABCContext();
  const tokens = ScannerAbcx(source, ctx);
  return parseAbcx(tokens, ctx);
}

/**
 * Helper: Get tune body expressions from AST
 */
function getTuneBodyExprs(ast: File_structure): Array<any> {
  const tune = ast.contents.find((c) => c instanceof Tune) as Tune | undefined;
  if (!tune || !tune.tune_body) return [];
  return tune.tune_body.sequence.flatMap((system) => system);
}

/**
 * Helper: Count ChordSymbol nodes in AST
 */
function countChordSymbols(ast: File_structure): number {
  const exprs = getTuneBodyExprs(ast);
  return exprs.filter((e) => e instanceof ChordSymbol).length;
}

describe("ABCx Parser Property Tests", () => {
  const testContext = sharedContext;

  describe("No Crashes", () => {
    it("should never crash on valid ABCx input", () => {
      fc.assert(
        fc.property(genAbcxMusicSequence, (sequence) => {
          try {
            const chordLexemes = sequence.exprs
              .filter((e) => e instanceof ChordSymbol)
              .map((e) => (e as ChordSymbol).token.lexeme);

            if (chordLexemes.length === 0) return true;

            const source = `X:1\nK:C\n${chordLexemes.join(" | ")} |`;
            parseAbcxString(source);
            return true;
          } catch (e) {
            console.error("Parsing crashed:", e);
            return false;
          }
        }),
        { numRuns: 200 }
      );
    });
  });
});

describe("ABCx Parser - ChordSymbol Expression Tests", () => {
  /**
   * Example-based tests for ChordSymbol expression - the ONE new expression type
   */
  describe("ChordSymbol Expression Parsing", () => {
    const testChordParsing = (chord: string) => {
      const source = `X:1\nK:C\n${chord} |`;
      const ast = parseAbcxString(source);
      const chordSymbols = getTuneBodyExprs(ast).filter(
        (e) => e instanceof ChordSymbol
      ) as ChordSymbol[];

      expect(chordSymbols.length).to.be.greaterThanOrEqual(1);
      expect(chordSymbols.some((c) => c.token.lexeme === chord)).to.be.true;
    };

    it("should parse basic chord 'C'", () => testChordParsing("C"));
    it("should parse minor chord 'Am'", () => testChordParsing("Am"));
    it("should parse seventh chord 'G7'", () => testChordParsing("G7"));
    it("should parse major seventh 'Cmaj7'", () => testChordParsing("Cmaj7"));
    it("should parse half-diminished 'Dm7b5'", () => testChordParsing("Dm7b5"));
    it("should parse slash chord 'G/B'", () => testChordParsing("G/B"));
  });

  /**
   * Property-based tests for ChordSymbol expression
   */
  describe("ChordSymbol Expression Properties", () => {
    it("property: all generated chord symbols should be parsed correctly", () => {
      fc.assert(
        fc.property(genChordSymbolExpr, (gen) => {
          const source = `X:1\nK:C\n${gen.expr.token.lexeme} |`;
          const ast = parseAbcxString(source);
          const chordSymbols = getTuneBodyExprs(ast).filter(
            (e) => e instanceof ChordSymbol
          ) as ChordSymbol[];

          return chordSymbols.some((c) => c.token.lexeme === gen.expr.token.lexeme);
        }),
        { numRuns: 300 }
      );
    });

    it("property: chord count should be preserved", () => {
      fc.assert(
        fc.property(
          fc.array(genChordSymbolExpr, { minLength: 1, maxLength: 8 }),
          (chordExprs) => {
            const chords = chordExprs.map((c) => c.expr.token.lexeme);
            const source = `X:1\nK:C\n${chords.join(" | ")} |`;
            const ast = parseAbcxString(source);
            const parsedCount = countChordSymbols(ast);

            return parsedCount >= chords.length;
          }
        ),
        { numRuns: 200 }
      );
    });
  });
});

describe("ABCx Parser Round-trip Tests", () => {
  const formatter = new AbcFormatter(sharedContext);

  /**
   * Round-trip test: Generate -> Parse -> Format -> Compare
   * This is the MOST IMPORTANT test.
   */
  describe("ChordSymbol Round-trip", () => {
    it("should correctly round-trip ChordSymbol expressions", () => {
      fc.assert(
        fc.property(genChordSymbolExpr, (gen) => {
          const originalLexeme = gen.expr.token.lexeme;
          const source = `X:1\nK:C\n${originalLexeme} |`;
          const ast = parseAbcxString(source);

          const chordSymbols = getTuneBodyExprs(ast).filter(
            (e) => e instanceof ChordSymbol
          ) as ChordSymbol[];

          if (chordSymbols.length === 0) return false;

          // Format the parsed ChordSymbol and compare
          const parsedLexeme = formatter.stringify(chordSymbols[0]);
          return originalLexeme === parsedLexeme;
        }),
        { numRuns: 500 }
      );
    });

    it("should correctly round-trip multiple ChordSymbol expressions", () => {
      fc.assert(
        fc.property(
          fc.array(genChordSymbolExpr, { minLength: 2, maxLength: 6 }),
          (chordExprs) => {
            const originalLexemes = chordExprs.map((c) => c.expr.token.lexeme);
            const source = `X:1\nK:C\n${originalLexemes.join(" | ")} |`;
            const ast = parseAbcxString(source);

            const chordSymbols = getTuneBodyExprs(ast).filter(
              (e) => e instanceof ChordSymbol
            ) as ChordSymbol[];

            if (chordSymbols.length < originalLexemes.length) return false;

            // Format each parsed ChordSymbol and compare
            const parsedLexemes = chordSymbols.map((c) => formatter.stringify(c));

            return originalLexemes.every((orig) => parsedLexemes.includes(orig));
          }
        ),
        { numRuns: 300 }
      );
    });
  });

  describe("ABCx Music Sequence Round-trip", () => {
    it("should correctly round-trip ABCx music sequences", () => {
      fc.assert(
        fc.property(genAbcxMultiBarSequence, (sequence) => {
          // Extract chord lexemes
          const chordLexemes = sequence.exprs
            .filter((e) => e instanceof ChordSymbol)
            .map((e) => (e as ChordSymbol).token.lexeme);

          if (chordLexemes.length === 0) return true;

          // Build source string
          const source = `X:1\nK:C\n${chordLexemes.join(" | ")} |`;
          const ast = parseAbcxString(source);

          const parsedChordSymbols = getTuneBodyExprs(ast).filter(
            (e) => e instanceof ChordSymbol
          ) as ChordSymbol[];

          // All original chords should be present in parsed result
          const parsedLexemes = parsedChordSymbols.map((c) => c.token.lexeme);
          return chordLexemes.every((orig) => parsedLexemes.includes(orig));
        }),
        { numRuns: 500 }
      );
    });
  });
});
