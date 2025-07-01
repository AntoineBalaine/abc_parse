import { Visitor } from "../types/Expr2";
import { ABCContext } from "./Context";
import { AbcErrorReporter } from "./ErrorReporter";
import { comment, pEOL, pInfoLine, pMacroLine, pSectionBrk, pTuneHeadStrt, scanTune } from "./scan_tunebody";

export class Ctx {
  public source: string;
  public tokens: Array<Token>;
  public start: number;
  public current: number;
  public line: number;
  public errorReporter?: AbcErrorReporter;
  public abcContext: ABCContext;
  public macros?: Map<string, string>;

  constructor(source: string, abcContext: ABCContext) {
    this.source = source;
    this.tokens = [];
    this.start = 0;
    this.current = 0;
    this.line = 0;
    this.abcContext = abcContext;
    this.errorReporter = abcContext.errorReporter;
    this.macros = new Map<string, string>();
  }
  test(pattern: RegExp | string, offset?: number) {
    if (pattern instanceof RegExp) {
      return new RegExp(`^${pattern.source}`).test(this.source.substring(this.current));
    } else {
      offset = offset ?? this.current;
      return this.source.substring(offset, offset + pattern.length) === pattern;
    }
  }

  push(tokenType: TT) {
    const id = this.abcContext.generateId();
    this.tokens.push(new Token(tokenType, this, id));
    this.start = this.current;
  }

  report(msg: string) {
    this.errorReporter?.Scanner2Error(this, msg);
  }
}
export function Scanner2(source: string, abcContext: ABCContext): Array<Token> {
  const ctx = new Ctx(String.raw`${source}`, abcContext);
  while (!isAtEnd(ctx)) {
    ctx.start = ctx.current;
    fileStructure(ctx);
  }

  ctx.push(TT.EOF);
  return ctx.tokens;
}

export function fileStructure(ctx: Ctx) {
  while (!isAtEnd(ctx)) {
    if (sectionBreak(ctx)) continue;
    if (fileHeader(ctx)) continue;
    if (scanTune(ctx)) continue;
    freeText(ctx);
  }
  return ctx.tokens;
}

export function tuneStartBeforeSectBrk(source: string): boolean {
  const sectionBreakMatch = new RegExp(pSectionBrk.source).exec(source);
  const sectionBreakPos = sectionBreakMatch ? sectionBreakMatch.index : Infinity;
  const tuneHeadMatch = new RegExp(pTuneHeadStrt.source).exec(source);
  const tuneHeadPos = tuneHeadMatch ? tuneHeadMatch.index : Infinity;
  if (tuneHeadPos === Infinity && sectionBreakPos === Infinity) {
    return false;
  }
  return tuneHeadPos < sectionBreakPos;
}

export function isFileHeader(ctx: Ctx): boolean {
  if (ctx.current !== 0) return false;
  /**
   * false if tune header start before section break
   * false if no text
   * true if only header content
   */

  if (tuneStartBeforeSectBrk(ctx.source.substring(ctx.current))) {
    return false;
  }

  return true;
}

export function fileHeader(ctx: Ctx) {
  if (!isFileHeader(ctx)) {
    return false;
  }
  /**
   * contains info lines, comment lines and stylesheet directives
   * any info line that starts with a pTuneHeadStrt should be considered the end of the file header
   * and return immediately
   */
  while (!isAtEnd(ctx)) {
    ctx.start = ctx.current;

    // Check if we've reached a tune header start (X:)
    if (ctx.test(pTuneHeadStrt) || ctx.test(pSectionBrk)) {
      return ctx.tokens;
    }

    // Try each tokenizer function in order of precedence
    if (stylesheet_directive(ctx)) continue;
    if (comment(ctx)) continue;
    if (macro_decl(ctx)) continue;
    if (info_line(ctx)) continue;
    if (EOL(ctx)) continue;
    if (WS(ctx)) continue;

    // If no match is found, treat as free text line
    freeTextLine(ctx);
  }

  return true;
}

