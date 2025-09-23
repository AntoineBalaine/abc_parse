import { ParseCtx } from "../parse2";
import { Expr, KV, Binary, Grouping, AbsolutePitch, Pitch } from "../../types/Expr2";
import { Token, TT } from "../scan2";
import { followedBy } from "../../helpers";
import { parsePitch } from "../parse2"; // Reuse existing pitch parsing logic

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

  while (!(ctx.isAtEnd() || ctx.check(TT.EOL) || ctx.check(TT.COMMENT) || ctx.check(TT.SCT_BRK))) {
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

  // Check for absolute pitch KV expression (NOTE_LETTER + optional ACCIDENTAL + optional NUMBER followed by =)
  if (ctx.check(TT.NOTE_LETTER) && isAbsolutePitchFollowedByEquals(ctx)) {
    return parseAbsolutePitchKVExpression(ctx);
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

  // Handle absolute pitches (NOTE_LETTER + optional ACCIDENTAL + optional NUMBER)
  if (ctx.check(TT.NOTE_LETTER)) {
    return parseAbsolutePitch(ctx);
  }

  // Handle tune body pitches (ACCIDENTAL + NOTE_LETTER + optional OCTAVE)
  if (ctx.check(TT.ACCIDENTAL)) {
    return parsePitch(ctx);
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

/**
 * Parse absolute pitch: NOTE_LETTER + optional ACCIDENTAL + optional NUMBER
 * Examples: G4, F#5, Bb3, C
 * Used in tempo markings like Q: G4=120
 */
function parseAbsolutePitch(ctx: ParseCtx): AbsolutePitch | null {
  if (!ctx.check(TT.NOTE_LETTER)) return null;

  const noteLetter = ctx.advance();
  let alteration: Token | undefined;
  let octave: Token | undefined;

  // Optional accidental
  if (ctx.check(TT.ACCIDENTAL)) {
    alteration = ctx.advance();
  }

  // Optional numeric octave
  if (ctx.check(TT.NUMBER)) {
    octave = ctx.advance();
  }

  return new AbsolutePitch(ctx.abcContext.generateId(), noteLetter, alteration, octave);
}

/**
 * Check if current position has an absolute pitch pattern followed by =
 */
function isAbsolutePitchFollowedByEquals(ctx: ParseCtx): boolean {
  let offset = 1; // Start after NOTE_LETTER

  // Skip optional accidental
  if (ctx.tokens[ctx.current + offset]?.type === TT.ACCIDENTAL) {
    offset++;
  }

  // Skip optional numeric octave
  if (ctx.tokens[ctx.current + offset]?.type === TT.NUMBER) {
    offset++;
  }

  // Skip optional whitespace
  if (ctx.tokens[ctx.current + offset]?.type === TT.WS) {
    offset++;
  }

  // Check if followed by =
  return ctx.tokens[ctx.current + offset]?.type === TT.EQL;
}

/**
 * Parse absolute pitch key-value expressions: G4=120
 */
function parseAbsolutePitchKVExpression(ctx: ParseCtx): KV | null {
  const absolutePitch = parseAbsolutePitch(ctx);
  if (!absolutePitch) {
    return null;
  }

  if (!ctx.match(TT.EQL)) {
    ctx.report("Expected '=' after absolute pitch");
    return null;
  }
  const equals = ctx.previous();

  if (!isValueToken(ctx.peek())) {
    ctx.report("Expected value after '='");
    return null;
  }

  const value = ctx.advance();
  return new KV(ctx.abcContext.generateId(), value, absolutePitch, equals);
}
