import {
  Token, TT, Expr, File_structure, Tune, Tune_header, Tune_Body,
  Info_line, Note, Pitch, Rhythm, Rest, Chord, Beam,
  Grace_group, BarLine, Decoration, Annotation, Inline_field,
  MultiMeasureRest, YSPACER, SystemBreak, Symbol, Tuplet,
  Music_code, Voice_overlay, Line_continuation, Comment,
  Directive, Measurement, Rational, File_header, Lyric_section,
  AbsolutePitch, Lyric_line, Macro_decl, Macro_invocation,
  User_symbol_decl, User_symbol_invocation, KV, Binary,
  Unary, Grouping, ChordSymbol, ErrorExpr,
  tune_body_code, Beam_contents, music_code
} from "abc-parser";
import { CSNode, TAGS, isTokenNode, getTokenData } from "./types";

function collectChildren(node: CSNode): CSNode[] {
  const result: CSNode[] = [];
  let child = node.firstChild;
  while (child !== null) {
    result.push(child);
    child = child.nextSibling;
  }
  return result;
}

export function toAst(node: CSNode): Expr | Token {
  if (isTokenNode(node)) {
    const data = getTokenData(node);
    const token = new Token(data.tokenType, data.lexeme, node.id);
    token.line = data.line;
    token.position = data.position;
    return token;
  }
  const children = collectChildren(node).map(toAst);
  return buildExpr(node, children);
}

function buildExpr(node: CSNode, children: Array<Expr | Token>): Expr {
  switch (node.tag) {
    case TAGS.Note: return buildNote(node.id, children);
    case TAGS.Chord: return buildChord(node.id, children);
    case TAGS.Pitch: return buildPitch(node.id, children);
    case TAGS.AbsolutePitch: return buildAbsolutePitch(node.id, children);
    case TAGS.Rest: return buildRest(node.id, children);
    case TAGS.BarLine: return buildBarLine(node.id, children);
    case TAGS.Tuplet: return buildTuplet(node.id, children);
    case TAGS.Grace_group: return buildGraceGroup(node, children);
    case TAGS.Inline_field: return buildInlineField(node.id, children);
    case TAGS.Directive: return buildDirective(node.id, children);
    case TAGS.Music_code: return buildMusicCode(node.id, children);
    case TAGS.Beam: return buildBeam(node.id, children);
    case TAGS.Tune_Body: return buildTuneBody(node.id, children);
    case TAGS.Decoration: return buildDecoration(node.id, children);
    case TAGS.Annotation: return buildAnnotation(node.id, children);
    case TAGS.Info_line: return buildInfoLine(node.id, children);
    case TAGS.Tune: return buildTune(node.id, children);
    case TAGS.Tune_header: return buildTuneHeader(node.id, children);
    case TAGS.File_structure: return buildFileStructure(node.id, children);
    case TAGS.File_header: return buildFileHeader(node.id, children);
    case TAGS.Rhythm: return buildRhythm(node.id, children);
    case TAGS.MultiMeasureRest: return buildMultiMeasureRest(node.id, children);
    case TAGS.YSPACER: return buildYSpacer(node.id, children);
    case TAGS.SystemBreak: return buildSystemBreak(node.id, children);
    case TAGS.Symbol: return buildSymbol(node.id, children);
    case TAGS.Voice_overlay: return buildVoiceOverlay(node.id, children);
    case TAGS.Line_continuation: return buildLineContinuation(node.id, children);
    case TAGS.Comment: return buildComment(node.id, children);
    case TAGS.Measurement: return buildMeasurement(node.id, children);
    case TAGS.Rational: return buildRational(node.id, children);
    case TAGS.Lyric_section: return buildLyricSection(node.id, children);
    case TAGS.Lyric_line: return buildLyricLine(node.id, children);
    case TAGS.Macro_decl: return buildMacroDecl(node.id, children);
    case TAGS.Macro_invocation: return buildMacroInvocation(node.id, children);
    case TAGS.User_symbol_decl: return buildUserSymbolDecl(node.id, children);
    case TAGS.User_symbol_invocation: return buildUserSymbolInvocation(node.id, children);
    case TAGS.KV: return buildKV(node.id, children);
    case TAGS.Binary: return buildBinary(node.id, children);
    case TAGS.Unary: return buildUnary(node.id, children);
    case TAGS.Grouping: return buildGrouping(node.id, children);
    case TAGS.ChordSymbol: return buildChordSymbol(node.id, children);
    case TAGS.ErrorExpr: return buildErrorExpr(node.id, children);
    default:
      throw new Error(`toAst: unrecognized tag "${node.tag}"`);
  }
}

