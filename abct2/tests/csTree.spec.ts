import { expect } from "chai";
import { describe, it } from "mocha";
import * as fc from "fast-check";
import { TAGS } from "../src/csTree/types";
import { childrenVisitor } from "../src/csTree/fromAst";
import { toCSTree, collectAll, collectSubtree, findByTag, siblingCount, genAbcTune } from "./helpers";

describe("csTree - fromAst", () => {
  describe("properties", () => {
    it("every CSNode has a tag matching one of the TAGS entries", () => {
      const validTags = new Set(Object.values(TAGS));
      fc.assert(
        fc.property(genAbcTune, (abc) => {
          const root = toCSTree(abc);
          const allNodes = collectAll(root);
          for (const node of allNodes) {
            if (!validTags.has(node.tag)) return false;
          }
          return true;
        })
      );
    });

    it("node.id equals node.node.id for every CSNode", () => {
      fc.assert(
        fc.property(genAbcTune, (abc) => {
          const root = toCSTree(abc);
          const allNodes = collectAll(root);
          for (const node of allNodes) {
            if (node.id !== node.node.id) return false;
          }
          return true;
        })
      );
    });

    it("Token CSNodes are always leaves (firstChild is null)", () => {
      fc.assert(
        fc.property(genAbcTune, (abc) => {
          const root = toCSTree(abc);
          const tokens = findByTag(root, TAGS.Token);
          for (const t of tokens) {
            if (t.firstChild !== null) return false;
          }
          return true;
        })
      );
    });

    it("for any CSNode, the sibling chain length equals the visitor's child count", () => {
      fc.assert(
        fc.property(genAbcTune, (abc) => {
          const root = toCSTree(abc);
          const allNodes = collectAll(root);
          for (const csNode of allNodes) {
            const expectedCount = csNode.node.accept(childrenVisitor).length;
            const actualCount = siblingCount(csNode);
            if (actualCount !== expectedCount) return false;
          }
          return true;
        })
      );
    });
  });

  describe("examples", () => {
    it("[CEG]2 C2 D2| — chord has Note children linked as siblings", () => {
      const root = toCSTree("X:1\nK:C\n[CEG]2 C2 D2|\n");
      expect(root.tag).to.equal(TAGS.File_structure);

      const tunes = findByTag(root, TAGS.Tune);
      expect(tunes.length).to.equal(1);

      const chords = findByTag(root, TAGS.Chord);
      expect(chords.length).to.equal(1);

      const chordSubtree = collectSubtree(chords[0]);
      const chordNotes = chordSubtree.filter((n) => n.tag === TAGS.Note);
      expect(chordNotes.length).to.equal(3);
    });

    it("CDEF GABc| — beamed notes are children of Beam CSNodes", () => {
      const root = toCSTree("X:1\nK:C\nCDEF GABc|\n");
      const beams = findByTag(root, TAGS.Beam);
      expect(beams.length).to.be.greaterThan(0);

      for (const beam of beams) {
        const subtree = collectSubtree(beam);
        const notes = subtree.filter((n) => n.tag === TAGS.Note);
        expect(notes.length).to.be.greaterThan(0);
      }
    });

    it("multi-tune input — root has multiple Tune children as siblings", () => {
      const root = toCSTree("X:1\nK:C\nCDE|\n\nX:2\nK:G\nGAB|\n");
      const tunes = findByTag(root, TAGS.Tune);
      expect(tunes.length).to.equal(2);
    });

    it("a Note CSNode has tag 'Note', Chord has 'Chord', Rest has 'Rest'", () => {
      const root = toCSTree("X:1\nK:C\n[CE]2 C2 z2|\n");
      const notes = findByTag(root, TAGS.Note);
      expect(notes.length).to.be.greaterThan(0);
      for (const n of notes) expect(n.tag).to.equal("Note");

      const chords = findByTag(root, TAGS.Chord);
      expect(chords.length).to.equal(1);
      expect(chords[0].tag).to.equal("Chord");

      const rests = findByTag(root, TAGS.Rest);
      expect(rests.length).to.equal(1);
      expect(rests[0].tag).to.equal("Rest");
    });

    it("Beam CSNode has tag 'Beam'", () => {
      const root = toCSTree("X:1\nK:C\nCDEF|\n");
      const beams = findByTag(root, TAGS.Beam);
      expect(beams.length).to.be.greaterThan(0);
      expect(beams[0].tag).to.equal("Beam");
    });

    it("fromAst works on a subtree (Chord node)", () => {
      const root = toCSTree("X:1\nK:C\n[CEG]2|\n");
      const chords = findByTag(root, TAGS.Chord);
      expect(chords.length).to.equal(1);
      const subtree = collectSubtree(chords[0]);
      const notes = subtree.filter((n) => n.tag === TAGS.Note);
      expect(notes.length).to.equal(3);
    });

    it("Tune has Tune_header and Tune_Body children", () => {
      const root = toCSTree("X:1\nK:C\nCDE|\n");
      const tunes = findByTag(root, TAGS.Tune);
      expect(tunes.length).to.equal(1);

      const tune = tunes[0];
      expect(tune.firstChild).to.not.equal(null);
      expect(tune.firstChild!.tag).to.equal(TAGS.Tune_header);
      expect(tune.firstChild!.nextSibling).to.not.equal(null);
      expect(tune.firstChild!.nextSibling!.tag).to.equal(TAGS.Tune_Body);
    });
  });
});
