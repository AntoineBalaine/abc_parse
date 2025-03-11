import { ABCContext } from "../parsers/Context";
import { Token, TT } from "../parsers/scan2";

/**
 * Visitor is the interface that enables walking the parser's syntax tree.
 * Each method of the Visitor allows for traversing one of the expressions of the syntax tree.
 */
export interface Visitor<R> {
  ctx: ABCContext;
  visitAnnotationExpr(expr: Annotation): R;
  visitBarLineExpr(expr: BarLine): R;
  visitChordExpr(expr: Chord): R;
  visitCommentExpr(expr: Comment): R;
  visitDecorationExpr(expr: Decoration): R;
  visitFileHeaderExpr(expr: File_header): R;
  visitFileStructureExpr(expr: File_structure): R;
  visitGraceGroupExpr(expr: Grace_group): R;
  visitInfoLineExpr(expr: Info_line): R;
  visitInlineFieldExpr(expr: Inline_field): R;
  visitLyricSectionExpr(expr: Lyric_section): R;
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
  visitYSpacerExpr(expr: YSPACER): R;
  visitBeamExpr(expr: Beam): R;
  visitVoiceOverlayExpr(expr: Voice_overlay): R;
  visitTupletExpr(expr: Tuplet): R;
  visitErrorExpr(expr: ErrorExpr): R;
}

export abstract class Expr {
  public readonly id: number;

  constructor(id: number) {
    this.id = id;
  }
  abstract accept<R>(visitor: Visitor<R>): R;
}

export class File_structure extends Expr {
  file_header: File_header | null;
  tune: Array<Tune>;
  constructor(ctx: ABCContext, file_header: File_header | null, tune: Array<Tune>) {
    super(ctx.generateId());
    this.file_header = file_header;
    this.tune = tune;
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitFileStructureExpr(this);
  }
}

export class Pitch extends Expr {
  alteration?: Token;
  noteLetter: Token;
  octave?: Token;
  constructor(ctx: ABCContext, { alteration, noteLetter, octave }: { alteration?: Token; noteLetter: Token; octave?: Token }) {
    super(ctx.generateId());
    this.alteration = alteration;
    this.noteLetter = noteLetter;
    this.octave = octave;
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitPitchExpr(this);
  }
}

export class File_header extends Expr {
  text: string;
  tokens: Array<Token>;
  constructor(ctx: ABCContext, text: string, tokens: Array<Token>) {
    super(ctx.generateId());
    this.text = text;
    this.tokens = tokens;
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitFileHeaderExpr(this);
  }
}

export class Info_line extends Expr {
  key: Token;
  value: Array<Token>;
  metadata?: Array<Token>;

  constructor(ctx: ABCContext, tokens: Array<Token>) {
    super(ctx.generateId());

    this.key = tokens[0];
    const remainingTokens = tokens.slice(1);

    if (!remainingTokens.length) {
      this.value = [];
      return;
    }

    // For simplicity, we'll just store the tokens directly
    this.value = remainingTokens;
  }

  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitInfoLineExpr(this);
  }
}

export class Lyric_section extends Expr {
  info_lines: Array<Info_line>;
  constructor(ctx: ABCContext, info_lines: Array<Info_line>) {
    super(ctx.generateId());
    this.info_lines = info_lines;
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitLyricSectionExpr(this);
  }
}

export class Tune_header extends Expr {
  info_lines: Array<Info_line | Comment>;
  voices: Array<string>;
  constructor(ctx: ABCContext, info_lines: Array<Info_line | Comment>, voices?: Array<string>) {
    super(ctx.generateId());
    this.info_lines = info_lines;
    this.voices = voices || [];
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitTuneHeaderExpr(this);
  }
}

export class Comment extends Expr {
  token: Token;
  constructor(ctx: ABCContext, token: Token) {
    super(ctx.generateId());
    this.token = token;
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitCommentExpr(this);
  }
}

export type tune_body_code = Comment | Info_line | music_code | ErrorExpr;
export type System = Array<tune_body_code>;

