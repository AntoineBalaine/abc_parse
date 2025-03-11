import { Token, TT } from "./scan2";
import { ABCContext } from "./Context";
import {
  Annotation,
  BarLine,
  Beam,
  Chord,
  Comment,
  Decoration,
  Expr,
  Grace_group,
  Info_line,
  Note,
  Pitch,
  Rest,
  Rhythm,
  Symbol,
  System,
  Tune,
  Tune_Body,
  Tune_header,
  Tuplet,
  YSPACER,
  tune_body_code,
  Beam_contents,
} from "../types/Expr2";
import { isBeamBreaker, foundBeam } from "../helpers2";

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
    return this.current >= this.tokens.length || this.tokens[this.current].type == TT.EOF;
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
      },
      message
    );
  }
}

// Main parser export function
export function parseTune(tokens: Token[], abcContext: ABCContext): Tune {
  const ctx = new ParseCtx(tokens, abcContext);

  // Parse header information
  const tuneHeader = prsTuneHdr(ctx);
  // Parse body (music sections)
  const tuneBody = prsBody(ctx);

  return new Tune(ctx.abcContext.generateId(), tuneHeader, tuneBody);
}

export function prsTuneHdr(ctx: ParseCtx): Tune_header {
  const infoLines: Array<Info_line | Comment> = [];
  const voices: string[] = [];
  while (!ctx.isAtEnd() && !ctx.check(TT.SCT_BRK)) {
    const cmnt = prsComment(ctx);
    if (cmnt) {
      infoLines.push(cmnt);
      continue;
    }
    const info_line = prsInfoLine(ctx);
    if (info_line) {
      infoLines.push(info_line);
      if (info_line.key.lexeme === "V:") {
        const voiceName = info_line.value[0].lexeme.trim();
        if (voiceName && !voices.includes(voiceName)) {
          voices.push(voiceName);
        }
      }
    }
  }
  return new Tune_header(ctx.abcContext.generateId(), infoLines, voices);
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
  if (ctx.match(TT.INF_HDR)) {
    const field = ctx.previous();
    const tokens: Token[] = [field];
    if (ctx.match(TT.INFO_STR) || ctx.match(TT.INF_TXT)) {
      // is it really needed?
      tokens.push(ctx.previous());
    }
    while (!ctx.isAtEnd() && !ctx.check(TT.EOL)) {
      tokens.push(ctx.advance());
    }
    const rv = new Info_line(ctx.abcContext.generateId(), tokens);
    prnt_arr && prnt_arr.push(rv);
    return rv;
  }
  return null;
}

// Check if a token is part of the tune header
export function isHeaderToken(token: Token): boolean {
  return (
    token.type === TT.INF_HDR ||
    token.type === TT.INF_TXT ||
    token.type === TT.INFO_STR ||
    token.type === TT.COMMENT ||
    token.type === TT.EOL ||
    token.type === TT.WS
  );
}

// Process beams within a Music_code instance

export function prsBody(ctx: ParseCtx): Tune_Body | null {
  const elmnts: Array<tune_body_code> = [];

  // Parse until end of file or section break
  while (!ctx.isAtEnd() && !ctx.check(TT.SCT_BRK)) {
    if (prsComment(ctx, elmnts)) continue;
    if (prsInfoLine(ctx, elmnts)) continue;
    if (parseMusicCode(ctx, elmnts)) continue;

    elmnts.push(ctx.advance());
  }

  // Process beams in the elements array
  const processedElements = prcssBms(elmnts, ctx.abcContext);

  return new Tune_Body(ctx.abcContext.generateId(), prsSystems(processedElements as tune_body_code[]));
}

export function prcssBms(elmnts: Array<Expr | Token>, abcContext: ABCContext): Array<Expr | Token> {
  let rv: Array<Expr | Token> = [];
  const beamCtx = new BeamCtx(elmnts, abcContext);
  while (!beamCtx.isAtEnd()) {
    const cur = beamCtx.peek();
    if (prsBeam(beamCtx, rv)) continue;
    rv.push(cur);
  }
  return rv;
}

// Parse music code
export function parseMusicCode(ctx: ParseCtx, prnt_arr?: Array<Expr | Token>): Array<Expr | Token> | null {
  const elements: Array<Expr | Token> = prnt_arr ?? [];

  while (!ctx.isAtEnd() && !ctx.check(TT.EOL) && !ctx.check(TT.COMMENT) && !ctx.check(TT.INF_HDR) && !ctx.check(TT.SCT_BRK)) {
    // Try each element parser in order
    const element =
      parseBarline(ctx, elements) ||
      parseChord(ctx, elements) ||
      parseGraceGroup(ctx, elements) ||
      parseRest(ctx, elements) ||
      parseNote(ctx, elements) ||
      parseTuplet(ctx, elements) ||
      parseYSpacer(ctx, elements) ||
      parseSymbol(ctx, elements) ||
      parseAnnotation(ctx, elements) ||
      parseDecoration(ctx, elements);
    if (element) continue;

    // If we couldn't parse any element, skip the token
    if (!ctx.isAtEnd()) {
      ctx.report(`Unexpected token in music code: ${ctx.peek().type}`);
    }
  }

  return elements;
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
export function parseRest(ctx: ParseCtx, prnt_arr?: Array<Expr | Token>): Rest | null {
  if (!ctx.match(TT.REST)) {
    return null;
  }

  const rest = new Rest(ctx.abcContext.generateId(), ctx.previous());
  prnt_arr && prnt_arr.push(rest);
  return rest;
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
  if (!ctx.match(TT.TUPLET)) {
    return null;
  }

  // Extract p:q:r values from the token
  const tupletValue = ctx.previous().lexeme;
  const match = /\((\d+)(?::(\d+))?(?::(\d+))?/.exec(tupletValue);

  if (!match) {
    ctx.report("Invalid tuplet format");
    return null;
  }

  const p = ctx.previous(); // The entire tuplet token
  // FIXME: q and r are not getting parsed
  let q: Token[] | undefined;
  let r: Token[] | undefined;

  const tuplet = new Tuplet(ctx.abcContext.generateId(), p, q, r);
  prnt_arr && prnt_arr.push(tuplet);

  return tuplet;
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
  const expr = ctx.peek();
  while (!ctx.isAtEnd() && !isBeamBreaker(expr)) {
    beam.push(expr);
    ctx.advance();
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
export function prsSystems(musicElements: tune_body_code[]): System[] {
  throw new Error("export function not implemented.");
}
