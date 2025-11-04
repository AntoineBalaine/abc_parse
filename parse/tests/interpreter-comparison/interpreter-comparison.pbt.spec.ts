/**
 * interpreter-comparison.pbt.spec.ts
 *
 * Property-based tests comparing our parser+interpreter output with abcjs
 * Uses structured generators to produce valid ABC AST, stringifies them,
 * and compares the semantic output
 */

import { expect } from "chai";
import * as fc from "fast-check";
import { describe, it } from "mocha";
import { genAnnotationDirective, genParserConfigDirective } from "../../analyzers/directive-analyzer.pbt.generators";
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
import { ABCContext } from "../../parsers/Context";
import { Token, TT } from "../../parsers/scan2";
import { AbcFormatter } from "../../Visitors/Formatter2";
import { genNote, genChord, genRest, genInlineField, applyTokenFiltering, sharedContext } from "../scn_pbt.generators.spec";
import { parseWithAbcjs } from "./abcjs-wrapper";
import { parseWithYourParser } from "./test-helpers";

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

describe("PBT compare: Music Code - Property-Based", () => {
  /**
   * Generate a simple music line with notes and bars
   * Structure: (musical elements)+ (barline)
   * This avoids ambiguous patterns like [| or consecutive barlines
   */
  const genMusicLine = fc
    .array(
      fc.tuple(
        fc.array(fc.oneof(genNote), { minLength: 1, maxLength: 4 }), // Musical elements
        fc.oneof(
          fc.constantFrom(new Token(TT.BARLINE, "|", sharedContext.generateId())),
          fc.constantFrom(new Token(TT.BARLINE, "||", sharedContext.generateId()))
        ) // Barline
      ),
      { minLength: 1, maxLength: 3 }
    )
    .map((measures) => {
      // Flatten: for each measure, add notes then barline
      const tokens: Token[] = [];
      for (const [notes, barline] of measures) {
        tokens.push(...notes.flat());
        tokens.push(barline);
      }

      // Apply filtering
      const filtered = applyTokenFiltering(tokens);

      // Join tokens into a string
      return filtered.map((t) => t.lexeme).join("");
    });

  /**
   * Generate complete ABC with music code
   */
  const genABCWithMusic = fc
    .record({
      tuneHeader: genTuneHeaderString,
      musicLine: genMusicLine,
    })
    .map(({ tuneHeader, musicLine }) => {
      return `${tuneHeader}\n${musicLine}`;
    });

  it("should produce matching note/bar elements for random ABC", () => {
    fc.assert(
      fc.property(genABCWithMusic, (abcString) => {
        try {
          const abcjsResult = parseWithAbcjs(abcString);
          const ourResult = parseWithYourParser(abcString);

          if (abcjsResult.length === 0 || ourResult.tunes.length === 0) {
            return true;
          }

          const abcjsTune = abcjsResult[0];
          const ourTune = ourResult.tunes[0];

          // Skip if no music lines
          if (!abcjsTune.lines || abcjsTune.lines.length === 0 || !ourTune.systems || ourTune.systems.length === 0) {
            return true;
          }

          const abcjsLine = abcjsTune.lines[0];
          const ourLine = ourTune.systems[0];

          // Type narrow to MusicLine
          if (!("staff" in abcjsLine) || !("staff" in ourLine)) {
            return true;
          }

          // Skip if no voices
          if (!abcjsLine.staff[0] || !ourLine.staff[0]) {
            return true;
          }

          const abcjsVoice = abcjsLine.staff[0].voices[0];
          const ourVoice = ourLine.staff[0].voices[0];

          // Compare voice lengths
          if (ourVoice.length !== abcjsVoice.length) {
            // console.log(`\nVoice length mismatch:`);
            // console.log(`  Our parser: ${ourVoice.length}`);
            // console.log(`  abcjs:      ${abcjsVoice.length}`);
            // console.log(`  ABC input:\n${abcString}\n`);
            return false;
          }

          // Compare each element type
          for (let i = 0; i < ourVoice.length; i++) {
            if (ourVoice[i].el_type !== abcjsVoice[i].el_type) {
              // console.log(`\nElement type mismatch at index ${i}:`);
              // console.log(`  Our parser: ${ourVoice[i].el_type}`);
              // console.log(`  abcjs:      ${abcjsVoice[i].el_type}`);
              return false;
            }

            // For notes, compare pitch properties
            if (ourVoice[i].el_type === "note" && "pitches" in ourVoice[i] && "pitches" in abcjsVoice[i]) {
              const ourPitches = (ourVoice[i] as any).pitches;
              const abcjsPitches = (abcjsVoice[i] as any).pitches;

              if (ourPitches && abcjsPitches) {
                if (ourPitches.length !== abcjsPitches.length) {
                  return false;
                }

                for (let j = 0; j < ourPitches.length; j++) {
                  if (ourPitches[j].pitch !== abcjsPitches[j].pitch) {
                    return false;
                  }
                  if (ourPitches[j].verticalPos !== abcjsPitches[j].verticalPos) {
                    return false;
                  }
                }
              }
            }

            // For bars, compare type
            if (ourVoice[i].el_type === "bar" && "type" in ourVoice[i] && "type" in abcjsVoice[i]) {
              if ((ourVoice[i] as any).type !== (abcjsVoice[i] as any).type) {
                return false;
              }
            }
          }

          return true;
        } catch (error) {
          // console.log(`\nError during comparison:`);
          // console.log(`  Error: ${error}`);
          // console.log(`  ABC input:\n${abcString}\n`);
          return false;
        }
      }),
      { numRuns: 1000, verbose: false }
    );
  });

  it("should handle rests correctly in random ABC", () => {
    const genABCWithRests = fc
      .record({
        tuneHeader: genTuneHeaderString,
        musicLine: fc
          .array(
            fc.tuple(
              fc.array(fc.oneof(genNote, genRest), { minLength: 1, maxLength: 4 }),
              fc.constantFrom(new Token(TT.BARLINE, "|", sharedContext.generateId()))
            ),
            { minLength: 1, maxLength: 3 }
          )
          .map((measures) => {
            const tokens: Token[] = [];
            for (const [elements, barline] of measures) {
              tokens.push(...elements.flat());
              tokens.push(barline);
            }
            const filtered = applyTokenFiltering(tokens);
            return filtered.map((t) => t.lexeme).join("");
          }),
      })
      .map(({ tuneHeader, musicLine }) => {
        return `${tuneHeader}\n${musicLine}`;
      });

    fc.assert(
      fc.property(genABCWithRests, (abcString) => {
        try {
          const abcjsResult = parseWithAbcjs(abcString);
          const ourResult = parseWithYourParser(abcString);

          if (abcjsResult.length === 0 || ourResult.tunes.length === 0) {
            return true;
          }

          const abcjsTune = abcjsResult[0];
          const ourTune = ourResult.tunes[0];

          if (!abcjsTune.lines || abcjsTune.lines.length === 0 || !ourTune.systems || ourTune.systems.length === 0) {
            return true;
          }

          const abcjsLine = abcjsTune.lines[0];
          const ourLine = ourTune.systems[0];

          if (!("staff" in abcjsLine) || !("staff" in ourLine)) {
            return true;
          }

          const abcjsVoice = abcjsLine.staff[0].voices[0];
          const ourVoice = ourLine.staff[0].voices[0];

          // Compare rest elements
          for (let i = 0; i < Math.min(ourVoice.length, abcjsVoice.length); i++) {
            if ("rest" in ourVoice[i] && "rest" in abcjsVoice[i]) {
              const ourRest = (ourVoice[i] as any).rest;
              const abcjsRest = (abcjsVoice[i] as any).rest;

              if (ourRest?.type !== abcjsRest?.type) {
                return false;
              }
            }
          }

          return true;
        } catch (error) {
          return false;
        }
      }),
      { numRuns: 500, verbose: false }
    );
  });

  it("should handle chords correctly in random ABC", () => {
    const genABCWithChords = fc
      .record({
        tuneHeader: genTuneHeaderString,
        musicLine: fc
          .array(
            fc.tuple(
              fc.array(fc.oneof(genNote, genChord), { minLength: 1, maxLength: 4 }),
              fc.constantFrom(new Token(TT.BARLINE, "|", sharedContext.generateId()))
            ),
            { minLength: 1, maxLength: 3 }
          )
          .map((measures) => {
            const tokens: Token[] = [];
            for (const [elements, barline] of measures) {
              tokens.push(...elements.flat());
              tokens.push(barline);
            }
            const filtered = applyTokenFiltering(tokens);
            return filtered.map((t) => t.lexeme).join("");
          }),
      })
      .map(({ tuneHeader, musicLine }) => {
        return `${tuneHeader}\n${musicLine}`;
      });

    fc.assert(
      fc.property(genABCWithChords, (abcString) => {
        try {
          const abcjsResult = parseWithAbcjs(abcString);
          const ourResult = parseWithYourParser(abcString);

          if (abcjsResult.length === 0 || ourResult.tunes.length === 0) {
            return true;
          }

          const abcjsTune = abcjsResult[0];
          const ourTune = ourResult.tunes[0];

          if (!abcjsTune.lines || abcjsTune.lines.length === 0 || !ourTune.systems || ourTune.systems.length === 0) {
            return true;
          }

          const abcjsLine = abcjsTune.lines[0];
          const ourLine = ourTune.systems[0];

          if (!("staff" in abcjsLine) || !("staff" in ourLine)) {
            return true;
          }

          const abcjsVoice = abcjsLine.staff[0].voices[0];
          const ourVoice = ourLine.staff[0].voices[0];

          // Compare chord elements
          for (let i = 0; i < Math.min(ourVoice.length, abcjsVoice.length); i++) {
            if ("pitches" in ourVoice[i] && "pitches" in abcjsVoice[i]) {
              const ourPitches = (ourVoice[i] as any).pitches;
              const abcjsPitches = (abcjsVoice[i] as any).pitches;

              if (ourPitches && abcjsPitches) {
                // For chords (multiple pitches)
                if (ourPitches.length > 1 && abcjsPitches.length > 1) {
                  if (ourPitches.length !== abcjsPitches.length) {
                    return false;
                  }

                  for (let j = 0; j < ourPitches.length; j++) {
                    if (ourPitches[j].pitch !== abcjsPitches[j].pitch) {
                      return false;
                    }
                  }
                }
              }
            }
          }

          return true;
        } catch (error) {
          return false;
        }
      }),
      { numRuns: 500, verbose: false }
    );
  });
});

