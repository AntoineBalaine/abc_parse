import { CSNode, TAGS, isTokenNode, getTokenData } from "../csTree/types";
import { TT } from "abc-parser";

export function findChildByTag(parent: CSNode, tag: string): { node: CSNode; prev: CSNode | null } | null {
  let prev: CSNode | null = null;
  let current = parent.firstChild;
  while (current !== null) {
    if (current.tag === tag) {
      return { node: current, prev };
    }
    prev = current;
    current = current.nextSibling;
  }
  return null;
}

export function removeChild(parent: CSNode, prev: CSNode | null, child: CSNode): void {
  if (prev === null) {
    parent.firstChild = child.nextSibling;
  } else {
    prev.nextSibling = child.nextSibling;
  }
  child.nextSibling = null;
}

export function replaceChild(parent: CSNode, prev: CSNode | null, oldChild: CSNode, newChild: CSNode): void {
  newChild.nextSibling = oldChild.nextSibling;
  if (prev === null) {
    parent.firstChild = newChild;
  } else {
    prev.nextSibling = newChild;
  }
  oldChild.nextSibling = null;
}

export function insertBefore(parent: CSNode, prev: CSNode | null, beforeNode: CSNode, newChild: CSNode): void {
  newChild.nextSibling = beforeNode;
  if (prev === null) {
    parent.firstChild = newChild;
  } else {
    prev.nextSibling = newChild;
  }
}

export function appendChild(parent: CSNode, newChild: CSNode): void {
  newChild.nextSibling = null;
  if (parent.firstChild === null) {
    parent.firstChild = newChild;
    return;
  }
  let current = parent.firstChild;
  while (current.nextSibling !== null) {
    current = current.nextSibling;
  }
  current.nextSibling = newChild;
}

export function collectChildren(node: CSNode): CSNode[] {
  const result: CSNode[] = [];
  let current = node.firstChild;
  while (current !== null) {
    result.push(current);
    current = current.nextSibling;
  }
  return result;
}

export function findParent(root: CSNode, target: CSNode): { parent: CSNode; prev: CSNode | null } | null {
  return findParentWalk(root, target);
}

function findParentWalk(node: CSNode, target: CSNode): { parent: CSNode; prev: CSNode | null } | null {
  let prev: CSNode | null = null;
  let current = node.firstChild;
  while (current !== null) {
    if (current === target) {
      return { parent: node, prev };
    }
    const result = findParentWalk(current, target);
    if (result !== null) {
      return result;
    }
    prev = current;
    current = current.nextSibling;
  }
  return null;
}

export function findRhythmChild(parent: CSNode): { node: CSNode; prev: CSNode | null } | null {
  return findChildByTag(parent, TAGS.Rhythm);
}

export function findTieChild(parent: CSNode): { node: CSNode; prev: CSNode | null } | null {
  let prev: CSNode | null = null;
  let current = parent.firstChild;
  while (current !== null) {
    if (isTokenNode(current) && getTokenData(current).tokenType === TT.TIE) {
      return { node: current, prev };
    }
    prev = current;
    current = current.nextSibling;
  }
  return null;
}

/**
 * Replaces a single node with a sequence of nodes.
 * This is useful when one node needs to be expanded into multiple nodes
 * (e.g., expanding a multi-measure rest into multiple bars of slashes).
 */
export function replaceNodeWithSequence(
  parent: CSNode,
  prev: CSNode | null,
  oldNode: CSNode,
  newNodes: CSNode[]
): void {
  if (newNodes.length === 0) {
    removeChild(parent, prev, oldNode);
    return;
  }

  // Link new nodes together
  for (let i = 0; i < newNodes.length - 1; i++) {
    newNodes[i].nextSibling = newNodes[i + 1];
  }
  newNodes[newNodes.length - 1].nextSibling = oldNode.nextSibling;

  // Insert first new node where old node was
  if (prev === null) {
    parent.firstChild = newNodes[0];
  } else {
    prev.nextSibling = newNodes[0];
  }

  oldNode.nextSibling = null;
}

/**
 * Inserts a node after another node in the sibling list.
 * If afterNode is null, the new node is prepended to the child list.
 */
export function insertAfter(parent: CSNode, afterNode: CSNode | null, newChild: CSNode): void {
  if (afterNode === null) {
    newChild.nextSibling = parent.firstChild;
    parent.firstChild = newChild;
    return;
  }
  newChild.nextSibling = afterNode.nextSibling;
  afterNode.nextSibling = newChild;
}

export function replaceRhythm(parent: CSNode, newRhythm: CSNode | null): void {
  const existing = findRhythmChild(parent);
  if (existing) {
    if (newRhythm) {
      replaceChild(parent, existing.prev, existing.node, newRhythm);
    } else {
      removeChild(parent, existing.prev, existing.node);
    }
    return;
  }

  // No existing rhythm. If newRhythm is null, nothing to do.
  if (newRhythm === null) return;

  // Insert before Tie token (if present) or at end.
  let prev: CSNode | null = null;
  let current = parent.firstChild;
  while (current !== null) {
    if (isTokenNode(current) && getTokenData(current).tokenType === TT.TIE) {
      insertBefore(parent, prev, current, newRhythm);
      return;
    }
    prev = current;
    current = current.nextSibling;
  }

  // No Tie found: append at end.
  appendChild(parent, newRhythm);
}
