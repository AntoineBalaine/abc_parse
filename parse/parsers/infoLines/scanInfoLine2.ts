import { advance, Ctx, isAtEnd, TT, WS, collectInvalidInfoLn, EOL } from "../scan2";
import { pEOL, pPitch, pitch, pSectionBrk, pInfoLine, comment } from "../scan_tunebody";
import { infoHeader } from "./infoLnHelper";

/**
 * Unified info line scanner using generic token types
 *
 * This scanner produces a generic token stream that can be used by
 * a unified parser to handle all info line types (K:, M:, L:, Q:, V:).
 *
 * Replaces the type-specific sub-scanners with a single generic approach.
 */
export function scanInfoLine2(ctx: Ctx): boolean {
  if (!infoHeader(ctx)) return false;

  while (!(isAtEnd(ctx) || ctx.test(pEOL) || ctx.test("%"))) {
    if (WS(ctx)) continue;
    if (specialLiteral(ctx)) continue; // C, C|
    if (absolutePitch(ctx)) continue; // G4, F#5, Bb3 (note + optional accidental + optional numeric octave)
    if (tuneBodyPitch(ctx)) continue; // Tune body pitches: ^c, _b, =f (for key info explicit accidentals)
    if (identifier(ctx)) continue; // abc, treble, major
    if (stringLiteral(ctx)) continue; // "Allegro"
    if (singleChar(ctx, "=", TT.EQL)) continue; // =
    if (singleChar(ctx, "-", TT.MINUS)) continue; // +
    if (singleChar(ctx, "+", TT.PLUS)) continue; // +
    if (singleChar(ctx, "/", TT.SLASH)) continue; // /
    if (singleChar(ctx, "(", TT.LPAREN)) continue; // (
    if (singleChar(ctx, ")", TT.RPAREN)) continue; // )
    if (unsignedNumber(ctx)) continue; // 1, 4, 120

    // Invalid token - use existing helper
    collectInvalidInfoLn(ctx, "Invalid token in info line");
    break;
  }

  return true;
}
export function tuneBodyPitch(ctx: Ctx): boolean {
  // Pattern requires pitch followed by: terminator OR accidental-before-note OR end-of-input
  // Terminators: whitespace, comment, newline, closing bracket
  // Accidental-before-note: ^/_ /= followed by a note letter (for consecutive accidentals like K:^c_B^G)
  // This prevents matching A_00 as pitch+invalid (would match A because _ is followed by digit, not note)
  if (!ctx.test(new RegExp(`^${pPitch.source}([%\\n \\t\\]]|[\\^_=][A-Ga-g]|$)`))) return false;
  return pitch(ctx);
}

/**
 * Helper function to scan a single character and push the corresponding token type
 */
export function singleChar(ctx: Ctx, char: string, tokenType: TT): boolean {
  if (!ctx.test(char)) return false;

  advance(ctx);
  ctx.push(tokenType);
  return true;
}

/**
 * Scan identifier: unquoted words like "treble", "major", "clef"
 * Important: Identifiers stop at underscore or caret followed by a note letter
 * to allow parsing explicit accidentals in key signatures (e.g., K:DMix_B_e)
 */
export function identifier(ctx: Ctx): boolean {
  // Initial test: must start with a letter followed by more identifier chars
  // Note: The detailed matching is done in the exec below
  if (!ctx.test(/[a-zA-Z][\-a-zA-Z0-9_]*/)) return false;

  // Match identifier but stop at underscore/caret followed by note letter
  // This allows K:DMix_B_e to parse as D + Mix + _B + _e
  const match = /^[a-zA-Z](?:[\-a-zA-Z0-9]|_(?![A-Ga-g])|\^(?![A-Ga-g]))*/.exec(ctx.source.substring(ctx.current));
  if (match && match[0].length > 0) {
    ctx.current += match[0].length;
    ctx.push(TT.IDENTIFIER);
    return true;
  }
  return false;
}

/**
 * Scan string literal: quoted text like "Allegro", "Slowly"
 * Includes the quotes in the token
 */
