import { ABCContext } from "../parsers/Context";
import { Token, TT } from "../parsers/scan2";
import { Meter, TempoProperties, ClefProperties, KeyInfo, VoiceProperties } from "./abcjs-ast";
import { IRational } from "../Visitors/fmt2/rational";

/**
 * Visitor is the interface that enables walking the parser's syntax tree.
 * Each method of the Visitor allows for traversing one of the expressions of the syntax tree.
 */
export interface Visitor<R> {
  visitToken(token: Token): R;
  visitAnnotationExpr(expr: Annotation): R;
  visitBarLineExpr(expr: BarLine): R;
  visitChordExpr(expr: Chord): R;
  visitCommentExpr(expr: Comment): R;
  visitDirectiveExpr(expr: Directive): R;
  visitDecorationExpr(expr: Decoration): R;
  visitFileHeaderExpr(expr: File_header): R;
  visitFileStructureExpr(expr: File_structure): R;
  visitGraceGroupExpr(expr: Grace_group): R;
  visitInfoLineExpr(expr: Info_line): R;
  visitInlineFieldExpr(expr: Inline_field): R;
  visitLyricLineExpr(expr: Lyric_line): R;
  visitLyricSectionExpr(expr: Lyric_section): R;
  visitMacroDeclExpr(expr: Macro_decl): R;
  visitMacroInvocationExpr(expr: Macro_invocation): R;
  visitMultiMeasureRestExpr(expr: MultiMeasureRest): R;
  visitMusicCodeExpr(expr: Music_code): R;
  visitNoteExpr(expr: Note): R;
  visitPitchExpr(expr: Pitch): R;
  visitRestExpr(expr: Rest): R;
  visitRhythmExpr(expr: Rhythm): R;
  visitSymbolExpr(expr: Symbol): R;
  visitTuneBodyExpr(expr: Tune_Body): R;
  visitTuneExpr(expr: Tune): R;
  visitTuneHeaderExpr(expr: Tune_header): R;
  visitUserSymbolDeclExpr(expr: User_symbol_decl): R;
  visitUserSymbolInvocationExpr(expr: User_symbol_invocation): R;
  visitYSpacerExpr(expr: YSPACER): R;
  visitBeamExpr(expr: Beam): R;
  visitVoiceOverlayExpr(expr: Voice_overlay): R;
  visitTupletExpr(expr: Tuplet): R;
  visitErrorExpr(expr: ErrorExpr): R;
  // New expression visitor methods for unified info line parsing
  visitKV(expr: KV): R;
  visitBinary(expr: Binary): R;
  visitUnary(expr: Unary): R;
  visitGrouping(expr: Grouping): R;
  visitAbsolutePitch(expr: AbsolutePitch): R;
  visitRationalExpr(expr: Rational): R;
  visitMeasurementExpr(expr: Measurement): R;
}

// Tagged union for parsed info line data
export type InfoLineUnion =
  | { type: "key"; data: KeyInfo }
  | { type: "meter"; data: Meter }
  | { type: "voice"; data: { id: string; properties: VoiceProperties } }
  | { type: "tempo"; data: TempoProperties }
  | { type: "title"; data: string }
  | { type: "composer"; data: string }
  | { type: "origin"; data: string }
  | { type: "note_length"; data: IRational }
  | { type: "clef"; data: ClefProperties }
  | { type: "directive"; data: { directive: string; args?: string } }
  | { type: "reference_number"; data: number }
  | { type: "rhythm"; data: string }
  | { type: "book"; data: string }
  | { type: "source"; data: string }
  | { type: "discography"; data: string }
  | { type: "notes"; data: string }
  | { type: "transcription"; data: string }
  | { type: "history"; data: string }
  | { type: "author"; data: string };

// Type predicate functions for InfoLineUnion
export function isKeyInfo(info: InfoLineUnion): info is { type: "key"; data: KeyInfo } {
  return info.type === "key";
}

export function isMeterInfo(info: InfoLineUnion): info is { type: "meter"; data: Meter } {
  return info.type === "meter";
}

