/**
 * Test helpers for TreeSitter comparison testing
 *
 * Provides utilities for parsing ABC input with both parsers
 * and comparing the results using the CSNode comparison framework.
 */

import { Scanner } from "../../parsers/scan2";
import { parse } from "../../parsers/parse2";
import { ABCContext } from "../../parsers/Context";
import { File_structure } from "../../types/Expr2";
import {
  CSNode,
  exprToCS,
  compareCSNodes,
  CompareResult,
  formatCompareResult,
  countNodes,
} from "../../comparison";

/**
 * Result of parsing with the TypeScript parser
 */
export interface ParseResult {
  ast: File_structure;
  csNode: CSNode | null;
  errors: string[];
}

/**
 * Parse ABC input using the TypeScript parser
 */
export function parseWithTypeScript(input: string): ParseResult {
  const context = new ABCContext();
  const tokens = Scanner(input, context);
  const ast = parse(tokens, context);
  const csNode = exprToCS(ast);

  return {
    ast,
    csNode,
    errors: context.errorReporter.getErrors().map((e) => e.message),
  };
}

/**
 * Compare two CSNode trees and return detailed results
 */
export function compareParseTrees(
  expected: CSNode | null,
  actual: CSNode | null
): CompareResult {
  return compareCSNodes(expected, actual);
}

/**
 * Assert that two CSNode trees are equal, throwing an error with
 * detailed information if they differ
 */
export function assertTreesEqual(
  expected: CSNode | null,
  actual: CSNode | null,
  input?: string
): void {
  const result = compareParseTrees(expected, actual);
  if (!result.equal) {
    const message = formatCompareResult(result);
    const inputInfo = input ? `\nInput: ${input.slice(0, 100)}${input.length > 100 ? "..." : ""}` : "";
    throw new Error(`Trees are not equal:${inputInfo}\n${message}`);
  }
}

/**
 * Count the total number of nodes in a CSNode tree.
 * Re-exported from comparison module for test convenience.
 */
export { countNodes as countTreeNodes } from "../../comparison";

/**
 * Get the maximum depth of a CSNode tree.
 * Re-exported from comparison module for test convenience.
 */
export { treeDepth as getTreeDepth } from "../../comparison";

/**
 * Collect all unique node types in a CSNode tree.
 * Re-exported from comparison module for test convenience.
 */
export { collectNodeTypes } from "../../comparison";

/**
 * Test that parsing succeeds without errors
 */
export function assertParsesSuccessfully(input: string): ParseResult {
  const result = parseWithTypeScript(input);
  if (result.errors.length > 0) {
    throw new Error(
      `Parse errors:\n${result.errors.join("\n")}\nInput: ${input.slice(0, 100)}`
    );
  }
  return result;
}

/**
 * Test that self-comparison of a parse tree is equal
 */
export function assertSelfComparisonEqual(input: string): void {
  const result = parseWithTypeScript(input);
  assertTreesEqual(result.csNode, result.csNode, input);
}

/**
 * Format a CSNode tree for debugging.
 * Re-exported from comparison module for test convenience.
 */
export { serializeCSNode as formatTree } from "../../comparison";

/**
 * Quick sanity check that input parses to a non-empty tree
 */
export function assertNonEmptyParse(input: string): void {
  const result = parseWithTypeScript(input);
  if (!result.csNode) {
    throw new Error(`Parse returned null CSNode for input: ${input.slice(0, 100)}`);
  }
  const nodeCount = countNodes(result.csNode);
  if (nodeCount === 0) {
    throw new Error(`Parse returned empty tree for input: ${input.slice(0, 100)}`);
  }
}
