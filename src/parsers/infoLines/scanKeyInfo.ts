import { Ctx, TT, WS, advance, isAtEnd } from "../scan2";
import { comment, pEOL } from "../scan_tunebody";
import { int, scnKV, scnKey } from "./infoLnHelper";

// Pattern definitions for key signature components
export const pKeyRoot = /[A-G]/;
export const pKeyAccidental = /[#b]/;
export const pKeyMode = /(aeolian|aeo|dorian|dor|ionian|locrian|loc|lydian|lyd|mixolydian|major|maj|minor|min|mix|m|phrygian|phr)/i;
export const pExplicitAccidental = /[\^_=][A-Ga-g]/;
export const pKeyNone = /none/i;
const pClefType = /^(alto|bass|none|perc|tenor|treble)/i;
/**
 * The format is:
 *
 * `K: [⟨key⟩] [⟨modifiers⟩*]`
 *
 * modifiers are any of the following in any order:
 *
 *  `[⟨clef⟩] [middle=⟨pitch⟩] [transpose=[-]⟨number⟩] [stafflines=⟨number⟩] [staffscale=⟨number⟩][style=⟨style⟩]`
 *
 * key is none|HP|Hp|⟨specified_key⟩
 *
 * clef is `[clef=] [⟨clef type⟩] [⟨line number⟩] [+8|-8]`
 *
 * specified_key is `⟨pitch⟩[#|b][mode(first three chars are significant)][accidentals*]`
 */
export function scanKeyInfo(ctx: Ctx): boolean {
  if (!scanK(ctx)) return false;
  while (!(isAtEnd(ctx) || ctx.test(pEOL) || ctx.test("%"))) {
    if (WS(ctx)) continue;
    if (clef(ctx)) continue;
    scnKV(ctx, TT.VX_K, TT.VX_V);
  }
  return true;
}

// clef is [clef=]? [⟨clef type⟩] [⟨line number⟩]? [+8|-8]?
function clef(ctx: Ctx): boolean {
  if (!ctx.test(/(clef[ \t]*=)?[ \t]*(alto|bass|none|perc|tenor|treble)/i)) return false;
  scnKey(ctx, TT.KEY_K);
  WS(ctx);

  const match = pClefType.exec(ctx.source.substring(ctx.current));
  if (match) {
    ctx.current += match[0].length;
    ctx.push(TT.KEY_V);
  }
  // opt number
  if (ctx.test(/[1-5]/)) {
    advance(ctx);
    ctx.push(TT.CLEF_NUM);
  }
  // Parse optional octave shift
  if (ctx.test(/[\+\-]8/)) {
    ctx.current += 2; // Skip the '+8' or '-8'
    ctx.push(TT.CLEF_OCTAVE);
  }

  return true;
}

/**
 * Scan a key signature info line content
 * Format: [key][accidentals][mode][ modifiers]
 * Examples: C, G major, Dm, F# dorian, C^c_b, none
 */
function scanK(ctx: Ctx): boolean {
  // Skip any leading whitespace
  WS(ctx);

  // Handle special case: "none"
  if (ctx.test(pKeyNone)) {
    const match = new RegExp(`^${pKeyNone.source}`, pKeyNone.flags).exec(ctx.source.substring(ctx.current));
    if (match) {
      ctx.current += match[0].length;
      ctx.push(TT.KEY_NONE);
      return true;
    }
  }

  // Parse key root (required)
  if (!ctx.test(pKeyRoot)) {
    ctx.report("Expected key root (A-G)");
    return false;
  }

  advance(ctx);
  ctx.push(TT.KEY_ROOT);

  WS(ctx);

  // Parse optional key accidental
  if (ctx.test(pKeyAccidental)) {
    advance(ctx);
    ctx.push(TT.KEY_ACCIDENTAL);
  }

  WS(ctx);

  // Parse optional mode
  if (ctx.test(pKeyMode)) {
    const match = new RegExp(`^${pKeyMode.source}`, pKeyMode.flags).exec(ctx.source.substring(ctx.current));
    if (match) {
      ctx.current += match[0].length;
      ctx.push(TT.KEY_MODE);
    }
  }

  WS(ctx);

  // Parse explicit accidentals (can be multiple)
  while (ctx.test(pExplicitAccidental) && !isAtEnd(ctx)) {
    const match = new RegExp(`^${pExplicitAccidental.source}`, pExplicitAccidental.flags).exec(ctx.source.substring(ctx.current));
    if (match) {
      ctx.current += match[0].length;
      ctx.push(TT.KEY_EXPLICIT_ACC);
    } else {
      break;
    }
    WS(ctx);
  }

  return true;
}

/**
 * Helper function to scan key root
 */
export function scanKeyRoot(ctx: Ctx): boolean {
  if (!ctx.test(pKeyRoot)) {
    return false;
  }
  advance(ctx);
  ctx.push(TT.KEY_ROOT);
  return true;
}

/**
 * Helper function to scan key accidental
 */
export function scanKeyAccidental(ctx: Ctx): boolean {
  if (!ctx.test(pKeyAccidental)) {
    return false;
  }
  advance(ctx);
  ctx.push(TT.KEY_ACCIDENTAL);
  return true;
}

/**
 * Helper function to scan key mode
 */
export function scanKeyMode(ctx: Ctx): boolean {
  if (!ctx.test(pKeyMode)) {
    return false;
  }
  const match = new RegExp(`^${pKeyMode.source}`).exec(ctx.source.substring(ctx.current));
  if (match) {
    ctx.current += match[0].length;
    ctx.push(TT.KEY_MODE);
    return true;
  }
  return false;
}

/**
 * Helper function to scan explicit accidentals
 */
export function scanExplicitAccidental(ctx: Ctx): boolean {
  if (!ctx.test(pExplicitAccidental)) {
    return false;
  }
  const match = new RegExp(`^${pExplicitAccidental.source}`).exec(ctx.source.substring(ctx.current));
  if (match) {
    ctx.current += match[0].length;
    ctx.push(TT.KEY_EXPLICIT_ACC);
    return true;
  }
  return false;
}
