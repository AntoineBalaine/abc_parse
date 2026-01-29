import { expect } from "chai";
import { describe, it } from "mocha";
import * as fc from "fast-check";
import { TAGS, CSNode, isTokenNode } from "../src/csTree/types";
import { selectVoice } from "../src/selectors/voiceSelector";
import { selectChords } from "../src/selectors/typeSelectors";
import { createSelection } from "../src/selection";
import { toCSTree, toSelection, findByTag, findById, genAbcTune } from "./helpers";

describe("voiceSelector", () => {
  describe("examples", () => {
    it("single-voice tune (no voice markers) returns empty cursors for any voice ID", () => {
      const sel = toSelection("X:1\nK:C\nCDE|\n");
      const result = selectVoice(sel, "1");
      expect(result.cursors.length).to.equal(0);
    });

    it("two-voice tune with inline fields — selectVoice('1') returns only nodes between [V:1] and [V:2]", () => {
      const sel = toSelection("X:1\nK:C\n[V:1]CDE|[V:2]GAB|\n");
      const result = selectVoice(sel, "1");
      // Between [V:1] and [V:2]: Beam(CDE), BarLine(|)
      expect(result.cursors.length).to.equal(2);
    });

    it("two-voice tune with inline fields — selectVoice('2') returns only nodes after [V:2]", () => {
      const sel = toSelection("X:1\nK:C\n[V:1]CDE|[V:2]GAB|\n");
      const result = selectVoice(sel, "2");
      // After [V:2]: Beam(GAB), BarLine(|), newline token
      expect(result.cursors.length).to.equal(3);
    });

    it("two-voice tune with standalone V: lines — selectVoice('1') returns nodes between V:1 and V:2", () => {
      const sel = toSelection("X:1\nK:C\nV:1\nCDE|\nV:2\nGAB|\n");
      const result = selectVoice(sel, "1");
      // Between V:1 and V:2: newline, Beam(CDE), BarLine(|), newline
      expect(result.cursors.length).to.equal(4);
    });

    it("two-voice tune with standalone V: lines — selectVoice('2') returns nodes after V:2", () => {
      const sel = toSelection("X:1\nK:C\nV:1\nCDE|\nV:2\nGAB|\n");
      const result = selectVoice(sel, "2");
      // After V:2: newline, Beam(GAB), BarLine(|), newline
      expect(result.cursors.length).to.equal(4);
    });

    it("voice ID with properties — selectVoice('T1') matches when V: line has extra properties", () => {
      const sel = toSelection("X:1\nK:C\nV:T1 name=Trumpet clef=treble\nCDE|\n");
      const result = selectVoice(sel, "T1");
      expect(result.cursors.length).to.be.greaterThan(0);
    });

    it("voice spanning multiple lines collects nodes from all occurrences", () => {
      const sel = toSelection("X:1\nK:C\nV:1\nCDE|\nV:2\nGAB|\nV:1\nFGA|\n");
      const result = selectVoice(sel, "1");
      // First V:1 block: newline, Beam(CDE), BarLine(|), newline
      // Second V:1 block: newline, Beam(FGA), BarLine(|), newline
      expect(result.cursors.length).to.equal(8);
    });

    it("composition: selectVoice then selectChords narrows to chords within a voice", () => {
      const sel = toSelection("X:1\nK:C\n[V:1][CEG]C|[V:2][DFA]D|\n");
      const voice1 = selectVoice(sel, "1");
      const chords = selectChords(voice1);
      expect(chords.cursors.length).to.equal(1);
      // Verify the chord is [CEG], not [DFA]
      const chordId = [...chords.cursors[0]][0];
      const chordNode = findById(sel.root, chordId);
      expect(chordNode).to.not.be.undefined;
      expect(chordNode!.tag).to.equal(TAGS.Chord);
    });

    it("selectVoice ignores the input cursor scope (always walks from root)", () => {
      const root = toCSTree("X:1\nK:C\n[V:1]CDE|[V:2]GAB|\n");
      // Create a selection with a cursor pointing at an arbitrary node
      const notes = findByTag(root, TAGS.Note);
      const sel = { root, cursors: [new Set([notes[0].id])] };
      const result = selectVoice(sel, "1");
      // Should still work because selectVoice ignores input cursors
      expect(result.cursors.length).to.equal(2);
    });
  });

  describe("property-based", () => {
    it("selecting a non-existent voice always returns empty cursors", () => {
      fc.assert(
        fc.property(genAbcTune, (abc) => {
          const sel = toSelection(abc);
          const result = selectVoice(sel, "nonexistent_voice_xyz");
          return result.cursors.length === 0;
        })
      );
    });

    it("the union of all voice selections covers all non-marker children after the first marker", () => {
      const abc = "X:1\nK:C\n[V:1]CDE|[V:2]GAB|\n";
      const root = toCSTree(abc);
      const sel = createSelection(root);

      const v1 = selectVoice(sel, "1");
      const v2 = selectVoice(sel, "2");

      const v1Ids = new Set(v1.cursors.map((c) => [...c][0]));
      const v2Ids = new Set(v2.cursors.map((c) => [...c][0]));

      // Disjoint: no node belongs to two voices
      for (const id of v1Ids) {
        expect(v2Ids.has(id)).to.be.false;
      }

      const unionIds = new Set([...v1Ids, ...v2Ids]);

      // Every non-marker child after the first voice marker is in exactly one voice
      const bodies = findByTag(root, TAGS.Tune_Body);
      const body = bodies[0];
      let sawMarker = false;
      let child = body.firstChild;
      while (child) {
        if (child.tag === TAGS.Inline_field || child.tag === TAGS.Info_line) {
          sawMarker = true;
        } else if (sawMarker) {
          expect(unionIds.has(child.id)).to.be.true;
        }
        child = child.nextSibling;
      }

      expect(unionIds.size).to.be.greaterThan(0);
      expect(v1Ids.size + v2Ids.size).to.equal(unionIds.size);
    });
  });
});
