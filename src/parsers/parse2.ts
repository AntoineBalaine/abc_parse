import { followedBy, foundBeam, isBeamBreaker } from "../helpers";
import {
  Annotation,
  BarLine,
  Beam,
  Beam_contents,
  Chord,
  Comment,
  Decoration,
  Directive,
  ErrorExpr,
  Expr,
  File_header,
  File_structure,
  Grace_group,
  Info_line,
  InfoLineUnion,
  Inline_field,
  Lyric_line,
  Lyric_section,
  Macro_decl,
  Macro_invocation,
  MultiMeasureRest,
  Note,
  Pitch,
  Rest,
  Rhythm,
  Symbol,
  System,
  Tune,
  Tune_Body,
  tune_body_code,
  Tune_header,
  Tuplet,
  User_symbol_decl,
  User_symbol_invocation,
  YSPACER,
} from "../types/Expr2";
import { ABCContext } from "./Context";
import { parseInfoLine2 } from "./infoLines/parseInfoLine2";
import { Token, TT } from "./scan2";
import { parseSystemsWithVoices } from "./voices2";

// Parse Context
export class ParseCtx {
  tokens: Token[];
  current: number = 0;
  abcContext: ABCContext;

  constructor(tokens: Token[], abcContext: ABCContext) {
    this.tokens = tokens;
    this.abcContext = abcContext;
  }

  peek(): Token {
    return this.tokens[this.current];
  }

  previous(): Token {
    return this.tokens[this.current - 1];
  }

  advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  match(type: TT): boolean {
    if (this.check(type)) {
      this.advance();
      return true;
    }
    return false;
  }

  check(type: TT): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  isAtEnd(): boolean {
    return this.current >= this.tokens.length || this.tokens[this.current].type === TT.EOF;
  }

  report(message: string): void {
    this.abcContext.errorReporter.Scanner2Error(
      {
        source: "",
        tokens: [],
        start: 0,
        current: 0,
        line: 0,
        report: () => {},
        push: () => {},
        test: () => false,
        abcContext: this.abcContext,
      },
      message
    );
  }
}

export function parse(tokens: Token[], abcContext: ABCContext): File_structure {
  const ctx = new ParseCtx(tokens, abcContext);
  const seq: Array<Tune | Token> = [];
  const fileHeader = parseFileHeader(ctx);
  while (!ctx.isAtEnd()) {
    const cur = ctx.peek();
    if (isTune(ctx)) {
      // TODO: modifiy signature so that parseTune returns Tune | null
      parseTune(ctx, seq);
      continue;
    }
    switch (cur.type) {
      case TT.SCT_BRK:
        ctx.advance();
        continue;
      case TT.FREE_TXT:
        seq.push(ctx.advance());
        continue;
      case TT.INVALID:
        seq.push(ctx.advance());
        continue;
      default:
        ctx.report("parser: unexpected token");
        seq.push(ctx.advance());
    }

    ctx.report("unexpected");
  }
  return new File_structure(ctx.abcContext.generateId(), fileHeader, seq);
}
function isTuneStart(token: Token): boolean {
  return token.type === TT.INF_HDR && token.lexeme.trim() === "X:";
}
export function parseFileHeader(ctx: ParseCtx, prnt_arr?: Array<Expr | Token>): null | File_header {
  // parse as long as we don’t have a tune start or section break
  // iterate through lines. If we find a tune start token before a section break, then this is a tune header.
  // otherwise, this is a file header.
  let pos = ctx.current;
  let tok = ctx.tokens[pos];
  while (!(pos >= ctx.tokens.length || tok.type === TT.EOF)) {
    if (isTuneStart(tok)) return null;
    if (tok.type === TT.SCT_BRK) {
      break;
    }
    pos += 1;
    tok = ctx.tokens[pos];
  }

  const contents: Array<Expr | Token> = [];
  while (!ctx.isAtEnd() && !ctx.check(TT.SCT_BRK)) {
    if (prsComment(ctx, contents)) continue;
    if (prsDirective(ctx, contents)) continue;
    if (prsMacroDecl(ctx, contents)) continue;
    if (prsUserSymbolDecl(ctx, contents)) continue;
    if (prsInfoLine(ctx, contents)) continue;
    if (ctx.check(TT.EOL) && followedBy(ctx, [TT.INF_HDR, TT.COMMENT, TT.STYLESHEET_DIRECTIVE], [TT.WS])) {
      ctx.advance();
      continue;
    }
    if (ctx.check(TT.FREE_TXT)) {
      contents.push(ctx.advance());
      continue;
    }
    ctx.advance();
  }
  const rv = new File_header(ctx.abcContext.generateId(), contents);
  if (prnt_arr) prnt_arr.push(rv);
  return rv;
}

