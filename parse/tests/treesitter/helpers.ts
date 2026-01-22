/**
 * Test helpers for TreeSitter comparison testing
 *
 * Provides utilities for parsing ABC input with both parsers
 * and comparing the results using the CSNode comparison framework.
 *
 * NOTE: TreeSitter comparison requires the native module to be built.
 * When TreeSitter is not available, tests fall back to TypeScript-only
 * validation (self-comparison tests).
 *
 * To enable TreeSitter comparison:
 * 1. cd tree-sitter-abc
 * 2. npm run build (requires tree-sitter-cli and make)
 * 3. The tests will automatically detect and use the TreeSitter parser
 */

import { Scanner } from "../../parsers/scan2";
import { parse } from "../../parsers/parse2";
import { ABCContext } from "../../parsers/Context";
import { File_structure } from "../../types/Expr2";
import {
  CSNode,
  exprToCS,
  tsToCS,
  compareCSNodes,
  CompareResult,
  formatCompareResult,
  countNodes,
  SyntaxNode,
} from "../../comparison";

/**
 * TreeSitter parser interface (matches tree-sitter's Parser type)
 */
interface TreeSitterParser {
  parse: (input: string) => { rootNode: SyntaxNode };
  setLanguage: (language: unknown) => void;
}

/**
 * TreeSitter parser instance (lazy-loaded when available)
 */
let treeSitterParser: TreeSitterParser | null = null;
let treeSitterAvailable: boolean | null = null;

/**
 * Check if TreeSitter parser is available and load it
 */
function checkTreeSitterAvailable(): boolean {
  if (treeSitterAvailable !== null) {
    return treeSitterAvailable;
  }

  try {
    // Try to load tree-sitter and tree-sitter-abc
    // These will throw if the native module isn't built
    const Parser = require("tree-sitter");
    const ABC = require("tree-sitter-abc");

    const parser = new Parser() as TreeSitterParser;
    parser.setLanguage(ABC);
    treeSitterParser = parser;
    treeSitterAvailable = true;
  } catch {
    // TreeSitter not available (native module not built)
    treeSitterAvailable = false;
  }

  return treeSitterAvailable;
}

/**
 * Returns whether TreeSitter is available for comparison testing.
 * Tests can use this to skip TreeSitter-specific assertions.
 */
export function isTreeSitterAvailable(): boolean {
  return checkTreeSitterAvailable();
}

/**
 * Result of parsing with the TypeScript parser
 */
export interface ParseResult {
  ast: File_structure;
  csNode: CSNode | null;
  errors: string[];
}

/**
 * Result of parsing with both parsers
 */
export interface DualParseResult {
  /** TypeScript parser result */
  typescript: {
    ast: File_structure;
    csNode: CSNode | null;
    errors: string[];
  };
  /** TreeSitter parser result (null if not available) */
  treeSitter: {
    tree: { rootNode: SyntaxNode } | null;
    csNode: CSNode | null;
  } | null;
  /** Whether TreeSitter was available for this parse */
  treeSitterAvailable: boolean;
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
 * Parse ABC input using both TypeScript and TreeSitter parsers.
 *
 * This is the primary function for comparison testing. When TreeSitter
 * is available, it parses with both parsers and returns both results.
 * When TreeSitter is not available, only the TypeScript result is returned.
 *
 * @param input - The ABC notation input to parse
 * @returns Results from both parsers (TreeSitter may be null if not available)
 */
export function parseWithBoth(input: string): DualParseResult {
  // Parse with TypeScript parser
  const tsResult = parseWithTypeScript(input);

  // Check TreeSitter availability
  const available = checkTreeSitterAvailable();

  if (!available || treeSitterParser === null) {
    return {
      typescript: {
        ast: tsResult.ast,
        csNode: tsResult.csNode,
        errors: tsResult.errors,
      },
      treeSitter: null,
      treeSitterAvailable: false,
    };
  }

  // Parse with TreeSitter parser
  const tree = treeSitterParser.parse(input);
  const treeSitterCsNode = tsToCS(tree.rootNode);

  return {
    typescript: {
      ast: tsResult.ast,
      csNode: tsResult.csNode,
      errors: tsResult.errors,
    },
    treeSitter: {
      tree,
      csNode: treeSitterCsNode,
    },
    treeSitterAvailable: true,
  };
}

/**
 * Compare both parsers and return the comparison result.
 * Throws if TreeSitter is not available.
 */
export function compareBothParsers(input: string): CompareResult {
  const result = parseWithBoth(input);

  if (!result.treeSitterAvailable || result.treeSitter === null) {
    throw new Error(
      "TreeSitter native module not available. " +
      "Run: cd tree-sitter-abc && npm run build && cd .. && npm rebuild tree-sitter"
    );
  }

  return compareCSNodes(result.typescript.csNode, result.treeSitter.csNode);
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
