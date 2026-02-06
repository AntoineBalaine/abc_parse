import { expect } from "chai";
import { describe, it } from "mocha";
import * as fc from "fast-check";
import { TAGS } from "../src/csTree/types";
import { selectTune } from "../src/selectors/structureSelectors";
import { selectChords, selectNotes } from "../src/selectors/typeSelectors";
import { toSelection, findById, findByTag, genAbcMultiTune } from "./helpers";

describe("structureSelectors", () => {
  describe("properties", () => {
    it("selectTune produces one cursor per Tune CSNode, each containing just that Tune's ID", () => {
      fc.assert(
        fc.property(genAbcMultiTune, (abc) => {
          const sel = toSelection(abc);
          const result = selectTune(sel);
          const tunes = findByTag(result.root, TAGS.Tune);
          if (result.cursors.length !== tunes.length) return false;
          for (const cursor of result.cursors) {
            if (cursor.size !== 1) return false;
            const id = [...cursor][0];
            const node = findById(result.root, id);
            if (!node || node.tag !== TAGS.Tune) return false;
          }
          return true;
        })
      );
    });
  });

  describe("examples", () => {
    it("two-tune input — selectTune produces 2 cursors", () => {
      const sel = toSelection("X:1\nT:A\nK:C\nCDE|\n\nX:2\nT:B\nK:G\nGAB|\n");
      const result = selectTune(sel);
      expect(result.cursors.length).to.equal(2);
    });

    it("single-tune input — selectTune produces 1 cursor", () => {
      const sel = toSelection("X:1\nK:C\nCDE|\n");
      const result = selectTune(sel);
      expect(result.cursors.length).to.equal(1);
    });

    it("composition: selectChords(selectTune(sel)) finds chords within each tune", () => {
      const sel = toSelection("X:1\nK:C\n[CE]2 C2|\n\nX:2\nK:G\n[GB]2|\n");
      const tunes = selectTune(sel);
      const chords = selectChords(tunes);
      expect(chords.cursors.length).to.equal(2);
    });

    it("cursor on a note inside a tune — selectTune returns that tune", () => {
      const sel = toSelection("X:1\nK:C\nCDE|\n");
      const notes = selectNotes(sel);
      // notes.cursors[0] contains the C note
      const scopedSel = { root: sel.root, cursors: [notes.cursors[0]] };
      const result = selectTune(scopedSel);
      expect(result.cursors.length).to.equal(1);
      const tuneId = [...result.cursors[0]][0];
      const node = findById(result.root, tuneId);
      expect(node!.tag).to.equal(TAGS.Tune);
    });

    it("multiple cursors in same tune — selectTune returns one cursor", () => {
      const sel = toSelection("X:1\nK:C\nCDE|\n");
      const notes = selectNotes(sel);
      // All 3 notes are in the same tune
      const result = selectTune(notes);
      expect(result.cursors.length).to.equal(1);
    });

    it("cursors in different tunes — selectTune returns one cursor per tune", () => {
      const sel = toSelection("X:1\nK:C\nC|\n\nX:2\nK:G\nG|\n");
      const notes = selectNotes(sel);
      // 2 notes, each in a different tune
      const result = selectTune(notes);
      expect(result.cursors.length).to.equal(2);
    });

    it("selectTune is idempotent — selectTune(selectTune(sel)) equals selectTune(sel)", () => {
      const sel = toSelection("X:1\nK:C\nCDE|\n");
      const tunes1 = selectTune(sel);
      const tunes2 = selectTune(tunes1);
      expect(tunes2.cursors.length).to.equal(tunes1.cursors.length);
      // Verify same Tune IDs
      const ids1 = tunes1.cursors.map((c) => [...c][0]).sort();
      const ids2 = tunes2.cursors.map((c) => [...c][0]).sort();
      expect(ids2).to.deep.equal(ids1);
    });
  });

  describe("properties - new behavior", () => {
    it("for any note selection, selectTune returns cursors only containing Tune IDs", () => {
      fc.assert(
        fc.property(genAbcMultiTune, (abc) => {
          const sel = toSelection(abc);
          const notes = selectNotes(sel);
          const tunes = selectTune(notes);
          for (const cursor of tunes.cursors) {
            if (cursor.size !== 1) return false;
            const id = [...cursor][0];
            const node = findById(tunes.root, id);
            if (!node || node.tag !== TAGS.Tune) return false;
          }
          return true;
        })
      );
    });
  });
});