// --- Single-child wrappers ---

function buildDecoration(id: number, children: Array<Expr | Token>): Decoration {
  return new Decoration(id, children[0] as Token);
}

function buildAnnotation(id: number, children: Array<Expr | Token>): Annotation {
  return new Annotation(id, children[0] as Token);
}

function buildComment(id: number, children: Array<Expr | Token>): Comment {
  return new Comment(id, children[0] as Token);
}

function buildSymbol(id: number, children: Array<Expr | Token>): Symbol {
  return new Symbol(id, children[0] as Token);
}

function buildSystemBreak(id: number, children: Array<Expr | Token>): SystemBreak {
  return new SystemBreak(id, children[0] as Token);
}

function buildLineContinuation(id: number, children: Array<Expr | Token>): Line_continuation {
  return new Line_continuation(id, children[0] as Token);
}

function buildChordSymbol(id: number, children: Array<Expr | Token>): ChordSymbol {
  return new ChordSymbol(id, children[0] as Token);
}

function buildMacroInvocation(id: number, children: Array<Expr | Token>): Macro_invocation {
  return new Macro_invocation(id, children[0] as Token);
}

function buildUserSymbolInvocation(id: number, children: Array<Expr | Token>): User_symbol_invocation {
  return new User_symbol_invocation(id, children[0] as Token);
}

// --- Array containers ---

function buildMusicCode(id: number, children: Array<Expr | Token>): Music_code {
  return new Music_code(id, children as music_code[]);
}

function buildBeam(id: number, children: Array<Expr | Token>): Beam {
  return new Beam(id, children as Beam_contents[]);
}

function buildTuneHeader(id: number, children: Array<Expr | Token>): Tune_header {
  return new Tune_header(id, children as Array<Info_line | Comment | Macro_decl | User_symbol_decl | Directive>);
}

function buildFileHeader(id: number, children: Array<Expr | Token>): File_header {
  return new File_header(id, children as Array<Token | Expr>);
}

function buildVoiceOverlay(id: number, children: Array<Expr | Token>): Voice_overlay {
  return new Voice_overlay(id, children as Token[]);
}

function buildErrorExpr(id: number, children: Array<Expr | Token>): ErrorExpr {
  return new ErrorExpr(id, children as Token[]);
}

// --- Token-type discrimination builders ---

function buildPitch(id: number, children: Array<Expr | Token>): Pitch {
  let alteration: Token | undefined;
  let noteLetter: Token | undefined;
  let octave: Token | undefined;
  for (const child of children) {
    const token = child as Token;
    switch (token.type) {
      case TT.NOTE_LETTER: noteLetter = token; break;
      case TT.ACCIDENTAL: alteration = token; break;
      case TT.OCTAVE: octave = token; break;
    }
  }
  return new Pitch(id, { alteration, noteLetter: noteLetter!, octave });
}

function buildAbsolutePitch(id: number, children: Array<Expr | Token>): AbsolutePitch {
  let alteration: Token | undefined;
  let noteLetter: Token | undefined;
  let octave: Token | undefined;
  for (const child of children) {
    const token = child as Token;
    switch (token.type) {
      case TT.NOTE_LETTER: noteLetter = token; break;
      case TT.ACCIDENTAL: alteration = token; break;
      case TT.OCTAVE: octave = token; break;
    }
  }
  return new AbsolutePitch(id, noteLetter!, alteration, octave);
}

function buildRhythm(id: number, children: Array<Expr | Token>): Rhythm {
  let numerator: Token | null = null;
  let separator: Token | undefined;
  let denominator: Token | null = null;
  let broken: Token | null = null;
  for (const child of children) {
    const token = child as Token;
    switch (token.type) {
      case TT.RHY_NUMER: numerator = token; break;
      case TT.RHY_SEP: separator = token; break;
      case TT.RHY_DENOM: denominator = token; break;
      case TT.RHY_BRKN: broken = token; break;
    }
  }
  return new Rhythm(id, numerator, separator, denominator, broken);
}

function buildBarLine(id: number, children: Array<Expr | Token>): BarLine {
  const barline: Token[] = [];
  const repeatNumbers: Token[] = [];
  for (const child of children) {
    const token = child as Token;
    if (token.type === TT.REPEAT_NUMBER || token.type === TT.REPEAT_COMMA ||
        token.type === TT.REPEAT_DASH || token.type === TT.REPEAT_X) {
      repeatNumbers.push(token);
    } else {
      barline.push(token);
    }
  }
  return new BarLine(id, barline, repeatNumbers.length > 0 ? repeatNumbers : undefined);
}