function isTune(ctx: ParseCtx) {
  let pos = ctx.current;
  let tok = ctx.tokens[pos];
  while (!(pos >= ctx.tokens.length || tok.type === TT.EOF)) {
    if (isTuneStart(tok)) return true;
    if (tok.type === TT.SCT_BRK) {
      return false;
    }
    pos += 1;
    tok = ctx.tokens[pos];
  }
  return false;
}

// Main parser export function
export function parseTune(ctx: ParseCtx, prnt_arr?: Array<Expr | Token>): Tune {
  // Parse header information
  const tuneHeader = prsTuneHdr(ctx);
  // Parse body (music sections) with voices from the header
  const tuneBody = prsBody(ctx, tuneHeader.voices);

  const rv = new Tune(ctx.abcContext.generateId(), tuneHeader, tuneBody);
  if (prnt_arr) prnt_arr.push(rv);
  return rv;
}

export function prsTuneHdr(ctx: ParseCtx): Tune_header {
  const infoLines: Array<Expr> = [];
  const voices: string[] = [];
  while (!ctx.isAtEnd() && !ctx.check(TT.SCT_BRK)) {
    if (prsComment(ctx, infoLines)) continue;
    if (prsDirective(ctx, infoLines)) continue;
    if (prsMacroDecl(ctx, infoLines)) continue;
    if (prsUserSymbolDecl(ctx, infoLines)) continue;
    if (alreadyHasVoice(ctx, voices)) {
      return new Tune_header(ctx.abcContext.generateId(), infoLines as Array<Info_line | Comment>, voices);
    }
    if (prsInfoLine(ctx, infoLines)) {
      const info_line = infoLines[infoLines.length - 1] as Info_line;
      if (info_line.key.lexeme.trim() === "V:") {
        const voiceName = info_line.value[0].lexeme.trim();
        if (voiceName && !voices.includes(voiceName)) {
          voices.push(voiceName);
        }
      }
      continue;
    }

    if (ctx.check(TT.EOL) && followedBy(ctx, [TT.INF_HDR, TT.COMMENT, TT.STYLESHEET_DIRECTIVE], [TT.WS])) {
      ctx.advance();
      continue;
    }
    break;
  }

  ctx.match(TT.EOL);
  return new Tune_header(ctx.abcContext.generateId(), infoLines as Array<Info_line | Comment>, voices);
}

export function alreadyHasVoice(ctx: ParseCtx, voices?: Array<string>): boolean {
  if (!voices) {
    return false;
  }
  var pkd = ctx.peek();
  if (pkd.type === TT.INF_HDR && pkd.lexeme.trim() === "V:") {
    let i = ctx.current + 1;
    let info_txt = ctx.tokens[i];
    const voiceName = info_txt.lexeme.trim().split(" ")[0];
    return !!voiceName && voices.includes(voiceName);
  }
  return false;
}

export function prsDirective(ctx: ParseCtx, prnt_arr?: Array<Expr | Token>): Directive | null {
  if (ctx.match(TT.STYLESHEET_DIRECTIVE)) {
    const rv = new Directive(ctx.abcContext.generateId(), ctx.previous());
    prnt_arr && prnt_arr.push(rv);
    return rv;
  }
  return null;
}
export function prsComment(ctx: ParseCtx, prnt_arr?: Array<Expr | Token>): Comment | null {
  if (ctx.match(TT.COMMENT)) {
    const rv = new Comment(ctx.abcContext.generateId(), ctx.previous());
    prnt_arr && prnt_arr.push(rv);
    return rv;
  }
  return null;
}

