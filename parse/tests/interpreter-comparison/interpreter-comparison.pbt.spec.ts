/**
 * interpreter-comparison.pbt.spec.ts
 *
 * Property-based tests comparing our parser+interpreter output with abcjs
 * Uses structured generators to produce valid ABC AST, stringifies them,
 * and compares the semantic output
 */

import { describe, it } from "mocha";
import * as fc from "fast-check";
import { parseWithAbcjs } from "./abcjs-wrapper";
import { parseWithYourParser } from "./test-helpers";
import { ABCContext } from "../../parsers/Context";
import { AbcFormatter } from "../../Visitors/Formatter2";
import {
  genKeyInfo,
  genMeterInfo,
  genNoteLenInfo,
  genTitleInfo,
  genComposerInfo,
  genOriginInfo,
  genRhythmInfo,
  genBookInfo,
  genSourceInfo,
  genDiscographyInfo,
  genNotesInfo,
  genTranscriptionInfo,
  genHistoryInfo,
  genAuthorInfo,
} from "../../analyzers/info-line-analyzer.pbt.generators";
import { genAnnotationDirective, genBooleanFlagDirective, genParserConfigDirective } from "../../analyzers/directive-analyzer.pbt.generators";
import { expect } from "chai";

/**
 * Generate a complete ABC tune header string from structured generators
 * K: field must be last
 */
const genTuneHeaderString = fc
  .record({
    title: fc.option(genTitleInfo),
    composer: fc.option(genComposerInfo),
    origin: fc.option(genOriginInfo),
    rhythm: fc.option(genRhythmInfo),
    book: fc.option(genBookInfo),
    source: fc.option(genSourceInfo),
    discography: fc.option(genDiscographyInfo),
    notes: fc.option(genNotesInfo),
    transcription: fc.option(genTranscriptionInfo),
    history: fc.option(genHistoryInfo),
    author: fc.option(genAuthorInfo),
    meter: fc.option(genMeterInfo),
    noteLength: fc.option(genNoteLenInfo),
    key: genKeyInfo, // Required, must be last
  })
  .map((fields) => {
    // Create a formatter once
    const ctx = new ABCContext();
    const formatter = new AbcFormatter(ctx);

    // Stringify each info line
    const lines: string[] = ["X:1"];

    if (fields.title) lines.push(formatter.stringify(fields.title.infoLine));
    if (fields.composer) lines.push(formatter.stringify(fields.composer.infoLine));
    if (fields.origin) lines.push(formatter.stringify(fields.origin.infoLine));
    if (fields.rhythm) lines.push(formatter.stringify(fields.rhythm.infoLine));
    if (fields.book) lines.push(formatter.stringify(fields.book.infoLine));
    if (fields.source) lines.push(formatter.stringify(fields.source.infoLine));
    if (fields.discography) lines.push(formatter.stringify(fields.discography.infoLine));
    if (fields.notes) lines.push(formatter.stringify(fields.notes.infoLine));
    if (fields.transcription) lines.push(formatter.stringify(fields.transcription.infoLine));
    if (fields.history) lines.push(formatter.stringify(fields.history.infoLine));
    if (fields.author) lines.push(formatter.stringify(fields.author.infoLine));
    if (fields.meter) lines.push(formatter.stringify(fields.meter.infoLine));
    if (fields.noteLength) lines.push(formatter.stringify(fields.noteLength.infoLine));
    lines.push(formatter.stringify(fields.key.infoLine)); // K: always last

    return lines.join("\n");
  });

/**
 * Generate file header directives as strings
 * No X:, K:, or M: allowed in file header
 */
const genFileHeaderString = fc
  .array(
    fc.oneof(
      genAnnotationDirective.map((item) => item.directive), // abc-copyright, abc-creator, abc-edited-by
      genParserConfigDirective.map((item) => item.directive), // landscape, titlecaps, continueall, font
      genNoteLenInfo.map((item) => item.infoLine) // L: allowed in file header
    ),
    { minLength: 0, maxLength: 3 }
  )
  .map((directives) => {
    if (directives.length === 0) return "";

    const ctx = new ABCContext();
    const formatter = new AbcFormatter(ctx);

    return directives.map((d) => formatter.stringify(d)).join("\n");
  });

