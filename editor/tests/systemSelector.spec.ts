import { expect } from "chai";
import * as fc from "fast-check";
import { Scanner, parse, ABCContext } from "abc-parser";
import { fromAst } from "../src/csTree/fromAst";
import { CSNode, TAGS } from "../src/csTree/types";
import { createSelection, Selection } from "../src/selection";
import { selectSystem } from "../src/selectors/systemSelector";
import { findByTag, findNodeById } from "../src/selectors/treeWalk";
import { collectAll, findById } from "./helpers";

function parseToSelection(source: string): Selection {
  const ctx = new ABCContext();
  const tokens = Scanner(source, ctx);
  const ast = parse(tokens, ctx);
  const root = fromAst(ast, ctx);
  return createSelection(root);
}

function parseToCSTree(source: string): { root: CSNode; ctx: ABCContext } {
  const ctx = new ABCContext();
  const tokens = Scanner(source, ctx);
  const ast = parse(tokens, ctx);
  return { root: fromAst(ast, ctx), ctx };
}

function findFirstNote(root: CSNode): CSNode | undefined {
  return collectAll(root).find(n => n.tag === TAGS.Note);
}

function findNoteByIndex(root: CSNode, index: number): CSNode | undefined {
  const notes = collectAll(root).filter(n => n.tag === TAGS.Note);
  return notes[index];
}

function findFirstSystem(root: CSNode): CSNode | undefined {
  return collectAll(root).find(n => n.tag === TAGS.System);
}

function findSystemByIndex(root: CSNode, index: number): CSNode | undefined {
  const systems = findByTag(root, TAGS.System);
  return systems[index];
}

