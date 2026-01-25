import { expect } from "chai";
import { describe, it } from "mocha";
import { toCSTreeWithContext, findByTag, formatSelection } from "../../abct2/tests/helpers";
import { TAGS } from "../../abct2/src/csTree/types";
import { Selection } from "../../abct2/src/selection";
import { lookupTransform } from "./transformLookup";
import { collectSurvivingCursorIds } from "./cursorPreservation";
import { serializeCSTree } from "./csTreeSerializer";
import { fromAst } from "../../abct2/src/csTree/fromAst";
import { Scanner, parse, ABCContext, createRational } from "abc-parser";

/**
 * Simulates the full applyTransform flow without the LSP layer.
 */
function simulateApplyTransform(
  source: string,
  cursorNodeIds: number[],
  transformName: string,
  args: unknown[]
): { newText: string; survivingIds: number[]; rangeCount: number } {
  const { root, ctx } = toCSTreeWithContext(source);

  const selection: Selection = cursorNodeIds.length === 0
    ? { root, cursors: [new Set([root.id])] }
    : { root, cursors: cursorNodeIds.map(id => new Set([id])) };

  const transformFn = lookupTransform(transformName);
  if (!transformFn) throw new Error(`Unknown transform: ${transformName}`);

  const newSelection = transformFn(selection, ctx, ...args);
  const survivingIds = collectSurvivingCursorIds(newSelection);
  const newText = serializeCSTree(newSelection.root, ctx);

  return { newText, survivingIds, rangeCount: survivingIds.length };
}

describe("Transform integration (simulated LSP flow)", () => {
  describe("transpose", () => {
    it("transposes all notes and preserves cursor state", () => {
      const source = "X:1\nK:C\nCDE|\n";
      const { root } = toCSTreeWithContext(source);
      const notes = findByTag(root, TAGS.Note);
      const cursorIds = notes.map(n => n.id);

      const result = simulateApplyTransform(source, cursorIds, "transpose", [2]);

      // CDE transposed by 2 semitones: C->D, D->E, E->F# (^F)
      expect(result.newText).to.contain("DE^F");
      expect(result.survivingIds.length).to.equal(3);
    });
  });

  describe("enharmonize", () => {
    it("toggles sharp to flat", () => {
      const source = "X:1\nK:C\n^C|\n";
      const { root } = toCSTreeWithContext(source);
      const notes = findByTag(root, TAGS.Note);
      const cursorIds = notes.map(n => n.id);

      const result = simulateApplyTransform(source, cursorIds, "enharmonize", []);

      expect(result.newText).to.contain("_D");
      expect(result.survivingIds.length).to.equal(1);
    });
  });

  describe("error handling", () => {
    it("unknown transform name throws error", () => {
      expect(() => simulateApplyTransform("X:1\nK:C\nC|\n", [], "nonExistent", []))
        .to.throw("Unknown transform");
    });
  });
});
