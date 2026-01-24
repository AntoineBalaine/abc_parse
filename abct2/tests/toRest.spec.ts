import { expect } from "chai";
import { describe, it } from "mocha";
import * as fc from "fast-check";
import { toCSTreeWithContext, formatSelection, findByTag, genAbcTune, genAbcWithChords } from "./helpers";
import { TAGS } from "../src/csTree/types";
import { Selection } from "../src/selection";
import { toRest } from "../src/transforms/toRest";
import { getNodeRhythm } from "../src/transforms/rhythm";

describe("toRest", () => {
  describe("example-based", () => {
    it("converts Note C2 to z2", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nC2|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      toRest(sel, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("z2");
    });

    it("converts Note C (no rhythm) to z", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nC|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      toRest(sel, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("z");
      expect(formatted).to.not.contain("z2");
    });

    it("converts Note C- (note with tie) to z (tie discarded)", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nC-|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      toRest(sel, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("z");
      expect(formatted).to.not.contain("-");
    });

    it("converts Note C2- (rhythm and tie) to z2 (rhythm preserved, tie discarded)", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nC2-|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      toRest(sel, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("z2");
      expect(formatted).to.not.contain("-");
    });

    it("converts Note C2> (broken rhythm) to z2> (broken preserved)", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nC2>D|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      toRest(sel, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("z2>");
    });

    it("converts Chord [CEG]2 to z2", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\n[CEG]2|\n");
      const chords = findByTag(root, TAGS.Chord);
      const sel: Selection = { root, cursors: [new Set([chords[0].id])] };
      toRest(sel, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("z2");
    });

    it("converts Chord [CEG] with first Note having rhythm 3 to z3", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\n[C3EG]|\n");
      const chords = findByTag(root, TAGS.Chord);
      const sel: Selection = { root, cursors: [new Set([chords[0].id])] };
      toRest(sel, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("z3");
    });

    it("converts Chord [CEG] with no rhythms at all to z", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\n[CEG]|\n");
      const chords = findByTag(root, TAGS.Chord);
      const sel: Selection = { root, cursors: [new Set([chords[0].id])] };
      toRest(sel, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("z");
    });

    it("two cursors selecting different notes converts both to rests", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nC D E|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id]), new Set([notes[2].id])] };
      toRest(sel, ctx);
      const rests = findByTag(root, TAGS.Rest);
      expect(rests.length).to.be.greaterThanOrEqual(2);
      // Middle note should still be a Note
      const remainingNotes = findByTag(root, TAGS.Note);
      expect(remainingNotes.length).to.equal(1);
    });
  });

  describe("property-based", () => {
    it("after toRest, every selected node has tag TAGS.Rest", () => {
      fc.assert(
        fc.property(genAbcTune, (source) => {
          const { root, ctx } = toCSTreeWithContext(source);
          const notes = findByTag(root, TAGS.Note);
          if (notes.length === 0) return;
          const ids = new Set(notes.map(n => n.id));
          const sel: Selection = { root, cursors: [ids] };
          toRest(sel, ctx);
          // All selected IDs should now be Rest nodes
          for (const note of notes) {
            expect(note.tag).to.equal(TAGS.Rest);
          }
        }),
        { numRuns: 1000 }
      );
    });

    it("after toRest, the resulting Rest's rhythm equals the original Note's rhythm", () => {
      fc.assert(
        fc.property(genAbcTune, (source) => {
          const { root, ctx } = toCSTreeWithContext(source);
          const notes = findByTag(root, TAGS.Note);
          if (notes.length === 0) return;
          const rhythmsBefore = notes.map(n => getNodeRhythm(n));
          const ids = new Set(notes.map(n => n.id));
          const sel: Selection = { root, cursors: [ids] };
          toRest(sel, ctx);
          // Check rhythms are preserved
          for (let i = 0; i < notes.length; i++) {
            const rhythmAfter = getNodeRhythm(notes[i]);
            expect(rhythmAfter.numerator).to.equal(rhythmsBefore[i].numerator);
            expect(rhythmAfter.denominator).to.equal(rhythmsBefore[i].denominator);
          }
        }),
        { numRuns: 1000 }
      );
    });
  });
});
