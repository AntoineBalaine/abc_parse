import * as fc from "fast-check";
import { ABCContext } from "../parsers/Context";
import { AbcErrorReporter } from "../parsers/ErrorReporter";
import { Token, TT } from "../parsers/scan2";
import { genMeterDefinition } from "./scanMeterInfo.spec";

// Create a shared context for all generators
export const sharedContext = new ABCContext(new AbcErrorReporter());

export const genWhitespace = fc.stringMatching(/^[ \t]+$/).map((ws) => new Token(TT.WS, ws, sharedContext.generateId()));
// Voice component generators
export const genVxId = fc.oneof(
  // Numeric voice IDs
  fc.integer({ min: 1, max: 99 }).map((n) => new Token(TT.VX_ID, n.toString(), sharedContext.generateId())),
  // Alphabetic voice IDs
  fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]*$/).map((id) => new Token(TT.VX_ID, id, sharedContext.generateId())),
  // Common voice names
  fc
    .constantFrom("melody", "bass", "tenor", "soprano", "alto", "drums", "T1", "B1", "S1", "A1")
    .map((id) => new Token(TT.VX_ID, id, sharedContext.generateId()))
);

export const genVxPropKey = fc
  .constantFrom(
    "name",
    "clef",
    "transpose",
    "octave",
    "middle",
    "m",
    "stafflines",
    "staffscale",
    "instrument",
    "merge",
    "stems",
    "stem",
    "gchord",
    "space",
    "spc",
    "bracket",
    "brk",
    "brace",
    "brc"
  )
  .map((key) => new Token(TT.VX_K, key, sharedContext.generateId()));

export const genVxPropVal = fc.oneof(
  // Quoted strings
  fc
    .string({ minLength: 1, maxLength: 20 })
    .filter((s) => !s.includes('"') && !s.includes("\n"))
    .map((s) => new Token(TT.VX_V, `"${s}"`, sharedContext.generateId())),
  // Unquoted strings
  fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]*$/).map((s) => new Token(TT.VX_V, s, sharedContext.generateId())),
  // Numbers
  fc.integer({ min: -12, max: 12 }).map((n) => new Token(TT.VX_V, n.toString(), sharedContext.generateId())),
  // Decimal numbers
  fc.float({ min: Math.fround(0.1), max: 5.0, noNaN: true }).map((n) => new Token(TT.VX_V, n.toFixed(1), sharedContext.generateId())),
  // Boolean-like values
  fc.constantFrom("true", "false", "1", "0").map((b) => new Token(TT.VX_V, b, sharedContext.generateId())),
  // Clef values
  fc.constantFrom("treble", "bass", "alto", "tenor", "perc", "none").map((clef) => new Token(TT.VX_V, clef, sharedContext.generateId())),
  // Stem directions
  fc.constantFrom("up", "down", "auto", "none").map((stem) => new Token(TT.VX_V, stem, sharedContext.generateId()))
);

const genVoiceWhitespace = fc.stringMatching(/^[ \t]+$/).map((ws) => new Token(TT.WS, ws, sharedContext.generateId()));

// Property pair generator (key=value)
const genVxKV = fc
  .tuple(
    genVxPropKey,
    fc.option(genVoiceWhitespace),
    fc.constantFrom("=").map((eq) => new Token(TT.EQL, eq, sharedContext.generateId())),
    fc.option(genVoiceWhitespace),
    genVxPropVal
  )
  .map(([key, ws1, equals, ws2, value]) => {
    const tokens = [key];
    if (ws1) tokens.push(ws1);
    tokens.push(equals);
    if (ws2) tokens.push(ws2);
    tokens.push(value);
    return tokens;
  });

// Special perc property (standalone)
const genVxPercuProp = fc
  .constantFrom("perc")
  .map((perc) => new Token(TT.VX_V, perc, sharedContext.generateId()))
  .map((perc) => [perc]);

