import * as fc from "fast-check";
import { ABCContext } from "../parsers/Context";
import { AbcErrorReporter } from "../parsers/ErrorReporter";
import { Token, TT } from "../parsers/scan2";
import { KV, Binary } from "../types/Expr2";

// Create a shared context for all generators
export const sharedContext = new ABCContext(new AbcErrorReporter());

/**
 * Generator for IDENTIFIER tokens - unquoted words like "treble", "major", "clef"
 */
export const genIdentifier = fc
  .oneof(
    // Common identifiers from different info line types
    fc.constantFrom(
      "treble",
      "bass",
      "alto",
      "tenor",
      "perc",
      "none",
      "major",
      "minor",
      "dorian",
      "phrygian",
      "lydian",
      "mixolydian",
      "locrian",
      "ionian",
      "aeolian",
      "maj",
      "min",
      "dor",
      "phr",
      "lyd",
      "mix",
      "loc",
      "aeo",
      "clef",
      "transpose",
      "middle",
      "stafflines",
      "staffscale",
      "style",
      "name",
      "octave",
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
    ),
    // Random valid identifiers
    fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_]{0,15}$/)
  )
  .map((id) => new Token(TT.IDENTIFIER, id, sharedContext.generateId()));

/**
 * Generator for NUMBER tokens - integers that don't start with 0
 */
export const genNumber = fc
  .oneof(
    // Common numbers in info lines
    fc.constantFrom("1", "2", "3", "4", "5", "6", "8", "12", "16", "32", "60", "120", "140"),
    // Random valid numbers (using pNumber pattern: [1-9][0-9]*)
    fc.integer({ min: 1, max: 9999 }).map(String)
  )
  .map((num) => new Token(TT.NUMBER, num, sharedContext.generateId()));

/**
 * Generator for STRING_LITERAL tokens - quoted text like "Allegro", "Slowly"
 */
export const genStringLiteral = fc
  .oneof(
    // Common tempo/style markings
    fc.constantFrom(
      '"Allegro"',
      '"Andante"',
      '"Moderato"',
      '"Largo"',
      '"Presto"',
      '"Slowly"',
      '"Fast"',
      '"Easy Swing"',
      '"ca. 60"',
      '"Tenor 1"',
      '"Bass"',
      '"Melody"',
      '"Accompaniment"'
    ),
    // Random quoted strings (avoid quotes inside)
    fc
      .string({ minLength: 1, maxLength: 20 })
      .filter((s) => !s.includes('"') && !s.includes("\n"))
      .map((s) => `"${s}"`)
  )
  .map((literal) => new Token(TT.STRING_LITERAL, literal, sharedContext.generateId()));

/**
 * Generator for SPECIAL_LITERAL tokens - C and C| for meter
 */
export const genSpecialLiteral = fc.constantFrom("C", "C|").map((literal) => new Token(TT.SPECIAL_LITERAL, literal, sharedContext.generateId()));

/**
 * Generator for basic punctuation tokens
 */
export const genEql = fc.constantFrom(new Token(TT.EQL, "=", sharedContext.generateId()));
export const genPlus = fc.constantFrom(new Token(TT.PLUS, "+", sharedContext.generateId()));
export const genSlash = fc.constantFrom(new Token(TT.SLASH, "/", sharedContext.generateId()));
export const genLParen = fc.constantFrom(new Token(TT.LPAREN, "(", sharedContext.generateId()));
export const genRParen = fc.constantFrom(new Token(TT.RPAREN, ")", sharedContext.generateId()));

/**
 * Generator for whitespace tokens
 */
export const genWhitespace = fc.stringMatching(/^[ \t]+$/).map((ws) => new Token(TT.WS, ws, sharedContext.generateId()));

/**
 * Generator for any unified info line token
 */
export const genUnifiedInfoToken = fc.oneof(
  genIdentifier,
  genNumber,
  genStringLiteral,
  genSpecialLiteral,
  genEql,
  genPlus,
  genSlash,
  genLParen,
  genRParen,
  genWhitespace
);

/**
 * Generator for complete info line content using unified tokens
 */
