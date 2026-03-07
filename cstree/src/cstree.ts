/**
 * A single variant of the node union, parameterized by one specific tag K.
 * createNode returns this type so that TypeScript can verify the literal
 * object without a cast. CSNodeOf<K> is assignable to CSNode (the full
 * union) when K is a literal tag value.
 */
export interface CSNodeOf<K extends string, AllTags extends string, DM extends Record<AllTags, unknown>> {
  tag: K;
  id: number;
  data: DM[K & AllTags];
  firstChild: CSNode<AllTags, DM> | null;
  nextSibling: CSNode<AllTags, DM> | null;
  parentRef: ParentRef<AllTags, DM>;
}

/**
 * The full distributive union of all node variants. Because this type is
 * produced by mapping over every tag and indexing into the result, checking
 * node.tag narrows node.data to the corresponding data type.
 */
export type CSNode<T extends string, DM extends Record<T, unknown>> = {
  [K in T]: CSNodeOf<K, T, DM>;
}[T];

export type ParentRef<T extends string, DM extends Record<T, unknown>> =
  | { tag: "firstChild"; parent: CSNode<T, DM> }
  | { tag: "sibling"; prev: CSNode<T, DM> }
  | null;

export function createNode<T extends string, DM extends Record<T, unknown>, K extends T>(tag: K, id: number, data: DM[K]): CSNodeOf<K, T, DM> {
  return {
    tag,
    id,
    data,
    firstChild: null,
    nextSibling: null,
    parentRef: null,
  };
}

export function appendChild<T extends string, DM extends Record<T, unknown>>(parent: CSNode<T, DM>, newNode: CSNode<T, DM>): void {
  if (newNode.parentRef !== null) return;

  if (parent.firstChild === null) {
    parent.firstChild = newNode;
    newNode.parentRef = { tag: "firstChild", parent };
  } else {
    let last = parent.firstChild;
    while (last.nextSibling !== null) {
      last = last.nextSibling;
    }
    last.nextSibling = newNode;
    newNode.parentRef = { tag: "sibling", prev: last };
  }
  newNode.nextSibling = null;
}

export function remove<T extends string, DM extends Record<T, unknown>>(target: CSNode<T, DM>): void {
  const ref = target.parentRef;
  if (ref === null) return;

  if (ref.tag === "firstChild") {
    ref.parent.firstChild = target.nextSibling;
    if (target.nextSibling) {
      target.nextSibling.parentRef = {
        tag: "firstChild",
        parent: ref.parent,
      };
    }
  } else {
    ref.prev.nextSibling = target.nextSibling;
    if (target.nextSibling) {
      target.nextSibling.parentRef = { tag: "sibling", prev: ref.prev };
    }
  }
  target.parentRef = null;
  target.nextSibling = null;
}

export function replace<T extends string, DM extends Record<T, unknown>>(target: CSNode<T, DM>, newNode: CSNode<T, DM>): void {
  const ref = target.parentRef;
  if (ref === null) return;
  if (newNode.parentRef !== null) return;

  if (ref.tag === "firstChild") {
    ref.parent.firstChild = newNode;
    newNode.parentRef = { tag: "firstChild", parent: ref.parent };
  } else {
    ref.prev.nextSibling = newNode;
    newNode.parentRef = { tag: "sibling", prev: ref.prev };
  }

  newNode.nextSibling = target.nextSibling;
  if (target.nextSibling) {
    target.nextSibling.parentRef = { tag: "sibling", prev: newNode };
  }

  target.parentRef = null;
  target.nextSibling = null;
}

export function insertBefore<T extends string, DM extends Record<T, unknown>>(anchor: CSNode<T, DM>, newNode: CSNode<T, DM>): void {
  const ref = anchor.parentRef;
  if (ref === null) return;
  if (newNode.parentRef !== null) return;

  if (ref.tag === "firstChild") {
    ref.parent.firstChild = newNode;
    newNode.parentRef = { tag: "firstChild", parent: ref.parent };
  } else {
    ref.prev.nextSibling = newNode;
    newNode.parentRef = { tag: "sibling", prev: ref.prev };
  }

  newNode.nextSibling = anchor;
  anchor.parentRef = { tag: "sibling", prev: newNode };
}

