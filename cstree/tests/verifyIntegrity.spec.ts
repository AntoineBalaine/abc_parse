import { expect } from "chai";
import * as fc from "fast-check";
import { describe, it } from "mocha";
import { appendChild, remove, replace, insertBefore, insertAfter, verifyIntegrity } from "../src/cstree";
import { createNode, makeCtx, TestTag, type TNode } from "./helpers";

describe("verifyIntegrity", () => {
  it("passes for a single root node", () => {
    const ctx = makeCtx();
    const root = createNode(TestTag.Root, ctx.generateId(), "r");
    expect(verifyIntegrity(root)).to.be.true;
  });

  it("passes for a tree built with appendChild", () => {
    const ctx = makeCtx();
    const root = createNode(TestTag.Root, ctx.generateId(), "r");
    const c1 = createNode(TestTag.A, ctx.generateId(), "1");
    const c2 = createNode(TestTag.B, ctx.generateId(), "2");
    const c3 = createNode(TestTag.C, ctx.generateId(), "3");
    appendChild(root, c1);
    appendChild(root, c2);
    appendChild(c1, c3);

    expect(verifyIntegrity(root)).to.be.true;
  });

  it("fails when a firstChild has a sibling parentRef", () => {
    const ctx = makeCtx();
    const root = createNode(TestTag.Root, ctx.generateId(), "r");
    const child = createNode(TestTag.A, ctx.generateId(), "x");
    appendChild(root, child);

    child.parentRef = { tag: "sibling", prev: root };

    expect(verifyIntegrity(root)).to.be.false;
  });

  it("fails when a sibling parentRef points to the wrong node", () => {
    const ctx = makeCtx();
    const root = createNode(TestTag.Root, ctx.generateId(), "r");
    const c1 = createNode(TestTag.A, ctx.generateId(), "1");
    const c2 = createNode(TestTag.B, ctx.generateId(), "2");
    appendChild(root, c1);
    appendChild(root, c2);

    c2.parentRef = { tag: "sibling", prev: root };

    expect(verifyIntegrity(root)).to.be.false;
  });

  it("fails when a firstChild parentRef points to the wrong parent", () => {
    const ctx = makeCtx();
    const root = createNode(TestTag.Root, ctx.generateId(), "r");
    const other = createNode(TestTag.Root, ctx.generateId(), "other");
    const child = createNode(TestTag.A, ctx.generateId(), "x");
    appendChild(root, child);

    child.parentRef = { tag: "firstChild", parent: other };

    expect(verifyIntegrity(root)).to.be.false;
  });

  describe("property-based", () => {
    const opArb = fc.record({
      op: fc.integer({ min: 0, max: 4 }),
      index: fc.integer({ min: 0, max: 999 }),
    });

    it("passes for trees built through random library operations", () => {
      fc.assert(
        fc.property(fc.array(opArb, { minLength: 5, maxLength: 30 }), (ops) => {
          const ctx = makeCtx();
          const root = createNode(TestTag.Root, ctx.generateId(), "r");

          function collectReachable(r: TNode): TNode[] {
            const result: TNode[] = [];
            const stack: TNode[] = [r];
            while (stack.length > 0) {
              const node = stack.pop()!;
              result.push(node);
              let child = node.firstChild;
              while (child !== null) {
                stack.push(child);
                child = child.nextSibling;
              }
            }
            return result;
          }

          for (let i = 0; i < ops.length; i++) {
            const reachable = collectReachable(root);
            const nonRoot = reachable.filter((n) => n.parentRef !== null);
            const { op, index } = ops[i];

            if (op === 0 || nonRoot.length === 0) {
              const parent = reachable[index % reachable.length];
              appendChild(parent, createNode(TestTag.A, ctx.generateId(), `op${i}`));
            } else if (op === 1) {
              const target = nonRoot[index % nonRoot.length];
              remove(target);
            } else if (op === 2) {
              const target = nonRoot[index % nonRoot.length];
              replace(target, createNode(TestTag.A, ctx.generateId(), `op${i}`));
            } else if (op === 3) {
              const anchor = nonRoot[index % nonRoot.length];
              insertBefore(anchor, createNode(TestTag.A, ctx.generateId(), `op${i}`));
            } else {
              const anchor = nonRoot[index % nonRoot.length];
              insertAfter(anchor, createNode(TestTag.A, ctx.generateId(), `op${i}`));
            }

            if (!verifyIntegrity(root)) return false;
          }
          return true;
        })
      );
    });
  });
});