export const genUnifiedInfoContent = fc.array(genUnifiedInfoToken, { minLength: 1, maxLength: 20 }).filter((tokens) => {
  // Ensure we have at least one non-whitespace token
  return tokens.some((token) => token.type !== TT.WS);
});

/**
 * Generator for complete unified info lines with headers
 */
export const genUnifiedInfoLine = fc
  .tuple(
    fc.constantFrom("K:", "M:", "L:", "Q:", "V:", "T:", "C:", "A:", "O:").map((header) => new Token(TT.INF_HDR, header, sharedContext.generateId())),
    genUnifiedInfoContent
  )
  .map(([header, content]) => [header, ...content]);

/**
 * Generator for specific info line types for more targeted testing
 */

// Key info: K: C major clef=treble transpose=0
export const genKeyInfoLine2 = fc
  .tuple(
    fc.constantFrom(new Token(TT.INF_HDR, "K:", sharedContext.generateId())),
    fc.option(genWhitespace),
    fc.oneof(
      // Simple key signatures
      fc
        .tuple(
          fc.constantFrom("C", "D", "E", "F", "G", "A", "B").map((root) => new Token(TT.IDENTIFIER, root, sharedContext.generateId())),
          fc.option(fc.constantFrom("major", "minor", "maj", "min").map((mode) => new Token(TT.IDENTIFIER, mode, sharedContext.generateId())))
        )
        .map(([root, mode]) => (mode ? [root, new Token(TT.WS, " ", sharedContext.generateId()), mode] : [root])),
      // Special "none" case
      fc.constantFrom([new Token(TT.IDENTIFIER, "none", sharedContext.generateId())])
    ),
    fc.array(
      fc
        .tuple(genWhitespace, genIdentifier, genEql, fc.oneof(genIdentifier, genNumber))
        .map(([ws, key, eq, val]) => (ws ? [ws, key, eq, val] : [key, eq, val]))
    )
  )
  .map(([header, leadingWs, keyParts, modifiers]) => [header, ...(leadingWs ? [leadingWs] : []), ...keyParts, ...modifiers.flat()]);

// Meter info: M: 4/4 or M: (2+3)/8 or M: C|
export const genMeterInfoLine2 = fc
  .tuple(
    fc.constantFrom(new Token(TT.INF_HDR, "M:", sharedContext.generateId())),
    fc.option(genWhitespace),
    fc.oneof(
      // Special literals
      genSpecialLiteral,
      // Simple rationals
      fc.tuple(genNumber, genSlash, genNumber).map(([num, slash, denom]) => [num, slash, denom]),
      // Complex expressions
      fc
        .tuple(
          genLParen,
          genNumber,
          genPlus,
          genNumber,
          fc.option(fc.tuple(genPlus, genNumber).map(([plus, num]) => [plus, num])),
          genRParen,
          genSlash,
          genNumber
        )
        .map(([lparen, num1, plus1, num2, optionalTerm, rparen, slash, denom]) => [
          lparen,
          num1,
          plus1,
          num2,
          ...(optionalTerm || []),
          rparen,
          slash,
          denom,
        ])
    )
  )
  .map(([header, ws, content]) => [header, ...(ws ? [ws] : []), ...(Array.isArray(content) ? content : [content])]);

// Note length info: L: 1/4
export const genNoteLenInfoLine2 = fc
  .tuple(fc.constantFrom(new Token(TT.INF_HDR, "L:", sharedContext.generateId())), fc.option(genWhitespace), genNumber, genSlash, genNumber)
  .map(([header, ws, num, slash, denom]) => [header, ...(ws ? [ws] : []), num, slash, denom]);

// Tempo info: Q: "Allegro" 1/4=120
export const genTempoInfoLine2 = fc
  .tuple(
    fc.constantFrom(new Token(TT.INF_HDR, "Q:", sharedContext.generateId())),
    fc.array(
      fc.tuple(
        fc.oneof(
          genStringLiteral,
          fc.tuple(genNumber, genSlash, genNumber, genEql, genNumber).map(([num, slash, denom, eq, bpm]) => [num, slash, denom, eq, bpm]),
          genNumber // standalone BPM
        ),
        genWhitespace
      ),
      { minLength: 1, maxLength: 3 }
    )
  )
  .map(([header, parts]) => [header, ...parts.flat().flat()]);

