import { followedBy } from "../../helpers";
import { Annotation, Directive, Expr, KV, Measurement, Pitch, Rational } from "../../types/Expr2";
import { parseAnnotation, ParseCtx, parsePitch } from "../parse2";
import { Token, TT } from "../scan2";
import { parseKV } from "./parseInfoLine2";

/**
 * Parse directive content after %% token has been consumed
 *
 * This parser follows the same precedence order as scanDirective.ts:
 * 1. numberWithUnit() - creates Measurement objects
 * 2. tuneBodyPitch() - creates Pitch objects
 * 3. identifier() - may create KV objects if followed by =
 * 4. stringLiteral() - creates Token objects
 * 5. signedNumber() - may create Rational objects if followed by /
 * 6. Single characters (=, /) - creates Token objects
 * 7. Special case: begintext multi-line directive with FREE_TXT content
 */
export function parseDirective(ctx: ParseCtx, prnt_arr?: Array<Expr | Token>): Directive | null {
  if (!ctx.match(TT.STYLESHEET_DIRECTIVE)) {
    return null;
  }

  // Extract the directive key (first identifier after %%)
  let directiveKey: Token;
  if (ctx.match(TT.IDENTIFIER)) {
    directiveKey = ctx.previous();
  } else return null;

  const options = ["begintext", "text", "center"];
  // Special case: begintext, text, and center directives expect FREE_TXT token
  if (options.includes(directiveKey.lexeme.toLowerCase())) {
    return parseTextDirective(ctx, directiveKey, prnt_arr);
  }

  const values: Array<Token | Rational | Pitch | KV | Measurement | Annotation> = [];
  // Parse remaining tokens following scanner precedence
  while (!(ctx.isAtEnd() || ctx.check(TT.EOL) || ctx.check(TT.SCT_BRK) || ctx.check(TT.COMMENT))) {
    if (prsMeasurement(ctx, values)) continue;
    if (prsPitch(ctx, values)) continue;
    if (prsKV(ctx, values)) continue;
    if (parseAnnotation(ctx, values)) continue;
    if (parseIdentifier(ctx, values)) continue;
    if (parseRationalOrNumber(ctx, values)) continue;
    if (parseGroupingSymbol(ctx, values)) continue;
    if (ctx.check(TT.WS)) {
      ctx.advance();
      continue;
    }

    // Handle invalid tokens by including them in values
    if (ctx.check(TT.INVALID)) {
      values.push(ctx.advance());
      continue;
    }
    break;
  }

  const rv = new Directive(ctx.abcContext.generateId(), directiveKey, values);
  if (prnt_arr) prnt_arr.push(rv);
  return rv;
}
function prsKV(ctx: ParseCtx, values: Array<Token | Rational | Pitch | Measurement | KV | Annotation>): KV | null {
  let kv: KV | null = null;
  if (ctx.check(TT.IDENTIFIER) && followedBy(ctx, [TT.EQL], [TT.WS])) {
    kv = parseKV(ctx);
    if (kv) values.push(kv);
  }
  return kv;
}

export function prsPitch(ctx: ParseCtx, prnt_arr: Array<Expr | Token>): Pitch | null {
  const pitch = parsePitch(ctx);
  if (pitch) prnt_arr.push(pitch);
  return pitch;
}

/**
 * Parse number with measurement unit: 12in, 5.5cm, 100pt
 * Creates Measurement objects
 */
function prsMeasurement(ctx: ParseCtx, values: Array<Token | Rational | Pitch | Measurement | KV | Annotation>): boolean {
  if (!ctx.check(TT.NUMBER)) return false;

  // Look ahead to see if next token is MEASUREMENT_UNIT
  if (ctx.current + 1 < ctx.tokens.length && ctx.tokens[ctx.current + 1].type === TT.MEASUREMENT_UNIT) {
    const numberToken = ctx.advance();
    const unitToken = ctx.advance();
    values.push(new Measurement(ctx.abcContext.generateId(), numberToken, unitToken));
    return true;
  }

  return false;
}

/**
 * Parse standalone identifier tokens
 * Since KV is handled by parseKV from parseInfoLine2, we just handle standalone identifiers
 */
function parseIdentifier(ctx: ParseCtx, values: Array<Token | Rational | Pitch | Measurement | KV | Annotation>): boolean {
  if (!ctx.check(TT.IDENTIFIER)) return false;

  values.push(ctx.advance());
  return true;
}

/**
 * Parse grouping symbols for %%score and %%staves directives
 * Handles: ( ) { } [ ] |
 */
function parseGroupingSymbol(ctx: ParseCtx, values: Array<Token | Rational | Pitch | Measurement | KV | Annotation>): boolean {
  if (
    ctx.check(TT.LPAREN) ||
    ctx.check(TT.RPAREN) ||
    ctx.check(TT.LBRACE) ||
    ctx.check(TT.RBRACE) ||
    ctx.check(TT.LBRACKET) ||
    ctx.check(TT.RBRACKET) ||
    ctx.check(TT.PIPE)
  ) {
    values.push(ctx.advance());
    return true;
  }
  return false;
}

/**
 * Parse rational number or standalone number: 1/4, 3/8, or just 42
 * Creates Rational objects for fractions, Token objects for standalone numbers
 */
function parseRationalOrNumber(ctx: ParseCtx, values: Array<Token | Rational | Pitch | Measurement | KV | Annotation>): boolean {
  if (!ctx.check(TT.NUMBER)) return false;

  const numerator = ctx.advance();

  // Check if this is a rational (number/number)
  if (ctx.check(TT.SLASH)) {
    const slash = ctx.advance();

    if (ctx.check(TT.NUMBER)) {
      const denominator = ctx.advance();
      values.push(new Rational(ctx.abcContext.generateId(), numerator, slash, denominator));
      return true;
    } else {
      // If no number after slash, treat as separate tokens
      values.push(numerator);
      values.push(slash);
      return true;
    }
  } else {
    // Standalone number
    values.push(numerator);
    return true;
  }
}

/**
 * Parse text directives (%%begintext, %%text, %%center) - expects FREE_TXT token
 * Because the scanner handles text capture for these directives,
 * we simply consume the FREE_TXT token that contains the text content.
 */
function parseTextDirective(ctx: ParseCtx, directiveKey: Token, prnt_arr?: Array<Expr | Token>): Directive | null {
  const values: Array<Token | Rational | Pitch | KV | Measurement | Annotation> = [];

  // Next token should be FREE_TXT containing the text content
  if (ctx.check(TT.FREE_TXT)) {
    values.push(ctx.advance());
  }

  // For begintext, optionally consume endtext directive if present
  if (directiveKey.lexeme.toLowerCase() === "begintext" && ctx.check(TT.STYLESHEET_DIRECTIVE)) {
    ctx.advance(); // consume %%
    if (ctx.check(TT.IDENTIFIER) && ctx.peek().lexeme.toLowerCase() === "endtext") {
      ctx.advance(); // consume endtext identifier
    }
  }

  const rv = new Directive(ctx.abcContext.generateId(), directiveKey, values);
  if (prnt_arr) prnt_arr.push(rv);
  return rv;
}
