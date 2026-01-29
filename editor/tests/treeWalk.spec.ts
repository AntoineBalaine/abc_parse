import { expect } from "chai";
import { describe, it } from "mocha";
import * as fc from "fast-check";
import { CSNode, TAGS, isTokenNode, getTokenData, createCSNode } from "../src/csTree/types";
import {
  firstTokenData,
  lastTokenData,
  comparePositions,
  findNodeById,
  buildIdMap,
  findByTag as productionFindByTag,
  findFirstByTag,
} from "../src/selectors/treeWalk";
import { toCSTree, collectAll, findByTag, genAbcTune, genAbcWithChords } from "./helpers";

function collectTokenDatas(node: CSNode): { line: number; position: number }[] {
  const results: { line: number; position: number }[] = [];
  function walkSubtree(n: CSNode): void {
    if (isTokenNode(n)) {
      const td = getTokenData(n);
      results.push({ line: td.line, position: td.position });
    }
    let child = n.firstChild;
    while (child !== null) {
      walkSubtree(child);
      child = child.nextSibling;
    }
  }
  walkSubtree(node);
  return results;
}

describe("treeWalk", () => {
  describe("firstTokenData", () => {
    it("returns the token data for a single Token CSNode", () => {
      const root = toCSTree("X:1\nK:C\nC|\n");
      const notes = findByTag(root, TAGS.Note);
      expect(notes.length).to.be.greaterThan(0);
      const note = notes[0];
      // The Note's firstChild should be a Pitch, whose firstChild is the noteLetter token
      const result = firstTokenData(note);
      expect(result).to.not.be.null;
      expect(result!.lexeme).to.equal("C");
    });

    it("returns the leftmost token for a Note node (the noteLetter)", () => {
      const root = toCSTree("X:1\nK:C\n^C,2|\n");
      const notes = findByTag(root, TAGS.Note);
      const note = notes[0];
      const result = firstTokenData(note);
      expect(result).to.not.be.null;
      // The leftmost token in ^C,2 is the accidental ^
      expect(result!.lexeme).to.equal("^");
    });

    it("returns null for a CSNode with no Token descendants", () => {
      const emptyNode = createCSNode("Empty", 999, { type: "empty" });
      const result = firstTokenData(emptyNode);
      expect(result).to.be.null;
    });
  });

  describe("lastTokenData", () => {
    it("returns the last token in a Note with a Rhythm child", () => {
      const root = toCSTree("X:1\nK:C\nC2|\n");
      const notes = findByTag(root, TAGS.Note);
      const note = notes[0];
      const result = lastTokenData(note);
      expect(result).to.not.be.null;
      expect(result!.lexeme).to.equal("2");
    });

    it("returns the rightmost token of a Chord", () => {
      const root = toCSTree("X:1\nK:C\n[CEG]2|\n");
      const chords = findByTag(root, TAGS.Chord);
      expect(chords.length).to.equal(1);
      const chord = chords[0];
      const result = lastTokenData(chord);
      expect(result).to.not.be.null;
      // The rightmost token should be the rhythm "2" (after the closing bracket)
      expect(result!.lexeme).to.equal("2");
    });

    it("returns the tie token when a chord has a tie", () => {
      const root = toCSTree("X:1\nK:C\n[CE]-|\n");
      const chords = findByTag(root, TAGS.Chord);
      expect(chords.length).to.equal(1);
      const chord = chords[0];
      const result = lastTokenData(chord);
      expect(result).to.not.be.null;
      expect(result!.lexeme).to.equal("-");
    });

    it("returns null for a node with no token descendants", () => {
      const emptyNode = createCSNode("Empty", 999, { type: "empty" });
      const result = lastTokenData(emptyNode);
      expect(result).to.be.null;
    });
  });

  describe("comparePositions", () => {
    it("returns negative when a is before b on the same line", () => {
      expect(comparePositions(1, 5, 1, 10)).to.be.lessThan(0);
    });

    it("returns positive when a is on a later line than b", () => {
      expect(comparePositions(2, 0, 1, 99)).to.be.greaterThan(0);
    });

    it("returns 0 when positions are equal", () => {
      expect(comparePositions(3, 7, 3, 7)).to.equal(0);
    });

    it("returns negative when a is on an earlier line", () => {
      expect(comparePositions(1, 99, 2, 0)).to.be.lessThan(0);
    });
  });

  describe("findNodeById", () => {
    it("returns the correct node when it exists", () => {
      const root = toCSTree("X:1\nK:C\nCDE|\n");
      const notes = findByTag(root, TAGS.Note);
      expect(notes.length).to.be.greaterThan(0);
      const targetNode = notes[0];
      const found = findNodeById(root, targetNode.id);
      expect(found).to.not.be.null;
      expect(found!.id).to.equal(targetNode.id);
      expect(found!.tag).to.equal(targetNode.tag);
    });

    it("returns null when the ID is not in the tree", () => {
      const root = toCSTree("X:1\nK:C\nC|\n");
      const found = findNodeById(root, 999999);
      expect(found).to.be.null;
    });
  });

  describe("buildIdMap", () => {
    it("produces a map whose size equals the total number of nodes in the tree", () => {
      const root = toCSTree("X:1\nK:C\nCDE|\n");
      const allNodes = collectAll(root);
      const idMap = buildIdMap(root);
      expect(idMap.size).to.equal(allNodes.length);
    });

    it("entries are consistent with findNodeById", () => {
      const root = toCSTree("X:1\nK:C\n[CEG]2 D E|\n");
      const idMap = buildIdMap(root);
      for (const [id, node] of idMap) {
        const found = findNodeById(root, id);
        expect(found).to.not.be.null;
        expect(found!.id).to.equal(node.id);
        expect(found!.tag).to.equal(node.tag);
      }
    });
  });

  describe("findByTag", () => {
    it("finds all notes in a simple tune", () => {
      const root = toCSTree("X:1\nK:C\nCDE|\n");
      const notes = productionFindByTag(root, TAGS.Note);
      expect(notes.length).to.equal(3);
      notes.forEach((n) => expect(n.tag).to.equal(TAGS.Note));
    });

    it("finds all chords in a tune with chords", () => {
      const root = toCSTree("X:1\nK:C\n[CE] [DF] G|\n");
      const chords = productionFindByTag(root, TAGS.Chord);
      expect(chords.length).to.equal(2);
      chords.forEach((c) => expect(c.tag).to.equal(TAGS.Chord));
    });

    it("returns empty array when no matching nodes exist", () => {
      const root = toCSTree("X:1\nK:C\nCDE|\n");
      const chords = productionFindByTag(root, TAGS.Chord);
      expect(chords).to.deep.equal([]);
    });

    it("returns same results as test helper findByTag", () => {
      const root = toCSTree("X:1\nK:C\n[CEG] D E [FA]|\n");
      const helperResults = findByTag(root, TAGS.Chord);
      const productionResults = productionFindByTag(root, TAGS.Chord);
      expect(productionResults.length).to.equal(helperResults.length);
      expect(productionResults.map((n) => n.id).sort()).to.deep.equal(
        helperResults.map((n) => n.id).sort()
      );
    });
  });

  describe("findFirstByTag", () => {
    it("finds first note in a tune", () => {
      const root = toCSTree("X:1\nK:C\nCDE|\n");
      const firstNote = findFirstByTag(root, TAGS.Note);
      expect(firstNote).to.not.be.null;
      expect(firstNote!.tag).to.equal(TAGS.Note);
    });

    it("returns first match when multiple exist", () => {
      const root = toCSTree("X:1\nK:C\nCDE|\n");
      const allNotes = productionFindByTag(root, TAGS.Note);
      const firstNote = findFirstByTag(root, TAGS.Note);
      expect(allNotes.length).to.be.greaterThan(1);
      expect(firstNote).to.not.be.null;
      expect(firstNote!.id).to.equal(allNotes[0].id);
    });

    it("returns null when no match exists", () => {
      const root = toCSTree("X:1\nK:C\nCDE|\n");
      const result = findFirstByTag(root, TAGS.Chord);
      expect(result).to.be.null;
    });

    it("finds first tune body in multi-tune file", () => {
      const root = toCSTree("X:1\nK:C\nCDE|\n\nX:2\nK:G\nGAB|\n");
      const allBodies = productionFindByTag(root, TAGS.Tune_Body);
      const firstBody = findFirstByTag(root, TAGS.Tune_Body);
      expect(allBodies.length).to.equal(2);
      expect(firstBody).to.not.be.null;
      expect(firstBody!.id).to.equal(allBodies[0].id);
    });

    it("returns first in pre-order traversal (depth-first)", () => {
      const root = toCSTree("X:1\nK:C\n[CEG]|\n");
      const allNotes = productionFindByTag(root, TAGS.Note);
      const firstNote = findFirstByTag(root, TAGS.Note);
      expect(allNotes.length).to.equal(3);
      expect(firstNote!.id).to.equal(allNotes[0].id);
    });
  });

  describe("property-based", () => {
    it("firstTokenData(root) is never null for any parsed ABC tune", () => {
      fc.assert(
        fc.property(genAbcTune, (abc) => {
          const root = toCSTree(abc);
          const result = firstTokenData(root);
          return result !== null;
        })
      );
    });

    it("firstTokenData on a Chord returns a position <= all other non-sentinel token descendants", () => {
      fc.assert(
        fc.property(genAbcWithChords, (abc) => {
          const root = toCSTree(abc);
          const chords = findByTag(root, TAGS.Chord);
          for (const chord of chords) {
            const first = firstTokenData(chord);
            if (first === null) continue;
            const allTokens = collectTokenDatas(chord).filter((t) => t.position >= 0);
            for (const t of allTokens) {
              if (comparePositions(first.line, first.position, t.line, t.position) > 0) {
                return false;
              }
            }
          }
          return true;
        })
      );
    });

    it("lastTokenData on a Chord returns a position >= all other non-sentinel token descendants", () => {
      fc.assert(
        fc.property(genAbcWithChords, (abc) => {
          const root = toCSTree(abc);
          const chords = findByTag(root, TAGS.Chord);
          for (const chord of chords) {
            const last = lastTokenData(chord);
            if (last === null || last.position < 0) continue;
            const allTokens = collectTokenDatas(chord).filter((t) => t.position >= 0);
            for (const t of allTokens) {
              if (comparePositions(last.line, last.position, t.line, t.position) < 0) {
                return false;
              }
            }
          }
          return true;
        })
      );
    });
  });
});
