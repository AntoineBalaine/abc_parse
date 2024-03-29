import { Token } from "./token";
import { System, TokenType } from "./types";

/**
 * Visitor is the interface that enables walking the parser's syntax tree.
 * Each method of the Visitor allows for traversing one of the expressions of the syntax tree.
 *
 * When implementing a visitor, each of these methods gets access to the data of the nodes:
 * eg:
 * ```typescript
 * // visits the top node of the tree, the `File_structure`
 * visitFileStructureExpr(expr: File_structure): Range { 
 *   const { file_header, tune, } = expr;
 *   return tune.map(t => (t.accept(this))) 
 * // use the accept method of each of the expressions of the tree, to access its contents. 
 * }
 * ```
 * The visitor can traverse the syntax tree 
 * and apply any transformations to it via the `accept` method of the nodes.
 * Use-cases include, amongst others: 
 * - formatting / pretty-printing the tree
 * - changing note/rhythm values in the tree
 * - retrieving tokens for syntax highlighting
 * - finding the location of certain tokens
 */
export interface Visitor<R> {
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
  visitNthRepeatExpr(expr: Nth_repeat): R;
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
}

export abstract class Expr {
  abstract accept<R>(visitor: Visitor<R>): R;
}

export class File_structure extends Expr {
  file_header: File_header | null;
  tune: Array<Tune>;
  constructor(file_header: File_header | null, tune: Array<Tune>) {
    super();
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
  constructor({
    alteration,
    noteLetter,
    octave,
  }: {
    alteration?: Token;
    noteLetter: Token;
    octave?: Token;
  }) {
    super();
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
  constructor(text: string, tokens: Array<Token>) {
    super();
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
  constructor(tokens: Array<Token>) {
    super();
    this.key = tokens[0];
    tokens.shift();
    // merge the tokens into a string token, and push them into the value
    let result = "";
    let index = -1;
    while (index < tokens.length - 1) {
      index += 1;
      if (tokens[index].type === TokenType.COMMENT) {
        break;
      }
      result += tokens[index].lexeme;
    }
    if (!tokens.length) {
      this.value = [];
      return;
    }
    let value = Array<Token>();
    value.push(
      new Token(
        TokenType.STRING,
        result,
        null,
        tokens[0].line,
        tokens[0].position
      )
    );
    if (tokens[index].type === TokenType.COMMENT) {
      value.push(tokens[index]);
    }
    this.value = value;
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitInfoLineExpr(this);
  }
}

export class Lyric_section extends Expr {
  info_lines: Array<Info_line>;
  constructor(info_lines: Array<Info_line>) {
    super();
    this.info_lines = info_lines;
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitLyricSectionExpr(this);
  }
}
export class Tune_header extends Expr {
  info_lines: Array<Info_line | Comment>;
  voices: Array<string>;
  constructor(info_lines: Array<Info_line | Comment>, voices?: Array<string>) {
    super();
    this.info_lines = info_lines;
    this.voices = voices || [];
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitTuneHeaderExpr(this);
  }
}
export class Comment extends Expr {
  text: string;
  token: Token;
  constructor(text: string, token: Token) {
    super();
    this.text = text;
    this.token = token;
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitCommentExpr(this);
  }
}
export type tune_body_code = Comment | Info_line | music_code;

export class Tune extends Expr {
  tune_header: Tune_header;
  tune_body?: Tune_Body;
  constructor(tune_header: Tune_header, tune_body?: Tune_Body) {
    super();
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
  constructor(
    numerator: Token | null,
    separator?: Token,
    denominator?: Token | null,
    broken?: Token | null
  ) {
    super();
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
  constructor(contents: Array<Token>) {
    super();
    this.contents = contents;
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitVoiceOverlayExpr(this);
  }
}

/**
 * syntax `(p:q:r` which means 'put p notes into the time of q for the next r notes'. If q is not given, it defaults as above. If r is not given, it defaults to p. 
 */
export class Tuplet extends Expr {
  p: Token;
  q?: Token;
  r?: Token;
  constructor(
    p: Token,
    q?: Token,
    r?: Token,
  ) {
    super();
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
  constructor(rest: Token) {
    super();
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
  constructor(pitch: Pitch | Rest, rhythm?: Rhythm, tie?: Token) {
    super();
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
  constructor(rest: Token, length?: Token) {
    super();
    this.rest = rest;
    this.length = length;
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitMultiMeasureRestExpr(this);
  }
}
export class Symbol extends Expr {
  symbol: Token;
  constructor(symbol: Token) {
    super();
    this.symbol = symbol;
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitSymbolExpr(this);
  }
}
export class Grace_group extends Expr {
  notes: Array<Note>;
  isAccacciatura?: boolean;
  constructor(notes: Array<Note>, isAccacciatura?: boolean) {
    super();
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
  constructor(field: Token, text: Array<Token>) {
    super();
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
  constructor(contents: Array<Note | Token | Annotation>, rhythm?: Rhythm, tie?: Token) {
    super();
    this.contents = contents;
    this.rhythm = rhythm;
    this.tie = tie;
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitChordExpr(this);
  }
}

export class Nth_repeat extends Expr {
  repeat: Token;
  constructor(repeat: Token) {
    super();
    this.repeat = repeat;
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitNthRepeatExpr(this);
  }
}

export class Tune_Body extends Expr {
  sequence: Array<System>;
  constructor(sequence: Array<System>) {
    super();
    this.sequence = sequence;
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitTuneBodyExpr(this);
  }
}

export class Annotation extends Expr {
  text: Token;
  constructor(text: Token) {
    super();
    this.text = text;
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitAnnotationExpr(this);
  }
}

export class BarLine extends Expr {
  barline: Token;
  constructor(barline: Token) {
    super();
    this.barline = barline;
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
  | Nth_repeat
  | Inline_field
  | Chord
  | Symbol
  | MultiMeasureRest
  | Beam
  | Tuplet;

export class Music_code extends Expr {
  contents: Array<music_code>;
  constructor(contents: Array<music_code>) {
    super();
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
  | Symbol;

export class Beam extends Expr {
  contents: Array<Beam_contents>;
  constructor(contents: Array<Beam_contents>) {
    super();
    this.contents = contents;
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitBeamExpr(this);
  }
}
export class Decoration extends Expr {
  decoration: Token;
  constructor(decoration: Token) {
    super();
    this.decoration = decoration;
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitDecorationExpr(this);
  }
}
export class YSPACER extends Expr {
  number?: Token | null;
  ySpacer: Token;
  constructor(ySpacer: Token, number?: Token) {
    super();
    this.ySpacer = ySpacer;
    if (number) {
      this.number = number;
    }
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitYSpacerExpr(this);
  }
}
