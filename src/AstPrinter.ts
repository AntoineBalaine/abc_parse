import {
  Assign,
  Binary,
  Call,
  Expr,
  Grouping,
  Literal,
  Unary,
  Visitor,
} from "./Expr"
import Token from "./token"

/**
 * Leaving this unfinished, as it is a massive pain
 */

class AstPrinter implements Visitor<string> {
  print(expr: Expr): string {
    return expr.accept(this)
  }

  private parenthesize(name: string, ...exprs: Array<Expr>) {
    let builder = `(${name}`
    exprs.forEach((expr) => (builder += ` ${expr.accept<string>(this)}`))
    builder += ")"
    return builder
  }
  visitBinaryExpr(expr: Binary) {
    return this.parenthesize(expr.operator.lexeme, expr.left, expr.right)
  }
  visitGroupingExpr(expr: Grouping) {
    return this.parenthesize("group", expr.expression)
  }
  visitLiteralExpr(expr: Literal) {
    if (expr.value == null) return "nil"
    return expr.value.toString()
  }
  visitUnaryExpr(expr: Unary): string {
    return this.parenthesize(expr.operator.lexeme, expr.right)
  }
}