function buildTuplet(id: number, children: Array<Expr | Token>): Tuplet {
  let leftParen: Token | undefined;
  let firstColon: Token | undefined;
  let secondColon: Token | undefined;
  let p: Token | undefined;
  let q: Token | undefined;
  let r: Token | undefined;
  let colonCount = 0;
  for (const child of children) {
    const token = child as Token;
    switch (token.type) {
      case TT.TUPLET_LPAREN: leftParen = token; break;
      case TT.TUPLET_COLON:
        if (colonCount === 0) { firstColon = token; colonCount++; }
        else { secondColon = token; }
        break;
      case TT.TUPLET_P: p = token; break;
      case TT.TUPLET_Q: q = token; break;
      case TT.TUPLET_R: r = token; break;
    }
  }
  return new Tuplet(id, p!, q, r, leftParen, firstColon, secondColon);
}

// --- Optional trailing fields ---

function buildNote(id: number, children: Array<Expr | Token>): Note {
  const pitch = children[0] as Pitch;
  let rhythm: Rhythm | undefined;
  let tie: Token | undefined;
  for (let i = 1; i < children.length; i++) {
    if (children[i] instanceof Rhythm) rhythm = children[i] as Rhythm;
    else if (children[i] instanceof Token) tie = children[i] as Token;
  }
  return new Note(id, pitch, rhythm, tie);
}

function buildChord(id: number, children: Array<Expr | Token>): Chord {
  let leftBracket: Token | undefined;
  let rightBracket: Token | undefined;
  const contents: Array<Note | Token | Annotation> = [];
  let rhythm: Rhythm | undefined;
  let tie: Token | undefined;
  for (const child of children) {
    if (child instanceof Token && child.type === TT.CHRD_LEFT_BRKT) {
      leftBracket = child;
    } else if (child instanceof Token && child.type === TT.CHRD_RIGHT_BRKT) {
      rightBracket = child;
    } else if (child instanceof Rhythm) {
      rhythm = child;
    } else if (child instanceof Token && child.type === TT.TIE) {
      tie = child;
    } else {
      contents.push(child as Note | Token | Annotation);
    }
  }
  return new Chord(id, contents, rhythm, tie, leftBracket, rightBracket);
}

function buildRest(id: number, children: Array<Expr | Token>): Rest {
  const rest = children[0] as Token;
  const rhythm = children.length > 1 ? children[1] as Rhythm : undefined;
  return new Rest(id, rest, rhythm);
}

function buildMultiMeasureRest(id: number, children: Array<Expr | Token>): MultiMeasureRest {
  const rest = children[0] as Token;
  const length = children.length > 1 ? children[1] as Token : undefined;
  return new MultiMeasureRest(id, rest, length);
}

function buildYSpacer(id: number, children: Array<Expr | Token>): YSPACER {
  const ySpacer = children[0] as Token;
  const rhythm = children.length > 1 ? children[1] as Rhythm : undefined;
  return new YSPACER(id, ySpacer, rhythm);
}

// --- Data payload builder ---

function buildGraceGroup(node: CSNode, children: Array<Expr | Token>): Grace_group {
  let leftBrace: Token | undefined;
  let rightBrace: Token | undefined;
  let acciaccaturaSlash: Token | undefined;
  const notes: Array<Note | Token> = [];
  for (const child of children) {
    if (child instanceof Token && child.type === TT.GRC_GRP_LEFT_BRACE) {
      leftBrace = child;
    } else if (child instanceof Token && child.type === TT.GRC_GRP_RGHT_BRACE) {
      rightBrace = child;
    } else if (child instanceof Token && child.type === TT.GRC_GRP_SLSH) {
      acciaccaturaSlash = child;
    } else {
      notes.push(child as Note | Token);
    }
  }
  const isAccacciatura = acciaccaturaSlash !== undefined;
  return new Grace_group(node.id, notes, isAccacciatura, leftBrace, rightBrace, acciaccaturaSlash);
}

// --- Text-based builders ---

// The Inline_field class invariant requires text[0] === field.
// The parser establishes this (parseInlineField pushes field as tokens[0]),
// and the Formatter2 relies on it (text.slice(1) skips the field token).
function buildInlineField(id: number, children: Array<Expr | Token>): Inline_field {
  let leftBracket: Token | undefined;
  let rightBracket: Token | undefined;
  const text: Token[] = [];
  for (const child of children) {
    const token = child as Token;
    if (token.type === TT.INLN_FLD_LFT_BRKT) {
      leftBracket = token;
    } else if (token.type === TT.INLN_FLD_RGT_BRKT) {
      rightBracket = token;
    } else {
      text.push(token);
    }
  }
  const field = text[0];
  return new Inline_field(id, field, text, undefined, leftBracket, rightBracket);
}

