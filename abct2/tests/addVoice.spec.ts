import { expect } from "chai";
import { describe, it } from "mocha";
import * as fc from "fast-check";
import { toCSTreeWithContext, formatSelection, findByTag, genAbcTune } from "./helpers";
import { TAGS } from "../src/csTree/types";
import { Selection } from "../src/selection";
import { addVoice, VoiceParams } from "../src/transforms/addVoice";

describe("addVoice", () => {
  describe("example-based", () => {
    it("adds V:T1 before K:C in the header", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nCDE|\n");
      const sel: Selection = { root, cursors: [new Set([root.id])] };
      addVoice(sel, "T1", {}, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("V:T1");
      // V: line must appear before K:
      const vIndex = formatted.indexOf("V:T1");
      const kIndex = formatted.indexOf("K:");
      expect(vIndex).to.be.lessThan(kIndex);
    });

    it("adds voice with name and clef parameters", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nCDE|\n");
      const sel: Selection = { root, cursors: [new Set([root.id])] };
      addVoice(sel, "T1", { name: "Trumpet", clef: "treble" }, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain('V:T1 name="Trumpet" clef=treble');
    });

    it("adds voice with transpose parameter", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nCDE|\n");
      const sel: Selection = { root, cursors: [new Set([root.id])] };
      addVoice(sel, "id", { transpose: -2 }, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("V:id transpose=-2");
    });

    it("inserts V: line after M: and before K: in a multi-line header", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nT:My Tune\nM:4/4\nK:C\nCDE|\n");
      const sel: Selection = { root, cursors: [new Set([root.id])] };
      addVoice(sel, "V1", {}, ctx);
      const formatted = formatSelection(sel);
      const mIndex = formatted.indexOf("M:4/4");
      const vIndex = formatted.indexOf("V:V1");
      const kIndex = formatted.indexOf("K:C");
      expect(mIndex).to.be.lessThan(vIndex);
      expect(vIndex).to.be.lessThan(kIndex);
    });

    it("adds two voices in insertion order before K:", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nCDE|\n");
      const sel: Selection = { root, cursors: [new Set([root.id])] };
      addVoice(sel, "V1", {}, ctx);
      addVoice(sel, "V2", {}, ctx);
      const formatted = formatSelection(sel);
      const v1Index = formatted.indexOf("V:V1");
      const v2Index = formatted.indexOf("V:V2");
      const kIndex = formatted.indexOf("K:C");
      expect(v1Index).to.be.lessThan(v2Index);
      expect(v2Index).to.be.lessThan(kIndex);
    });

    it("appends V: line at the end when no K: line exists", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nT:Test\nCDE|\n");
      const sel: Selection = { root, cursors: [new Set([root.id])] };
      addVoice(sel, "V1", {}, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("V:V1");
    });

    it("does not change the tune body after adding a voice", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nCDE|\n");
      const sel: Selection = { root, cursors: [new Set([root.id])] };
      const beforeBody = formatSelection(sel).split("\n").slice(-1)[0];
      addVoice(sel, "V1", {}, ctx);
      const afterBody = formatSelection(sel).split("\n").slice(-1)[0];
      expect(afterBody).to.equal(beforeBody);
    });
  });

  describe("property-based", () => {
    it("adding a voice always produces output containing V:<voiceId>", () => {
      fc.assert(
        fc.property(
          genAbcTune,
          fc.string({ minLength: 1, maxLength: 4 }).filter((s) => /^[a-z0-9]+$/.test(s)),
          (source, voiceId) => {
            const { root, ctx } = toCSTreeWithContext(source);
            const sel: Selection = { root, cursors: [new Set([root.id])] };
            addVoice(sel, voiceId, {}, ctx);
            const formatted = formatSelection(sel);
            expect(formatted).to.contain("V:" + voiceId);
          }
        ),
        { numRuns: 200 }
      );
    });

    it("K: line is always the last Info_line in the header after adding a voice", () => {
      fc.assert(
        fc.property(genAbcTune, (source) => {
          const { root, ctx } = toCSTreeWithContext(source);
          const sel: Selection = { root, cursors: [new Set([root.id])] };
          addVoice(sel, "test", {}, ctx);
          const formatted = formatSelection(sel);
          const lines = formatted.split("\n");
          // Find all info lines (lines matching X: pattern)
          const infoLines = lines.filter((l) => /^[A-Za-z]:/.test(l));
          if (infoLines.length === 0) return;
          const lastInfoLine = infoLines[infoLines.length - 1];
          // If there was a K: line, it should be last among info lines in the header
          if (infoLines.some((l) => l.startsWith("K:"))) {
            expect(lastInfoLine).to.match(/^K:/);
          }
        }),
        { numRuns: 200 }
      );
    });

    it("adding a voice does not change the number of Note nodes in the tree", () => {
      fc.assert(
        fc.property(genAbcTune, (source) => {
          const { root, ctx } = toCSTreeWithContext(source);
          const notesBefore = findByTag(root, TAGS.Note).length;
          const sel: Selection = { root, cursors: [new Set([root.id])] };
          addVoice(sel, "test", {}, ctx);
          const notesAfter = findByTag(root, TAGS.Note).length;
          expect(notesAfter).to.equal(notesBefore);
        }),
        { numRuns: 200 }
      );
    });
  });
});
