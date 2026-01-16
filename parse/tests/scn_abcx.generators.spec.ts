/**
 * ABCx Scanner Generators
 *
 * Composes ABCx-specific token sequences using existing generators from scn_pbt.generators.spec.ts.
 * Only adds the ChordSymbol-specific compositions; all other generators are imported.
 */

import * as fc from "fast-check";
import { Token, TT } from "../parsers/scan2";
import {
  sharedContext,
  genChordSymbolToken,
  genBarline,
  genAnnotation,
  genRest,
  genInlineField,
  genWhitespace,
  genEOL,
  genCommentToken,
  genInfoLine2,
  applyTokenFiltering,
} from "./scn_pbt.generators.spec";

// Re-export shared context and chord symbol token generator
export { sharedContext, genChordSymbolToken };

/**
 * ABCx tune body tokens generator
 * Composes chord symbols with barlines, annotations, rests, and other ABCx-valid tokens
 */
export const genAbcxTuneBodyTokens = fc
  .array(
    fc.oneof(
      // Chord symbols - the primary ABCx content
      { arbitrary: genChordSymbolToken.map((t) => [t]), weight: 10 },
      // Barlines
      { arbitrary: genBarline.map((t) => [t]), weight: 5 },
      // Annotations (text above/below)
      { arbitrary: genAnnotation.map((t) => [t]), weight: 2 },
      // Rests (multi-measure rests)
      { arbitrary: genRest.map((t) => [t]), weight: 2 },
      // Whitespace
      { arbitrary: genWhitespace.map((t) => [t]), weight: 3 },
      // End of line
      { arbitrary: genEOL.map((t) => [t]), weight: 2 }
    ),
    { minLength: 1, maxLength: 30 }
  )
  .map((arrays) => arrays.flat());

/**
 * ABCx tune header tokens generator
 * Generates a minimal valid ABCx tune header: X: and K: fields
 */
export const genAbcxTuneHeaderTokens = fc
  .tuple(
    // X: field (required)
    fc.nat({ max: 999 }).map((n) => [
      new Token(TT.INF_HDR, "X:", sharedContext.generateId()),
      new Token(TT.INFO_STR, String(n), sharedContext.generateId()),
      new Token(TT.EOL, "\n", sharedContext.generateId()),
    ]),
    // Optional T: field
    fc.option(
      fc.string({ minLength: 1, maxLength: 20 }).filter(s => !s.includes("\n")).map((title) => [
        new Token(TT.INF_HDR, "T:", sharedContext.generateId()),
        new Token(TT.INFO_STR, title, sharedContext.generateId()),
        new Token(TT.EOL, "\n", sharedContext.generateId()),
      ])
    ),
    // K: field (required, signals end of header)
    fc.constantFrom("C", "G", "D", "A", "E", "F", "Bb", "Am", "Em", "Dm").map((key) => [
      new Token(TT.INF_HDR, "K:", sharedContext.generateId()),
      new Token(TT.INFO_STR, key, sharedContext.generateId()),
      new Token(TT.EOL, "\n", sharedContext.generateId()),
    ])
  )
  .map(([xField, tField, kField]) => {
    const tokens = [...xField];
    if (tField) tokens.push(...tField);
    tokens.push(...kField);
    return tokens;
  });

/**
 * ABCx complete tune tokens generator
 * Combines header and body into a complete tune
 */
export const genAbcxTuneTokens = fc
  .tuple(genAbcxTuneHeaderTokens, genAbcxTuneBodyTokens)
  .map(([header, body]) => [...header, ...body]);

/**
 * ABCx file tokens generator
 * Generates a complete ABCx file with one or more tunes
 */
export const genAbcxFileTokens = fc
  .array(genAbcxTuneTokens, { minLength: 1, maxLength: 3 })
  .map((tunes) => {
    const result: Token[] = [];
    for (let i = 0; i < tunes.length; i++) {
      if (i > 0) {
        // Add section break between tunes
        result.push(new Token(TT.SCT_BRK, "\n\n", sharedContext.generateId()));
      }
      result.push(...tunes[i]);
    }
    return result;
  });

/**
 * ABCx token sequence for round-trip testing
 * Uses the same filtering as regular ABC to ensure valid sequences
 */
export const genAbcxTokenSequence = genAbcxTuneBodyTokens.map((tokens) => {
  return applyTokenFiltering(tokens);
});
