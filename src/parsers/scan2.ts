import { File_header, File_structure, Tune } from "../types/Expr";
import { AbcErrorReporter } from "./ErrorReporter";

export class Ctx {
  public source: string;
  public tokens: Array<Token>;
  public start: number;
  public current: number;
  public line: number;
  public errorReporter?: AbcErrorReporter;

  constructor(source: string, errorReporter?: AbcErrorReporter) {
    this.source = source;
    this.tokens = [];
    this.start = 0;
    this.current = 0;
    this.line = 0;
    this.errorReporter = errorReporter;
  }
  test(pattern: RegExp | string, offset?: number) {
    if (pattern instanceof RegExp) {
      return new RegExp(`^${pattern.source}`).test(this.source.substring(this.current));
    } else {
      offset = offset ?? this.current;
      return this.source.substring(offset, offset + pattern.length) == pattern;
    }
  }

  push(tokenType: TT) {
    this.tokens.push(new Token(tokenType, this));
    this.start = this.current;
    this.current += 1;
  }

  report(msg: string) {
    this.errorReporter?.Scanner2Error(this, msg);
  }
}
export function Scanner2(source: string, errorReporter?: AbcErrorReporter): Array<Token> {
  const ctx = new Ctx(String.raw`${source}`, errorReporter ?? new AbcErrorReporter());
  while (!isAtEnd(ctx)) {
    ctx.start = ctx.current;
    fileStructure(ctx);
  }

  ctx.push(TT.EOF);
  return ctx.tokens;
}

const pLETTER_COLON = /[a-zA-Z]:/;
const pWS = /\s+/;
const pEOL = "\n";
const pInfoLine = /\s*[a-zA-Z]\s*:/;
const pTuneHeadStrt = /\s*X:/;
const pDuration = /\d*\/\d*/;
const pSectionBrk = /\n[\n]+/;
const pPitch = /[\\^=_][a-zA-G][,']*/;
const pNumber = /[1-9][0-9]*/;
const pRest = /[zZxX]/;
const pString = /"[^\n]*"/;
const pChord = new RegExp(`\\[${pString.source}|${pPitch.source}\\]`);
const pDeco = /[~\.HLMOPSTuv]/;

export function fileStructure(ctx: Ctx) {
  while (!isAtEnd(ctx)) {
    if (ctx.current === 0 && !ctx.test(pTuneHeadStrt)) {
      fileHeader(ctx);
    } else if (ctx.test(pInfoLine)) {
      scanTune(ctx);
    }
  }
  return ctx.tokens;
}
export function fileHeader(ctx: Ctx): File_header | null {
  return null;
}
export function scanHead(ctx: Ctx) {}

export function scanTune(ctx: Ctx) {
  while (!isAtEnd(ctx) && !ctx.test(pSectionBrk)) {
    scanTuneHeadLine(ctx);
  }
  if (ctx.test(pSectionBrk)) {
    advance(ctx);
    ctx.push(TT.SCT_BRK);
  }
  if (ctx.test(pTuneHeadStrt)) {
    scanTuneBody(ctx);
  }
}
export function scanTuneHeadLine(ctx: Ctx) {}
export function scanTuneBody(ctx: Ctx) {}

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

export function tie(ctx: Ctx) {
  if (ctx.test("-")) {
    ctx.push(TT.TIE);
  }
}

export function music_scan(ctx: Ctx) {
  switch (peek(ctx)) {
    case "&": {
      if (ctx.test(/\&\n/)) {
        advance(ctx, 2);
        ctx.push(TT.VOICE_CNTD);
      } else {
        ctx.push(TT.VOICE);
      }
      break;
    }
    case ".":
    case "~": {
      ctx.push(TT.DECORATION);
      break;
    }
  }
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
    ctx.push(TT.RHY_NUMER);
    parsed = true;
  }
  if (ctx.test("/")) {
    ctx.push(TT.RHY_SEP);
    if (ctx.test(pNumber)) {
      ctx.push(TT.RHY_DENOM);
    }
    parsed = true;
  }
  if (ctx.test(/^[><]+/)) {
    ctx.push(TT.RHY_BRKN);
    parsed = true;
  }
  return parsed;
}

export function pitch(ctx: Ctx): boolean {
  accidental(ctx);
  if (!ctx.test(/^[a-gA-g]/)) {
    ctx.report("Expected pitch");
    return false;
  }
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
      ctx.push(TT.ACCIDENTAL);
      return true;
    default:
      return false;
  }
}

// TODO: implement
export function tuplet(ctx: Ctx): boolean {
  return false;
}
export function barline(ctx: Ctx): boolean {
  return false;
}
export function y_spacer(ctx: Ctx): boolean {
  if (!ctx.test("y")) return false;
  advance(ctx);
  ctx.push(TT.Y_SPC);
  rhythm(ctx);
  return true;
}

export function info_line(ctx: Ctx): boolean {
  if (!ctx.test(pInfoLine)) return false;
  advance(ctx, 2);
  ctx.push(TT.INF_LN_HDR);
  while (!isAtEnd(ctx) && !ctx.test(pEOL)) {
    if (comment(ctx)) {
      break;
    } else {
      advance(ctx);
    }
  }
  ctx.push(TT.STRING);
  return true;
}

