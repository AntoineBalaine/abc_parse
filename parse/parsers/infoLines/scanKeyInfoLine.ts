import { advance, Ctx, isAtEnd, TT, WS, collectInvalidInfoLn } from "../scan2";
import { pEOL } from "../scan_tunebody";
import { infoHeader } from "./infoLnHelper";
import { identifier, singleChar, stringLiteral, unsignedNumber } from "./scanInfoLine2";

/**
 * Dedicated scanner for K: (key) info lines
 *
 * This scanner produces a KEY_SIGNATURE token for the key signature,
 * followed by optional modifiers (clef=treble, transpose=0, etc.).
 *
 * Key signatures are scanned as a single token to avoid splitting
 * "C#m" into separate NOTE_LETTER, ACCIDENTAL, and IDENTIFIER tokens.
 *
 * Pattern: [A-Ga-g][#b]?[mode]? | HP | Hp | none
 * Where mode is: m, maj, major, min, minor, mix, mixolydian, dor, dorian,
 *                phr, phrygian, lyd, lydian, loc, locrian, ion, ionian, aeo, aeolian
 */
export function scanKeyInfoLine(ctx: Ctx): boolean {
  if (!infoHeader(ctx)) return false;

  // First, skip any leading whitespace
  WS(ctx);

  // Scan the key signature token (must appear first after the header)
  // This is a single token like "C", "Am", "F#m", "Bbmaj", "Gdor", "HP", or "none"
  keySignature(ctx);

  // Now scan the modifiers (clef=treble, transpose=0, etc.)
  while (!(isAtEnd(ctx) || ctx.test(pEOL) || ctx.test("%"))) {
    if (WS(ctx)) continue;
    if (identifier(ctx)) continue; // For modifier keys and values
    if (stringLiteral(ctx)) continue; // For quoted values
    if (singleChar(ctx, "=", TT.EQL)) continue;
    if (singleChar(ctx, "-", TT.MINUS)) continue;
    if (singleChar(ctx, "+", TT.PLUS)) continue;
    if (singleChar(ctx, "/", TT.SLASH)) continue;
    if (singleChar(ctx, "(", TT.LPAREN)) continue;
    if (singleChar(ctx, ")", TT.RPAREN)) continue;
    if (unsignedNumber(ctx)) continue;

    // Invalid token - use existing helper
    collectInvalidInfoLn(ctx, "Invalid token in key info line");
    break;
  }

  return true;
}

/**
 * Scan key signature as a single token
 *
 * Pattern covers:
 * - Note roots A-G (case insensitive in capture, but typically uppercase)
 * - Accidentals # and b
 * - All mode variants: m, maj, major, min, minor, mix, mixolydian, dor, dorian,
 *                      phr, phrygian, lyd, lydian, loc, locrian, ion, ionian, aeo, aeolian
 * - Highland Pipes: HP, Hp
 * - None: none
 *
 * The pattern uses a lookahead to ensure we stop at the right boundary
 * (whitespace, =, %, newline, end of input, or ])
 *
 * Examples: C, Am, F#m, Bbmaj, Gdor, Amix, HP, none, C#minor, Dmixolydian
 */
export function keySignature(ctx: Ctx): boolean {
  // Key signature pattern:
  // 1. Note root [A-Ga-g] followed by optional accidental [#b] and optional mode
  // 2. HP or Hp (Highland Pipes)
  // 3. none
  //
  // Mode patterns (case insensitive):
  // - m (abbreviation for minor)
  // - maj, major
  // - min, minor
  // - mix, mixolydian
  // - dor, dorian
  // - phr, phrygian
  // - lyd, lydian
  // - loc, locrian
  // - ion, ionian
  // - aeo, aeolian
  //
  // The lookahead ensures we stop at whitespace, =, %, newline, ], or end of input

  // Pattern explanation:
  // (?:...) - non-capturing group for the whole key signature
  //   [A-Ga-g] - note root
  //   [#b]? - optional accidental
  //   (?:m(?:aj(?:or)?|in(?:or)?|ix(?:olydian)?)?|dor(?:ian)?|phr(?:ygian)?|lyd(?:ian)?|loc(?:rian)?|ion(?:ian)?|aeo(?:lian)?)? - optional mode
  // | HP | Hp - Highland Pipes variants
  // | none - no key signature
  //
  // (?=[=\s%\n\]|]|$) - lookahead for terminator

  const keySignaturePattern =
    /^(?:[A-Ga-g][#b]?(?:m(?:aj(?:or)?|in(?:or)?|ix(?:olydian)?)?|dor(?:ian)?|phr(?:ygian)?|lyd(?:ian)?|loc(?:rian)?|ion(?:ian)?|aeo(?:lian)?)?|HP|Hp|none)(?=[=\s%\n\]|]|$)/i;

  const match = keySignaturePattern.exec(ctx.source.substring(ctx.current));
  if (!match) return false;

  ctx.current += match[0].length;
  ctx.push(TT.KEY_SIGNATURE);
  return true;
}
