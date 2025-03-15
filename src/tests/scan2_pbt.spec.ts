import * as fc from "fast-check";
import { Ctx, Scanner2, Token, TT } from "../parsers/scan2";
import { AbcErrorReporter } from "../parsers/ErrorReporter";
import { scanTune } from "../parsers/scan_tunebody";

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
        const tokens = Scanner2(input);
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
        const tokens = Scanner2(input, new AbcErrorReporter());

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
        const tokens = Scanner2(input, new AbcErrorReporter());

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
          Scanner2(input, new AbcErrorReporter());
          return true;
        } catch (e) {
          return false;
        }
      })
    );
  });
});

describe.skip("Scanner Round-trip Tests", () => {
  // Basic token generators
  const genNoteLetter = fc
    .constantFrom("A", "B", "C", "D", "E", "F", "G", "a", "b", "c", "d", "e", "f", "g")
    .map((letter) => ({ type: TT.NOTE_LETTER, lexeme: letter }));

  const genOctave = fc.constantFrom("'", "''", ",", ",,").map((oct) => ({ type: TT.OCTAVE, lexeme: oct }));

  const genAccidental = fc.constantFrom("^", "^^", "_", "__", "=").map((acc) => ({ type: TT.ACCIDENTAL, lexeme: acc }));

  const genRest = fc.constantFrom("z", "x", "Z", "X").map((rest) => ({ type: TT.REST, lexeme: rest }));

  // Fixed barline generator that matches scanner behavior
  const genBarline = fc.constantFrom("|", "||", "[|", "|]", ":|", "|:", "::").map((bar) => ({ type: TT.BARLINE, lexeme: bar }));

  // Separate generator for repeat numbers (to match how scanner tokenizes them)
  const genBarlineWithNumber = fc
    .tuple(
      fc.constantFrom({ type: TT.BARLINE, lexeme: "[" }),
      fc.constantFrom({ type: TT.REPEAT_NUMBER, lexeme: "1" }, { type: TT.REPEAT_NUMBER, lexeme: "2" })
    )
    .map((tokens) => tokens);

  const genRhythm = fc.nat(16).chain((n) =>
    fc.constantFrom(
      { type: TT.RHY_NUMER, lexeme: n.toString() }
      // { type: TT.RHY_SEP, lexeme: "/" },
      // { type: TT.RHY_DENOM, lexeme: (2 ** n).toString() }
    )
  );

  // Composite token generators
  const genPitch = fc.tuple(fc.option(genAccidental), genNoteLetter, fc.option(genOctave)).map(([acc, note, oct]) => {
    const tokens = [];
    if (acc) tokens.push(acc);
    tokens.push(note);
    if (oct) tokens.push(oct);
    return tokens;
  });

  const genNote = fc.tuple(genPitch, fc.option(genRhythm)).map(([pitch, rhythm]) => {
    return [...pitch, ...(rhythm ? [rhythm] : [])];
  });

  // Main token sequence generator
  const genTokenSequence = fc.array(fc.oneof(genNote, genRest, genBarline)).map((tokens) => {
    // Filter out consecutive barlines
    const result = [];
    let prevIsBarline = false;

    for (const token of tokens) {
      const isBarline = (token as Token).type === TT.BARLINE;

      if (!(prevIsBarline && isBarline)) {
        result.push(token);
      }

      prevIsBarline = isBarline;
    }

    return result;
  });

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

        // Concatenate lexemes
        const input = originalTokens.map((t) => (t as TokenLike).lexeme).join("");

        // Rescan
        const errorReporter = new AbcErrorReporter();
        let ctx = new Ctx(input);
        scanTune(ctx);
        const rescannedTokens = ctx.tokens;

        // Skip position-related properties in comparison
        const normalizeToken = (token: TokenLike): NormalizedToken => ({
          type: token.type,
          lexeme: token.lexeme,
        });

        // Compare token sequences
        const normalizedOriginal = originalTokens.map((t) => normalizeToken(t as TokenLike));
        const normalizedRescanned = rescannedTokens
          .filter((t) => t.type !== TT.EOF) // Exclude EOF token
          .map(normalizeToken);

        if (normalizedOriginal.length !== normalizedRescanned.length) {
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
          console.log("Token mismatch:", {
            input,
            original: normalizedOriginal,
            rescanned: normalizedRescanned,
          });
        }

        return isEqual && errorReporter.getErrors().length === 0;
      }),
      {
        verbose: true,
        numRuns: 100,
      }
    );
  });
});
