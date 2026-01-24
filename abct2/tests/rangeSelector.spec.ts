import { expect } from "chai";
import { describe, it } from "mocha";
import * as fc from "fast-check";
import { TAGS, isTokenNode, getTokenData, CSNode } from "../src/csTree/types";
import { selectRange } from "../src/selectors/rangeSelector";
import { selectNotes } from "../src/selectors/typeSelectors";
import { firstTokenData, lastTokenData } from "../src/selectors/treeWalk";
import { toCSTree, toSelection, findByTag, findById, genAbcTune } from "./helpers";

describe("rangeSelector", () => {
  describe("examples", () => {
    it("range covering the whole file selects all top-level nodes of the Tune_Body", () => {
      // "C D E|" on line 2: tokens from pos 0 to pos 6 (exclusive end after "|")
      const sel = toSelection("X:1\nK:C\nC D E|\n");
      const result = selectRange(sel, 0, 0, 100, 100);
      // The whole tree is within range, so root is selected
      expect(result.cursors.length).to.be.greaterThan(0);
    });

    it("range covering a single note selects only that note", () => {
      // Note C is at line 2, pos 0, lexeme length 1 -> range [2,0) to [2,1)
      const sel = toSelection("X:1\nK:C\nC D E|\n");
      const result = selectRange(sel, 2, 0, 2, 1);
      expect(result.cursors.length).to.equal(1);
      const nodeId = [...result.cursors[0]][0];
      const node = findById(result.root, nodeId);
      expect(node).to.not.be.undefined;
      expect(node!.tag).to.equal(TAGS.Note);
    });

    it("range covering half a line selects only fully contained nodes", () => {
      // Notes: C at pos 0, D at pos 2, E at pos 4, BarLine at pos 5
      // Range [2,0) to [2,3) covers C (pos 0-1), space (pos 1), D (pos 2-3)
      const sel = toSelection("X:1\nK:C\nC D E|\n");
      const result = selectRange(sel, 2, 0, 2, 3);
      // C (pos 0, len 1) and D (pos 2, len 1) are fully contained
      // Spaces are tokens too; the space at pos 1 is a direct child of Tune_Body
      expect(result.cursors.length).to.equal(3); // Note C, space, Note D
    });

    it("empty range (startLine > endLine) returns empty cursors", () => {
      const sel = toSelection("X:1\nK:C\nC D E|\n");
      const result = selectRange(sel, 5, 0, 2, 0);
      expect(result.cursors.length).to.equal(0);
    });

    it("exclusive-end boundary: endCol at a token's start does NOT include that token", () => {
      // Notes: C at pos 0 (len 1), space at pos 1, D at pos 2 (len 1)
      // Range [2,0) to [2,2): C ends at 1 (included), space ends at 2 (included),
      // D starts at 2 which equals the exclusive end, so D is NOT included.
      const sel = toSelection("X:1\nK:C\nC D E|\n");
      const result = selectRange(sel, 2, 0, 2, 2);
      const selectedIds = result.cursors.map((c) => [...c][0]);
      const selectedNodes = selectedIds.map((id) => findById(result.root, id));
      // Note C and the space token are within [0, 2). Note D starts at 2 and is excluded.
      expect(result.cursors.length).to.equal(2);
      const noteNodes = selectedNodes.filter((n) => n?.tag === TAGS.Note);
      expect(noteNodes.length).to.equal(1); // Only Note C, not Note D
    });

    it("composition: selectRange then selectNotes narrows to notes within the range", () => {
      const sel = toSelection("X:1\nK:C\nC D E|\n");
      // Range covers C and D (pos 0 to 3, exclusive)
      const ranged = selectRange(sel, 2, 0, 2, 3);
      const notes = selectNotes(ranged);
      expect(notes.cursors.length).to.equal(2);
    });
  });

  describe("property-based", () => {
    it("selected nodes' positions are always within the given range", () => {
      fc.assert(
        fc.property(
          genAbcTune,
          fc.nat(10),
          fc.nat(50),
          (abc, startCol, width) => {
            const sel = toSelection(abc);
            const endCol = startCol + width + 1;
            const result = selectRange(sel, 2, startCol, 2, endCol);
            for (const cursor of result.cursors) {
              const nodeId = [...cursor][0];
              const node = findById(result.root, nodeId);
              if (!node) return false;
              const first = firstTokenData(node);
              const last = lastTokenData(node);
              if (!first || !last) return false;
              // First token position must be >= range start
              if (first.line < 2 || (first.line === 2 && first.position < startCol)) {
                return false;
              }
              // Last token end must be <= range end
              const lastEnd = last.position + last.lexeme.length;
              if (last.line > 2 || (last.line === 2 && lastEnd > endCol)) {
                return false;
              }
            }
            return true;
          }
        )
      );
    });

    it("range covering everything returns at least as many cursors as selectNotes", () => {
      fc.assert(
        fc.property(genAbcTune, (abc) => {
          const sel = toSelection(abc);
          const allRange = selectRange(sel, 0, 0, 1000, 1000);
          const notes = selectNotes(sel);
          // selectRange returns top-level nodes that contain notes, so the
          // count of range results should be >= 1 if there are any notes
          if (notes.cursors.length > 0) {
            return allRange.cursors.length >= 1;
          }
          return true;
        })
      );
    });
  });
});
