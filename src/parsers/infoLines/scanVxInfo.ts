import { StemDirection, ChordPlacement, BracketBracePosition, ClefProperties } from "../../types/abcjs-ast";
import { advance, consume, Ctx, isAtEnd, Token, TT, WS } from "../scan2";
import { comment } from "../scan_tunebody";

export interface VoiceProperties {
  name?: string;
  clef?: ClefProperties;
  transpose?: number;
  octave?: number;
  middle?: string;
  stafflines?: number;
  staffscale?: number;
  perc?: boolean;
  instrument?: number;
  merge?: boolean;
  stems?: StemDirection;
  gchord?: ChordPlacement;
  space?: number;
  bracket?: BracketBracePosition;
  brace?: BracketBracePosition;
}

function scnKey(ctx: Ctx): boolean {
  if (!ctx.test(/^\w+[ \t]*=/)) {
    return false;
  }

  while (!isAtEnd(ctx) && !ctx.test(/[ \t=]/)) {
    advance(ctx);
  }
  ctx.push(TT.VX_K);
  WS(ctx, true);
  consume(ctx); // "="
  return true;
}

function scnValue(ctx: Ctx): boolean {
  let is_literal = false;
  if (ctx.test('"')) {
    is_literal = true;
    advance(ctx);
  }
  while (!isAtEnd(ctx) && !isBreaker(ctx, is_literal)) {
    advance(ctx);
  }
  if (is_literal && ctx.test('"')) {
    advance(ctx);
  }
  ctx.push(TT.VX_V);
  return true;
}

function isBreaker(ctx: Ctx, in_literal: boolean): boolean {
  if (in_literal) {
    if (ctx.test('"')) {
      return true; // End of string literal
    }
    return ctx.test(/[\n]+/); // Break on whitespace or newline in literal
  }
  if (ctx.test('"') && in_literal) return true;
  return ctx.test(/[\n \t%]+/);
}

function scnVxId(ctx: Ctx): boolean {
  while (!isAtEnd(ctx) && ctx.test(/\w/)) {
    advance(ctx);
  }
  ctx.push(TT.VX_ID);
  return true;
}

/**
 * Parse a Voice (V:) info line expression
 *
 * Format: `V:id [name="Name"] [clef=treble] [transpose=0]` etc.
 *
 * Examples: `V:1`, `V:T1 name="Tenor 1" clef=treble`, `V:B clef=bass transpose=-12`
 */
export function scanVoiceInfo(ctx: Ctx): boolean {
  let found_id = false;
  while (!isAtEnd(ctx) && !ctx.test("\n") && !ctx.test("%")) {
    if (WS(ctx, true)) continue;
    if (comment(ctx)) break;
    if (!found_id) {
      scnVxId(ctx);
      found_id = true;
      continue;
    }
    if (scnKey(ctx)) continue;
    if (scnValue(ctx)) continue;
  }

  if (!found_id) {
    ctx.report("Voice info line must start with V:id");
    return false;
  }
  return true;
}

function applyVx(properties: VoiceProperties, key: string, value: string): void {
  const normalizedKey = key.toLowerCase();

  if (name(properties, normalizedKey, value)) return;
  if (clef(properties, normalizedKey, value)) return;
  if (transpose(properties, normalizedKey, value)) return;
  if (octave(properties, normalizedKey, value)) return;
  if (middle(properties, normalizedKey, value)) return;
  if (stafflines(properties, normalizedKey, value)) return;
  if (staffscale(properties, normalizedKey, value)) return;
  if (perc(properties, normalizedKey, value)) return;
  if (instrument(properties, normalizedKey, value)) return;
  if (merge(properties, normalizedKey, value)) return;
  if (stems(properties, normalizedKey, value)) return;
  if (gchord(properties, normalizedKey, value)) return;
  if (space(properties, normalizedKey, value)) return;
  if (bracket(properties, normalizedKey, value)) return;
  if (brace(properties, normalizedKey, value)) return;

  // If none of the functions handled the property, warn about unknown property
  console.warn(`Unknown voice property: ${key}`);
}

function isStemDirection(value: string): value is StemDirection {
  return value === "up" || value === "down" || value === "auto" || value === "none";
}

function isChordPlacement(value: string): value is ChordPlacement {
  return value === "above" || value === "below" || value === "left" || value === "right" || value === "default";
}

