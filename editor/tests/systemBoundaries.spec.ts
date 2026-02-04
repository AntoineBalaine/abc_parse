import { expect } from "chai";
import * as fc from "fast-check";
import { Scanner, parse, ABCContext } from "abc-parser";
import { fromAst } from "../src/csTree/fromAst";
import { toAst } from "../src/csTree/toAst";
import { CSNode, TAGS } from "../src/csTree/types";
import { findByTag } from "./helpers";

function parseToCSTree(source: string): { root: CSNode; ctx: ABCContext } {
  const ctx = new ABCContext();
  const tokens = Scanner(source, ctx);
  const ast = parse(tokens, ctx);
  return { root: fromAst(ast, ctx), ctx };
}

function countSystems(root: CSNode): number {
  return findByTag(root, TAGS.System).length;
}

describe("System boundaries in CSTree", () => {
  describe("fromAst creates System wrapper nodes", () => {
    it("should create one System node for a single-system tune", () => {
      const source = `X:1
K:C
CDEF|GABc|`;
      const { root } = parseToCSTree(source);

      const systems = findByTag(root, TAGS.System);
      expect(systems).to.have.lengthOf(1);

      // Verify System is a child of Tune_Body
      const tuneBodies = findByTag(root, TAGS.Tune_Body);
      expect(tuneBodies).to.have.lengthOf(1);
      expect(tuneBodies[0].firstChild?.tag).to.equal(TAGS.System);
    });

    it("should create multiple System nodes for a multi-system tune (deferred style)", () => {
      const source = `X:1
K:C
V:1
CDEF|
V:2
GABc|
V:1
cdef|`;
      const ctx = new ABCContext();
      const tokens = Scanner(source, ctx);
      const ast = parse(tokens, ctx);
      const root = fromAst(ast, ctx);

      // The parser determines system boundaries based on voice order reversal
      // This tune should have at least 2 systems
      const systems = findByTag(root, TAGS.System);
      expect(systems.length).to.be.at.least(2);
    });

    it("should create multiple System nodes for a linear-style tune", () => {
      const source = `X:1
K:C
V:1
CD|
V:2
EF|
V:1
GA|`;
      const ctx = new ABCContext();
      ctx.tuneLinear = true;
      const tokens = Scanner(source, ctx);
      const ast = parse(tokens, ctx);
      const root = fromAst(ast, ctx);

      const systems = findByTag(root, TAGS.System);
      expect(systems.length).to.be.at.least(2);
    });

    it("should handle empty system (whitespace/EOL only)", () => {
      const source = `X:1
K:C
CDEF|`;
      const { root } = parseToCSTree(source);

      // Even a simple tune should have at least one system
      const systems = findByTag(root, TAGS.System);
      expect(systems.length).to.be.at.least(1);
    });
  });

  describe("toAst reconstructs System[] structure", () => {
    it("should preserve system count in round-trip", () => {
      const source = `X:1
K:C
CDEF|GABc|`;
      const ctx = new ABCContext();
      const tokens = Scanner(source, ctx);
      const ast = parse(tokens, ctx);
      const originalSystemCount = ast.contents[0].tune_body?.sequence.length ?? 0;

      const csTree = fromAst(ast, ctx);
      const reconstructed = toAst(csTree);

      const reconstructedSystemCount = (reconstructed as any).contents[0].tune_body?.sequence.length ?? 0;
      expect(reconstructedSystemCount).to.equal(originalSystemCount);
    });

    it("should preserve system count for multi-system tune", () => {
      const source = `X:1
K:C
V:1
CDEF|
V:2
GABc|
V:1
cdef|`;
      const ctx = new ABCContext();
      const tokens = Scanner(source, ctx);
      const ast = parse(tokens, ctx);
      const originalSystemCount = ast.contents[0].tune_body?.sequence.length ?? 0;

      const csTree = fromAst(ast, ctx);
      const reconstructed = toAst(csTree);

      const reconstructedSystemCount = (reconstructed as any).contents[0].tune_body?.sequence.length ?? 0;
      expect(reconstructedSystemCount).to.equal(originalSystemCount);
    });

    it("should preserve content within each system", () => {
      const source = `X:1
K:C
CDEF|GABc|`;
      const ctx = new ABCContext();
      const tokens = Scanner(source, ctx);
      const ast = parse(tokens, ctx);

      const csTree = fromAst(ast, ctx);
      const reconstructed = toAst(csTree);

      // The first system should have the same elements
      const originalSystem = ast.contents[0].tune_body?.sequence[0] ?? [];
      const reconstructedSystem = (reconstructed as any).contents[0].tune_body?.sequence[0] ?? [];

      expect(reconstructedSystem.length).to.equal(originalSystem.length);
    });
  });

  describe("property-based tests", () => {
    it("System node count in CSTree equals tune_body.sequence.length", () => {
      fc.assert(
        fc.property(fc.constantFrom(
          "X:1\nK:C\nCDEF|\n",
          "X:1\nK:C\nV:1\nCD|\nV:2\nEF|\n",
          "X:1\nK:C\nCDEF|GABc|cdef|\n"
        ), (source) => {
          const ctx = new ABCContext();
          const tokens = Scanner(source, ctx);
          const ast = parse(tokens, ctx);
          const expectedSystemCount = ast.contents[0].tune_body?.sequence.length ?? 0;

          const csTree = fromAst(ast, ctx);
          const actualSystemCount = countSystems(csTree);

          return actualSystemCount === expectedSystemCount;
        }),
        { numRuns: 10 }
      );
    });

    it("round-trip preserves system count", () => {
      fc.assert(
        fc.property(fc.constantFrom(
          "X:1\nK:C\nCDEF|\n",
          "X:1\nK:C\nV:1\nCD|\nV:2\nEF|\n",
          "X:1\nK:C\nCDEF|GABc|cdef|\n"
        ), (source) => {
          const ctx = new ABCContext();
          const tokens = Scanner(source, ctx);
          const ast = parse(tokens, ctx);
          const originalCount = ast.contents[0].tune_body?.sequence.length ?? 0;

          const csTree = fromAst(ast, ctx);
          const reconstructed = toAst(csTree);
          const reconstructedCount = (reconstructed as any).contents[0].tune_body?.sequence.length ?? 0;

          return reconstructedCount === originalCount;
        }),
        { numRuns: 10 }
      );
    });
  });
});
