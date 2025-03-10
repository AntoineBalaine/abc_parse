import { File_header, File_structure, Tune } from "../types/Expr";
import { AbcErrorReporter } from "./ErrorReporter";
import { comment, pEOL, pInfoLine, pSectionBrk, pTuneHeadStrt, scanTune } from "./scan_tunebody";

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
    } else if (ctx.test(pTuneHeadStrt)) {
      scanTune(ctx);
      sectionBreak(ctx);
    } else {
      freeText(ctx);
    }
  }
  return ctx.tokens;
}
export function fileHeader(ctx: Ctx) {
  /**
   * contains info lines, comment lines and stylesheet directives
   * any info line that starts with a pTuneHeadStrt should be considered the end of the file header
   * and return immediately
   */
  while (!isAtEnd(ctx)) {
    ctx.start = ctx.current;

    // Check if we've reached a tune header start (X:)
    if (ctx.test(pTuneHeadStrt)) {
      return ctx.tokens;
    }

    // Try each tokenizer function in order of precedence
    if (stylesheet_directive(ctx)) continue;
    if (comment(ctx)) continue;
    if (info_line(ctx)) continue;
    if (EOL(ctx)) continue;
    if (WS(ctx)) continue;

    // If no match is found, treat as free text line
    freeTextLine(ctx);
  }

  return ctx.tokens;
}

export function freeTextLine(ctx: Ctx) {
  while (!isAtEnd(ctx) && !ctx.test(pEOL)) {
    advance(ctx);
  }
  ctx.push(TT.FREE_TXT);
  return;
}

export function sectionBreak(ctx: Ctx): boolean {
  const match = pSectionBrk.exec(ctx.source.substring(ctx.current));
  if (!match) return false;
  ctx.current += match[0].length;
  ctx.push(TT.SCT_BRK);
  return true;
}

export function freeText(ctx: Ctx) {
  while (!isAtEnd(ctx) && !ctx.test(pSectionBrk)) {
    advance(ctx);
  }
  ctx.push(TT.FREE_TXT);
  return;
}

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
  FREE_TXT,
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
  REPEAT_NUMBER, // For repeat numbers (1, 2, 3, etc.)
  REPEAT_COMMA, // For commas separating numbers (1,2,3)
  REPEAT_DASH, // For dashes in ranges (1-3)
  REPEAT_X, // For 'x' notation (1x2)
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
export function stylesheet_directive(ctx: Ctx): boolean {
  if (!ctx.test("%%")) return false;
  advance(ctx, 2);
  while (!isAtEnd(ctx) && !ctx.test(pEOL)) {
    advance(ctx);
  }
  ctx.push(TT.STYLESHEET_DIRECTIVE);
  return true;
}
export function info_line(ctx: Ctx): boolean {
  if (!ctx.test(pInfoLine)) return false;

  // Find the colon position
  let colonPos = ctx.current;
  while (colonPos < ctx.source.length && ctx.source[colonPos] !== ":") {
    colonPos++;
  }

  // Advance to the colon and push the header token
  advance(ctx, colonPos - ctx.current + 1);
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
