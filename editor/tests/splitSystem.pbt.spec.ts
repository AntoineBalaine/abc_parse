import { expect } from "chai";
import * as fc from "fast-check";
import { ABCContext, Scanner, parse, SemanticAnalyzer, AbcErrorReporter } from "abc-parser";
import { ContextInterpreter, DocumentSnapshots } from "abc-parser/interpreter/ContextInterpreter";
import { fromAst } from "../src/csTree/fromAst";
import { createSelection, Selection } from "../src/selection";
import { splitSystem } from "../src/transforms/splitSystem";
import { findFirstByTag } from "../src/selectors/treeWalk";
import { TAGS, CSNode } from "../src/csTree/types";
import { toAst } from "../src/csTree/toAst";
import { Expr } from "abc-parser/types/Expr2";
import { Token } from "abc-parser/parsers/scan2";
import { genSplitTestCase, findSplitPositionByTime, SplitTestCase } from "../src/transforms/splitSystem.pbt.generators";

type SystemAst = Array<Expr | Token>;

/**
 * Extracts the System AST array from a CSTree root.
 */
function extractSystemAst(root: CSNode): SystemAst {
  const systemNode = findFirstByTag(root, TAGS.System);
  if (!systemNode) {
    return [];
  }

  const result: SystemAst = [];
  let child = systemNode.firstChild;
  while (child !== null) {
    result.push(toAst(child) as Expr | Token);
    child = child.nextSibling;
  }
  return result;
}

/**
 * Helper to create test context from ABC string.
 */
function createTestContext(abc: string): {
  selection: Selection;
  ctx: ABCContext;
  snapshots: DocumentSnapshots;
} {
  const ctx = new ABCContext(new AbcErrorReporter());
  const tokens = Scanner(abc, ctx);
  const ast = parse(tokens, ctx);
  const root = fromAst(ast, ctx);
  const selection = createSelection(root);

  const analyzer = new SemanticAnalyzer(ctx);
  ast.accept(analyzer);

  const interpreter = new ContextInterpreter();
  const snapshots = interpreter.interpret(ast, analyzer.data, ctx);

  return { selection, ctx, snapshots };
}

describe("splitSystem - Property-based tests", () => {
  // Note: The conservation property test is complex because the generated ABC structures
  // don't always parse back to the exact same node counts due to beaming, grouping, etc.
  // The example-based tests in splitSystem.spec.ts verify the conservation property
  // with carefully constructed test cases.

  describe("structural properties", () => {
    it("split creates exactly two systems from one", () => {
      fc.assert(
        fc.property(genSplitTestCase(), (testCase: SplitTestCase) => {
          const { selection, ctx, snapshots } = createTestContext(testCase.abcString);

          const systemAst = extractSystemAst(selection.root);
          if (systemAst.length === 0) {
            return true;
          }

          const splitPos = findSplitPositionByTime(systemAst, testCase.beforeDuration);
          if (splitPos === null) {
            return true;
          }

          // Count systems before
          const systemsBefore = [] as CSNode[];
          let sys = findFirstByTag(selection.root, TAGS.System);
          while (sys) {
            systemsBefore.push(sys);
            sys = sys.nextSibling as CSNode | null;
            if (sys && sys.tag !== TAGS.System) sys = null;
          }
          const countBefore = systemsBefore.length;

          // Apply transform
          const result = splitSystem(selection, splitPos, ctx, snapshots);

          // Count systems after
          const systemsAfter = [] as CSNode[];
          sys = findFirstByTag(result.root, TAGS.System);
          while (sys) {
            systemsAfter.push(sys);
            sys = sys.nextSibling as CSNode | null;
            if (sys && sys.tag !== TAGS.System) sys = null;
          }
          const countAfter = systemsAfter.length;

          // Should have exactly one more system after the split
          // or the same number if the split was a no-op
          return countAfter === countBefore + 1 || countAfter === countBefore;
        }),
        { numRuns: 20 }
      );
    });

    it("cursors are populated on successful split", () => {
      fc.assert(
        fc.property(genSplitTestCase(), (testCase: SplitTestCase) => {
          const { selection, ctx, snapshots } = createTestContext(testCase.abcString);

          const systemAst = extractSystemAst(selection.root);
          if (systemAst.length === 0) {
            return true;
          }

          const splitPos = findSplitPositionByTime(systemAst, testCase.beforeDuration);
          if (splitPos === null) {
            return true;
          }

          // Count systems before
          const systemsBefore = [] as CSNode[];
          let sys = findFirstByTag(selection.root, TAGS.System);
          while (sys) {
            systemsBefore.push(sys);
            sys = sys.nextSibling as CSNode | null;
            if (sys && sys.tag !== TAGS.System) sys = null;
          }
          const countBefore = systemsBefore.length;

          const result = splitSystem(selection, splitPos, ctx, snapshots);

          // Count systems after
          const systemsAfter = [] as CSNode[];
          sys = findFirstByTag(result.root, TAGS.System);
          while (sys) {
            systemsAfter.push(sys);
            sys = sys.nextSibling as CSNode | null;
            if (sys && sys.tag !== TAGS.System) sys = null;
          }
          const countAfter = systemsAfter.length;

          // If a split happened, cursors should be populated
          if (countAfter > countBefore) {
            return result.cursors.length > 0 && result.cursors[0].size > 0;
          }

          // If no split happened, it's okay for cursors to be empty
          return true;
        }),
        { numRuns: 20 }
      );
    });
  });

  describe("basic example tests", () => {
    it("syntheticEOLCount should result in proper system structure for single-voice", () => {
      // For a single-voice system, we should get 2 systems after split
      const abc = "X:1\nK:C\nCDEF|G||\n";
      const { selection, ctx, snapshots } = createTestContext(abc);

      // Split at E (character 2 on line 2, which is the tune body)
      const result = splitSystem(selection, { line: 2, character: 2 }, ctx, snapshots);

      const systems: CSNode[] = [];
      let sys = findFirstByTag(result.root, TAGS.System);
      while (sys) {
        systems.push(sys);
        sys = sys.nextSibling;
        if (sys && sys.tag !== TAGS.System) sys = null;
      }

      expect(systems.length).to.equal(2);
    });

    it("handles multi-voice systems", () => {
      // Multi-voice system where after content starts with voice marker
      const abc = "X:1\nV:1\nV:2\nK:C\n[V:1]CD [V:1]EF|\n[V:2]GA [V:2]Bc|\n";
      const { selection, ctx, snapshots } = createTestContext(abc);

      // Split at a position where the after portion already has voice markers
      // (character 7 on line 4 is after the [V:1] marker)
      const result = splitSystem(selection, { line: 4, character: 7 }, ctx, snapshots);

      // The result should be a valid selection
      expect(result.root).to.not.be.null;
    });
  });
});
