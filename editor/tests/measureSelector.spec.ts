import { expect } from "chai";
import { describe, it } from "mocha";
import { TAGS } from "../src/csTree/types";
import { selectMeasures } from "../src/selectors/measureSelector";
import { selectRange } from "../src/selectors/rangeSelector";
import { selectNotes } from "../src/selectors/typeSelectors";
import { toSelection, findByTag, findById } from "./helpers";

describe("measureSelector", () => {
  describe("splits selection by barlines", () => {
    it("splits into separate cursors at barlines", () => {
      const sel = toSelection("X:1\nK:C\nC D | E F | G A |\n");
      const result = selectMeasures(sel);
      // 3 measures, each becomes a cursor
      expect(result.cursors.length).to.equal(3);
    });

    it("groups contiguous elements within each measure", () => {
      const sel = toSelection("X:1\nK:C\nC D E | F G |\n");
      const result = selectMeasures(sel);
      expect(result.cursors.length).to.equal(2);
      // First cursor should contain multiple IDs (C, D, E)
      expect(result.cursors[0].size).to.equal(3);
      // Second cursor should contain F, G
      expect(result.cursors[1].size).to.equal(2);
    });

    it("content before first barline is measure 1", () => {
      const sel = toSelection("X:1\nK:C\nC D E | F G A |\n");
      const result = selectMeasures(sel);
      // Measure 1 (before first |) and Measure 2 (between | and |)
      expect(result.cursors.length).to.equal(2);
    });

    it("handles empty measures (consecutive barlines)", () => {
      const sel = toSelection("X:1\nK:C\nC | | D |\n");
      const result = selectMeasures(sel);
      // Measure 1 has C, measure 2 is empty (no cursor), measure 3 has D
      expect(result.cursors.length).to.equal(2);
    });

    it("handles beamed notes as single element", () => {
      const sel = toSelection("X:1\nK:C\nCDEF | GABc |\n");
      const result = selectMeasures(sel);
      expect(result.cursors.length).to.equal(2);
      // Each measure has one Beam element
      expect(result.cursors[0].size).to.equal(1);
      expect(result.cursors[1].size).to.equal(1);
      // Verify it's a Beam
      const nodeId = [...result.cursors[0]][0];
      const node = findById(sel.root, nodeId);
      expect(node!.tag).to.equal(TAGS.Beam);
    });
  });

  describe("respects input scope", () => {
    it("only includes elements within scope", () => {
      const sel = toSelection("X:1\nK:C\nC | D | E | F |\n");
      // Select text covering "D | E" (line 2, characters covering D | E)
      const scoped = selectRange(sel, 2, 4, 2, 9);
      const result = selectMeasures(scoped);
      // Only measures containing D and E should be returned
      expect(result.cursors.length).to.equal(2);
    });

    it("returns original selection when no elements match scope", () => {
      const sel = toSelection("X:1\nK:C\nC | D |\n");
      // Create a scope that doesn't include any music elements
      // by selecting only header content
      const scoped = selectRange(sel, 0, 0, 0, 3);
      const result = selectMeasures(scoped);
      // Should return original selection since no music elements in scope
      expect(result).to.equal(scoped);
    });

    it("handles partial measure in scope", () => {
      const sel = toSelection("X:1\nK:C\nC D E | F G |\n");
      // Select only "D E" within measure 1
      const scoped = selectRange(sel, 2, 2, 2, 5);
      const result = selectMeasures(scoped);
      // Only the scoped elements D and E are included
      expect(result.cursors.length).to.equal(1);
      // D and E are separate notes (with spaces between them)
      expect(result.cursors[0].size).to.equal(2);
    });
  });

  describe("mixed content types", () => {
    it("selects notes, chords, and rests within measures", () => {
      const sel = toSelection("X:1\nK:C\nC [CEG] z | D |\n");
      const result = selectMeasures(sel);
      // Measure 1 contains: Note(C), Chord([CEG]), Rest(z)
      expect(result.cursors.length).to.equal(2);
      expect(result.cursors[0].size).to.equal(3);
    });

    it("handles grace groups", () => {
      const sel = toSelection("X:1\nK:C\n{g}C | D |\n");
      const result = selectMeasures(sel);
      expect(result.cursors.length).to.equal(2);
      // Measure 1 contains Grace_group and Note
      expect(result.cursors[0].size).to.equal(2);
    });

    it("handles tuplets", () => {
      const sel = toSelection("X:1\nK:C\n(3CDE | F |\n");
      const result = selectMeasures(sel);
      expect(result.cursors.length).to.equal(2);
      // Verify at least one Tuplet is found in first measure
      const hasTuplet = [...result.cursors[0]].some(id => {
        const node = findById(sel.root, id);
        return node?.tag === TAGS.Tuplet;
      });
      expect(hasTuplet).to.be.true;
    });

    it("handles multi-measure rests", () => {
      const sel = toSelection("X:1\nK:C\nC | Z4 | D |\n");
      const result = selectMeasures(sel);
      expect(result.cursors.length).to.equal(3);
      // Second cursor should contain a MultiMeasureRest
      const nodeId = [...result.cursors[1]][0];
      const node = findById(sel.root, nodeId);
      expect(node!.tag).to.equal(TAGS.MultiMeasureRest);
    });
  });

  describe("multi-tune files", () => {
    it("processes each tune body independently", () => {
      const sel = toSelection("X:1\nK:C\nC | D |\n\nX:2\nK:G\nG | A |\n");
      const result = selectMeasures(sel);
      // 2 measures from tune 1, 2 measures from tune 2
      expect(result.cursors.length).to.equal(4);
    });

    it("flushes remaining content at end of each tune", () => {
      // Tune without trailing barline
      const sel = toSelection("X:1\nK:C\nC | D\n\nX:2\nK:G\nG | A\n");
      const result = selectMeasures(sel);
      // Each tune has 2 measures (content before | and content after |)
      expect(result.cursors.length).to.equal(4);
    });
  });

  describe("multi-line tunes", () => {
    it("handles barlines across multiple Music_code lines", () => {
      const sel = toSelection("X:1\nK:C\nC D |\nE F |\n");
      const result = selectMeasures(sel);
      // Two measures: (C D) and (E F)
      expect(result.cursors.length).to.equal(2);
    });

    it("continues measure across line breaks", () => {
      const sel = toSelection("X:1\nK:C\nC D\nE | F |\n");
      const result = selectMeasures(sel);
      // Measure 1 spans lines: C D E (before first |), Measure 2: F
      expect(result.cursors.length).to.equal(2);
      // First measure should have 3 notes (C, D, E)
      expect(result.cursors[0].size).to.equal(3);
    });
  });

  describe("composition with other selectors", () => {
    it("selectMeasures then selectNotes returns notes from all measures", () => {
      const sel = toSelection("X:1\nK:C\nC D | E F |\n");
      const measures = selectMeasures(sel);
      const notes = selectNotes(measures);
      // All 4 notes: C, D, E, F
      expect(notes.cursors.length).to.equal(4);
    });
  });

  describe("edge cases", () => {
    it("handles no cursors in input (processes entire document)", () => {
      const sel = toSelection("X:1\nK:C\nC | D |\n");
      // Clear cursors to simulate empty scope
      const emptySel = { root: sel.root, cursors: [] };
      const result = selectMeasures(emptySel);
      // Should process entire document
      expect(result.cursors.length).to.equal(2);
    });

    it("handles root-only cursor (processes entire document)", () => {
      const sel = toSelection("X:1\nK:C\nC | D |\n");
      // Create a cursor containing only the root node
      const rootOnlySel = { root: sel.root, cursors: [new Set([sel.root.id])] };
      const result = selectMeasures(rootOnlySel);
      // Should process entire document
      expect(result.cursors.length).to.equal(2);
    });

    it("handles file with only barlines", () => {
      const sel = toSelection("X:1\nK:C\n| | |\n");
      const result = selectMeasures(sel);
      // No music elements, so foundMatch is false, returns original
      expect(result).to.equal(sel);
    });
  });
});
