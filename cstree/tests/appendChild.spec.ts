import { expect } from "chai";
import * as fc from "fast-check";
import { describe, it } from "mocha";
import { createNode, appendChild } from "../src/index";
import { makeCtx, TestTag, type TNode } from "./helpers";

describe("appendChild", () => {
  it("appending to an empty parent sets firstChild", () => {
    const ctx = makeCtx();
    const parent = createNode(TestTag.Root, ctx.generateId(), "r");
    const child = createNode(TestTag.A, ctx.generateId(), "x");
    appendChild(parent, child);

    expect(parent.firstChild).to.equal(child);
    expect(child.parentRef).to.deep.equal({ tag: "firstChild", parent });
    expect(child.nextSibling).to.be.null;
  });

  it("appending to a parent with one child links at the end", () => {
    const ctx = makeCtx();
    const parent = createNode(TestTag.Root, ctx.generateId(), "r");
    const first = createNode(TestTag.A, ctx.generateId(), "x");
    const second = createNode(TestTag.B, ctx.generateId(), "y");
    appendChild(parent, first);
    appendChild(parent, second);

    expect(first.nextSibling).to.equal(second);
    expect(second.parentRef).to.deep.equal({ tag: "sibling", prev: first });
    expect(second.nextSibling).to.be.null;
  });

  it("appending to a parent with three children links after the last", () => {
    const ctx = makeCtx();
    const parent = createNode(TestTag.Root, ctx.generateId(), "r");
    const c1 = createNode(TestTag.A, ctx.generateId(), "1");
    const c2 = createNode(TestTag.B, ctx.generateId(), "2");
    const c3 = createNode(TestTag.C, ctx.generateId(), "3");
    const c4 = createNode(TestTag.D, ctx.generateId(), "4");
    appendChild(parent, c1);
    appendChild(parent, c2);
    appendChild(parent, c3);
    appendChild(parent, c4);

    expect(c3.nextSibling).to.equal(c4);
    expect(c4.parentRef).to.deep.equal({ tag: "sibling", prev: c3 });
    expect(c4.nextSibling).to.be.null;
  });

  it("appending an already-attached node is a no-op", () => {
    const ctx = makeCtx();
    const parent1 = createNode(TestTag.Root, ctx.generateId(), "r1");
    const parent2 = createNode(TestTag.Root, ctx.generateId(), "r2");
    const child = createNode(TestTag.A, ctx.generateId(), "x");
    appendChild(parent1, child);
    appendChild(parent2, child);

    expect(parent1.firstChild).to.equal(child);
    expect(parent2.firstChild).to.be.null;
    expect(child.parentRef).to.deep.equal({ tag: "firstChild", parent: parent1 });
  });

  describe("property-based", () => {
    it("appending N children yields N nodes in insertion order", () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 20 }), (n) => {
          const ctx = makeCtx();
          const parent = createNode(TestTag.Root, ctx.generateId(), "r");
          const ids: number[] = [];
          for (let i = 0; i < n; i++) {
            const child = createNode(TestTag.A, ctx.generateId(), `c${i}`);
            ids.push(child.id);
            appendChild(parent, child);
          }

          const walked: number[] = [];
          let current: TNode | null = parent.firstChild;
          while (current !== null) {
            walked.push(current.id);
            current = current.nextSibling;
          }
          expect(walked).to.deep.equal(ids);
        })
      );
    });

    it("parentRef integrity holds after appending N children", () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 20 }), (n) => {
          const ctx = makeCtx();
          const parent = createNode(TestTag.Root, ctx.generateId(), "r");
          for (let i = 0; i < n; i++) {
            appendChild(parent, createNode(TestTag.A, ctx.generateId(), `c${i}`));
          }

          expect(parent.parentRef).to.be.null;
          const first = parent.firstChild!;
          expect(first.parentRef).to.deep.equal({
            tag: "firstChild",
            parent,
          });

          let prev = first;
          let sib = first.nextSibling;
          while (sib !== null) {
            expect(sib.parentRef).to.deep.equal({
              tag: "sibling",
              prev,
            });
            prev = sib;
            sib = sib.nextSibling;
          }
        })
      );
    });
  });
});
