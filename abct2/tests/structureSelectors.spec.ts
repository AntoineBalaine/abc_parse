import { expect } from "chai";
import { describe, it } from "mocha";
import * as fc from "fast-check";
import { TAGS } from "../src/csTree/types";
import { selectTune } from "../src/selectors/structureSelectors";
import { selectChords } from "../src/selectors/typeSelectors";
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
  });
});
