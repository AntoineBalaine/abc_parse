/**
 * ABCT Scanner
 *
 * Main scanner entry point that composes all primitive functions.
 * Following the ABC scanner pattern from parse/parsers/scan2.ts
 */

import { AbctCtx, createCtx } from "./context";
import { AbctTT, Token } from "./types";
import { isAtEnd } from "./utils";
import {
  identifier,
  number,
  string,
  abcLiteral,
  operator,
  collectInvalid,
} from "./primitives";
import { WS, EOL, comment } from "./whitespace";

/**
 * Scan result containing tokens and any errors
 */
export interface ScanResult {
  tokens: Token[];
  errors: Array<{
    message: string;
    line: number;
    column: number;
    offset: number;
  }>;
}

/**
 * Scan ABCT source code into tokens
 *
 * @param source - The ABCT source code to scan
 * @returns Scan result with tokens and errors
 */
export function scan(source: string): ScanResult {
  const ctx = createCtx(source);
  scanProgram(ctx);
  return {
    tokens: ctx.tokens,
    errors: ctx.errors,
  };
}

/**
 * Main scanner entry point
 * Scans the entire program and pushes EOF at the end
 */
export function scanProgram(ctx: AbctCtx): Token[] {
  while (!isAtEnd(ctx)) {
    ctx.start = ctx.current;
    scanToken(ctx);
  }

  // Push EOF token
  ctx.start = ctx.current;
  ctx.push(AbctTT.EOF);

  return ctx.tokens;
}

/**
 * Scan a single token
 * Tries each scanner function in order of precedence
 */
function scanToken(ctx: AbctCtx): boolean {
  // Try each scanner in order of precedence
  // Multi-character patterns first, then single-character
  if (comment(ctx)) return true;
  if (abcLiteral(ctx)) return true;
  if (string(ctx)) return true;
  if (number(ctx)) return true;
  if (identifier(ctx)) return true;
  if (operator(ctx)) return true;
  if (WS(ctx)) return true;
  if (EOL(ctx)) return true;

  // If nothing matched, collect invalid characters
  if (collectInvalid(ctx)) return true;

  // Should not reach here, but advance to prevent infinite loop
  ctx.current++;
  ctx.start = ctx.current;
  return false;
}