function isBracketBracePosition(value: string): value is BracketBracePosition {
  return value === "start" || value === "end" || value === "continue";
}
function clef(properties: VoiceProperties, key: string | null, value: string): boolean {
  if (!(key && key === "clef")) return false;

  if (!/((alto|bass|none|treble|tenor)([',]+)?)|(perc)/.test(value)) {
    return false;
  }
  throw new Error("unimplemented");
  return true;
}

function transpose(properties: VoiceProperties, key: string | null, value: string): boolean {
  if (key !== "transpose") return false;

  properties.transpose = parseInt(value);
  if (isNaN(properties.transpose)) {
    throw new Error(`Invalid transpose value: ${value}`);
  }
  return true;
}
function octave(properties: VoiceProperties, key: string | null, value: string): boolean {
  if (key !== "octave") return false;
  properties.octave = parseInt(value);
  if (isNaN(properties.octave)) {
    throw new Error(`Invalid octave value: ${value}`);
  }
  return true;
}

function name(properties: VoiceProperties, key: string | null, value: string): boolean {
  if (key !== "name") return false;
  properties.name = value;
  return true;
}

function middle(properties: VoiceProperties, key: string | null, value: string): boolean {
  if (key !== "middle" && key !== "m") return false;
  properties.middle = value;
  return true;
}

function stafflines(properties: VoiceProperties, key: string | null, value: string): boolean {
  if (key !== "stafflines") return false;
  const stafflinesValue = parseInt(value);
  if (isNaN(stafflinesValue)) {
    throw new Error(`Invalid stafflines value: ${value}`);
  }
  properties.stafflines = stafflinesValue;
  return true;
}

function staffscale(properties: VoiceProperties, key: string | null, value: string): boolean {
  if (key !== "staffscale") return false;
  const staffscaleValue = parseFloat(value);
  if (isNaN(staffscaleValue)) {
    throw new Error(`Invalid staffscale value: ${value}`);
  }
  properties.staffscale = staffscaleValue;
  return true;
}

function perc(properties: VoiceProperties, key: string | null, value: string): boolean {
  if (key !== "perc") return false;
  properties.perc = value.toLowerCase() === "true" || value === "1";
  return true;
}

function instrument(properties: VoiceProperties, key: string | null, value: string): boolean {
  if (key !== "instrument") return false;
  const instrumentValue = parseInt(value);
  if (isNaN(instrumentValue)) {
    throw new Error(`Invalid instrument value: ${value}`);
  }
  properties.instrument = instrumentValue;
  return true;
}

function merge(properties: VoiceProperties, key: string | null, value: string): boolean {
  if (key !== "merge") return false;
  properties.merge = value.toLowerCase() === "true" || value === "1";
  return true;
}

function stems(properties: VoiceProperties, key: string | null, value: string): boolean {
  if (key !== "stems" && key !== "stem") return false;
  if (!isStemDirection(value)) {
    throw new Error(`Invalid stem direction: ${value}`);
  }
  properties.stems = value as StemDirection;
  return true;
}

function gchord(properties: VoiceProperties, key: string | null, value: string): boolean {
  if (key !== "gchord") return false;
  if (!isChordPlacement(value)) {
    throw new Error(`Invalid chord placement: ${value}`);
  }
  properties.gchord = value as ChordPlacement;
  return true;
}

function space(properties: VoiceProperties, key: string | null, value: string): boolean {
  if (key !== "space" && key !== "spc") return false;
  const spaceValue = parseFloat(value);
  if (isNaN(spaceValue)) {
    throw new Error(`Invalid space value: ${value}`);
  }
  properties.space = spaceValue;
  return true;
}

function bracket(properties: VoiceProperties, key: string | null, value: string): boolean {
  if (key !== "bracket" && key !== "brk") return false;
  if (!isBracketBracePosition(value)) {
    throw new Error(`Invalid bracket position: ${value}`);
  }
  properties.bracket = value as BracketBracePosition;
  return true;
}

function brace(properties: VoiceProperties, key: string | null, value: string): boolean {
  if (key !== "brace" && key !== "brc") return false;
  if (!isBracketBracePosition(value)) {
    throw new Error(`Invalid brace position: ${value}`);
  }
  properties.brace = value as BracketBracePosition;
  return true;
}
