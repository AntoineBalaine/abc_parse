import { userInfo } from "os"
import {
  Assign,
  Binary,
  Call,
  Expr,
  Get,
  Grouping,
  Literal,
  Logical,
  Unary,
  Visitor,
  Set,
  Super,
  This,
  Variable,
} from "./Expr"
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
  visitAssignExpr(expr: Assign) {
    return this.parenthesize(expr.name.lexeme, expr.value)
  }
  visitBinaryExpr(expr: Binary) {
    return this.parenthesize(expr.operator.lexeme, expr.left, expr.right)
  }
  visitCallExpr(expr: Call) {
    return this.parenthesize(expr.paren.lexeme, expr.callee)
  }
  visitGetExpr(expr: Get) {
    return this.parenthesize(expr.name.lexeme, expr.object)
  }
  visitGroupingExpr(expr: Grouping) {
    return this.parenthesize("group", expr.expression)
  }
  visitLiteralExpr(expr: Literal) {
    if (expr.value == null) return "nil"
    return expr.value.toString()
  }
  visitLogicalExpr(expr: Logical) {
    return this.parenthesize(expr.operator.lexeme, expr.left, expr.right)
  }
  visitSetExpr(expr: Set) {
    return this.parenthesize(expr.name.lexeme, expr.object, expr.value)
  }
  visitSuperExpr(expr: Super) {
    return this.parenthesize(expr.keyword.lexeme, expr.method)
  }
  visitThisExpr(expr: This) {
    return this.parenthesize(expr.keyword.lexeme)
  }
  visitUnaryExpr(expr: Unary): string {
    return this.parenthesize(expr.operator.lexeme, expr.right)
  }
  visitVariableExpr(expr: Variable): string {
    return this.parenthesize(expr.name.lexeme)
  }
}

const usePrinter = () => {
  const expression: Expr = new Binary(
    new Unary(new Token(TokenType.MINUS, "-", null, 1), new Literal(123)),
    new Token(TokenType.STAR, "*", null, 1),
    new Grouping(new Literal(45.67))
  )
}

usePrinter()