export function freeTextLine(ctx: Ctx) {
  while (!isAtEnd(ctx) && !ctx.test(pEOL)) {
    advance(ctx);
  }
  ctx.push(TT.FREE_TXT);
}

export function sectionBreak(ctx: Ctx): boolean {
  const match = new RegExp(`^${pSectionBrk.source}`).exec(ctx.source.substring(ctx.current));
  if (!match) return false;
  ctx.current += match[0].length;
  ctx.push(TT.SCT_BRK);
  ctx.line += 2;
  return true;
}

export function freeText(ctx: Ctx) {
  while (!isAtEnd(ctx) && !ctx.test(pSectionBrk)) {
    advance(ctx);
  }
  ctx.push(TT.FREE_TXT);
}

export function WS(ctx: Ctx, nopush: boolean = false): boolean {
  // Handle whitespace and newlines

  const match = /^[ \t]+/.exec(ctx.source.substring(ctx.current));
  if (!match) return false;
  ctx.current += match[0].length;
  if (nopush) {
    ctx.start = ctx.current; // Reset start to current position
  } else {
    ctx.push(TT.WS);
  }
  return true;
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
  INF_CTND, // field continuation
  INFO_STR,
  INF_HDR,
  INLN_FLD_LFT_BRKT,
  INLN_FLD_RGT_BRKT,
  INVALID, // For invalid tokens that should be preserved
  LY_HDR, // lyric header
  LY_HYPH,
  LY_SECT_HDR,
  LY_SPS,
  LY_STAR,
  LY_TXT,
  LY_UNDR,
  MACRO_HDR,
  MACRO_INVOCATION,
  MACRO_STR,
  MACRO_VAR,
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
  TUPLET_LPAREN, // Opening parenthesis of a tuplet (
  TUPLET_P, // The p value in a tuplet
  TUPLET_COLON, // The colon separator in a tuplet :
  TUPLET_Q, // The q value in a tuplet
  TUPLET_R, // The r value in a tuplet
  VOICE,
  VOICE_OVRLAY,
  WS,
  Y_SPC,
  REPEAT_NUMBER, // For repeat numbers (1, 2, 3, etc.)
  REPEAT_COMMA, // For commas separating numbers (1,2,3)
  REPEAT_DASH, // For dashes in ranges (1-3)
  REPEAT_X, // For 'x' notation (1x2)
  SY_HDR, // symbol line header
  SY_STAR, // symbol line star
  SY_TXT, // symbol line text
}

