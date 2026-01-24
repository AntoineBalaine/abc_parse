import { expect } from "chai";
import { describe, it } from "mocha";
import * as fc from "fast-check";
import { toCSTreeWithContext, formatSelection, findByTag, genAbcTune } from "./helpers";
import { TAGS } from "../src/csTree/types";
import { ABCContext } from "../../parse/parsers/Context";
import { Selection } from "../src/selection";
import { transpose } from "../src/transforms/transpose";
import { toAst } from "../src/csTree/toAst";
import { Pitch } from "../../parse/types/Expr2";
import { toMidiPitch } from "../../parse/Visitors/Formatter2";
import { findChildByTag } from "../src/transforms/treeUtils";

function getNoteMidi(noteNode: any): number {
  const pitchResult = findChildByTag(noteNode, TAGS.Pitch);
  if (!pitchResult) throw new Error("No pitch child");
  const pitchExpr = toAst(pitchResult.node) as Pitch;
  return toMidiPitch(pitchExpr);
}

describe("transpose", () => {
  describe("example-based", () => {
    it("transposes C by 2 semitones to D", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nC|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      transpose(sel, 2, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("D");
    });

    it("transposes B by 1 semitone to c (crosses octave boundary)", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nB|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      transpose(sel, 1, ctx);
      const midi = getNoteMidi(notes[0]);
      expect(midi).to.equal(72); // c (one octave above middle C)
    });

    it("transposes a chord [CEG] by 7 semitones", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\n[CEG]|\n");
      const chords = findByTag(root, TAGS.Chord);
      const sel: Selection = { root, cursors: [new Set([chords[0].id])] };
      transpose(sel, 7, ctx);
      const chordNotes = findByTag(chords[0], TAGS.Note);
      const midis = chordNotes.map(n => getNoteMidi(n));
      expect(midis[0]).to.equal(67); // G
      expect(midis[1]).to.equal(71); // B
      expect(midis[2]).to.equal(74); // d
    });

    it("transposes only the selected note when cursor selects one note", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nC D E|\n");
      const notes = findByTag(root, TAGS.Note);
      const midiBefore = notes.map(n => getNoteMidi(n));
      const sel: Selection = { root, cursors: [new Set([notes[1].id])] };
      transpose(sel, 2, ctx);
      expect(getNoteMidi(notes[0])).to.equal(midiBefore[0]);
      expect(getNoteMidi(notes[1])).to.equal(midiBefore[1] + 2);
      expect(getNoteMidi(notes[2])).to.equal(midiBefore[2]);
    });

    it("two cursors selecting different notes transposes both independently", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nC D E|\n");
      const notes = findByTag(root, TAGS.Note);
      const midiBefore = notes.map(n => getNoteMidi(n));
      const sel: Selection = { root, cursors: [new Set([notes[0].id]), new Set([notes[2].id])] };
      transpose(sel, 3, ctx);
      expect(getNoteMidi(notes[0])).to.equal(midiBefore[0] + 3);
      expect(getNoteMidi(notes[1])).to.equal(midiBefore[1]);
      expect(getNoteMidi(notes[2])).to.equal(midiBefore[2] + 3);
    });

    it("transpose preserves rhythm: C2 transposed by 2 gives D2", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nC2|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      transpose(sel, 2, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("D2");
    });
  });

  describe("property-based", () => {
    it("transpose(n) then transpose(-n) preserves MIDI values", () => {
      fc.assert(
        fc.property(
          genAbcTune,
          fc.integer({ min: -12, max: 12 }),
          (source, semitones) => {
            const { root, ctx } = toCSTreeWithContext(source);
            const notes = findByTag(root, TAGS.Note);
            if (notes.length === 0) return;
            const midiBefore = notes.map(n => getNoteMidi(n));
            // Skip if any note is out of range or would go out of range
            if (midiBefore.some(m => m < 0 || m > 127 || m + semitones < 0 || m + semitones > 127)) return;
            const ids = new Set(notes.map(n => n.id));
            const sel: Selection = { root, cursors: [ids] };
            transpose(sel, semitones, ctx);
            transpose(sel, -semitones, ctx);
            const midiAfter = notes.map(n => getNoteMidi(n));
            expect(midiAfter).to.deep.equal(midiBefore);
          }
        ),
        { numRuns: 1000 }
      );
    });

    it("transpose(0) produces formatted output identical to the input", () => {
      fc.assert(
        fc.property(genAbcTune, (source) => {
          const { root, ctx } = toCSTreeWithContext(source);
          const before = formatSelection({ root, cursors: [] });
          const notes = findByTag(root, TAGS.Note);
          if (notes.length === 0) return;
          const ids = new Set(notes.map(n => n.id));
          const sel: Selection = { root, cursors: [ids] };
          transpose(sel, 0, ctx);
          const after = formatSelection(sel);
          expect(after).to.equal(before);
        }),
        { numRuns: 1000 }
      );
    });

    it("transpose(12) shifts all selected notes up by one octave", () => {
      fc.assert(
        fc.property(genAbcTune, (source) => {
          const { root, ctx } = toCSTreeWithContext(source);
          const notes = findByTag(root, TAGS.Note);
          if (notes.length === 0) return;
          const midiBefore = notes.map(n => getNoteMidi(n));
          // Skip if any note would go out of valid MIDI range after transposition
          if (midiBefore.some(m => m + 12 > 127 || m < 0)) return;
          const ids = new Set(notes.map(n => n.id));
          const sel: Selection = { root, cursors: [ids] };
          transpose(sel, 12, ctx);
          const midiAfter = notes.map(n => getNoteMidi(n));
          for (let i = 0; i < notes.length; i++) {
            expect(midiAfter[i]).to.equal(midiBefore[i] + 12);
          }
        }),
        { numRuns: 1000 }
      );
    });
  });
});
