/**
 * CSNode - Child-Sibling Node representation
 *
 * A normalized tree structure used for comparing ASTs from different parsers.
 * The child-sibling representation converts an N-ary tree into a binary tree
 * where firstChild points to the first child and nextSibling points to the
 * next sibling at the same level.
 *
 * This format allows comparing trees from:
 * - The TypeScript Expr AST (Expr2.ts)
 * - The TreeSitter SyntaxNode tree
 */
export interface CSNode {
  /** The node type name (e.g., "Note", "Pitch", "Chord") */
  type: string;

  /** For leaf nodes (tokens), the text content */
  text?: string;

  /** Pointer to the first child node (null if no children) */
  firstChild: CSNode | null;

  /** Pointer to the next sibling node (null if last sibling) */
  nextSibling: CSNode | null;

  /** Start byte offset in source (for debugging comparison failures) */
  startOffset?: number;

  /** End byte offset in source (for debugging comparison failures) */
  endOffset?: number;
}

/**
 * Creates a CSNode with the given properties
 */
export function createCSNode(
  type: string,
  options: {
    text?: string;
    firstChild?: CSNode | null;
    nextSibling?: CSNode | null;
    startOffset?: number;
    endOffset?: number;
  } = {}
): CSNode {
  return {
    type,
    text: options.text,
    firstChild: options.firstChild ?? null,
    nextSibling: options.nextSibling ?? null,
    startOffset: options.startOffset,
    endOffset: options.endOffset,
  };
}

/**
 * Converts an array of CSNodes into a firstChild/nextSibling chain.
 * Returns the first node in the chain, or null if the array is empty.
 *
 * Example: [A, B, C] becomes A -> B -> C (via nextSibling)
 */
export function arrayToSiblingChain(nodes: CSNode[]): CSNode | null {
  if (nodes.length === 0) return null;

  for (let i = 0; i < nodes.length - 1; i++) {
    nodes[i].nextSibling = nodes[i + 1];
  }

  return nodes[0];
}
