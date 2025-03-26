import { Ctx, advance, TT, peek, isAtEnd, EOL, WS, stylesheet_directive, info_line, precededBy } from "./scan2";

const pLETTER_COLON = /[a-zA-Z]:/;
export const pEOL = "\n";
export const pInfoLine = /[a-zA-Z][ \t]*:/;
export const pSymbolLine = /s[ \t]*:/;
export const pInfoLnCtd = /[ \t]*\+:[ \t]*/;

export const pTuneHeadStrt = /[ \t]*X:/;
export const pTuneStart = new RegExp(`^(?:(?!\n[ \t]*\n).)*${pTuneHeadStrt.source}`, "s");
export const pDuration = /(\/+)|(([1-9][0-9]*)?\/[1-9][0-9]*)|([1-9][0-9]*)|([>]+|[<]+)/;
export const pSectionBrk = /\n([ \t]*\n)+/;
export const pNumber = /[1-9][0-9]*/;
export const pRest = /[zZxX]/;
const pAccidental = /^((\^[\^\/]?)|(_[_\/]?)|=)/;
// export const pPitch = /[\^=_]?[a-gA-G][,']*/;
export const pPitch = new RegExp(`((\\^[\\^\\/]?)|(_[_\\/]?)|=)?[a-gA-G][,']*`);
export const pString = /"[^\n]*"/;
export const pChord = new RegExp(`\\[((${pString.source})+|(${pPitch.source})+)\\]`);
export const pDeco = /[\~\.HLMOPSTuv]/;

export const pTuplet = new RegExp(`\\(${pNumber.source}(:(${pNumber.source})?)?(:(${pNumber.source})?)?`);
const pNote = new RegExp(`-?${pDeco.source}?${pPitch.source}${pDuration.source}?-?`);
const pRestFull = new RegExp(`${pRest.source}${pDuration.source}?`);
export const pBrLn = /((\[\|)|(\|\])|(\|\|)|(\|))/;
/**
inline field is a left bracket, followed by a letter, followed by a colon
followed by any text, followed by a right bracket
*/
export const pInlineField = /\[[ \t]*[a-zA-Z][ \t]*:[^\]]*\]/;
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
  const fullMatch = new RegExp(`^${pTuplet.source}`).exec(ctx.source.substring(ctx.current));
  if (!fullMatch) return false;

  // Save the original start position
  const originalStart = ctx.current;

  // Push the opening parenthesis token
  ctx.start = ctx.current;
  ctx.current += 1; // Move past the opening parenthesis
  ctx.push(TT.TUPLET_LPAREN);

  // Extract and push the p value
  const pMatch = new RegExp(`^${pNumber.source}`).exec(ctx.source.substring(ctx.current));
  if (pMatch) {
    ctx.start = ctx.current;
    ctx.current += pMatch[0].length;
    ctx.push(TT.TUPLET_P);
  }

  // Check for q value (after first colon)
  if (ctx.source[ctx.current] === ":") {
    // Push the colon token
    ctx.start = ctx.current;
    ctx.current += 1; // Move past the colon
    ctx.push(TT.TUPLET_COLON);

    // Check if there's a q value after the colon
    const qMatch = new RegExp(`^${pNumber.source}`).exec(ctx.source.substring(ctx.current));
    if (qMatch) {
      ctx.start = ctx.current;
      ctx.current += qMatch[0].length;
      ctx.push(TT.TUPLET_Q);
    }

    // Check for r value (after second colon)
    if (ctx.source[ctx.current] === ":") {
      // Push the second colon token
      ctx.start = ctx.current;
      ctx.current += 1; // Move past the colon
      ctx.push(TT.TUPLET_COLON);

      // Check if there's an r value after the colon
      const rMatch = new RegExp(`^${pNumber.source}`).exec(ctx.source.substring(ctx.current));
      if (rMatch) {
        ctx.start = ctx.current;
        ctx.current += rMatch[0].length;
        ctx.push(TT.TUPLET_R);
      }
    }
  }

  // The tuplet is now fully parsed with individual tokens
  // No need for backward compatibility token anymore

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
  const ptrn = new RegExp(`^${pDeco.source}+(?=(${pPitch.source}|${pRest.source}|${pChord.source}))`);
  const mtch = ptrn.exec(ctx.source.substring(ctx.start));
  if (mtch) {
    ctx.current = ctx.start + mtch[0].length;
    ctx.push(TT.DECORATION);
    return true;
  }
  return false;
}

