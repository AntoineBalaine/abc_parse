import { expect } from "chai";
import { describe, it } from "mocha";
import { toCSTreeWithContext, findByTag, formatSelection } from "../../editor/tests/helpers";
import { TAGS, Selection, fromAst } from "editor";
import { lookupTransform } from "./transformLookup";
import { collectSurvivingCursorIds } from "./cursorPreservation";
import { serializeCSTree } from "./csTreeSerializer";
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

  describe("voiceInfoLineToInline", () => {
    it("converts V: info line to [V:] inline field", () => {
      const source = "X:1\nK:C\nV:1\nCDE|\n";
      const { root } = toCSTreeWithContext(source);
      // Find V: info lines
      const infoLines = findByTag(root, TAGS.Info_line).filter(n => {
        const firstChild = n.firstChild;
        if (!firstChild) return false;
        return firstChild.data.type === "token" && firstChild.data.lexeme === "V:";
      });
      const cursorIds = infoLines.map(n => n.id);

      const result = simulateApplyTransform(source, cursorIds, "voiceInfoLineToInline", []);

      expect(result.newText).to.contain("[V:1]");
      expect(result.newText).to.not.match(/^V:1$/m); // No standalone V:1 line
    });
  });

  describe("voiceInlineToInfoLine", () => {
    it("converts [V:] inline field to V: info line", () => {
      const source = "X:1\nK:C\n[V:1] CDE|\n";
      const { root } = toCSTreeWithContext(source);
      // Find V: inline fields
      const inlineFields = findByTag(root, TAGS.Inline_field).filter(n => {
        let child = n.firstChild;
        while (child) {
          if (child.data.type === "token" && child.data.lexeme === "V:") {
            return true;
          }
          child = child.nextSibling;
        }
        return false;
      });
      const cursorIds = inlineFields.map(n => n.id);

      const result = simulateApplyTransform(source, cursorIds, "voiceInlineToInfoLine", []);

      expect(result.newText).to.match(/V:1\n/); // V:1 on its own line
      expect(result.newText).to.not.contain("[V:1]");
    });
  });
});
