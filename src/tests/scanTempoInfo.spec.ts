import assert from "assert";
import * as fc from "fast-check";
import { describe, it } from "mocha";
import { Ctx, TT, Token } from "../parsers/scan2";
import { tempLn } from "../parsers/scanTempoInfo";
import { ABCContext } from "../parsers/Context";
import { sharedContext } from "./scn_pbt.generators.spec";

function createTestContext(source: string): Ctx {
  const abcContext = new ABCContext();
  return new Ctx(source, abcContext);
}

describe("scanTempoInfo", () => {
  describe("Text-only tempo markings", () => {
    it("should scan simple quoted text", () => {
      const ctx = createTestContext('"Allegro"');
      const result = tempLn(ctx);

      assert.equal(result, true);
      assert.equal(ctx.tokens[0].type, TT.TEMPO_TEXT);
      assert.equal(ctx.tokens[0].lexeme, '"Allegro"');
    });

    it("should scan text with spaces", () => {
      const ctx = createTestContext('"Bossa Nova"');
      const result = tempLn(ctx);

      assert.equal(result, true);
      assert.equal(ctx.tokens[0].type, TT.TEMPO_TEXT);
      assert.equal(ctx.tokens[0].lexeme, '"Bossa Nova"');
    });

    it("should scan empty quoted text", () => {
      const ctx = createTestContext('""');
      const result = tempLn(ctx);

      assert.equal(result, true);
      assert.equal(ctx.tokens[0].type, TT.TEMPO_TEXT);
      assert.equal(ctx.tokens[0].lexeme, '""');
    });
  });

  describe("BPM-only tempo markings", () => {
    it("should scan simple BPM number", () => {
      const ctx = createTestContext("120");
      const result = tempLn(ctx);

      assert.equal(result, true);
      assert.equal(ctx.tokens[0].type, TT.TEMPO_BPM);
      assert.equal(ctx.tokens[0].lexeme, "120");
    });

    it("should scan large BPM numbers", () => {
      const ctx = createTestContext("320");
      const result = tempLn(ctx);

      assert.equal(result, true);
      assert.equal(ctx.tokens[0].type, TT.TEMPO_BPM);
      assert.equal(ctx.tokens[0].lexeme, "320");
    });

    it("should scan small BPM numbers", () => {
      const ctx = createTestContext("40");
      const result = tempLn(ctx);

      assert.equal(result, true);
      assert.equal(ctx.tokens[0].type, TT.TEMPO_BPM);
      assert.equal(ctx.tokens[0].lexeme, "40");
    });
  });

  describe("Simple note=BPM tempo markings", () => {
    it("should scan quarter note tempo", () => {
      const ctx = createTestContext("1/4=120");
      const result = tempLn(ctx);

      assert.equal(result, true);
      assert.equal(ctx.tokens[0].type, TT.NOTE_LEN_NUM);
      assert.equal(ctx.tokens[0].lexeme, "1");
      assert.equal(ctx.tokens[1].type, TT.NOTE_LEN_DENOM);
      assert.equal(ctx.tokens[1].lexeme, "4");
      assert.equal(ctx.tokens[2].type, TT.TEMPO_BPM);
      assert.equal(ctx.tokens[2].lexeme, "120");
    });

    it("should scan eighth note tempo", () => {
      const ctx = createTestContext("1/8=200");
      const result = tempLn(ctx);

      assert.equal(result, true);
      assert.equal(ctx.tokens[0].type, TT.NOTE_LEN_NUM);
      assert.equal(ctx.tokens[0].lexeme, "1");
      assert.equal(ctx.tokens[1].type, TT.NOTE_LEN_DENOM);
      assert.equal(ctx.tokens[1].lexeme, "8");
      assert.equal(ctx.tokens[2].type, TT.TEMPO_BPM);
      assert.equal(ctx.tokens[2].lexeme, "200");
    });

    it("should scan half note tempo", () => {
      const ctx = createTestContext("1/2=240");
      const result = tempLn(ctx);

      assert.equal(result, true);
      assert.equal(ctx.tokens[0].type, TT.NOTE_LEN_NUM);
      assert.equal(ctx.tokens[0].lexeme, "1");
      assert.equal(ctx.tokens[1].type, TT.NOTE_LEN_DENOM);
      assert.equal(ctx.tokens[1].lexeme, "2");
      assert.equal(ctx.tokens[2].type, TT.TEMPO_BPM);
      assert.equal(ctx.tokens[2].lexeme, "240");
    });

    it("should scan dotted note tempo", () => {
      const ctx = createTestContext("3/8=100");
      const result = tempLn(ctx);

      assert.equal(result, true);
      assert.equal(ctx.tokens[0].type, TT.NOTE_LEN_NUM);
      assert.equal(ctx.tokens[0].lexeme, "3");
      assert.equal(ctx.tokens[1].type, TT.NOTE_LEN_DENOM);
      assert.equal(ctx.tokens[1].lexeme, "8");
      assert.equal(ctx.tokens[2].type, TT.TEMPO_BPM);
      assert.equal(ctx.tokens[2].lexeme, "100");
    });
  });

  describe("Note letter tempo markings", () => {
    it("should scan C3 tempo", () => {
      const ctx = createTestContext("C3=120");
      const result = tempLn(ctx);

      assert.equal(result, true);
      assert.equal(ctx.tokens[0].type, TT.TEMPO_NOTE_LETTER);
      assert.equal(ctx.tokens[0].lexeme, "C3");
      assert.equal(ctx.tokens[1].type, TT.TEMPO_BPM);
      assert.equal(ctx.tokens[1].lexeme, "120");
    });

    it("should scan different note letters", () => {
      const ctx = createTestContext("G4=96");
      const result = tempLn(ctx);

      assert.equal(result, true);
      assert.equal(ctx.tokens[0].type, TT.TEMPO_NOTE_LETTER);
      assert.equal(ctx.tokens[0].lexeme, "G4");
      assert.equal(ctx.tokens[1].type, TT.TEMPO_BPM);
      assert.equal(ctx.tokens[1].lexeme, "96");
    });
  });

  describe("Complex note sequences", () => {
    it("should scan multiple note values", () => {
      const ctx = createTestContext("4/8 3/8 4/8=70");
      const result = tempLn(ctx);

      assert.equal(result, true);

      // First note: 4/8
      assert.equal(ctx.tokens[0].type, TT.NOTE_LEN_NUM);
      assert.equal(ctx.tokens[0].lexeme, "4");
      assert.equal(ctx.tokens[1].type, TT.NOTE_LEN_DENOM);
      assert.equal(ctx.tokens[1].lexeme, "8");

      // Second note: 3/8
      assert.equal(ctx.tokens[2].type, TT.NOTE_LEN_NUM);
      assert.equal(ctx.tokens[2].lexeme, "3");
      assert.equal(ctx.tokens[3].type, TT.NOTE_LEN_DENOM);
      assert.equal(ctx.tokens[3].lexeme, "8");

      // Third note: 4/8
      assert.equal(ctx.tokens[4].type, TT.NOTE_LEN_NUM);
      assert.equal(ctx.tokens[4].lexeme, "4");
      assert.equal(ctx.tokens[5].type, TT.NOTE_LEN_DENOM);
      assert.equal(ctx.tokens[5].lexeme, "8");

      assert.equal(ctx.tokens[6].type, TT.TEMPO_BPM);
      assert.equal(ctx.tokens[6].lexeme, "70");
    });

    it("should scan mixed note types", () => {
      const ctx = createTestContext("2/16 3/16=60");
      const result = tempLn(ctx);

      assert.equal(result, true);

      // First note: 2/16
      assert.equal(ctx.tokens[0].type, TT.NOTE_LEN_NUM);
      assert.equal(ctx.tokens[0].lexeme, "2");
      assert.equal(ctx.tokens[1].type, TT.NOTE_LEN_DENOM);
      assert.equal(ctx.tokens[1].lexeme, "16");

      // Second note: 3/16
      assert.equal(ctx.tokens[2].type, TT.NOTE_LEN_NUM);
      assert.equal(ctx.tokens[2].lexeme, "3");
      assert.equal(ctx.tokens[3].type, TT.NOTE_LEN_DENOM);
      assert.equal(ctx.tokens[3].lexeme, "16");

      assert.equal(ctx.tokens[4].type, TT.TEMPO_BPM);
      assert.equal(ctx.tokens[4].lexeme, "60");
    });
  });

  describe("Mixed text and tempo", () => {
    it("should scan text before tempo", () => {
      const ctx = createTestContext('"Easy Swing" 1/4=140');
      const result = tempLn(ctx);

      assert.equal(result, true);
      assert.equal(ctx.tokens[0].type, TT.TEMPO_TEXT);
      assert.equal(ctx.tokens[0].lexeme, '"Easy Swing"');
      assert.equal(ctx.tokens[1].type, TT.NOTE_LEN_NUM);
      assert.equal(ctx.tokens[1].lexeme, "1");
      assert.equal(ctx.tokens[2].type, TT.NOTE_LEN_DENOM);
      assert.equal(ctx.tokens[2].lexeme, "4");
      assert.equal(ctx.tokens[3].type, TT.TEMPO_BPM);
      assert.equal(ctx.tokens[3].lexeme, "140");
    });

    it("should scan text after tempo", () => {
      const ctx = createTestContext('1/4=80 "slow"');
      const result = tempLn(ctx);

      assert.equal(result, true);
      assert.equal(ctx.tokens[0].type, TT.NOTE_LEN_NUM);
      assert.equal(ctx.tokens[0].lexeme, "1");
      assert.equal(ctx.tokens[1].type, TT.NOTE_LEN_DENOM);
      assert.equal(ctx.tokens[1].lexeme, "4");
      assert.equal(ctx.tokens[2].type, TT.TEMPO_BPM);
      assert.equal(ctx.tokens[2].lexeme, "80");
      assert.equal(ctx.tokens[3].type, TT.TEMPO_TEXT);
      assert.equal(ctx.tokens[3].lexeme, '"slow"');
    });

    it("should scan text before and after tempo", () => {
      const ctx = createTestContext('"Before" 1/4=120 "After"');
      const result = tempLn(ctx);

      assert.equal(result, true);
      assert.equal(ctx.tokens[0].type, TT.TEMPO_TEXT);
      assert.equal(ctx.tokens[0].lexeme, '"Before"');
      assert.equal(ctx.tokens[1].type, TT.NOTE_LEN_NUM);
      assert.equal(ctx.tokens[1].lexeme, "1");
      assert.equal(ctx.tokens[2].type, TT.NOTE_LEN_DENOM);
      assert.equal(ctx.tokens[2].lexeme, "4");
      assert.equal(ctx.tokens[3].type, TT.TEMPO_BPM);
      assert.equal(ctx.tokens[3].lexeme, "120");
      assert.equal(ctx.tokens[4].type, TT.TEMPO_TEXT);
      assert.equal(ctx.tokens[4].lexeme, '"After"');
    });

    it("should scan complex text with tempo", () => {
      const ctx = createTestContext('"adagio" 4/8 3/8 4/8=70 "andante"');
      const result = tempLn(ctx);

      assert.equal(result, true);
      assert.equal(ctx.tokens[0].type, TT.TEMPO_TEXT);
      assert.equal(ctx.tokens[0].lexeme, '"adagio"');

      // Note sequence: 4/8 3/8 4/8
      assert.equal(ctx.tokens[1].type, TT.NOTE_LEN_NUM);
      assert.equal(ctx.tokens[1].lexeme, "4");
      assert.equal(ctx.tokens[2].type, TT.NOTE_LEN_DENOM);
      assert.equal(ctx.tokens[2].lexeme, "8");
      assert.equal(ctx.tokens[3].type, TT.NOTE_LEN_NUM);
      assert.equal(ctx.tokens[3].lexeme, "3");
      assert.equal(ctx.tokens[4].type, TT.NOTE_LEN_DENOM);
      assert.equal(ctx.tokens[4].lexeme, "8");
      assert.equal(ctx.tokens[5].type, TT.NOTE_LEN_NUM);
      assert.equal(ctx.tokens[5].lexeme, "4");
      assert.equal(ctx.tokens[6].type, TT.NOTE_LEN_DENOM);
      assert.equal(ctx.tokens[6].lexeme, "8");

      // Equals and BPM
      assert.equal(ctx.tokens[7].type, TT.TEMPO_BPM);
      assert.equal(ctx.tokens[7].lexeme, "70");
    });
  });

  describe("Whitespace handling", () => {
    it("should handle spaces around equals", () => {
      const ctx = createTestContext("1/4 = 120");
      const result = tempLn(ctx);

      assert.equal(result, true);
      assert.equal(ctx.tokens[0].type, TT.NOTE_LEN_NUM);
      assert.equal(ctx.tokens[1].type, TT.NOTE_LEN_DENOM);
      assert.equal(ctx.tokens[2].type, TT.TEMPO_BPM);
    });

    it("should handle multiple spaces", () => {
      const ctx = createTestContext("  1/4  =  120  ");
      const result = tempLn(ctx);

      assert.equal(result, true);
      assert.equal(ctx.tokens[0].type, TT.NOTE_LEN_NUM);
      assert.equal(ctx.tokens[1].type, TT.NOTE_LEN_DENOM);
      assert.equal(ctx.tokens[2].type, TT.TEMPO_BPM);
    });

    it("should handle tabs and spaces", () => {
      const ctx = createTestContext("\t1/4\t=\t120\t");
      const result = tempLn(ctx);

      assert.equal(result, true);
      assert.equal(ctx.tokens[0].type, TT.NOTE_LEN_NUM);
      assert.equal(ctx.tokens[1].type, TT.NOTE_LEN_DENOM);
      assert.equal(ctx.tokens[2].type, TT.TEMPO_BPM);
    });
  });

  describe("Real-world examples", () => {
    const realExamples = [
      '"Adagio"',
      '"Bossa Nova"',
      '"Easy Swing" 1/4=140',
      "1/2 = 240",
      "1/4=100",
      "1/4=120",
      '1/4=80 "slow"',
      "100",
      "3/8=100",
      "320",
      "4/8 3/8 4/8=70",
      "80",
      '"Before" 1/4=120 "After"',
      '"This is" 1/4=190 "Fast"',
      "C3=120",
      "C3=84",
      "C3=96",
    ];

    realExamples.forEach((example, index) => {
      it(`should scan real example ${index + 1}: ${example}`, () => {
        const ctx = createTestContext(example);
        const result = tempLn(ctx);

        assert.equal(result, true, `Failed to scan: ${example}`);
        assert.equal(ctx.tokens.length > 0, true, `No tokens produced for: ${example}`);
      });
    });
  });

  describe("Edge cases", () => {
    it("should handle empty input", () => {
      const ctx = createTestContext("");
      const result = tempLn(ctx);

      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 0);
    });

    it("should handle whitespace-only input", () => {
      const ctx = createTestContext("   ");
      const result = tempLn(ctx);

      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 0);
    });
  });
});