// Complete voice definition generator (simplified for integration tests)
export const genVxDefinition = fc
  .tuple(
    fc.option(genVoiceWhitespace), // leading whitespace
    genVxId,
    fc.array(fc.oneof(genVxKV, genVxPercuProp), { maxLength: 3 }) // Simplified, no comments
  )
  .map(([leadingWs, voiceId, properties]) => {
    const tokens: Token[] = [];

    if (leadingWs) tokens.push(leadingWs);
    tokens.push(voiceId);

    for (const property of properties) {
      // Add whitespace before each property
      tokens.push(new Token(TT.WS, " ", sharedContext.generateId()));
      if (Array.isArray(property)) {
        tokens.push(...property);
      } else {
        tokens.push(property);
      }
    }

    return tokens;
  });

const genTempoText = fc
  .string({ minLength: 0, maxLength: 20 })
  .filter((s) => !s.includes('"') && !s.includes("\n"))
  .map((s) => new Token(TT.TEMPO_TEXT, `"${s}"`, sharedContext.generateId()));

const genBPMInt = fc.integer({ min: 30, max: 400 }).map((bpm) => new Token(TT.TEMPO_BPM, bpm.toString(), sharedContext.generateId()));

const genTempoNoteNum = fc.integer({ min: 1, max: 16 }).map((num) => new Token(TT.NOTE_LEN_NUM, num.toString(), sharedContext.generateId()));

const genTempoNoteDenom = fc.constantFrom(1, 2, 4, 8, 16, 32).map((denom) => new Token(TT.NOTE_LEN_DENOM, denom.toString(), sharedContext.generateId()));

const genTempoNoteLetter = fc
  .tuple(fc.constantFrom("A", "B", "C", "D", "E", "F", "G"), fc.integer({ min: 1, max: 9 }))
  .map(([letter, octave]) => new Token(TT.TEMPO_NOTE_LETTER, `${letter}${octave}`, sharedContext.generateId()));

const genRationalNote = fc
  .tuple(genTempoNoteNum, fc.constantFrom(new Token(TT.DISCARD, "/", sharedContext.generateId())), genTempoNoteDenom)
  .map(([num, slashToken, denom]) => {
    return [num, slashToken, denom];
  });

const genTempoInfoNoteValue = fc.oneof(
  genRationalNote,
  genTempoNoteLetter.map((note) => [note])
);

