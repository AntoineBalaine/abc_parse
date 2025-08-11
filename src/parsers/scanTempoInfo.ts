import { Ctx, TT, WS, advance, isAtEnd, collectInvalidInfoLn, consume } from "./scan2";
import { comment, pEOL, pNumber } from "./scan_tunebody";

function stringLiteral(ctx: Ctx, type: TT): boolean {
  if (!ctx.test(/"[^"]*"/)) {
    return false;
  }
  const match = /^"[^"]*"/.exec(ctx.source.substring(ctx.current));
  if (!match) return false;
  ctx.current += match[0].length;
  ctx.push(type);
  return true;
}

/**
 * Scan a tempo info line content
 * Grammar: string_literal? tempo_definition? string_literal?
 * tempo_definition := (note_sequence "=")? integer
 * Examples: "Allegro", 120, 1/4=120, "Easy Swing" 1/4=140, C3=120
 */
export function tempLn(ctx: Ctx): boolean {
  while (!isAtEnd(ctx) && !ctx.test(pEOL) && !comment(ctx)) {
    WS(ctx, true);
    if (stringLiteral(ctx, TT.TEMPO_TEXT)) continue;
    if (bpm(ctx)) continue;
    collectInvalidInfoLn(ctx, "Invalid tempo line content");
    return false;
  }
  return true;
}

/**
 * Scan bpm definition: (note_sequence "=")? integer
 */
function bpm(ctx: Ctx): boolean {
  if (beatValues(ctx)) {
    if (ctx.test("=")) {
      advance(ctx);
      ctx.push(TT.TEMPO_EQUALS);
      WS(ctx, true);

      if (!int(ctx, TT.TEMPO_BPM)) {
        collectInvalidInfoLn(ctx, "Expected BPM number after '='");
        return false;
      }
    } else {
      collectInvalidInfoLn(ctx, "Expected '='");
      return false;
    }
  } else {
    int(ctx, TT.TEMPO_BPM);
  }

  return true;
}

/**
 * Scan note sequence: note_value (whitespace+ note_value)*
 */
function beatValues(ctx: Ctx): boolean {
  if (!(absPitch(ctx) || rationalNumber(ctx))) {
    return false;
  }
  WS(ctx, true);

  while (!isAtEnd(ctx) && (absPitch(ctx) || rationalNumber(ctx))) {
    WS(ctx, true);
  }

  return true;
}

export function int(ctx: Ctx, type: TT): boolean {
  if (!ctx.test(pNumber)) return false;

  const match = new RegExp(`^${pNumber.source}`).exec(ctx.source.substring(ctx.current));
  if (match) {
    ctx.current += match[0].length;
    ctx.push(type);
  }
  return true;
}

export function rationalNumber(ctx: Ctx): boolean {
  // Skip any leading whitespace
  if (!ctx.test(/[1-9][0-9]*\s*\/\s*[1-9][0-9]*/)) return false;
  // Check if we have a numerator (optional)

  int(ctx, TT.NOTE_LEN_NUM);

  WS(ctx, true);

  // Check for separator (required if we have a denominator)
  if (ctx.test(/\//)) {
    consume(ctx);
    // Don't push a token for the separator, just consume it
    WS(ctx, true);
  }

  int(ctx, TT.NOTE_LEN_DENOM);
  return true;
}

/**
 * Scan note letter with octave (e.g., C3, A4)
 */
export function absPitch(ctx: Ctx): boolean {
  if (!ctx.test(/[A-G][1-9][0-9]*/)) {
    return false;
  }

  const match = /^[A-G][1-9][0-9]*/.exec(ctx.source.substring(ctx.current));
  if (!match) return false;

  ctx.current += match[0].length;
  ctx.push(TT.TEMPO_NOTE_LETTER);
  return true;
}
