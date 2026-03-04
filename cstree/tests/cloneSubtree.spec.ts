import { expect } from "chai";
import fc from "fast-check";
import { createNode, appendChild, cloneSubtree, collectChildren, verifyIntegrity } from "../src/index";
import type { CSNode } from "../src/index";
import { makeCtx, TestTag, type TNode } from "./helpers";

describe("cloneSubtree", () => {
  it("clones a leaf node with a different ID", () => {
    const ctx = makeCtx();
    const leaf = createNode(TestTag.A, ctx.generateId(), "data-a");

    const clone = cloneSubtree(leaf, ctx.generateId);
    expect(clone.tag).to.equal(TestTag.A);
    expect(clone.data).to.equal("data-a");
    expect(clone.id).to.not.equal(leaf.id);
    expect(clone.firstChild).to.equal(null);
    expect(clone.nextSibling).to.equal(null);
    expect(clone.parentRef).to.equal(null);
  });

  it("clones a leaf node with the same ID when preserveIds is true", () => {
    const ctx = makeCtx();
    const leaf = createNode(TestTag.A, ctx.generateId(), "data-a");

    const clone = cloneSubtree(leaf, ctx.generateId, true);
    expect(clone.id).to.equal(leaf.id);
    expect(clone.tag).to.equal(TestTag.A);
  });

  it("clones a node with two children and produces valid parentRef pointers", () => {
    const ctx = makeCtx();
    const root = createNode(TestTag.Root, ctx.generateId(), "r");
    const a = createNode(TestTag.A, ctx.generateId(), "child-a");
    const b = createNode(TestTag.B, ctx.generateId(), "child-b");
    appendChild(root, a);
    appendChild(root, b);

    const clone = cloneSubtree(root, ctx.generateId);
    expect(verifyIntegrity(clone)).to.equal(true);

    const children = collectChildren(clone);
    expect(children).to.have.length(2);
    expect(children[0].tag).to.equal(TestTag.A);
    expect(children[1].tag).to.equal(TestTag.B);
  });

  it("clones a deeply nested tree (depth 3) with valid integrity", () => {
    const ctx = makeCtx();
    const root = createNode(TestTag.Root, ctx.generateId(), "r");
    const a = createNode(TestTag.A, ctx.generateId(), "child-a");
    const b = createNode(TestTag.B, ctx.generateId(), "child-b");
    const c = createNode(TestTag.C, ctx.generateId(), "grandchild-c");
    const d = createNode(TestTag.D, ctx.generateId(), "grandchild-d");
    appendChild(root, a);
    appendChild(root, b);
    appendChild(a, c);
    appendChild(a, d);

    const clone = cloneSubtree(root, ctx.generateId);
    expect(verifyIntegrity(clone)).to.equal(true);

    const origNodes = collectAll(root);
    const cloneNodes = collectAll(clone);
    for (const cn of cloneNodes) {
      for (const on of origNodes) {
        expect(cn).to.not.equal(on);
      }
    }
  });

  it("produces a deep copy of data (modifying original does not affect clone)", () => {
    const ctx = makeCtx();
    const root = createNode(TestTag.Root, ctx.generateId(), "mutable");

    const clone = cloneSubtree(root, ctx.generateId);
    expect(clone.data).to.equal(root.data);
    expect(clone).to.not.equal(root);
  });

  it("property: cloneSubtree produces integrity-valid trees", () => {
    fc.assert(
      fc.property(fc.array(fc.nat(), { minLength: 1, maxLength: 15 }), (parentIndices) => {
        const ctx = makeCtx();
        const root = createNode(TestTag.Root, ctx.generateId(), "r");
        const nodes: TNode[] = [root];

        for (const idx of parentIndices) {
          const parent = nodes[idx % nodes.length];
          const child = createNode(TestTag.A, ctx.generateId(), "child");
          appendChild(parent, child);
          nodes.push(child);
        }

        const clone = cloneSubtree(root, ctx.generateId);
        return verifyIntegrity(clone);
      })
    );
  });

  it("property: cloneSubtree with preserveIds preserves all IDs", () => {
    fc.assert(
      fc.property(fc.array(fc.nat(), { minLength: 1, maxLength: 15 }), (parentIndices) => {
        const ctx = makeCtx();
        const root = createNode(TestTag.Root, ctx.generateId(), "r");
        const nodes: TNode[] = [root];

        for (const idx of parentIndices) {
          const parent = nodes[idx % nodes.length];
          const child = createNode(TestTag.A, ctx.generateId(), "child");
          appendChild(parent, child);
          nodes.push(child);
        }

        const clone = cloneSubtree(root, ctx.generateId, true);
        const origIds = collectAll(root).map((n) => n.id);
        const cloneIds = collectAll(clone).map((n) => n.id);
        if (origIds.length !== cloneIds.length) return false;
        for (let i = 0; i < origIds.length; i++) {
          if (origIds[i] !== cloneIds[i]) return false;
        }
        return true;
      })
    );
  });
});

function collectAll<Tag extends string, D>(root: CSNode<Tag, D>): CSNode<Tag, D>[] {
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
