import { expect } from "chai";
import { describe, it } from "mocha";
import * as fc from "fast-check";
import { toSelection, findByTag, genAbcTune } from "./helpers";
import { TAGS } from "../src/csTree/types";
import { length } from "../src/transforms/length";
import { filter } from "../src/transforms/filter";
import { selectNotes, selectChords, selectChordNotes } from "../src/selectors/typeSelectors";

describe("length", () => {
  describe("example-based", () => {
    it("returns 1 for a selection with one cursor", () => {
      const sel = toSelection("X:1\nK:C\nC|\n");
      expect(length(sel)).to.equal(1);
    });

    it("returns 3 for a selection with three cursors", () => {
      const sel = selectNotes(toSelection("X:1\nK:C\nCDE|\n"));
      expect(length(sel)).to.equal(3);
    });

    it("returns 0 for an empty selection", () => {
      const sel = toSelection("X:1\nK:C\nCDE|\n");
      sel.cursors = [];
      expect(length(sel)).to.equal(0);
    });

    it("integration: selectChords then selectChordNotes on [CEG] returns 3", () => {
      const sel = selectChords(toSelection("X:1\nK:C\n[CEG]|\n"));
      const notesSel = selectChordNotes(sel);
      expect(length(notesSel)).to.equal(3);
    });

    it("integration: selectNotes on CDE| returns 3", () => {
      const sel = selectNotes(toSelection("X:1\nK:C\nCDE|\n"));
      expect(length(sel)).to.equal(3);
    });

    it("returns 0 after filter that removes all nodes", () => {
      const sel = selectNotes(toSelection("X:1\nK:C\nCDE|\n"));
      const filtered = filter(sel, () => false);
      expect(length(filtered)).to.equal(0);
    });
  });

  describe("property-based", () => {
    it("length always returns a value >= 0", () => {
      fc.assert(
        fc.property(genAbcTune, (source) => {
          const sel = selectNotes(toSelection(source));
          expect(length(sel)).to.be.at.least(0);
        }),
        { numRuns: 200 }
      );
    });

    it("length(createSelection(root)) returns 1", () => {
      fc.assert(
        fc.property(genAbcTune, (source) => {
          const sel = toSelection(source);
          expect(length(sel)).to.equal(1);
        }),
        { numRuns: 200 }
      );
    });

    it("length after selectNotes equals the number of Note nodes in the tree", () => {
      fc.assert(
        fc.property(genAbcTune, (source) => {
          const sel = toSelection(source);
          const notesSel = selectNotes(sel);
          const noteCount = findByTag(sel.root, TAGS.Note).length;
          expect(length(notesSel)).to.equal(noteCount);
        }),
        { numRuns: 200 }
      );
    });
  });
});
