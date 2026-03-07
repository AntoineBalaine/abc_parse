import { expect } from "chai";
import { describe, it } from "mocha";
import { appendChild, insertAfter } from "../src/cstree";
import { createNode, makeCtx, TestTag } from "./helpers";

describe("insertAfter", () => {
  it("inserts after a middle child", () => {
    const ctx = makeCtx();
    const parent = createNode(TestTag.Root, ctx.generateId(), "r");
    const c1 = createNode(TestTag.A, ctx.generateId(), "1");
    const c2 = createNode(TestTag.B, ctx.generateId(), "2");
    const newNode = createNode(TestTag.C, ctx.generateId(), "new");
    appendChild(parent, c1);
    appendChild(parent, c2);

    insertAfter(c1, newNode);

    expect(c1.nextSibling).to.equal(newNode);
    expect(newNode.parentRef).to.deep.equal({ tag: "sibling", prev: c1 });
    expect(newNode.nextSibling).to.equal(c2);
    expect(c2.parentRef).to.deep.equal({ tag: "sibling", prev: newNode });
  });

  it("inserts after the last child", () => {
    const ctx = makeCtx();
    const parent = createNode(TestTag.Root, ctx.generateId(), "r");
    const c1 = createNode(TestTag.A, ctx.generateId(), "1");
    const newNode = createNode(TestTag.B, ctx.generateId(), "new");
    appendChild(parent, c1);

    insertAfter(c1, newNode);

    expect(c1.nextSibling).to.equal(newNode);
    expect(newNode.nextSibling).to.be.null;
    expect(newNode.parentRef).to.deep.equal({ tag: "sibling", prev: c1 });
  });

  it("no-ops on root (null parentRef)", () => {
    const ctx = makeCtx();
    const root = createNode(TestTag.Root, ctx.generateId(), "r");
    const newNode = createNode(TestTag.A, ctx.generateId(), "new");

    insertAfter(root, newNode);

    expect(newNode.parentRef).to.be.null;
    expect(root.nextSibling).to.be.null;
  });

  it("no-ops when newNode is already attached", () => {
    const ctx = makeCtx();
    const parent = createNode(TestTag.Root, ctx.generateId(), "r");
    const c1 = createNode(TestTag.A, ctx.generateId(), "1");
    const c2 = createNode(TestTag.B, ctx.generateId(), "2");
    appendChild(parent, c1);
    appendChild(parent, c2);

    insertAfter(c1, c2);

    expect(c1.nextSibling).to.equal(c2);
    expect(c2.nextSibling).to.be.null;
  });

  it("inserting a node after itself is a no-op", () => {
    const ctx = makeCtx();
    const parent = createNode(TestTag.Root, ctx.generateId(), "r");
    const child = createNode(TestTag.A, ctx.generateId(), "x");
    appendChild(parent, child);

    insertAfter(child, child);

    expect(parent.firstChild).to.equal(child);
    expect(child.nextSibling).to.be.null;
    expect(child.parentRef).to.deep.equal({ tag: "firstChild", parent });
  });
});