export class Tune extends Expr {
  tune_header: Tune_header;
  tune_body?: Tune_Body;
  constructor(ctx: ABCContext, tune_header: Tune_header, tune_body?: Tune_Body) {
    super(ctx.generateId());
    this.tune_header = tune_header;
    this.tune_body = tune_body;
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
  constructor(ctx: ABCContext, numerator: Token | null, separator?: Token, denominator?: Token | null, broken?: Token | null) {
    super(ctx.generateId());
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
  constructor(ctx: ABCContext, contents: Array<Token>) {
    super(ctx.generateId());
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
  q?: Array<Token>;
  r?: Array<Token>;
  constructor(ctx: ABCContext, p: Token, q?: Array<Token>, r?: Array<Token>) {
    super(ctx.generateId());
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
  constructor(ctx: ABCContext, rest: Token) {
    super(ctx.generateId());
    this.rest = rest;
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitRestExpr(this);
  }
}

export class Note extends Expr {
  pitch: Pitch | Rest;
  rhythm?: Rhythm;
  tie?: Token;
  constructor(ctx: ABCContext, pitch: Pitch | Rest, rhythm?: Rhythm, tie?: Token) {
    super(ctx.generateId());
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
  constructor(ctx: ABCContext, rest: Token, length?: Token) {
    super(ctx.generateId());
    this.rest = rest;
    this.length = length;
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitMultiMeasureRestExpr(this);
  }
}

export class Symbol extends Expr {
  symbol: Token;
  constructor(ctx: ABCContext, symbol: Token) {
    super(ctx.generateId());
    this.symbol = symbol;
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitSymbolExpr(this);
  }
}

export class Grace_group extends Expr {
  notes: Array<Note | Token>;
  isAccacciatura?: boolean;
  constructor(ctx: ABCContext, notes: Array<Note | Token>, isAccacciatura?: boolean) {
    super(ctx.generateId());
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
  constructor(ctx: ABCContext, field: Token, text: Array<Token>) {
    super(ctx.generateId());
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
  constructor(ctx: ABCContext, contents: Array<Note | Token | Annotation>, rhythm?: Rhythm, tie?: Token) {
    super(ctx.generateId());
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
  constructor(ctx: ABCContext, sequence: Array<System>) {
    super(ctx.generateId());
    this.sequence = sequence;
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitTuneBodyExpr(this);
  }
}

export class Annotation extends Expr {
  text: Token;
  constructor(ctx: ABCContext, text: Token) {
    super(ctx.generateId());
    this.text = text;
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitAnnotationExpr(this);
  }
}

export class BarLine extends Expr {
  barline: Array<Token>;
  repeatNumbers?: Token[]; // Optional repeat numbers

  constructor(ctx: ABCContext, barline: Array<Token>, repeatNumbers?: Array<Token>) {
    super(ctx.generateId());
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
  | ErrorExpr;

export class Music_code extends Expr {
  contents: Array<music_code>;
  constructor(ctx: ABCContext, contents: Array<music_code>) {
    super(ctx.generateId());
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
  constructor(ctx: ABCContext, contents: Array<Beam_contents>) {
    super(ctx.generateId());
    this.contents = contents;
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitBeamExpr(this);
  }
}

export class Decoration extends Expr {
  decoration: Token;
  constructor(ctx: ABCContext, decoration: Token) {
    super(ctx.generateId());
    this.decoration = decoration;
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitDecorationExpr(this);
  }
}

export class YSPACER extends Expr {
  ySpacer: Token;
  rhythm?: Rhythm;

  constructor(ctx: ABCContext, ySpacer: Token, rhythm?: Rhythm) {
    super(ctx.generateId());
    this.ySpacer = ySpacer;
    this.rhythm = rhythm;
  }

  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitYSpacerExpr(this);
  }
}

export class ErrorExpr extends Expr {
  constructor(
    ctx: ABCContext,
    public tokens: Token[], // The problematic tokens
    public expectedType?: TT,
    public errorMessage?: string
  ) {
    super(ctx.generateId());
    this.tokens = tokens;
    this.expectedType = expectedType;
    this.errorMessage = errorMessage;
  }

  accept<T>(visitor: Visitor<T>): T {
    return visitor.visitErrorExpr(this);
  }
}
