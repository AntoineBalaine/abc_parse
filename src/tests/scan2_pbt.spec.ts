import * as fc from "fast-check";
import { Ctx, Scanner2, Token, TT } from "../parsers/scan2";
import { AbcErrorReporter } from "../parsers/ErrorReporter";
import { pDuration, pitch, pPitch, scanTune } from "../parsers/scan_tunebody";

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

describe("gen scan from regex", () => {
  const genNote = fc.stringMatching(new RegExp(`^${pPitch.source}(${pDuration.source})?`));
  const genRhythm = fc.stringMatching(new RegExp(`^${pDuration.source}$`));
  it("PBT - pitch", () => {
    const genPitch = fc.stringMatching(new RegExp(`^${pPitch.source}$`));
    fc.assert(
      fc.property(genPitch, (pitchStr) => {
        const ctx = new Ctx(pitchStr);
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
  const genNoteLetter = fc.stringMatching(/^[a-gA-G]$/).map((letter) => new Token(TT.NOTE_LETTER, letter));

  const genOctave = fc.stringMatching(/^(,+|'+)$/).map((oct) => new Token(TT.OCTAVE, oct));

  const genAccidental = fc.stringMatching(/^((\^[\^\/]?)|(_[_\/]?)|=)$/).map((acc) => new Token(TT.ACCIDENTAL, acc));

  const genRest = fc.stringMatching(/^[xXzZ]$/).map((rest) => new Token(TT.REST, rest));

  // Fixed barline generator that matches scanner behavior
  const genBarline = fc.stringMatching(/^((\[\|)|(\|\])|(\|\|)|(\|))$/).map((bar) => new Token(TT.BARLINE, bar));

  const genRhythm = fc.oneof(
    fc.stringMatching(/^\/+$/).map((slashes) => [new Token(TT.RHY_SEP, slashes)]),
    fc
      .tuple(
        fc.stringMatching(/^[1-9][0-9]*$/), // numerator
        fc.constantFrom("/"), // separator
        fc.stringMatching(/^[1-9][0-9]*$/) // denominator
      )
      .map(([num, sep, denom]) => [new Token(TT.RHY_NUMER, num), new Token(TT.RHY_SEP, sep), new Token(TT.RHY_DENOM, denom)]),
    fc.stringMatching(/^[1-9][0-9]*$/).map((num) => [new Token(TT.RHY_NUMER, num.toString())]),
    fc.stringMatching(/^([>]+|[<]+)$/).map((arrows) => [new Token(TT.RHY_BRKN, arrows)])
  );

  // Composite token generators
  const genPitch = fc.tuple(fc.option(genAccidental), genNoteLetter, fc.option(genOctave)).map(([acc, note, oct]) => {
    const tokens = [];
    if (acc) tokens.push(acc);
    tokens.push(note);
    if (oct) tokens.push(oct);
    return tokens;
  });

  const genNote = fc.tuple(genPitch, fc.option(genRhythm)).map(([pitchTokens, rhythmTokens]) => {
    // Flatten all tokens into a single array
    return [...pitchTokens, ...(rhythmTokens || [])];
  });

  const genTie = fc.constantFrom(new Token(TT.TIE, "-"));

  // Ampersand generator (both forms)
  const genAmpersand = fc.oneof(fc.constantFrom(new Token(TT.VOICE, "&")), fc.constantFrom(new Token(TT.VOICE_OVRLAY, "&\n")));

  // Tuplet generator
  const genTuplet = fc
    .tuple(
      fc.integer({ min: 2, max: 9 }).map(String),
      fc.option(fc.tuple(fc.constantFrom(":"), fc.integer({ min: 1, max: 9 }).map(String))),
      fc.option(fc.tuple(fc.constantFrom(":"), fc.integer({ min: 1, max: 9 }).map(String)))
    )
    .map(([p, q, r]) => {
      const qStr = q ? `${q[0]}${q[1]}` : "";
      const rStr = r ? `${r[0]}${r[1]}` : "";
      return new Token(TT.TUPLET, `(${p}${qStr}${rStr}`);
    });

  // Slur generator
  const genSlur = fc.constantFrom("(", ")").map((slur) => new Token(TT.SLUR, slur));

  // Decoration generator
  const genDecoration = fc.stringMatching(/^[\~\.HLMOPSTuv]+$/).map((deco) => new Token(TT.DECORATION, deco));

  // Symbol generator
  const genSymbol = fc.oneof(
    fc.stringMatching(/^![a-zA-Z][^\n!]*!$/).map((sym) => new Token(TT.SYMBOL, sym)),
    fc.stringMatching(/^\+[^\n\+]*\+$/).map((sym) => new Token(TT.SYMBOL, sym))
  );

  // Y-spacer generator
  const genYspacer = fc.tuple(fc.constantFrom(new Token(TT.Y_SPC, "y")), fc.option(genRhythm)).map(([y, rhy]) => (rhy ? [y, ...rhy] : [y]));

  // Backtick spacer generator
  const genBcktckSpc = fc.constantFrom(new Token(TT.BCKTCK_SPC, "`"));

  // Grace notes generator
  const genGraceGroup = fc
    .tuple(
      fc.constantFrom(new Token(TT.GRC_GRP_LEFT_BRACE, "{")),
      fc.option(fc.constantFrom(new Token(TT.GRC_GRP_SLSH, "/"))),
      fc.array(genPitch, { minLength: 1, maxLength: 4 }),
      fc.constantFrom(new Token(TT.GRC_GRP_RGHT_BRACE, "}"))
    )
    .map(([leftBrace, slashOpt, notes, rightBrace]) => {
      const tokens = [leftBrace];
      if (slashOpt) tokens.push(slashOpt);
      notes.forEach((note) => tokens.push(...note));
      tokens.push(rightBrace);
      return tokens;
    });

  // Inline field generator
  const genInlineField = fc
    .tuple(
      fc.constantFrom(new Token(TT.INLN_FLD_LFT_BRKT, "[")),
      fc.stringMatching(/^[a-zA-Z]:$/).map((hdr) => new Token(TT.INF_HDR, hdr)),
      fc.stringMatching(/^[^\]]+$/).map((str) => new Token(TT.INFO_STR, str)),
      fc.constantFrom(new Token(TT.INLN_FLD_RGT_BRKT, "]"))
    )
    .map((tokens) => tokens);
  const genEOL = fc.constantFrom(new Token(TT.EOL, "\n"));

  // Stylesheet directive generator
  const genStylesheetDirective = fc.tuple(
    fc.stringMatching(/^%%[^\n]*$/).map((str) => new Token(TT.STYLESHEET_DIRECTIVE, str)),
    genEOL
  );

  // Comment generator
  const genCommentToken = fc.tuple(
    fc.stringMatching(/^%[^%\n]*$/).map((str) => new Token(TT.COMMENT, str)),
    genEOL
  );

  const genWhitespace = fc.stringMatching(/^[ \t]+$/).map((ws) => new Token(TT.WS, ws));
  const genChord = fc
    .tuple(
      fc.constantFrom(new Token(TT.CHRD_LEFT_BRKT, "[")),
      fc.array(genPitch, { minLength: 1, maxLength: 4 }),
      fc.constantFrom(new Token(TT.CHRD_RIGHT_BRKT, "]")),
      fc.option(genRhythm)
    )
    .map(([leftBracket, pitches, rightBracket, rhythmOpt]) => {
      const tokens = [leftBracket];
      pitches.forEach((pitch) => tokens.push(...pitch));
      tokens.push(rightBracket);
      if (rhythmOpt) tokens.push(...rhythmOpt);
      return tokens;
    });

  const genGraceGroupWithFollower = fc
    .tuple(
      // The grace group
      fc.tuple(
        fc.constantFrom(new Token(TT.GRC_GRP_LEFT_BRACE, "{")),
        fc.option(fc.constantFrom(new Token(TT.GRC_GRP_SLSH, "/"))),
        fc.array(genPitch, { minLength: 1, maxLength: 4 }),
        fc.constantFrom(new Token(TT.GRC_GRP_RGHT_BRACE, "}"))
      ),
      // The follower - either a pitch or a chord (you'll need to create a chord generator)
      fc.oneof(genNote, genChord)
    )
    .map(([graceGroupTuple, follower]) => {
      // Extract grace group components
      const [leftBrace, slashOpt, pitches, rightBrace] = graceGroupTuple;

      // Combine into tokens array
      const tokens = [leftBrace];
      if (slashOpt) tokens.push(slashOpt);
      pitches.forEach((pitch) => tokens.push(...pitch));
      tokens.push(rightBrace);

      // Add the follower tokens
      return [...tokens, ...follower];
    });

  const genDecorationWithFollower = fc
    .tuple(
      // The decoration
      fc.stringMatching(/^[\~\.HLMOPSTuv]+$/).map((deco) => new Token(TT.DECORATION, deco)),

      // The follower - either a note or a chord
      fc.oneof(
        genNote,
        genChord // Use your chord generator here
      )
    )
    .map(([decoration, follower]) => {
      // Return decoration followed by the note or chord
      return [decoration, ...follower];
    });

  const genAnnotation = fc
    .stringMatching(/^[^"\n]*$/) // String without quotes or newlines
    .map((text) => {
      // Create the complete quoted annotation
      const quotedText = `"${text}"`;
      return new Token(TT.ANNOTATION, quotedText);
    });

  const genInfoLine = fc
    .tuple(
      genWhitespace,
      genEOL,
      fc.stringMatching(/^[a-zA-Z]:$/).map((header) => new Token(TT.INF_HDR, header)),
      fc.stringMatching(/^[^\n%]+$/).map((content) => new Token(TT.INFO_STR, content))
      // genEOL
    )
    .map((tokens) => tokens);

  // Main token sequence generator
  const genTokenSequence = fc
    .array(
      fc.oneof(
        genNote,
        genRest.map((rest) => [rest]),
        genBarline.map((bar) => [bar]),
        // genTie.map((tie) => [tie])
        genAmpersand.map((amp) => [amp]),
        genWhitespace.map((ws) => [ws]),
        genTuplet.map((tup) => [tup]),
        genSlur.map((slur) => [slur]),
        genDecorationWithFollower,
        genSymbol.map((sym) => [sym]),
        genYspacer,
        genBcktckSpc.map((bck) => [bck]),
        genGraceGroupWithFollower,
        genChord,
        // { arbitrary: genInfoLine, weight: 1 }, // Good luck with fitting this in
        { arbitrary: genStylesheetDirective, weight: 1 },
        { arbitrary: genCommentToken, weight: 2 }
      )
    )
    .map((arrays) => {
      // Flatten arrays
      const flatTokens = arrays.flat();
      const result = [];
      let prevIsBarline = false;
      let prevIsWhitespace = false;
      let prevIsEOL = false;

      outer: for (let i = 0; i < flatTokens.length; i++) {
        const token = flatTokens[i];
        const isBarline = token.type === TT.BARLINE;
        const isWhitespace = token.type === TT.WS;
        const isEOL = token.type === TT.EOL;

        // Skip consecutive barlines
        if (prevIsBarline && isBarline) {
          continue;
        }

        // Skip consecutive whitespace tokens
        if (prevIsWhitespace && isWhitespace) {
          continue;
        }

        if (prevIsEOL && isEOL) {
          continue;
        }
        result.push(token);
        prevIsBarline = isBarline;
        prevIsWhitespace = isWhitespace;
        prevIsEOL = isEOL;
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
          compareTokenArrays(originalTokens, rescannedTokens, input);
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
          compareTokenArrays(originalTokens, rescannedTokens, input);
          console.log("Token mismatch:", {
            input,
            original: normalizedOriginal,
            rescanned: normalizedRescanned,
          });
        }

        return isEqual;
      }),
      {
        verbose: true,
        numRuns: 100,
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
