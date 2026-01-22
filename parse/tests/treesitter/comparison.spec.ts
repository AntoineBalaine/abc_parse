/**
 * Tests for the Child-Sibling comparison framework
 *
 * These tests verify that the CSNode comparison infrastructure
 * works correctly before using it for TreeSitter validation.
 */

import chai, { expect } from "chai";
import {
  createCSNode,
  arrayToSiblingChain,
  CSNode,
  compareCSNodes,
  formatCompareResult,
  exprToCS,
  collectNodeTypes,
  serializeCSNode,
} from "../../comparison";
import { Scanner } from "../../parsers/scan2";
import { parse } from "../../parsers/parse2";
import { ABCContext } from "../../parsers/Context";
import {
  parseWithTypeScript,
  assertTreesEqual,
  countTreeNodes,
  getTreeDepth,
  formatTree,
} from "./helpers";

describe("CSNode creation", () => {
  it("creates a leaf node with text", () => {
    const node = createCSNode("NOTE", { text: "C" });
    expect(node.type).to.equal("NOTE");
    expect(node.text).to.equal("C");
    expect(node.firstChild).to.be.null;
    expect(node.nextSibling).to.be.null;
  });

  it("creates a node with children", () => {
    const child = createCSNode("PITCH", { text: "D" });
    const parent = createCSNode("NOTE", { firstChild: child });
    expect(parent.type).to.equal("NOTE");
    expect(parent.firstChild).to.equal(child);
  });

  it("creates sibling chains from arrays", () => {
    const nodes = [
      createCSNode("A", {}),
      createCSNode("B", {}),
      createCSNode("C", {}),
    ];
    const chain = arrayToSiblingChain(nodes);
    expect(chain?.type).to.equal("A");
    expect(chain?.nextSibling?.type).to.equal("B");
    expect(chain?.nextSibling?.nextSibling?.type).to.equal("C");
    expect(chain?.nextSibling?.nextSibling?.nextSibling).to.be.null;
  });
});

describe("CSNode comparison", () => {
  it("compares identical trees as equal", () => {
    const node1 = createCSNode("NOTE", {
      firstChild: createCSNode("PITCH", { text: "C" }),
    });
    const node2 = createCSNode("NOTE", {
      firstChild: createCSNode("PITCH", { text: "C" }),
    });
    const result = compareCSNodes(node1, node2);
    expect(result.equal).to.be.true;
  });

  it("detects type differences", () => {
    const node1 = createCSNode("NOTE", {});
    const node2 = createCSNode("REST", {});
    const result = compareCSNodes(node1, node2);
    expect(result.equal).to.be.false;
    expect(result.expected).to.equal("NOTE");
    expect(result.actual).to.equal("REST");
  });

  it("detects text differences", () => {
    const node1 = createCSNode("NOTE", { text: "C" });
    const node2 = createCSNode("NOTE", { text: "D" });
    const result = compareCSNodes(node1, node2);
    expect(result.equal).to.be.false;
  });

  it("detects missing child", () => {
    const node1 = createCSNode("NOTE", {
      firstChild: createCSNode("PITCH", {}),
    });
    const node2 = createCSNode("NOTE", {});
    const result = compareCSNodes(node1, node2);
    expect(result.equal).to.be.false;
  });

  it("detects extra child", () => {
    const node1 = createCSNode("NOTE", {});
    const node2 = createCSNode("NOTE", {
      firstChild: createCSNode("PITCH", {}),
    });
    const result = compareCSNodes(node1, node2);
    expect(result.equal).to.be.false;
  });

  it("compares deep trees", () => {
    const makeDeep = (depth: number): CSNode => {
      if (depth === 0) return createCSNode("LEAF", { text: "x" });
      return createCSNode(`LEVEL_${depth}`, {
        firstChild: makeDeep(depth - 1),
      });
    };
    const tree1 = makeDeep(10);
    const tree2 = makeDeep(10);
    const result = compareCSNodes(tree1, tree2);
    expect(result.equal).to.be.true;
  });

  it("compares wide trees", () => {
    const makeWide = (width: number): CSNode | null => {
      const nodes: CSNode[] = [];
      for (let i = 0; i < width; i++) {
        nodes.push(createCSNode(`NODE_${i}`, { text: String(i) }));
      }
      return arrayToSiblingChain(nodes);
    };
    const tree1 = makeWide(20);
    const tree2 = makeWide(20);
    const result = compareCSNodes(tree1, tree2);
    expect(result.equal).to.be.true;
  });

  it("handles null comparisons", () => {
    expect(compareCSNodes(null, null).equal).to.be.true;
    expect(compareCSNodes(createCSNode("X", {}), null).equal).to.be.false;
    expect(compareCSNodes(null, createCSNode("X", {})).equal).to.be.false;
  });
});

