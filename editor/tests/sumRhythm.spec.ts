import { expect } from "chai";
import { describe, it } from "mocha";
import * as fc from "fast-check";
import { toCSTreeWithContext, formatSelection, findByTag, genAbcTune } from "./helpers";
import { TAGS } from "../src/csTree/types";
import { Selection } from "../src/selection";
import { sumRhythm } from "../src/transforms/sumRhythm";

describe("sumRhythm", () => {
  describe("example-based", () => {
    it("C2 D2 E2 with one cursor selecting all 3 notes: result is [{6, 1}]", () => {
      const { root } = toCSTreeWithContext("X:1\nK:C\nC2 D2 E2|\n");
      const notes = findByTag(root, TAGS.Note);
      expect(notes.length).to.equal(3);
      const sel: Selection = { root, cursors: [new Set(notes.map(n => n.id))] };
      const result = sumRhythm(sel);
      expect(result.length).to.equal(1);
      expect(result[0].numerator).to.equal(6);
      expect(result[0].denominator).to.equal(1);
    });

    it("C/ D/ E/ (each is 1/2): result is [{3, 2}]", () => {
      const { root } = toCSTreeWithContext("X:1\nK:C\nC/ D/ E/|\n");
      const notes = findByTag(root, TAGS.Note);
      expect(notes.length).to.equal(3);
      const sel: Selection = { root, cursors: [new Set(notes.map(n => n.id))] };
      const result = sumRhythm(sel);
      expect(result.length).to.equal(1);
      expect(result[0].numerator).to.equal(3);
      expect(result[0].denominator).to.equal(2);
    });

    it("two cursors, first selecting C2, second selecting D3: result is [{2, 1}, {3, 1}]", () => {
      const { root } = toCSTreeWithContext("X:1\nK:C\nC2 D3|\n");
      const notes = findByTag(root, TAGS.Note);
      expect(notes.length).to.equal(2);
      const sel: Selection = { root, cursors: [new Set([notes[0].id]), new Set([notes[1].id])] };
      const result = sumRhythm(sel);
      expect(result.length).to.equal(2);
      expect(result[0].numerator).to.equal(2);
      expect(result[0].denominator).to.equal(1);
      expect(result[1].numerator).to.equal(3);
      expect(result[1].denominator).to.equal(1);
    });

    it("empty cursor (no matching nodes): result is [{0, 1}]", () => {
      const { root } = toCSTreeWithContext("X:1\nK:C\nC D E|\n");
      const sel: Selection = { root, cursors: [new Set([99999])] };
      const result = sumRhythm(sel);
      expect(result.length).to.equal(1);
      expect(result[0].numerator).to.equal(0);
      expect(result[0].denominator).to.equal(1);
    });
  });

  describe("property-based", () => {
    it("sumRhythm does not modify the input tree", () => {
      fc.assert(
        fc.property(genAbcTune, (source) => {
          const { root } = toCSTreeWithContext(source);
          const before = formatSelection({ root, cursors: [] });
          const notes = findByTag(root, TAGS.Note);
          if (notes.length === 0) return;
          const sel: Selection = { root, cursors: [new Set(notes.map(n => n.id))] };
          sumRhythm(sel);
          const after = formatSelection({ root, cursors: [] });
          expect(after).to.equal(before);
        }),
        { numRuns: 1000 }
      );
    });

    it("sumRhythm returns one entry per cursor", () => {
      fc.assert(
        fc.property(
          genAbcTune,
          fc.integer({ min: 1, max: 5 }),
          (source, numCursors) => {
            const { root } = toCSTreeWithContext(source);
            const notes = findByTag(root, TAGS.Note);
            if (notes.length === 0) return;
            const cursors = Array.from({ length: numCursors }, () => new Set([notes[0].id]));
            const sel: Selection = { root, cursors };
            const result = sumRhythm(sel);
            expect(result.length).to.equal(numCursors);
          }
        ),
        { numRuns: 1000 }
      );
    });
  });
});