export function prsInfoLine(ctx: ParseCtx, prnt_arr?: Array<Expr | Token>): Info_line | null {
  // FIXME: add a condition to check that this is NOT a lyric line?
  if (ctx.match(TT.INF_HDR)) {
    const field = ctx.previous();
    const tokens: Token[] = [field];

    // Save current position to collect tokens consumed by parseInfoLine2
    const startPos = ctx.current;

    // Use unified parser to parse the info line content
    const expressions = parseInfoLine2(ctx);

    // Collect all tokens that were consumed by parseInfoLine2
    for (let i = startPos; i < ctx.current; i++) {
      tokens.push(ctx.tokens[i]);
    }

    // Collect any remaining tokens (comments, etc.)
    while (ctx.match(TT.COMMENT)) {
      tokens.push(ctx.previous());
    }

    const rv = new Info_line(ctx.abcContext.generateId(), tokens, undefined, expressions);
    prnt_arr && prnt_arr.push(rv);
    return rv;
  }
  return null;
}

export function prsLyricSection(ctx: ParseCtx, prnt_arr?: Array<Expr | Token>): Lyric_section | null {
  // Check if we have a lyric header (w: or W:)
  if (!ctx.check(TT.LY_HDR) && !ctx.check(TT.LY_SECT_HDR)) {
    return null;
  }

  const info_lines: Info_line[] = [];

  // Parse consecutive lyric lines
  const lyricHeader = ctx.advance(); // Get the lyric header token
  let tokens: Token[] = [lyricHeader];

  // Collect all tokens that belong to this lyric line
  while (!ctx.isAtEnd()) {
    if (!isLyricToken(ctx)) {
      break;
    }
    if (infoLineContinued(ctx)) {
      tokens.push(ctx.advance());
      tokens.push(ctx.advance());
      continue;
    }
    tokens.push(ctx.advance());
  }

  if (tokens.length > 0) {
    info_lines.push(new Info_line(ctx.abcContext.generateId(), tokens));
  }

  const rv = new Lyric_section(ctx.abcContext.generateId(), info_lines);
  prnt_arr && prnt_arr.push(rv);
  return rv;
}

function infoLineContinued(ctx: ParseCtx): boolean {
  return ctx.check(TT.EOL) && ctx.tokens[ctx.current + 1].type === TT.INF_CTND;
}

export function isLyricToken(ctx: ParseCtx): boolean {
  const cur_tkn = ctx.peek();
  if (infoLineContinued(ctx)) return true;
  switch (cur_tkn.type) {
    case TT.LY_TXT:
    case TT.LY_HYPH:
    case TT.LY_UNDR:
    case TT.LY_STAR:
    case TT.LY_SPS:
    case TT.WS:
    case TT.BARLINE:
    case TT.COMMENT:
    case TT.INF_CTND:
      return true;
    default:
      return false;
  }
}

export function prsBody(ctx: ParseCtx, voices: string[] = []): Tune_Body | null {
  const elmnts: Array<tune_body_code> = [];

  // Parse until end of file or section break
  while (!ctx.isAtEnd() && !ctx.check(TT.SCT_BRK)) {
    if (prsComment(ctx, elmnts)) continue;
    if (prsLyricLine(ctx, elmnts)) continue;
    if (prsLyricSection(ctx)) continue;
    if (parseMacroInvocation(ctx, elmnts)) continue;
    if (parseUserSymbolInvocation(ctx, elmnts)) continue;
    if (prsInfoLine(ctx, elmnts)) continue;
    if (parseMusicCode(ctx, elmnts)) continue;

    elmnts.push(ctx.advance());
  }

  // Process beams in the elements array
  const processedElements = prcssBms(elmnts, ctx.abcContext);

  return new Tune_Body(ctx.abcContext.generateId(), prsSystems(processedElements as tune_body_code[], voices));
}

export function prcssBms(elmnts: Array<Expr | Token>, abcContext: ABCContext): Array<Expr | Token> {
  let rv: Array<Expr | Token> = [];
  const beamCtx = new BeamCtx(elmnts, abcContext);
  while (!beamCtx.isAtEnd()) {
    const cur = beamCtx.peek();
    if (prsBeam(beamCtx, rv)) continue;
    rv.push(cur);
    beamCtx.advance();
  }
  return rv;
}

