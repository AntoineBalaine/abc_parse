/**
 * compare.ts - CSNode Tree Comparison Algorithm
 *
 * Implements a two-way recursive comparison of child-sibling trees.
 * Used to validate that TreeSitter output matches the TypeScript parser output.
 *
 * The algorithm compares:
 * - Node types (must match exactly)
 * - Text content for leaf nodes (must match exactly)
 * - firstChild chains (recursively)
 * - nextSibling chains (recursively)
 */
import { CSNode } from "./CSNode";

/**
 * Result of comparing two CSNode trees
 */
export interface CompareResult {
  /** Whether the trees are structurally equal */
  equal: boolean;

  /** Path to the first difference (array of type names and navigation steps) */
  path?: string[];

  /** Expected value at the point of difference */
  expected?: string;

  /** Actual value at the point of difference */
  actual?: string;

  /** The expected node at the point of difference (for debugging) */
  expectedNode?: CSNode | null;

  /** The actual node at the point of difference (for debugging) */
  actualNode?: CSNode | null;
}

/**
 * Options for controlling comparison behavior
 */
export interface CompareOptions {
  /**
   * Whether to compare text content of leaf nodes.
   * Default: true
   */
  compareText?: boolean;

  /**
   * Whether to normalize whitespace when comparing text.
   * Default: false
   */
  normalizeWhitespace?: boolean;

  /**
   * Types to ignore during comparison (useful for skipping whitespace nodes)
   */
  ignoreTypes?: Set<string>;

  /**
   * Maximum depth to compare. -1 for unlimited.
   * Default: -1
   */
  maxDepth?: number;
}

/**
 * Creates a successful comparison result
 */
function success(): CompareResult {
  return { equal: true };
}

/**
 * Creates a failed comparison result
 */
function failure(
  path: string[],
  expected: string,
  actual: string,
  expectedNode?: CSNode | null,
  actualNode?: CSNode | null
): CompareResult {
  return {
    equal: false,
    path,
    expected,
    actual,
    expectedNode,
    actualNode,
  };
}

/**
 * Normalizes whitespace in a string for comparison
 * - Collapses consecutive whitespace to single space
 * - Trims leading/trailing whitespace
 */
function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Filters out nodes with types in the ignore set
 */
function filterIgnored(node: CSNode | null, ignoreTypes: Set<string>): CSNode | null {
  if (node === null) return null;
  if (ignoreTypes.has(node.type)) {
    // Skip this node and try the next sibling
    return filterIgnored(node.nextSibling, ignoreTypes);
  }
  return node;
}

/**
 * Compares two CSNode trees recursively
 *
 * Uses a two-way recursion pattern:
 * 1. Compare current nodes (type and text)
 * 2. Recursively compare firstChild chains
 * 3. Recursively compare nextSibling chains
 *
 * @param expected - The expected CSNode (from TypeScript parser)
 * @param actual - The actual CSNode (from TreeSitter parser)
 * @param path - Current path for error reporting (default: [])
 * @param options - Comparison options
 * @returns CompareResult indicating equality or the first difference
 */
export function compareCSNodes(
  expected: CSNode | null,
  actual: CSNode | null,
  path: string[] = [],
  options: CompareOptions = {}
): CompareResult {
  const compareText = options.compareText ?? true;
  const doNormalizeWhitespace = options.normalizeWhitespace ?? false;
  const ignoreTypes = options.ignoreTypes ?? new Set<string>();
  const maxDepth = options.maxDepth ?? -1;

  // Apply type filtering
  expected = filterIgnored(expected, ignoreTypes);
  actual = filterIgnored(actual, ignoreTypes);

  // Check depth limit
  if (maxDepth >= 0 && path.length > maxDepth * 2) {
    return success(); // Stop comparing beyond max depth
  }

  // Both null means equal at this position
  if (expected === null && actual === null) {
    return success();
  }

  // One null, other not - structural difference
  if (expected === null) {
    return failure(
      path,
      "null",
      actual!.type,
      expected,
      actual
    );
  }

  if (actual === null) {
    return failure(
      path,
      expected.type,
      "null",
      expected,
      actual
    );
  }

  // Compare node types
  if (expected.type !== actual.type) {
    return failure(
      path,
      expected.type,
      actual.type,
      expected,
      actual
    );
  }

  // Compare text content for leaf nodes
  if (compareText && (expected.text !== undefined || actual.text !== undefined)) {
    let expectedText = expected.text ?? "";
    let actualText = actual.text ?? "";

    if (doNormalizeWhitespace) {
      expectedText = normalizeWhitespace(expectedText);
      actualText = normalizeWhitespace(actualText);
    }

    if (expectedText !== actualText) {
      return failure(
        [...path, expected.type],
        `text: "${expectedText}"`,
        `text: "${actualText}"`,
        expected,
        actual
      );
    }
  }

  // Recursively compare firstChild chains
  const childPath = [...path, expected.type, "firstChild"];
  const childResult = compareCSNodes(
    expected.firstChild,
    actual.firstChild,
    childPath,
    options
  );
  if (!childResult.equal) {
    return childResult;
  }

  // Recursively compare nextSibling chains
  const siblingPath = [...path, expected.type, "nextSibling"];
  const siblingResult = compareCSNodes(
    expected.nextSibling,
    actual.nextSibling,
    siblingPath,
    options
  );

  return siblingResult;
}

