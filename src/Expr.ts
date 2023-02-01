import Token from "./token"

export interface Visitor<R> {
  visitPitchExpr(expr: Pitch): R
  visitFileHeaderExpr(expr: File_header): R
  visitInfoLineExpr(expr: Info_line): R
  visitTuneHeaderExpr(expr: Tune_header): R
  visitCommentExpr(expr: Comment): R
  visitTuneBodyExpr(expr: Tune_Body): R
  visitTuneExpr(expr: Tune): R
  visitFileStructureExpr(expr: File_structure): R
  visitRhythmExpr(expr: Rhythm): R
  visitLyricSectionExpr(expr: Lyric_section): R
  visitRestExpr(expr: Rest): R
  visitNoteExpr(expr: Note): R
  visitMultiMeasureRestExpr(expr: MultiMeasureRest): R
  visitSymbolExpr(expr: Symbol): R
  visitGraceGroupExpr(expr: Grace_group): R
  visitInlineFieldExpr(expr: Inline_field): R
  visitChordExpr(expr: Chord): R
  visitNthRepeatExpr(expr: Nth_repeat): R
  visitAnnotationExpr(expr: Annotation): R
  visitBarLineExpr(expr: BarLine): R
  visitMusicCodeExpr(expr: Music_code): R
  visitSlurGroupExpr(expr: Slur_group): R
}

export abstract class Expr {
  abstract accept<R>(visitor: Visitor<R>): R
}

export class File_structure extends Expr {
  file_header: Expr | null
  tune: Array<Tune>
  constructor(file_header: Expr | null, tune: Array<Tune>) {
    super()
    this.file_header = file_header
    this.tune = tune
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitFileStructureExpr(this)
  }
}

export class Pitch extends Expr {
  alteration?: Token
  noteLetter: Token
  octave?: Token
  constructor({
    alteration,
    noteLetter,
    octave,
  }: {
    alteration?: Token
    noteLetter: Token
    octave?: Token
  }) {
    super()
    this.alteration = alteration
    this.noteLetter = noteLetter
    this.octave = octave
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitPitchExpr(this)
  }
}

export class File_header extends Expr {
  text: string
  constructor(text: string) {
    super()
    this.text = text
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitFileHeaderExpr(this)
  }
}

export class Info_line extends Expr {
  key: Token
  value: Array<Token>
  constructor(tokens: Array<Token>) {
    super()
    this.key = tokens[0]
    tokens.shift()
    this.value = tokens
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitInfoLineExpr(this)
  }
}

export class Lyric_section extends Expr {
  info_lines: Array<Info_line>
  constructor(info_lines: Array<Info_line>) {
    super()
    this.info_lines = info_lines
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitLyricSectionExpr(this)
  }
}
export class Tune_header extends Expr {
  info_lines: Array<Info_line>
  constructor(info_lines: Array<Info_line>) {
    super()
    this.info_lines = info_lines
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitTuneHeaderExpr(this)
  }
}
export class Comment extends Expr {
  text: string
  constructor(text: string) {
    super()
    this.text = text
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitCommentExpr(this)
  }
}
export type tune_body_code = Comment | Info_line | Music_code

export class Tune extends Expr {
  tune_header: Tune_header
  tune_body?: Tune_Body
  constructor(tune_header: Tune_header, tune_body?: Tune_Body) {
    super()
    this.tune_header = tune_header
    this.tune_body = tune_body
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitTuneExpr(this)
  }
}
export class Rhythm extends Expr {
  numerator?: Token | null
  separator?: Token
  denominator?: Token | null
  constructor(
    numerator: Token | null,
    separator?: Token,
    denominator?: Token | null
  ) {
    super()
    this.numerator = numerator
    this.separator = separator
    this.denominator = denominator
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitRhythmExpr(this)
  }
}

export class Rest extends Expr {
  rest: Token
  constructor(rest: Token) {
    super()
    this.rest = rest
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitRestExpr(this)
  }
}

export class Note extends Expr {
  pitch: Pitch | Rest
  rhythm?: Rhythm
  constructor(pitch: Pitch | Rest, rhythm?: Rhythm) {
    super()
    this.pitch = pitch
    this.rhythm = rhythm
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitNoteExpr(this)
  }
}
export class MultiMeasureRest extends Expr {
  rest: Token
  length?: Token
  constructor(rest: Token, length?: Token) {
    super()
    this.rest = rest
    this.length = length
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitMultiMeasureRestExpr(this)
  }
}
export class Symbol extends Expr {
  symbol: Token
  constructor(symbol: Token) {
    super()
    this.symbol = symbol
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitSymbolExpr(this)
  }
}
export class Grace_group extends Expr {
  notes: Array<Note>
  isAccacciatura?: boolean
  constructor(notes: Array<Note>, isAccacciatura?: boolean) {
    super()
    this.notes = notes
    this.isAccacciatura = isAccacciatura
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitGraceGroupExpr(this)
  }
}
export class Inline_field extends Expr {
  field: Token
  text: Array<Token>
  constructor(field: Token, text: Array<Token>) {
    super()
    this.field = field
    this.text = text
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitInlineFieldExpr(this)
  }
}

export class Chord extends Expr {
  contents: Array<Note | Token>
  rhythm?: Rhythm
  constructor(contents: Array<Note | Token>, rhythm?: Rhythm) {
    super()
    this.contents = contents
    this.rhythm = rhythm
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitChordExpr(this)
  }
}

export class Nth_repeat extends Expr {
  repeat: Token
  constructor(repeat: Token) {
    super()
    this.repeat = repeat
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitNthRepeatExpr(this)
  }
}

export class Tune_Body extends Expr {
  sequence: Array<Expr>
  constructor(sequence: Array<tune_body_code>) {
    super()
    this.sequence = sequence
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitTuneBodyExpr(this)
  }
}

export class Annotation extends Expr {
  text: Token
  constructor(text: Token) {
    super()
    this.text = text
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitAnnotationExpr(this)
  }
}

export class BarLine extends Expr {
  barline: Token
  constructor(barline: Token) {
    super()
    this.barline = barline
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitBarLineExpr(this)
  }
}

type music_code =
  | Token
  | BarLine
  | Annotation
  | Note
  | Grace_group
  | Nth_repeat
  | Inline_field
  | Chord
  | Symbol
  | MultiMeasureRest
  | Slur_group

export class Music_code extends Expr {
  contents: Array<music_code>
  constructor(contents: Array<music_code>) {
    super()
    this.contents = contents
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitMusicCodeExpr(this)
  }
}

export class Slur_group extends Expr {
  contents: Array<Music_code>
  constructor(contents: Array<Music_code>) {
    super()
    this.contents = contents
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitSlurGroupExpr(this)
  }
}
