/**
 * ABCT Parser - Main Entry Point
 *
 * Parses ABCT programs with error recovery.
 */

import { AbctParseCtx, createParseCtx, tokenToLoc } from "./context";
import { Token, AbctTT } from "../scanner";
import { peek, advance, check, match, skipWS, skipWSAndEOL, isAtEnd, previous, peekNext } from "./utils";
import { parseExpr } from "./expressions";
import { synchronize, synchronizeToStatement, tryRecover } from "./recovery";
import { createErrorExpr } from "./atoms";
import { Program, Statement, Assignment, Expr, Loc } from "../ast";

/**
 * Parse result containing AST and accumulated errors
 */
export interface ParseResult {
  program: Program;
  errors: Array<{ message: string; loc: Loc }>;
}

/**
 * Parse tokens and return a Program AST.
 * The caller is responsible for scanning the source first.
 */
export function parseTokens(tokens: Token[]): ParseResult {
  const ctx = createParseCtx(tokens);
  const program = parseProgram(ctx);

  const errors = ctx.errors.map((e) => ({ message: e.message, loc: e.loc }));
  return { program, errors };
}

/**
 * Parse a complete program (list of statements)
 */
export function parseProgram(ctx: AbctParseCtx): Program {
  const statements: Statement[] = [];
  const startToken = peek(ctx);

  // Skip leading whitespace and newlines
  skipWSAndEOL(ctx);

  while (!isAtEnd(ctx)) {
    // Skip blank lines and comments
    if (check(ctx, AbctTT.EOL) || check(ctx, AbctTT.COMMENT)) {
      advance(ctx);
      continue;
    }

    // Parse a statement with error recovery
    try {
      const stmt = parseStatement(ctx);
      statements.push(stmt);
    } catch (e) {
      // Error already recorded, try to recover
      if (!tryRecover(ctx)) {
        break;
      }
    }

    // Skip trailing whitespace and newlines
    skipWSAndEOL(ctx);
  }

  // Calculate program location
  const endToken = previous(ctx);
  const loc: Loc = statements.length > 0
    ? {
        start: statements[0].loc.start,
        end: statements[statements.length - 1].loc.end,
      }
    : {
        start: tokenToLoc(startToken).start,
        end: tokenToLoc(endToken).end,
      };

  return {
    type: "program",
    statements,
    loc,
  };
}

/**
 * Parse a single statement (assignment or expression)
 */
export function parseStatement(ctx: AbctParseCtx): Statement {
  skipWS(ctx);

  // Check for assignment: IDENTIFIER = expr
  if (check(ctx, AbctTT.IDENTIFIER) && isAssignment(ctx)) {
    return parseAssignment(ctx);
  }

  // Otherwise parse as expression
  return parseExpr(ctx);
}

/**
 * Check if this is an assignment (IDENTIFIER WS* = ...)
 */
function isAssignment(ctx: AbctParseCtx): boolean {
  // Current is IDENTIFIER, look ahead for = (possibly after WS)
  let pos = ctx.current + 1;

  // Skip whitespace
  while (pos < ctx.tokens.length && ctx.tokens[pos].type === AbctTT.WS) {
    pos++;
  }

  // Check for = (but not == or |=)
  if (pos < ctx.tokens.length) {
    const token = ctx.tokens[pos];
    if (token.type === AbctTT.EQ) {
      // Make sure it's not ==
      const nextPos = pos + 1;
      if (nextPos < ctx.tokens.length && ctx.tokens[nextPos].type === AbctTT.EQ) {
        return false; // This is ==
      }
      return true;
    }
  }

  return false;
}

/**
 * Parse an assignment: IDENTIFIER = expr
 */
function parseAssignment(ctx: AbctParseCtx): Assignment {
  const idToken = advance(ctx);
  const id = idToken.lexeme;
  const idLoc = tokenToLoc(idToken);

  skipWS(ctx);

  if (!match(ctx, AbctTT.EQ)) {
    ctx.error("Expected '=' in assignment");
    // Create error assignment with partial information
    return {
      type: "assignment",
      id,
      idLoc,
      eqLoc: idLoc, // Use id location as fallback
      value: createErrorExpr(ctx, "Expected '=' in assignment"),
      loc: idLoc,
    };
  }

  const eqToken = previous(ctx);
  const eqLoc = tokenToLoc(eqToken);

  skipWS(ctx);

  const value = parseExpr(ctx);

  return {
    type: "assignment",
    id,
    idLoc,
    eqLoc,
    value,
    loc: {
      start: idLoc.start,
      end: value.loc.end,
    },
  };
}
