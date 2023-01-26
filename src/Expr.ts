import Token from "./token"

export interface Visitor<R> {
  visitPitchExpr(expr: Pitch): R
  visitFileHeaderExpr(expr: File_header): R
  visitInfoLineExpr(expr: Info_line): R
  visitTuneHeaderExpr(expr: Tune_header): R
  visitCommentExpr(expr: Comment): R
  visitTuneBodyExpr(expr: Tune_body): R
  visitTuneExpr(expr: Tune): R
  visitFileStructureExpr(expr: File_structure): R
  visitRhythmExpr(expr: Rhythm): R
  visitLyricSectionExpr(expr: Lyric_section): R
}

export abstract class Expr {
  abstract accept<R>(visitor: Visitor<R>): R
}

export class File_structure extends Expr {
  file_header: Expr | undefined
  tune: Array<Tune>
  constructor(file_header: Expr | undefined, tune: Array<Tune>) {
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
export class Tune_body extends Expr {
  sequence: Array<Comment | Info_line | Music_code>

  constructor(elements: Array<Expr>) {
    super()
    this.sequence = elements
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitTuneBodyExpr(this)
  }
}

export class Tune extends Expr {
  tune_header: Tune_header
  tune_body: Tune_body | undefined
  constructor(tune_header: Tune_header, tune_body: Tune_body | undefined) {
    super()
    this.tune_header = tune_header
    this.tune_body = tune_body
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitTuneExpr(this)
  }
}
export class Rhythm extends Expr {
  numerator: Token | null
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