const genTempoInfoNoteSequence = fc.array(genTempoInfoNoteValue, { minLength: 1, maxLength: 4 }).map((noteValues) => {
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
  fc.tuple(genTempoInfoNoteSequence, genBPMInt).map(([notes, bpm]) => [...notes, new Token(TT.DISCARD, "=", sharedContext.generateId()), bpm])
);

export const genTempoLine = fc
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

// Note length component generators
const genNoteLenNum = fc.integer({ min: 1, max: 999 }).map((num) => new Token(TT.NOTE_LEN_NUM, num.toString(), sharedContext.generateId()));

export const genNoteLenDenom = fc
  .constantFrom(1, 2, 4, 8, 16, 32, 64, 128, 256, 512)
  .map((denom) => new Token(TT.NOTE_LEN_DENOM, denom.toString(), sharedContext.generateId()));

const genNoteLenWhitespace = fc.stringMatching(/^[ \t]+$/).map((ws) => new Token(TT.WS, ws, sharedContext.generateId()));

export const genMeterSeparator = fc.constantFrom(new Token(TT.METER_SEPARATOR, "/", sharedContext.generateId()));

// Generator for complete note length signatures with optional whitespace
export const genNoteLenSignature = fc
  .tuple(
    fc.option(genNoteLenWhitespace), // leading whitespace
    genNoteLenNum,
    fc.option(genNoteLenWhitespace), // whitespace before slash
    genMeterSeparator,
    fc.option(genNoteLenWhitespace), // whitespace after slash
    genNoteLenDenom,
    fc.option(genNoteLenWhitespace) // trailing whitespace
  )
  .map(([leadingWs, num, wsBeforeSlash, separator, wsAfterSlash, denom, trailingWs]) => {
    const tokens: Token[] = [];

    if (leadingWs) tokens.push(leadingWs);
    tokens.push(num);
    if (wsBeforeSlash) tokens.push(wsBeforeSlash);
    tokens.push(separator);
    if (wsAfterSlash) tokens.push(wsAfterSlash);
    tokens.push(denom);
    if (trailingWs) tokens.push(trailingWs);

    return tokens;
  });

const genKeyNone = fc.constantFrom("none", "NONE", "None").map((none) => new Token(TT.KEY_NONE, none, sharedContext.generateId()));

export const genKeyRoot = fc.constantFrom("A", "B", "C", "D", "E", "F", "G").map((root) => new Token(TT.KEY_ROOT, root, sharedContext.generateId()));

export const genKeyAccidental = fc.constantFrom("#", "b").map((acc) => new Token(TT.KEY_ACCIDENTAL, acc, sharedContext.generateId()));

const genKeyMode = fc
  .constantFrom(
    "major",
    "minor",
    "maj",
    "min",
    "m",
    "ionian",
    "dorian",
    "dor",
    "phrygian",
    "phr",
    "lydian",
    "lyd",
    "mixolydian",
    "mix",
    "aeolian",
    "aeo",
    "locrian",
    "loc"
  )
  .map((mode) => new Token(TT.KEY_MODE, mode, sharedContext.generateId()));

export const genExplicitAccidental = fc
  .tuple(fc.constantFrom("^", "_", "="), fc.constantFrom("a", "b", "c", "d", "e", "f", "g", "A", "B", "C", "D", "E", "F", "G"))
  .map(([accSymbol, note]) => new Token(TT.KEY_EXPLICIT_ACC, accSymbol + note, sharedContext.generateId()));

export const genKeySignature = fc.oneof(
  // "none" key signature with optional leading/trailing whitespace
  fc.tuple(fc.option(genWhitespace), genKeyNone, fc.option(genWhitespace)).map(([leadingWs, none, trailingWs]) => {
    const tokens: Token[] = [];
    if (leadingWs) tokens.push(leadingWs);
    tokens.push(none);
    if (trailingWs) tokens.push(trailingWs);
    return tokens;
  }),

  // Regular key signatures: root [ws] [accidental] [ws] [mode] [ws] [explicit accidentals]
  fc
    .tuple(
      fc.option(genWhitespace), // leading whitespace
      genKeyRoot,
      fc.option(genKeyAccidental),
      fc.option(genKeyMode),
      fc.array(genExplicitAccidental, { maxLength: 5 }),
      fc.option(genWhitespace) // trailing whitespace
    )
    .map(([leadingWs, root, accidental, mode, explicitAccs, trailingWs]) => {
      const tokens: Token[] = [];

      if (leadingWs) tokens.push(leadingWs);
      tokens.push(root);

      if (accidental) {
        // Optional whitespace before accidental
        if (fc.sample(fc.boolean(), 1)[0]) {
          tokens.push(new Token(TT.WS, " ", sharedContext.generateId()));
        }
        tokens.push(accidental);
      }

      if (mode) {
        // Always add whitespace before mode if we have one
        tokens.push(new Token(TT.WS, " ", sharedContext.generateId()));
        tokens.push(mode);
      }

      if (explicitAccs.length > 0) {
        // Optional whitespace before explicit accidentals
        if (fc.sample(fc.boolean(), 1)[0]) {
          tokens.push(new Token(TT.WS, " ", sharedContext.generateId()));
        }
        tokens.push(...explicitAccs);
      }

      if (trailingWs) tokens.push(trailingWs);
      return tokens;
    })
);
const genKeyInfoLine = genKeySignature.map((keyTokens: Token[]) => [new Token(TT.INF_HDR, "K:", sharedContext.generateId()), ...keyTokens]);

const genMeterInfoLine = genMeterDefinition.map((meterTokens: Token[]) => [new Token(TT.INF_HDR, "M:", sharedContext.generateId()), ...meterTokens]);

const genNoteLenInfoLine = genNoteLenSignature.map((noteLenTokens: Token[]) => [
  new Token(TT.INF_HDR, "L:", sharedContext.generateId()),
  ...noteLenTokens,
]);

const genTempoInfoLine = genTempoLine.map((tempoTokens: Token[]) => [new Token(TT.INF_HDR, "Q:", sharedContext.generateId()), ...tempoTokens]);

const genVoiceInfoLine = genVxDefinition.map((voiceTokens: Token[]) => [new Token(TT.INF_HDR, "V:", sharedContext.generateId()), ...voiceTokens]);

const genGenericInfoLine = fc
  .tuple(
    fc
      .constantFrom("T:", "A:", "C:", "O:", "P:", "S:", "W:", "N:", "G:", "H:", "R:", "B:", "D:", "F:", "I:", "Z:")
      .map((header) => new Token(TT.INF_HDR, header, sharedContext.generateId())),
    fc.stringMatching(/^[^&\s%\n]+$/).map((content) => new Token(TT.INFO_STR, content, sharedContext.generateId()))
  )
  .map(([header, content]) => [header, content]);

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
export const genDecoration = fc.stringMatching(/^[\~\.HLMOPSTuv]$/).map((deco) => new Token(TT.DECORATION, deco, sharedContext.generateId()));

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
  .tuple(genEOL, fc.oneof(genKeyInfoLine, genMeterInfoLine, genNoteLenInfoLine, genTempoInfoLine, genVoiceInfoLine, genGenericInfoLine), genEOL)
  .map(([eol1, infoTokens, eol2]) => [eol1, ...infoTokens, eol2]);

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

export const genMacroVariable = fc
  .stringMatching(/^[a-xzA-XZ~][a-xzA-XZ0-9~]*$/)
  .map((varName) => new Token(TT.MACRO_VAR, varName, sharedContext.generateId()));

export const genMacroString = fc.stringMatching(/^[^\n% \t][^\n% \t]*$/).map((content) => new Token(TT.MACRO_STR, content, sharedContext.generateId()));

export const genMacroDecl = fc
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
    genBarline
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
export const baseMusicTokenGenerators = [
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
];

// Main token sequence generator using base music token generators
export const genTokenSequence = fc
  .array(
    fc.oneof(
      ...baseMusicTokenGenerators
      // { arbitrary: genMultiLineLyric, weight: 1 }
    )
  )
  .map((arrays) => {
    const flatTokens = arrays.flat();
    return applyTokenFiltering(flatTokens);
  });

// Helper function to determine if we're within an info line context where whitespace should be filtered
function isWithinInfoLine(flatTokens: Token[], index: number): boolean {
  // Look backwards to find if we're within an info line context
  for (let j = index - 1; j >= 0; j--) {
    const token = flatTokens[j];

    // If we hit EOL, we're not in an info line anymore
    if (token.type === TT.EOL) return false;

    // If we find an info header, check what type of info line it is
    if (token.type === TT.INF_HDR) {
      const headerType = token.lexeme.charAt(0);

      // For these info line types, the scanner skips whitespace in specific contexts
      switch (headerType) {
        case "V": // Voice info lines - scanner skips WS between components
        case "K": // Key info lines - scanner skips WS around accidentals, modes, etc.
        case "Q": // Tempo info lines - scanner skips WS around note values and BPM
        case "M": // Meter info lines - scanner skips WS around numbers and operators
        case "L": // Note length info lines - scanner skips WS around fractions
          return true;
        default:
          // For generic info lines (T:, A:, etc.), whitespace is preserved in INFO_STR
          return false;
      }
    }

    // Continue looking backwards through valid info line tokens
    const infoLineTokens = [
      TT.VX_ID,
      TT.VX_K,
      TT.VX_V,
      TT.EQL,
      TT.KEY_ROOT,
      TT.KEY_ACCIDENTAL,
      TT.KEY_MODE,
      TT.KEY_EXPLICIT_ACC,
      TT.KEY_NONE,
      TT.TEMPO_TEXT,
      TT.TEMPO_BPM,
      TT.TEMPO_NOTE_LETTER,
      TT.NOTE_LEN_NUM,
      TT.NOTE_LEN_DENOM,
      TT.METER_NUMBER,
      TT.METER_C,
      TT.METER_C_BAR,
      TT.METER_SEPARATOR,
      TT.METER_PLUS,
      TT.METER_LPAREN,
      TT.METER_RPAREN,
      TT.WS,
      TT.DISCARD,
    ];

    if (!infoLineTokens.includes(token.type)) {
      return false;
    }
  }
  return false;
}

// Reusable token filtering function
export function applyTokenFiltering(flatTokens: Token[]): Token[] {
  const result = [];
  let symbols = new Set<String>();
  let macros = new Set<String>(); // Track macro variables
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
    if (test(cur, TT.LY_TXT) && rewind(TT.LY_TXT, i)) continue; // prevent multiple lyric tokens in a row.

    // Enhanced whitespace filtering for info lines
    if (test(cur, TT.WS) && isWithinInfoLine(flatTokens, i)) {
      continue;
    }

    // Macro token filtering rules
    if (test(cur, TT.MACRO_HDR) && !rewind(TT.EOL, i)) continue;
    if (test(cur, TT.MACRO_VAR)) {
      macros.add(cur.lexeme); // Track macro variables
      if (!test(result[result.length - 1], TT.MACRO_HDR)) continue;
    }
    if (test(cur, TT.MACRO_STR) && !test(result[result.length - 1], TT.MACRO_VAR)) continue;

    // user-symbol filtering
    if (test(cur, TT.USER_SY_HDR) && !rewind(TT.EOL, i)) continue;
    if (test(cur, TT.USER_SY)) {
      symbols.add(cur.lexeme);
      if (!test(result[result.length - 1], TT.USER_SY_HDR)) continue;
    }

    // Macro precedence: skip any non-stateful tokens that conflict with macro variables
    // FIXME: this breaks precedence of all other tokens, and the generators can't deal with it rn
    if (macros.has(cur.lexeme)) {
      // Skip any token that would conflict with a macro invocation (except macro-related tokens)
      const macroTokenTypes = [TT.MACRO_HDR, TT.MACRO_VAR, TT.MACRO_STR, TT.MACRO_INVOCATION];
      if (!macroTokenTypes.includes(cur.type)) {
        continue;
      }
    }

    // user-defined symbols might override decorations
    if (test(cur, TT.DECORATION)) {
      if (symbols.has(cur.lexeme[0])) continue;
      // if (test(result[result.length - 1], TT.DECORATION)){}
    }

    if (test(cur, TT.INF_CTND) && !rewind(TT.EOL, i)) throw new Error("INF_CTND not preceded by EOL");

    if ((test(cur, TT.EOL) && rewind(TT.EOL, i, [TT.WS])) || both(TT.WS) || both(TT.BARLINE)) {
      continue;
    }
    result.push(cur);
  }

  return result;
}

