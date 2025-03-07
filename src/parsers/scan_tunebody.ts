import { Ctx, advance, TT, peek, isAtEnd, EOL, WS } from "./scan2";

export function note(ctx: Ctx): boolean {
  tie(ctx);
  if (!pitch(ctx)) {
    ctx.report("Expected pitch");
    return false;
  }
  rhythm(ctx);
  tie(ctx);
  return true;
}

export function tie(ctx: Ctx): boolean {
  if (ctx.test("-")) {
    advance(ctx);
    ctx.push(TT.TIE);

    return true;
  } else return false;
}

export function music_scan(ctx: Ctx) {
  switch (peek(ctx)) {
    case "&": {
      ampersand(ctx);
      break;
    }
    case ".":
    case "~": {
      ctx.push(TT.DECORATION);
      break;
    }
  }
}

export function ampersand(ctx: Ctx): boolean {
  if (!ctx.test("&")) return false;
  if (ctx.test(/\&\n/)) {
    advance(ctx, 2);
    ctx.push(TT.VOICE_OVRLAY);
    return true;
  } else {
    advance(ctx);
    ctx.push(TT.VOICE);
    return true;
  }
}
/**
 * TODO: complex cases (3:2:3
 */

export function tuplet(ctx: Ctx): boolean {
  if (!ctx.test(pTuplet)) return false;
  // Advance past the opening parenthesis and the number
  const match = pTuplet.exec(ctx.source.substring(ctx.current));
  if (match) {
    ctx.current += match[0].length;
    ctx.push(TT.TUPLET);
    return true;
  }
  return false;
}

export function stylesheet_directive(ctx: Ctx): boolean {
  if (!ctx.test("%%")) return false;
  advance(ctx, 2);
  while (!isAtEnd(ctx) && !ctx.test(pEOL)) {
    advance(ctx);
  }
  ctx.push(TT.STYLESHEET_DIRECTIVE);
  return true;
}

export function comment(ctx: Ctx): boolean {
  if (!ctx.test("%")) return false;
  advance(ctx);
  while (!isAtEnd(ctx) && !ctx.test(pEOL)) {
    advance(ctx);
  }
  ctx.push(TT.COMMENT);
  return true;
}

export function decoration(ctx: Ctx): boolean {
  // FIXME: \zs is not valid regex, that's vim regex
  const ptrn = new RegExp(`${pDeco.source}+\zs(${pPitch.source}|${pRest.source})`);
  const mtch = ptrn.exec(ctx.source.substring(ctx.start));
  if (mtch) {
    ctx.current = ctx.start + mtch[0].length;
    ctx.push(TT.DECORATION);
    return true;
  }
  return false;
}

export function symbol(ctx: Ctx): boolean {
  if (!ctx.test("!")) return false;
  advance(ctx);
  while (!ctx.test("!")) {
    advance(ctx);
  }
  advance(ctx);
  ctx.push(TT.SYMBOL);
  return true;
}

export function rhythm(ctx: Ctx): boolean {
  if (!ctx.test(pDuration)) return false;
  let parsed = false;
  if (ctx.test(pNumber)) {
    advance(ctx);
    while (ctx.test(pNumber)) {
      advance(ctx);
    }
    ctx.push(TT.RHY_NUMER);
    parsed = true;
  }
  if (ctx.test("/")) {
    advance(ctx);
    ctx.push(TT.RHY_SEP);
    if (ctx.test(pNumber)) {
      advance(ctx);
      while (ctx.test(pNumber)) {
        advance(ctx);
      }
      ctx.push(TT.RHY_DENOM);
    }
    parsed = true;
  }
  if (ctx.test(/([>]+)|([<]+)/)) {
    advance(ctx);
    ctx.push(TT.RHY_BRKN);
    parsed = true;
  }
  return parsed;
}

