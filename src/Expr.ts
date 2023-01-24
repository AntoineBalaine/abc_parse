import Token from "./token"

export interface Visitor<R> {
  visitPitchExpr(expr: Pitch): R
}

export abstract class Expr {
  abstract accept<R>(visitor: Visitor<R>): R
}

/* export class file_structure extends Expr {
  file_header: Expr | undefined
  tune: Array<Expr>
  constructor(file_header: Expr | undefined, tune: Array<Expr>) {
    super()
    this.file_header = file_header
    this.tune = tune
  }
  accept<R>(visitor: Visitor<R>): R {
    return visitor.visitFileStructureExpr(this)
  }
} */

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
