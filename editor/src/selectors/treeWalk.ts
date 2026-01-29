import { CSNode, isTokenNode, TokenData, getTokenData } from "../csTree/types";

/**
 * Returns the TokenData of the leftmost Token descendant, or null if the node
 * has no Token descendants. Walks depth-first, always preferring firstChild.
 */
export function firstTokenData(node: CSNode): TokenData | null {
  let current: CSNode | null = node;
  while (current !== null) {
    if (isTokenNode(current)) {
      return getTokenData(current);
    }
    current = current.firstChild;
  }
  return null;
}

/**
 * Returns the TokenData of the rightmost Token descendant, or null if the node
 * has no Token descendants. Walks left-to-right recursively, keeping the last
 * token found.
 */
export function lastTokenData(node: CSNode): TokenData | null {
  if (isTokenNode(node)) {
    return getTokenData(node);
  }

  let lastResult: TokenData | null = null;
  let child = node.firstChild;
  while (child !== null) {
    const result = lastTokenData(child);
    if (result !== null) {
      lastResult = result;
    }
    child = child.nextSibling;
  }
  return lastResult;
}

/**
 * Compares two (line, col) positions.
 * Returns negative if a is before b, 0 if equal, positive if a is after b.
 */
export function comparePositions(
  aLine: number, aCol: number,
  bLine: number, bCol: number
): number {
  if (aLine !== bLine) return aLine - bLine;
  return aCol - bCol;
}

interface IdMapCtx {
  map: Map<number, CSNode>;
}

function walkForIdMap(ctx: IdMapCtx, node: CSNode | null): void {
  let current = node;
  while (current !== null) {
    ctx.map.set(current.id, current);
    if (current.firstChild) {
      walkForIdMap(ctx, current.firstChild);
    }
    current = current.nextSibling;
  }
}

/**
 * Walks the tree once and builds a lookup map from node ID to CSNode.
 */
export function buildIdMap(root: CSNode): Map<number, CSNode> {
  const ctx: IdMapCtx = { map: new Map() };
  walkForIdMap(ctx, root);
  return ctx.map;
}

interface FindByIdCtx {
  id: number;
  result: CSNode | null;
}

function walkForFind(ctx: FindByIdCtx, node: CSNode | null): boolean {
  let current = node;
  while (current !== null) {
    if (current.id === ctx.id) {
      ctx.result = current;
      return true;
    }
    if (current.firstChild && walkForFind(ctx, current.firstChild)) {
      return true;
    }
    current = current.nextSibling;
  }
  return false;
}

/**
 * Finds the node with the given ID by depth-first walking from root.
 * Returns null if not found. Use buildIdMap when multiple lookups are needed.
 */
export function findNodeById(root: CSNode, id: number): CSNode | null {
  const ctx: FindByIdCtx = { id, result: null };
  walkForFind(ctx, root);
  return ctx.result;
}
