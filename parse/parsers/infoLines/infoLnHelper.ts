import { advance, Ctx, isAtEnd, precededBy, TT, WS } from "../scan2";
import { pInfoLine, pNumber } from "../scan_tunebody";

export function infoHeader(ctx: Ctx): boolean {
  if (!(ctx.test(pInfoLine) && precededBy(ctx, new Set([TT.EOL, TT.SCT_BRK]), new Set([TT.WS])))) return false;
  const match = new RegExp(`^${pInfoLine.source}`).exec(ctx.source.substring(ctx.current));
  if (!match) return false;
  ctx.current += match[0].length;

  ctx.push(TT.INF_HDR);

  return true;
}

export function scnKV(ctx: Ctx, ttK: TT, ttV: TT): boolean {
  if (!ctx.test(/^\w+[ \t]*=[ \t]*("[^\n"]*")|[^\n \t]*/)) {
    return false;
  }
  if (!(scnKey(ctx, ttK) && scnValue(ctx, ttV))) {
    ctx.report("unexpected token in scan k/v");
  }
  return true;
}

/** `Key` as in Key/value pair */
export function scnKey(ctx: Ctx, tt: TT): boolean {
  if (!ctx.test(/^\w+[ \t]*=/)) {
    return false;
  }

  while (!isAtEnd(ctx) && !ctx.test(/[ \t=]/)) {
    advance(ctx);
  }
  ctx.push(tt);
  WS(ctx);

  advance(ctx);
  ctx.push(TT.EQL); // "="
  return true;
}

export function scnValue(ctx: Ctx, tt: TT): boolean {
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
  ctx.push(tt);
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

export function int(ctx: Ctx, type: TT): boolean {
  if (!ctx.test(pNumber)) return false;

  const match = new RegExp(`^${pNumber.source}`).exec(ctx.source.substring(ctx.current));
  if (match) {
    ctx.current += match[0].length;
    ctx.push(type);
  }
  return true;
}
