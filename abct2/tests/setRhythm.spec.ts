import { expect } from "chai";
import { describe, it } from "mocha";
import * as fc from "fast-check";
import { toCSTreeWithContext, formatSelection, findByTag, genAbcTune, genRational } from "./helpers";
import { TAGS } from "../src/csTree/types";
import { Selection } from "../src/selection";
import { createRational } from "abc-parser";
import { setRhythm } from "../src/transforms/setRhythm";
import { getNodeRhythm } from "../src/transforms/rhythm";

describe("setRhythm", () => {
  describe("example-based", () => {
    it("set-rhythm({3, 4}) on Note C2: result is C3/4", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nC2|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      setRhythm(sel, createRational(3, 4), ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("C3/4");
    });

    it("set-rhythm({2, 1}) on Rest z: result is z2", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nz|\n");
      const rests = findByTag(root, TAGS.Rest);
      const sel: Selection = { root, cursors: [new Set([rests[0].id])] };
      setRhythm(sel, createRational(2, 1), ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("z2");
    });

    it("set-rhythm({1, 1}) on Note C4: result is C (rhythm removed)", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nC4|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      setRhythm(sel, createRational(1, 1), ctx);
      const formatted = formatSelection(sel);
      // The body should just have C with no rhythm number
      const body = formatted.split("\n")[2];
      expect(body.trim()).to.match(/^C\|?$/);
    });

    it("set-rhythm on Chord [CEG]2: changes chord rhythm", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\n[CEG]2|\n");
      const chords = findByTag(root, TAGS.Chord);
      const sel: Selection = { root, cursors: [new Set([chords[0].id])] };
      setRhythm(sel, createRational(3, 4), ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("3/4");
    });

    it("set-rhythm({3, 4}) on Note C2>: result is C3/4> (broken preserved)", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nC2>D|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      setRhythm(sel, createRational(3, 4), ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("C3/4>");
    });

    it("set-rhythm({1, 1}) on Note C2>: result is C> (broken preserved)", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nC2>D|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      setRhythm(sel, createRational(1, 1), ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("C>");
    });

    it("two cursors selecting different notes: both get the new rhythm", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nC D|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id]), new Set([notes[1].id])] };
      setRhythm(sel, createRational(3, 1), ctx);
      for (const note of notes) {
        const r = getNodeRhythm(note);
        expect(r.numerator).to.equal(3);
        expect(r.denominator).to.equal(1);
      }
    });
  });

  describe("property-based", () => {
    it("after setRhythm, every selected node's rhythm equals the given rational", () => {
      fc.assert(
        fc.property(genAbcTune, genRational, (source, rational) => {
          const { root, ctx } = toCSTreeWithContext(source);
          const notes = findByTag(root, TAGS.Note);
          if (notes.length === 0) return;
          const ids = new Set(notes.map(n => n.id));
          const sel: Selection = { root, cursors: [ids] };
          setRhythm(sel, rational, ctx);
          for (const note of notes) {
            const r = getNodeRhythm(note);
            expect(r.numerator).to.equal(rational.numerator);
            expect(r.denominator).to.equal(rational.denominator);
          }
        }),
        { numRuns: 1000 }
      );
    });

    it("set-rhythm with {1, 1} on a node without a broken token removes the Rhythm child", () => {
      fc.assert(
        fc.property(genAbcTune, (source) => {
          const { root, ctx } = toCSTreeWithContext(source);
          const notes = findByTag(root, TAGS.Note);
          if (notes.length === 0) return;
          const ids = new Set(notes.map(n => n.id));
          const sel: Selection = { root, cursors: [ids] };
          setRhythm(sel, createRational(1, 1), ctx);
          for (const note of notes) {
            const r = getNodeRhythm(note);
            expect(r.numerator).to.equal(1);
            expect(r.denominator).to.equal(1);
          }
        }),
        { numRuns: 1000 }
      );
    });
  });
});
