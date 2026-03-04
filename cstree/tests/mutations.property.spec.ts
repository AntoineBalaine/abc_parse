import { expect } from "chai";
import * as fc from "fast-check";
import { describe, it } from "mocha";
import { createNode, appendChild, remove, replace, insertBefore, insertAfter, verifyIntegrity } from "../src/index";
import { makeCtx, TestTag, type TNode } from "./helpers";

function collectReachable(root: TNode): TNode[] {
  const result: TNode[] = [];
  const stack: TNode[] = [root];
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

const opArb = fc.record({
  op: fc.integer({ min: 0, max: 4 }),
  index: fc.integer({ min: 0, max: 999 }),
});

describe("mutations property tests", () => {
  it("random operation sequences maintain integrity", () => {
    fc.assert(
      fc.property(fc.array(opArb, { minLength: 10, maxLength: 50 }), (ops) => {
        const ctx = makeCtx();
        const root = createNode(TestTag.Root, ctx.generateId(), "r");
        for (let i = 0; i < 3; i++) {
          appendChild(root, createNode(TestTag.A, ctx.generateId(), `seed${i}`));
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

  it("remove then re-insert preserves node count", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 10 }),
        fc.integer({ min: 0, max: 2 }),
        fc.integer({ min: 0, max: 999 }),
        fc.integer({ min: 0, max: 999 }),
        (childCount, insertStrategy, removeIndex, insertIndex) => {
          const ctx = makeCtx();
          const root = createNode(TestTag.Root, ctx.generateId(), "r");
          for (let i = 0; i < childCount; i++) {
            appendChild(root, createNode(TestTag.A, ctx.generateId(), `c${i}`));
          }

          const before = collectReachable(root).length;
          const reachable = collectReachable(root);
          const nonRoot = reachable.filter((n) => n.parentRef !== null);
          const target = nonRoot[removeIndex % nonRoot.length];

          const subtreeSize = collectReachable(target).length;

          remove(target);

          const afterRemove = collectReachable(root);
          expect(afterRemove.length).to.equal(before - subtreeSize);

          const afterReachable = collectReachable(root);
          if (insertStrategy === 0) {
            const parent = afterReachable[insertIndex % afterReachable.length];
            appendChild(parent, target);
          } else if (insertStrategy === 1) {
            const nonRootAfter = afterReachable.filter((n) => n.parentRef !== null);
            if (nonRootAfter.length > 0) {
              const anchor = nonRootAfter[insertIndex % nonRootAfter.length];
              insertBefore(anchor, target);
            } else {
              appendChild(root, target);
            }
          } else {
            const nonRootAfter = afterReachable.filter((n) => n.parentRef !== null);
            if (nonRootAfter.length > 0) {
              const anchor = nonRootAfter[insertIndex % nonRootAfter.length];
              insertAfter(anchor, target);
            } else {
              appendChild(root, target);
            }
          }

          const afterInsert = collectReachable(root);
          expect(afterInsert.length).to.equal(before);
          expect(verifyIntegrity(root)).to.be.true;
        }
      )
    );
  });
});
