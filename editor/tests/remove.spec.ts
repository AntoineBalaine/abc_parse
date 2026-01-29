import { expect } from "chai";
import { describe, it } from "mocha";
import * as fc from "fast-check";
import { toCSTreeWithContext, formatSelection, findByTag, collectAll, collectSubtree, genAbcTune } from "./helpers";
import { TAGS } from "../src/csTree/types";
import { Selection } from "../src/selection";
import { remove } from "../src/transforms/remove";

describe("remove", () => {
  describe("example-based", () => {
    it("removes the middle note from 'C D E': result formats as 'C E'", () => {
      const { root } = toCSTreeWithContext("X:1\nK:C\nC D E|\n");
      const notes = findByTag(root, TAGS.Note);
      expect(notes.length).to.equal(3);
      const sel: Selection = { root, cursors: [new Set([notes[1].id])] };
      remove(sel);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("C");
      expect(formatted).to.not.contain("D");
      expect(formatted).to.contain("E");
    });

    it("removes a note inside a Chord", () => {
      const { root } = toCSTreeWithContext("X:1\nK:C\n[CEG]|\n");
      const chords = findByTag(root, TAGS.Chord);
      expect(chords.length).to.equal(1);
      // Find the middle note (E) inside the chord
      const chordNotes = findByTag(chords[0], TAGS.Note);
      expect(chordNotes.length).to.equal(3);
      const sel: Selection = { root, cursors: [new Set([chordNotes[1].id])] };
      remove(sel);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("C");
      expect(formatted).to.not.contain("E");
      expect(formatted).to.contain("G");
    });

    it("removing a node that doesn't exist leaves the tree unchanged", () => {
      const { root } = toCSTreeWithContext("X:1\nK:C\nC D E|\n");
      const before = formatSelection({ root, cursors: [] });
      const sel: Selection = { root, cursors: [new Set([99999])] };
      remove(sel);
      const after = formatSelection(sel);
      expect(after).to.equal(before);
    });

    it("two cursors selecting different notes removes both", () => {
      const { root } = toCSTreeWithContext("X:1\nK:C\nC D E|\n");
      const notes = findByTag(root, TAGS.Note);
      expect(notes.length).to.equal(3);
      const sel: Selection = { root, cursors: [new Set([notes[0].id]), new Set([notes[2].id])] };
      remove(sel);
      // Verify only the middle note remains
      const remainingNotes = findByTag(root, TAGS.Note);
      expect(remainingNotes.length).to.equal(1);
      expect(remainingNotes[0].id).to.equal(notes[1].id);
    });
  });

  describe("property-based", () => {
    it("after remove, no node in the resulting tree has an ID from the removed set", () => {
      fc.assert(
        fc.property(genAbcTune, (source) => {
          const { root } = toCSTreeWithContext(source);
          const notes = findByTag(root, TAGS.Note);
          if (notes.length === 0) return;
          // Select a random subset of notes to remove
          const toRemove = notes.slice(0, Math.max(1, Math.floor(notes.length / 2)));
          const ids = new Set(toRemove.map(n => n.id));
          const sel: Selection = { root, cursors: [ids] };
          remove(sel);
          const remaining = collectAll(root);
          for (const node of remaining) {
            expect(ids.has(node.id)).to.be.false;
          }
        }),
        { numRuns: 1000 }
      );
    });

    it("removing zero nodes (empty cursors) returns a tree that roundtrips identically", () => {
      fc.assert(
        fc.property(genAbcTune, (source) => {
          const { root } = toCSTreeWithContext(source);
          const before = formatSelection({ root, cursors: [] });
          const sel: Selection = { root, cursors: [new Set()] };
          remove(sel);
          const after = formatSelection(sel);
          expect(after).to.equal(before);
        }),
        { numRuns: 1000 }
      );
    });

    it("the node count decreases by the sum of subtree sizes of removed nodes", () => {
      fc.assert(
        fc.property(genAbcTune, (source) => {
          const { root } = toCSTreeWithContext(source);
          const notes = findByTag(root, TAGS.Note);
          if (notes.length === 0) return;
          const toRemove = [notes[0]];
          const subtreeSize = collectSubtree(toRemove[0]).length;
          const countBefore = collectAll(root).length;
          const ids = new Set(toRemove.map(n => n.id));
          const sel: Selection = { root, cursors: [ids] };
          remove(sel);
          const countAfter = collectAll(root).length;
          expect(countAfter).to.equal(countBefore - subtreeSize);
        }),
        { numRuns: 1000 }
      );
    });
  });
});
