import { ParseCtx } from "../parse2";
import { Expr, KV, Binary, Grouping } from "../../types/Expr2";
import { Token, TT } from "../scan2";
import { followedBy } from "../../helpers";

/**
 * Unified info line parser using generic expression types
 *
 * This parser produces a generic expression tree that can be used by
 * an interpreter to handle all info line types (K:, M:, L:, Q:, V:).
 *
 * Replaces the type-specific sub-parsers with a single generic approach.
 */
export function parseInfoLine2(ctx: ParseCtx): Array<Expr | Token> {
  const expressions: (Expr | Token)[] = [];

  while (!ctx.isAtEnd() && !ctx.check(TT.EOL) && !ctx.check(TT.COMMENT)) {
    if (ctx.match(TT.WS)) continue;

    const expr = parseExpression(ctx);
    if (expr) {
      expressions.push(expr);
    } else {
      // If we can't parse anything, store the token and advance to avoid infinite loop
      expressions.push(ctx.advance());
    }
  }

  return expressions;
}

/**
 * Parse a complete expression (KV or binary)
 */
function parseExpression(ctx: ParseCtx): Expr | null {
  // Check for KV expression first (identifier followed by =)
  if (ctx.check(TT.IDENTIFIER) && followedBy(ctx, [TT.EQL], [TT.WS])) {
    return parseKVExpression(ctx);
  }

  // Otherwise try to parse as binary expression or standalone value
  return parseBinaryExpression(ctx);
}

/**
 * Parse key-value expressions: key=value
 */
function parseKVExpression(ctx: ParseCtx): KV | null {
  const key = ctx.advance();
  const equals = ctx.advance();

  if (!isValueToken(ctx.peek())) {
    ctx.report("Expected value after '='");
    return null;
  }

  const value = ctx.advance();
  return new KV(ctx.abcContext.generateId(), value, key, equals);
}

/**
 * Parse binary expressions: handles both + and / operators with proper precedence
 */
function parseBinaryExpression(ctx: ParseCtx): Expr | null {
  let left = parsePrimary(ctx);
  if (!left) return null;

  while (ctx.check(TT.PLUS) || ctx.check(TT.SLASH)) {
    const operator = ctx.advance();
    const right = parsePrimary(ctx);
    if (!right) {
      ctx.report(`Expected expression after '${operator.lexeme}'`);
      return null;
    }
    left = new Binary(ctx.abcContext.generateId(), left, operator, right);
  }

  return left;
}

/**
 * Parse primary expressions: numbers, identifiers, parenthesized expressions
 */
function parsePrimary(ctx: ParseCtx): Expr | Token | null {
  // Handle parenthesized expressions
  if (ctx.match(TT.LPAREN)) {
    const expr = parseBinaryExpression(ctx);
    if (!expr) {
      ctx.report("Expected expression after '('");
      return null;
    }

    if (!ctx.match(TT.RPAREN)) {
      ctx.report("Expected ')' after expression");
      return null;
    }

    return new Grouping(ctx.abcContext.generateId(), expr);
  }

  // Handle numbers
  if (ctx.match(TT.NUMBER)) {
    return ctx.previous();
  }

  // Handle other value tokens as standalone KV expressions
  if (isValueToken(ctx.peek())) {
    const value = ctx.advance();
    return new KV(ctx.abcContext.generateId(), value);
  }

  return null;
}

/**
 * Check if token can be a value in a KV expression
 */
function isValueToken(token: Token | null): boolean {
  if (!token) return false;

  return [TT.IDENTIFIER, TT.ANNOTATION, TT.NUMBER, TT.SPECIAL_LITERAL].includes(token.type);
}
