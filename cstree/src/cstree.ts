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

// ============================================================================
// Visitor Interface
// ============================================================================

/**
 * A handler function for a specific node tag. The handler receives the matched
 * node and a context object that carries both user state and the visitor dispatch
 * table (via ctx.visitor).
 *
 * To recurse into a child, the handler calls visit(child, ctx). Any return
 * values should be stored in the context object.
 *
 * Typical usage patterns:
 * - Iterate node.firstChild chain, calling visit(child, ctx) on each child
 *   to replicate default recursion behavior
 * - Call visit on only specific children for selective traversal
 * - Do not call visit at all to prevent any descent into children
 *
 * Warning: calling visit(node, ctx) on the handler's own node will cause
 * infinite recursion.
 */
export type CSVisitorHandler<T extends string, DM extends Record<T, unknown>, Ctx> = (node: CSNode<T, DM>, ctx: Ctx) => void;

/**
 * A dispatch table mapping tag names to handler functions. Only tags that need
 * custom handling require an entry; all other tags receive default recursion
 * into their children.
 */
export type CSVisitor<T extends string, DM extends Record<T, unknown>, Ctx> = Partial<Record<T, CSVisitorHandler<T, DM, Ctx>>>;

/**
 * Visits a CSTree depth-first, dispatching to the handler found in ctx.visitor
 * for each node's tag. When a handler exists, it receives the node and ctx.
 * When no handler exists, children are visited automatically via default recursion.
 *
 * The context must carry a visitor field containing the dispatch table.
 *
 * We capture nextSibling before recursing so that tree mutations inside
 * handlers do not cause skipped or double-visited siblings.
 */
export function visit<T extends string, DM extends Record<T, unknown>, Ctx extends { visitor: CSVisitor<T, DM, Ctx> }>(root: CSNode<T, DM>, ctx: Ctx): void {
  const handler = ctx.visitor[root.tag as T];
  if (handler) {
    handler(root, ctx);
    return;
  }

  // Default recursion: visit all children
  let child = root.firstChild;
  while (child !== null) {
    const next = child.nextSibling;
    visit(child, ctx);
    child = next;
  }
}

// ============================================================================
// Internal Utilities
// ============================================================================

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
