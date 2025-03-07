import { File_header, File_structure, Tune } from "../types/Expr";
import { AbcErrorReporter } from "./ErrorReporter";
import { pEOL, pInfoLine, pSectionBrk, pTuneHeadStrt, scanTuneBody } from "./scan_tunebody";

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

export function WS(ctx: Ctx): boolean {
  // Handle whitespace and newlines
  if (ctx.test(/ /)) {
    advance(ctx);
    ctx.push(TT.WS);
    return true;
  }
  return false;
}

export function EOL(ctx: Ctx): boolean {
  if (ctx.test(pEOL)) {
    advance(ctx);
    ctx.push(TT.EOL);
    ctx.line++;
    return true;
  }
  return false;
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
  ACCIDENTAL,
  AMPERSAND, // &
  ANNOTATION,
  BARLINE, //|
  BCKTCK_SPC,
  CHRD_LEFT_BRKT,
  CHRD_RIGHT_BRKT,
  COMMENT,
  DECORATION,
  EOF,
  EOL,
  ESCAPED_CHAR,
  GRC_GRP_LEFT_BRACE,
  GRC_GRP_RGHT_BRACE,
  GRC_GRP_SLSH,
  INFO_STR,
  INF_HDR,
  INF_TXT,
  INLN_FLD_LFT_BRKT,
  INLN_FLD_RGT_BRKT,
  NOTE_LETTER,
  OCTAVE,
  RESERVED_CHAR,
  REST,
  RHY_BRKN,
  RHY_DENOM,
  RHY_NUMER,
  RHY_SEP,
  SCT_BRK,
  SLUR,
  STYLESHEET_DIRECTIVE, // %%
  SYMBOL, // ![a-zA-Z]!
  TIE,
  TUPLET,
  VOICE,
  VOICE_OVRLAY,
  WS,
  Y_SPC,
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