export function isVoiceInfo(info: InfoLineUnion): info is { type: "voice"; data: { id: string; properties: any } } {
  return info.type === "voice";
}

export function isTempoInfo(info: InfoLineUnion): info is { type: "tempo"; data: TempoProperties } {
  return info.type === "tempo";
}

export function isNoteLengthInfo(info: InfoLineUnion): info is { type: "note_length"; data: IRational } {
  return info.type === "note_length";
}

export function isTitleInfo(info: InfoLineUnion): info is { type: "title"; data: string } {
  return info.type === "title";
}

export function isComposerInfo(info: InfoLineUnion): info is { type: "composer"; data: string } {
  return info.type === "composer";
}

export function isOriginInfo(info: InfoLineUnion): info is { type: "origin"; data: string } {
  return info.type === "origin";
}

export function isClefInfo(info: InfoLineUnion): info is { type: "clef"; data: ClefProperties } {
  return info.type === "clef";
}

export function isDirectiveInfo(info: InfoLineUnion): info is { type: "directive"; data: { directive: string; args?: string } } {
  return info.type === "directive";
}

export function isReferenceNumberInfo(info: InfoLineUnion): info is { type: "reference_number"; data: number } {
  return info.type === "reference_number";
}

export function isRhythmInfo(info: InfoLineUnion): info is { type: "rhythm"; data: string } {
  return info.type === "rhythm";
}

export function isBookInfo(info: InfoLineUnion): info is { type: "book"; data: string } {
  return info.type === "book";
}

export function isSourceInfo(info: InfoLineUnion): info is { type: "source"; data: string } {
  return info.type === "source";
}

export function isDiscographyInfo(info: InfoLineUnion): info is { type: "discography"; data: string } {
  return info.type === "discography";
}

export function isNotesInfo(info: InfoLineUnion): info is { type: "notes"; data: string } {
  return info.type === "notes";
}

export function isTranscriptionInfo(info: InfoLineUnion): info is { type: "transcription"; data: string } {
  return info.type === "transcription";
}

export function isHistoryInfo(info: InfoLineUnion): info is { type: "history"; data: string } {
  return info.type === "history";
}

export function isAuthorInfo(info: InfoLineUnion): info is { type: "author"; data: string } {
  return info.type === "author";
}

export abstract class Expr {
  public id: number;

  constructor(id: number) {
    this.id = id;
  }
  abstract accept<R>(visitor: Visitor<R>): R;
}

export class File_structure extends Expr {
  file_header: File_header | null;
  contents: Array<Tune | Token>;
  constructor(id: number, file_header: File_header | null, tune: Array<Tune | Token>) {
    super(id);
    this.file_header = file_header;
    this.contents = tune;
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitFileStructureExpr(this);
  }
}

export class Pitch extends Expr {
  alteration?: Token;
  noteLetter: Token;
  octave?: Token;
  constructor(id: number, { alteration, noteLetter, octave }: { alteration?: Token; noteLetter: Token; octave?: Token }) {
    super(id);
    this.alteration = alteration;
    this.noteLetter = noteLetter;
    this.octave = octave;
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitPitchExpr(this);
  }
}

export class AbsolutePitch extends Expr {
  noteLetter: Token;
  alteration?: Token;
  octave?: Token; // Numeric octave (different from Pitch which uses ' and ,)
  constructor(id: number, noteLetter: Token, alteration?: Token, octave?: Token) {
    super(id);
    this.noteLetter = noteLetter;
    this.alteration = alteration;
    this.octave = octave;
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitAbsolutePitch(this);
  }
}

export class File_header extends Expr {
  contents: Array<Token | Expr>;
  constructor(id: number, tokens: Array<Token | Expr>) {
    super(id);
    this.contents = tokens;
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitFileHeaderExpr(this);
  }
}

export class Info_line extends Expr {
  key: Token;
  value: Array<Token>;
  parsed?: InfoLineUnion;

  // New unified approach (experimental)
  value2?: Array<Expr>; // New sub-expressions property

