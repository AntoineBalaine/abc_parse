import { expect } from "chai";
import { describe, it } from "mocha";
import * as fc from "fast-check";
import { TAGS } from "../src/csTree/types";
import {
  selectChords,
  selectNotes,
  selectNonChordNotes,
  selectChordNotes,
  selectRests,
} from "../src/selectors/typeSelectors";
import { createSelection } from "../src/selection";
import { toSelection, toCSTree, findById, findByTag, genAbcTune, genAbcWithChords } from "./helpers";

describe("typeSelectors", () => {
  describe("properties", () => {
    it("every cursor in selectChords result contains exactly 1 ID of a Chord CSNode", () => {
      fc.assert(
        fc.property(genAbcWithChords, (abc) => {
          const sel = toSelection(abc);
          const result = selectChords(sel);
          for (const cursor of result.cursors) {
            if (cursor.size !== 1) return false;
            const id = [...cursor][0];
            const node = findById(result.root, id);
            if (!node || node.tag !== TAGS.Chord) return false;
          }
          return true;
        })
      );
    });

    it("every cursor in selectNotes result contains exactly 1 ID of a Note CSNode", () => {
      fc.assert(
        fc.property(genAbcTune, (abc) => {
          const sel = toSelection(abc);
          const result = selectNotes(sel);
          for (const cursor of result.cursors) {
            if (cursor.size !== 1) return false;
            const id = [...cursor][0];
            const node = findById(result.root, id);
            if (!node || node.tag !== TAGS.Note) return false;
          }
          return true;
        })
      );
    });

    it("selectNonChordNotes and selectChordNotes are disjoint and their union equals selectNotes", () => {
      fc.assert(
        fc.property(genAbcWithChords, (abc) => {
          const sel = toSelection(abc);
          const allNotes = selectNotes(sel);
          const nonChord = selectNonChordNotes(sel);
          const chordNotes = selectChordNotes(sel);

          const allIds = new Set(allNotes.cursors.map((c) => [...c][0]));
          const nonChordIds = new Set(nonChord.cursors.map((c) => [...c][0]));
          const chordIds = new Set(chordNotes.cursors.map((c) => [...c][0]));

          // Disjoint
          for (const id of nonChordIds) {
            if (chordIds.has(id)) return false;
          }
          // Union equals all
          const unionIds = new Set([...nonChordIds, ...chordIds]);
          if (unionIds.size !== allIds.size) return false;
          for (const id of allIds) {
            if (!unionIds.has(id)) return false;
          }
          return true;
        })
      );
    });

    it("selectChords cursor count equals the number of Chord CSNodes in the tree", () => {
      fc.assert(
        fc.property(genAbcWithChords, (abc) => {
          const root = toCSTree(abc);
          const sel = createSelection(root);
          const result = selectChords(sel);
          const chordNodes = findByTag(root, TAGS.Chord);
          return result.cursors.length === chordNodes.length;
        })
      );
    });

    it("applying two type selectors for disjoint types produces zero cursors", () => {
      fc.assert(
        fc.property(genAbcTune, (abc) => {
          const sel = toSelection(abc);
          const notesOnly = selectNotes(sel);
          const chordsFromNotes = selectChords(notesOnly);
          return chordsFromNotes.cursors.length === 0;
        })
      );
    });

    it("idempotence: selectChords(selectChords(sel)) equals selectChords(sel)", () => {
      fc.assert(
        fc.property(genAbcWithChords, (abc) => {
          const sel = toSelection(abc);
          const first = selectChords(sel);
          const second = selectChords(first);
          if (second.cursors.length !== first.cursors.length) return false;
          for (let i = 0; i < first.cursors.length; i++) {
            const a = [...first.cursors[i]];
            const b = [...second.cursors[i]];
            if (a.length !== b.length || a[0] !== b[0]) return false;
          }
          return true;
        })
      );
    });
  });

  describe("examples", () => {
    it("[CEG]2 C2 D2 E2| — selectChords produces 1 cursor", () => {
      const sel = toSelection("X:1\nK:C\n[CEG]2 C2 D2 E2|\n");
      const chords = selectChords(sel);
      expect(chords.cursors.length).to.equal(1);
    });

    it("[CEG]2 C2 D2 E2| — selectNotes produces 6 cursors", () => {
      const sel = toSelection("X:1\nK:C\n[CEG]2 C2 D2 E2|\n");
      const notes = selectNotes(sel);
      expect(notes.cursors.length).to.equal(6);
    });

    it("[CEG]2 C2 D2 E2| — selectNonChordNotes produces 3 cursors", () => {
      const sel = toSelection("X:1\nK:C\n[CEG]2 C2 D2 E2|\n");
      const result = selectNonChordNotes(sel);
      expect(result.cursors.length).to.equal(3);
    });

    it("[CEG]2 C2 D2 E2| — selectChordNotes produces 3 cursors", () => {
      const sel = toSelection("X:1\nK:C\n[CEG]2 C2 D2 E2|\n");
      const result = selectChordNotes(sel);
      expect(result.cursors.length).to.equal(3);
    });

    it("C2 z2 [DF]2 z2| — selectRests produces 2 cursors", () => {
      const sel = toSelection("X:1\nK:C\nC2 z2 [DF]2 z2|\n");
      const rests = selectRests(sel);
      expect(rests.cursors.length).to.equal(2);
    });

    it("C2 z2 [DF]2 z2| — selectChords produces 1 cursor", () => {
      const sel = toSelection("X:1\nK:C\nC2 z2 [DF]2 z2|\n");
      const chords = selectChords(sel);
      expect(chords.cursors.length).to.equal(1);
    });

    it("C2 z2 [DF]2 z2| — selectNonChordNotes produces 1 cursor (standalone C)", () => {
      const sel = toSelection("X:1\nK:C\nC2 z2 [DF]2 z2|\n");
      const result = selectNonChordNotes(sel);
      expect(result.cursors.length).to.equal(1);
    });

    it("CDEF| (beamed) — selectNotes produces 4 cursors", () => {
      const sel = toSelection("X:1\nK:C\nCDEF|\n");
      const result = selectNotes(sel);
      expect(result.cursors.length).to.equal(4);
    });

    it("selectChords(selectNotes(sel)) on any input produces zero cursors", () => {
      const sel = toSelection("X:1\nK:C\n[CEG]2 C2|\n");
      const result = selectChords(selectNotes(sel));
      expect(result.cursors.length).to.equal(0);
    });
  });
});