export class Token {
  public type: TT;
  public lexeme: string;
  public line: number;
  public position: number;
  public id: number;

  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitToken(this);
  }
  public toString = () => {
    return `${this.type} ${this.lexeme} (id: ${this.id})`;
  };

  constructor(type: TT, ctx: Ctx | string, id: number) {
    this.id = id;

    if (ctx instanceof Ctx) {
      this.type = type;
      this.lexeme = ctx.source.slice(ctx.start, ctx.current);
      this.line = ctx.line;
      // Calculate position relative to the start of the line
      const lineBreak = ctx.line === 0 ? 0 : ctx.source.lastIndexOf("\n", ctx.start) + 1;
      this.position = ctx.start - lineBreak;
    } else {
      this.type = type;
      this.lexeme = ctx;
      this.line = 0;
      this.position = 0;
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

export function precededBy(ctx: Ctx, needles: Set<TT>, ignoreTokens: Set<TT>): boolean {
  // backtrack through the context’s tokens, until you find one of the
  for (let i = ctx.tokens.length - 1; i > 0; i--) {
    const cur = ctx.tokens[i];
    if (needles.has(cur.type)) return true;
    else if (ignoreTokens.has(cur.type)) continue;
    else return false;
  }
  return true;
}

export function info_line(ctx: Ctx): boolean {
  if (!(ctx.test(pInfoLine) && precededBy(ctx, new Set([TT.EOL, TT.SCT_BRK]), new Set([TT.WS])))) return false;

  const match = new RegExp(`^${pInfoLine.source}`).exec(ctx.source.substring(ctx.current));
  if (!match) return false;
  ctx.current += match[0].length;
  ctx.push(TT.INF_HDR);

  while (!isAtEnd(ctx) && !ctx.test(pEOL)) {
    if (ctx.test("%")) {
      break;
    } else {
      advance(ctx);
    }
  }
  if (ctx.current !== ctx.start) {
    ctx.push(TT.INFO_STR);
  }
  comment(ctx);
  return true;
}

/** grammar rule: variable declarations can’t start with a number.
 * Also, they can’t contain the y char, since it is reserved for y-spacers.
 */
export function macro_decl(ctx: Ctx): boolean {
  if (!(ctx.test(pMacroLine) && ctx.tokens.length > 0 && precededBy(ctx, new Set([TT.EOL, TT.SCT_BRK]), new Set([TT.WS])))) return false;
  const match = new RegExp(`^${pMacroLine.source}`).exec(ctx.source.substring(ctx.current));

  if (!match) return false;
  ctx.current += match[0].length;
  ctx.push(TT.MACRO_HDR);

  enum Expect {
    VAR,
    EQUALS,
    CONTENT,
  }

  let state: Expect = Expect.VAR;

  outer: while (!isAtEnd(ctx) && !ctx.test(pEOL) && !ctx.test("%")) {
    if (WS(ctx, true)) continue; // Use your existing WS function

    switch (state) {
      case Expect.VAR: {
        if (ctx.test(/[a-xzA-XZ~][a-xzA-XZ0-9~]*/)) {
          while (ctx.test(/[a-xzA-XZ0-9~]/)) {
            advance(ctx);
          }
          ctx.push(TT.MACRO_VAR);
          state = Expect.EQUALS;
          continue outer;
        } else {
          collectInvalidInfoLn(ctx, "expected macro variable declaration");
          return true;
        }
      }

      case Expect.EQUALS: {
        if (ctx.test("=")) {
          advance(ctx);
          ctx.start = ctx.current;
          state = Expect.CONTENT;
          continue outer;
        } else {
          collectInvalidInfoLn(ctx, "expected `=` sign in macro declaration");
          return true;
        }
      }
      case Expect.CONTENT: {
        while (!isAtEnd(ctx) && !ctx.test(pEOL) && !ctx.test("%")) {
          advance(ctx);
        }
        if (ctx.current > ctx.start) {
          ctx.push(TT.MACRO_STR);
          const variable = ctx.tokens[ctx.tokens.length - 2];
          const contents = ctx.tokens[ctx.tokens.length - 1];
          if (!ctx.macros) {
            ctx.macros = new Map<string, string>();
          }
          ctx.macros.set(variable.lexeme, contents.lexeme);
          break outer;
        } else {
          collectInvalidInfoLn(ctx, "expected contents of macro declaration");
          return true;
        }
      }
    }
  }

  comment(ctx);
  return true;
}

export function macro_invocation(ctx: Ctx): boolean {
  // Check if current position matches any declared macro variable
  if (!ctx.macros) return false;
  for (const [variable] of ctx.macros) {
    // allow EOF, WS and y-spacers after macro invocation
    if (ctx.test(new RegExp(`^${variable}(?=[ \tyY\n]|$)`))) {
      advance(ctx, variable.length);
      ctx.push(TT.MACRO_INVOCATION);
      return true;
    }
  }
  return false;
}

export function collectInvalidInfoLn(ctx: Ctx, msg: string): boolean {
  if (msg) ctx.report(msg);
  // Store the starting position to ensure we capture all characters
  const startPos = ctx.current;

  // Advance until we find a character that could start a valid token
  // or until we reach the end of the line or input

  function infoLineRecoveryPoint(ctx: Ctx) {
    return (
      ctx.test(pEOL) || // stylesheet directive
      ctx.test("%")
    ); // comment
  }
  while (!isAtEnd(ctx) && !ctx.test(pEOL) && !infoLineRecoveryPoint(ctx)) {
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