export function insertAfter<T extends string, DM extends Record<T, unknown>>(anchor: CSNode<T, DM>, newNode: CSNode<T, DM>): void {
  if (anchor.parentRef === null) return;
  if (newNode.parentRef !== null) return;

  newNode.nextSibling = anchor.nextSibling;
  if (anchor.nextSibling) {
    anchor.nextSibling.parentRef = { tag: "sibling", prev: newNode };
  }

  anchor.nextSibling = newNode;
  newNode.parentRef = { tag: "sibling", prev: anchor };
}

export function getParent<T extends string, DM extends Record<T, unknown>>(node: CSNode<T, DM>): CSNode<T, DM> | null {
  if (node.parentRef === null) return null;

  if (node.parentRef.tag === "firstChild") {
    return node.parentRef.parent;
  }

  let current = node.parentRef.prev;
  while (current.parentRef !== null && current.parentRef.tag === "sibling") {
    current = current.parentRef.prev;
  }
  return current.parentRef?.parent ?? null;
}

export function verifyIntegrity<T extends string, DM extends Record<T, unknown>>(root: CSNode<T, DM>): boolean {
  if (root.parentRef !== null) return false;

  for (const node of preOrder(root)) {
    const child = node.firstChild;
    if (child !== null) {
      if (child.parentRef === null) return false;
      if (child.parentRef.tag !== "firstChild") return false;
      if (child.parentRef.parent !== node) return false;

      let prev = child;
      let sib = child.nextSibling;
      while (sib !== null) {
        if (sib.parentRef === null) return false;
        if (sib.parentRef.tag !== "sibling") return false;
        if (sib.parentRef.prev !== prev) return false;
        prev = sib;
        sib = sib.nextSibling;
      }
    }
  }
  return true;
}

export function findChild<T extends string, DM extends Record<T, unknown>>(
  parent: CSNode<T, DM>,
  predicate: (node: CSNode<T, DM>) => boolean
): CSNode<T, DM> | null {
  let current = parent.firstChild;
  while (current !== null) {
    if (predicate(current)) return current;
    current = current.nextSibling;
  }
  return null;
}

export function collectChildren<T extends string, DM extends Record<T, unknown>>(parent: CSNode<T, DM>): CSNode<T, DM>[] {
  const result: CSNode<T, DM>[] = [];
  let current = parent.firstChild;
  while (current !== null) {
    result.push(current);
    current = current.nextSibling;
  }
  return result;
}

export function cloneSubtree<T extends string, DM extends Record<T, unknown>>(
  node: CSNode<T, DM>,
  generateId: () => number,
  preserveIds: boolean = false
): CSNode<T, DM> {
  const id = preserveIds ? node.id : generateId();
  const clone = createNode<T, DM, T>(node.tag, id, structuredClone(node.data));
  let child = node.firstChild;
  while (child !== null) {
    const clonedChild = cloneSubtree(child, generateId, preserveIds);
    appendChild(clone, clonedChild);
    child = child.nextSibling;
  }
  return clone;
}

function preOrder<T extends string, DM extends Record<T, unknown>>(root: CSNode<T, DM>): CSNode<T, DM>[] {
  const result: CSNode<T, DM>[] = [];
  const stack: CSNode<T, DM>[] = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    result.push(node);
    const children: CSNode<T, DM>[] = [];
    let child = node.firstChild;
    while (child !== null) {
      children.push(child);
      child = child.nextSibling;
    }
    for (let i = children.length - 1; i >= 0; i--) {
      stack.push(children[i]);
    }
  }
  return result;
}
