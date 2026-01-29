import { expect } from "chai";
import { describe, it } from "mocha";
import * as fc from "fast-check";
import { toCSTreeWithContext, formatSelection, findByTag, genAbcTune } from "./helpers";
import { TAGS, isTokenNode, getTokenData } from "../src/csTree/types";
import { ABCContext, Pitch, toMidiPitch, TT } from "abc-parser";
import { Selection } from "../src/selection";
import { enharmonize } from "../src/transforms/enharmonize";
import { toAst } from "../src/csTree/toAst";
import { findChildByTag } from "../src/transforms/treeUtils";

function getNoteMidi(noteNode: any): number {
  const pitchResult = findChildByTag(noteNode, TAGS.Pitch);
  if (!pitchResult) throw new Error("No pitch child");
  const pitchExpr = toAst(pitchResult.node) as Pitch;
  return toMidiPitch(pitchExpr);
}

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

describe("enharmonize", () => {
  describe("example-based (sharp to flat)", () => {
    it("^C becomes _D", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\n^C|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      enharmonize(sel, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("_D");
    });

    it("^D becomes _E", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\n^D|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      enharmonize(sel, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("_E");
    });

    it("^F becomes _G", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\n^F|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      enharmonize(sel, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("_G");
    });

    it("^G becomes _A", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\n^G|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      enharmonize(sel, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("_A");
    });

    it("^A becomes _B", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\n^A|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      enharmonize(sel, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("_B");
    });
  });

  describe("example-based (flat to sharp)", () => {
    it("_D becomes ^C", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\n_D|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      enharmonize(sel, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("^C");
    });

    it("_E becomes ^D", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\n_E|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      enharmonize(sel, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("^D");
    });

    it("_G becomes ^F", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\n_G|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      enharmonize(sel, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("^F");
    });

    it("_A becomes ^G", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\n_A|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      enharmonize(sel, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("^G");
    });

    it("_B becomes ^A", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\n_B|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      enharmonize(sel, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("^A");
    });
  });

  describe("example-based (double accidentals)", () => {
    it("^^C becomes D (natural)", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\n^^C|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      enharmonize(sel, ctx);
      const acc = getAccidentalLexeme(notes[0]);
      expect(acc).to.be.null;
      expect(getNoteMidi(notes[0])).to.equal(62); // D
    });

    it("^^D becomes E (natural)", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\n^^D|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      enharmonize(sel, ctx);
      const acc = getAccidentalLexeme(notes[0]);
      expect(acc).to.be.null;
      expect(getNoteMidi(notes[0])).to.equal(64); // E
    });

    it("^^E becomes _G (still has an accidental)", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\n^^E|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      enharmonize(sel, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("_G");
    });

    it("__D becomes C (natural)", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\n__D|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      enharmonize(sel, ctx);
      const acc = getAccidentalLexeme(notes[0]);
      expect(acc).to.be.null;
      expect(getNoteMidi(notes[0])).to.equal(60); // C
    });

    it("__E becomes D (natural)", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\n__E|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      enharmonize(sel, ctx);
      const acc = getAccidentalLexeme(notes[0]);
      expect(acc).to.be.null;
      expect(getNoteMidi(notes[0])).to.equal(62); // D
    });

    it("__A becomes G (natural)", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\n__A|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      enharmonize(sel, ctx);
      const acc = getAccidentalLexeme(notes[0]);
      expect(acc).to.be.null;
      expect(getNoteMidi(notes[0])).to.equal(67); // G
    });
  });

  describe("example-based (double-accidental then toggled again)", () => {
    it("^^E -> _G -> ^F (two applications)", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\n^^E|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      enharmonize(sel, ctx);
      let formatted = formatSelection(sel);
      expect(formatted).to.contain("_G");
      enharmonize(sel, ctx);
      formatted = formatSelection(sel);
      expect(formatted).to.contain("^F");
    });
  });

  describe("example-based (octave boundary crossings)", () => {
    it("^B becomes c (uppercase octave 4 -> lowercase octave 5)", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\n^B|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      enharmonize(sel, ctx);
      expect(getAccidentalLexeme(notes[0])).to.be.null;
      expect(getNoteMidi(notes[0])).to.equal(72);
    });

    it("_c becomes B (lowercase octave 5 -> uppercase octave 4)", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\n_c|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      enharmonize(sel, ctx);
      expect(getAccidentalLexeme(notes[0])).to.be.null;
      expect(getNoteMidi(notes[0])).to.equal(71);
    });

    it("^b becomes c' (lowercase octave 5 -> octave 6)", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\n^b|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      enharmonize(sel, ctx);
      expect(getAccidentalLexeme(notes[0])).to.be.null;
      expect(getNoteMidi(notes[0])).to.equal(84);
    });

    it("_C becomes B, (uppercase octave 4 -> octave 3)", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\n_C|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      enharmonize(sel, ctx);
      expect(getAccidentalLexeme(notes[0])).to.be.null;
      expect(getNoteMidi(notes[0])).to.equal(59);
    });
  });

  describe("example-based (skipped notes)", () => {
    it("C (no accidental) is unchanged", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nC|\n");
      const notes = findByTag(root, TAGS.Note);
      const before = formatSelection({ root, cursors: [] });
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      enharmonize(sel, ctx);
      const after = formatSelection(sel);
      expect(after).to.equal(before);
    });

    it("=C (natural) is unchanged", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\n=C|\n");
      const notes = findByTag(root, TAGS.Note);
      const before = formatSelection({ root, cursors: [] });
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      enharmonize(sel, ctx);
      const after = formatSelection(sel);
      expect(after).to.equal(before);
    });

    it("D2 (no accidental, has rhythm) is unchanged", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nD2|\n");
      const notes = findByTag(root, TAGS.Note);
      const before = formatSelection({ root, cursors: [] });
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      enharmonize(sel, ctx);
      const after = formatSelection(sel);
      expect(after).to.equal(before);
    });
  });

  describe("example-based (chords)", () => {
    it("[^F^A^C] becomes [_G_B_D]", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\n[^F^A^C]|\n");
      const chords = findByTag(root, TAGS.Chord);
      const sel: Selection = { root, cursors: [new Set([chords[0].id])] };
      enharmonize(sel, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("_G");
      expect(formatted).to.contain("_B");
      expect(formatted).to.contain("_D");
    });

    it("[^C^E^G] enharmonizes each note independently (^E=F natural)", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\n[^C^E^G]|\n");
      const chords = findByTag(root, TAGS.Chord);
      const sel: Selection = { root, cursors: [new Set([chords[0].id])] };
      enharmonize(sel, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("_D");
      expect(formatted).to.match(/F/); // F natural (no accidental)
      expect(formatted).to.contain("_A");
    });
  });

  describe("example-based (rhythm and tie preservation)", () => {
    it("^C2 becomes _D2 (rhythm preserved)", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\n^C2|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      enharmonize(sel, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("_D2");
    });

    it("^C- becomes _D- (tie preserved)", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\n^C-|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      enharmonize(sel, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("_D-");
    });

    it("^C2> becomes _D2> (rhythm with broken token preserved)", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\n^C2>|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      enharmonize(sel, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("_D2>");
    });
  });

  describe("example-based (notes inside a Beam)", () => {
    it("beamed ^C^D^E with cursor on middle note: only ^D becomes _E", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\n^C^D^E|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[1].id])] };
      enharmonize(sel, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("^C");
      expect(formatted).to.contain("_E");
      // The third note (^E) should remain ^E
      expect(getNoteMidi(notes[2])).to.equal(65); // E# (not enharmonized)
      expect(getAccidentalLexeme(notes[2])).to.equal("^");
    });
  });

  describe("example-based (multiple cursors)", () => {
    it("two cursors selecting different notes: both are enharmonized", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\n^C D ^F|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id]), new Set([notes[2].id])] };
      enharmonize(sel, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("_D");
      expect(formatted).to.contain("_G");
    });
  });

  describe("property-based", () => {
    it("enharmonize preserves the MIDI pitch of every selected note", () => {
      fc.assert(
        fc.property(genAbcTune, (source) => {
          const { root, ctx } = toCSTreeWithContext(source);
          const notes = findByTag(root, TAGS.Note);
          if (notes.length === 0) return;
          const midiBefore = notes.map(n => getNoteMidi(n));
          // Skip if any note is out of valid MIDI range
          if (midiBefore.some(m => m < 0 || m > 127)) return;
          const ids = new Set(notes.map(n => n.id));
          const sel: Selection = { root, cursors: [ids] };
          enharmonize(sel, ctx);
          const midiAfter = notes.map(n => getNoteMidi(n));
          expect(midiAfter).to.deep.equal(midiBefore);
        }),
        { numRuns: 1000 }
      );
    });

    it("for single sharp/flat notes, applying enharmonize twice gives the original output", () => {
      fc.assert(
        fc.property(genAbcTune, (source) => {
          const { root, ctx } = toCSTreeWithContext(source);
          const notes = findByTag(root, TAGS.Note);
          if (notes.length === 0) return;

          // Filter to notes with exactly ^ or _ (single sharp or single flat)
          // that are in canonical octave form, within valid MIDI range,
          // and whose MIDI pitch class is a black key (the involution only
          // holds when the result still carries an accidental; white-key
          // results like ^E->F or _C->B break the involution).
          const BLACK_KEYS = new Set([1, 3, 6, 8, 10]);
          const singleAccNotes = notes.filter(n => {
            const acc = getAccidentalLexeme(n);
            if (acc !== "^" && acc !== "_") return false;
            const midi = getNoteMidi(n);
            if (midi < 0 || midi > 127) return false;
            if (!BLACK_KEYS.has(midi % 12)) return false;
            // Check canonical octave form by checking that the pitch node
            // does not use uppercase+apostrophe or lowercase+comma
            const pitchResult = findChildByTag(n, TAGS.Pitch);
            if (!pitchResult) return false;
            let letterLexeme: string | null = null;
            let octaveLexeme: string | null = null;
            let cur = pitchResult.node.firstChild;
            while (cur !== null) {
              if (isTokenNode(cur)) {
                const td = getTokenData(cur);
                if (td.tokenType === TT.NOTE_LETTER) letterLexeme = td.lexeme;
                if (td.tokenType === TT.OCTAVE) octaveLexeme = td.lexeme;
              }
              cur = cur.nextSibling;
            }
            if (!letterLexeme) return false;
            const isUpper = /[A-G]/.test(letterLexeme);
            if (isUpper && octaveLexeme && octaveLexeme.includes("'")) return false;
            if (!isUpper && octaveLexeme && octaveLexeme.includes(",")) return false;
            return true;
          });
          if (singleAccNotes.length === 0) return;

          const ids = new Set(singleAccNotes.map(n => n.id));
          const sel: Selection = { root, cursors: [ids] };
          const beforeFormat = formatSelection(sel);
          enharmonize(sel, ctx);
          enharmonize(sel, ctx);
          const afterFormat = formatSelection(sel);
          expect(afterFormat).to.equal(beforeFormat);
        }),
        { numRuns: 1000 }
      );
    });

    it("enharmonize on a note without an accidental leaves the formatted output unchanged", () => {
      fc.assert(
        fc.property(genAbcTune, (source) => {
          const { root, ctx } = toCSTreeWithContext(source);
          const notes = findByTag(root, TAGS.Note);
          if (notes.length === 0) return;

          // Filter to notes without accidentals
          const noAccNotes = notes.filter(n => {
            const acc = getAccidentalLexeme(n);
            return acc === null;
          });
          if (noAccNotes.length === 0) return;

          const ids = new Set(noAccNotes.map(n => n.id));
          const sel: Selection = { root, cursors: [ids] };
          const beforeFormat = formatSelection(sel);
          enharmonize(sel, ctx);
          const afterFormat = formatSelection(sel);
          expect(afterFormat).to.equal(beforeFormat);
        }),
        { numRuns: 1000 }
      );
    });

    it("enharmonize preserves the rhythm of the note", () => {
      fc.assert(
        fc.property(genAbcTune, (source) => {
          const { root, ctx } = toCSTreeWithContext(source);
          const notes = findByTag(root, TAGS.Note);
          if (notes.length === 0) return;
          // Skip if any note is out of valid MIDI range
          if (notes.some(n => { const m = getNoteMidi(n); return m < 0 || m > 127; })) return;

          // Check rhythm children before and after
          const rhythmBefore = notes.map(n => {
            const r = findChildByTag(n, TAGS.Rhythm);
            if (!r) return null;
            const ast = toAst(r.node);
            return JSON.stringify(ast);
          });

          const ids = new Set(notes.map(n => n.id));
          const sel: Selection = { root, cursors: [ids] };
          enharmonize(sel, ctx);

          const rhythmAfter = notes.map(n => {
            const r = findChildByTag(n, TAGS.Rhythm);
            if (!r) return null;
            const ast = toAst(r.node);
            return JSON.stringify(ast);
          });
          expect(rhythmAfter).to.deep.equal(rhythmBefore);
        }),
        { numRuns: 1000 }
      );
    });

    it("enharmonize preserves the tie of the note", () => {
      fc.assert(
        fc.property(genAbcTune, (source) => {
          const { root, ctx } = toCSTreeWithContext(source);
          const notes = findByTag(root, TAGS.Note);
          if (notes.length === 0) return;
          // Skip if any note is out of valid MIDI range
          if (notes.some(n => { const m = getNoteMidi(n); return m < 0 || m > 127; })) return;

          // Check tie presence before and after
          const hasTieBefore = notes.map(n => {
            let current = n.firstChild;
            while (current !== null) {
              if (isTokenNode(current) && getTokenData(current).tokenType === TT.TIE) {
                return true;
              }
              current = current.nextSibling;
            }
            return false;
          });

          const ids = new Set(notes.map(n => n.id));
          const sel: Selection = { root, cursors: [ids] };
          enharmonize(sel, ctx);

          const hasTieAfter = notes.map(n => {
            let current = n.firstChild;
            while (current !== null) {
              if (isTokenNode(current) && getTokenData(current).tokenType === TT.TIE) {
                return true;
              }
              current = current.nextSibling;
            }
            return false;
          });
          expect(hasTieAfter).to.deep.equal(hasTieBefore);
        }),
        { numRuns: 1000 }
      );
    });
  });
});
