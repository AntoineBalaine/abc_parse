import { Ctx, TT, WS, advance, isAtEnd } from "../scan2";

// Pattern definitions for key signature components
export const pKeyRoot = /[A-G]/;
export const pKeyAccidental = /[#b]/;
export const pKeyMode = /(aeolian|aeo|dorian|dor|ionian|locrian|loc|lydian|lyd|mixolydian|major|maj|minor|min|mix|m|phrygian|phr)/i;
export const pExplicitAccidental = /[\^_=][A-Ga-g]/;
export const pKeyNone = /none/i;

/**
 * Scan a key signature info line content
 * Format: [key][accidentals][mode][ modifiers]
 * Examples: C, G major, Dm, F# dorian, C^c_b, none
 */
export function scanKeyInfo(ctx: Ctx): boolean {
  // Skip any leading whitespace
  WS(ctx, true);

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

  WS(ctx, true);

  // Parse optional key accidental
  if (ctx.test(pKeyAccidental)) {
    advance(ctx);
    ctx.push(TT.KEY_ACCIDENTAL);
  }

  WS(ctx, true);

  // Parse optional mode
  if (ctx.test(pKeyMode)) {
    const match = new RegExp(`^${pKeyMode.source}`, pKeyMode.flags).exec(ctx.source.substring(ctx.current));
    if (match) {
      ctx.current += match[0].length;
      ctx.push(TT.KEY_MODE);
    }
  }

  WS(ctx, true);

  // Parse explicit accidentals (can be multiple)
  while (ctx.test(pExplicitAccidental) && !isAtEnd(ctx)) {
    const match = new RegExp(`^${pExplicitAccidental.source}`, pExplicitAccidental.flags).exec(ctx.source.substring(ctx.current));
    if (match) {
      ctx.current += match[0].length;
      ctx.push(TT.KEY_EXPLICIT_ACC);
    } else {
      break;
    }
    WS(ctx, true);
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
