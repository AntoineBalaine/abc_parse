/**
 * Shared utilities for the ABC CLI tool
 */

import { readFileSync, writeFileSync } from "fs";
import { ABCContext, Scanner, parse, AbcError } from "../../parse/index";

/**
 * Read an ABC file from disk
 */
export function readAbcFile(filePath: string): string {
  try {
    return readFileSync(filePath, "utf-8");
  } catch (error: any) {
    console.error(`Error reading file: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Write content to a file
 */
export function writeFile(filePath: string, content: string): void {
  try {
    writeFileSync(filePath, content, "utf-8");
  } catch (error: any) {
    console.error(`Error writing file: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Parse ABC content and return the AST and context
 */
export function parseAbc(content: string) {
  const ctx = new ABCContext();
  const tokens = Scanner(content, ctx);
  const ast = parse(tokens, ctx);

  return { ast, ctx, tokens };
}

/**
 * Format a diagnostic error for console output
 */
export function formatDiagnostic(error: AbcError, filePath: string, source: string): string {
  const token = error.token;

  // Handle both Token and Expr types
  const line = ("line" in token ? token.line : 0) + 1; // Convert to 1-based line numbers
  const col = ("position" in token ? token.position : 0) + 1; // Convert to 1-based column numbers
  const lexeme = "lexeme" in token ? token.lexeme : "";

  // Get the source line
  const lines = source.split("\n");
  const sourceLine = lines["line" in token ? token.line : 0] || "";

  // Create a caret line pointing to the error
  const caretLine = " ".repeat("position" in token ? token.position : 0) + "^".repeat(Math.max(1, lexeme.length));

  // Format: file:line:col: error: message
  let output = `${filePath}:${line}:${col}: error: ${error.message}\n`;
  output += `  ${sourceLine}\n`;
  output += `  ${caretLine}\n`;

  return output;
}

/**
 * Print diagnostics to console and return true if there were errors
 */
export function printDiagnostics(ctx: ABCContext, filePath: string, source: string): boolean {
  const errors = ctx.errorReporter.getErrors();
  const warnings = ctx.errorReporter.getWarnings();

  // Print errors
  errors.forEach((error: AbcError) => {
    console.error(formatDiagnostic(error, filePath, source));
  });

  // Print warnings
  warnings.forEach((warning: AbcError) => {
    const token = warning.token;
    const line = ("line" in token ? token.line : 0) + 1;
    const col = ("position" in token ? token.position : 0) + 1;
    console.warn(`${filePath}:${line}:${col}: warning: ${warning.message}`);
  });

  // Summary
  if (errors.length > 0 || warnings.length > 0) {
    console.log(`\nFound ${errors.length} error(s) and ${warnings.length} warning(s)`);
  }

  return errors.length > 0;
}
