import { File_header, File_structure, Tune } from "../types/Expr";
import { AbcErrorReporter } from "./ErrorReporter";

class Ctx {
  public source: string;
  public tokens: Array<Token>;
  public start: number;
  public current: number;
  public line: number;
  public errorReporter?: AbcErrorReporter

  constructor(source: string, errorReporter: AbcErrorReporter) {
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
      return this.source.charAt(offset ?? this.current) == pattern;
    }

  }

  push(tokenType: TT) {
    this.tokens.push(new Token(tokenType, this));
    this.start = this.current;
    this.current += 1;
  }

  report(msg: string) {
    this.errorReporter?.ScannerError(this, msg);
  }
}
function Scanner2(source: string, errorReporter?: AbcErrorReporter): Array<Token> {

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
const pInfoLine = /\s*[a-zA-Z]:/;
const pTuneHeadStrt = /\s*X:/;
const pDuration = /\d*\/\d*/;
const pSectionBrk = /\n[\n]+/;
const pPitch = /[\\^=_][a-zA-G][,']*/
const pNumber = /[1-9][0-9]+/;
const pRest = /[zZxX]/

const pDeco = /[~\.HLMOPSTuv]/;

function fileStructure(ctx: Ctx) {

  while (!isAtEnd(ctx)) {
    if (ctx.current === 0 && !ctx.test(pTuneHeadStrt)) {
      fileHeader(ctx);
    } else if (ctx.test(pInfoLine)) {
      scanTune(ctx);
    }
  }
  return ctx.tokens;
}
function fileHeader(ctx: Ctx): File_header | null {
  return null;
};
function scanHead(ctx: Ctx) { }

function scanTune(ctx: Ctx) {
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
function scanTuneHeadLine(ctx: Ctx) { }
function scanTuneBody(ctx: Ctx) { }

function note(ctx: Ctx) {
  tie(ctx);
  pitch(ctx);
  if (ctx.test(pDuration)) {
    rhythm(ctx);
  }
  tie(ctx);
}

function tie(ctx: Ctx) {
  if (ctx.test("-")) {
    ctx.push(TT.TIE);
  }
}

function music_scan(ctx: Ctx) {
  switch (peek(ctx)) {
    case "&": {
      if (ctx.test(/\&\n/)) {
        advance(ctx, 2);
        ctx.push(TT.VOICE_CNTD)
      } else {
        ctx.push(TT.VOICE)
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

function stylesheet_directive(ctx: Ctx): boolean {
  if (!ctx.test("%%")) return false;
  advance(ctx, 2);
  while (!isAtEnd(ctx) && !ctx.test(pEOL)) {
    advance(ctx);
  }
  ctx.push(TT.STYLESHEET_DIRECTIVE);
  return true;
}

function comment(ctx: Ctx): boolean {
  if (!ctx.test("%")) return false;
  advance(ctx);
  while (!isAtEnd(ctx) && !ctx.test(pEOL)) {
    advance(ctx);
  }
  ctx.push(TT.COMMENT);
  return true;
}

function decoration(ctx: Ctx): boolean {
  // FIXME: \zs is not valid regex, that’s vim regex
  const ptrn = new RegExp(`${pDeco.source}+\zs(${pPitch.source}|${pRest.source})`);
  const mtch = ptrn.exec(ctx.source.substring(ctx.start));
  if (mtch) {
    ctx.current = ctx.start + mtch[0].length;
    ctx.push(TT.DECORATION);
    return true;
  }
  return false;
}

function symbol(ctx: Ctx): boolean {
  if (!ctx.test("!")) return false;
  while (!ctx.test("!")) {
    advance(ctx);
  }
  advance(ctx);
  ctx.push(TT.SYMBOL);
  return true;
}

function rhythm(ctx: Ctx): boolean {
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
  return true;
}

function pitch(ctx: Ctx): boolean {
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

function accidental(ctx: Ctx): boolean {
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
      return false
  }
}

function advance(ctx: Ctx, count?: number) {
  if (
    isAtEnd(ctx)
  ) return;
  if (!count) {
    count = 1;
  }
  ctx.current += count;
}

function peek(ctx: Ctx) {
  if (isAtEnd(ctx)) {
    return "\0";
  }
  return ctx.source.charAt(ctx.current);
}

function isAtEnd(ctx: Ctx) {
  return ctx.current >= ctx.source.length;
}


enum TT {
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
  constructor(
    type: TT,
    ctx: Ctx
  ) {
    this.type = type;
    this.lexeme = ctx.source.slice(ctx.start, ctx.current);
    this.line = ctx.line;
    this.position = ctx.start;
  }
}