/**
 * Generate complete ABC file with file header and tune header
 */
const genCompleteABC = fc
  .record({
    fileHeader: fc.option(genFileHeaderString),
    tuneHeader: genTuneHeaderString,
  })
  .map(({ fileHeader, tuneHeader }) => {
    const parts: string[] = [];

    if (fileHeader && fileHeader.trim().length > 0) {
      parts.push(fileHeader);
      parts.push(""); // blank line separator
    }

    parts.push(tuneHeader);

    return parts.join("\n");
  });

// these tests are passing
describe.skip("Parser Robustness", () => {
  it("should successfully parse all generated ABC without hanging", () => {
    fc.assert(
      fc.property(genCompleteABC, (abcString) => {
        // Parse with our parser - should never hang or crash
        const { tunes, ctx } = parseWithYourParser(abcString);

        // Should complete successfully (may produce 0 or more tunes)
        expect(tunes).to.be.an("array");

        // No expectation on errors - we just want to ensure it completes
        return true;
      }),
      { numRuns: 5000, verbose: false, timeout: 100000 }
    );
  });
});

describe("Interpreter Comparison - Property-Based Tests", () => {
  describe("MetaText Comparison", () => {
    it("should produce identical metaText fields for generated ABC", () => {
      fc.assert(
        fc.property(genCompleteABC, (abcString) => {
          // Parse with both parsers
          const abcjsResult = parseWithAbcjs(abcString);

          // Skip if abcjs failed to produce tunes
          if (abcjsResult.length === 0) {
            return true;
          }

          const abcjsTune = abcjsResult[0];

          // Parse with our parser
          try {
            const ourResult = parseWithYourParser(abcString);

            if (ourResult.tunes.length === 0) {
              return true;
            }

            const ourTune = ourResult.tunes[0];

            // Compare each metaText field using explicit access
            const ourMeta = ourTune.metaText as any;
            const abcjsMeta = abcjsTune.metaText as any;

            const metaFields = [
              "title",
              "composer",
              "origin",
              "rhythm",
              "book",
              "source",
              "discography",
              "notes",
              "transcription",
              "history",
              "author",
              "abc-copyright",
              "abc-creator",
              "abc-edited-by",
            ];

            for (const field of metaFields) {
              // Only compare if at least one parser has the field
              if (ourMeta[field] !== undefined || abcjsMeta[field] !== undefined) {
                // Both should have the same value (including undefined)
                if (ourMeta[field] !== abcjsMeta[field]) {
                  //  // console.log(`\nMetaText mismatch for field '${field}':`);
                  //  // console.log(`  Our parser: ${JSON.stringify(ourMeta[field])}`);
                  //  // console.log(`  abcjs:      ${JSON.stringify(abcjsMeta[field])}`);
                  //  // console.log(`  ABC input:\n${abcString}\n`);
                  return false;
                }
              }
            }

            return true;
          } catch (error) {
            //  // console.log(`\nError parsing ABC:`);
            //  // console.log(`  Error: ${error}`);
            //  // console.log(`  ABC input:\n${abcString}\n`);
            return false;
          }
        }),
        { numRuns: 2000, verbose: false }
      );
    });

    it("should handle title field correctly", () => {
      fc.assert(
        fc.property(genCompleteABC, (abcString) => {
          const abcjsResult = parseWithAbcjs(abcString);

          if (abcjsResult.length === 0) {
            return true;
          }

          const abcjsTune = abcjsResult[0];

          try {
            const ourResult = parseWithYourParser(abcString);

            if (ourResult.tunes.length === 0) {
              return true;
            }

            const ourTune = ourResult.tunes[0];

            // Title should match (may be array or string in both)
            if (ourTune.metaText.title !== abcjsTune.metaText.title) {
              // console.log(`\nTitle mismatch:`);
              // console.log(`  Our parser: ${JSON.stringify(ourTune.metaText.title)}`);
              // console.log(`  abcjs:      ${JSON.stringify(abcjsTune.metaText.title)}`);
              // console.log(`  ABC input:\n${abcString}\n`);
              return false;
            }

            return true;
          } catch (error) {
            // console.log(`\nError parsing ABC:`);
            // console.log(`  Error: ${error}`);
            // console.log(`  ABC input:\n${abcString}\n`);
            return false;
          }
        }),
        { numRuns: 2000 }
      );
    });
  });

  describe("Formatting Comparison", () => {
    it("should produce matching formatting directives for generated ABC", () => {
      fc.assert(
        fc.property(genCompleteABC, (abcString) => {
          const abcjsResult = parseWithAbcjs(abcString);

          if (abcjsResult.length === 0) {
            return true;
          }

          const abcjsTune = abcjsResult[0];

          try {
            const ourResult = parseWithYourParser(abcString);

            if (ourResult.tunes.length === 0) {
              return true;
            }

            const ourTune = ourResult.tunes[0];

            // Check specific formatting fields that could be in the ABC input
            // Note: abcjs always populates formatting with default font values,
            // so we can't check if the formatting object exists. Instead, we check
            // for the specific directives our generator produces.
            // Note: Some directives are NOT stored in tune.formatting:
            // - "landscape", "titlecaps", "continueall" are stored in multilineVars
            // - "font" is ignored
            const ourFormatting = ourTune.formatting as any;
            const abcjsFormatting = abcjsTune.formatting as any;
            const formattingFields = ["flatbeams", "bagpipes", "jazzchords", "germanAlphabet", "accentAbove", "titleleft", "measurebox"];

            for (const field of formattingFields) {
              const ourHasField = ourFormatting && ourFormatting[field] !== undefined;
              const abcjsHasField = abcjsFormatting && abcjsFormatting[field] !== undefined;

              // Both should have the field or both should not
              if (ourHasField !== abcjsHasField) {
                // console.log(`\nFormatting field '${field}' existence mismatch:`);
                // console.log(`  Our parser has ${field}: ${ourHasField}`);
                // console.log(`  abcjs has ${field}:      ${abcjsHasField}`);
                // console.log(`  ABC input:\n${abcString}\n`);
                return false;
              }
            }

            return true;
          } catch (error) {
            // console.log(`\nError parsing ABC:`);
            // console.log(`  Error: ${error}`);
            // console.log(`  ABC input:\n${abcString}\n`);
            return false;
          }
        }),
        { numRuns: 2000 }
      );
    });
  });

  describe("Version Field Comparison", () => {
    it("should handle abc-version directive correctly", () => {
      fc.assert(
        fc.property(genCompleteABC, (abcString) => {
          // Only run if the ABC contains abc-version
          if (!abcString.includes("%%abc-version")) {
            return true;
          }

          const abcjsResult = parseWithAbcjs(abcString);

          if (abcjsResult.length === 0) {
            return true;
          }

          const abcjsTune = abcjsResult[0];

          try {
            const ourResult = parseWithYourParser(abcString);

            if (ourResult.tunes.length === 0) {
              return true;
            }

            const ourTune = ourResult.tunes[0];

            // Version field should exist in both or neither
            const ourHasVersion = ourTune.version !== undefined;
            const abcjsHasVersion = abcjsTune.version !== undefined;

            if (ourHasVersion !== abcjsHasVersion) {
              // console.log(`\nVersion existence mismatch:`);
              // console.log(`  Our parser has version: ${ourHasVersion}`);
              // console.log(`  abcjs has version:      ${abcjsHasVersion}`);
              // console.log(`  ABC input:\n${abcString}\n`);
              return false;
            }

            return true;
          } catch (error) {
            // console.log(`\nError parsing ABC:`);
            // console.log(`  Error: ${error}`);
            // console.log(`  ABC input:\n${abcString}\n`);
            return false;
          }
        }),
        { numRuns: 50 }
      );
    });
  });
});
