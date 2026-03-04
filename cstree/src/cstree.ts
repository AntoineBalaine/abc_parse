export type ParentRef<Tag extends string, D> = { tag: "firstChild"; parent: CSNode<Tag, D> } | { tag: "sibling"; prev: CSNode<Tag, D> } | null;

export interface CSNode<Tag extends string, D> {
  tag: Tag;
  id: number;
  data: D;
  firstChild: CSNode<Tag, D> | null;
  nextSibling: CSNode<Tag, D> | null;
  parentRef: ParentRef<Tag, D>;
}

export function createNode<Tag extends string, D>(tag: Tag, id: number, data: D): CSNode<Tag, D> {
  return {
    tag,
    id,
    data,
    firstChild: null,
    nextSibling: null,
    parentRef: null,
  };
}

export function appendChild<Tag extends string, D>(parent: CSNode<Tag, D>, newNode: CSNode<Tag, D>): void {
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

export function remove<Tag extends string, D>(target: CSNode<Tag, D>): void {
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

export function replace<Tag extends string, D>(target: CSNode<Tag, D>, newNode: CSNode<Tag, D>): void {
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

export function insertBefore<Tag extends string, D>(anchor: CSNode<Tag, D>, newNode: CSNode<Tag, D>): void {
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

export function insertAfter<Tag extends string, D>(anchor: CSNode<Tag, D>, newNode: CSNode<Tag, D>): void {
  if (anchor.parentRef === null) return;
  if (newNode.parentRef !== null) return;

  newNode.nextSibling = anchor.nextSibling;
  if (anchor.nextSibling) {
    anchor.nextSibling.parentRef = { tag: "sibling", prev: newNode };
  }

  anchor.nextSibling = newNode;
  newNode.parentRef = { tag: "sibling", prev: anchor };
}

export function getParent<Tag extends string, D>(node: CSNode<Tag, D>): CSNode<Tag, D> | null {
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

export function verifyIntegrity<Tag extends string, D>(root: CSNode<Tag, D>): boolean {
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

export function findChild<Tag extends string, D>(parent: CSNode<Tag, D>, predicate: (node: CSNode<Tag, D>) => boolean): CSNode<Tag, D> | null {
  let current = parent.firstChild;
  while (current !== null) {
    if (predicate(current)) return current;
    current = current.nextSibling;
  }
  return null;
}

export function collectChildren<Tag extends string, D>(parent: CSNode<Tag, D>): CSNode<Tag, D>[] {
  const result: CSNode<Tag, D>[] = [];
  let current = parent.firstChild;
  while (current !== null) {
    result.push(current);
    current = current.nextSibling;
  }
  return result;
}

export function cloneSubtree<Tag extends string, D>(node: CSNode<Tag, D>, generateId: () => number, preserveIds: boolean = false): CSNode<Tag, D> {
  const id = preserveIds ? node.id : generateId();
  const clone = createNode(node.tag, id, structuredClone(node.data));
  let child = node.firstChild;
  while (child !== null) {
    const clonedChild = cloneSubtree(child, generateId, preserveIds);
    appendChild(clone, clonedChild);
    child = child.nextSibling;
  }
  return clone;
}

function preOrder<Tag extends string, D>(root: CSNode<Tag, D>): CSNode<Tag, D>[] {
  const result: CSNode<Tag, D>[] = [];
  const stack: CSNode<Tag, D>[] = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    result.push(node);
    const children: CSNode<Tag, D>[] = [];
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
