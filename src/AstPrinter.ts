import { Visitor, Pitch, Expr } from "./Expr"
import Token from "./token"
import { TokenType } from "./types"

export class AstPrinter implements Visitor<string> {
  print(expr: Expr): string {
    return expr.accept(this)
  }

  private parenthesize(name: string, ...exprs: Array<Expr>) {
    let builder = `(${name}`
    exprs.forEach((expr) => (builder += ` ${expr.accept<string>(this)}`))
    builder += ")"
    return builder
  }
  visitPitchExpr(expr: Pitch) {
    return `(Pitch ${expr.alteration?.lexeme} ${expr.noteLetter.lexeme} ${expr.octave?.lexeme})`
  }
}
