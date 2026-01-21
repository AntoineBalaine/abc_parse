// ABCT Parser - Public API
// Uses the new hand-written recursive descent parser with error recovery
import { parse as newParse } from "./parser/parser";
import { Program, Expr } from "./ast";

/**
 * Parse result type - either success with AST or failure with error
 */
export type ParseResult<T> =
  | { success: true; value: T }
  | { success: false; error: ParseError };

/**
 * Parse error with location information
 */
export interface ParseError {
  message: string;
  location?: {
    start: { line: number; column: number; offset: number };
    end: { line: number; column: number; offset: number };
  };
  expected?: Array<{ type: string; description: string }>;
  found?: string;
}

/**
 * Parse ABCT source code into a Program AST
 *
 * @param input - The ABCT source code to parse
 * @returns ParseResult with either the Program AST or an error
 */
export function parse(input: string): ParseResult<Program> {
  const result = newParse(input);

  if (result.errors.length > 0) {
    // Return first error in the legacy format
    const firstError = result.errors[0];
    return {
      success: false,
      error: {
        message: firstError.message,
        location: firstError.loc,
      },
    };
  }

  return { success: true, value: result.program };
}

/**
 * Parse ABCT source code, throwing on failure
 *
 * @param input - The ABCT source code to parse
 * @returns The Program AST
 * @throws Error if parsing fails
 */
export function parseOrThrow(input: string): Program {
  const result = parse(input);
  if (!result.success) {
    throw new Error(result.error.message);
  }
  return result.value;
}

/**
 * Parse a single ABCT expression (not a full program)
 *
 * @param input - The ABCT expression to parse
 * @returns ParseResult with either the Expr AST or an error
 */
export function parseExpr(input: string): ParseResult<Expr> {
  // Wrap the expression in a program context and extract the first statement
  const result = parse(input);
  if (!result.success) {
    return result;
  }
  const program = result.value;
  if (program.statements.length === 0) {
    return {
      success: false,
      error: { message: "Empty input" },
    };
  }
  const first = program.statements[0];
  if (first.type === "assignment") {
    return {
      success: false,
      error: { message: "Expected expression, got assignment" },
    };
  }
  return { success: true, value: first };
}

// Re-export AST types for convenience
export * from "./ast";

// Re-export tokenization utilities
export { extractTokens, AbctTokenType, AbctToken } from "./tokenize";
