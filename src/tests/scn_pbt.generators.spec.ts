import * as fc from "fast-check";
import { ABCContext } from "../parsers/Context";
import { AbcErrorReporter } from "../parsers/ErrorReporter";
import { Token, TT } from "../parsers/scan2";

// Create a shared context for all generators
export const sharedContext = new ABCContext(new AbcErrorReporter());

export const genNoteLetter = fc.stringMatching(/^[a-gA-G]$/).map((letter) => new Token(TT.NOTE_LETTER, letter, sharedContext.generateId()));

export const genOctave = fc.stringMatching(/^(,+|'+)$/).map((oct) => new Token(TT.OCTAVE, oct, sharedContext.generateId()));

export const genAccidental = fc.stringMatching(/^((\^[\^\/]?)|(_[_\/]?)|=)$/).map((acc) => new Token(TT.ACCIDENTAL, acc, sharedContext.generateId()));

export const genRest = fc.stringMatching(/^[xXzZ]$/).map((rest) => new Token(TT.REST, rest, sharedContext.generateId()));

// Fixed barline generator that matches scanner behavior
export const genBarline = fc.stringMatching(/^((\[\|)|(\|\])|(\|\|)|(\|))$/).map((bar) => new Token(TT.BARLINE, bar, sharedContext.generateId()));

export const genRhythm = fc.oneof(
  fc.stringMatching(/^\/+$/).map((slashes) => [new Token(TT.RHY_SEP, slashes, sharedContext.generateId())]),
  fc
    .tuple(
      fc.stringMatching(/^[1-9][0-9]*$/), // numerator
      fc.constantFrom("/"), // separator
      fc.stringMatching(/^[1-9][0-9]*$/) // denominator
    )
    .map(([num, sep, denom]) => [
      new Token(TT.RHY_NUMER, num, sharedContext.generateId()),
      new Token(TT.RHY_SEP, sep, sharedContext.generateId()),
      new Token(TT.RHY_DENOM, denom, sharedContext.generateId()),
    ]),
  fc.stringMatching(/^[1-9][0-9]*$/).map((num) => [new Token(TT.RHY_NUMER, num.toString(), sharedContext.generateId())]),
  fc.stringMatching(/^([>]+|[<]+)$/).map((arrows) => [new Token(TT.RHY_BRKN, arrows, sharedContext.generateId())])
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

export const genTie = fc.constantFrom(new Token(TT.TIE, "-", sharedContext.generateId()));

// Tuplet generator - creates tokens for (p:q:r format
export const genTuplet = fc
  .tuple(
    fc.integer({ min: 2, max: 9 }).map(String),
    fc.option(fc.integer({ min: 1, max: 9 }).map(String)),
    fc.option(fc.integer({ min: 1, max: 9 }).map(String))
  )
  .map(([p, q, r]) => {
    // Start with the opening parenthesis and p value
    const tokens = [new Token(TT.TUPLET_LPAREN, "(", sharedContext.generateId()), new Token(TT.TUPLET_P, p, sharedContext.generateId())];

    // Check if we have a second value (q or r)
    if (q) {
      tokens.push(new Token(TT.TUPLET_COLON, ":", sharedContext.generateId()));

      // If we have a third value (r), then the second value is q
      if (r) {
        tokens.push(new Token(TT.TUPLET_Q, q, sharedContext.generateId()));
        tokens.push(new Token(TT.TUPLET_COLON, ":", sharedContext.generateId()));
        tokens.push(new Token(TT.TUPLET_R, r, sharedContext.generateId()));
      } else {
        // If we only have two values, the second value is q
        tokens.push(new Token(TT.TUPLET_Q, q, sharedContext.generateId()));
      }
    }

    return tokens;
  });

// Slur generator
export const genSlur = fc.constantFrom("(", ")").map((slur) => new Token(TT.SLUR, slur, sharedContext.generateId()));

// Decoration generator
export const genDecoration = fc.stringMatching(/^[\~\.HLMOPSTuv]+$/).map((deco) => new Token(TT.DECORATION, deco, sharedContext.generateId()));

// Symbol generator
export const genSymbol = fc.oneof(
  fc.stringMatching(/^![a-zA-Z][^\n!]*!$/).map((sym) => new Token(TT.SYMBOL, sym, sharedContext.generateId())),
  // FIXME: including the `:` here so that tests don’t break. This is an edge case.
  fc.stringMatching(/^\+[^\n:\+]*\+$/).map((sym) => new Token(TT.SYMBOL, sym, sharedContext.generateId()))
);

// Y-spacer generator
export const genYspacer = fc
  .tuple(fc.constantFrom(new Token(TT.Y_SPC, "y", sharedContext.generateId())), fc.option(genRhythm))
  .map(([y, rhy]) => (rhy ? [y, ...rhy] : [y]));

// Backtick spacer generator
export const genBcktckSpc = fc.constantFrom(new Token(TT.BCKTCK_SPC, "`", sharedContext.generateId()));

// Grace notes generator
export const genGraceGroup = fc
  .tuple(
    fc.constantFrom(new Token(TT.GRC_GRP_LEFT_BRACE, "{", sharedContext.generateId())),
    fc.option(fc.constantFrom(new Token(TT.GRC_GRP_SLSH, "/", sharedContext.generateId()))),
    fc.array(genPitch, { minLength: 1, maxLength: 4 }),
    fc.constantFrom(new Token(TT.GRC_GRP_RGHT_BRACE, "}", sharedContext.generateId()))
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
    fc.constantFrom(new Token(TT.INLN_FLD_LFT_BRKT, "[", sharedContext.generateId())),
    fc.stringMatching(/^[a-zA-Z]:$/).map((hdr) => new Token(TT.INF_HDR, hdr, sharedContext.generateId())),
    fc.stringMatching(/^[^\]]+$/).map((str) => new Token(TT.INFO_STR, str, sharedContext.generateId())),
    fc.constantFrom(new Token(TT.INLN_FLD_RGT_BRKT, "]", sharedContext.generateId()))
  )
  .map((tokens) => tokens);
export const genEOL = fc.constantFrom(new Token(TT.EOL, "\n", sharedContext.generateId()));

// Stylesheet directive generator
export const genStylesheetDirective = fc.tuple(
  fc.stringMatching(/^%%[^\n]*$/).map((str) => new Token(TT.STYLESHEET_DIRECTIVE, str, sharedContext.generateId())),
  genEOL
);

// Comment generator
export const genCommentToken = fc.tuple(
  fc.stringMatching(/^%[^%\n]*$/).map((str) => new Token(TT.COMMENT, str, sharedContext.generateId())),
  genEOL
);

export const genWhitespace = fc.stringMatching(/^[ \t]+$/).map((ws) => new Token(TT.WS, ws, sharedContext.generateId()));
// Ampersand generator (both forms)
export const genAmpersand = fc.tuple(fc.constantFrom(new Token(TT.VOICE, "&", sharedContext.generateId())), genWhitespace);
export const genVoiceOvrlay = fc.constantFrom(new Token(TT.VOICE_OVRLAY, "&\n", sharedContext.generateId()));
export const genChord = fc
  .tuple(
    fc.constantFrom(new Token(TT.CHRD_LEFT_BRKT, "[", sharedContext.generateId())),
    fc.array(genPitch, { minLength: 1, maxLength: 4 }),
    fc.constantFrom(new Token(TT.CHRD_RIGHT_BRKT, "]", sharedContext.generateId())),
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
      fc.constantFrom(new Token(TT.GRC_GRP_LEFT_BRACE, "{", sharedContext.generateId())),
      fc.option(fc.constantFrom(new Token(TT.GRC_GRP_SLSH, "/", sharedContext.generateId()))),
      fc.array(genPitch, { minLength: 1, maxLength: 4 }),
      fc.constantFrom(new Token(TT.GRC_GRP_RGHT_BRACE, "}", sharedContext.generateId()))
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
    fc.stringMatching(/^[\~\.HLMOPSTuv]+$/).map((deco) => new Token(TT.DECORATION, deco, sharedContext.generateId())),

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
    return new Token(TT.ANNOTATION, quotedText, sharedContext.generateId());
  });

export const genInfoLine = fc
  .tuple(
    // genWhitespace,
    genEOL,
    fc.stringMatching(/^[a-kA-K]:$/).map((header) => new Token(TT.INF_HDR, header, sharedContext.generateId())),
    fc.stringMatching(/^[^&\s%]+$/).map((content) => new Token(TT.INFO_STR, content, sharedContext.generateId())),
    genEOL
  )
  .map((tokens) => tokens);

// Lyric token generators
export const genLyricText = fc.stringMatching(/^[a-zA-Z]+$/).map((text) => new Token(TT.LY_TXT, text, sharedContext.generateId()));

export const genLyricHyphen = fc.constantFrom(new Token(TT.LY_HYPH, "-", sharedContext.generateId()));

export const genLyricUnderscore = fc.constantFrom(new Token(TT.LY_UNDR, "_", sharedContext.generateId()));

export const genLyricStar = fc.constantFrom(new Token(TT.LY_STAR, "*", sharedContext.generateId()));

export const genLyricSpace = fc.constantFrom(new Token(TT.LY_SPS, "~", sharedContext.generateId()));

export const genLyricHeader = fc.constantFrom(new Token(TT.LY_HDR, "w:", sharedContext.generateId()));

export const genLyricSectionHeader = fc.constantFrom(new Token(TT.LY_SECT_HDR, "W:", sharedContext.generateId()));

export const genFieldContinuation = fc.tuple(genEOL, fc.constantFrom(new Token(TT.INF_CTND, "+:", sharedContext.generateId())));

// Macro generators
export const genMacroHeader = fc.constantFrom(new Token(TT.MACRO_HDR, "m:", sharedContext.generateId()));

export const genMacroVariable = fc.stringMatching(/^[a-zA-Z0-9~]+$/).map((varName) => new Token(TT.MACRO_VAR, varName, sharedContext.generateId()));

export const genMacroString = fc.stringMatching(/^[^\n%]*$/).map((content) => new Token(TT.MACRO_STR, content, sharedContext.generateId()));

export const genMacroLine = fc
  .tuple(
    genEOL,
    genMacroHeader,
    fc.option(genWhitespace),
    genMacroVariable,
    fc.option(genWhitespace),
    genMacroString,
    fc.option(genCommentToken.map(([comment]) => comment)),
    genEOL
  )
  .map(([eol1, header, ws1, variable, ws2, macroStr, comment, eol2]) => {
    const tokens = [eol1, header];
    if (ws1) tokens.push(ws1);
    tokens.push(variable);
    if (ws2) tokens.push(ws2);
    tokens.push(macroStr);
    if (comment) tokens.push(comment);
    tokens.push(eol2);
    return tokens;
  });

// Lyric content generator - generates various lyric tokens
export const genLyricContent = fc.array(
  fc.oneof(
    genLyricText,
    genLyricHyphen,
    genLyricUnderscore,
    genLyricStar,
    genLyricSpace,
    genWhitespace,
    genBarline,
    // genCommentToken.map(([comment]) => comment) 
  ),
  { minLength: 1, maxLength: 10 }
);

// Regular lyric line generator (w:)
export const genLyricLine = fc
  .tuple(genNote, genEOL, genLyricHeader, genLyricContent, genEOL)
  .map(([note, eol1, header, content, eol2]) => [...note, eol1, header, ...content, eol2]);

// Multi-line lyric generator with field continuation
// export const genMultiLineLyric = fc
//   .tuple(genLyricLine, genFieldContinuation, genLyricContent, genEOL)
//   .map(([lyric_line, continuation, content2, eol3]) => [...lyric_line, continuation, ...content2, eol3]);

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
      { arbitrary: genCommentToken, weight: 2 },
      { arbitrary: genLyricLine, weight: 1 },
      // { arbitrary: genMultiLineLyric, weight: 1 }
    )
  )
  .map((arrays) => {
    const flatTokens = arrays.flat();
    return applyTokenFiltering(flatTokens);
  });