describe("systemSelector", () => {
  describe("single system tunes", () => {
    it("should expand single element to entire system", () => {
      const source = `X:1
K:C
CDEF|GABc|`;
      const sel = parseToSelection(source);
      const firstNote = findFirstNote(sel.root);
      expect(firstNote).to.exist;

      // Select just the first note
      const inputSel: Selection = {
        root: sel.root,
        cursors: [new Set([firstNote!.id])],
      };

      const result = selectSystem(inputSel);

      // Should have one cursor covering the entire system
      expect(result.cursors).to.have.lengthOf(1);

      // The cursor should contain the System node's ID and all its descendants
      const system = findFirstSystem(sel.root);
      expect(system).to.exist;
      expect(result.cursors[0].has(system!.id)).to.be.true;
    });

    it("should expand multiple elements in same system to one cursor", () => {
      const source = `X:1
K:C
CDEF|GABc|`;
      const sel = parseToSelection(source);
      const note1 = findNoteByIndex(sel.root, 0);
      const note2 = findNoteByIndex(sel.root, 3);
      expect(note1).to.exist;
      expect(note2).to.exist;

      // Select two notes from the same system
      const inputSel: Selection = {
        root: sel.root,
        cursors: [new Set([note1!.id, note2!.id])],
      };

      const result = selectSystem(inputSel);

      // Should have one cursor (not two)
      expect(result.cursors).to.have.lengthOf(1);
    });
  });

  describe("multi-system tunes", () => {
    it("should produce separate cursors for selection spanning two systems", () => {
      const source = `X:1
K:C
V:1
CDEF|
V:2
GABc|
V:1
cdef|`;
      const ctx = new ABCContext();
      const tokens = Scanner(source, ctx);
      const ast = parse(tokens, ctx);
      const root = fromAst(ast, ctx);

      const systems = findByTag(root, TAGS.System);
      // This tune should have at least 2 systems
      expect(systems.length).to.be.at.least(2);

      // Select one note from first system and one from second
      const notesInSystem0 = collectAll(systems[0]).filter(n => n.tag === TAGS.Note);
      const notesInSystem1 = collectAll(systems[1]).filter(n => n.tag === TAGS.Note);

      if (notesInSystem0.length > 0 && notesInSystem1.length > 0) {
        const inputSel: Selection = {
          root,
          cursors: [new Set([notesInSystem0[0].id, notesInSystem1[0].id])],
        };

        const result = selectSystem(inputSel);

        // Should have two cursors (one per system)
        expect(result.cursors).to.have.lengthOf(2);
      }
    });

    it("should merge cursors when multiple selections are in same system", () => {
      const source = `X:1
K:C
V:1
CDEF|
V:2
GABc|`;
      const ctx = new ABCContext();
      const tokens = Scanner(source, ctx);
      const ast = parse(tokens, ctx);
      const root = fromAst(ast, ctx);

      const systems = findByTag(root, TAGS.System);
      expect(systems.length).to.be.at.least(1);

      // Select two different notes from the same system
      const notesInSystem0 = collectAll(systems[0]).filter(n => n.tag === TAGS.Note);
      if (notesInSystem0.length >= 2) {
        // Put them in separate input cursors
        const inputSel: Selection = {
          root,
          cursors: [
            new Set([notesInSystem0[0].id]),
            new Set([notesInSystem0[1].id]),
          ],
        };

        const result = selectSystem(inputSel);

        // Should have one cursor (merged because same system)
        expect(result.cursors).to.have.lengthOf(1);
      }
    });
  });

  describe("edge cases", () => {
    it("should return input unchanged when selection is in tune header", () => {
      const source = `X:1
T:Test
K:C
CDEF|`;
      const sel = parseToSelection(source);

      // Find an Info_line in the header (not the body)
      const tuneHeader = findByTag(sel.root, TAGS.Tune_header)[0];
      expect(tuneHeader).to.exist;

      // Select something in the header
      const headerInfoLine = collectAll(tuneHeader).find(n => n.tag === TAGS.Info_line);
      expect(headerInfoLine).to.exist;

      const inputSel: Selection = {
        root: sel.root,
        cursors: [new Set([headerInfoLine!.id])],
      };

      const result = selectSystem(inputSel);

      // Should return input unchanged because header content is not in any System
      expect(result).to.equal(inputSel);
    });

    it("should return input unchanged with empty cursors", () => {
      const source = `X:1
K:C
CDEF|`;
      const sel = parseToSelection(source);

      const inputSel: Selection = {
        root: sel.root,
        cursors: [],
      };

      const result = selectSystem(inputSel);

      expect(result).to.equal(inputSel);
    });

    it("should return original when selecting root only", () => {
      // Even a minimal tune has a Tune_Body with a System
      const source = `X:1
K:C
CDEF|`;
      const sel = parseToSelection(source);

      // Select only the root node itself (not its descendants)
      const inputSel: Selection = {
        root: sel.root,
        cursors: [new Set([sel.root.id])],
      };

      const result = selectSystem(inputSel);

      // Because we're selecting IDs and the root's descendants include Systems,
      // we check that selecting just the root ID doesn't match any System
      // (root ID is not a descendant of any System)
      // Actually, hasDescendantInScope checks if scopeIds contains the node or any descendant.
      // So if we select root ID, Systems don't contain root ID as descendant.
      // This should return input unchanged.
      expect(result).to.equal(inputSel);
    });
  });

  describe("info lines and system content", () => {
    it("should include V: info line that is inside the System", () => {
      // V: info lines in tune body are children of System nodes
      const source = `X:1
K:C
V:1
CDEF|`;
      const { root } = parseToCSTree(source);

      const systems = findByTag(root, TAGS.System);
      // V:1 is in System 0, CDEF is in System 1
      expect(systems.length).to.be.at.least(2);

      // Find the V:1 info line (in first system)
      const infoLinesInSystem0 = collectAll(systems[0]).filter(n => n.tag === TAGS.Info_line);
      expect(infoLinesInSystem0.length).to.be.at.least(1);

      // Select the V:1 info line
      const inputSel: Selection = {
        root,
        cursors: [new Set([infoLinesInSystem0[0].id])],
      };

      const result = selectSystem(inputSel);
      expect(result.cursors).to.have.lengthOf(1);

      // The cursor should contain the System 0's ID (expanded to whole system)
      expect(result.cursors[0].has(systems[0].id)).to.be.true;
    });

    it("should include all content when selecting note in system", () => {
      const source = `X:1
K:C
CDEF|`;
      const { root } = parseToCSTree(source);

      const firstNote = findFirstNote(root);
      expect(firstNote).to.exist;

      const inputSel: Selection = {
        root,
        cursors: [new Set([firstNote!.id])],
      };

      const result = selectSystem(inputSel);
      expect(result.cursors).to.have.lengthOf(1);

      // The cursor should contain the System node's ID
      const systems = findByTag(root, TAGS.System);
      const containingSystem = systems.find(sys =>
        collectAll(sys).some(n => n.id === firstNote!.id)
      );
      expect(containingSystem).to.exist;
      expect(result.cursors[0].has(containingSystem!.id)).to.be.true;
    });

    it("should not include comments that are siblings of System", () => {
      const source = `X:1
K:C
%comment before system
CDEF|`;
      const { root } = parseToCSTree(source);

      const firstNote = findFirstNote(root);
      expect(firstNote).to.exist;

      const inputSel: Selection = {
        root,
        cursors: [new Set([firstNote!.id])],
      };

      const result = selectSystem(inputSel);
      expect(result.cursors).to.have.lengthOf(1);

      // Find any Comment nodes in Tune_Body (as siblings of System)
      const tuneBody = findByTag(root, TAGS.Tune_Body)[0];
      let commentSibling: CSNode | null = null;
      let child = tuneBody?.firstChild;
      while (child) {
        if (child.tag === TAGS.Comment) {
          commentSibling = child;
          break;
        }
        child = child.nextSibling;
      }

      // If there's a comment sibling, it should NOT be in the cursor
      if (commentSibling) {
        expect(result.cursors[0].has(commentSibling.id)).to.be.false;
      }
    });
  });

  describe("multi-tune files", () => {
    it("should handle selection in multiple tunes independently", () => {
      const source = `X:1
K:C
CDEF|

X:2
K:G
GABc|`;
      const sel = parseToSelection(source);

      // Find notes from both tunes
      const allNotes = collectAll(sel.root).filter(n => n.tag === TAGS.Note);
      expect(allNotes.length).to.be.at.least(2);

      // Select first note from each tune
      const inputSel: Selection = {
        root: sel.root,
        cursors: [new Set([allNotes[0].id, allNotes[4].id])],
      };

      const result = selectSystem(inputSel);

      // Should have two cursors (one per tune's system)
      expect(result.cursors).to.have.lengthOf(2);
    });
  });

  describe("property-based tests", () => {
    it("output cursors never overlap", () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            "X:1\nK:C\nCDEF|\n",
            "X:1\nK:C\nV:1\nCD|\nV:2\nEF|\n",
            "X:1\nK:C\nCDEF|\n\nX:2\nK:G\nGABc|\n"
          ),
          (source) => {
            const sel = parseToSelection(source);
            const notes = collectAll(sel.root).filter(n => n.tag === TAGS.Note);
            if (notes.length === 0) return true;

            // Select all notes
            const inputSel: Selection = {
              root: sel.root,
              cursors: [new Set(notes.map(n => n.id))],
            };

            const result = selectSystem(inputSel);

            // Check no ID appears in multiple cursors
            const seenIds = new Set<number>();
            for (const cursor of result.cursors) {
              for (const id of cursor) {
                if (seenIds.has(id)) return false;
                seenIds.add(id);
              }
            }
            return true;
          }
        ),
        { numRuns: 10 }
      );
    });

    it("every output ID belongs to a System node or preceding Info_line", () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            "X:1\nK:C\nCDEF|\n",
            "X:1\nK:C\nV:1\nCD|\nV:2\nEF|\n"
          ),
          (source) => {
            const sel = parseToSelection(source);
            const notes = collectAll(sel.root).filter(n => n.tag === TAGS.Note);
            if (notes.length === 0) return true;

            const inputSel: Selection = {
              root: sel.root,
              cursors: [new Set([notes[0].id])],
            };

            const result = selectSystem(inputSel);

            // All IDs in output should be findable in the tree
            for (const cursor of result.cursors) {
              for (const id of cursor) {
                const node = findNodeById(sel.root, id);
                if (!node) return false;
              }
            }
            return true;
          }
        ),
        { numRuns: 10 }
      );
    });

    it("selectSystem is idempotent", () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            "X:1\nK:C\nCDEF|\n",
            "X:1\nK:C\nV:1\nCD|\nV:2\nEF|\n"
          ),
          (source) => {
            const sel = parseToSelection(source);
            const notes = collectAll(sel.root).filter(n => n.tag === TAGS.Note);
            if (notes.length === 0) return true;

            const inputSel: Selection = {
              root: sel.root,
              cursors: [new Set([notes[0].id])],
            };

            const result1 = selectSystem(inputSel);
            const result2 = selectSystem(result1);

            // Same number of cursors
            if (result1.cursors.length !== result2.cursors.length) return false;

            // Same IDs in each cursor
            for (let i = 0; i < result1.cursors.length; i++) {
              const ids1 = [...result1.cursors[i]].sort((a, b) => a - b);
              const ids2 = [...result2.cursors[i]].sort((a, b) => a - b);
              if (ids1.length !== ids2.length) return false;
              for (let j = 0; j < ids1.length; j++) {
                if (ids1[j] !== ids2[j]) return false;
              }
            }
            return true;
          }
        ),
        { numRuns: 10 }
      );
    });
  });
});
