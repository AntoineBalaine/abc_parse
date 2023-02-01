import { Visitor, Pitch, Expr, File_header, Rhythm, Tune } from "./Expr"
import Token from "./token"
import { TokenType } from "./types"

/* export class AstPrinter implements Visitor<string> {
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
  visitFileHeaderExpr(expr: File_header): string {
    return `(File_header ${expr.text})`
  }
  visitTuneExpr(expr: Tune): string {
    return `(Tune ${expr.tune_header.accept(expr.tune_header)} ${expr.body.accept(this)})`
  }
  visitRhythmExpr(expr: Rhythm): string {
    return `(Rhythm ${expr.value.accept(this)})`
  }
  //, visitRhythmExpr, visitLyricSectionExpr, visitRestExpr
}
 */
