import { expect } from "chai";
import { describe, it } from "mocha";
import * as fc from "fast-check";
import { TAGS, isBarLine } from "../src/csTree/types";
import { selectSiblingsAfter } from "../src/selectors/siblingSelector";
import { toCSTree, findByTag, collectAll, genAbcTune } from "./helpers";

describe("siblingSelector", () => {
  describe("examples", () => {
    it("predicate () => true collects all siblings after the selected node", () => {
      const root = toCSTree("X:1\nK:C\nC D E|\n");
      // The Tune_Body has children: Note(C), space, Note(D), space, Note(E), BarLine, \n
      const bodies = findByTag(root, TAGS.Tune_Body);
      const firstNote = findByTag(root, TAGS.Note)[0];
      const sel = { root, cursors: [new Set([firstNote.id])] };
      const result = selectSiblingsAfter(sel, () => true);
      // After Note(C): space, Note(D), space, Note(E), BarLine, \n = 6 siblings
      expect(result.cursors.length).to.equal(6);
    });

    it("predicate stopping at bar lines collects notes and spaces before the bar", () => {
      const root = toCSTree("X:1\nK:C\nC D E|\n");
      const firstNote = findByTag(root, TAGS.Note)[0];
      const sel = { root, cursors: [new Set([firstNote.id])] };
      const result = selectSiblingsAfter(sel, (n) => !isBarLine(n));
      // After Note(C) before BarLine: space, Note(D), space, Note(E) = 4 siblings
      expect(result.cursors.length).to.equal(4);
    });

    it("selected node has no nextSibling returns empty cursors", () => {
      const root = toCSTree("X:1\nK:C\nC|\n");
      // The last child of Tune_Body is the \n token
      const allNodes = collectAll(root);
      // Find the last sibling in Tune_Body
      const body = findByTag(root, TAGS.Tune_Body)[0];
      let last = body.firstChild;
      while (last && last.nextSibling) last = last.nextSibling;
      expect(last).to.not.be.null;
      const sel = { root, cursors: [new Set([last!.id])] };
      const result = selectSiblingsAfter(sel, () => true);
      expect(result.cursors.length).to.equal(0);
    });

    it("predicate immediately returns false returns empty cursors", () => {
      const root = toCSTree("X:1\nK:C\nC D E|\n");
      const firstNote = findByTag(root, TAGS.Note)[0];
      const sel = { root, cursors: [new Set([firstNote.id])] };
      const result = selectSiblingsAfter(sel, () => false);
      expect(result.cursors.length).to.equal(0);
    });

    it("multiple cursors each independently collect their siblings", () => {
      const root = toCSTree("X:1\nK:C\nC D E|\n");
      const notes = findByTag(root, TAGS.Note);
      // Select both Note(C) and Note(E); each gets its own siblings
      const sel = { root, cursors: [new Set([notes[0].id]), new Set([notes[2].id])] };
      const result = selectSiblingsAfter(sel, () => true);
      // After Note(C): space, Note(D), space, Note(E), BarLine, \n = 6 siblings
      // After Note(E): BarLine, \n = 2 siblings
      expect(result.cursors.length).to.equal(6 + 2);
    });
  });

  describe("property-based", () => {
    it("collected nodes are a contiguous prefix of the sibling chain after the selected node", () => {
      fc.assert(
        fc.property(genAbcTune, (abc) => {
          const root = toCSTree(abc);
          const notes = findByTag(root, TAGS.Note);
          if (notes.length === 0) return true;

          const note = notes[0];
          const sel = { root, cursors: [new Set([note.id])] };
          const result = selectSiblingsAfter(sel, () => true);

          // Verify the collected IDs form a contiguous chain
          let sibling = note.nextSibling;
          for (let i = 0; i < result.cursors.length; i++) {
            if (sibling === null) return false;
            const selectedId = [...result.cursors[i]][0];
            if (selectedId !== sibling.id) return false;
            sibling = sibling.nextSibling;
          }
          return true;
        })
      );
    });

    it("with predicate () => true, cursor count equals the number of siblings after the node", () => {
      fc.assert(
        fc.property(genAbcTune, (abc) => {
          const root = toCSTree(abc);
          const notes = findByTag(root, TAGS.Note);
          if (notes.length === 0) return true;

          const note = notes[0];
          const sel = { root, cursors: [new Set([note.id])] };
          const result = selectSiblingsAfter(sel, () => true);

          // Count actual siblings
          let count = 0;
          let sibling = note.nextSibling;
          while (sibling !== null) {
            count++;
            sibling = sibling.nextSibling;
          }
          return result.cursors.length === count;
        })
      );
    });
  });
});