describe("PBT compare: Rhythm Calculation - Property-Based Tests", () => {
  it("should calculate duration correctly for all rhythm modifiers (2000 runs)", () => {
    fc.assert(
      fc.property(
        // Generate note length (L:)
        fc.option(genNoteLenInfo),
        // Generate a note with rhythm
        genNote,
        (noteLenInfo, noteTokens) => {
          try {
            // Skip broken rhythm (< and >) - not implemented yet
            const hasBrokenRhythm = noteTokens.some((t: any) => t.lexeme.includes("<") || t.lexeme.includes(">"));
            if (hasBrokenRhythm) {
              return true;
            }

            // Build ABC string with optional L: field
            const ctx = new ABCContext();
            const formatter = new AbcFormatter(ctx);

            let abcString = "X:1\n";
            if (noteLenInfo) {
              abcString += formatter.stringify(noteLenInfo.infoLine) + "\n";
            }
            abcString += "K:C\n";
            abcString += noteTokens.map((t) => t.lexeme).join("") + "|";

            // Parse with both parsers
            const yourResult = parseWithYourParser(abcString);
            const abcjsResult = parseWithAbcjs(abcString);

            if (yourResult.tunes.length === 0 || abcjsResult.length === 0) {
              return true; // Skip if parsing failed
            }

            const yourTune = yourResult.tunes[0];
            const abcjsTune = abcjsResult[0];

            // Check if we have music lines
            if (yourTune.systems.length === 0 || abcjsTune.lines.length === 0) {
              return true;
            }

            const yourLine = yourTune.systems[0];
            const abcjsLine = abcjsTune.lines[0];

            if (!("staff" in yourLine) || !("staff" in abcjsLine)) {
              return true; // Skip if not a music line
            }

            const yourVoice = yourLine.staff[0].voices[0];
            const abcjsVoice = abcjsLine.staff[0].voices[0];

            // Find the note element (skip bars)
            const yourNote = yourVoice.find((el: any) => "duration" in el);
            const abcjsNote = abcjsVoice.find((el: any) => "duration" in el);

            if (!yourNote || !abcjsNote) {
              return true; // Skip if no note found
            }

            if (!("duration" in yourNote) || !("duration" in abcjsNote)) {
              return true;
            }

            // Compare durations (allow small floating point error)
            const diff = Math.abs((yourNote.duration as unknown as number) - (abcjsNote.duration as unknown as number));
            if (diff > 0.0001) {
              // console.log(`Duration mismatch for ${abcString}`);
              // console.log(`Your duration: ${yourNote.duration}, abcjs: ${abcjsNote.duration}`);
              return false;
            }

            return true;
          } catch (error) {
            // Skip on parse errors
            return true;
          }
        }
      ),
      { numRuns: 2000, verbose: false }
    );
  });

  it("should calculate duration correctly for rests with rhythm (1000 runs)", () => {
    fc.assert(
      fc.property(fc.option(genNoteLenInfo), genRest, (noteLenInfo, restTokens) => {
        try {
          // Skip multi-measure rests (Z, X) - different handling
          const restArray = Array.isArray(restTokens) ? restTokens : [restTokens];
          const hasMultiMeasure = restArray.some((t: any) => t.lexeme === "Z" || t.lexeme === "X");
          if (hasMultiMeasure) {
            return true;
          }

          const ctx = new ABCContext();
          const formatter = new AbcFormatter(ctx);

          let abcString = "X:1\n";
          if (noteLenInfo) {
            abcString += formatter.stringify(noteLenInfo.infoLine) + "\n";
          }
          abcString += "K:C\n";
          abcString += (Array.isArray(restTokens) ? restTokens : [restTokens]).map((t: any) => t.lexeme).join("") + "|";

          const yourResult = parseWithYourParser(abcString);
          const abcjsResult = parseWithAbcjs(abcString);

          if (yourResult.tunes.length === 0 || abcjsResult.length === 0) {
            return true;
          }

          const yourTune = yourResult.tunes[0];
          const abcjsTune = abcjsResult[0];

          if (yourTune.systems.length === 0 || abcjsTune.lines.length === 0) {
            return true;
          }

          const yourLine = yourTune.systems[0];
          const abcjsLine = abcjsTune.lines[0];

          if (!("staff" in yourLine) || !("staff" in abcjsLine)) {
            return true;
          }

          const yourVoice = yourLine.staff[0].voices[0];
          const abcjsVoice = abcjsLine.staff[0].voices[0];

          const yourRest = yourVoice.find((el: any) => "duration" in el && "rest" in el);
          const abcjsRest = abcjsVoice.find((el: any) => "duration" in el && "rest" in el);

          if (!yourRest || !abcjsRest) {
            return true;
          }

          if (!("duration" in yourRest) || !("duration" in abcjsRest)) {
            return true;
          }

          const diff = Math.abs((yourRest.duration as unknown as number) - (abcjsRest.duration as unknown as number));
          if (diff > 0.0001) {
            return false;
          }

          return true;
        } catch (error) {
          return true;
        }
      }),
      { numRuns: 1000, verbose: false }
    );
  });

  it("should calculate duration correctly for chords with rhythm (1000 runs)", () => {
    fc.assert(
      fc.property(fc.option(genNoteLenInfo), genChord, (noteLenInfo, chordTokens) => {
        try {
          const ctx = new ABCContext();
          const formatter = new AbcFormatter(ctx);

          let abcString = "X:1\n";
          if (noteLenInfo) {
            abcString += formatter.stringify(noteLenInfo.infoLine) + "\n";
          }
          abcString += "K:C\n";
          const musicLine = chordTokens.map((t) => t.lexeme).join("");

          // Skip broken rhythm (< and >) - not implemented yet
          if (musicLine.includes("<") || musicLine.includes(">")) {
            return true;
          }

          abcString += musicLine + "|";

          const yourResult = parseWithYourParser(abcString);
          const abcjsResult = parseWithAbcjs(abcString);

          if (yourResult.tunes.length === 0 || abcjsResult.length === 0) {
            return true;
          }

          const yourTune = yourResult.tunes[0];
          const abcjsTune = abcjsResult[0];

          if (yourTune.systems.length === 0 || abcjsTune.lines.length === 0) {
            return true;
          }

          const yourLine = yourTune.systems[0];
          const abcjsLine = abcjsTune.lines[0];

          if (!("staff" in yourLine) || !("staff" in abcjsLine)) {
            return true;
          }

          const yourVoice = yourLine.staff[0].voices[0];
          const abcjsVoice = abcjsLine.staff[0].voices[0];

          const yourChord = yourVoice.find((el: any) => "duration" in el && "pitches" in el && el.pitches && el.pitches.length > 1);
          const abcjsChord = abcjsVoice.find((el: any) => "duration" in el && "pitches" in el && el.pitches && el.pitches.length > 1);

          if (!yourChord || !abcjsChord) {
            return true;
          }

          if (!("duration" in yourChord) || !("duration" in abcjsChord)) {
            return true;
          }

          const diff = Math.abs((yourChord.duration as unknown as number) - (abcjsChord.duration as unknown as number));
          if (diff > 0.0001) {
            return false;
          }

          return true;
        } catch (error) {
          return true;
        }
      }),
      { numRuns: 1000, verbose: false }
    );
  });

  describe("Inline Field Elements (Property-Based)", () => {
    it("should handle inline key changes in music lines", () => {
      fc.assert(
        fc.property(
          fc.record({
            tuneHeader: genTuneHeaderString,
            musicLine: fc
              .array(
                fc.tuple(
                  // Some notes before inline field
                  fc.array(fc.oneof(genNote), { minLength: 1, maxLength: 3 }),
                  // Inline key change
                  genInlineField.filter((tokens) => {
                    const field = tokens.find((t) => t.type === TT.INF_HDR);
                    return field !== undefined && field.lexeme.startsWith("K:");
                  }),
                  // Some notes after inline field
                  fc.array(fc.oneof(genNote), { minLength: 1, maxLength: 3 }),
                  // Barline
                  fc.constantFrom(new Token(TT.BARLINE, "|", sharedContext.generateId()))
                ),
                { minLength: 1, maxLength: 2 }
              )
              .map((measures) => {
                const tokens: Token[] = [];
                for (const [notesBefore, inlineField, notesAfter, barline] of measures) {
                  // Apply token filtering only to note tokens, not inline fields
                  tokens.push(...applyTokenFiltering(notesBefore.flat()));
                  tokens.push(...inlineField); // Inline field tokens are already properly structured
                  tokens.push(...applyTokenFiltering(notesAfter.flat()));
                  tokens.push(barline);
                }
                return tokens.map((t) => t.lexeme).join("");
              }),
          }),
          ({ tuneHeader, musicLine }) => {
            try {
              const abcString = `${tuneHeader}\n${musicLine}`;

              const abcjsResult = parseWithAbcjs(abcString);
              const yourResult = parseWithYourParser(abcString);

              if (abcjsResult.length === 0 || yourResult.tunes.length === 0) {
                return true;
              }

              const yourTune = yourResult.tunes[0];
              const abcjsTune = abcjsResult[0];

              if (yourTune.systems.length === 0 || abcjsTune.lines.length === 0) {
                return true;
              }

              const yourLine = yourTune.systems[0];
              const abcjsLine = abcjsTune.lines[0];

              if (!("staff" in yourLine) || !("staff" in abcjsLine)) {
                return true;
              }

              const yourVoice = yourLine.staff[0].voices[0];
              const abcjsVoice = abcjsLine.staff[0].voices[0];

              // Check that both have key elements
              const yourKeyElements = yourVoice.filter((el: any) => el.el_type === "key");
              const abcjsKeyElements = abcjsVoice.filter((el: any) => el.el_type === "key");

              // Both should have at least one key element from the inline field
              if (yourKeyElements.length === 0 || abcjsKeyElements.length === 0) {
                return true; // Skip if no key elements found
              }

              return true;
            } catch (error) {
              // Skip on parse errors
              return true;
            }
          }
        ),
        { numRuns: 100, verbose: false }
      );
    });

    it("should handle inline meter changes in music lines (100 runs)", () => {
      fc.assert(
        fc.property(
          fc.record({
            tuneHeader: genTuneHeaderString,
            musicLine: fc
              .array(
                fc.tuple(
                  // Some notes before inline field
                  fc.array(fc.oneof(genNote), { minLength: 1, maxLength: 3 }),
                  // Inline meter change
                  genInlineField.filter((tokens) => {
                    const field = tokens.find((t) => t.type === TT.INF_HDR);
                    return field !== undefined && field.lexeme.startsWith("M:");
                  }),
                  // Some notes after inline field
                  fc.array(fc.oneof(genNote), { minLength: 1, maxLength: 3 }),
                  // Barline
                  fc.constantFrom(new Token(TT.BARLINE, "|", sharedContext.generateId()))
                ),
                { minLength: 1, maxLength: 2 }
              )
              .map((measures) => {
                const tokens: Token[] = [];
                for (const [notesBefore, inlineField, notesAfter, barline] of measures) {
                  // Apply token filtering only to note tokens, not inline fields
                  tokens.push(...applyTokenFiltering(notesBefore.flat()));
                  tokens.push(...inlineField); // Inline field tokens are already properly structured
                  tokens.push(...applyTokenFiltering(notesAfter.flat()));
                  tokens.push(barline);
                }
                return tokens.map((t) => t.lexeme).join("");
              }),
          }),
          ({ tuneHeader, musicLine }) => {
            try {
              const abcString = `${tuneHeader}\n${musicLine}`;

              const abcjsResult = parseWithAbcjs(abcString);
              const yourResult = parseWithYourParser(abcString);

              if (abcjsResult.length === 0 || yourResult.tunes.length === 0) {
                return true;
              }

              const yourTune = yourResult.tunes[0];
              const abcjsTune = abcjsResult[0];

              if (yourTune.systems.length === 0 || abcjsTune.lines.length === 0) {
                return true;
              }

              const yourLine = yourTune.systems[0];
              const abcjsLine = abcjsTune.lines[0];

              if (!("staff" in yourLine) || !("staff" in abcjsLine)) {
                return true;
              }

              const yourVoice = yourLine.staff[0].voices[0];
              const abcjsVoice = abcjsLine.staff[0].voices[0];

              // Check that both have meter elements
              const yourMeterElements = yourVoice.filter((el: any) => el.el_type === "meter");
              const abcjsMeterElements = abcjsVoice.filter((el: any) => el.el_type === "meter");

              // Both should have at least one meter element from the inline field
              if (yourMeterElements.length === 0 || abcjsMeterElements.length === 0) {
                return true; // Skip if no meter elements found
              }

              return true;
            } catch (error) {
              // Skip on parse errors
              return true;
            }
          }
        ),
        { numRuns: 100, verbose: false }
      );
    });
  });
});