  constructor(id: number, tokens: Array<Token>, parsed?: InfoLineUnion, value2?: Array<Expr>) {
    super(id);

    this.key = tokens[0];
    const remainingTokens = tokens.slice(1);

    if (!remainingTokens.length) {
      this.value = [];
    } else {
      this.value = remainingTokens;
    }

    this.parsed = parsed;
    this.value2 = value2;
  }

  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitInfoLineExpr(this);
  }
}

export class SymbolLine extends Expr {
  key: Token;
  value: Array<Token>;

  constructor(id: number, tokens: Array<Token>) {
    super(id);

    this.key = tokens[0];
    const remainingTokens = tokens.slice(1);

    if (!remainingTokens.length) {
      this.value = [];
      return;
    }
    this.value = remainingTokens;
  }

  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitInfoLineExpr(this);
  }
}

export class Lyric_section extends Expr {
  info_lines: Array<Info_line>;
  constructor(id: number, info_lines: Array<Info_line>) {
    super(id);
    this.info_lines = info_lines;
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitLyricSectionExpr(this);
  }
}

export class Tune_header extends Expr {
  info_lines: Array<Info_line | Comment | Macro_decl | User_symbol_decl | Directive>;
  voices: Array<string>;
  constructor(id: number, info_lines: Array<Info_line | Comment | Macro_decl | User_symbol_decl | Directive>, voices?: Array<string>) {
    super(id);
    this.info_lines = info_lines;
    this.voices = voices || [];
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitTuneHeaderExpr(this);
  }
}

export class Directive extends Expr {
  key: Token;
  values: Array<Token | Rational | Pitch | KV | Measurement | Annotation>;

  constructor(id: number, key: Token, values: Array<Token | Rational | Pitch | KV | Measurement | Annotation>) {
    super(id);
    this.key = key;
    this.values = values;
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitDirectiveExpr(this);
  }
}
export class Measurement extends Expr {
  value: Token; // number token
  scale: Token; // in, cm, etc.
  // methods & constructor here

  constructor(id: number, value: Token, scale: Token) {
    super(id);
    this.value = value;
    this.scale = scale;
  }

  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitMeasurementExpr(this);
  }
}

export class Rational extends Expr {
  numerator: Token;
  separator: Token;
  denominator: Token;

  constructor(id: number, numerator: Token, separator: Token, denominator: Token) {
    super(id);
    this.numerator = numerator;
    this.separator = separator;
    this.denominator = denominator;
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitRationalExpr(this);
  }
}

export class Comment extends Expr {
  token: Token;
  constructor(id: number, token: Token) {
    super(id);
    this.token = token;
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitCommentExpr(this);
  }
}

export type tune_body_code = Comment | Info_line | Lyric_line | music_code | ErrorExpr;
export type System = Array<tune_body_code>;

export class Tune extends Expr {
  tune_header: Tune_header;
  tune_body?: Tune_Body;
  constructor(id: number, tune_header: Tune_header, tune_body: Tune_Body | null) {
    super(id);
    this.tune_header = tune_header;
    this.tune_body = tune_body || undefined;
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitTuneExpr(this);
  }
}

export class Rhythm extends Expr {
  numerator?: Token | null;
  separator?: Token;
  denominator?: Token | null;
  broken?: Token | null;
  constructor(id: number, numerator: Token | null, separator?: Token, denominator?: Token | null, broken?: Token | null) {
    super(id);
    this.numerator = numerator;
    this.separator = separator;
    this.denominator = denominator;
    this.broken = broken;
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitRhythmExpr(this);
  }
}

export class Voice_overlay extends Expr {
  contents: Array<Token>;
  constructor(id: number, contents: Array<Token>) {
    super(id);
    this.contents = contents;
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitVoiceOverlayExpr(this);
  }
}

/**
 * syntax `(p:q:r` which means 'put p notes into the time of q for the next r notes'.
 * If q is not given, it defaults as above. If r is not given, it defaults to p.
 */
export class Tuplet extends Expr {
  p: Token;
  q?: Token;
  r?: Token;
  constructor(id: number, p: Token, q?: Token, r?: Token) {
    super(id);
    this.p = p;
    this.q = q;
    this.r = r;
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitTupletExpr(this);
  }
}

