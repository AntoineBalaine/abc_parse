import { Ctx, TT, WS, advance } from "../scan2";
import { pNumber } from "../scan_tunebody";

/**
 * Scan a note length info line content
 * Format: [numerator]/denominator
 * Examples: 1/4, 1/8, 1/16, 1, 1/1, 1/2, 1/32, 1/64, 1/128, 1/256, 1/512
 * The numerator is optional and defaults to 1 if not present.
 * The denominator is mandatory - if not found, returns false.
 */
export function scanNoteLenInfo(ctx: Ctx): boolean {
  // Skip any leading whitespace
  WS(ctx, true);

  // Check if we have a numerator (optional)
  if (ctx.test(/[1-9][0-9]*\s*\//)) {
    const match = new RegExp(`^${pNumber.source}`).exec(ctx.source.substring(ctx.current));
    if (match) {
      ctx.current += match[0].length;
      ctx.push(TT.NOTE_LEN_NUM);
    }

    WS(ctx, true);
  }

  // Check for separator (required if we have a denominator)
  if (ctx.test(/\//)) {
    advance(ctx);
    ctx.push(TT.METER_SEPARATOR);
    WS(ctx, true);
  }

  // Parse denominator (required after separator)
  if (ctx.test(/[1-9][0-9]*/)) {
    const match = new RegExp(`^${pNumber.source}`).exec(ctx.source.substring(ctx.current));
    if (match) {
      ctx.current += match[0].length;
      ctx.push(TT.NOTE_LEN_DENOM);
      return true;
    } else {
      ctx.report("Expected denominator after '/' in note length");
      return false;
    }
  } else {
    ctx.report("Expected denominator after '/' in note length");
    return false;
  }
}
