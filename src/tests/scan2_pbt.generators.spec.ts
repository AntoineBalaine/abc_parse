import * as fc from "fast-check";
import { Ctx, Scanner2, Token, TT } from "../parsers/scan2";
import { AbcErrorReporter } from "../parsers/ErrorReporter";
import { pDuration, pitch, pPitch, scanTune } from "../parsers/scan_tunebody";

export const genNoteLetter = fc.stringMatching(/^[a-gA-G]$/).map((letter) => new Token(TT.NOTE_LETTER, letter));

export const genOctave = fc.stringMatching(/^(,+|'+)$/).map((oct) => new Token(TT.OCTAVE, oct));

export const genAccidental = fc.stringMatching(/^((\^[\^\/]?)|(_[_\/]?)|=)$/).map((acc) => new Token(TT.ACCIDENTAL, acc));

export const genRest = fc.stringMatching(/^[xXzZ]$/).map((rest) => new Token(TT.REST, rest));

// Fixed barline generator that matches scanner behavior
export const genBarline = fc.stringMatching(/^((\[\|)|(\|\])|(\|\|)|(\|))$/).map((bar) => new Token(TT.BARLINE, bar));

export const genRhythm = fc.oneof(
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
export const genPitch = fc.tuple(fc.option(genAccidental), genNoteLetter, fc.option(genOctave)).map(([acc, note, oct]) => {
  const tokens = [];
  if (acc) tokens.push(acc);
  tokens.push(note);
  if (oct) tokens.push(oct);
  return tokens;
});

export const genNote = fc.tuple(genPitch, fc.option(genRhythm)).map(([pitchTokens, rhythmTokens]) => {
  // Flatten all tokens into a single array
  return [...pitchTokens, ...(rhythmTokens || [])];
});

export const genTie = fc.constantFrom(new Token(TT.TIE, "-"));

// Tuplet generator - creates tokens for (p:q:r format
export const genTuplet = fc
  .tuple(
    fc.integer({ min: 2, max: 9 }).map(String),
    fc.option(fc.integer({ min: 1, max: 9 }).map(String)),
    fc.option(fc.integer({ min: 1, max: 9 }).map(String))
  )
  .map(([p, q, r]) => {
    // Start with the opening parenthesis and p value
    const tokens = [new Token(TT.TUPLET_LPAREN, "("), new Token(TT.TUPLET_P, p)];

    // Check if we have a second value (q or r)
    if (q) {
      tokens.push(new Token(TT.TUPLET_COLON, ":"));

      // If we have a third value (r), then the second value is q
      if (r) {
        tokens.push(new Token(TT.TUPLET_Q, q));
        tokens.push(new Token(TT.TUPLET_COLON, ":"));
        tokens.push(new Token(TT.TUPLET_R, r));
      } else {
        // If we only have two values, the second value is q
        tokens.push(new Token(TT.TUPLET_Q, q));
      }
    }

    return tokens;
  });

// Slur generator
export const genSlur = fc.constantFrom("(", ")").map((slur) => new Token(TT.SLUR, slur));

// Decoration generator
export const genDecoration = fc.stringMatching(/^[\~\.HLMOPSTuv]+$/).map((deco) => new Token(TT.DECORATION, deco));

// Symbol generator
export const genSymbol = fc.oneof(
  fc.stringMatching(/^![a-zA-Z][^\n!]*!$/).map((sym) => new Token(TT.SYMBOL, sym)),
  fc.stringMatching(/^\+[^\n\+]*\+$/).map((sym) => new Token(TT.SYMBOL, sym))
);

// Y-spacer generator
export const genYspacer = fc.tuple(fc.constantFrom(new Token(TT.Y_SPC, "y")), fc.option(genRhythm)).map(([y, rhy]) => (rhy ? [y, ...rhy] : [y]));

// Backtick spacer generator
export const genBcktckSpc = fc.constantFrom(new Token(TT.BCKTCK_SPC, "`"));

// Grace notes generator
export const genGraceGroup = fc
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
export const genInlineField = fc
  .tuple(
    fc.constantFrom(new Token(TT.INLN_FLD_LFT_BRKT, "[")),
    fc.stringMatching(/^[a-zA-Z]:$/).map((hdr) => new Token(TT.INF_HDR, hdr)),
    fc.stringMatching(/^[^\]]+$/).map((str) => new Token(TT.INFO_STR, str)),
    fc.constantFrom(new Token(TT.INLN_FLD_RGT_BRKT, "]"))
  )
  .map((tokens) => tokens);
export const genEOL = fc.constantFrom(new Token(TT.EOL, "\n"));

// Stylesheet directive generator
export const genStylesheetDirective = fc.tuple(
  fc.stringMatching(/^%%[^\n]*$/).map((str) => new Token(TT.STYLESHEET_DIRECTIVE, str)),
  genEOL
);

// Comment generator
export const genCommentToken = fc.tuple(
  fc.stringMatching(/^%[^%\n]*$/).map((str) => new Token(TT.COMMENT, str)),
  genEOL
);

export const genWhitespace = fc.stringMatching(/^[ \t]+$/).map((ws) => new Token(TT.WS, ws));
// Ampersand generator (both forms)
export const genAmpersand = fc.tuple(fc.constantFrom(new Token(TT.VOICE, "&")), genWhitespace);
export const genVoiceOvrlay = fc.constantFrom(new Token(TT.VOICE_OVRLAY, "&\n"));
export const genChord = fc
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

export const genGraceGroupWithFollower = fc
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

export const genDecorationWithFollower = fc
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

export const genAnnotation = fc
  .stringMatching(/^[^"\n]*$/) // String without quotes or newlines
  .map((text) => {
    // Create the complete quoted annotation
    const quotedText = `"${text}"`;
    return new Token(TT.ANNOTATION, quotedText);
  });

export const genInfoLine = fc
  .tuple(
    // genWhitespace,
    genEOL,
    fc.stringMatching(/^[a-wA-W]:$/).map((header) => new Token(TT.INF_HDR, header)),
    fc.stringMatching(/^[^&\s%]+$/).map((content) => new Token(TT.INFO_STR, content)),
    genEOL
  )
  .map((tokens) => tokens);

// Main token sequence generator
export const genTokenSequence = fc
  .array(
    fc.oneof(
      genNote,
      genRest.map((rest) => [rest]),
      genBarline.map((bar) => [bar]),
      // genTie.map((tie) => [tie])
      genAmpersand.map((amp) => amp),
      genVoiceOvrlay.map((ovrlay) => [ovrlay]),
      genWhitespace.map((ws) => [ws]),
      genTuplet, // Now returns an array of tokens directly
      genSlur.map((slur) => [slur]),
      genDecorationWithFollower,
      genSymbol.map((sym) => [sym]),
      genYspacer,
      genBcktckSpc.map((bck) => [bck]),
      genGraceGroupWithFollower,
      genChord,
      genAnnotation,
      { arbitrary: genInfoLine, weight: 1 },
      { arbitrary: genStylesheetDirective, weight: 1 },
      { arbitrary: genCommentToken, weight: 2 }
    )
  )
  .map((arrays) => {
    // Flatten arrays
    const flatTokens = arrays.flat();
    const result = [];

    if (flatTokens.length > 0) {
      result.push(flatTokens[0]);
    }

    for (let i = 1; i < flatTokens.length; i++) {
      const cur = flatTokens[i];
      const prev = flatTokens[i - 1];
      const next = flatTokens[i + 1];
      const test = (tok: Token, type: TT) => tok.type === type;
      const both = (type: TT) => cur.type == type && prev.type === type;
      const rewind = (type: TT, strt: number, ignores?: Array<TT>): boolean => {
        let j = strt - 1; // Start from the previous token
        while (j >= 0) {
          let token = flatTokens[j];
          if (test(token, type)) return true;
          if (ignores && ignores.includes(token.type)) {
            j--; // Only decrement if we're ignoring this token
            continue;
          }
          break;
        }
        return false;
      };

      if (test(cur, TT.VOICE) && next && test(next, TT.EOL)) continue;
      if (test(cur, TT.INF_HDR) && !rewind(TT.EOL, i)) continue;
      if (test(cur, TT.INFO_STR) && test(result[result.length - 1], TT.INF_HDR) && !(next && test(next, TT.EOL))) continue;
      if ((test(cur, TT.EOL) && rewind(TT.EOL, i, [TT.WS])) || both(TT.WS) || both(TT.BARLINE)) {
        continue;
      }
      result.push(cur);
    }

    return result;
  });