describe("scanTempoInfo Property-Based Tests", () => {
  // Tempo component generators
  const genTempoText = fc
    .string({ minLength: 0, maxLength: 20 })
    .filter((s) => !s.includes('"') && !s.includes("\n"))
    .map((s) => new Token(TT.TEMPO_TEXT, `"${s}"`, sharedContext.generateId()));

  const genBPMInt = fc.integer({ min: 30, max: 400 }).map((bpm) => new Token(TT.TEMPO_BPM, bpm.toString(), sharedContext.generateId()));

  const genNoteNum = fc.integer({ min: 1, max: 16 }).map((num) => new Token(TT.NOTE_LEN_NUM, num.toString(), sharedContext.generateId()));

  const genNoteDenom = fc.constantFrom(1, 2, 4, 8, 16, 32).map((denom) => new Token(TT.NOTE_LEN_DENOM, denom.toString(), sharedContext.generateId()));

  const genNoteLetter = fc
    .tuple(fc.constantFrom("A", "B", "C", "D", "E", "F", "G"), fc.integer({ min: 1, max: 9 }))
    .map(([letter, octave]) => new Token(TT.TEMPO_NOTE_LETTER, `${letter}${octave}`, sharedContext.generateId()));

  const genRationalNote = fc
    .tuple(genNoteNum, fc.constantFrom(new Token(TT.WS, "/", sharedContext.generateId())), genNoteDenom)
    .map(([num, slashToken, denom]) => {
      // Add a slash token between num and denom
      return [num, slashToken, denom];
    });

  const genNoteValue = fc.oneof(
    genRationalNote,
    genNoteLetter.map((note) => [note])
  );

  const genNoteSequence = fc.array(genNoteValue, { minLength: 1, maxLength: 4 }).map((noteValues) => {
    // Add whitespace between note values
    const result: Token[] = [];

    for (let i = 0; i < noteValues.length; i++) {
      // Add the note value tokens
      result.push(...noteValues[i]);

      // Add whitespace separator between notes (except after the last note)
      if (i < noteValues.length - 1) {
        result.push(new Token(TT.WS, " ", sharedContext.generateId()));
      }
    }

    return result;
  });

  const genTempoDefinition = fc.oneof(
    // Just BPM
    genBPMInt.map((bpm) => [bpm]),
    // Note sequence = BPM
    fc.tuple(genNoteSequence, genBPMInt).map(([notes, bpm]) => [...notes, new Token(TT.WS, "=", sharedContext.generateId()), bpm])
  );

  const genTempoLine = fc
    .tuple(fc.option(genTempoText), fc.option(genTempoDefinition), fc.option(genTempoText))
    .filter(([text1, tempoDef, text2]) => !!(text1 || tempoDef || text2)) // At least one component
    .map(([text1, tempoDef, text2]) => {
      const tokens: Token[] = [];

      if (text1) {
        tokens.push(text1);
        if (tempoDef || text2) tokens.push(new Token(TT.WS, " ", sharedContext.generateId()));
      }

      if (tempoDef) {
        tokens.push(...tempoDef);
        if (text2) tokens.push(new Token(TT.WS, " ", sharedContext.generateId()));
      }

      if (text2) {
        tokens.push(text2);
        // Removed the trailing space after the last text element
      }

      return tokens;
    });

  function createRoundTripPredicate(tokens: Token[]): boolean {
    // Convert tokens to string
    const input = tokens
      .map((t) => {
        if (t.type === TT.TEMPO_NOTE_NUM) {
          t.lexeme += "/";
        }
        return t.lexeme;
      })
      .join("");

    // Skip empty inputs
    if (input.trim() === "") return true;

    // Scan the input
    const ctx = createTestContext(input);
    const result = tempLn(ctx);

    if (!result) {
      console.log("Parsing failed for input:", {
        input,
        originalTokens: tokens.map((t) => `${TT[t.type]}:${t.lexeme}`),
        source: ctx.source,
      });
      return false;
    }

    // Filter out whitespace tokens from both original and scanned
    // This includes the slash tokens in the original input since they're
    // just whitespace tokens with '/' lexeme that get consumed by the parser
    const originalFiltered = tokens.filter((t) => t.type !== TT.WS);
    const scannedFiltered = ctx.tokens.filter((t) => t.type !== TT.WS);

    // Compare token counts
    if (originalFiltered.length !== scannedFiltered.length) {
      console.log("Token count mismatch:", {
        input,
        originalCount: originalFiltered.length,
        scannedCount: scannedFiltered.length,
        originalTokens: originalFiltered.map((t) => `${TT[t.type]}:${t.lexeme}`),
        scannedTokens: scannedFiltered.map((t) => `${TT[t.type]}:${t.lexeme}`),
        originalFull: tokens.map((t) => `${TT[t.type]}:${t.lexeme}`),
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
          originalToken: `${TT[orig.type]}:${orig.lexeme}`,
          scannedToken: `${TT[scanned.type]}:${scanned.lexeme}`,
          allOriginalTokens: originalFiltered.map((t) => `${TT[t.type]}:${t.lexeme}`),
          allScannedTokens: scannedFiltered.map((t) => `${TT[t.type]}:${t.lexeme}`),
        });
        return false;
      }
    }

    return true;
  }

  it("should produce equivalent tokens when rescanning tempo lines", () => {
    fc.assert(fc.property(genTempoLine, createRoundTripPredicate), {
      verbose: false,
      numRuns: 1000,
    });
  });

  it("should always succeed on valid tempo patterns", () => {
    fc.assert(
      fc.property(genTempoLine, (tokens) => {
        const input = tokens.map((t) => t.lexeme).join("");
        if (input.trim() === "") return true;

        const ctx = createTestContext(input);
        const result = tempLn(ctx);

        if (result !== true) {
          console.log("Failed to scan valid tempo pattern:", {
            input,
            inputTokens: tokens.map((t) => `${TT[t.type]}:${t.lexeme}`),
            parsedTokens: ctx.tokens.map((t) => `${TT[t.type]}:${t.lexeme}`),
            source: ctx.source,
          });
        }

        return result === true;
      }),
      {
        verbose: false,
        numRuns: 1000,
      }
    );
  });

  it("should never crash on generated tempo lines", () => {
    fc.assert(
      fc.property(genTempoLine, (tokens) => {
        try {
          const input = tokens.map((t) => t.lexeme).join("");
          const ctx = createTestContext(input);
          tempLn(ctx);
          return true;
        } catch (error) {
          // TypeScript-safe error handling
          const errorMessage = error instanceof Error ? error.message : String(error);
          const errorStack = error instanceof Error ? error.stack : "No stack trace";

          console.log("Crash on input:", {
            input: tokens.map((t) => t.lexeme).join(""),
            tokens: tokens.map((t) => `${TT[t.type]}:${t.lexeme}`),
            error: {
              message: errorMessage,
              stack: errorStack,
            },
          });
          return false;
        }
      }),
      {
        verbose: false,
        numRuns: 1000,
      }
    );
  });
});
