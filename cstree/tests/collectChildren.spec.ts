import { expect } from "chai";
import fc from "fast-check";
import { createNode, appendChild, remove, collectChildren } from "../src/index";
import { makeCtx, TestTag } from "./helpers";

describe("collectChildren", () => {
  it("returns an empty array when the parent has no children", () => {
    const ctx = makeCtx();
    const root = createNode(TestTag.Root, ctx.generateId(), "r");
    expect(collectChildren(root)).to.deep.equal([]);
  });

  it("returns children in sibling order", () => {
    const ctx = makeCtx();
    const root = createNode(TestTag.Root, ctx.generateId(), "r");
    const a = createNode(TestTag.A, ctx.generateId(), "first");
    const b = createNode(TestTag.B, ctx.generateId(), "second");
    const c = createNode(TestTag.C, ctx.generateId(), "third");
    appendChild(root, a);
    appendChild(root, b);
    appendChild(root, c);

    const children = collectChildren(root);
    expect(children).to.have.length(3);
    expect(children[0]).to.equal(a);
    expect(children[1]).to.equal(b);
    expect(children[2]).to.equal(c);
  });

  it("reflects removal of the middle child", () => {
    const ctx = makeCtx();
    const root = createNode(TestTag.Root, ctx.generateId(), "r");
    const a = createNode(TestTag.A, ctx.generateId(), "first");
    const b = createNode(TestTag.B, ctx.generateId(), "second");
    const c = createNode(TestTag.C, ctx.generateId(), "third");
    appendChild(root, a);
    appendChild(root, b);
    appendChild(root, c);

    remove(b);

    const children = collectChildren(root);
    expect(children).to.have.length(2);
    expect(children[0]).to.equal(a);
    expect(children[1]).to.equal(c);
  });

  it("property: collectChildren length equals the number of appended children", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 20 }), (n) => {
        const ctx = makeCtx();
        const root = createNode(TestTag.Root, ctx.generateId(), "r");
        const ids: number[] = [];
        for (let i = 0; i < n; i++) {
          const child = createNode(TestTag.A, ctx.generateId(), `child-${i}`);
          ids.push(child.id);
          appendChild(root, child);
        }
        const children = collectChildren(root);
        if (children.length !== n) return false;
        for (let i = 0; i < n; i++) {
          if (children[i].id !== ids[i]) return false;
        }
        return true;
      })
    );
  });
});
