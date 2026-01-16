/**
 * ABCx to ABC Converter Property-Based Tests
 *
 * Tests for converting ABCx chord sheet notation to standard ABC.
 * Uses property-based testing to verify preservation across conversion boundary.
 *
 * Focus: Tests ONLY the conversion properties (chord -> annotation+rest).
 * Rest duration calculation details are tested in rest_calculation.spec.ts.
 */

import * as fc from "fast-check";
import { expect } from "chai";
import { ABCContext } from "../parsers/Context";
import { ScannerAbcx } from "../parsers/scan_abcx_tunebody";
import { parseAbcx } from "../parsers/parse_abcx";
import { AbcxToAbcConverter, convertAbcxToAbc } from "../Visitors/AbcxToAbcConverter";
import { AbcFormatter } from "../Visitors/Formatter2";
import { Annotation, BarLine, ChordSymbol, Rest, Tune, File_structure, tune_body_code } from "../types/Expr2";
import {
  sharedContext,
  genChordSymbolExpr,
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
 * Helper: Convert ABCx string to ABC AST
 */
function convertToAst(source: string): File_structure {
  const ctx = new ABCContext();
  const tokens = ScannerAbcx(source, ctx);
  const ast = parseAbcx(tokens, ctx);
  const converter = new AbcxToAbcConverter(ctx);
  return converter.convert(ast);
}

/**
 * Helper: Get tune body expressions from AST
 */
function getTuneBodyExprs(ast: File_structure): tune_body_code[] {
  const tune = ast.contents.find((c) => c instanceof Tune) as Tune | undefined;
  if (!tune || !tune.tune_body) return [];
  return tune.tune_body.sequence.flatMap((system) => system);
}

/**
 * Helper: Count specific node types in AST
 */
function countNodeType<T>(ast: File_structure, nodeType: new (...args: any[]) => T): number {
  const exprs = getTuneBodyExprs(ast);
  return exprs.filter((e) => e instanceof nodeType).length;
}

describe("ABCx to ABC Converter Property Tests", () => {
  describe("Chord Symbol to Annotation Preservation", () => {
    it("property: all chord symbols are preserved as annotations", () => {
      fc.assert(
        fc.property(genChordSymbolExpr, (gen) => {
          const chordLexeme = gen.expr.token.lexeme;
          const source = `X:1\nK:C\n${chordLexeme} |`;
          const abcAst = convertToAst(source);

          const annotations = getTuneBodyExprs(abcAst).filter(
            (e) => e instanceof Annotation
          ) as Annotation[];

          // The chord should appear as an annotation with "^" prefix
          const expectedAnnotation = `"${chordLexeme}"`;
          return annotations.some((a) => a.text.lexeme === expectedAnnotation);
        }),
        { numRuns: 300 }
      );
    });

    it("property: chord count equals annotation count after conversion", () => {
      fc.assert(
        fc.property(
          fc.array(genChordSymbolExpr, { minLength: 1, maxLength: 8 }),
          (chordExprs) => {
            const chords = chordExprs.map((c) => c.expr.token.lexeme);
            const source = `X:1\nK:C\n${chords.join(" | ")} |`;

            const abcxAst = parseAbcxString(source);
            const abcAst = convertToAst(source);

            const originalChordCount = countNodeType(abcxAst, ChordSymbol);
            const convertedAnnotationCount = countNodeType(abcAst, Annotation);

            return originalChordCount === convertedAnnotationCount;
          }
        ),
        { numRuns: 200 }
      );
    });
  });

  describe("Rest Generation", () => {
    it("property: all chord symbols have corresponding rests", () => {
      fc.assert(
        fc.property(
          fc.array(genChordSymbolExpr, { minLength: 1, maxLength: 6 }),
          (chordExprs) => {
            const chords = chordExprs.map((c) => c.expr.token.lexeme);
            const source = `X:1\nK:C\n${chords.join(" | ")} |`;

            const abcAst = convertToAst(source);

            const annotationCount = countNodeType(abcAst, Annotation);
            const restCount = countNodeType(abcAst, Rest);

            // Each chord becomes annotation + rest, so counts should match
            return annotationCount === restCount;
          }
        ),
        { numRuns: 200 }
      );
    });

    it("property: single chord per bar uses X (full bar rest)", () => {
      fc.assert(
        fc.property(genChordSymbolExpr, (gen) => {
          const chordLexeme = gen.expr.token.lexeme;
          const source = `X:1\nK:C\n${chordLexeme} |`;
          const abcAst = convertToAst(source);

          const rests = getTuneBodyExprs(abcAst).filter(
            (e) => e instanceof Rest
          ) as Rest[];

          if (rests.length !== 1) return false;
          return rests[0].rest.lexeme === "X";
        }),
        { numRuns: 200 }
      );
    });

    it("property: multiple chords per bar use x (partial rests)", () => {
      fc.assert(
        fc.property(
          fc.array(genChordSymbolExpr, { minLength: 2, maxLength: 4 }),
          (chordExprs) => {
            const chords = chordExprs.map((c) => c.expr.token.lexeme);
            // All chords in ONE bar (no barline between them)
            const source = `X:1\nK:C\n${chords.join(" ")} |`;
            const abcAst = convertToAst(source);

            const rests = getTuneBodyExprs(abcAst).filter(
              (e) => e instanceof Rest
            ) as Rest[];

            // All rests should use lowercase x
            return rests.every((r) => r.rest.lexeme === "x");
          }
        ),
        { numRuns: 200 }
      );
    });
  });

  describe("Barline Preservation", () => {
    it("property: barline count is preserved through conversion", () => {
      fc.assert(
        fc.property(genAbcxMultiBarSequence, (sequence) => {
          if (sequence.totalChordCount === 0) return true;

          // Build source directly from the generated token stream (preserving structure)
          const bodyContent = sequence.tokens.map((t) => t.lexeme).join(" ");
          const source = `X:1\nK:C\n${bodyContent}`;

          const abcxAst = parseAbcxString(source);
          const abcAst = convertToAst(source);

          const originalBarlineCount = countNodeType(abcxAst, BarLine);
          const convertedBarlineCount = countNodeType(abcAst, BarLine);

          return originalBarlineCount === convertedBarlineCount;
        }),
        { numRuns: 300 }
      );
    });
  });

  describe("Structure Preservation", () => {
    it("property: conversion produces valid ABC that can be formatted", () => {
      fc.assert(
        fc.property(
          fc.array(genChordSymbolExpr, { minLength: 1, maxLength: 6 }),
          (chordExprs) => {
            const chords = chordExprs.map((c) => c.expr.token.lexeme);
            const source = `X:1\nK:C\n${chords.join(" | ")} |`;

            try {
              const ctx = new ABCContext();
              const result = convertAbcxToAbc(source, ctx);
              // Should produce a non-empty string
              return result.length > 0;
            } catch (e) {
              return false;
            }
          }
        ),
        { numRuns: 200 }
      );
    });

    it("property: formatted output contains all original chord names", () => {
      fc.assert(
        fc.property(
          fc.array(genChordSymbolExpr, { minLength: 1, maxLength: 5 }),
          (chordExprs) => {
            const chords = chordExprs.map((c) => c.expr.token.lexeme);
            const source = `X:1\nK:C\n${chords.join(" | ")} |`;

            const ctx = new ABCContext();
            const result = convertAbcxToAbc(source, ctx);

            // All original chord names should appear in the output as annotations
            return chords.every((chord) => result.includes(`"${chord}"`));
          }
        ),
        { numRuns: 200 }
      );
    });
  });

  describe("No Crashes", () => {
    it("property: conversion never crashes on valid ABCx input", () => {
      fc.assert(
        fc.property(genAbcxMultiBarSequence, (sequence) => {
          const chordLexemes = sequence.exprs
            .filter((e) => e instanceof ChordSymbol)
            .map((e) => (e as ChordSymbol).token.lexeme);

          if (chordLexemes.length === 0) return true;

          const source = `X:1\nK:C\n${chordLexemes.join(" | ")} |`;

          try {
            convertToAst(source);
            return true;
          } catch (e) {
            console.error("Conversion crashed:", e);
            return false;
          }
        }),
        { numRuns: 500 }
      );
    });
  });

  describe("Line Break Preservation", () => {
    it("property: line breaks in tune body are preserved after conversion", () => {
      fc.assert(
        fc.property(
          fc.array(genChordSymbolExpr, { minLength: 1, maxLength: 3 }),
          fc.array(genChordSymbolExpr, { minLength: 1, maxLength: 3 }),
          (line1Chords, line2Chords) => {
            const line1 = line1Chords.map((c) => c.expr.token.lexeme).join(" | ") + " |";
            const line2 = line2Chords.map((c) => c.expr.token.lexeme).join(" | ") + " |";
            // Two lines of music content, separated by newline
            const source = `X:1\nK:C\n${line1}\n${line2}`;

            const ctx = new ABCContext();
            const result = convertAbcxToAbc(source, ctx);

            // The tune body should contain a newline separating the two lines
            // Extract the tune body (everything after K:C)
            const tuneBodyStart = result.indexOf("K:C") + 3;
            const tuneBody = result.substring(tuneBodyStart).trim();

            // There should be at least one newline in the tune body
            const newlinesInBody = (tuneBody.match(/\n/g) || []).length;
            return newlinesInBody >= 1;
          }
        ),
        { numRuns: 100 }
      );
    });

    it("example: two lines of chords should remain on two lines", () => {
      const source = `X:1\nK:C\nC Am | F G |\nDm G | C |`;
      const ctx = new ABCContext();
      const result = convertAbcxToAbc(source, ctx);

      // Extract tune body
      const tuneBodyStart = result.indexOf("K:C") + 3;
      const tuneBody = result.substring(tuneBodyStart).trim();

      // Should have a newline separating the two lines
      expect(tuneBody).to.include("\n");
    });
  });

  describe("Multi-Tune File Handling", () => {
    it("property: multiple tunes remain separate in output", () => {
      fc.assert(
        fc.property(
          fc.array(genChordSymbolExpr, { minLength: 1, maxLength: 3 }),
          fc.array(genChordSymbolExpr, { minLength: 1, maxLength: 3 }),
          (tune1Chords, tune2Chords) => {
            const tune1Body = tune1Chords.map((c) => c.expr.token.lexeme).join(" | ") + " |";
            const tune2Body = tune2Chords.map((c) => c.expr.token.lexeme).join(" | ") + " |";

            // Two separate tunes with section break between them
            const source = `X:1\nT:Tune One\nK:C\n${tune1Body}\n\nX:2\nT:Tune Two\nK:G\n${tune2Body}`;

            const ctx = new ABCContext();
            const result = convertAbcxToAbc(source, ctx);

            // Both tune headers should appear in output
            const hasTune1 = result.includes("X:1") && result.includes("T:Tune One");
            const hasTune2 = result.includes("X:2") && result.includes("T:Tune Two");

            // Both tunes should be present as separate tunes
            return hasTune1 && hasTune2;
          }
        ),
        { numRuns: 100 }
      );
    });

    it("example: two tunes should remain as two separate tunes", () => {
      const source = `X:1\nT:First Song\nK:C\nC | G |\n\nX:2\nT:Second Song\nK:G\nG | D |`;
      const ctx = new ABCContext();
      const result = convertAbcxToAbc(source, ctx);

      // Both tune numbers should be present
      expect(result).to.include("X:1");
      expect(result).to.include("X:2");

      // Both titles should be present
      expect(result).to.include("T:First Song");
      expect(result).to.include("T:Second Song");

      // There should be a section break (blank line) between tunes
      const x1Index = result.indexOf("X:1");
      const x2Index = result.indexOf("X:2");
      const between = result.substring(x1Index, x2Index);

      // A section break is typically represented by a blank line (\n\n)
      expect(between).to.include("\n\n");
    });
  });
});
