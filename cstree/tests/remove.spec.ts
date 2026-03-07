import { expect } from "chai";
import { describe, it } from "mocha";
import { appendChild, remove } from "../src/cstree";
import { createNode, makeCtx, TestTag } from "./helpers";

describe("remove", () => {
  it("removes the first child of three", () => {
    const ctx = makeCtx();
    const parent = createNode(TestTag.Root, ctx.generateId(), "r");
    const c1 = createNode(TestTag.A, ctx.generateId(), "1");
    const c2 = createNode(TestTag.B, ctx.generateId(), "2");
    const c3 = createNode(TestTag.C, ctx.generateId(), "3");
    appendChild(parent, c1);
    appendChild(parent, c2);
    appendChild(parent, c3);

    remove(c1);

    expect(parent.firstChild).to.equal(c2);
    expect(c2.parentRef).to.deep.equal({ tag: "firstChild", parent });
    expect(c3.parentRef).to.deep.equal({ tag: "sibling", prev: c2 });
  });

  it("removes a middle child", () => {
    const ctx = makeCtx();
    const parent = createNode(TestTag.Root, ctx.generateId(), "r");
    const c1 = createNode(TestTag.A, ctx.generateId(), "1");
    const c2 = createNode(TestTag.B, ctx.generateId(), "2");
    const c3 = createNode(TestTag.C, ctx.generateId(), "3");
    appendChild(parent, c1);
    appendChild(parent, c2);
    appendChild(parent, c3);

    remove(c2);

    expect(c1.nextSibling).to.equal(c3);
    expect(c3.parentRef).to.deep.equal({ tag: "sibling", prev: c1 });
  });

  it("removes the last child", () => {
    const ctx = makeCtx();
    const parent = createNode(TestTag.Root, ctx.generateId(), "r");
    const c1 = createNode(TestTag.A, ctx.generateId(), "1");
    const c2 = createNode(TestTag.B, ctx.generateId(), "2");
    const c3 = createNode(TestTag.C, ctx.generateId(), "3");
    appendChild(parent, c1);
    appendChild(parent, c2);
    appendChild(parent, c3);

    remove(c3);

    expect(c2.nextSibling).to.be.null;
  });

  it("removes the only child", () => {
    const ctx = makeCtx();
    const parent = createNode(TestTag.Root, ctx.generateId(), "r");
    const child = createNode(TestTag.A, ctx.generateId(), "x");
    appendChild(parent, child);

    remove(child);

    expect(parent.firstChild).to.be.null;
  });

  it("no-ops on root (null parentRef)", () => {
    const ctx = makeCtx();
    const root = createNode(TestTag.Root, ctx.generateId(), "r");
    const child = createNode(TestTag.A, ctx.generateId(), "x");
    appendChild(root, child);

    remove(root);

    expect(root.firstChild).to.equal(child);
  });

  it("detaches the removed node", () => {
    const ctx = makeCtx();
    const parent = createNode(TestTag.Root, ctx.generateId(), "r");
    const c1 = createNode(TestTag.A, ctx.generateId(), "1");
    const c2 = createNode(TestTag.B, ctx.generateId(), "2");
    appendChild(parent, c1);
    appendChild(parent, c2);

    remove(c1);

    expect(c1.parentRef).to.be.null;
    expect(c1.nextSibling).to.be.null;
  });
});