export class Rest extends Expr {
  rest: Token;
  rhythm?: Rhythm;
  constructor(id: number, rest: Token, rhythm?: Rhythm) {
    super(id);
    this.rest = rest;
    this.rhythm = rhythm;
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitRestExpr(this);
  }
}

export class Note extends Expr {
  pitch: Pitch;
  rhythm?: Rhythm;
  tie?: Token;
  constructor(id: number, pitch: Pitch, rhythm?: Rhythm, tie?: Token) {
    super(id);
    this.pitch = pitch;
    this.rhythm = rhythm;
    this.tie = tie;
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitNoteExpr(this);
  }
}

export class MultiMeasureRest extends Expr {
  rest: Token;
  length?: Token;
  constructor(id: number, rest: Token, length?: Token) {
    super(id);
    this.rest = rest;
    this.length = length;
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitMultiMeasureRestExpr(this);
  }
}

export class Symbol extends Expr {
  symbol: Token;
  constructor(id: number, symbol: Token) {
    super(id);
    this.symbol = symbol;
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitSymbolExpr(this);
  }
}

export class Grace_group extends Expr {
  notes: Array<Note | Token>;
  isAccacciatura?: boolean;
  constructor(id: number, notes: Array<Note | Token>, isAccacciatura?: boolean) {
    super(id);
    this.notes = notes;
    this.isAccacciatura = isAccacciatura;
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitGraceGroupExpr(this);
  }
}

export class Inline_field extends Expr {
  field: Token;
  text: Array<Token>;
  constructor(id: number, field: Token, text: Array<Token>) {
    super(id);
    this.field = field;
    this.text = text;
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitInlineFieldExpr(this);
  }
}

export class Chord extends Expr {
  contents: Array<Note | Token | Annotation>;
  rhythm?: Rhythm;
  tie?: Token;
  constructor(id: number, contents: Array<Note | Token | Annotation>, rhythm?: Rhythm, tie?: Token) {
    super(id);
    this.contents = contents;
    this.rhythm = rhythm;
    this.tie = tie;
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitChordExpr(this);
  }
}

export class Tune_Body extends Expr {
  sequence: Array<System>;
  constructor(id: number, sequence: Array<System>) {
    super(id);
    this.sequence = sequence;
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitTuneBodyExpr(this);
  }
}

export class Annotation extends Expr {
  text: Token;
  constructor(id: number, text: Token) {
    super(id);
    this.text = text;
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitAnnotationExpr(this);
  }
}

export class BarLine extends Expr {
  barline: Array<Token>;
  repeatNumbers?: Token[]; // Optional repeat numbers

  constructor(id: number, barline: Array<Token>, repeatNumbers?: Array<Token>) {
    super(id);
    this.barline = barline;
    this.repeatNumbers = repeatNumbers;
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitBarLineExpr(this);
  }
}

export type music_code =
  | Token
  | YSPACER
  | BarLine
  | Annotation
  | Decoration
  | Note
  | Grace_group
  | Inline_field
  | Chord
  | Symbol
  | MultiMeasureRest
  | Beam
  | Tuplet
  | Macro_invocation
  | User_symbol_invocation
  | ErrorExpr;

export class Music_code extends Expr {
  contents: Array<music_code>;
  constructor(id: number, contents: Array<music_code>) {
    super(id);
    this.contents = contents;
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitMusicCodeExpr(this);
  }
}

export type Beam_contents =
  | Token
  | YSPACER
  | Annotation
  | Decoration
  | Note
  | Grace_group
  | Chord
  | Symbol
  | BarLine
  | Tuplet
  | MultiMeasureRest
  | Inline_field
  | ErrorExpr;

export class Beam extends Expr {
  contents: Array<Beam_contents>;
  constructor(id: number, contents: Array<Beam_contents>) {
    super(id);
    this.contents = contents;
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitBeamExpr(this);
  }
}

export class Decoration extends Expr {
  decoration: Token;
  constructor(id: number, decoration: Token) {
    super(id);
    this.decoration = decoration;
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitDecorationExpr(this);
  }
}

