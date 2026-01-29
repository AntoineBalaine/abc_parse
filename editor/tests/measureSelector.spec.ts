import { expect } from "chai";
import { describe, it } from "mocha";
import { TAGS } from "../src/csTree/types";
import { selectMeasures } from "../src/selectors/measureSelector";
import { selectNotes } from "../src/selectors/typeSelectors";
import { toCSTree, toSelection, findByTag, findById } from "./helpers";

describe("measureSelector", () => {
  describe("basic selection", () => {
    it("selects nodes from a single measure (measure 1)", () => {
      const sel = toSelection("X:1\nK:C\nCDE|\n");
      const result = selectMeasures(sel, 1, 1);
      // Measure 1 contains a Beam with CDE
      expect(result.cursors.length).to.equal(1);
      const nodeId = [...result.cursors[0]][0];
      const node = findById(sel.root, nodeId);
      expect(node).to.not.be.undefined;
      expect(node!.tag).to.equal(TAGS.Beam);
    });

    it("selects nodes from measure 2", () => {
      const sel = toSelection("X:1\nK:C\nCDE|FGA|\n");
      const result = selectMeasures(sel, 2, 2);
      // Measure 2 contains a Beam with FGA
      expect(result.cursors.length).to.equal(1);
      const nodeId = [...result.cursors[0]][0];
      const node = findById(sel.root, nodeId);
      expect(node).to.not.be.undefined;
      expect(node!.tag).to.equal(TAGS.Beam);
    });

    it("selects nodes from multiple measures (range)", () => {
      const sel = toSelection("X:1\nK:C\nC|D|E|F|\n");
      const result = selectMeasures(sel, 2, 3);
      // Measure 2 has D, measure 3 has E
      expect(result.cursors.length).to.equal(2);
    });

    it("empty measure returns no cursors", () => {
      const sel = toSelection("X:1\nK:C\nC||\n");
      const result = selectMeasures(sel, 2, 2);
      // Measure 2 is empty (two consecutive barlines)
      expect(result.cursors.length).to.equal(0);
    });

    it("selects from all measures when range covers entire tune", () => {
      const sel = toSelection("X:1\nK:C\nC|D|E|\n");
      const result = selectMeasures(sel, 1, 3);
      // All 3 measures, each with one Note
      expect(result.cursors.length).to.equal(3);
    });
  });

  describe("measure counting", () => {
    it("content before first barline is measure 1", () => {
      // Notes with spaces are not beamed, so we get 3 separate Notes per measure
      const sel = toSelection("X:1\nK:C\nC D E|F G A|\n");
      // Select only measure 1
      const m1 = selectMeasures(sel, 1, 1);
      // Measure 1 should contain C, D, E as separate Notes
      expect(m1.cursors.length).to.equal(3);

      // Select only measure 2
      const m2 = selectMeasures(sel, 2, 2);
      // Measure 2 should contain F, G, A as separate Notes
      expect(m2.cursors.length).to.equal(3);
    });

    it("handles multiple barlines correctly", () => {
      const sel = toSelection("X:1\nK:C\nC|D|E|F|G|\n");
      // 5 measures, each with a single note
      const all = selectMeasures(sel, 1, 5);
      expect(all.cursors.length).to.equal(5);
    });

    it("selecting beyond last measure returns empty", () => {
      const sel = toSelection("X:1\nK:C\nC|D|\n");
      // Only 2 measures, try selecting measure 5
      const result = selectMeasures(sel, 5, 5);
      expect(result.cursors.length).to.equal(0);
    });
  });

  describe("composition with other selectors", () => {
    it("selectMeasures then selectNotes returns only notes in that measure", () => {
      const sel = toSelection("X:1\nK:C\nCDE|FGA|\n");
      const measure1 = selectMeasures(sel, 1, 1);
      const notes = selectNotes(measure1);
      // Measure 1 has notes C, D, E
      expect(notes.cursors.length).to.equal(3);
    });

    it("selectMeasures then selectNotes on measure 2 returns different notes", () => {
      const sel = toSelection("X:1\nK:C\nCDE|FGA|\n");
      const measure2 = selectMeasures(sel, 2, 2);
      const notes = selectNotes(measure2);
      // Measure 2 has notes F, G, A
      expect(notes.cursors.length).to.equal(3);
    });
  });

  describe("mixed content", () => {
    it("selects notes, chords, and rests within measure range", () => {
      const sel = toSelection("X:1\nK:C\nC [CEG] z|D|\n");
      const result = selectMeasures(sel, 1, 1);
      // Measure 1 contains: Note(C), Chord([CEG]), Rest(z)
      expect(result.cursors.length).to.equal(3);
    });

    it("selects beamed notes as a single Beam element", () => {
      const sel = toSelection("X:1\nK:C\nCDEF|G|\n");
      const result = selectMeasures(sel, 1, 1);
      // Measure 1 contains one Beam (CDEF)
      expect(result.cursors.length).to.equal(1);
      const nodeId = [...result.cursors[0]][0];
      const node = findById(sel.root, nodeId);
      expect(node!.tag).to.equal(TAGS.Beam);
    });

    it("handles grace groups", () => {
      const sel = toSelection("X:1\nK:C\n{g}C|D|\n");
      const result = selectMeasures(sel, 1, 1);
      // Measure 1 contains Grace_group and Note
      expect(result.cursors.length).to.equal(2);
    });

    it("handles tuplets", () => {
      const sel = toSelection("X:1\nK:C\n(3CDE|F|\n");
      const result = selectMeasures(sel, 1, 1);
      // Measure 1 contains elements including the Tuplet
      expect(result.cursors.length).to.be.greaterThanOrEqual(1);
      // Verify at least one Tuplet is found
      const hasTuplet = result.cursors.some(cursor => {
        const nodeId = [...cursor][0];
        const node = findById(sel.root, nodeId);
        return node?.tag === TAGS.Tuplet;
      });
      expect(hasTuplet).to.be.true;
    });

    it("handles multi-measure rests", () => {
      const sel = toSelection("X:1\nK:C\nC|Z4|D|\n");
      const result = selectMeasures(sel, 2, 2);
      // Measure 2 contains a MultiMeasureRest
      expect(result.cursors.length).to.equal(1);
      const nodeId = [...result.cursors[0]][0];
      const node = findById(sel.root, nodeId);
      expect(node!.tag).to.equal(TAGS.MultiMeasureRest);
    });
  });

  describe("validation", () => {
    it("returns original selection for non-integer start measure", () => {
      const sel = toSelection("X:1\nK:C\nC|\n");
      const result = selectMeasures(sel, 1.5, 2);
      expect(result).to.equal(sel);
    });

    it("returns original selection for start measure less than 1", () => {
      const sel = toSelection("X:1\nK:C\nC|\n");
      const result = selectMeasures(sel, 0, 2);
      expect(result).to.equal(sel);
    });

    it("returns original selection for non-integer end measure", () => {
      const sel = toSelection("X:1\nK:C\nC|\n");
      const result = selectMeasures(sel, 1, 2.5);
      expect(result).to.equal(sel);
    });

    it("returns original selection for end measure less than 1", () => {
      const sel = toSelection("X:1\nK:C\nC|\n");
      const result = selectMeasures(sel, 1, 0);
      expect(result).to.equal(sel);
    });

    it("returns original selection when start > end", () => {
      const sel = toSelection("X:1\nK:C\nC|\n");
      const result = selectMeasures(sel, 3, 2);
      expect(result).to.equal(sel);
    });

    it("allows start === end", () => {
      const sel = toSelection("X:1\nK:C\nC|\n");
      const result = selectMeasures(sel, 1, 1);
      expect(result.cursors.length).to.equal(1);
    });
  });

  describe("multi-tune files", () => {
    it("selects from measures in all tunes", () => {
      const sel = toSelection("X:1\nK:C\nC|D|\n\nX:2\nK:G\nG|A|\n");
      const result = selectMeasures(sel, 1, 1);
      // Measure 1 of tune 1 has C, measure 1 of tune 2 has G
      expect(result.cursors.length).to.equal(2);
    });
  });
});
