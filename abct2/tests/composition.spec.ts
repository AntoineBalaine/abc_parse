import { expect } from "chai";
import { describe, it } from "mocha";
import * as fc from "fast-check";
import { TAGS } from "../src/csTree/types";
import { selectChords, selectNotes, selectNonChordNotes, selectRests } from "../src/selectors/typeSelectors";
import { selectTop, selectNthFromTop, selectAllButTop } from "../src/selectors/chordSelectors";
import { selectTune } from "../src/selectors/structureSelectors";
import { toSelection, findById, genAbcTune } from "./helpers";

describe("composition", () => {
  describe("properties", () => {
    it("the returned root reference is the same CSNode as the input root", () => {
      fc.assert(
        fc.property(genAbcTune, (abc) => {
          const sel = toSelection(abc);
          const chords = selectChords(sel);
          const notes = selectNotes(sel);
          return chords.root === sel.root && notes.root === sel.root;
        })
      );
    });

    it("applying selectors does not mutate the input selection's cursors", () => {
      fc.assert(
        fc.property(genAbcTune, (abc) => {
          const sel = toSelection(abc);
          const originalCursors = sel.cursors.map((c) => new Set(c));
          selectChords(sel);
          selectNotes(sel);
          selectRests(sel);
          if (sel.cursors.length !== originalCursors.length) return false;
          for (let i = 0; i < sel.cursors.length; i++) {
            const orig = [...originalCursors[i]];
            const curr = [...sel.cursors[i]];
            if (orig.length !== curr.length) return false;
            for (let j = 0; j < orig.length; j++) {
              if (orig[j] !== curr[j]) return false;
            }
          }
          return true;
        })
      );
    });
  });

  describe("examples", () => {
    it("[CEG]2 z2 [FAc]2 z2| — selectTop(selectChords) produces 2 cursors", () => {
      const sel = toSelection("X:1\nK:C\n[CEG]2 z2 [FAc]2 z2|\n");
      const result = selectTop(selectChords(sel));
      expect(result.cursors.length).to.equal(2);
      for (const cursor of result.cursors) {
        const node = findById(result.root, [...cursor][0]);
        expect(node!.tag).to.equal(TAGS.Note);
      }
    });

    it("[CEG]2 C2 D2| — selectNonChordNotes(selectTune) produces 2 cursors", () => {
      const sel = toSelection("X:1\nK:C\n[CEG]2 C2 D2|\n");
      const result = selectNonChordNotes(selectTune(sel));
      expect(result.cursors.length).to.equal(2);
    });

    it("[CEGc]2 C2| — selectNthFromTop(selectChords, 1) produces 1 cursor (G)", () => {
      const sel = toSelection("X:1\nK:C\n[CEGc]2 C2|\n");
      const result = selectNthFromTop(selectChords(sel), 1);
      expect(result.cursors.length).to.equal(1);
    });

    it("three-deep: selectAllButTop(selectChords(selectTune))", () => {
      const sel = toSelection("X:1\nK:C\n[CEG]2 C2 [FAc]2 F2|\n");
      const result = selectAllButTop(selectChords(selectTune(sel)));
      expect(result.cursors.length).to.equal(4);
    });

    it("empty propagation: selectChords(selectRests) produces zero cursors", () => {
      const sel = toSelection("X:1\nK:C\n[CEG]2 z2 C2|\n");
      const result = selectChords(selectRests(sel));
      expect(result.cursors.length).to.equal(0);
    });
  });
});