// Parse music code
export function parseMusicCode(ctx: ParseCtx, prnt_arr?: Array<Expr | Token>): Array<Expr | Token> | null {
  const elements: Array<Expr | Token> = [];

  while (!ctx.isAtEnd() && !ctx.check(TT.EOL) && !ctx.check(TT.COMMENT) && !ctx.check(TT.INF_HDR) && !ctx.check(TT.SCT_BRK)) {
    // Try each element parser in order of precedence
    const element =
      parseAnnotation(ctx, elements) ||
      parseBarline(ctx, elements) ||
      parseChord(ctx, elements) ||
      parseDecoration(ctx, elements) ||
      parseGraceGroup(ctx, elements) ||
      parseInlineField(ctx, elements) ||
      parseNote(ctx, elements) ||
      parseRest(ctx, elements) ||
      parseSymbol(ctx, elements) ||
      parseTuplet(ctx, elements) ||
      parseYSpacer(ctx, elements) ||
      parseInvalidToken(ctx, elements); // Add handling for invalid tokens
    if (element) continue;

    break;
  }
  if (elements.length > 0) {
    if (prnt_arr) {
      elements.forEach((e) => prnt_arr.push(e));
    }
    return elements;
  }
  return null;
}

// Parse an invalid token into an ErrorExpr
export function parseInvalidToken(ctx: ParseCtx, prnt_arr?: Array<Expr | Token>): ErrorExpr | null {
  if (!ctx.check(TT.INVALID)) {
    return null;
  }

  const token = ctx.advance();
  const errorExpr = new ErrorExpr(ctx.abcContext.generateId(), [token], undefined, `Invalid token: ${token.lexeme}`);

  prnt_arr && prnt_arr.push(errorExpr);
  return errorExpr;
}

// Parse a barline
export function parseBarline(ctx: ParseCtx, prnt_arr?: Array<Expr | Token>): BarLine | null {
  if (!ctx.check(TT.BARLINE)) {
    return null;
  }

  const barlineTokens: Token[] = [];
  barlineTokens.push(ctx.advance());

  // Check for repeat numbers
  let repeatNumbers: Token[] | undefined;
  if (ctx.check(TT.REPEAT_NUMBER)) {
    repeatNumbers = parseRepeatNumbers(ctx);
  }

  const barline = new BarLine(ctx.abcContext.generateId(), barlineTokens, repeatNumbers);
  prnt_arr && prnt_arr.push(barline);
  return barline;
}

// Parse repeat numbers
export function parseRepeatNumbers(ctx: ParseCtx): Token[] {
  const numbers: Token[] = [];

  while (ctx.check(TT.REPEAT_NUMBER) || ctx.check(TT.REPEAT_COMMA) || ctx.check(TT.REPEAT_DASH) || ctx.check(TT.REPEAT_X)) {
    numbers.push(ctx.advance());
  }

  return numbers;
}

// Parse a note
export function parseNote(ctx: ParseCtx, prnt_arr?: Array<Expr | Token>): Note | null {
  // Check for tie at start
  let startTie: Token | undefined;
  if (ctx.match(TT.TIE)) {
    startTie = ctx.previous();
  }

  // Parse pitch
  const pitch = parsePitch(ctx);
  if (!pitch) {
    // If we found a tie but no pitch, rewind
    if (startTie) {
      ctx.current--;
    }
    return null;
  }

  // Parse optional rhythm
  const rhythm = parseRhythm(ctx);

  // Parse optional tie at end
  let endTie: Token | undefined;
  if (ctx.match(TT.TIE)) {
    endTie = ctx.previous();
  }

  // Use the last tie found (end tie takes precedence)
  const tie = endTie || startTie;

  const note = new Note(ctx.abcContext.generateId(), pitch, rhythm, tie);
  prnt_arr && prnt_arr.push(note);
  return note;
}

// Parse a pitch
export function parsePitch(ctx: ParseCtx): Pitch | null {
  let alteration: Token | undefined;
  let noteLetter: Token;
  let octave: Token | undefined;

  // Parse optional accidental
  if (ctx.match(TT.ACCIDENTAL)) {
    alteration = ctx.previous();
  }

  // Parse note letter (required)
  if (!ctx.match(TT.NOTE_LETTER)) {
    // If we found an accidental but no note letter, rewind
    if (alteration) {
      ctx.current--;
    }
    return null;
  }

  noteLetter = ctx.previous();

  // Parse optional octave
  if (ctx.match(TT.OCTAVE)) {
    octave = ctx.previous();
  }

  return new Pitch(ctx.abcContext.generateId(), { alteration, noteLetter, octave });
}