export function stringLiteral(ctx: Ctx): boolean {
  if (!ctx.test(/"/)) return false;

  advance(ctx); // consume opening quote

  // Scan until closing quote or end of line
  while (!(isAtEnd(ctx) || ctx.test(/"/) || ctx.test(pEOL))) {
    advance(ctx);
  }

  // Consume closing quote if present
  if (ctx.test(/"/)) {
    advance(ctx);
  }

  ctx.push(TT.ANNOTATION);
  return true;
}

/**
 * Scan number: integers and floats
 * Matches: 1, 42, 1.5, 0.25, 120.0
 * Does not match: .5, 1., leading zeros like 01
 */
export function unsignedNumber(ctx: Ctx): boolean {
  // Unified regex pattern for integers and floats
  // - Integers: [1-9][0-9]* or just 0
  // - Floats: ([1-9][0-9]*|0)\.[0-9]+
  const numberPattern = /^(([1-9][0-9]*|0)(\.[0-9]+)?)/;

  const match = numberPattern.exec(ctx.source.substring(ctx.current));
  if (!match) return false;

  ctx.current += match[0].length;
  ctx.push(TT.NUMBER);
  return true;
}

/**
 * Scan special literals: C (common time) and C| (cut time)
 * These are special cases in meter info lines
 * Must be followed by whitespace, end of line, or comment
 */
export function specialLiteral(ctx: Ctx): boolean {
  // Check C| first since it contains C - must be followed by WS/EOL/comment
  if (ctx.test(/C\|(?=\s|$|%)/)) {
    advance(ctx, 2);
    ctx.push(TT.SPECIAL_LITERAL);
    return true;
  } else if (ctx.test(/C(?=\s|$|%)/)) {
    advance(ctx);
    ctx.push(TT.SPECIAL_LITERAL);
    return true;
  }

  return false;
}

/**
 * Scan absolute pitch: note letter + optional accidental + optional numeric octave
 * Examples: G4, F#5, Bb3, C, F#m (for key signatures)
 * Used in tempo markings like Q: G4=120 and key signatures like K:F#m
 *
 * Important: A letter can only follow if there's an accidental or octave,
 * OR if it's an uppercase note (A-G) followed by a mode identifier.
 * This prevents "Aa_" from being split as "A" (note) + "a_" (identifier).
 * - F#m → F (note) + # (accidental) + m (mode) - OK, accidental present
 * - Aa_ → Aa_ (identifier) - letter directly after note, no match
 * - DMix → D (note) + Mix (identifier) - OK, uppercase note + mode identifier
 * - Ador → A (note) + dor (identifier) - OK, uppercase note + mode identifier
 */
export function absolutePitch(ctx: Ctx): boolean {
  // Pattern breakdown:
  // 1. Note letter: [A-Ga-g]
  // 2. One of:
  //    - Accidental + optional octave + (terminator or letter): [#b][0-9]?[= \t%\n\]a-zA-Z]
  //    - Octave + (terminator or letter): [0-9][= \t%\n\]a-zA-Z]
  //    - Just terminator (no accidental, no octave): [= \t%\n\]]
  // OR: Uppercase note (A-G) followed by mode start (any letter except A-G which would be another note)
  // Mode names like Mix, Dor, Phr, Lyd, Loc, Ion, Aeo, min, maj, m start with letters other than A-G
  // Wrap entire pattern in non-capturing group so ctx.test()'s ^ anchor applies to both alternatives
  if (!ctx.test(/(?:[A-Ga-g]([#b][0-9]?[= \t%\n\]a-zA-Z]|[0-9][= \t%\n\]a-zA-Z]|[= \t%\n\]])|[A-G][H-Zh-z])/)) return false;

  advance(ctx); // consume note letter
  ctx.push(TT.NOTE_LETTER);

  // Optional accidental (# or b)
  if (ctx.test(/[#b]/)) {
    advance(ctx); // consume accidental
    ctx.push(TT.ACCIDENTAL);
  }

  // Optional numeric octave (0-9)
  if (ctx.test(/[0-9]/)) {
    advance(ctx); // consume octave digit
    ctx.push(TT.NUMBER);
  }

  return true;
}

/**
 * Scans continuation lines for H: (History) field.
 *
 * H: field supports free-form multi-line continuation. Continue reading
 * lines until another info line or section break is found.
 *
 * Assumption: H: is never the last info field - there's always another
 * info line (like K:) or section break before the tune body starts.
 */
export function scanHistoryField(ctx: Ctx): void {
  while (!isAtEnd(ctx)) {
    // Check for section break BEFORE consuming EOL
    if (ctx.test(pSectionBrk)) break;

    // Consume EOL
    if (!EOL(ctx)) break;

    // Stop at another info line (letter + optional space + colon)
    if (ctx.test(pInfoLine)) break;

    // Scan line as free text
    while (!isAtEnd(ctx) && !ctx.test(pEOL) && !ctx.test("%")) {
      advance(ctx);
    }
    if (ctx.current > ctx.start) {
      ctx.push(TT.FREE_TXT);
    }
    comment(ctx);
  }
}
