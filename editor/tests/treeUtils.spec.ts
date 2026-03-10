import { replace, appendChild, getParent } from "abcls-cstree";
import { TT } from "abcls-parser";
import { expect } from "chai";
import { describe, it } from "mocha";
import { createCSNode, CSNode, TAGS, isTokenNode, getTokenData } from "../src/csTree/types";
import { findChildByTag, findTieChild, findRhythmChild, replaceRhythm } from "../src/transforms/treeUtils";
import { toCSTree, findByTag } from "./helpers";

function collectChildren(parent: CSNode): CSNode[] {
  const result: CSNode[] = [];
  let current = parent.firstChild;
  while (current !== null) {
    result.push(current);
    current = current.nextSibling;
  }
  return result;
}

describe("treeUtils", () => {
  describe("findChildByTag", () => {
    it("finds the Rhythm child of a Note", () => {
      const root = toCSTree("X:1\nK:C\nC2|\n");
      const notes = findByTag(root, TAGS.Note);
      expect(notes.length).to.be.greaterThan(0);
      const note = notes[0];
      const result = findChildByTag(note, TAGS.Rhythm);
      expect(result).to.not.be.null;
      expect(result!.tag).to.equal(TAGS.Rhythm);
    });

    it("returns null when no matching child exists", () => {
      const root = toCSTree("X:1\nK:C\nC|\n");
      const notes = findByTag(root, TAGS.Note);
      expect(notes.length).to.be.greaterThan(0);
      const note = notes[0];
      const result = findChildByTag(note, TAGS.Rhythm);
      expect(result).to.be.null;
    });

    it("finds the Pitch child of a Note (firstChild case)", () => {
      const root = toCSTree("X:1\nK:C\nC2|\n");
      const notes = findByTag(root, TAGS.Note);
      const note = notes[0];
      const result = findChildByTag(note, TAGS.Pitch);
      expect(result).to.not.be.null;
      expect(result!.tag).to.equal(TAGS.Pitch);
    });
  });

  describe("replace (cstree)", () => {
    it("preserves the rest of the sibling chain", () => {
      const root = toCSTree("X:1\nK:C\nC2-|\n");
      const notes = findByTag(root, TAGS.Note);
      const note = notes[0];
      const pitchResult = findChildByTag(note, TAGS.Pitch);
      expect(pitchResult).to.not.be.null;

      // Create a replacement node
      const replacement = createCSNode(TAGS.Pitch, 9999, null);
      replace(pitchResult!, replacement);

      expect(note.firstChild).to.equal(replacement);
      // The replacement should have the rest of the chain
      expect(replacement.nextSibling).to.not.be.null;
      expect(replacement.nextSibling!.tag).to.equal(TAGS.Rhythm);
    });
  });

  describe("appendChild (cstree)", () => {
    it("sets firstChild on an empty parent", () => {
      const parent = createCSNode(TAGS.Note, 1000, null);
      const child = createCSNode(TAGS.Pitch, 1001, null);
      appendChild(parent, child);
      expect(parent.firstChild).to.equal(child);
    });

    it("sets the last sibling's nextSibling on a non-empty parent", () => {
      const root = toCSTree("X:1\nK:C\nC|\n");
      const notes = findByTag(root, TAGS.Note);
      const note = notes[0];
      const childBefore = collectChildren(note).length;
      const newChild = createCSNode(TAGS.Rhythm, 9999, null);
      appendChild(note, newChild);
      const childAfter = collectChildren(note).length;
      expect(childAfter).to.equal(childBefore + 1);
      // Verify the last child is the new one
      const children = collectChildren(note);
      expect(children[children.length - 1]).to.equal(newChild);
    });
  });

  describe("getParent (cstree)", () => {
    it("returns the parent of a node found in the tree", () => {
      const root = toCSTree("X:1\nK:C\nC2 D|\n");
      const notes = findByTag(root, TAGS.Note);
      expect(notes.length).to.be.greaterThanOrEqual(1);
      const rhythmResult = findChildByTag(notes[0], TAGS.Rhythm);
      expect(rhythmResult).to.not.be.null;
      const parent = getParent(rhythmResult!);
      expect(parent).to.not.be.null;
      expect(parent).to.equal(notes[0]);
    });

    it("returns null when the target is the root", () => {
      const root = toCSTree("X:1\nK:C\nC|\n");
      const result = getParent(root);
      expect(result).to.be.null;
    });
  });

  describe("findTieChild", () => {
    it("returns the Tie token on a Note with a tie", () => {
      const root = toCSTree("X:1\nK:C\nC-|\n");
      const notes = findByTag(root, TAGS.Note);
      const note = notes[0];
      const result = findTieChild(note);
      expect(result).to.not.be.null;
      expect(isTokenNode(result!)).to.be.true;
      expect(getTokenData(result!).tokenType).to.equal(TT.TIE);
    });

    it("returns null on a Note without a tie", () => {
      const root = toCSTree("X:1\nK:C\nC|\n");
      const notes = findByTag(root, TAGS.Note);
      const note = notes[0];
      const result = findTieChild(note);
      expect(result).to.be.null;
    });
  });

  describe("replaceRhythm", () => {
    it("replaces an existing Rhythm in place", () => {
      const root = toCSTree("X:1\nK:C\nC2|\n");
      const notes = findByTag(root, TAGS.Note);
      const note = notes[0];
      const newRhythm = createCSNode(TAGS.Rhythm, 9999, null);
      replaceRhythm(note, newRhythm);
      const found = findRhythmChild(note);
      expect(found).to.not.be.null;
      expect(found).to.equal(newRhythm);
    });

    it("removes the existing Rhythm when newRhythm is null", () => {
      const root = toCSTree("X:1\nK:C\nC2|\n");
      const notes = findByTag(root, TAGS.Note);
      const note = notes[0];
      replaceRhythm(note, null);
      const found = findRhythmChild(note);
      expect(found).to.be.null;
    });

    it("inserts before Tie when no existing Rhythm", () => {
      const root = toCSTree("X:1\nK:C\nC-|\n");
      const notes = findByTag(root, TAGS.Note);
      const note = notes[0];
      // Verify no Rhythm child exists
      expect(findRhythmChild(note)).to.be.null;
      const newRhythm = createCSNode(TAGS.Rhythm, 9999, null);
      replaceRhythm(note, newRhythm);
      const found = findRhythmChild(note);
      expect(found).to.not.be.null;
      expect(found).to.equal(newRhythm);
      // Rhythm should come before Tie
      const tie = findTieChild(note);
      expect(tie).to.not.be.null;
      expect(newRhythm.nextSibling).to.equal(tie);
    });

    it("appends at end when no existing Rhythm and no Tie", () => {
      const root = toCSTree("X:1\nK:C\nC|\n");
      const notes = findByTag(root, TAGS.Note);
      const note = notes[0];
      expect(findRhythmChild(note)).to.be.null;
      const newRhythm = createCSNode(TAGS.Rhythm, 9999, null);
      replaceRhythm(note, newRhythm);
      const found = findRhythmChild(note);
      expect(found).to.not.be.null;
      expect(found).to.equal(newRhythm);
      const children = collectChildren(note);
      expect(children[children.length - 1]).to.equal(newRhythm);
    });
  });
});