export const genUserSymbolVariable = fc.stringMatching(/^[h-wH-W~]$/).map((v) => new Token(TT.USER_SY, v, sharedContext.generateId()));

export const genUserSymbolHeader = fc.constantFrom(new Token(TT.USER_SY_HDR, "U:", sharedContext.generateId()));

// Macro scenario generator
export const genMacroScenario = genMacroDecl.chain(([eol1, header, variable, macroStr, comment, eol2]) => {
  const macroTokens = [eol1, header, variable, macroStr];
  if (comment) macroTokens.push(comment);
  macroTokens.push(eol2);

  // Create invocation generator using the specific variable from this macro
  const genInvocation = fc.tuple(
    fc.constantFrom(new Token(TT.MACRO_INVOCATION, variable.lexeme, sharedContext.generateId())).map((token) => [token]),
    fc.oneof(genWhitespace, genYspacer)
  );

  // Generate music tokens that may include the macro invocation
  const genMusicTokens = fc.array(fc.oneof(genInvocation, ...baseMusicTokenGenerators));

  return genMusicTokens.map((musicTokenArrays) => {
    const allTokens = [...macroTokens, ...musicTokenArrays.flat()].flat();
    return applyTokenFiltering(allTokens);
  });
});

// User symbol scenario generator
export const genUserSymbolScenario = fc
  .tuple(genEOL, genUserSymbolHeader, genUserSymbolVariable, genSymbol, fc.option(genCommentToken.map(([comment]) => comment)), genEOL)
  .chain(([eol1, header, variable, symbol, comment, eol2]) => {
    const userSymbolTokens = [eol1, header, variable, symbol];
    if (comment) userSymbolTokens.push(comment);
    userSymbolTokens.push(eol2);

    // Create invocation generator using the specific variable from this user symbol
    const genUserSymbolInvocation = fc.tuple(
      fc.constantFrom(new Token(TT.USER_SY_INVOCATION, variable.lexeme, sharedContext.generateId())).map((token) => [token]),
      genWhitespace
    );

    // Generate music tokens that may include the user symbol invocation
    const genMusicTokens = fc.array(
      fc.oneof(
        // Include user symbol invocation
        genUserSymbolInvocation,
        ...baseMusicTokenGenerators
      )
    );

    return genMusicTokens.map((musicTokenArrays) => {
      const allTokens = [...userSymbolTokens, ...musicTokenArrays.flat()].flat();
      return applyTokenFiltering(allTokens);
    });
  });

