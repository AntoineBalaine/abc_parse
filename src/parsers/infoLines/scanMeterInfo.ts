import { Ctx, TT, WS, advance, isAtEnd, collectInvalidInfoLn } from "../scan2";
import { comment, pEOL } from "../scan_tunebody";

/**
 * Scan a meter info line content
 * Format: numerator/denominator or C or C| or (numerator+numerator)/denominator etc.
 * Examples: 4/4, 3/4, C, C|, 6/8, (2+3+2)/8
 */
export function scanMeterInfo(ctx: Ctx): boolean {
  // Skip any leading whitespace
  WS(ctx, true);

  // Handle special cases first - check C| before C since C| contains C
  if (ctx.test("C|")) {
    advance(ctx, 2);
    ctx.push(TT.METER_C_BAR);
    WS(ctx, true);
  } else if (ctx.test("C")) {
    advance(ctx);
    ctx.push(TT.METER_C);
    WS(ctx, true);
  } else {
    // Parse meter expression tokens
    while (!isAtEnd(ctx) && !ctx.test(pEOL) && !ctx.test("%")) {
      if (ctx.test(/[1-9][0-9]*/)) {
        // Scan number
        const match = new RegExp(`^[1-9][0-9]*`).exec(ctx.source.substring(ctx.current));
        if (match) {
          ctx.current += match[0].length;
          ctx.push(TT.METER_NUMBER);
        }
      } else if (ctx.test("(")) {
        advance(ctx);
        ctx.push(TT.METER_LPAREN);
      } else if (ctx.test(")")) {
        advance(ctx);
        ctx.push(TT.METER_RPAREN);
      } else if (ctx.test("+")) {
        advance(ctx);
        ctx.push(TT.METER_PLUS);
      } else if (ctx.test("/")) {
        advance(ctx);
        ctx.push(TT.METER_SEPARATOR);
      } else {
        // Invalid token - use collectInvalidInfoLn for error recovery
        collectInvalidInfoLn(ctx, "Invalid meter token");
        break;
      }

      WS(ctx, true);
    }
  }

  // Handle optional comment at the end
  comment(ctx);
  return true;
}
