import { Ctx, advance, TT, peek, isAtEnd, EOL, WS, stylesheet_directive, info_line } from "./scan2";

const pLETTER_COLON = /[a-zA-Z]:/;
export const pEOL = "\n";
export const pInfoLine = / *[a-zA-Z] *:/;
export const pTuneHeadStrt = / *X:/;
export const pDuration = /(\/+)|(([1-9][0-9]*)?\/[1-9][0-9]*)|([1-9][0-9]*)|([>]+|[<]+)/;
export const pSectionBrk = /\n(\s*\n)+/;
export const pNumber = /[1-9][0-9]*/;
export const pRest = /[zZxX]/;
export const pPitch = /[\^=_]?[a-zA-G][,']*/;
export const pString = /"[^\n]*"/;
export const pChord = new RegExp(`\\[((${pString.source})+|(${pPitch.source})+)\\]`);
export const pDeco = /[~\.HLMOPSTuv]/;

export const pTuplet = new RegExp(`\\(${pNumber.source}(:(${pNumber.source})?)?(:(${pNumber.source})?)?`);
const pNote = new RegExp(`-?${pDeco.source}?${pPitch.source}${pDuration.source}?-?`);
const pRestFull = new RegExp(`${pRest.source}${pDuration.source}?`);
export const pBrLn = /((\[\|)|(\|\])|(\|\|)|(\|))/;
/**
inline field is a left bracket, followed by a letter, followed by a colon
followed by any text, followed by a right bracket
*/
export const pInlineField = /\[\s*[a-zA-Z]\s*:[^\]]*\]/;
export const pGraceGrp = new RegExp(`{\/?(${pPitch.source})+}`);

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

