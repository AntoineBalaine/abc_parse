import { expect } from "chai";
import { describe, it } from "mocha";
import { toCSTreeWithContext, formatSelection, findByTag } from "./helpers";
import { TAGS, isTokenNode, getTokenData } from "../src/csTree/types";
import { TT } from "abc-parser";
import { Selection } from "../src/selection";
import { addSharp, addFlat } from "../src/transforms/addAccidental";
import { findChildByTag } from "../src/transforms/treeUtils";

function getAccidentalLexeme(noteNode: any): string | null {
  const pitchResult = findChildByTag(noteNode, TAGS.Pitch);
  if (!pitchResult) return null;
  let current = pitchResult.node.firstChild;
  while (current !== null) {
    if (isTokenNode(current) && getTokenData(current).tokenType === TT.ACCIDENTAL) {
      return getTokenData(current).lexeme;
    }
    current = current.nextSibling;
  }
  return null;
}

describe("addSharp", () => {
  describe("example-based tests", () => {
    it("no accidental -> sharp: C becomes ^C", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nC|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      addSharp(sel, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("^C");
    });

    it("flat -> natural: _C becomes C", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\n_C|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      addSharp(sel, ctx);
      const acc = getAccidentalLexeme(notes[0]);
      expect(acc).to.be.null;
    });

    it("natural -> sharp: =C becomes ^C", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\n=C|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      addSharp(sel, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("^C");
    });

    it("sharp -> double sharp: ^C becomes ^^C", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\n^C|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      addSharp(sel, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("^^C");
    });

    it("double flat -> flat: __C becomes _C", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\n__C|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      addSharp(sel, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("_C");
      expect(formatted).not.to.contain("__C");
    });

    it("double sharp stays double sharp: ^^C stays ^^C", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\n^^C|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      addSharp(sel, ctx);
      const acc = getAccidentalLexeme(notes[0]);
      expect(acc).to.equal("^^");
    });
  });

  describe("notes with octave markers", () => {
    it("^C, becomes ^^C,", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\n^C,|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      addSharp(sel, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("^^C,");
    });

    it("C' becomes ^C'", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nc'|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      addSharp(sel, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("^c'");
    });
  });

  describe("notes with rhythm", () => {
    it("^C2 becomes ^^C2", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\n^C2|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      addSharp(sel, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("^^C2");
    });
  });

  describe("chord selection", () => {
    it("[CEG] becomes [^C^E^G] when chord is selected", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\n[CEG]|\n");
      const chords = findByTag(root, TAGS.Chord);
      const sel: Selection = { root, cursors: [new Set([chords[0].id])] };
      addSharp(sel, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("[^C^E^G]");
    });

    it("[C^EG] becomes [^C^^E^G] (mixed accidentals)", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\n[C^EG]|\n");
      const chords = findByTag(root, TAGS.Chord);
      const sel: Selection = { root, cursors: [new Set([chords[0].id])] };
      addSharp(sel, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("[^C^^E^G]");
    });
  });
});

describe("addFlat", () => {
  describe("example-based tests", () => {
    it("no accidental -> flat: C becomes _C", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nC|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      addFlat(sel, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("_C");
    });

    it("sharp -> natural: ^C becomes C", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\n^C|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      addFlat(sel, ctx);
      const acc = getAccidentalLexeme(notes[0]);
      expect(acc).to.be.null;
    });

    it("natural -> flat: =C becomes _C", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\n=C|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      addFlat(sel, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("_C");
    });

    it("flat -> double flat: _C becomes __C", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\n_C|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      addFlat(sel, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("__C");
    });

    it("double sharp -> sharp: ^^C becomes ^C", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\n^^C|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      addFlat(sel, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("^C");
      expect(formatted).not.to.contain("^^C");
    });

    it("double flat stays double flat: __C stays __C", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\n__C|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      addFlat(sel, ctx);
      const acc = getAccidentalLexeme(notes[0]);
      expect(acc).to.equal("__");
    });
  });

  describe("notes with octave markers", () => {
    it("_C, becomes __C,", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\n_C,|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      addFlat(sel, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("__C,");
    });

    it("C' becomes _C'", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nc'|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      addFlat(sel, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("_c'");
    });
  });

  describe("notes with rhythm", () => {
    it("_C2 becomes __C2", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\n_C2|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      addFlat(sel, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("__C2");
    });
  });

  describe("chord selection", () => {
    it("[CEG] becomes [_C_E_G] when chord is selected", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\n[CEG]|\n");
      const chords = findByTag(root, TAGS.Chord);
      const sel: Selection = { root, cursors: [new Set([chords[0].id])] };
      addFlat(sel, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("[_C_E_G]");
    });

    it("[C_EG] becomes [_C__E_G] (mixed accidentals)", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\n[C_EG]|\n");
      const chords = findByTag(root, TAGS.Chord);
      const sel: Selection = { root, cursors: [new Set([chords[0].id])] };
      addFlat(sel, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("[_C__E_G]");
    });
  });
});