// Parse a rest
export function parseRest(ctx: ParseCtx, prnt_arr?: Array<Expr | Token>): Rest | MultiMeasureRest | null {
  if (!ctx.match(TT.REST)) {
    return null;
  }

  const rest_token = ctx.previous();
  const rhythm = parseRhythm(ctx);

  // Check if this is a multi-measure rest (uppercase Z or X)
  const isMultiMeasureRest = /^[ZX]$/.test(rest_token.lexeme);

  if (isMultiMeasureRest) {
    // For multi-measure rests, only the numerator should be used as the length
    let length = rhythm?.numerator || null;

    // Report an error if the rhythm contains other tokens
    if (rhythm && (rhythm.separator || rhythm.denominator || rhythm.broken)) {
      ctx.report("Multi-measure rest should only have a numerator for length");
    }

    const mmRest = new MultiMeasureRest(ctx.abcContext.generateId(), rest_token, length || undefined);
    prnt_arr && prnt_arr.push(mmRest);
    return mmRest;
  } else {
    // Regular rest
    const rest = new Rest(ctx.abcContext.generateId(), rest_token, rhythm);
    prnt_arr && prnt_arr.push(rest);
    return rest;
  }
}

// Parse a chord
export function parseChord(ctx: ParseCtx, prnt_arr?: Array<Expr | Token>): Chord | null {
  if (!ctx.match(TT.CHRD_LEFT_BRKT)) {
    return null;
  }

  const contents: Array<Note | Token | Annotation> = [];

  // Parse notes in the chord
  while (!ctx.isAtEnd() && !ctx.check(TT.CHRD_RIGHT_BRKT)) {
    // Try to parse a note
    const note = parseNote(ctx);
    if (note) {
      contents.push(note);
      continue;
    }

    // Try to parse an annotation
    if (ctx.check(TT.ANNOTATION)) {
      contents.push(new Annotation(ctx.abcContext.generateId(), ctx.advance()));
      continue;
    }

    // Skip unexpected tokens inside chord
    ctx.report("Expected note or annotation in chord");
    ctx.advance();
  }

  // Expect closing bracket
  if (!ctx.match(TT.CHRD_RIGHT_BRKT)) {
    ctx.report("Unterminated chord - expected ']'");
  }

  // Parse optional rhythm
  const rhythm = parseRhythm(ctx);

  // Parse optional tie
  let tie: Token | undefined;
  if (ctx.match(TT.TIE)) {
    tie = ctx.previous();
  }

  const chord = new Chord(ctx.abcContext.generateId(), contents, rhythm, tie);
  prnt_arr && prnt_arr.push(chord);
  return chord;
}

// Parse a grace note group
export function parseGraceGroup(ctx: ParseCtx, prnt_arr?: Array<Expr | Token>): Grace_group | null {
  if (!ctx.match(TT.GRC_GRP_LEFT_BRACE)) {
    return null;
  }

  const notes: Array<Note | Token> = [];
  let isAccacciatura = false;

  // Parse optional slash
  if (ctx.match(TT.GRC_GRP_SLSH)) {
    isAccacciatura = true;
  }

  // Parse grace notes
  while (!ctx.isAtEnd() && !ctx.check(TT.GRC_GRP_RGHT_BRACE)) {
    // Try to parse a note
    const note = parseNote(ctx);
    if (note) {
      notes.push(note);
      continue;
    }

    // Skip whitespace
    if (ctx.match(TT.WS)) {
      continue;
    }

    // Skip unexpected tokens
    ctx.report("Expected grace note");
    ctx.advance();
  }

  // Expect closing brace
  if (!ctx.match(TT.GRC_GRP_RGHT_BRACE)) {
    ctx.report("Unterminated grace group - expected '}'");
  }

  const grace_grp = new Grace_group(ctx.abcContext.generateId(), notes, isAccacciatura);
  prnt_arr && prnt_arr.push(grace_grp);
  return grace_grp;
}

// Parse a tuplet
export function parseTuplet(ctx: ParseCtx, prnt_arr?: Array<Expr | Token>): Tuplet | null {
  if (ctx.match(TT.TUPLET_LPAREN)) {
    // Parse p value (required)
    if (!ctx.match(TT.TUPLET_P)) {
      ctx.report("Expected number after tuplet opening");
      return null;
    }
    const p = ctx.previous();

    // Parse optional q value
    let q: Token | undefined;
    let r: Token | undefined;

    if (ctx.match(TT.TUPLET_COLON)) {
      // Skip the colon token
      if (ctx.match(TT.TUPLET_Q)) {
        q = ctx.previous();
      }

      // Parse optional r value
      if (ctx.match(TT.TUPLET_COLON)) {
        // Skip the colon token
        if (ctx.match(TT.TUPLET_R)) {
          r = ctx.previous();
        }
      }
    }

    const tuplet = new Tuplet(ctx.abcContext.generateId(), p, q, r);
    prnt_arr && prnt_arr.push(tuplet);
    return tuplet;
  }

  return null;
}