export function symbol(ctx: Ctx): boolean {
  if (!(ctx.test(/![^\n!]*!/) || ctx.test(/\+[^\n\+]*\+/))) return false;
  var is_plus_symbol = ctx.test("+");
  advance(ctx);
  while (!ctx.test(is_plus_symbol ? "+" : "!")) {
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
    while (ctx.test(/[0-9]/)) {
      advance(ctx);
    }
    ctx.push(TT.RHY_NUMER);
    parsed = true;
  }
  if (ctx.test("/")) {
    while (ctx.test("/")) {
      advance(ctx);
    }
    ctx.push(TT.RHY_SEP);
    if (ctx.test(pNumber)) {
      advance(ctx);
      while (ctx.test(/[0-9]/)) {
        advance(ctx);
      }
      ctx.push(TT.RHY_DENOM);
    }
    parsed = true;
  }

  if (ctx.test(/[><]/)) {
    const mtch = /^([>]+|[<]+)/.exec(ctx.source.substring(ctx.current));
    if (mtch) {
      ctx.current = ctx.current + mtch[0].length;
      ctx.push(TT.RHY_BRKN);
      parsed = true;
    }
  }
  return parsed;
}

export function pitch(ctx: Ctx): boolean {
  accidental(ctx);
  if (!ctx.test(/[a-gA-G]/)) {
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
  const match = pAccidental.exec(ctx.source.substring(ctx.current));
  if (!match) return false;

  ctx.current += match[0].length;

  ctx.push(TT.ACCIDENTAL);
  return true;
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
  rhythm(ctx);
  return true;
}

export function chord(ctx: Ctx): boolean {
  if (!ctx.test(pChord)) return false;
  advance(ctx);
  ctx.push(TT.CHRD_LEFT_BRKT);
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
  // tie(ctx);
  ctx.push(TT.CHRD_RIGHT_BRKT);
  rhythm(ctx);
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
    } else if (ctx.test(/[ \t]/)) {
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
  ctx.push(TT.INFO_STR);
  advance(ctx);
  ctx.push(TT.INLN_FLD_RGT_BRKT);
  return true;
}

export function annotation(ctx: Ctx): boolean {
  if (!ctx.test(/"[^"\n]*"/)) return false;
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
export function scanRepeatNumbers(ctx: Ctx): boolean {
  // Must start with a number
  if (!ctx.test(/[ \t]*[1-9]/)) {
    return false;
  }

  // Parse the first number
  while (ctx.test(/[ \t]*[0-9]/)) {
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

export function scanTune(ctx: Ctx): boolean {
  // if (!ctx.test(pTuneStart)) return false;
  while (!isAtEnd(ctx) && !ctx.test(pSectionBrk)) {
    ctx.start = ctx.current;
    // Try each tokenizer function in order of precedence
    if (stylesheet_directive(ctx)) continue;
    if (comment(ctx)) continue;
    if (info_line(ctx)) continue;
    if (annotation(ctx)) continue;
    if (inline_field(ctx)) continue;
    if (tuplet(ctx)) continue;
    if (slur(ctx)) continue;
    if (grace_grp(ctx)) continue;
    if (chord(ctx)) continue;
    if (barline2(ctx)) continue;
    if (decoration(ctx)) continue;
    if (note(ctx)) continue;
    if (rest(ctx)) continue;
    if (y_spacer(ctx)) continue;
    if (symbol(ctx)) continue;
    if (ampersand(ctx)) continue;
    if (bcktck_spc(ctx)) continue;
    if (WS(ctx)) continue;
    if (EOL(ctx)) continue;
    // If no match is found, collect invalid characters into a token
    collectInvalidToken(ctx);
  }
  return true;
}

// Collect invalid characters into a token
export function collectInvalidToken(ctx: Ctx): boolean {
  // Store the starting position to ensure we capture all characters
  const startPos = ctx.current;

  // Advance until we find a character that could start a valid token
  // or until we reach the end of the line or input
  while (!isAtEnd(ctx) && !ctx.test(pEOL) && !isRecoveryPoint(ctx)) {
    advance(ctx);
  }

  // If we collected any characters, create an INVALID token
  if (ctx.current > startPos) {
    // Make sure we set the start position to the beginning of the invalid token
    ctx.start = startPos;
    ctx.report(`Invalid token: ${ctx.source.slice(ctx.start, ctx.current)}`);
    ctx.push(TT.INVALID);
    return true;
  }

  // If we didn't collect any characters (shouldn't happen), just advance
  advance(ctx);
  return false;
}

// Check if the current character could start a valid token
function isRecoveryPoint(ctx: Ctx): boolean {
  // Check for characters that could start valid tokens
  return (
    ctx.test(pEOL) || // stylesheet directive
    ctx.test(/[ \t]/) ||
    ctx.test(pBrLn) // comment
  );
}

/**
 * Writing down the rules as regular expressions:
 * ```
 * (:+)(\\|+\[ \t]*\\])?                    # Colon start rule
 * \\|+((:+)|(\[ \t]*(\\]|(\\[\\d+))))?     # Barline start rule
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
    const rgt_brkt = /^[ \t]*\]/;
    const lft_brkt = /^[ \t]*\[/;
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
    scanRepeatNumbers(ctx);
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
export function parseBarlineStart(ctx: Ctx): boolean {
  if (!ctx.test(/\|+((:+)|( *(\]|\[)))?/)) return false;

  while (ctx.test("|")) {
    advance(ctx);
  }

  // Case 1: Colons
  if (ctx.test(":")) {
    while (ctx.test(":")) {
      advance(ctx);
    }
    ctx.push(TT.BARLINE);
    return true;
  } else if (ctx.test(/[ \t]*[1-9]/)) {
    while (ctx.test(" ")) {
      advance(ctx);
    }
    ctx.push(TT.BARLINE);
    scanRepeatNumbers(ctx);
    return true;
  } else if (ctx.test(/[ \t]*\[[ \t]*[1-9]/)) {
    while (ctx.test(" ")) {
      advance(ctx);
    }
    advance(ctx); // Consume left bracket
    ctx.push(TT.BARLINE);
    scanRepeatNumbers(ctx);
    return true;
  } else if (ctx.test(/[ \t]*\]/)) {
    while (ctx.test(" ")) {
      advance(ctx);
    }
    advance(ctx); // Right bracket
    ctx.push(TT.BARLINE);
    return true;
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
export function parseLeftBracketStart(ctx: Ctx): boolean {
  if (!ctx.test(/\[(( *[0-9])|(\|:+)?|\])/)) return false;

  advance(ctx); // Consume left brkt

  if (ctx.test(/[1-9]/)) {
    // repeat numbers
    ctx.push(TT.BARLINE);
    scanRepeatNumbers(ctx);
    return true;
  } else if (ctx.test(/\|/)) {
    //Barline possibly followed by colons or right bracket
    advance(ctx); // Consume barline

    // Optional colons
    if (ctx.test(":")) {
      while (ctx.test(":")) {
        advance(ctx);
      }
    } else if (ctx.test(/\]/)) {
      // Optional right bracket
      advance(ctx);
    }
  } else if (ctx.test(/\]/)) {
    // Right bracket (empty brackets)
    advance(ctx);
  }

  // Push the barline token with the entire matched text
  ctx.push(TT.BARLINE);
  return true;
}

export function symbol_line(ctx: Ctx): boolean {
  if (!(ctx.test(pSymbolLine) && precededBy(ctx, new Set([TT.EOL, TT.SCT_BRK]), new Set([TT.WS])))) return false;

  const match = new RegExp(`^${pSymbolLine.source}`).exec(ctx.source.substring(ctx.current));
  if (!match) return false;
  ctx.current += match[0].length;
  ctx.push(TT.SY_HDR);

  while (!isAtEnd(ctx) && !ctx.test(pEOL)) {
    if (WS(ctx)) continue;
    if (barline(ctx)) continue;
    if (ctx.test("*")) {
      ctx.push(TT.SY_STAR);
      advance(ctx);
    }
    if (!isAtEnd(ctx) && !ctx.test(/[ \t%*\n]/)) {
      while (!isAtEnd(ctx) && !ctx.test(pEOL) && !ctx.test(/[ \t%*\n]/)) {
        advance(ctx);
      }
      ctx.push(TT.SY_TXT);
    }
    if (ctx.test("%")) break;
  }

  comment(ctx);
  return true;
}
