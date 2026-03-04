import { expect } from "chai";
import { describe, it } from "mocha";
import { createNode, appendChild, replace } from "../src/index";
import { makeCtx, TestTag } from "./helpers";

describe("replace", () => {
  it("replaces the first child", () => {
    const ctx = makeCtx();
    const parent = createNode(TestTag.Root, ctx.generateId(), "r");
    const c1 = createNode(TestTag.A, ctx.generateId(), "1");
    const c2 = createNode(TestTag.B, ctx.generateId(), "2");
    const newNode = createNode(TestTag.C, ctx.generateId(), "new");
    appendChild(parent, c1);
    appendChild(parent, c2);

    replace(c1, newNode);

    expect(parent.firstChild).to.equal(newNode);
    expect(newNode.parentRef).to.deep.equal({ tag: "firstChild", parent });
    expect(newNode.nextSibling).to.equal(c2);
    expect(c2.parentRef).to.deep.equal({ tag: "sibling", prev: newNode });
  });

  it("replaces a middle child", () => {
    const ctx = makeCtx();
    const parent = createNode(TestTag.Root, ctx.generateId(), "r");
    const c1 = createNode(TestTag.A, ctx.generateId(), "1");
    const c2 = createNode(TestTag.B, ctx.generateId(), "2");
    const c3 = createNode(TestTag.C, ctx.generateId(), "3");
    const newNode = createNode(TestTag.D, ctx.generateId(), "new");
    appendChild(parent, c1);
    appendChild(parent, c2);
    appendChild(parent, c3);

    replace(c2, newNode);

    expect(c1.nextSibling).to.equal(newNode);
    expect(newNode.parentRef).to.deep.equal({ tag: "sibling", prev: c1 });
    expect(newNode.nextSibling).to.equal(c3);
    expect(c3.parentRef).to.deep.equal({ tag: "sibling", prev: newNode });
  });

  it("replaces the last child", () => {
    const ctx = makeCtx();
    const parent = createNode(TestTag.Root, ctx.generateId(), "r");
    const c1 = createNode(TestTag.A, ctx.generateId(), "1");
    const c2 = createNode(TestTag.B, ctx.generateId(), "2");
    const newNode = createNode(TestTag.C, ctx.generateId(), "new");
    appendChild(parent, c1);
    appendChild(parent, c2);

    replace(c2, newNode);

    expect(newNode.nextSibling).to.be.null;
  });

  it("no-ops on root", () => {
    const ctx = makeCtx();
    const root = createNode(TestTag.Root, ctx.generateId(), "r");
    const newNode = createNode(TestTag.A, ctx.generateId(), "new");

    replace(root, newNode);

    expect(root.parentRef).to.be.null;
  });

  it("no-ops when newNode is already attached", () => {
    const ctx = makeCtx();
    const parent = createNode(TestTag.Root, ctx.generateId(), "r");
    const c1 = createNode(TestTag.A, ctx.generateId(), "1");
    const c2 = createNode(TestTag.B, ctx.generateId(), "2");
    appendChild(parent, c1);
    appendChild(parent, c2);

    replace(c1, c2);

    expect(parent.firstChild).to.equal(c1);
    expect(c1.nextSibling).to.equal(c2);
  });

  it("detaches the old node", () => {
    const ctx = makeCtx();
    const parent = createNode(TestTag.Root, ctx.generateId(), "r");
    const old = createNode(TestTag.A, ctx.generateId(), "old");
    const newNode = createNode(TestTag.B, ctx.generateId(), "new");
    appendChild(parent, old);

    replace(old, newNode);

    expect(old.parentRef).to.be.null;
    expect(old.nextSibling).to.be.null;
  });

  it("replacing a node with itself is a no-op", () => {
    const ctx = makeCtx();
    const parent = createNode(TestTag.Root, ctx.generateId(), "r");
    const child = createNode(TestTag.A, ctx.generateId(), "x");
    appendChild(parent, child);

    replace(child, child);

    expect(parent.firstChild).to.equal(child);
    expect(child.parentRef).to.deep.equal({ tag: "firstChild", parent });
  });
});
