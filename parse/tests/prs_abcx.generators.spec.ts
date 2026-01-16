/**
 * ABCx Parser Generators
 *
 * Composes ABCx-specific expression sequences using existing generators from prs_pbt.generators.spec.ts.
 * Only adds the ChordSymbol-specific compositions; all other generators are imported.
 */

import * as fc from "fast-check";
import {
  sharedContext,
  genChordSymbolExpr,
  genBarLineExpr,
  genAnnotationExpr,
  genRestExpr,
  genMultiMeasureRestExpr,
} from "./prs_pbt.generators.spec";

// Re-export shared context and chord symbol expression generator
export { sharedContext, genChordSymbolExpr };

/**
 * ABCx music sequence generator
 * Composes chord symbols with barlines, annotations, and rests - the valid ABCx expressions
 */
export const genAbcxMusicSequence = fc
  .array(
    fc.oneof(
      // Chord symbols - the primary ABCx content (high weight)
      { arbitrary: genChordSymbolExpr, weight: 10 },
      // Barlines
      { arbitrary: genBarLineExpr, weight: 5 },
      // Annotations
      { arbitrary: genAnnotationExpr, weight: 2 },
      // Rests
      { arbitrary: genRestExpr, weight: 2 },
      // Multi-measure rests
      { arbitrary: genMultiMeasureRestExpr, weight: 1 }
    ),
    { minLength: 1, maxLength: 15 }
  )
  .map((exprs) => ({
    tokens: exprs.flatMap((e) => e.tokens),
    exprs: exprs.map((e) => e.expr),
  }));

/**
 * ABCx music sequence with at least one chord symbol
 * Useful for testing conversion which requires chord symbols
 */
export const genAbcxMusicSequenceWithChords = fc
  .tuple(
    // At least one chord symbol
    fc.array(genChordSymbolExpr, { minLength: 1, maxLength: 5 }),
    // Optional other elements
    fc.array(
      fc.oneof(
        { arbitrary: genBarLineExpr, weight: 5 },
        { arbitrary: genAnnotationExpr, weight: 2 },
        { arbitrary: genRestExpr, weight: 2 }
      ),
      { minLength: 0, maxLength: 10 }
    )
  )
  .map(([chords, others]) => {
    // Interleave chords with other elements
    const allExprs = [...chords, ...others];
    // Shuffle to get realistic mixing (optional - can be removed for deterministic tests)
    return {
      tokens: allExprs.flatMap((e) => e.tokens),
      exprs: allExprs.map((e) => e.expr),
      chordCount: chords.length,
    };
  });

/**
 * ABCx bar generator
 * Creates a sequence of chords followed by a barline
 */
export const genAbcxBar = fc
  .tuple(
    fc.array(genChordSymbolExpr, { minLength: 1, maxLength: 4 }),
    genBarLineExpr
  )
  .map(([chords, barline]) => ({
    tokens: [...chords.flatMap((c) => c.tokens), ...barline.tokens],
    exprs: [...chords.map((c) => c.expr), barline.expr],
    chordCount: chords.length,
  }));

/**
 * ABCx multi-bar sequence generator
 * Creates multiple bars of chord symbols
 */
export const genAbcxMultiBarSequence = fc
  .array(genAbcxBar, { minLength: 1, maxLength: 8 })
  .map((bars) => ({
    tokens: bars.flatMap((b) => b.tokens),
    exprs: bars.flatMap((b) => b.exprs),
    barCount: bars.length,
    totalChordCount: bars.reduce((sum, b) => sum + b.chordCount, 0),
    chordsPerBar: bars.map((b) => b.chordCount),
  }));
