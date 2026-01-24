/**
 * ABCT Parser Expression Functions
 *
 * Parses expressions following the precedence hierarchy:
 * 1. pipeline (|) - lowest
 * 2. concat (+)
 * 3. update (|=)
 * 4. application (whitespace)
 * 5. logical (or, and, not)
 * 6. comparison (>=, <=, ==, !=, >, <)
 * 7. atoms - highest
 */

import { AbctParseCtx, tokenToLoc, spanLoc } from "./context";
import { AbctTT, Token } from "../scanner";
import {
  peek,
  advance,
  check,
  checkAny,
  match,
  skipWS,
  skipWSAndEOL,
  isAtEnd,
  previous,
} from "./utils";
import {
  Expr,
  Pipe,
  Concat,
  Application,
  Or,
  And,
  Not,
  Negate,
  Comparison,
  ComparisonOp,
  FilterExpression,
  Loc,
} from "../ast";
import {
  parseIdentifier,
  parseNumberLiteral,
  parseAbcLiteral,
  parseList,
  parseGroup,
  parseSelector,
  parseVoiceRef,
  parseFileRef,
  parseLocationSelector,
  isFileRef,
  isVoiceRef,
  createErrorExpr,
} from "./atoms";
import { synchronize } from "./recovery";

/**
 * Parse an expression (entry point)
 */
export function parseExpr(ctx: AbctParseCtx): Expr {
  skipWS(ctx);
  return parsePipeline(ctx);
}

/**
 * Parse a pipeline expression: expr | expr | ...
 */
export function parsePipeline(ctx: AbctParseCtx): Expr {
  let left = parseConcatTerm(ctx);

  while (true) {
    skipWSAndEOL(ctx);

    if (check(ctx, AbctTT.PIPE)) {
      const opToken = advance(ctx);
      skipWSAndEOL(ctx);
      const right = parseConcatTerm(ctx);

      left = {
        type: "pipe",
        left,
        opLoc: tokenToLoc(opToken),
        right,
        loc: {
          start: left.loc.start,
          end: right.loc.end,
        },
      };
    } else {
      break;
    }
  }

  return left;
}

/**
 * Parse a concatenation expression: expr + expr + ...
 */
export function parseConcatTerm(ctx: AbctParseCtx): Expr {
  let left = parseUpdateTerm(ctx);

  while (true) {
    skipWS(ctx);

    if (match(ctx, AbctTT.PLUS)) {
      const opToken = previous(ctx);
      skipWS(ctx);
      const right = parseUpdateTerm(ctx);

      left = {
        type: "concat",
        left,
        opLoc: tokenToLoc(opToken),
        right,
        loc: {
          start: left.loc.start,
          end: right.loc.end,
        },
      };
    } else {
      break;
    }
  }

  return left;
}

/**
 * Parse an update expression: selector |= application
 */
export function parseUpdateTerm(ctx: AbctParseCtx): Expr {
  const left = parseApplication(ctx);

  return left;
}

/**
 * Parse an application: term term term ...
 * Terms are separated by whitespace. We don't check for WS tokens directly
 * because lower-precedence parsers (parseComparison, etc.) may have already
 * consumed them. Instead, we skip any WS and check if the next token can
 * start an atom.
 */
export function parseApplication(ctx: AbctParseCtx): Expr {
  const terms: Expr[] = [];
  terms.push(parseLogical(ctx));

  // Continue collecting terms as long as the next token can start an atom
  while (true) {
    // Skip any whitespace (may already have been consumed by parseComparison etc.)
    skipWS(ctx);

    // Check if next token can start a term (not an operator like |, +, etc.)
    if (!canStartAtom(ctx)) {
      break;
    }

    terms.push(parseLogical(ctx));
  }

  if (terms.length === 1) {
    return terms[0];
  }

  return {
    type: "application",
    terms,
    loc: {
      start: terms[0].loc.start,
      end: terms[terms.length - 1].loc.end,
    },
  };
}

/**
 * Parse logical expressions: or
 */