// Parse a Y spacer
export function parseYSpacer(ctx: ParseCtx, prnt_arr?: Array<Expr | Token>): YSPACER | null {
  if (!ctx.match(TT.Y_SPC)) {
    return null;
  }

  const ySpacer = ctx.previous();

  // Parse optional rhythm
  const rhythm = parseRhythm(ctx);

  const yspacer = new YSPACER(ctx.abcContext.generateId(), ySpacer, rhythm);
  prnt_arr && prnt_arr.push(yspacer);
  return yspacer;
}

// Parse a symbol
export function parseSymbol(ctx: ParseCtx, prnt_arr?: Array<Expr | Token>): Symbol | null {
  if (!ctx.match(TT.SYMBOL)) {
    return null;
  }

  const symbol = new Symbol(ctx.abcContext.generateId(), ctx.previous());
  prnt_arr && prnt_arr.push(symbol);

  return symbol;
}

function parseInlineField(ctx: ParseCtx, prnt_arr?: Array<Expr | Token>): Inline_field | null {
  if (!ctx.match(TT.INLN_FLD_LFT_BRKT)) {
    return null;
  }

  const field = ctx.advance();
  const text: Array<Token> = [];
  while (!ctx.isAtEnd() && ctx.peek().type !== TT.INLN_FLD_RGT_BRKT) {
    text.push(ctx.advance());
  }
  ctx.advance();
  const result = new Inline_field(ctx.abcContext.generateId(), field, text);
  if (prnt_arr) prnt_arr.push(result);
  return result;
}

// Parse an annotation
export function parseAnnotation(ctx: ParseCtx, prnt_arr?: Array<Expr | Token>): Annotation | null {
  if (!ctx.match(TT.ANNOTATION)) {
    return null;
  }

  const annotation = new Annotation(ctx.abcContext.generateId(), ctx.previous());
  prnt_arr && prnt_arr.push(annotation);
  return annotation;
}

// Parse a decoration
export function parseDecoration(ctx: ParseCtx, prnt_arr?: Array<Expr | Token>): Decoration | null {
  if (!ctx.match(TT.DECORATION)) {
    return null;
  }

  const deco = new Decoration(ctx.abcContext.generateId(), ctx.previous());
  prnt_arr && prnt_arr.push(deco);
  return deco;
}

export class BeamCtx {
  tokens: Array<Expr | Token>;
  current: number = 0;
  abcContext: ABCContext;

  constructor(tokens: Array<Expr | Token>, abcContext: ABCContext) {
    this.tokens = tokens;
    this.abcContext = abcContext;
  }

  peek(): Token | Expr {
    return this.tokens[this.current];
  }

  previous(): Token | Expr {
    return this.tokens[this.current - 1];
  }