function buildInfoLine(id: number, children: Array<Expr | Token>): Info_line {
  return new Info_line(id, children as Token[]);
}

// --- Passthrough builders ---

function buildDirective(id: number, children: Array<Expr | Token>): Directive {
  const key = children[0] as Token;
  const values = children.slice(1);
  return new Directive(id, key, values as Array<Token | Rational | Pitch | KV | Measurement | Annotation>);
}

function buildMeasurement(id: number, children: Array<Expr | Token>): Measurement {
  return new Measurement(id, children[0] as Token, children[1] as Token);
}

function buildRational(id: number, children: Array<Expr | Token>): Rational {
  return new Rational(id, children[0] as Token, children[1] as Token, children[2] as Token);
}

function buildLyricSection(id: number, children: Array<Expr | Token>): Lyric_section {
  return new Lyric_section(id, children as Info_line[]);
}

function buildLyricLine(id: number, children: Array<Expr | Token>): Lyric_line {
  const header = children[0] as Token;
  const contents = children.slice(1) as Token[];
  return new Lyric_line(id, header, contents);
}

function buildMacroDecl(id: number, children: Array<Expr | Token>): Macro_decl {
  const header = children[0] as Token;
  const variable = children[1] as Token;
  let equals: Token | undefined;
  let content: Token;
  if (children.length === 4) {
    equals = children[2] as Token;
    content = children[3] as Token;
  } else {
    content = children[2] as Token;
  }
  return new Macro_decl(id, header, variable, content, equals);
}

function buildUserSymbolDecl(id: number, children: Array<Expr | Token>): User_symbol_decl {
  const header = children[0] as Token;
  const variable = children[1] as Token;
  let equals: Token | undefined;
  let symbol: Token;
  if (children.length === 4) {
    equals = children[2] as Token;
    symbol = children[3] as Token;
  } else {
    symbol = children[2] as Token;
  }
  return new User_symbol_decl(id, header, variable, symbol, equals);
}

function buildKV(id: number, children: Array<Expr | Token>): KV {
  // Children order from visitor: [key?, equals?, value]
  // value is always the last child
  const value = children[children.length - 1] as Token | Expr;
  let key: Token | AbsolutePitch | undefined;
  let equals: Token | undefined;
  if (children.length === 3) {
    key = children[0] as Token | AbsolutePitch;
    equals = children[1] as Token;
  } else if (children.length === 2) {
    key = children[0] as Token | AbsolutePitch;
  }
  return new KV(id, value, key, equals);
}

function buildBinary(id: number, children: Array<Expr | Token>): Binary {
  return new Binary(id, children[0], children[1] as Token, children[2]);
}

function buildUnary(id: number, children: Array<Expr | Token>): Unary {
  return new Unary(id, children[0] as Token, children[1]);
}

function buildGrouping(id: number, children: Array<Expr | Token>): Grouping {
  let leftParen: Token | undefined;
  let rightParen: Token | undefined;
  let expression: Expr | undefined;
  for (const child of children) {
    if (child instanceof Token && child.type === TT.LPAREN) {
      leftParen = child;
    } else if (child instanceof Token && child.type === TT.RPAREN) {
      rightParen = child;
    } else {
      expression = child as Expr;
    }
  }
  return new Grouping(id, expression!, leftParen, rightParen);
}

// --- Structural builders ---

// Because fromAst flattens expr.sequence (Array<System>) into a single child list,
// the reconstructed AST places all children into one system. The formatter handles
// line breaks via EOL tokens within the content, so the output is unchanged.
function buildTuneBody(id: number, children: Array<Expr | Token>): Tune_Body {
  return new Tune_Body(id, [children as tune_body_code[]]);
}

function buildTune(id: number, children: Array<Expr | Token>): Tune {
  const header = children[0] as Tune_header;
  const body = children.length > 1 ? children[1] as Tune_Body : undefined;
  return new Tune(id, header, body ?? null);
}

function buildFileStructure(id: number, children: Array<Expr | Token>): File_structure {
  let fileHeader: File_header | null = null;
  let contentsStart = 0;
  if (children.length > 0 && children[0] instanceof File_header) {
    fileHeader = children[0] as File_header;
    contentsStart = 1;
  }
  const contents = children.slice(contentsStart) as Array<Tune | Token>;
  return new File_structure(id, fileHeader, contents);
}