export function tuplet(ctx: Ctx): boolean {
  const match = new RegExp(`^${pTuplet.source}`).exec(ctx.source.substring(ctx.current));
  if (!match) return false;

  ctx.current += match[0].length;
  // Extract the tuplet numbers (p:q:r notation)
  const [p, q, r] = [match[1], match[3], match[5]].map((n) => (n ? parseInt(n) : undefined));
  ctx.push(TT.TUPLET);
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

/**
 * Parse repeat numbers when current token is a number
 * - Single number: 1
 * - Number list: 1,2,3
 * - Range: 1-3
 * - Mixed: 1,3,5-7,9
 * - X notation: 1x2,3 or 1,2x2,3
 */
export function parseRepeatNumbers(ctx: Ctx): boolean {
  // Must start with a number
  if (!ctx.test(/\s*[1-9]/)) {
    return false;
  }

  // Parse the first number
  while (ctx.test(/\s*[0-9]/)) {
    advance(ctx);
  }
  ctx.push(TT.REPEAT_NUMBER);

  // Continue parsing until we don't find valid repeat number syntax
  while (!isAtEnd(ctx) && !ctx.test(pEOL)) {
    if (ctx.test(",")) {
      // Handle comma separator
      advance(ctx);
      ctx.push(TT.REPEAT_COMMA);

      // Must have a number after comma
      if (!ctx.test(/[1-9]/)) {
        ctx.report("Expected number after comma in repeat");
        return true; // Still return true as we parsed at least one number
      }

      while (ctx.test(/[0-9]/)) {
        advance(ctx);
      }
      ctx.push(TT.REPEAT_NUMBER);
    } else if (ctx.test("-")) {
      // Handle range dash
      advance(ctx);
      ctx.push(TT.REPEAT_DASH);

      // Must have a number after dash
      if (!ctx.test(/[1-9]/)) {
        ctx.report("Expected number after dash in repeat range");
        return true; // Still return true as we parsed at least one number
      }

      while (ctx.test(/[0-9]/)) {
        advance(ctx);
      }
      ctx.push(TT.REPEAT_NUMBER);
    } else if (ctx.test(/[xX]/)) {
      // Handle x notation
      advance(ctx);
      ctx.push(TT.REPEAT_X);

      // Must have a number after x
      if (!ctx.test(/[1-9]/)) {
        ctx.report("Expected number after x in repeat");
        return true; // Still return true as we parsed at least one number
      }

      while (ctx.test(/[0-9]/)) {
        advance(ctx);
      }
      ctx.push(TT.REPEAT_NUMBER);
    } else {
      // No more valid repeat number syntax
      break;
    }
  }

  return true; // Successfully parsed repeat numbers
}

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

/**
 * Writing down the rules as regular expressions:
 * ```
 * (:+)(\\|+\\s*\\])?                    # Colon start rule
 * \\|+((:+)|(\\s*(\\]|(\\[\\d+))))?     # Barline start rule
 * \\[(\\d+|(\\|(:+)?)|\\])              # Left bracket start rule
 * ```
 *
 * <colon>+(<barline>+(<WS>?<RBrkt>))?
 * <barline>+(<colon>+|(<WS>?(<RBrkt>|(<LBrkt><REPEAT_NUMBERS>))))?
 * <LBrkt>(<REPEAT_NUMBERS>|(<barline>(<colon>+)?)|<RBrkt>)
 */
export function barline2(ctx: Ctx): boolean {
  if (ctx.test(":")) return parseColonStart(ctx);
  if (ctx.test("|")) return parseBarlineStart(ctx);
  if (ctx.test("[")) return parseLeftBracketStart(ctx);

  return false;
}

/**
 * <colon>+(<barline>+(<WS>?<RBrkt>))?
 *
 * Parses barlines that start with one or more colons.
 * Handles optional barlines, whitespace, right brackets, and repeat numbers.
 */
export function parseColonStart(ctx: Ctx): boolean {
  while (ctx.test(":")) {
    advance(ctx);
  }
  if (ctx.test("|")) {
    advance(ctx);
    while (ctx.test("|")) {
      advance(ctx);
    }

    let match: RegExpExecArray | null = null;
    const rgt_brkt = /^\s*\]/;
    const lft_brkt = /^\s*\[/;
    const cur = ctx.source.substring(ctx.current);

    if (rgt_brkt.test(cur)) {
      match = rgt_brkt.exec(cur);
    } else if (lft_brkt.test(cur)) {
      match = lft_brkt.exec(cur);
    }
    if (match) {
      ctx.current = ctx.current + match[0].length;
    }

    ctx.push(TT.BARLINE);
    parseRepeatNumbers(ctx);
    return true;
  }
  ctx.push(TT.BARLINE);
  return true;
}

/**
 * <barline>+(<colon>+|(<WS>?(<RBrkt>|(<LBrkt><REPEAT_NUMBERS>))))?
 *
 * Parses barlines that start with one or more barline characters.
 * Handles optional colons, whitespace, brackets, and repeat numbers.
 */
function parseBarlineStart(ctx: Ctx): boolean {
  // Push initial token position
  const startPos = ctx.current;

  // Consume one or more barlines
  let barlineCount = 0;
  while (ctx.test("|")) {
    advance(ctx);
    barlineCount++;
  }

  // If no barlines were found, this isn't a barline-start
  if (barlineCount === 0) {
    return false;
  }

  // Check for various patterns after barlines

  // Case 1: Colons
  if (ctx.test(":")) {
    while (ctx.test(":")) {
      advance(ctx);
    }
  }
  // Case 2: Number (repeat numbers)
  else if (ctx.test(/[1-9]/)) {
    parseRepeatNumbers(ctx);
  }
  // Case 3: Left bracket followed by number
  else if (ctx.test(/\[/) && ctx.test(/[1-9]/, ctx.current + 1)) {
    advance(ctx); // Consume left bracket
    parseRepeatNumbers(ctx);
  }
  // Case 4: Right bracket
  else if (ctx.test(/\]/)) {
    advance(ctx);
  }
  // Case 5: Whitespace followed by right bracket
  else if (ctx.test(/\s/) && ctx.test(/\]/, ctx.current + 1)) {
    advance(ctx); // Whitespace
    advance(ctx); // Right bracket
  }
  // Case 6: Whitespace followed by left bracket and number
  else if (ctx.test(/\s/) && ctx.test(/\[/, ctx.current + 1) && ctx.current + 2 < ctx.source.length && /[1-9]/.test(ctx.source[ctx.current + 2])) {
    advance(ctx); // Whitespace
    advance(ctx); // Left bracket
    parseRepeatNumbers(ctx);
  }

  // Push the barline token with the entire matched text
  ctx.push(TT.BARLINE);
  return true;
}

/**
 * <LBrkt>(<REPEAT_NUMBERS>|(<barline>(<colon>+)?)|<RBrkt>)
 *
 * Parses barlines that start with a left bracket.
 * Handles repeat numbers, barlines with optional colons, and right brackets.
 */
function parseLeftBracketStart(ctx: Ctx): boolean {
  // Push initial token position
  const startPos = ctx.current;

  // Consume the left bracket
  if (!ctx.test(/\[/)) {
    return false;
  }
  advance(ctx);

  // Check for various patterns after left bracket

  // Case 1: Number (repeat numbers)
  if (ctx.test(/[1-9]/)) {
    parseRepeatNumbers(ctx);
  }
  // Case 2: Barline possibly followed by colons or right bracket
  else if (ctx.test(/\|/)) {
    advance(ctx); // Consume barline

    // Optional colons
    if (ctx.test(":")) {
      while (ctx.test(":")) {
        advance(ctx);
      }
    }
    // Optional right bracket
    else if (ctx.test(/\]/)) {
      advance(ctx);
    }
  }
  // Case 3: Right bracket (empty brackets)
  else if (ctx.test(/\]/)) {
    advance(ctx);
  }

  // Push the barline token with the entire matched text
  ctx.push(TT.BARLINE);
  return true;
}