export function pitch(ctx: Ctx): boolean {
  accidental(ctx);
  if (!ctx.test(/[a-gA-g]/)) {
    ctx.report("Expected pitch");
    return false;
  }
  advance(ctx);
  ctx.push(TT.NOTE_LETTER);
  const mtch = /^[',]+/.exec(ctx.source.substring(ctx.current));
  if (mtch) {
    ctx.current = ctx.start + mtch[0].length;
    ctx.push(TT.OCTAVE);
  }
  return true;
}

export function accidental(ctx: Ctx): boolean {
  switch (peek(ctx)) {
    case "^":
    case "_":
    case "=":
    case "^^":
    case "__":
    case "_/":
    case "^/":
      advance(ctx);
      ctx.push(TT.ACCIDENTAL);
      return true;
    default:
      return false;
  }
}

export function barline(ctx: Ctx): boolean {
  const mtch = new RegExp(`^${pBrLn.source}`).exec(ctx.source.substring(ctx.start));
  if (mtch) {
    ctx.current = ctx.start + mtch[0].length;
    ctx.push(TT.BARLINE);
    return true;
  }
  return false;
}

export function bcktck_spc(ctx: Ctx): boolean {
  if (!ctx.test("`")) return false;
  advance(ctx);
  ctx.push(TT.BCKTCK_SPC);
  return true;
}

export function y_spacer(ctx: Ctx): boolean {
  if (!ctx.test("y")) return false;
  advance(ctx);
  ctx.push(TT.Y_SPC);
  rhythm(ctx);
  return true;
}

export function slur(ctx: Ctx): boolean {
  if (!ctx.test(/[()]/)) return false;
  advance(ctx);
  ctx.push(TT.SLUR);
  return true;
}

export function info_line(ctx: Ctx): boolean {
  if (!ctx.test(pInfoLine)) return false;
  advance(ctx, 2);
  ctx.push(TT.INF_HDR);
  while (!isAtEnd(ctx) && !ctx.test(pEOL)) {
    if (ctx.test("%")) {
      break;
    } else {
      advance(ctx);
    }
  }
  ctx.push(TT.INFO_STR);
  comment(ctx);
  return true;
}

export function rest(ctx: Ctx): boolean {
  if (!ctx.test(pRest)) return false;

  advance(ctx);

  ctx.push(TT.REST);
  advance(ctx);
  rhythm(ctx);
  return true;
}

export function chord(ctx: Ctx): boolean {
  if (!ctx.test(pChord)) return false;
  ctx.push(TT.CHRD_LEFT_BRKT);
  advance(ctx);
  while (!isAtEnd(ctx) && !ctx.test("]")) {
    if (ctx.test(pString)) {
      annotation(ctx);
      continue;
    } else {
      note(ctx);
      continue;
    }
  }
  advance(ctx);
  tie(ctx);
  ctx.push(TT.CHRD_RIGHT_BRKT);
  return true;
}

export function grace_grp(ctx: Ctx): boolean {
  if (!ctx.test(pGraceGrp)) return false;
  advance(ctx);
  ctx.push(TT.GRC_GRP_LEFT_BRACE);
  if (ctx.test("/")) {
    advance(ctx);
    ctx.push(TT.GRC_GRP_SLSH);
  }
  while (!isAtEnd(ctx) && !ctx.test("}")) {
    if (note(ctx)) {
      continue;
    } else if (ctx.test(/\s/)) {
      advance(ctx);
      continue;
    } else {
      ctx.report("Expected pitch or whitespace");
      return false;
    }
  }
  advance(ctx);
  ctx.push(TT.GRC_GRP_RGHT_BRACE);
  return true;
}

export function inline_field(ctx: Ctx): boolean {
  if (!ctx.test(pInlineField)) return false;
  advance(ctx);
  ctx.push(TT.INLN_FLD_LFT_BRKT);
  while (!isAtEnd(ctx) && !ctx.test(":")) {
    advance(ctx);
  }
  advance(ctx);
  ctx.push(TT.INF_HDR);
  while (!isAtEnd(ctx) && !ctx.test("]")) {
    advance(ctx);
  }
  ctx.push(TT.INF_TXT);
  advance(ctx);
  ctx.push(TT.INLN_FLD_RGT_BRKT);
  return true;
}

export function annotation(ctx: Ctx): boolean {
  if (!ctx.test('"')) return false;
  advance(ctx);
  while (!ctx.test('"')) {
    if (ctx.test(pEOL)) {
      ctx.report("Unterminated string");
      return false;
    }
    advance(ctx);
  }
  advance(ctx);
  ctx.push(TT.ANNOTATION);
  return true;
}
const pLETTER_COLON = /[a-zA-Z]:/;
export const pEOL = "\n";
export const pInfoLine = /\s*[a-zA-Z]\s*:/;
export const pTuneHeadStrt = /\s*X:/;
export const pDuration = /(\/+)|(([1-9][0-9]*)?\/[1-9][0-9]*)|([1-9][0-9]*)|([>]+|[<]+)/;
export const pSectionBrk = /\n(\s*\n)+/;
export const pNumber = /[1-9][0-9]*/;
export const pRest = /[zZxX]/;
export const pPitch = /[\^=_]?[a-zA-G][,']*/;
export const pString = /"[^\n]*"/;
export const pChord = new RegExp(`\\[((${pString.source})+|(${pPitch.source})+)\\]`);
export const pDeco = /[~\.HLMOPSTuv]/;

export const pTuplet = new RegExp(`\\(${pNumber.source}`);
const pNote = new RegExp(`-?${pDeco.source}?${pPitch.source}${pDuration.source}?-?`);
const pRestFull = new RegExp(`${pRest.source}${pDuration.source}?`);
export const pBrLn = /((\[\|)|(\|\])|(\|\|)|(\|))/;
/**
inline field is a left bracket, followed by a letter, followed by a colon
followed by any text, followed by a right bracket
*/
export const pInlineField = /\[\s*[a-zA-Z]\s*:[^\]]*\]/;
export const pGraceGrp = new RegExp(`{\/?(${pPitch.source})+}`);

export function scanTuneBody(ctx: Ctx) {
  while (!isAtEnd(ctx) && !ctx.test(pSectionBrk)) {
    ctx.start = ctx.current;
    // Try each tokenizer function in order of precedence
    if (stylesheet_directive(ctx)) continue;
    if (comment(ctx)) continue;
    if (info_line(ctx)) continue;
    if (annotation(ctx)) continue;
    if (inline_field(ctx)) continue;
    if (barline(ctx)) continue;
    if (tuplet(ctx)) continue;
    if (slur(ctx)) continue;
    if (grace_grp(ctx)) continue;
    if (chord(ctx)) continue;
    if (note(ctx)) continue;
    if (rest(ctx)) continue;
    if (y_spacer(ctx)) continue;
    if (symbol(ctx)) continue;
    if (ampersand(ctx)) continue;
    if (bcktck_spc(ctx)) continue;
    if (WS(ctx)) continue;
    if (EOL(ctx)) continue;
    // If no match is found, report an error and advance
    ctx.report(`Unexpected character: ${peek(ctx)}`);
    advance(ctx);
  }
}
