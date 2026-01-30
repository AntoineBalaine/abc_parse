/**
 * Shared scope utilities for selectors.
 *
 * These functions handle scope constraint logic, allowing selectors to respect
 * input selection boundaries when filtering elements.
 */

import { CSNode } from "../csTree/types";
import { Cursor } from "../selection";
import { findNodeById } from "./treeWalk";

/**
 * Collects all node IDs from all cursor sets into a single Set.
 */
export function collectCursorIds(cursors: Cursor[]): Set<number> {
  const result = new Set<number>();
  for (const cursor of cursors) {
    for (const id of cursor) {
      result.add(id);
    }
  }
  return result;
}

/**
 * Collects all descendant IDs of a node (including the node itself).
 */
export function collectDescendantIds(node: CSNode, result: Set<number>): void {
  result.add(node.id);
  let child = node.firstChild;
  while (child !== null) {
    collectDescendantIds(child, result);
    child = child.nextSibling;
  }
}

/**
 * Expands scopeIds to include all descendants of each node in the set.
 * This ensures that when a parent is selected, all its children are considered in scope.
 */
export function expandScopeToDescendants(root: CSNode, scopeIds: Set<number>): Set<number> {
  const expanded = new Set<number>();
  for (const id of scopeIds) {
    const node = findNodeById(root, id);
    if (node) {
      collectDescendantIds(node, expanded);
    }
  }
  return expanded;
}

/**
 * Returns true if the node's ID is in scopeIds, OR if any descendant's ID is in scopeIds.
 * This ensures that if the user selected specific notes within a Music_code line,
 * that line is considered in scope.
 */
export function hasDescendantInScope(node: CSNode, scopeIds: Set<number>): boolean {
  if (scopeIds.has(node.id)) {
    return true;
  }
  let child = node.firstChild;
  while (child !== null) {
    if (hasDescendantInScope(child, scopeIds)) {
      return true;
    }
    child = child.nextSibling;
  }
  return false;
}

/**
 * Checks if a node is in scope. If there is no scope constraint (hasScope is false),
 * all nodes are considered in scope.
 */
export function isInScope(node: CSNode, scopeIds: Set<number>, hasScope: boolean): boolean {
  if (!hasScope) {
    return true;
  }
  return hasDescendantInScope(node, scopeIds);
}