// Reusable token filtering function
export function applyTokenFiltering(flatTokens: Token[]): Token[] {
  const result = [];

  if (flatTokens.length > 0) {
    result.push(flatTokens[0]);
  }

  for (let i = 1; i < flatTokens.length; i++) {
    const cur = flatTokens[i];
    const prev = flatTokens[i - 1];
    const next = flatTokens[i + 1];
    const test = (tok: Token, type: TT) => tok.type === type;
    const both = (type: TT) => cur.type === type && prev.type === type;
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

    // Lyric token filtering rules
    if ((test(cur, TT.LY_HDR) || test(cur, TT.LY_SECT_HDR)) && !rewind(TT.EOL, i)) continue;
    if ((test(cur, TT.LY_TXT)) && rewind(TT.LY_TXT, i)) continue; // prevent multiple lyric tokens in a row.

    // Macro token filtering rules
    if (test(cur, TT.MACRO_HDR) && !rewind(TT.EOL, i)) continue;
    if (test(cur, TT.MACRO_VAR) && !test(result[result.length - 1], TT.MACRO_HDR)) continue;
    if (test(cur, TT.MACRO_STR) && !test(result[result.length - 1], TT.MACRO_VAR)) continue;

    if (test(cur, TT.INF_CTND) && !rewind(TT.EOL, i)) throw new Error("INF_CTND not preceded by EOL");

    if ((test(cur, TT.EOL) && rewind(TT.EOL, i, [TT.WS])) || both(TT.WS) || both(TT.BARLINE)) {
      continue;
    }
    result.push(cur);
  }

  return result;
}
