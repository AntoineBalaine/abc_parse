/**
 * Comparison Framework for ABC Parser Validation
 *
 * This module provides utilities for comparing ASTs from different parsers
 * using a normalized child-sibling tree representation.
 *
 * Usage:
 *
 * ```typescript
 * import { exprToCS, tsToCS, compareCSNodes, formatCompareResult } from './comparison';
 *
 * // Convert both parser outputs to CSNode
 * const csFromExpr = exprToCS(exprAst);
 * const csFromTS = tsToCS(treeSitterTree.rootNode);
 *
 * // Compare the trees
 * const result = compareCSNodes(csFromExpr, csFromTS);
 * if (!result.equal) {
 *   console.error(formatCompareResult(result));
 * }
 * ```
 */

// CSNode type and utilities
export { CSNode, createCSNode, arrayToSiblingChain } from "./CSNode";

// Expr to CSNode conversion
export { exprToCS, tokenToCS } from "./exprToCS";

// TreeSitter to CSNode conversion
export {
  tsToCS,
  treeToCS,
  withCustomMappings,
  SyntaxNode,
  TsToCSOptions,
} from "./tsToCS";

// Comparison algorithm and utilities
export {
  compareCSNodes,
  assertCSNodesEqual,
  formatPath,
  formatCompareResult,
  countNodes,
  treeDepth,
  collectNodeTypes,
  serializeCSNode,
  CompareResult,
  CompareOptions,
} from "./compare";
