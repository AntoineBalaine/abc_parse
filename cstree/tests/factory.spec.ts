import { expect } from "chai";
import * as fc from "fast-check";
import { describe, it } from "mocha";
import { createNode } from "../src/index";
import { makeCtx, TestTag } from "./helpers";

describe("createNode", () => {
  it("returns a node with the correct tag, data, and id", () => {
    const ctx = makeCtx();
    const node = createNode(TestTag.A, ctx.generateId(), "hello");
    expect(node.tag).to.equal(TestTag.A);
    expect(node.data).to.equal("hello");
    expect(node.id).to.equal(0);
  });

  it("returns a node with null pointers", () => {
    const ctx = makeCtx();
    const node = createNode(TestTag.Root, ctx.generateId(), "r");
    expect(node.firstChild).to.be.null;
    expect(node.nextSibling).to.be.null;
    expect(node.parentRef).to.be.null;
  });

  it("assigns incrementing IDs across consecutive calls", () => {
    const ctx = makeCtx();
    const n1 = createNode(TestTag.A, ctx.generateId(), "x");
    const n2 = createNode(TestTag.B, ctx.generateId(), "y");
    expect(n1.id).to.not.equal(n2.id);
    expect(n2.id).to.equal(n1.id + 1);
  });

  it("uses a specific ID when provided directly", () => {
    const node = createNode(TestTag.A, 42, "x");
    expect(node.id).to.equal(42);
  });

  describe("property: unique IDs", () => {
    it("all IDs are unique for any sequence of createNode calls", () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100 }), (n) => {
          const ctx = makeCtx();
          const ids = new Set<number>();
          for (let i = 0; i < n; i++) {
            const node = createNode(TestTag.A, ctx.generateId(), `node-${i}`);
            ids.add(node.id);
          }
          return ids.size === n;
        })
      );
    });
  });
});
