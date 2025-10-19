import * as fc from "fast-check";
import { ABCContext } from "../parsers/Context";
import { AbcErrorReporter } from "../parsers/ErrorReporter";
import { Token, TT } from "../parsers/scan2";
import { KV, Binary } from "../types/Expr2";
import { genPitch } from "./scn_pbt.generators.spec";

// Create a shared context for all generators
export const sharedContext = new ABCContext(new AbcErrorReporter());

// Local EOL generator to avoid circular imports
const genEOL = fc.constantFrom(new Token(TT.EOL, "\n", sharedContext.generateId()));

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
    // Random valid identifiers (excluding patterns that look like absolute pitches)
    fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_]{2,15}$/).filter((id) => !/^[A-Ga-g][#b]?[0-9]/.test(id)) // Exclude absolute pitch patterns
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
 * Generator for ANNOTATION tokens - quoted text like "Allegro", "Slowly"
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
  .map((literal) => new Token(TT.ANNOTATION, literal, sharedContext.generateId()));

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
 * Generator for AbsolutePitch tokens - NOTE_LETTER + optional ACCIDENTAL + optional NUMBER
 * Examples: G4, F#5, Bb3, C
 * Used in tempo markings like Q: G4=120
 */
export const genAbsolutePitch = fc
  .tuple(
    // Note letter (A-G)
    fc.constantFrom("A", "B", "C", "D", "E", "F", "G").map((note) => new Token(TT.NOTE_LETTER, note, sharedContext.generateId())),
    // Optional accidental (# or b)
    fc.option(fc.constantFrom("#", "b").map((acc) => new Token(TT.ACCIDENTAL, acc, sharedContext.generateId()))),
    // Optional octave (0-9)
    fc.option(fc.integer({ min: 0, max: 9 }).map((oct) => new Token(TT.NUMBER, oct.toString(), sharedContext.generateId())))
  )
  .map(([note, accidental, octave]) => {
    const tokens = [note];
    if (accidental) tokens.push(accidental);
    if (octave) tokens.push(octave);
    return tokens;
  });

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
          fc.oneof(
            // C is special literal in key context
            fc.constantFrom("C").map((root) => new Token(TT.SPECIAL_LITERAL, root, sharedContext.generateId())),
            // Other note names are NOTE_LETTER tokens
            fc.constantFrom("D", "E", "F", "G", "A", "B").map((root) => new Token(TT.NOTE_LETTER, root, sharedContext.generateId()))
          ),
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
    ),
    genEOL
  )
  .map(([header, leadingWs, keyParts, modifiers, eol]) => [header, ...(leadingWs ? [leadingWs] : []), ...keyParts, ...modifiers.flat()]);

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
    ),
    genEOL
  )
  .map(([header, ws, content, eol]) => [header, ...(ws ? [ws] : []), ...(Array.isArray(content) ? content : [content])]);

// Note length info: L: 1/4
export const genNoteLenInfoLine2 = fc
  .tuple(fc.constantFrom(new Token(TT.INF_HDR, "L:", sharedContext.generateId())), fc.option(genWhitespace), genNumber, genSlash, genNumber, genEOL)
  .map(([header, ws, num, slash, denom, eol]) => [header, ...(ws ? [ws] : []), num, slash, denom]);

// Tempo info: Q: "Allegro" 1/4=120
export const genTempoInfoLine2 = fc
  .tuple(
    fc.constantFrom(new Token(TT.INF_HDR, "Q:", sharedContext.generateId())),
    fc.array(
      fc.tuple(
        fc.oneof(
          genStringLiteral,
          fc.tuple(genNumber, genSlash, genNumber, genEql, genNumber).map(([num, slash, denom, eq, bpm]) => [num, slash, denom, eq, bpm]),
          // AbsolutePitch tempo markings like G4=120
          fc.tuple(genAbsolutePitch, genEql, genNumber).map(([pitch, eq, bpm]) => [...pitch, eq, bpm]),
          genNumber // standalone BPM
        ),
        genWhitespace
      ),
      { minLength: 1, maxLength: 3 }
    ),
    genEOL
  )
  .map(([header, parts, eol]) => [header, ...parts.flat().flat()]);

/**
 * Generator for generic info lines (T:, A:, C:, O:, etc.)
 */
export const genGenericInfoLine = fc
  .tuple(
    fc
      .constantFrom("T:", "A:", "C:", "O:", "P:", "S:", "N:", "G:", "H:", "R:", "B:", "D:", "F:", "I:", "Z:")
      .map((header) => new Token(TT.INF_HDR, header, sharedContext.generateId())),
    fc.stringMatching(/^[^&\s%\n]+$/).map((content) => new Token(TT.INFO_STR, content, sharedContext.generateId())),
    genEOL
  )
  .map(([header, content, eol]) => [header, content]);

