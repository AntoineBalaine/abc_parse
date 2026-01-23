import { expect } from "chai";
import { describe, it } from "mocha";
import * as fc from "fast-check";
import { TAGS } from "../src/csTree/types";
import { selectChords } from "../src/selectors/typeSelectors";
import {
  selectTop,
  selectBottom,
  selectNthFromTop,
  selectAllButTop,
  selectAllButBottom,
} from "../src/selectors/chordSelectors";
import { toSelection, findById, genAbcWithChords } from "./helpers";

describe("chordSelectors", () => {
  describe("properties", () => {
    it("for a chord with N notes, selectTop produces 1 cursor and selectAllButTop produces N-1, and their IDs are disjoint", () => {
      fc.assert(
        fc.property(genAbcWithChords, (abc) => {
          const sel = toSelection(abc);
          const chords = selectChords(sel);
          if (chords.cursors.length === 0) return true;
          const top = selectTop(chords);
          const rest = selectAllButTop(chords);
          // Each chord contributes 1 top cursor and N-1 all-but-top cursors
          if (top.cursors.length !== chords.cursors.length) return false;
          const topIds = new Set(top.cursors.map((c) => [...c][0]));
          for (const cursor of rest.cursors) {
            if (topIds.has([...cursor][0])) return false;
          }
          return true;
        })
      );
    });

    it("selectNthFromTop(sel, 0) produces the same cursors as selectTop(sel)", () => {
      fc.assert(
        fc.property(genAbcWithChords, (abc) => {
          const sel = toSelection(abc);
          const chords = selectChords(sel);
          if (chords.cursors.length === 0) return true;
          const top = selectTop(chords);
          const nth0 = selectNthFromTop(chords, 0);
          if (nth0.cursors.length !== top.cursors.length) return false;
          for (let i = 0; i < top.cursors.length; i++) {
            if ([...nth0.cursors[i]][0] !== [...top.cursors[i]][0]) return false;
          }
          return true;
        })
      );
    });

    it("each cursor from selectAllButTop/selectAllButBottom contains exactly 1 ID", () => {
      fc.assert(
        fc.property(genAbcWithChords, (abc) => {
          const sel = toSelection(abc);
          const chords = selectChords(sel);
          const butTop = selectAllButTop(chords);
          const butBottom = selectAllButBottom(chords);
          for (const c of butTop.cursors) {
            if (c.size !== 1) return false;
          }
          for (const c of butBottom.cursors) {
            if (c.size !== 1) return false;
          }
          return true;
        })
      );
    });
  });

  describe("examples", () => {
    it("[CEG]2| — selectTop produces cursor with G's ID", () => {
      const sel = toSelection("X:1\nK:C\n[CEG]2|\n");
      const chords = selectChords(sel);
      const top = selectTop(chords);
      expect(top.cursors.length).to.equal(1);
      const topNode = findById(top.root, [...top.cursors[0]][0]);
      expect(topNode).to.not.equal(undefined);
      expect(topNode!.tag).to.equal(TAGS.Note);
    });

    it("[CEG]2| — selectBottom produces cursor with C's ID", () => {
      const sel = toSelection("X:1\nK:C\n[CEG]2|\n");
      const chords = selectChords(sel);
      const bottom = selectBottom(chords);
      expect(bottom.cursors.length).to.equal(1);
      const bottomNode = findById(bottom.root, [...bottom.cursors[0]][0]);
      expect(bottomNode).to.not.equal(undefined);
      expect(bottomNode!.tag).to.equal(TAGS.Note);
    });

    it("[CEG]2| — selectAllButTop produces 2 cursors", () => {
      const sel = toSelection("X:1\nK:C\n[CEG]2|\n");
      const chords = selectChords(sel);
      const result = selectAllButTop(chords);
      expect(result.cursors.length).to.equal(2);
    });

    it("[CEG]2| — selectAllButBottom produces 2 cursors", () => {
      const sel = toSelection("X:1\nK:C\n[CEG]2|\n");
      const chords = selectChords(sel);
      const result = selectAllButBottom(chords);
      expect(result.cursors.length).to.equal(2);
    });

    it("[CEG]2| — selectNthFromTop(1) produces 1 cursor (E)", () => {
      const sel = toSelection("X:1\nK:C\n[CEG]2|\n");
      const chords = selectChords(sel);
      const result = selectNthFromTop(chords, 1);
      expect(result.cursors.length).to.equal(1);
    });

    it("[CG]2| (2-note chord) — selectAllButTop produces 1 cursor", () => {
      const sel = toSelection("X:1\nK:C\n[CG]2|\n");
      const chords = selectChords(sel);
      const result = selectAllButTop(chords);
      expect(result.cursors.length).to.equal(1);
    });

    it("[C]2| (single-note chord) — selectAllButTop produces zero cursors", () => {
      const sel = toSelection("X:1\nK:C\n[C]2|\n");
      const chords = selectChords(sel);
      const result = selectAllButTop(chords);
      expect(result.cursors.length).to.equal(0);
    });

    it("[CEGc]2| — selectNthFromTop(5) produces zero cursors (out of bounds)", () => {
      const sel = toSelection("X:1\nK:C\n[CEGc]2|\n");
      const chords = selectChords(sel);
      const result = selectNthFromTop(chords, 5);
      expect(result.cursors.length).to.equal(0);
    });

    it("[CEG]2 [FAc]2| — selectAllButTop produces 4 cursors", () => {
      const sel = toSelection("X:1\nK:C\n[CEG]2 [FAc]2|\n");
      const chords = selectChords(sel);
      const result = selectAllButTop(chords);
      expect(result.cursors.length).to.equal(4);
    });
  });
});