  advance(): Token | Expr {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  isAtEnd(): boolean {
    return this.current >= this.tokens.length;
  }

  report(message: string): void {
    this.abcContext.errorReporter.Scanner2Error(
      {
        source: "",
        tokens: [],
        start: 0,
        current: 0,
        line: 0,
        report: () => {},
        push: () => {},
        test: () => false,
        abcContext: this.abcContext,
      },
      message
    );
  }
}

export function prsBeam(ctx: BeamCtx, prnt_arr?: Array<Expr | Token>): Beam | Expr | Token | null {
  if (!foundBeam(ctx.tokens, ctx.current)) {
    return null;
  }

  let beam: Array<Expr | Token> = [];
  let expr = ctx.peek();
  while (!ctx.isAtEnd() && !isBeamBreaker(expr)) {
    beam.push(expr);
    ctx.advance();
    expr = ctx.peek();
  }
  if (beam.length === 1) {
    if (prnt_arr) prnt_arr.push(beam[0]);
    return beam[0];
  }
  if (beam.length > 1) {
    const beam_expr = new Beam(ctx.abcContext.generateId(), beam as Array<Beam_contents>);
    if (prnt_arr) prnt_arr.push(beam_expr);
    return beam_expr;
  }

  return null;
}

// Parse rhythm (common to notes, rests, etc.)
export function parseRhythm(ctx: ParseCtx): Rhythm | undefined {
  let numerator: Token | null = null;
  let separator: Token | undefined;
  let denominator: Token | null = null;
  let broken: Token | null = null;
  let hasRhythm = false;

  // Parse numerator
  if (ctx.match(TT.RHY_NUMER)) {
    numerator = ctx.previous();
    hasRhythm = true;
  }

  // Parse separator and denominator
  if (ctx.match(TT.RHY_SEP)) {
    separator = ctx.previous();
    hasRhythm = true;

    if (ctx.match(TT.RHY_DENOM)) {
      denominator = ctx.previous();
    }
  }

  // Parse broken rhythm
  if (ctx.match(TT.RHY_BRKN)) {
    broken = ctx.previous();
    hasRhythm = true;
  }

  return hasRhythm ? new Rhythm(ctx.abcContext.generateId(), numerator, separator, denominator, broken) : undefined;
}
export function prsSystems(musicElements: tune_body_code[], voices: string[] = []): System[] {
  return parseSystemsWithVoices(musicElements, voices);
}

// Parse macro declaration
export function prsMacroDecl(ctx: ParseCtx, prnt_arr?: Array<Expr | Token>): Macro_decl | null {
  if (!ctx.check(TT.MACRO_HDR)) {
    return null;
  }

  const header = ctx.advance();

  if (!ctx.check(TT.MACRO_VAR)) {
    ctx.report("Expected macro variable after macro header");
    return null;
  }

  const variable = ctx.advance();

  if (!ctx.check(TT.MACRO_STR)) {
    ctx.report("Expected macro content after macro variable");
    return null;
  }

  const content = ctx.advance();

  const macroDecl = new Macro_decl(ctx.abcContext.generateId(), header, variable, content);
  prnt_arr && prnt_arr.push(macroDecl);
  return macroDecl;
}

// Parse user symbol declaration
export function prsUserSymbolDecl(ctx: ParseCtx, prnt_arr?: Array<Expr | Token>): User_symbol_decl | null {
  if (!ctx.check(TT.USER_SY_HDR)) {
    return null;
  }

  const header = ctx.advance();

  if (!ctx.check(TT.USER_SY)) {
    ctx.report("Expected user symbol variable after user symbol header");
    return null;
  }

  const variable = ctx.advance();

  if (!ctx.check(TT.SYMBOL)) {
    ctx.report("Expected symbol content after user symbol variable");
    return null;
  }

  const symbol = ctx.advance();

  const userSymbolDecl = new User_symbol_decl(ctx.abcContext.generateId(), header, variable, symbol);
  prnt_arr && prnt_arr.push(userSymbolDecl);
  return userSymbolDecl;
}

// Parse lyric line
export function prsLyricLine(ctx: ParseCtx, prnt_arr?: Array<Expr | Token>): Lyric_line | null {
  if (!ctx.check(TT.LY_HDR) && !ctx.check(TT.LY_SECT_HDR)) {
    return null;
  }

  const header = ctx.advance();
  const contents: Token[] = [];

  // Collect all lyric tokens until end of line or non-lyric token
  while (!ctx.isAtEnd() && isLyricToken(ctx)) {
    contents.push(ctx.advance());
  }

  const lyricLine = new Lyric_line(ctx.abcContext.generateId(), header, contents);
  prnt_arr && prnt_arr.push(lyricLine);
  return lyricLine;
}

// Parse macro invocation
export function parseMacroInvocation(ctx: ParseCtx, prnt_arr?: Array<Expr | Token>): Macro_invocation | null {
  if (!ctx.check(TT.MACRO_INVOCATION)) {
    return null;
  }

  const variable = ctx.advance();

  const macroInvocation = new Macro_invocation(ctx.abcContext.generateId(), variable);
  prnt_arr && prnt_arr.push(macroInvocation);
  return macroInvocation;
}

// Parse user symbol invocation
export function parseUserSymbolInvocation(ctx: ParseCtx, prnt_arr?: Array<Expr | Token>): User_symbol_invocation | null {
  if (!ctx.check(TT.USER_SY_INVOCATION)) {
    return null;
  }

  const variable = ctx.advance();

  const userSymbolInvocation = new User_symbol_invocation(ctx.abcContext.generateId(), variable);
  prnt_arr && prnt_arr.push(userSymbolInvocation);
  return userSymbolInvocation;
}
