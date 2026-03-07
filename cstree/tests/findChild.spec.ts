import { expect } from "chai";
import { appendChild, findChild } from "../src/cstree";
import { createNode, makeCtx, TestTag } from "./helpers";

describe("findChild", () => {
  it("returns null when the parent has no children", () => {
    const ctx = makeCtx();
    const root = createNode(TestTag.Root, ctx.generateId(), "r");
    expect(findChild(root, () => true)).to.equal(null);
  });

  it("returns the matching child when the predicate matches the second child", () => {
    const ctx = makeCtx();
    const root = createNode(TestTag.Root, ctx.generateId(), "r");
    const a = createNode(TestTag.A, ctx.generateId(), "first");
    const b = createNode(TestTag.B, ctx.generateId(), "second");
    const c = createNode(TestTag.C, ctx.generateId(), "third");
    appendChild(root, a);
    appendChild(root, b);
    appendChild(root, c);

    const result = findChild(root, (n) => n.tag === TestTag.B);
    expect(result).to.equal(b);
  });

  it("returns null when no child matches the predicate", () => {
    const ctx = makeCtx();
    const root = createNode(TestTag.Root, ctx.generateId(), "r");
    const a = createNode(TestTag.A, ctx.generateId(), "first");
    const b = createNode(TestTag.B, ctx.generateId(), "second");
    appendChild(root, a);
    appendChild(root, b);

    expect(findChild(root, (n) => n.tag === TestTag.D)).to.equal(null);
  });

  it("returns the first matching child when multiple children match", () => {
    const ctx = makeCtx();
    const root = createNode(TestTag.Root, ctx.generateId(), "r");
    const a = createNode(TestTag.A, ctx.generateId(), "first");
    const b = createNode(TestTag.A, ctx.generateId(), "second");
    const c = createNode(TestTag.A, ctx.generateId(), "third");
    appendChild(root, a);
    appendChild(root, b);
    appendChild(root, c);

    const result = findChild(root, (n) => n.tag === TestTag.A);
    expect(result).to.equal(a);
  });
});
