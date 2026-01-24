import { expect } from "chai";
import { describe, it } from "mocha";
import * as fc from "fast-check";
import { toSelection, findByTag, genAbcTune } from "./helpers";
import { TAGS } from "../src/csTree/types";
import { pitch } from "../src/transforms/pitch";
import { selectNotes, selectChords, selectRests } from "../src/selectors/typeSelectors";
import { toAst } from "../src/csTree/toAst";
import { Pitch as PitchExpr } from "../../parse/types/Expr2";
import { toMidiPitch } from "../../parse/Visitors/Formatter2";
import { findChildByTag } from "../src/transforms/treeUtils";

describe("pitch", () => {
  describe("example-based", () => {
    it("returns [60] for a single Note C (middle C)", () => {
      const sel = selectNotes(toSelection("X:1\nK:C\nC|\n"));
      expect(pitch(sel)).to.deep.equal([60]);
    });

    it("returns [61] for a single Note ^C (C#)", () => {
      const sel = selectNotes(toSelection("X:1\nK:C\n^C|\n"));
      expect(pitch(sel)).to.deep.equal([61]);
    });

    it("returns [72] for a Note c (C5)", () => {
      const sel = selectNotes(toSelection("X:1\nK:C\nc|\n"));
      expect(pitch(sel)).to.deep.equal([72]);
    });

    it("returns [48] for a Note C, (C3)", () => {
      const sel = selectNotes(toSelection("X:1\nK:C\nC,|\n"));
      expect(pitch(sel)).to.deep.equal([48]);
    });

    it("returns the last note's MIDI value for a Chord [CEG]", () => {
      const sel = selectChords(toSelection("X:1\nK:C\n[CEG]|\n"));
      // Notes in source order: C(60), E(64), G(67). Last note is G = 67
      expect(pitch(sel)).to.deep.equal([67]);
    });

    it("returns the last note's MIDI value for a Chord [GEC] (source order)", () => {
      const sel = selectChords(toSelection("X:1\nK:C\n[GEC]|\n"));
      // CSTree preserves source order: G(67), E(64), C(60). Last note is C = 60.
      expect(pitch(sel)).to.deep.equal([60]);
    });

    it("returns [] for a Rest", () => {
      const sel = selectRests(toSelection("X:1\nK:C\nz|\n"));
      expect(pitch(sel)).to.deep.equal([]);
    });

    it("returns two MIDI values for two Notes", () => {
      const sel = selectNotes(toSelection("X:1\nK:C\nCD|\n"));
      expect(pitch(sel)).to.deep.equal([60, 62]);
    });

    it("returns [] for an empty selection", () => {
      const sel = toSelection("X:1\nK:C\nCDE|\n");
      sel.cursors = [];
      expect(pitch(sel)).to.deep.equal([]);
    });
  });

  describe("property-based", () => {
    it("all returned values are integers", () => {
      fc.assert(
        fc.property(genAbcTune, (source) => {
          const sel = selectNotes(toSelection(source));
          const values = pitch(sel);
          for (const v of values) {
            expect(Number.isInteger(v)).to.equal(true);
          }
        }),
        { numRuns: 200 }
      );
    });

    it("the number of returned values is <= the number of cursors", () => {
      fc.assert(
        fc.property(genAbcTune, (source) => {
          const sel = selectNotes(toSelection(source));
          const values = pitch(sel);
          expect(values.length).to.be.at.most(sel.cursors.length);
        }),
        { numRuns: 200 }
      );
    });

    it("for any Note, pitch equals toMidiPitch on its Pitch Expr", () => {
      fc.assert(
        fc.property(genAbcTune, (source) => {
          const sel = selectNotes(toSelection(source));
          if (sel.cursors.length === 0) return;
          const values = pitch(sel);
          const notes = findByTag(sel.root, TAGS.Note);
          const expected: number[] = [];
          for (const note of notes) {
            const pitchResult = findChildByTag(note, TAGS.Pitch);
            if (pitchResult) {
              const pitchExpr = toAst(pitchResult.node) as PitchExpr;
              expected.push(toMidiPitch(pitchExpr));
            }
          }
          expect(values).to.deep.equal(expected);
        }),
        { numRuns: 200 }
      );
    });
  });
});
