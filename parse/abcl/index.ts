/**
 * ABCL (Linear Style) Support Module
 *
 * This module provides functions for parsing and converting ABCL files.
 * ABCL files use "linear writing style" for multi-voice ABC notation,
 * where voice changes within the file represent actual system breaks.
 */

import { ABCContext } from "../parsers/Context";
import { parse } from "../parsers/parse2";
import { Scanner } from "../parsers/scan2";
import { File_structure } from "../types/Expr2";
import { AbcFormatter } from "../Visitors/Formatter2";
import { convertFileToDeferred } from "./AbclToAbcConverter";

// Re-export converter functions for direct access
export * from "./AbclToAbcConverter";

/**
 * Parse ABCL source into a File_structure AST using linear mode.
 * In linear mode, voices are discovered dynamically and voice markers
 * indicate system breaks.
 *
 * Note: This function mutates ctx.linear = true. If you need to parse
 * non-linear files afterwards using the same ABCContext, you should
 * either use a fresh context or reset ctx.linear = false manually.
 *
 * @param source - The ABCL source string
 * @param ctx - The ABC context for error reporting and ID generation
 * @returns The parsed File_structure AST
 */
export function parseAbcl(source: string, ctx: ABCContext): File_structure {
  // Set file-level linear flag before parsing so all tunes are treated as linear
  ctx.linear = true;
  const tokens = Scanner(source, ctx);
  return parse(tokens, ctx);
}

/**
 * Convert ABCL source to an ABC AST (File_structure).
 * Parses in linear mode, then converts to deferred style by inserting
 * silenced lines for missing voices in each system.
 *
 * @param source - The ABCL source string
 * @param ctx - The ABC context for error reporting and ID generation
 * @returns The converted File_structure AST in deferred style
 */
export function abclToAbcAst(source: string, ctx: ABCContext): File_structure {
  const linearAst = parseAbcl(source, ctx);
  return convertFileToDeferred(linearAst, ctx);
}

/**
 * Convert ABCL source to an ABC string.
 * Parses in linear mode, converts to deferred style, then formats as string.
 *
 * @param source - The ABCL source string
 * @param ctx - The ABC context for error reporting and ID generation
 * @returns The converted ABC string in deferred style
 */
export function abclToAbc(source: string, ctx: ABCContext): string {
  const deferredAst = abclToAbcAst(source, ctx);
  const formatter = new AbcFormatter(ctx);
  return formatter.stringify(deferredAst);
}