/**
 * Generator for complete info lines using proper syntax-aware generators
 * This replaces the broken genUnifiedInfoToken approach with valid grammar-based generation
 */
export const genInfoLine2 = fc
  .tuple(genEOL, fc.oneof(genKeyInfoLine2, genMeterInfoLine2, genNoteLenInfoLine2, genTempoInfoLine2, genGenericInfoLine), genEOL)
  .map(([EOL2, tokArr, EOL]) => [EOL2, ...tokArr, EOL]);

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
 * Generator for expression arrays (what parseInfoLine2 returns)
 */
export const genExprArray = fc.array(fc.oneof(genKVExpr, genBinaryExpr), { minLength: 1, maxLength: 10 });

/**
 * Generator for specific info line expression patterns
 */

// Key info expressions: C major clef=treble
export const genKeyExprArray = fc.array(
  fc.oneof(
    // Key signature parts
    fc.oneof(
      // C as special literal
      fc.constant(new KV(sharedContext.generateId(), new Token(TT.SPECIAL_LITERAL, "C", sharedContext.generateId()))),
      // Other note letters
      fc
        .constantFrom("D", "E", "F", "G", "A", "B")
        .map((val) => new KV(sharedContext.generateId(), new Token(TT.NOTE_LETTER, val, sharedContext.generateId()))),
      // none as identifier
      fc.constant(new KV(sharedContext.generateId(), new Token(TT.IDENTIFIER, "none", sharedContext.generateId())))
    ),
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

// ========================
// Directive generators for stylesheet directives (%%directive content)
// ========================

/**
 * Generator for MEASUREMENT_UNIT tokens - alpha-only strings used as units
 * Examples: "in", "cm", "pt", "mm", "px"
 */
export const genMeasurementUnit =
  // fc;
  // .oneof(
  // Common measurement units
  fc
    .constantFrom("in", "cm", "pt", "mm", "px", "em", "ex")
    // Random alpha-only units
    // fc.stringMatching(/^[a-zA-Z]{1,4}$/)
    // )
    .map((unit) => new Token(TT.MEASUREMENT_UNIT, unit, sharedContext.generateId()));

/**
 * Generator for number with measurement unit - number immediately followed by unit
 * Examples: 12in, 5.5cm, 100pt
 * Produces: [TT.NUMBER, TT.MEASUREMENT_UNIT] token pair
 */
export const genNumberWithUnit = fc.tuple(genNumber, genMeasurementUnit).map(([number, unit]) => [number, unit]);

/**
 * Generator for directive-specific identifiers (with hyphens allowed)
 * Examples: font-size, line-height, staff-width
 */
export const genDirectiveIdentifier = fc
  .oneof(
    // Common directive properties
    fc.constantFrom(
      "font-size",
      "line-height",
      "staff-width",
      "scale",
      "pagewidth",
      "pageheight",
      "leftmargin",
      "rightmargin",
      "topmargin",
      "bottommargin",
      "indent",
      "musicspace",
      "parskipfac",
      "stretchlast",
      "maxshrink",
      "landscape",
      "sep",
      "bgcolor",
      "fgcolor"
    ),
    // Random identifiers with hyphens
    fc
      .tuple(fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{2,10}$/), fc.option(fc.tuple(fc.constantFrom("-"), fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]*$/))))
      .map(([first, hyphenated]) => {
        if (hyphenated) {
          const [hyphen, second] = hyphenated;
          return first + hyphen + second;
        }
        return first;
      })
  )
  .map((id) => new Token(TT.IDENTIFIER, id, sharedContext.generateId()));

/**
 * Generator for octave/transpose assignments in directives
 * Examples: transpose=2, octave=-1
 * Produces: [TT.IDENTIFIER, TT.EQL, TT.NUMBER] token sequence
 */
export const genDirectiveAssignment = fc
  .tuple(
    fc.constantFrom("transpose", "octave").map((key) => new Token(TT.IDENTIFIER, key, sharedContext.generateId())),
    genEql,
    fc.oneof(
      genNumber,
      fc.integer({ min: -12, max: 12 }).map((n) => new Token(TT.NUMBER, n.toString(), sharedContext.generateId()))
    )
  )
  .map(([key, equals, value]) => [key, equals, value]);

