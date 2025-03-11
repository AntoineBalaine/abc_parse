import { Token, TT } from "./scan2";
import { ABCContext } from "./Context";
import {
  Annotation,
  BarLine,
  Beam,
  Beam_contents,
  Chord,
  Comment,
  Decoration,
  ErrorExpr,
  File_structure,
  Grace_group,
  Info_line,
  Inline_field,
  MultiMeasureRest,
  Music_code,
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
  music_code,
  tune_body_code,
} from "../types/Expr2";
import { foundBeam, beamEnd, isBeamContents } from "../helpers2";

// Parse Context
class ParseCtx {
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

// Main parser function
export function parseTune(tokens: Token[], abcContext: ABCContext): Tune {
  const ctx = new ParseCtx(tokens, abcContext);

  // Parse header information
  const tuneHeader = parseTuneHeader(ctx);

  // Parse body (music sections)
  const tuneBody = parseTuneBody(ctx);

  return new Tune(ctx.abcContext.generateId(), tuneHeader, tuneBody);
}

// Parse tune header (X:, T:, etc.)
function parseTuneHeader(ctx: ParseCtx): Tune_header {
  const infoLines: Array<Info_line | Comment> = [];
  const voices: string[] = [];

  while (!ctx.isAtEnd() && isHeaderToken(ctx.peek())) {
    if (ctx.match(TT.COMMENT)) {
      // Directly use the comment token without additional parsing
      infoLines.push(new Comment(ctx.abcContext.generateId(), ctx.previous()));
      continue;
    }

    if (ctx.match(TT.INF_HDR)) {
      const field = ctx.previous();
      const infoLine = parseInfoLine(ctx, field);
      infoLines.push(infoLine);

      // Check if this is a voice definition
      if (field.lexeme === "V:") {
        const voiceName = infoLine.value[0].lexeme.trim();
        if (voiceName && !voices.includes(voiceName)) {
          voices.push(voiceName);
        }
      }

      continue;
    }

    // Skip any other header tokens
    ctx.advance();
  }

  return new Tune_header(ctx.abcContext.generateId(), infoLines, voices);
}

// Parse an info line
function parseInfoLine(ctx: ParseCtx, field: Token): Info_line {
  const tokens: Token[] = [field];

  if (ctx.match(TT.INFO_STR) || ctx.match(TT.INF_TXT)) {
    tokens.push(ctx.previous());
  }

  // Skip to end of line
  while (!ctx.isAtEnd() && !ctx.check(TT.EOL)) {
    tokens.push(ctx.advance());
  }

  if (ctx.match(TT.EOL)) {
    tokens.push(ctx.previous());
  }

  return new Info_line(ctx.abcContext.generateId(), tokens);
}

// Check if a token is part of the tune header
function isHeaderToken(token: Token): boolean {
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
function processBeamsInMusicCode(musicCode: Music_code): Music_code {
  const contents = musicCode.contents;
  const processedContents: Array<music_code> = [];
  let beam: Array<Beam_contents> = [];
  let i = 0;

  while (i < contents.length) {
    // Check if this is the start of a beam
    if (foundBeam(contents, i)) {
      // Collect all elements in the beam
      while (i < contents.length && !beamEnd(contents, i)) {
        beam.push(contents[i] as Beam_contents);
        i++;
      }

      // Add the last element (which ends the beam)
      if (i < contents.length) {
        beam.push(contents[i] as Beam_contents);
        i++;
      }

      // Create a new Beam and add it to the processed contents
      processedContents.push(new Beam(musicCode.id, beam));
      beam = [];
    } else {
      // Not part of a beam, add directly to processed contents
      processedContents.push(contents[i]);
      i++;
    }
  }

  return new Music_code(musicCode.id, processedContents);
}

// Parse the tune body
function parseTuneBody(ctx: ParseCtx): Tune_Body {
  const musicElements: Array<tune_body_code> = [];

  // Parse until end of file or section break
  while (!ctx.isAtEnd() && !ctx.check(TT.SCT_BRK)) {
    // Skip whitespace and line breaks
    if (ctx.match(TT.WS) || ctx.match(TT.EOL)) {
      continue;
    }

    // Parse comments
    if (ctx.match(TT.COMMENT)) {
      // Directly use the comment token without additional parsing
      musicElements.push(new Comment(ctx.abcContext.generateId(), ctx.previous()));
      continue;
    }

    // Parse info lines
    if (ctx.match(TT.INF_HDR)) {
      musicElements.push(parseInfoLine(ctx, ctx.previous()));
      continue;
    }

    // Parse music code
    const musicCode = parseMusicCode(ctx);
    if (musicCode) {
      // Process beams within the music code before adding it
      const processedMusicCode = processBeamsInMusicCode(musicCode);
      musicElements.push(processedMusicCode);
      continue;
    }

    // If we couldn't parse any music element, skip the token
    if (!ctx.isAtEnd()) {
      ctx.report(`Unexpected token in tune body: ${ctx.peek().type}`);
      ctx.advance();
    }
  }

  // Skip the section break if present
  if (ctx.check(TT.SCT_BRK)) {
    ctx.advance();
  }

  // Create systems from the music elements
  // For simplicity, we'll put all elements in a single system for now
  const systems: Array<System> = [musicElements];

  return new Tune_Body(ctx.abcContext.generateId(), systems);
}

// Parse music code
function parseMusicCode(ctx: ParseCtx): Music_code | null {
  const elements: Array<music_code> = [];

  let startPos = ctx.current;

  while (!ctx.isAtEnd() && !ctx.check(TT.EOL) && !ctx.check(TT.COMMENT) && !ctx.check(TT.INF_HDR) && !ctx.check(TT.SCT_BRK)) {
    // Try each element parser in order
    const element =
      parseBarline(ctx) ||
      parseNote(ctx) ||
      parseRest(ctx) ||
      parseChord(ctx) ||
      parseGraceGroup(ctx) ||
      parseTuplet(ctx) ||
      parseYSpacer(ctx) ||
      parseSymbol(ctx) ||
      parseAnnotation(ctx) ||
      parseDecoration(ctx);

    if (element) {
      elements.push(element);
      continue;
    }

    // Skip whitespace
    if (ctx.match(TT.WS)) {
      elements.push(ctx.previous());
      continue;
    }

    // If we couldn't parse any element, skip the token
    if (!ctx.isAtEnd()) {
      ctx.report(`Unexpected token in music code: ${ctx.peek().type}`);
      elements.push(ctx.advance());
    }
  }

  // If we didn't parse any elements, return null
  if (ctx.current === startPos) {
    return null;
  }

  return new Music_code(ctx.abcContext.generateId(), elements);
}

// Parse a barline
function parseBarline(ctx: ParseCtx): BarLine | null {
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

  return new BarLine(ctx.abcContext.generateId(), barlineTokens, repeatNumbers);
}

// Parse repeat numbers
function parseRepeatNumbers(ctx: ParseCtx): Token[] {
  const numbers: Token[] = [];

  while (ctx.check(TT.REPEAT_NUMBER) || ctx.check(TT.REPEAT_COMMA) || ctx.check(TT.REPEAT_DASH) || ctx.check(TT.REPEAT_X)) {
    numbers.push(ctx.advance());
  }

  return numbers;
}

// Parse a note
function parseNote(ctx: ParseCtx): Note | null {
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

  return new Note(ctx.abcContext.generateId(), pitch, rhythm, tie);
}

// Parse a pitch
function parsePitch(ctx: ParseCtx): Pitch | null {
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
function parseRest(ctx: ParseCtx): Rest | null {
  if (!ctx.match(TT.REST)) {
    return null;
  }

  const rest = new Rest(ctx.abcContext.generateId(), ctx.previous());

  return rest;
}

// Parse a chord
function parseChord(ctx: ParseCtx): Chord | null {
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

  return new Chord(ctx.abcContext.generateId(), contents, rhythm, tie);
}

// Parse a grace note group
function parseGraceGroup(ctx: ParseCtx): Grace_group | null {
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

  return new Grace_group(ctx.abcContext.generateId(), notes, isAccacciatura);
}

// Parse a tuplet
function parseTuplet(ctx: ParseCtx): Tuplet | null {
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
  let q: Token[] | undefined;
  let r: Token[] | undefined;

  // For simplicity, we're not parsing the q and r parts separately
  // In a real implementation, you would create separate tokens for these

  return new Tuplet(ctx.abcContext.generateId(), p, q, r);
}

// Parse a Y spacer
function parseYSpacer(ctx: ParseCtx): YSPACER | null {
  if (!ctx.match(TT.Y_SPC)) {
    return null;
  }

  const ySpacer = ctx.previous();

  // Parse optional rhythm
  const rhythm = parseRhythm(ctx);

  return new YSPACER(ctx.abcContext.generateId(), ySpacer, rhythm);
}

// Parse a symbol
function parseSymbol(ctx: ParseCtx): Symbol | null {
  if (!ctx.match(TT.SYMBOL)) {
    return null;
  }

  return new Symbol(ctx.abcContext.generateId(), ctx.previous());
}

// Parse an annotation
function parseAnnotation(ctx: ParseCtx): Annotation | null {
  if (!ctx.match(TT.ANNOTATION)) {
    return null;
  }

  return new Annotation(ctx.abcContext.generateId(), ctx.previous());
}

// Parse a decoration
function parseDecoration(ctx: ParseCtx): Decoration | null {
  if (!ctx.match(TT.DECORATION)) {
    return null;
  }

  return new Decoration(ctx.abcContext.generateId(), ctx.previous());
}

// Parse rhythm (common to notes, rests, etc.)
function parseRhythm(ctx: ParseCtx): Rhythm | undefined {
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
