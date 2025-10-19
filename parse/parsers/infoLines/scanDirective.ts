import { advance, Ctx, isAtEnd, TT, WS } from "../scan2";
import { collectInvalidToken, pEOL, pitch, pPitch } from "../scan_tunebody";
import { identifier, stringLiteral, singleChar } from "./scanInfoLine2";

/**
 * Directive scanner for stylesheet directives (%%directive content)
 *
 * Handles the content after %% in stylesheet directives, supporting:
 * - TT.IDENTIFIER identifiers (accepts hyphens in words)
 * - TT.ANNOTATION string literals
 * - TT.NUMBER numbers (floats & ints)
 * - TT.NUMBER + TT.MEASUREMENT_UNIT numbers with units (like "in" for inches)
 * - TT.NUMBER + TT.SLASH + TT.NUMBER rational numbers (integer fractions)
 * - Pitch tokens (tune-body pitches using pitch() function)
 * - TT.IDENTIFIER + TT.EQL + TT.NUMBER octave/transpose offset assignments (handled by separate tokens)
 */
export function scanDirective(ctx: Ctx): boolean {
  if (!ctx.test("%%")) return false;
  advance(ctx, 2);
  ctx.push(TT.STYLESHEET_DIRECTIVE);

  while (!(isAtEnd(ctx) || ctx.test(pEOL) || ctx.test("%"))) {
    if (numberWithUnit(ctx)) continue; // number + unit (must come before number)
    if (tuneBodyPitch(ctx)) continue; // ABC pitches (^c, _b, =f)
    if (identifier(ctx)) continue; // identifiers with hyphens
    if (stringLiteral(ctx)) continue; // "quoted strings"
    if (signedNumber(ctx)) continue; // signed integers and floats (including negative)
    if (singleChar(ctx, "=", TT.EQL)) continue; // =
    if (singleChar(ctx, "/", TT.SLASH)) continue; // /
    if (WS(ctx, true)) continue;
    collectInvalidToken(ctx);
  }

  return true;
}
function tuneBodyPitch(ctx: Ctx): boolean {
  if (!ctx.test(new RegExp(`^${pPitch.source}([%\n \t]|$)`))) return false;
  return pitch(ctx);
}

/**
 * Scan signed number: positive or negative integers and floats
 * Examples: 1, -1, 42, -12, 1.5, -0.25
 * Produces: TT.NUMBER
 */
function signedNumber(ctx: Ctx): boolean {
  // Pattern for signed numbers: optional minus sign followed by number
  const signedNumberPattern = /^-?(([1-9][0-9]*|0)(\.[0-9]+)?)/;

  const match = signedNumberPattern.exec(ctx.source.substring(ctx.current));
  if (!match) return false;

  ctx.current += match[0].length;
  ctx.push(TT.NUMBER);
  return true;
}

/**
 * Scan number with measurement unit: number immediately followed by alpha-only string
 * Examples: 12in, 5.5cm, 100pt
 * Produces: TT.NUMBER followed by TT.MEASUREMENT_UNIT
 */
function numberWithUnit(ctx: Ctx): boolean {
  // Look ahead to see if we have number + alpha pattern
  const numberMatch = /^([0-9]+(\.[0-9]+)?)([a-zA-Z]+)/.exec(ctx.source.substring(ctx.current));
  if (!numberMatch) return false;

  const numberPart = numberMatch[1];
  const unitPart = numberMatch[3];

  // Parse the number part
  ctx.current += numberPart.length;
  ctx.push(TT.NUMBER);

  // Parse the unit part
  ctx.current += unitPart.length;
  ctx.push(TT.MEASUREMENT_UNIT);

  return true;
}
