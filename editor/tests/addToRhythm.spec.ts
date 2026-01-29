import { expect } from "chai";
import { describe, it } from "mocha";
import * as fc from "fast-check";
import { toCSTreeWithContext, formatSelection, findByTag, genAbcTune } from "./helpers";
import { TAGS } from "../src/csTree/types";
import { Selection } from "../src/selection";
import { createRational } from "abc-parser";
import { addToRhythm } from "../src/transforms/addToRhythm";
import { getNodeRhythm } from "../src/transforms/rhythm";

describe("addToRhythm", () => {
  describe("example-based", () => {
    it("add-to-rhythm({2, 1}) on Note C2: result is C4 (2 + 2 = 4)", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nC2|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      addToRhythm(sel, createRational(2, 1), ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("C4");
    });

    it("add-to-rhythm({1, 2}) on Rest z/: result is z (1/2 + 1/2 = 1, rhythm removed)", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nz/|\n");
      const rests = findByTag(root, TAGS.Rest);
      const sel: Selection = { root, cursors: [new Set([rests[0].id])] };
      addToRhythm(sel, createRational(1, 2), ctx);
      const r = getNodeRhythm(rests[0]);
      expect(r.numerator).to.equal(1);
      expect(r.denominator).to.equal(1);
    });

    it("add-to-rhythm({2, 1}) on Note C2>: result is C4> (broken preserved)", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nC2>D|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      addToRhythm(sel, createRational(2, 1), ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("C4>");
    });

    it("add-to-rhythm({-3, 1}) on Note C2: result is C (clamped to {1, 1})", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nC2|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      addToRhythm(sel, createRational(-3, 1), ctx);
      const r = getNodeRhythm(notes[0]);
      expect(r.numerator).to.equal(1);
      expect(r.denominator).to.equal(1);
    });

    it("two cursors: each cursor's nodes get the addition independently", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nC2 D3|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id]), new Set([notes[1].id])] };
      addToRhythm(sel, createRational(1, 1), ctx);
      const r0 = getNodeRhythm(notes[0]);
      const r1 = getNodeRhythm(notes[1]);
      expect(r0.numerator).to.equal(3);
      expect(r0.denominator).to.equal(1);
      expect(r1.numerator).to.equal(4);
      expect(r1.denominator).to.equal(1);
    });
  });

  describe("property-based", () => {
    it("add-to-rhythm({0, 1}) produces formatted output identical to the input", () => {
      fc.assert(
        fc.property(genAbcTune, (source) => {
          const { root, ctx } = toCSTreeWithContext(source);
          const notes = findByTag(root, TAGS.Note);
          if (notes.length === 0) return;
          const before = formatSelection({ root, cursors: [] });
          const ids = new Set(notes.map(n => n.id));
          const sel: Selection = { root, cursors: [ids] };
          addToRhythm(sel, createRational(0, 1), ctx);
          const after = formatSelection(sel);
          expect(after).to.equal(before);
        }),
        { numRuns: 1000 }
      );
    });

    it("after add-to-rhythm(r), each selected node's rhythm equals original + r (clamped)", () => {
      fc.assert(
        fc.property(
          genAbcTune,
          fc.integer({ min: 1, max: 4 }),
          (source, addNum) => {
            const { root, ctx } = toCSTreeWithContext(source);
            const notes = findByTag(root, TAGS.Note);
            if (notes.length === 0) return;
            const rhythmsBefore = notes.map(n => getNodeRhythm(n));
            const ids = new Set(notes.map(n => n.id));
            const sel: Selection = { root, cursors: [ids] };
            const delta = createRational(addNum, 1);
            addToRhythm(sel, delta, ctx);
            for (let i = 0; i < notes.length; i++) {
              const expected = {
                numerator: rhythmsBefore[i].numerator + addNum * rhythmsBefore[i].denominator,
                denominator: rhythmsBefore[i].denominator,
              };
              const r = getNodeRhythm(notes[i]);
              // createRational normalizes, so compare values
              expect(r.numerator * expected.denominator).to.equal(expected.numerator * r.denominator);
            }
          }
        ),
        { numRuns: 1000 }
      );
    });
  });
});