export function parseLogical(ctx: AbctParseCtx): Expr {
  return parseOr(ctx);
}

/**
 * Parse or expression: and or and or ...
 */
export function parseOr(ctx: AbctParseCtx): Expr {
  let left = parseAnd(ctx);

  while (true) {
    skipWS(ctx);

    if (match(ctx, AbctTT.OR)) {
      const kwToken = previous(ctx);
      skipWS(ctx);
      const right = parseAnd(ctx);

      left = {
        type: "or",
        left,
        kwLoc: tokenToLoc(kwToken),
        right,
        loc: {
          start: left.loc.start,
          end: right.loc.end,
        },
      };
    } else {
      break;
    }
  }

  return left;
}

/**
 * Parse and expression: not and not and ...
 */
export function parseAnd(ctx: AbctParseCtx): Expr {
  let left = parseNot(ctx);

  while (true) {
    skipWS(ctx);

    if (match(ctx, AbctTT.AND)) {
      const kwToken = previous(ctx);
      skipWS(ctx);
      const right = parseNot(ctx);

      left = {
        type: "and",
        left,
        kwLoc: tokenToLoc(kwToken),
        right,
        loc: {
          start: left.loc.start,
          end: right.loc.end,
        },
      };
    } else {
      break;
    }
  }

  return left;
}

/**
 * Parse not expression: not expr
 */
export function parseNot(ctx: AbctParseCtx): Expr {
  if (match(ctx, AbctTT.NOT)) {
    const kwToken = previous(ctx);
    skipWS(ctx);
    const operand = parseNot(ctx); // Right-recursive for chained not

    return {
      type: "not",
      kwLoc: tokenToLoc(kwToken),
      operand,
      loc: {
        start: tokenToLoc(kwToken).start,
        end: operand.loc.end,
      },
    };
  }

  return parseComparison(ctx);
}

/**
 * Parse comparison expression: atom op atom
 */
export function parseComparison(ctx: AbctParseCtx): Expr {
  const left = parseAtom(ctx);

  skipWS(ctx);

  // Check for comparison operator
  const compOps: [AbctTT, ComparisonOp][] = [
    [AbctTT.GTE, ">="],
    [AbctTT.LTE, "<="],
    [AbctTT.EQEQ, "=="],
    [AbctTT.BANGEQ, "!="],
    [AbctTT.GT, ">"],
    [AbctTT.LT, "<"],
  ];

  for (const [tokenType, op] of compOps) {
    if (match(ctx, tokenType)) {
      const opToken = previous(ctx);
      skipWS(ctx);
      const right = parseAtom(ctx);

      return {
        type: "comparison",
        op,
        opLoc: tokenToLoc(opToken),
        left,
        right,
        loc: {
          start: left.loc.start,
          end: right.loc.end,
        },
      };
    }
  }

  return left;
}

/**
 * Parse unary minus: -expr
 * Creates a Negate node wrapping the operand
 */
export function parseUnaryMinus(ctx: AbctParseCtx): Expr {
  const opToken = advance(ctx); // consume -
  skipWS(ctx);
  const operand = parseAtom(ctx); // Parse the operand as an atom

  return {
    type: "negate",
    opLoc: tokenToLoc(opToken),
    operand,
    loc: {
      start: tokenToLoc(opToken).start,
      end: operand.loc.end,
    },
  };
}

/**
 * Parse a filter expression: filter (predicate)
 * The predicate is a comparison expression within parentheses.
 */
