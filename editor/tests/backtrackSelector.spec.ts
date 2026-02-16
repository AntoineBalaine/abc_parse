import { expect } from "chai";
import { describe, it } from "mocha";
import { TAGS, isTokenNode, getTokenData, CSNode } from "../src/csTree/types";
import { selectPreviousChordSymbol } from "../src/selectors/backtrackSelector";
import { ChordQuality } from "abc-parser/music-theory/types";
import { toSelection, findByTag, collectAll } from "./helpers";
import { Selection } from "../src/selection";

function findNodeByTag(root: CSNode, tag: string): CSNode | undefined {
  return collectAll(root).find((n) => n.tag === tag);
}

function selectionOnNode(root: CSNode, targetNode: CSNode): Selection {
  return {
    root,
    cursors: [new Set([targetNode.id])],
  };
}

describe("backtrackSelector", () => {
  describe("selectPreviousChordSymbol", () => {
    it("finds chord symbol on same line (basic case)", () => {
      const source = 'X:1\nK:C\n"Am" C D E|\n';
      const sel = toSelection(source);

      // Find the last Note node (E)
      const notes = findByTag(sel.root, TAGS.Note);
      expect(notes.length).to.be.greaterThan(0);
      const lastNote = notes[notes.length - 1];

      const newSel = selectionOnNode(sel.root, lastNote);
      const result = selectPreviousChordSymbol(newSel);

      expect(result).to.not.be.null;
      expect(result!.parsed.root).to.exist;
      expect(result!.parsed.quality).to.equal(ChordQuality.Minor);
    });

    it("returns nearest chord when multiple exist", () => {
      const source = 'X:1\nK:C\n"Am" C "G7" D E|\n';
      const sel = toSelection(source);

      // Find the last Note node (E)
      const notes = findByTag(sel.root, TAGS.Note);
      const lastNote = notes[notes.length - 1];

      const newSel = selectionOnNode(sel.root, lastNote);
      const result = selectPreviousChordSymbol(newSel);

      expect(result).to.not.be.null;
      expect(result!.parsed.quality).to.equal(ChordQuality.Dominant);
      expect(result!.parsed.extension).to.equal(7);
    });

    it("returns null when chord is on previous line (samePhysicalLine=true)", () => {
      const source = 'X:1\nK:C\n"Am" C D|\nE F G|\n';
      const sel = toSelection(source);

      // Find the E note on second line
      // We'll use the 4th note (E is after D)
      const notes = findByTag(sel.root, TAGS.Note);
      expect(notes.length).to.be.at.least(4);
      const eNote = notes[3]; // 4th note is E

      const newSel = selectionOnNode(sel.root, eNote);
      const result = selectPreviousChordSymbol(newSel, true);

      // Should return null because the chord is on a different physical line
      expect(result).to.be.null;
    });

    it("finds chord on previous line when samePhysicalLine=false", () => {
      const source = 'X:1\nK:C\n"Am" C D|\nE F G|\n';
      const sel = toSelection(source);

      // Find the E note on second line
      const notes = findByTag(sel.root, TAGS.Note);
      expect(notes.length).to.be.at.least(4);
      const eNote = notes[3];

      const newSel = selectionOnNode(sel.root, eNote);
      const result = selectPreviousChordSymbol(newSel, false);

      expect(result).to.not.be.null;
      expect(result!.parsed.quality).to.equal(ChordQuality.Minor);
    });

    it("returns null when no chord symbol exists", () => {
      const source = "X:1\nK:C\nC D E|\n";
      const sel = toSelection(source);

      const notes = findByTag(sel.root, TAGS.Note);
      const lastNote = notes[notes.length - 1];

      const newSel = selectionOnNode(sel.root, lastNote);
      const result = selectPreviousChordSymbol(newSel);

      expect(result).to.be.null;
    });

    it("skips non-chord annotations", () => {
      const source = 'X:1\nK:C\n"hello" C "Am" D E|\n';
      const sel = toSelection(source);

      const notes = findByTag(sel.root, TAGS.Note);
      const lastNote = notes[notes.length - 1];

      const newSel = selectionOnNode(sel.root, lastNote);
      const result = selectPreviousChordSymbol(newSel);

      expect(result).to.not.be.null;
      // Should find "Am", not "hello"
      expect(result!.parsed.quality).to.equal(ChordQuality.Minor);
    });

    it("handles empty selection", () => {
      const source = "X:1\nK:C\nC D E|\n";
      const sel = toSelection(source);
      const emptySel: Selection = { root: sel.root, cursors: [] };

      const result = selectPreviousChordSymbol(emptySel);
      expect(result).to.be.null;
    });

    it("handles various chord symbols", () => {
      const testCases = [
        { chord: "Cmaj7", quality: ChordQuality.Major, ext: 7 },
        { chord: "Dm7b5", quality: ChordQuality.Minor, ext: 7 },
        { chord: "G+", quality: ChordQuality.Augmented, ext: null },
        { chord: "F#m", quality: ChordQuality.Minor, ext: null },
      ];

      for (const tc of testCases) {
        const source = `X:1\nK:C\n"${tc.chord}" C D|\n`;
        const sel = toSelection(source);

        const notes = findByTag(sel.root, TAGS.Note);
        const lastNote = notes[notes.length - 1];

        const newSel = selectionOnNode(sel.root, lastNote);
        const result = selectPreviousChordSymbol(newSel);

        expect(result, `Failed for ${tc.chord}`).to.not.be.null;
        expect(result!.parsed.quality, `Quality mismatch for ${tc.chord}`).to.equal(tc.quality);
        expect(result!.parsed.extension, `Extension mismatch for ${tc.chord}`).to.equal(tc.ext);
      }
    });
  });
});