export function rest(ctx: Ctx): boolean {
  if (!ctx.test(pRest)) return false;
  ctx.push(TT.REST);
  rhythm(ctx);
  return true;
}

export function chord(ctx: Ctx): boolean {
  if (!ctx.test(pChord)) return false;
  ctx.push(TT.CHRD_LEFT_BRKT);
  advance(ctx);
  while (!isAtEnd(ctx) && !ctx.test("]")) {
    if (ctx.test(pString)) {
      string(ctx);
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

/**
inline field is a left bracket, followed by a letter, followed by a colon
followed by any text, followed by a right bracket
*/
const pInlineField = /\\[\s*[a-zA-Z]\s*:\s*[a-zA-Z]*\s*\\]/;
/**
  parse a grace group
  starts with a left brace
  optionally followed by a slash
  followed by a multiple pitch
  followed by a right brace
 */
const pGraceGrp = new RegExp(`{\/?${pPitch.source}+}`);
export function grace_grp(ctx: Ctx): boolean {
  if (!ctx.test(pGraceGrp)) return false;
  ctx.push(TT.GRC_GRP_LEFT_BRACE);
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
  ctx.push(TT.GRC_GRP_RGHT_BRACE);
  return true;
}

export function inline_field(ctx: Ctx): boolean {
  if (!ctx.test(pInlineField)) return false;
  ctx.push(TT.INLN_FLD_LFT_BRKT);
  while (!isAtEnd(ctx) && !ctx.test("]")) {
    advance(ctx);
  }
  ctx.push(TT.INLN_FLD_RGT_BRKT);
  return true;
}

export function string(ctx: Ctx): boolean {
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
  ctx.push(TT.STRING);
  return true;
}

export function advance(ctx: Ctx, count?: number) {
  if (isAtEnd(ctx)) return;
  if (!count) {
    count = 1;
  }
  ctx.current += count;
}

export function peek(ctx: Ctx) {
  if (isAtEnd(ctx)) {
    return "\0";
  }
  return ctx.source.charAt(ctx.current);
}

export function isAtEnd(ctx: Ctx) {
  return ctx.current >= ctx.source.length;
}

export enum TT {
  INF_LN_HDR,
  Y_SPC,
  REST,
  GRC_GRP_RGHT_BRACE,
  GRC_GRP_LEFT_BRACE,
  INLN_FLD_RGT_BRKT,
  INLN_FLD_LFT_BRKT,
  CHRD_LEFT_BRKT,
  CHRD_RIGHT_BRKT,
  RHY_NUMER,
  RHY_BRKN,
  RHY_DENOM,
  RHY_SEP,
  ACCIDENTAL,
  TIE,
  OCTAVE,
  SCT_BRK,
  NOTE_LETTER,
  VOICE_CNTD,
  VOICE,
  DECORATION,

  APOSTROPHE,
  ANTISLASH_EOL,
  AMPERSAND, // &
  BARLINE, //|
  BAR_COLON, // |:
  BAR_DBL, // ||
  BAR_DIGIT, // |1
  BAR_RIGHTBRKT, // |]
  COLON, // :
  COLON_BAR, // :|
  COLON_BAR_DIGIT, // :|1
  COLON_DBL, // ::
  COLON_NUMBER, // :1
  COMMA, //,,,,,,
  COMMENT,
  DOLLAR, //$
  DOT,
  EOF,
  EOL,
  ESCAPED_CHAR,
  FLAT, // ♭
  FLAT_DBL, // 𝄫
  GREATER, //>>>>>
  LEFTBRKT_BAR, // [|
  LEFTBRKT_NUMBER, // [number
  LEFT_BRACE, // {
  LEFTBRKT, // [
  LEFTPAREN, // (
  LEFTPAREN_NUMBER, // (1
  LESS, // <<<<<
  LETTER,
  LETTER_COLON,
  MINUS, //-
  NATURAL, // ♮
  NUMBER,
  PLUS, //+
  PLUS_COLON, //+: - extending info line
  RESERVED_CHAR,
  RIGHT_BRACE, // }
  RIGHT_BRKT,
  RIGHT_PAREN, // )
  SHARP, // ♯
  SHARP_DBL, // 𝄪
  SLASH, // ////
  STRING, // any un-categorizable text
  STYLESHEET_DIRECTIVE, // %%
  SYMBOL, // ![a-zA-Z]!
  TILDE, // ~
  /**
   * # * ; ? @ are reserved symbols, treated as ws
   */
  WHITESPACE,
  WHITESPACE_FORMATTER, // THIS IS NOT USED IN THE LEXER OR THE PARSER, only in the formatter
}

export class Token {
  public type: TT;
  public lexeme: string;
  public literal: any | null;
  public line: number;
  public position: number;
  public toString = () => {
    return this.type + " " + this.lexeme + " " + this.literal;
  };
  constructor(type: TT, ctx: Ctx) {
    this.type = type;
    this.lexeme = ctx.source.slice(ctx.start, ctx.current);
    this.line = ctx.line;
    this.position = ctx.start;
  }
}