export function parseFilterExpression(ctx: AbctParseCtx): FilterExpression {
  const filterToken = advance(ctx); // consume 'filter'
  skipWS(ctx);

  // Expect opening parenthesis
  if (!match(ctx, AbctTT.LPAREN)) {
    ctx.error("Expected '(' after 'filter'");
    // Error recovery: create a partial result
    return {
      type: "filter",
      kwLoc: tokenToLoc(filterToken),
      predicate: {
        type: "comparison",
        op: "==",
        opLoc: tokenToLoc(filterToken),
        left: { type: "identifier", name: "", loc: tokenToLoc(filterToken) },
        right: { type: "identifier", name: "", loc: tokenToLoc(filterToken) },
        loc: tokenToLoc(filterToken),
      },
      loc: tokenToLoc(filterToken),
    };
  }

  skipWS(ctx);

  // Parse the predicate - should be a comparison
  const predicate = parseComparison(ctx);

  // Validate that the predicate is actually a comparison
  if (predicate.type !== "comparison") {
    ctx.error("Filter predicate must be a comparison expression (e.g., pitch > C4)");
    // Wrap non-comparison in a fake comparison for error recovery
    const fakeComparison: Comparison = {
      type: "comparison",
      op: "==",
      opLoc: predicate.loc,
      left: predicate,
      right: { type: "identifier", name: "true", loc: predicate.loc },
      loc: predicate.loc,
    };
    return {
      type: "filter",
      kwLoc: tokenToLoc(filterToken),
      predicate: fakeComparison,
      loc: {
        start: tokenToLoc(filterToken).start,
        end: predicate.loc.end,
      },
    };
  }

  skipWS(ctx);

  // Expect closing parenthesis
  if (!match(ctx, AbctTT.RPAREN)) {
    ctx.error("Expected ')' to close filter predicate");
  }
  const closeToken = previous(ctx);

  return {
    type: "filter",
    kwLoc: tokenToLoc(filterToken),
    predicate,
    loc: {
      start: tokenToLoc(filterToken).start,
      end: tokenToLoc(closeToken).end,
    },
  };
}

/**
 * Parse an atom (highest precedence)
 */
export function parseAtom(ctx: AbctParseCtx): Expr {
  // Grouped expression: (expr)
  if (check(ctx, AbctTT.LPAREN)) {
    return parseGroup(ctx, parseExpr);
  }

  // List: [items]
  if (check(ctx, AbctTT.LBRACKET)) {
    return parseList(ctx, parseExpr);
  }

  // ABC fence literal: ```abc ... ```
  if (check(ctx, AbctTT.ABC_FENCE_OPEN)) {
    return parseAbcLiteral(ctx);
  }

  // Location selector: :line:col
  if (check(ctx, AbctTT.COLON)) {
    return parseLocationSelector(ctx);
  }

  // Selector: @path
  if (check(ctx, AbctTT.AT)) {
    return parseSelector(ctx);
  }

  // Filter expression: filter (predicate)
  if (check(ctx, AbctTT.FILTER)) {
    return parseFilterExpression(ctx);
  }

  // Voice reference: V:name (must check before file ref)
  if (isVoiceRef(ctx)) {
    return parseVoiceRef(ctx);
  }

  // File reference: path.ext (must check before identifier)
  if (isFileRef(ctx)) {
    return parseFileRef(ctx);
  }

  // Unary minus: -expr (handles negative numbers and negation)
  if (check(ctx, AbctTT.MINUS)) {
    return parseUnaryMinus(ctx);
  }

  // Number literal
  if (check(ctx, AbctTT.NUMBER)) {
    return parseNumberLiteral(ctx);
  }

  // Identifier
  if (check(ctx, AbctTT.IDENTIFIER)) {
    return parseIdentifier(ctx);
  }

  // Error recovery - must advance past the unexpected token to avoid infinite loop
  ctx.error(`Unexpected token: ${AbctTT[peek(ctx).type]}`);
  const errorToken = advance(ctx); // consume the unexpected token
  return createErrorExpr(ctx, `Unexpected token: ${AbctTT[errorToken.type]}`);
}

/**
 * Check if current token can start an atom
 */
export function canStartAtom(ctx: AbctParseCtx): boolean {
  return checkAny(
    ctx,
    AbctTT.LPAREN,
    AbctTT.LBRACKET,
    AbctTT.ABC_FENCE_OPEN,
    AbctTT.COLON,
    AbctTT.AT,
    AbctTT.NUMBER,
    AbctTT.IDENTIFIER,
    AbctTT.MINUS,  // Unary minus can start an atom
    AbctTT.FILTER  // Filter keyword can start an atom
  );
}
