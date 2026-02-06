import { CSNode, isTokenNode, TokenData, getTokenData, TAGS } from "../csTree/types";

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

interface FindByTagCtx {
  tag: string;
  result: CSNode[];
}

function walkForTag(ctx: FindByTagCtx, node: CSNode | null): void {
  let current = node;
  while (current !== null) {
    if (current.tag === ctx.tag) {
      ctx.result.push(current);
    }
    if (current.firstChild) {
      walkForTag(ctx, current.firstChild);
    }
    current = current.nextSibling;
  }
}

/**
 * Collects all nodes matching the given tag in the tree rooted at the given node.
 * Walks depth-first, collecting all matches.
 */
export function findByTag(root: CSNode, tag: string): CSNode[] {
  const ctx: FindByTagCtx = { tag, result: [] };
  walkForTag(ctx, root);
  return ctx.result;
}

interface FindFirstByTagCtx {
  tag: string;
  result: CSNode | null;
}

function walkForFirstTag(ctx: FindFirstByTagCtx, node: CSNode | null): boolean {
  let current = node;
  while (current !== null) {
    if (current.tag === ctx.tag) {
      ctx.result = current;
      return true;
    }
    if (current.firstChild && walkForFirstTag(ctx, current.firstChild)) {
      return true;
    }
    current = current.nextSibling;
  }
  return false;
}

/**
 * Finds the first node matching the given tag in the tree rooted at the given node.
 * Returns null if no match is found. Use findByTag when all matches are needed.
 */
export function findFirstByTag(root: CSNode, tag: string): CSNode | null {
  const ctx: FindFirstByTagCtx = { tag, result: null };
  walkForFirstTag(ctx, root);
  return ctx.result;
}

interface FindAncestorCtx {
  targetId: number;
  ancestorTag: string;
  result: CSNode | null;
}

function walkForAncestor(ctx: FindAncestorCtx, node: CSNode | null, ancestors: CSNode[]): boolean {
  let current = node;
  while (current !== null) {
    if (current.id === ctx.targetId) {
      // Found target, search ancestors backwards for matching tag
      for (let i = ancestors.length - 1; i >= 0; i--) {
        if (ancestors[i].tag === ctx.ancestorTag) {
          ctx.result = ancestors[i];
          return true;
        }
      }
      return true; // Found target but no matching ancestor
    }
    if (current.firstChild) {
      ancestors.push(current);
      if (walkForAncestor(ctx, current.firstChild, ancestors)) {
        return true;
      }
      ancestors.pop();
    }
    current = current.nextSibling;
  }
  return false;
}

/**
 * Finds the nearest ancestor of the node with the given ID that has the specified tag.
 * Returns null if the target node is not found or has no ancestor with that tag.
 */
export function findAncestorByTag(root: CSNode, targetId: number, tag: string): CSNode | null {
  const ctx: FindAncestorCtx = { targetId, ancestorTag: tag, result: null };
  walkForAncestor(ctx, root, []);
  return ctx.result;
}