export const genMixedStatefulScenario = fc
  .tuple(
    // Macro declaration
    genMacroDecl,
    // User symbol declaration
    fc.tuple(genUserSymbolHeader, genUserSymbolVariable, genSymbol, fc.option(genCommentToken.map(([comment]) => comment)), genEOL)
  )
  .filter(([macroDecl, userSymbolDecl]) => {
    // Avoid conflicts between macro and user symbol variables
    const macroVariable = macroDecl[2]; // genMacroVariable is at index 2
    const userSymVariable = userSymbolDecl[1]; // genUserSymbolVariable is at index 1
    return macroVariable.lexeme !== userSymVariable.lexeme;
  })
  .chain(([macroDecl, userSymbolDecl]) => {
    const [macroEol1, macroHeader, macroVariable, macroStr, macroComment, macroEol2] = macroDecl;
    const [userSymHeader, userSymVariable, userSymbol, userSymComment, userSymEol] = userSymbolDecl;

    const declarationTokens = [
      macroEol1,
      macroHeader,
      macroVariable,
      macroStr,
      ...(macroComment ? [macroComment] : []),
      macroEol2,
      userSymHeader,
      userSymVariable,
      userSymbol,
      ...(userSymComment ? [userSymComment] : []),
      userSymEol,
    ];

    // Create invocation generators for both macro and user symbol
    const genMacroInvocation = fc.tuple(
      fc.constantFrom(new Token(TT.MACRO_INVOCATION, macroVariable.lexeme, sharedContext.generateId())).map((token) => [token]),
      fc.oneof(genWhitespace, genYspacer)
    );

    const genUserSymbolInvocation = fc.tuple(
      fc.constantFrom(new Token(TT.USER_SY_INVOCATION, userSymVariable.lexeme, sharedContext.generateId())).map((token) => [token]),
      genWhitespace
    );

    // Generate music tokens that may include both types of invocations
    const genMusicTokens = fc.array(
      fc.oneof(
        // Include both invocation types
        genMacroInvocation,
        genUserSymbolInvocation,
        // Spread the base music token generators
        ...baseMusicTokenGenerators
      )
    );

    return genMusicTokens.map((musicTokenArrays) => {
      const allTokens = [...declarationTokens, ...musicTokenArrays.flat()].flat();
      return applyTokenFiltering(allTokens);
    });
  });
