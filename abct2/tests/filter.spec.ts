import { expect } from "chai";
import { describe, it } from "mocha";
import * as fc from "fast-check";
import { toSelection, genAbcTune, genAbcWithChords } from "./helpers";
import { isNote, isChord, isRest } from "../src/csTree/types";
import { filter } from "../src/transforms/filter";
import { selectNotes, selectChords } from "../src/selectors/typeSelectors";

describe("filter", () => {
  describe("example-based", () => {
    it("keeps all cursors when predicate matches all nodes", () => {
      const sel = selectNotes(toSelection("X:1\nK:C\nCDE[CEG]z|\n"));
      const result = filter(sel, isNote);
      expect(result.cursors.length).to.equal(sel.cursors.length);
    });

    it("returns empty cursors when predicate matches no nodes", () => {
      const sel = selectNotes(toSelection("X:1\nK:C\nCDE[CEG]z|\n"));
      const result = filter(sel, isChord);
      expect(result.cursors.length).to.equal(0);
    });

    it("keeps all cursors with () => true predicate", () => {
      const sel = selectNotes(toSelection("X:1\nK:C\nCDE|\n"));
      const result = filter(sel, () => true);
      expect(result.cursors.length).to.equal(sel.cursors.length);
    });

    it("returns zero cursors with () => false predicate", () => {
      const sel = selectNotes(toSelection("X:1\nK:C\nCDE|\n"));
      const result = filter(sel, () => false);
      expect(result.cursors.length).to.equal(0);
    });

    it("preserves root referential identity", () => {
      const sel = selectNotes(toSelection("X:1\nK:C\nCDE|\n"));
      const result = filter(sel, isNote);
      expect(result.root).to.equal(sel.root);
    });

    it("preserved cursors are referentially identical to the input cursors", () => {
      const sel = selectNotes(toSelection("X:1\nK:C\nCDE|\n"));
      const result = filter(sel, isNote);
      for (let i = 0; i < result.cursors.length; i++) {
        expect(result.cursors[i]).to.equal(sel.cursors[i]);
      }
    });

    it("preserves all chord cursors when filtering selectChords with isChord", () => {
      const sel = selectChords(toSelection("X:1\nK:C\n[CEG][FAC]|\n"));
      const result = filter(sel, isChord);
      expect(result.cursors.length).to.equal(sel.cursors.length);
    });

    it("handles empty selection (no cursors)", () => {
      const sel = toSelection("X:1\nK:C\nCDE|\n");
      sel.cursors = [];
      const result = filter(sel, () => true);
      expect(result.cursors.length).to.equal(0);
    });
  });

  describe("property-based", () => {
    it("filter with () => true preserves cursor count", () => {
      fc.assert(
        fc.property(genAbcTune, (source) => {
          const sel = selectNotes(toSelection(source));
          const result = filter(sel, () => true);
          expect(result.cursors.length).to.equal(sel.cursors.length);
        }),
        { numRuns: 200 }
      );
    });

    it("filter with () => false produces zero cursors", () => {
      fc.assert(
        fc.property(genAbcTune, (source) => {
          const sel = selectNotes(toSelection(source));
          const result = filter(sel, () => false);
          expect(result.cursors.length).to.equal(0);
        }),
        { numRuns: 200 }
      );
    });

    it("output cursor count is <= input cursor count for any type predicate", () => {
      fc.assert(
        fc.property(
          genAbcWithChords,
          fc.constantFrom(isNote, isChord, isRest),
          (source, predicate) => {
            const sel = selectNotes(toSelection(source));
            const result = filter(sel, predicate);
            expect(result.cursors.length).to.be.at.most(sel.cursors.length);
          }
        ),
        { numRuns: 200 }
      );
    });
  });
});