export class YSPACER extends Expr {
  ySpacer: Token;
  rhythm?: Rhythm;

  constructor(id: number, ySpacer: Token, rhythm?: Rhythm) {
    super(id);
    this.ySpacer = ySpacer;
    this.rhythm = rhythm;
  }

  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitYSpacerExpr(this);
  }
}

export class ErrorExpr extends Expr {
  constructor(
    id: number,
    public tokens: Token[], // The problematic tokens
    public expectedType?: TT,
    public errorMessage?: string
  ) {
    super(id);
    this.tokens = tokens;
    this.expectedType = expectedType;
    this.errorMessage = errorMessage;
  }

  accept<T>(visitor: Visitor<T>): T {
    return visitor.visitErrorExpr(this);
  }
}

export class Lyric_line extends Expr {
  header: Token;
  contents: Array<Token>;

  constructor(id: number, header: Token, contents: Array<Token>) {
    super(id);
    this.header = header;
    this.contents = contents;
  }

  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitLyricLineExpr(this);
  }
}

export class Macro_decl extends Expr {
  header: Token;
  variable: Token;
  content: Token;

  constructor(id: number, header: Token, variable: Token, content: Token) {
    super(id);
    this.header = header;
    this.variable = variable;
    this.content = content;
  }

  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitMacroDeclExpr(this);
  }
}

export class Macro_invocation extends Expr {
  variable: Token;

  constructor(id: number, variable: Token) {
    super(id);
    this.variable = variable;
  }

  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitMacroInvocationExpr(this);
  }
}

export class User_symbol_decl extends Expr {
  header: Token;
  variable: Token;
  symbol: Token;

  constructor(id: number, header: Token, variable: Token, symbol: Token) {
    super(id);
    this.header = header;
    this.variable = variable;
    this.symbol = symbol;
  }

  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitUserSymbolDeclExpr(this);
  }
}

export class User_symbol_invocation extends Expr {
  variable: Token;

  constructor(id: number, variable: Token) {
    super(id);
    this.variable = variable;
  }

  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitUserSymbolInvocationExpr(this);
  }
}

// ========================
// New expression classes for unified info line parsing
// ========================

/**
 * Key-value expression with optional key: [key=]value
 * Used for both key-value pairs (K:clef=treble) and standalone values (K:major)
 */
export class KV extends Expr {
  key?: Token | AbsolutePitch; // IDENTIFIER (optional)
  equals?: Token; // EQL (optional, only present if key is present)
  value: Token | Expr; // IDENTIFIER, ANNOTATION, NUMBER, SPECIAL_LITERAL, or any Expr (e.g., Unary)

  constructor(id: number, value: Token | Expr, key?: Token | AbsolutePitch, equals?: Token) {
    super(id);
    this.value = value;
    this.key = key;
    this.equals = equals;
  }

  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitKV(this);
  }
}

/**
 * Binary expression for arithmetic: left op right
 * Used for rationals (1/4) and arithmetic expressions ((2+3+2)/8)
 */
export class Binary extends Expr {
  left: Expr | Token;
  operator: Token; // PLUS, SLASH
  right: Expr | Token;

  constructor(id: number, left: Expr | Token, operator: Token, right: Expr | Token) {
    super(id);
    this.left = left;
    this.operator = operator;
    this.right = right;
  }

  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitBinary(this);
  }
}

/**
 * Unary expression for unary operators: -expr or +expr
 * Used for signed numbers like -2 or +3
 */
export class Unary extends Expr {
  operator: Token; // MINUS or PLUS
  operand: Expr | Token;

  constructor(id: number, operator: Token, operand: Expr | Token) {
    super(id);
    this.operator = operator;
    this.operand = operand;
  }

  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitUnary(this);
  }
}

/**
 * Grouping expression for parenthesized expressions: (expr)
 * Preserves the fact that an expression was parenthesized in the AST
 */
export class Grouping extends Expr {
  expression: Expr;

  constructor(id: number, expression: Expr) {
    super(id);
    this.expression = expression;
  }

  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitGrouping(this);
  }
}
