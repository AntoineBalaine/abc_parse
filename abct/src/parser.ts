// ABCT Parser - Wrapper around Peggy-generated parser
import * as peggy from "peggy";
import { readFileSync } from "fs";
import { join } from "path";
import { Program, Expr } from "./ast";

// Load and compile the grammar at module load time
const grammarPath = join(__dirname, "grammar.peggy");
const grammarSource = readFileSync(grammarPath, "utf-8");
const parser = peggy.generate(grammarSource);

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
  try {
    const result = parser.parse(input) as Program;
    return { success: true, value: result };
  } catch (e) {
    if (isPeggyError(e)) {
      return {
        success: false,
        error: {
          message: e.message,
          location: e.location,
          expected: e.expected,
          found: e.found,
        },
      };
    }
    return {
      success: false,
      error: { message: String(e) },
    };
  }
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

// Type guard for Peggy syntax errors
interface PeggySyntaxError {
  message: string;
  location?: {
    start: { line: number; column: number; offset: number };
    end: { line: number; column: number; offset: number };
  };
  expected?: Array<{ type: string; description: string }>;
  found?: string;
}

function isPeggyError(e: unknown): e is PeggySyntaxError {
  return (
    typeof e === "object" &&
    e !== null &&
    "message" in e &&
    typeof (e as PeggySyntaxError).message === "string"
  );
}

// Re-export AST types for convenience
export * from "./ast";
