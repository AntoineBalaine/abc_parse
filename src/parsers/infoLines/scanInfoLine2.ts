import { advance, Ctx, isAtEnd, TT, WS, collectInvalidInfoLn } from "../scan2";
import { pEOL, pNumber, pPitch, pitch } from "../scan_tunebody";
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
    if (unsignedNumber(ctx)) continue; // 1, 4, 120
    if (singleChar(ctx, "=", TT.EQL)) continue; // =
    if (singleChar(ctx, "+", TT.PLUS)) continue; // +
    if (singleChar(ctx, "/", TT.SLASH)) continue; // /
    if (singleChar(ctx, "(", TT.LPAREN)) continue; // (
    if (singleChar(ctx, ")", TT.RPAREN)) continue; // )

    // Invalid token - use existing helper
    collectInvalidInfoLn(ctx, "Invalid token in info line");
    break;
  }

  return true;
}
function tuneBodyPitch(ctx: Ctx): boolean {
  if (!ctx.test(new RegExp(`^${pPitch.source}[%\n \t]`))) return false;
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
 */
export function identifier(ctx: Ctx): boolean {
  if (!ctx.test(/[a-zA-Z][\-a-zA-Z0-9_]*/)) return false;

  const match = /^[a-zA-Z][\-a-zA-Z0-9_]*/.exec(ctx.source.substring(ctx.current));
  if (match) {
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
function specialLiteral(ctx: Ctx): boolean {
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
 * Examples: G4, F#5, Bb3, C
 * Used in tempo markings like Q: G4=120
 */
function absolutePitch(ctx: Ctx): boolean {
  // Must start with note letter (A-G, case insensitive)
  if (!ctx.test(/[A-Ga-g][#b]?[0-9]?[= \t%\n]/)) return false;

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