// ========================
// Expression generators for parseInfoLine2
// ========================

/**
 * Generator for KV expressions (with optional key)
 */
export const genKVExpr = fc.oneof(
  // KV with key: clef=treble
  fc
    .tuple(genIdentifier, genEql, fc.oneof(genIdentifier, genStringLiteral, genNumber))
    .map(([key, eq, value]) => new KV(sharedContext.generateId(), value, key, eq)),

  // KV without key: major, C|, 120
  fc.oneof(genIdentifier, genSpecialLiteral, genNumber, genStringLiteral).map((value) => new KV(sharedContext.generateId(), value))
);

/**
 * Generator for Binary expressions
 */
export const genBinaryExpr = fc.oneof(
  // Simple rationals: 1/4
  fc.tuple(genNumber, genSlash, genNumber).map(([num, slash, denom]) => new Binary(sharedContext.generateId(), num, slash, denom)),

  // Addition: 2+3
  fc.tuple(genNumber, genPlus, genNumber).map(([left, plus, right]) => new Binary(sharedContext.generateId(), left, plus, right)),

  // Complex nested: (2+3)/4
  fc
    .tuple(
      fc.tuple(genNumber, genPlus, genNumber).map(([left, plus, right]) => new Binary(sharedContext.generateId(), left, plus, right)),
      genSlash,
      genNumber
    )
    .map(([leftExpr, slash, right]) => new Binary(sharedContext.generateId(), leftExpr, slash, right))
);

/**
 * Generator for mixed expressions (both KV and Binary)
 */
export const genMixedExpr = fc.oneof(genKVExpr, genBinaryExpr);

/**
 * Generator for expression arrays (what parseInfoLine2 returns)
 */
export const genExprArray = fc.array(genMixedExpr, { minLength: 1, maxLength: 10 });

/**
 * Generator for specific info line expression patterns
 */

// Key info expressions: C major clef=treble
export const genKeyExprArray = fc.array(
  fc.oneof(
    // Key signature parts
    fc
      .constantFrom("C", "D", "E", "F", "G", "A", "B", "none")
      .map((val) => new KV(sharedContext.generateId(), new Token(TT.IDENTIFIER, val, sharedContext.generateId()))),
    fc
      .constantFrom("major", "minor", "dorian")
      .map((val) => new KV(sharedContext.generateId(), new Token(TT.IDENTIFIER, val, sharedContext.generateId()))),
    // Modifiers
    fc.constant(
      new KV(
        sharedContext.generateId(),
        new Token(TT.IDENTIFIER, "treble", sharedContext.generateId()),
        new Token(TT.IDENTIFIER, "clef", sharedContext.generateId()),
        new Token(TT.EQL, "=", sharedContext.generateId())
      )
    )
  ),
  { minLength: 1, maxLength: 5 }
);

// Meter expressions: 4/4, (2+3+2)/8, C|
export const genMeterExprArray = fc.oneof(
  // Simple rationals
  fc.tuple(genNumber, genSlash, genNumber).map(([num, slash, denom]) => [new Binary(sharedContext.generateId(), num, slash, denom)]),

  // Special literals
  genSpecialLiteral.map((token) => [new KV(sharedContext.generateId(), token)]),

  // Complex expressions
  fc
    .tuple(
      fc.tuple(genNumber, genPlus, genNumber, fc.option(fc.tuple(genPlus, genNumber))).map(([n1, p1, n2, opt]) => {
        let expr = new Binary(sharedContext.generateId(), n1, p1, n2);
        if (opt) {
          const [p2, n3] = opt;
          expr = new Binary(sharedContext.generateId(), expr, p2, n3);
        }
        return expr;
      }),
      genSlash,
      genNumber
    )
    .map(([numerExpr, slash, denom]) => [new Binary(sharedContext.generateId(), numerExpr, slash, denom)])
);
