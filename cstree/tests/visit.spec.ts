import { expect } from "chai";
import { appendChild, visit, type CSVisitor } from "../src/cstree";
import { createNode, TestTag, type TNode, type TestDataMap } from "./helpers";

interface TestCtx {
  visitor: CSVisitor<TestTag, TestDataMap, TestCtx>;
  visited: (string | number)[];
}

interface CounterCtx {
  visitor: CSVisitor<TestTag, TestDataMap, CounterCtx>;
  count: number;
}

function buildTree(): TNode {
  //   root
  //   ├── a1
  //   │   ├── b1
  //   │   └── b2
  //   └── a2
  //       └── c1
  const root = createNode(TestTag.Root, 0, "root");
  const a1 = createNode(TestTag.A, 1, "a1");
  const b1 = createNode(TestTag.B, 2, "b1");
  const b2 = createNode(TestTag.B, 3, "b2");
  const a2 = createNode(TestTag.A, 4, "a2");
  const c1 = createNode(TestTag.C, 5, "c1");

  appendChild(root, a1);
  appendChild(a1, b1);
  appendChild(a1, b2);
  appendChild(root, a2);
  appendChild(a2, c1);

  return root;
}

describe("visit", () => {
  it("should dispatch to the correct handler based on node tag", () => {
    const root = buildTree();

    const visitor: CSVisitor<TestTag, TestDataMap, TestCtx> = {
      [TestTag.A]: (node, ctx) => {
        ctx.visited.push(`A:${node.data}`);
        let child = node.firstChild;
        while (child) {
          visit(child, ctx);
          child = child.nextSibling;
        }
      },
      [TestTag.B]: (node, ctx) => {
        ctx.visited.push(`B:${node.data}`);
      },
    };

    const ctx: TestCtx = { visitor, visited: [] };
    visit(root, ctx);

    expect(ctx.visited).to.deep.equal(["A:a1", "B:b1", "B:b2", "A:a2"]);
  });

  it("should recurse into children by default when no handler exists", () => {
    const root = buildTree();

    const visitor: CSVisitor<TestTag, TestDataMap, TestCtx> = {
      [TestTag.B]: (node, ctx) => {
        ctx.visited.push(node.id);
      },
      [TestTag.C]: (node, ctx) => {
        ctx.visited.push(node.id);
      },
    };

    const ctx: TestCtx = { visitor, visited: [] };
    visit(root, ctx);

    // b1, b2, c1 should be visited even though Root and A have no handlers
    expect(ctx.visited).to.deep.equal([2, 3, 5]);
  });

  it("should not recurse into children when handler does not call visit", () => {
    const root = buildTree();

    const visitor: CSVisitor<TestTag, TestDataMap, TestCtx> = {
      [TestTag.A]: (node, ctx) => {
        // We intentionally do not call visit, so B and C children should be skipped
        ctx.visited.push(node.id);
      },
    };

    const ctx: TestCtx = { visitor, visited: [] };
    visit(root, ctx);

    // Only a1 and a2 should be visited; their children b1, b2, c1 should be skipped
    expect(ctx.visited).to.deep.equal([1, 4]);
  });

  it("should allow handler to visit a specific child selectively", () => {
    const root = buildTree();

    const visitor: CSVisitor<TestTag, TestDataMap, TestCtx> = {
      [TestTag.A]: (node, ctx) => {
        ctx.visited.push(node.id);
        // Only visit the first child (dispatches handler on it + descends into its children)
        if (node.firstChild) {
          visit(node.firstChild, ctx);
        }
      },
      [TestTag.B]: (node, ctx) => {
        ctx.visited.push(node.id);
      },
      [TestTag.C]: (node, ctx) => {
        ctx.visited.push(node.id);
      },
    };

    const ctx: TestCtx = { visitor, visited: [] };
    visit(root, ctx);

    // a1(id=1) -> visit(b1) -> dispatches B handler on b1(id=2). b2 is skipped.
    // a2(id=4) -> visit(c1) -> dispatches C handler on c1(id=5).
    expect(ctx.visited).to.deep.equal([1, 2, 4, 5]);
  });

  it("should pass and allow mutation of context across handlers", () => {
    const root = buildTree();

    const visitor: CSVisitor<TestTag, TestDataMap, CounterCtx> = {
      [TestTag.A]: (node, ctx) => {
        ctx.count += 1;
        let child = node.firstChild;
        while (child) {
          visit(child, ctx);
          child = child.nextSibling;
        }
      },
      [TestTag.B]: (_node, ctx) => {
        ctx.count += 10;
      },
      [TestTag.C]: (_node, ctx) => {
        ctx.count += 100;
      },
    };

    const ctx: CounterCtx = { visitor, count: 0 };
    visit(root, ctx);

    // a1 (+1), b1 (+10), b2 (+10), a2 (+1), c1 (+100) = 122
    expect(ctx.count).to.equal(122);
  });

  it("should handle a leaf node with a handler", () => {
    const leaf = createNode(TestTag.B, 1, "leaf");

    const visitor: CSVisitor<TestTag, TestDataMap, TestCtx> = {
      [TestTag.B]: (node, ctx) => {
        ctx.visited.push(node.data);
      },
    };

    const ctx: TestCtx = { visitor, visited: [] };
    visit(leaf, ctx);
    expect(ctx.visited).to.deep.equal(["leaf"]);
  });

  it("should handle a leaf node without a handler", () => {
    const leaf = createNode(TestTag.B, 1, "leaf");

    const visitor: CSVisitor<TestTag, TestDataMap, TestCtx> = {
      [TestTag.A]: (_node, ctx) => {
        ctx.visited.push("should not appear");
      },
    };

    const ctx: TestCtx = { visitor, visited: [] };
    visit(leaf, ctx);
    expect(ctx.visited).to.deep.equal([]);
  });

  it("should visit all siblings at a given level", () => {
    const root = createNode(TestTag.Root, 0, "root");
    const a1 = createNode(TestTag.A, 1, "a1");
    const a2 = createNode(TestTag.A, 2, "a2");
    const a3 = createNode(TestTag.A, 3, "a3");
    appendChild(root, a1);
    appendChild(root, a2);
    appendChild(root, a3);

    const visitor: CSVisitor<TestTag, TestDataMap, TestCtx> = {
      [TestTag.A]: (node, ctx) => {
        ctx.visited.push(node.id);
      },
    };

    const ctx: TestCtx = { visitor, visited: [] };
    visit(root, ctx);
    expect(ctx.visited).to.deep.equal([1, 2, 3]);
  });

  it("should visit nodes in depth-first pre-order with handlers on all tags", () => {
    const root = buildTree();

    const visitor: CSVisitor<TestTag, TestDataMap, TestCtx> = {
      [TestTag.Root]: (node, ctx) => {
        ctx.visited.push(node.id);
        let child = node.firstChild;
        while (child) {
          visit(child, ctx);
          child = child.nextSibling;
        }
      },
      [TestTag.A]: (node, ctx) => {
        ctx.visited.push(node.id);
        let child = node.firstChild;
        while (child) {
          visit(child, ctx);
          child = child.nextSibling;
        }
      },
      [TestTag.B]: (node, ctx) => {
        ctx.visited.push(node.id);
      },
      [TestTag.C]: (node, ctx) => {
        ctx.visited.push(node.id);
      },
    };

    const ctx: TestCtx = { visitor, visited: [] };
    visit(root, ctx);
    expect(ctx.visited).to.deep.equal([0, 1, 2, 3, 4, 5]);
  });
});