/**
 * Generator for rational numbers (fractions) in directives
 * Examples: 1/4, 3/8, 2/3
 * Produces: [TT.NUMBER, TT.SLASH, TT.NUMBER] token sequence
 */
export const genDirectiveRational = fc.tuple(genNumber, genSlash, genNumber).map(([numerator, slash, denominator]) => [numerator, slash, denominator]);

/**
 * Generator for simple tune-body pitch tokens (for directive content)
 * Creates pitches like ^c, _b, =f, A, g'
 */
const genDirectivePitch = fc
  .tuple(
    // Optional accidental
    fc.option(fc.constantFrom("^", "_", "=").map((acc) => new Token(TT.ACCIDENTAL, acc, sharedContext.generateId()))),
    // Note letter
    fc
      .constantFrom("a", "b", "c", "d", "e", "f", "g", "A", "B", "C", "D", "E", "F", "G")
      .map((note) => new Token(TT.NOTE_LETTER, note, sharedContext.generateId())),
    // Optional octave
    fc.option(
      fc.oneof(
        fc.constantFrom("'", "''").map((oct) => new Token(TT.OCTAVE, oct, sharedContext.generateId())),
        fc.constantFrom(",", ",,").map((oct) => new Token(TT.OCTAVE, oct, sharedContext.generateId()))
      )
    )
  )
  .map(([accidental, note, octave]) => {
    const tokens = [];
    if (accidental) tokens.push(accidental);
    tokens.push(note);
    if (octave) tokens.push(octave);
    return tokens;
  });

/**
 * Generator for complete directive content (everything after %%)
 * This combines all the different token types that can appear in directives
 * Whitespace is added systematically between token groups rather than randomly
 */
export const genDirectiveContent = fc
  .array(
    fc.oneof(
      genDirectiveIdentifier.map((token) => [token]),
      genStringLiteral.map((token) => [token]),
      genNumberWithUnit,
      genDirectiveRational,
      genDirectivePitch, // Use local pitch generator
      genDirectiveAssignment,
      genNumber.map((token) => [token])
    ),
    { minLength: 1, maxLength: 8 }
  )
  .map((tokenArrays) => {
    const flatTokens = tokenArrays.flat();
    const result = [];

    // Add systematic whitespace between token groups, but NOT between:
    // 1. NUMBER and MEASUREMENT_UNIT tokens
    // 2. Pitch token components (ACCIDENTAL, NOTE_LETTER, OCTAVE)
    for (let i = 0; i < flatTokens.length; i++) {
      result.push(flatTokens[i]);

      // Add whitespace after each token group except the last one
      if (i < flatTokens.length - 1) {
        const currentToken = flatTokens[i];
        const nextToken = flatTokens[i + 1];

        // Don't add whitespace between components of multi-token expressions:
        // 1. NUMBER and MEASUREMENT_UNIT tokens (5cm)
        const isNumberUnit = currentToken.type === TT.NUMBER && nextToken.type === TT.MEASUREMENT_UNIT;

        // 2. Pitch token components (^c, a')
        const isPitchSequence =
          (currentToken.type === TT.ACCIDENTAL && nextToken.type === TT.NOTE_LETTER) ||
          (currentToken.type === TT.NOTE_LETTER && nextToken.type === TT.OCTAVE);

        // 3. Rational number components (3/4)
        const isRationalSequence =
          (currentToken.type === TT.NUMBER && nextToken.type === TT.SLASH) || (currentToken.type === TT.SLASH && nextToken.type === TT.NUMBER);

        // 4. Assignment expression components (transpose=2)
        const isAssignmentSequence =
          (currentToken.type === TT.IDENTIFIER && nextToken.type === TT.EQL) || (currentToken.type === TT.EQL && nextToken.type === TT.NUMBER);

        if (!(isNumberUnit || isPitchSequence || isRationalSequence || isAssignmentSequence)) {
          result.push(new Token(TT.WS, " ", sharedContext.generateId()));
        }
      }
    }

    return result;
  });

/**
 * Generator for complete stylesheet directives
 * Examples: %%scale 0.75, %%pagewidth 21cm, %%transpose 2
 * Produces: [TT.STYLESHEET_DIRECTIVE, ...content tokens, TT.EOL]
 */
export const genStylesheetDirective = fc
  .tuple(
    // Directive header (%%)
    fc.constant("%%").map((directive) => new Token(TT.STYLESHEET_DIRECTIVE, directive, sharedContext.generateId())),
    // Directive content
    genDirectiveContent,
    // End of line
    genEOL
  )
  .map(([header, content, eol]) => [header, ...content, eol]);
