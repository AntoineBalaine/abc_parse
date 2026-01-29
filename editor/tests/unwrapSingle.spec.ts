import { expect } from "chai";
import { describe, it } from "mocha";
import * as fc from "fast-check";
import { toCSTreeWithContext, formatSelection, findByTag, genAbcWithChords } from "./helpers";
import { TAGS } from "../src/csTree/types";
import { Selection } from "../src/selection";
import { unwrapSingle } from "../src/transforms/unwrapSingle";
import { getNodeRhythm } from "../src/transforms/rhythm";

describe("unwrapSingle", () => {
  describe("example-based", () => {
    it("[C]2 (single-note chord with rhythm 2): result is C2", () => {
      const { root } = toCSTreeWithContext("X:1\nK:C\n[C]2|\n");
      const chords = findByTag(root, TAGS.Chord);
      expect(chords.length).to.equal(1);
      const sel: Selection = { root, cursors: [new Set([chords[0].id])] };
      unwrapSingle(sel);
      expect(chords[0].tag).to.equal(TAGS.Note);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("C2");
      expect(formatted).to.not.contain("[");
    });

    it("[C2] (note has rhythm 2, chord has no rhythm): result is C2", () => {
      const { root } = toCSTreeWithContext("X:1\nK:C\n[C2]|\n");
      const chords = findByTag(root, TAGS.Chord);
      expect(chords.length).to.equal(1);
      const sel: Selection = { root, cursors: [new Set([chords[0].id])] };
      unwrapSingle(sel);
      expect(chords[0].tag).to.equal(TAGS.Note);
      const r = getNodeRhythm(chords[0]);
      expect(r.numerator).to.equal(2);
      expect(r.denominator).to.equal(1);
    });

    it("[C] (no rhythm anywhere): result is C", () => {
      const { root } = toCSTreeWithContext("X:1\nK:C\n[C]|\n");
      const chords = findByTag(root, TAGS.Chord);
      const sel: Selection = { root, cursors: [new Set([chords[0].id])] };
      unwrapSingle(sel);
      expect(chords[0].tag).to.equal(TAGS.Note);
      const r = getNodeRhythm(chords[0]);
      expect(r.numerator).to.equal(1);
      expect(r.denominator).to.equal(1);
    });

    it("[C2]4 (chord rhythm 4, note rhythm 2): result is C4 (chord takes precedence)", () => {
      const { root } = toCSTreeWithContext("X:1\nK:C\n[C2]4|\n");
      const chords = findByTag(root, TAGS.Chord);
      const sel: Selection = { root, cursors: [new Set([chords[0].id])] };
      unwrapSingle(sel);
      expect(chords[0].tag).to.equal(TAGS.Note);
      const r = getNodeRhythm(chords[0]);
      expect(r.numerator).to.equal(4);
      expect(r.denominator).to.equal(1);
    });

    it("[C]- (single-note chord with tie): result is C-", () => {
      const { root } = toCSTreeWithContext("X:1\nK:C\n[C]-|\n");
      const chords = findByTag(root, TAGS.Chord);
      const sel: Selection = { root, cursors: [new Set([chords[0].id])] };
      unwrapSingle(sel);
      expect(chords[0].tag).to.equal(TAGS.Note);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("C-");
    });

    it("[CEG]2 (multi-note chord): result is unchanged", () => {
      const { root } = toCSTreeWithContext("X:1\nK:C\n[CEG]2|\n");
      const chords = findByTag(root, TAGS.Chord);
      const sel: Selection = { root, cursors: [new Set([chords[0].id])] };
      unwrapSingle(sel);
      expect(chords[0].tag).to.equal(TAGS.Chord);
    });

    it("two cursors selecting different single-note chords: both are unwrapped", () => {
      const { root } = toCSTreeWithContext("X:1\nK:C\n[C] [D]|\n");
      const chords = findByTag(root, TAGS.Chord);
      expect(chords.length).to.equal(2);
      const sel: Selection = { root, cursors: [new Set([chords[0].id]), new Set([chords[1].id])] };
      unwrapSingle(sel);
      expect(chords[0].tag).to.equal(TAGS.Note);
      expect(chords[1].tag).to.equal(TAGS.Note);
    });
  });

  describe("property-based", () => {
    it("unwrap-single on a single-note chord produces a Note at that position", () => {
      fc.assert(
        fc.property(genAbcWithChords, (source) => {
          const { root } = toCSTreeWithContext(source);
          const chords = findByTag(root, TAGS.Chord);
          const singleNoteChords = chords.filter(c => {
            const noteChildren: any[] = [];
            let current = c.firstChild;
            while (current) {
              if (current.tag === TAGS.Note) noteChildren.push(current);
              current = current.nextSibling;
            }
            return noteChildren.length === 1;
          });
          if (singleNoteChords.length === 0) return;
          const ids = new Set(singleNoteChords.map(c => c.id));
          const sel: Selection = { root, cursors: [ids] };
          unwrapSingle(sel);
          for (const chord of singleNoteChords) {
            expect(chord.tag).to.equal(TAGS.Note);
          }
        }),
        { numRuns: 1000 }
      );
    });

    it("chords with more than one Note are left unchanged", () => {
      fc.assert(
        fc.property(genAbcWithChords, (source) => {
          const { root } = toCSTreeWithContext(source);
          const chords = findByTag(root, TAGS.Chord);
          const multiNoteChords = chords.filter(c => {
            let noteCount = 0;
            let current = c.firstChild;
            while (current) {
              if (current.tag === TAGS.Note) noteCount++;
              current = current.nextSibling;
            }
            return noteCount > 1;
          });
          if (multiNoteChords.length === 0) return;
          const ids = new Set(multiNoteChords.map(c => c.id));
          const sel: Selection = { root, cursors: [ids] };
          unwrapSingle(sel);
          for (const chord of multiNoteChords) {
            expect(chord.tag).to.equal(TAGS.Chord);
          }
        }),
        { numRuns: 1000 }
      );
    });
  });
});
