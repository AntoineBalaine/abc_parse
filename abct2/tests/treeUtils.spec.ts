import { expect } from "chai";
import { describe, it } from "mocha";
import { toCSTree, findByTag, collectAll } from "./helpers";
import { CSNode, TAGS, createCSNode, isTokenNode, getTokenData } from "../src/csTree/types";
import { TT } from "abc-parser";
import {
  findChildByTag,
  removeChild,
  replaceChild,
  appendChild,
  findParent,
  findTieChild,
  findRhythmChild,
  replaceRhythm,
  collectChildren,
  insertBefore,
} from "../src/transforms/treeUtils";

describe("treeUtils", () => {
  describe("findChildByTag", () => {
    it("finds the Rhythm child of a Note", () => {
      const root = toCSTree("X:1\nK:C\nC2|\n");
      const notes = findByTag(root, TAGS.Note);
      expect(notes.length).to.be.greaterThan(0);
      const note = notes[0];
      const result = findChildByTag(note, TAGS.Rhythm);
      expect(result).to.not.be.null;
      expect(result!.node.tag).to.equal(TAGS.Rhythm);
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
      expect(result!.node.tag).to.equal(TAGS.Pitch);
      expect(result!.prev).to.be.null; // Pitch is firstChild
    });
  });

  describe("removeChild", () => {
    it("removes the first child by updating parent.firstChild", () => {
      const root = toCSTree("X:1\nK:C\nC2|\n");
      const notes = findByTag(root, TAGS.Note);
      const note = notes[0];
      const pitchResult = findChildByTag(note, TAGS.Pitch);
      expect(pitchResult).to.not.be.null;
      const rhythmBefore = findChildByTag(note, TAGS.Rhythm);
      removeChild(note, pitchResult!.prev, pitchResult!.node);
      // Now the firstChild should be the Rhythm
      expect(note.firstChild).to.equal(rhythmBefore!.node);
    });

    it("removes a middle child by updating prev.nextSibling", () => {
      // Note with Pitch, Rhythm, Tie: C2-
      const root = toCSTree("X:1\nK:C\nC2-|\n");
      const notes = findByTag(root, TAGS.Note);
      const note = notes[0];
      const rhythmResult = findChildByTag(note, TAGS.Rhythm);
      expect(rhythmResult).to.not.be.null;
      const pitchResult = findChildByTag(note, TAGS.Pitch);
      expect(pitchResult).to.not.be.null;
      removeChild(note, rhythmResult!.prev, rhythmResult!.node);
      // Pitch's nextSibling should now skip Rhythm
      expect(pitchResult!.node.nextSibling).to.not.be.null;
      // The remaining sibling should be the tie token
      const remaining = pitchResult!.node.nextSibling!;
      expect(isTokenNode(remaining)).to.be.true;
      expect(getTokenData(remaining).tokenType).to.equal(TT.TIE);
    });
  });

  describe("replaceChild", () => {
    it("preserves the rest of the sibling chain", () => {
      const root = toCSTree("X:1\nK:C\nC2-|\n");
      const notes = findByTag(root, TAGS.Note);
      const note = notes[0];
      const pitchResult = findChildByTag(note, TAGS.Pitch);
      expect(pitchResult).to.not.be.null;

      // Create a replacement node
      const replacement = createCSNode(TAGS.Pitch, 9999, { type: "empty" });
      replaceChild(note, pitchResult!.prev, pitchResult!.node, replacement);

      expect(note.firstChild).to.equal(replacement);
      // The replacement should have the rest of the chain
      expect(replacement.nextSibling).to.not.be.null;
      expect(replacement.nextSibling!.tag).to.equal(TAGS.Rhythm);
    });
  });

  describe("appendChild", () => {
    it("sets firstChild on an empty parent", () => {
      const parent = createCSNode(TAGS.Note, 1000, { type: "empty" });
      const child = createCSNode(TAGS.Pitch, 1001, { type: "empty" });
      appendChild(parent, child);
      expect(parent.firstChild).to.equal(child);
    });

    it("sets the last sibling's nextSibling on a non-empty parent", () => {
      const root = toCSTree("X:1\nK:C\nC|\n");
      const notes = findByTag(root, TAGS.Note);
      const note = notes[0];
      const childBefore = collectChildren(note).length;
      const newChild = createCSNode(TAGS.Rhythm, 9999, { type: "empty" });
      appendChild(note, newChild);
      const childAfter = collectChildren(note).length;
      expect(childAfter).to.equal(childBefore + 1);
      // Verify the last child is the new one
      const children = collectChildren(note);
      expect(children[children.length - 1]).to.equal(newChild);
    });
  });

  describe("findParent", () => {
    it("returns the parent and prev of a node found in the tree", () => {
      const root = toCSTree("X:1\nK:C\nC2 D|\n");
      const notes = findByTag(root, TAGS.Note);
      expect(notes.length).to.be.greaterThanOrEqual(1);
      const rhythmResult = findChildByTag(notes[0], TAGS.Rhythm);
      expect(rhythmResult).to.not.be.null;
      const parentResult = findParent(root, rhythmResult!.node);
      expect(parentResult).to.not.be.null;
      expect(parentResult!.parent).to.equal(notes[0]);
    });

    it("returns null when the target is the root", () => {
      const root = toCSTree("X:1\nK:C\nC|\n");
      const result = findParent(root, root);
      expect(result).to.be.null;
    });

    it("returns prev=null when the target is the parent's firstChild", () => {
      const root = toCSTree("X:1\nK:C\nC2|\n");
      const notes = findByTag(root, TAGS.Note);
      const note = notes[0];
      const pitchResult = findChildByTag(note, TAGS.Pitch);
      const parentResult = findParent(root, pitchResult!.node);
      expect(parentResult).to.not.be.null;
      expect(parentResult!.parent).to.equal(note);
      expect(parentResult!.prev).to.be.null;
    });
  });

  describe("findTieChild", () => {
    it("returns the Tie token and its predecessor on a Note with a tie", () => {
      const root = toCSTree("X:1\nK:C\nC-|\n");
      const notes = findByTag(root, TAGS.Note);
      const note = notes[0];
      const result = findTieChild(note);
      expect(result).to.not.be.null;
      expect(isTokenNode(result!.node)).to.be.true;
      expect(getTokenData(result!.node).tokenType).to.equal(TT.TIE);
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
      const newRhythm = createCSNode(TAGS.Rhythm, 9999, { type: "empty" });
      replaceRhythm(note, newRhythm);
      const found = findRhythmChild(note);
      expect(found).to.not.be.null;
      expect(found!.node).to.equal(newRhythm);
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
      const newRhythm = createCSNode(TAGS.Rhythm, 9999, { type: "empty" });
      replaceRhythm(note, newRhythm);
      const found = findRhythmChild(note);
      expect(found).to.not.be.null;
      expect(found!.node).to.equal(newRhythm);
      // Rhythm should come before Tie
      const tie = findTieChild(note);
      expect(tie).to.not.be.null;
      expect(newRhythm.nextSibling).to.equal(tie!.node);
    });

    it("appends at end when no existing Rhythm and no Tie", () => {
      const root = toCSTree("X:1\nK:C\nC|\n");
      const notes = findByTag(root, TAGS.Note);
      const note = notes[0];
      expect(findRhythmChild(note)).to.be.null;
      const newRhythm = createCSNode(TAGS.Rhythm, 9999, { type: "empty" });
      replaceRhythm(note, newRhythm);
      const found = findRhythmChild(note);
      expect(found).to.not.be.null;
      expect(found!.node).to.equal(newRhythm);
      const children = collectChildren(note);
      expect(children[children.length - 1]).to.equal(newRhythm);
    });
  });
});
