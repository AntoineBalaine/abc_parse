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

      expect(result.newText).to.equal("X:1\nK:C\nDE^F|\n");
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

      expect(result.newText).to.equal("X:1\nK:C\n_D|\n");
      expect(result.survivingIds.length).to.equal(1);
    });
  });

  describe("error handling", () => {
    it("unknown transform name throws error", () => {
      expect(() => simulateApplyTransform("X:1\nK:C\nC|\n", [], "nonExistent", []))
        .to.throw("Unknown transform");
    });
  });

  describe("legato with grouped cursor", () => {
    /**
     * The legato transform requires all notes and rests to be in a single cursor
     * so that it can traverse them sequentially and replace rests with tied copies
     * of the preceding note. This test verifies that the grouped cursor approach works.
     */
    it("extends note through following rests when using grouped cursor", () => {
      const source = "X:1\nK:C\nC z z z|\n";
      const { root, ctx } = toCSTreeWithContext(source);
      const notes = findByTag(root, TAGS.Note);
      const rests = findByTag(root, TAGS.Rest);

      const groupedIds = new Set<number>();
      for (const n of notes) groupedIds.add(n.id);
      for (const r of rests) groupedIds.add(r.id);

      const selection: Selection = { root, cursors: [groupedIds] };

      const transformFn = lookupTransform("legato");
      if (!transformFn) throw new Error("legato transform not found");

      const newSelection = transformFn(selection, ctx);
      const newText = serializeCSTree(newSelection.root, ctx);

      expect(newText).to.equal("X:1\nK:C\nC4   |\n");
    });

    it("does not work when each node has its own cursor (old behavior)", () => {
      const source = "X:1\nK:C\nC z z z|\n";
      const { root, ctx } = toCSTreeWithContext(source);
      const notes = findByTag(root, TAGS.Note);
      const rests = findByTag(root, TAGS.Rest);

      const individualCursors = [
        ...notes.map(n => new Set([n.id])),
        ...rests.map(r => new Set([r.id])),
      ];

      const selection: Selection = { root, cursors: individualCursors };

      const transformFn = lookupTransform("legato");
      if (!transformFn) throw new Error("legato transform not found");

      const newSelection = transformFn(selection, ctx);
      const newText = serializeCSTree(newSelection.root, ctx);

      // With individual cursors, the source remains unchanged
      expect(newText).to.equal("X:1\nK:C\nC z z z|\n");
    });

    it("extends chord through following rest", () => {
      const source = "X:1\nK:C\n[CE] z G|\n";
      const { root, ctx } = toCSTreeWithContext(source);
      const chords = findByTag(root, TAGS.Chord);
      const notes = findByTag(root, TAGS.Note);
      const rests = findByTag(root, TAGS.Rest);

      const groupedIds = new Set<number>();
      for (const c of chords) groupedIds.add(c.id);
      for (const n of notes) groupedIds.add(n.id);
      for (const r of rests) groupedIds.add(r.id);

      const selection: Selection = { root, cursors: [groupedIds] };

      const transformFn = lookupTransform("legato");
      if (!transformFn) throw new Error("legato transform not found");

      const newSelection = transformFn(selection, ctx);
      const newText = serializeCSTree(newSelection.root, ctx);

      expect(newText).to.equal("X:1\nK:C\n[CE]2  G|\n");
    });

    it("creates tied notes across bar boundary", () => {
      const source = "X:1\nK:C\nC z | z z D|\n";
      const { root, ctx } = toCSTreeWithContext(source);
      const notes = findByTag(root, TAGS.Note);
      const rests = findByTag(root, TAGS.Rest);

      const groupedIds = new Set<number>();
      for (const n of notes) groupedIds.add(n.id);
      for (const r of rests) groupedIds.add(r.id);

      const selection: Selection = { root, cursors: [groupedIds] };

      const transformFn = lookupTransform("legato");
      if (!transformFn) throw new Error("legato transform not found");

      const newSelection = transformFn(selection, ctx);
      const newText = serializeCSTree(newSelection.root, ctx);

      expect(newText).to.equal("X:1\nK:C\nC2-  | C2  D|\n");
    });

    it("handles multiple notes with interleaved rests", () => {
      const source = "X:1\nK:C\nC z D z|\n";
      const { root, ctx } = toCSTreeWithContext(source);
      const notes = findByTag(root, TAGS.Note);
      const rests = findByTag(root, TAGS.Rest);

      const groupedIds = new Set<number>();
      for (const n of notes) groupedIds.add(n.id);
      for (const r of rests) groupedIds.add(r.id);

      const selection: Selection = { root, cursors: [groupedIds] };

      const transformFn = lookupTransform("legato");
      if (!transformFn) throw new Error("legato transform not found");

      const newSelection = transformFn(selection, ctx);
      const newText = serializeCSTree(newSelection.root, ctx);

      expect(newText).to.equal("X:1\nK:C\nC2  D2 |\n");
    });

    it("extends note through y-spacer", () => {
      const source = "X:1\nK:C\nC y D|\n";
      const { root, ctx } = toCSTreeWithContext(source);
      const notes = findByTag(root, TAGS.Note);
      const yspacers = findByTag(root, TAGS.YSPACER);

      const groupedIds = new Set<number>();
      for (const n of notes) groupedIds.add(n.id);
      for (const y of yspacers) groupedIds.add(y.id);

      const selection: Selection = { root, cursors: [groupedIds] };

      const transformFn = lookupTransform("legato");
      if (!transformFn) throw new Error("legato transform not found");

      const newSelection = transformFn(selection, ctx);
      const newText = serializeCSTree(newSelection.root, ctx);

      expect(newText).to.equal("X:1\nK:C\nC2  D|\n");
    });
  });

  describe("voiceInfoLineToInline", () => {
    it("converts V: info line to [V:] inline field", () => {
      const source = "X:1\nK:C\nV:1\nCDE|\n";
      const { root } = toCSTreeWithContext(source);
      const infoLines = findByTag(root, TAGS.Info_line).filter(n => {
        const firstChild = n.firstChild;
        if (!firstChild) return false;
        return firstChild.data.type === "token" && firstChild.data.lexeme === "V:";
      });
      const cursorIds = infoLines.map(n => n.id);

      const result = simulateApplyTransform(source, cursorIds, "voiceInfoLineToInline", []);

      expect(result.newText).to.equal("X:1\nK:C\n[V:1] CDE|\n");
    });
  });

  describe("voiceInlineToInfoLine", () => {
    it("converts [V:] inline field to V: info line", () => {
      const source = "X:1\nK:C\n[V:1] CDE|\n";
      const { root } = toCSTreeWithContext(source);
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

      expect(result.newText).to.equal("X:1\nK:C\nV:1\nCDE|\n");
    });
  });
});
