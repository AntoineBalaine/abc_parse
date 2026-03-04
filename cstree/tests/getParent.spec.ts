import { expect } from "chai";
import * as fc from "fast-check";
import { describe, it } from "mocha";
import { createNode, appendChild, getParent } from "../src/index";
import { makeCtx, TestTag, type TNode } from "./helpers";

describe("getParent", () => {
  it("returns null for root", () => {
    const ctx = makeCtx();
    const root = createNode(TestTag.Root, ctx.generateId(), "r");
    expect(getParent(root)).to.be.null;
  });

  it("returns parent for first child", () => {
    const ctx = makeCtx();
    const parent = createNode(TestTag.Root, ctx.generateId(), "r");
    const child = createNode(TestTag.A, ctx.generateId(), "x");
    appendChild(parent, child);

    expect(getParent(child)).to.equal(parent);
  });

  it("returns parent for second child", () => {
    const ctx = makeCtx();
    const parent = createNode(TestTag.Root, ctx.generateId(), "r");
    const c1 = createNode(TestTag.A, ctx.generateId(), "1");
    const c2 = createNode(TestTag.B, ctx.generateId(), "2");
    appendChild(parent, c1);
    appendChild(parent, c2);

    expect(getParent(c2)).to.equal(parent);
  });

  it("returns parent for fourth child", () => {
    const ctx = makeCtx();
    const parent = createNode(TestTag.Root, ctx.generateId(), "r");
    const children = [
      createNode(TestTag.A, ctx.generateId(), "1"),
      createNode(TestTag.B, ctx.generateId(), "2"),
      createNode(TestTag.C, ctx.generateId(), "3"),
      createNode(TestTag.D, ctx.generateId(), "4"),
    ];
    children.forEach((c) => appendChild(parent, c));

    expect(getParent(children[3])).to.equal(parent);
  });

  it("works on a two-level tree", () => {
    const ctx = makeCtx();
    const root = createNode(TestTag.Root, ctx.generateId(), "r");
    const a = createNode(TestTag.A, ctx.generateId(), "a");
    const b = createNode(TestTag.B, ctx.generateId(), "b");
    appendChild(root, a);
    appendChild(a, b);

    expect(getParent(b)).to.equal(a);
    expect(getParent(a)).to.equal(root);
  });

  describe("property-based", () => {
    it("agrees with a naive parent lookup on random trees", () => {
      fc.assert(
        fc.property(fc.integer({ min: 2, max: 15 }), fc.integer({ min: 1, max: 4 }), (width, depth) => {
          const ctx = makeCtx();
          const root = createNode(TestTag.Root, ctx.generateId(), "r");
          const allNodes: TNode[] = [root];

          let parents = [root];
          for (let d = 0; d < depth; d++) {
            const nextParents: TNode[] = [];
            for (const p of parents) {
              const childCount = Math.min(width, 5);
              for (let i = 0; i < childCount; i++) {
                const child = createNode(TestTag.A, ctx.generateId(), `d${d}c${i}`);
                appendChild(p, child);
                allNodes.push(child);
                nextParents.push(child);
              }
            }
            parents = nextParents;
          }

          function naiveParent(target: TNode): TNode | null {
            function walk(node: TNode): TNode | null {
              let child = node.firstChild;
              while (child !== null) {
                if (child === target) return node;
                const found = walk(child);
                if (found !== null) return found;
                child = child.nextSibling;
              }
              return null;
            }
            return walk(root);
          }

          for (const node of allNodes) {
            const expected = naiveParent(node);
            const actual = getParent(node);
            if (expected !== actual) return false;
          }
          return true;
        })
      );
    });
  });
});