describe("exprToCS conversion", () => {
  it("converts a simple tune", () => {
    const input = "X:1\nT:Test\nK:C\nCDEF|";
    const { csNode } = parseWithTypeScript(input);
    expect(csNode).to.not.be.null;
    expect(csNode?.type).to.equal("File_structure");
  });

  it("preserves note information", () => {
    const input = "X:1\nK:C\nC2 D E/2|";
    const { csNode } = parseWithTypeScript(input);
    expect(csNode).to.not.be.null;

    const types = collectNodeTypes(csNode);
    expect(types.has("Note")).to.be.true;
    expect(types.has("Pitch")).to.be.true;
  });

  it("handles chords", () => {
    const input = "X:1\nK:C\n[CEG]|";
    const { csNode } = parseWithTypeScript(input);
    expect(csNode).to.not.be.null;

    const types = collectNodeTypes(csNode);
    expect(types.has("Chord")).to.be.true;
  });

  it("handles grace groups", () => {
    const input = "X:1\nK:C\n{AB}C|";
    const { csNode } = parseWithTypeScript(input);
    expect(csNode).to.not.be.null;

    const types = collectNodeTypes(csNode);
    expect(types.has("Grace_group")).to.be.true;
  });

  it("handles barlines", () => {
    const input = "X:1\nK:C\nC|D||E|]";
    const { csNode } = parseWithTypeScript(input);
    expect(csNode).to.not.be.null;

    const types = collectNodeTypes(csNode);
    expect(types.has("BarLine")).to.be.true;
  });

  it("handles multiple info lines", () => {
    const input = "X:1\nT:Title\nM:4/4\nL:1/4\nK:G\nGAB|";
    const { csNode } = parseWithTypeScript(input);
    expect(csNode).to.not.be.null;

    const types = collectNodeTypes(csNode);
    expect(types.has("Info_line")).to.be.true;
  });
});

describe("Self-comparison tests", () => {
  it("self-compares a minimal tune", () => {
    const input = "X:1\nK:C\nC|";
    const { csNode } = parseWithTypeScript(input);
    assertTreesEqual(csNode, csNode, input);
  });

  it("self-compares a tune with various elements", () => {
    const input = `X:1
T:Test Tune
M:4/4
L:1/8
K:G
|:GABc dedc|B2G2 G2z2:|
w:La la la la la la la la
`;
    const { csNode } = parseWithTypeScript(input);
    assertTreesEqual(csNode, csNode, input);
  });

  it("self-compares a tune with directives", () => {
    const input = `%%scale 1.0
X:1
T:Test
K:C
C|`;
    const { csNode } = parseWithTypeScript(input);
    assertTreesEqual(csNode, csNode, input);
  });
});

describe("Tree metrics", () => {
  it("counts nodes correctly", () => {
    const input = "X:1\nK:C\nCDE|";
    const { csNode } = parseWithTypeScript(input);
    const count = countTreeNodes(csNode);
    expect(count).to.be.greaterThan(5);
  });

  it("calculates depth correctly", () => {
    const input = "X:1\nK:C\nC|";
    const { csNode } = parseWithTypeScript(input);
    const depth = getTreeDepth(csNode);
    expect(depth).to.be.greaterThan(2);
  });
});

describe("formatCompareResult", () => {
  it("returns null for equal result", () => {
    const result = { equal: true };
    const formatted = formatCompareResult(result);
    expect(formatted).to.be.null;
  });

  it("formats type mismatch", () => {
    const result = {
      equal: false,
      path: ["root", "firstChild"],
      expected: "NOTE",
      actual: "REST",
    };
    const formatted = formatCompareResult(result);
    expect(formatted).to.not.be.null;
    expect(formatted).to.contain("NOTE");
    expect(formatted).to.contain("REST");
  });
});

describe("serializeCSNode", () => {
  it("serializes a simple tree to text format", () => {
    const node = createCSNode("ROOT", {
      firstChild: createCSNode("CHILD", { text: "x" }),
    });
    const output = serializeCSNode(node);
    // The function returns human-readable text format, not JSON
    expect(output).to.contain("ROOT");
    expect(output).to.contain("CHILD");
    expect(output).to.contain('"x"');
  });
});