/**
 * Formats a comparison path for human-readable output
 *
 * @param path - The path array from a CompareResult
 * @returns A formatted string representation of the path
 */
export function formatPath(path: string[]): string {
  if (path.length === 0) return "root";

  let result = "";
  for (let i = 0; i < path.length; i++) {
    const segment = path[i];
    if (segment === "firstChild" || segment === "nextSibling") {
      result += `.${segment}`;
    } else {
      if (result.length > 0 && !result.endsWith(".")) {
        result += " -> ";
      }
      result += segment;
    }
  }
  return result;
}

/**
 * Formats a CompareResult for human-readable error messages
 *
 * @param result - The comparison result
 * @returns A formatted error message, or null if comparison was successful
 */
export function formatCompareResult(result: CompareResult): string | null {
  if (result.equal) return null;

  const pathStr = formatPath(result.path ?? []);
  let msg = `Trees differ at: ${pathStr}\n`;
  msg += `  Expected: ${result.expected}\n`;
  msg += `  Actual:   ${result.actual}`;

  // Add position info if available
  if (result.expectedNode?.startOffset !== undefined) {
    msg += `\n  Expected position: ${result.expectedNode.startOffset}-${result.expectedNode.endOffset}`;
  }
  if (result.actualNode?.startOffset !== undefined) {
    msg += `\n  Actual position: ${result.actualNode.startOffset}-${result.actualNode.endOffset}`;
  }

  return msg;
}

/**
 * Asserts that two CSNode trees are equal
 *
 * Throws an error with a descriptive message if the trees differ.
 * Useful in test code.
 *
 * @param expected - The expected CSNode tree
 * @param actual - The actual CSNode tree
 * @param options - Comparison options
 * @throws Error if trees are not equal
 */
export function assertCSNodesEqual(
  expected: CSNode | null,
  actual: CSNode | null,
  options: CompareOptions = {}
): void {
  const result = compareCSNodes(expected, actual, [], options);
  if (!result.equal) {
    const msg = formatCompareResult(result);
    throw new Error(msg ?? "Trees are not equal");
  }
}

/**
 * Counts the total number of nodes in a CSNode tree
 *
 * Useful for debugging and verifying tree structure.
 *
 * @param node - The root of the tree to count
 * @returns The total number of nodes
 */
export function countNodes(node: CSNode | null): number {
  if (node === null) return 0;

  return 1 + countNodes(node.firstChild) + countNodes(node.nextSibling);
}

/**
 * Returns the maximum depth of a CSNode tree
 *
 * @param node - The root of the tree
 * @returns The maximum depth (0 for a single node with no children)
 */
export function treeDepth(node: CSNode | null): number {
  if (node === null) return -1;

  const childDepth = treeDepth(node.firstChild);
  const siblingDepth = treeDepth(node.nextSibling);

  // Child depth adds one level, sibling depth stays at the same level
  return Math.max(childDepth + 1, siblingDepth);
}

/**
 * Collects all node types present in a CSNode tree
 *
 * Useful for debugging and understanding tree structure.
 * Uses context-passing instead of closure to avoid nested functions.
 *
 * @param node - The root of the tree
 * @param types - The Set to collect types into (default: new Set)
 * @returns A Set of all node type names
 */
export function collectNodeTypes(node: CSNode | null, types: Set<string> = new Set<string>()): Set<string> {
  if (node === null) return types;

  types.add(node.type);
  collectNodeTypes(node.firstChild, types);
  collectNodeTypes(node.nextSibling, types);

  return types;
}

/**
 * Serializes a CSNode tree to a human-readable string
 *
 * Useful for debugging and test output.
 *
 * @param node - The root of the tree
 * @param indent - Current indentation level (default: 0)
 * @returns A formatted string representation
 */
export function serializeCSNode(node: CSNode | null, indent: number = 0): string {
  if (node === null) return "(null)";

  const prefix = "  ".repeat(indent);
  let result = `${prefix}${node.type}`;

  if (node.text !== undefined) {
    // Escape special characters for display
    const escapedText = node.text
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r")
      .replace(/\t/g, "\\t");
    result += ` "${escapedText}"`;
  }

  if (node.startOffset !== undefined) {
    result += ` [${node.startOffset}-${node.endOffset}]`;
  }

  result += "\n";

  // Show children with increased indent
  if (node.firstChild) {
    result += serializeCSNode(node.firstChild, indent + 1);
  }

  // Show siblings at the same indent level
  if (node.nextSibling) {
    result += serializeCSNode(node.nextSibling, indent);
  }

  return result;
}
