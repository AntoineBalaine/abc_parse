import { expect } from "chai";
import { describe, it } from "mocha";
import * as fc from "fast-check";
import { toCSTreeWithContext, formatSelection, findByTag, genAbcTune, genAbcWithChords } from "./helpers";
import { TAGS, isTokenNode, getTokenData } from "../src/csTree/types";
import { ABCContext } from "../../parse/parsers/Context";
import { Selection } from "../src/selection";
import { harmonize, pitchToDiatonic, diatonicToPitch, stepDiatonic } from "../src/transforms/harmonize";
import { toAst } from "../src/csTree/toAst";
import { Pitch } from "../../parse/types/Expr2";
import { TT, Token } from "../../parse/parsers/scan2";
import { findChildByTag } from "../src/transforms/treeUtils";

function getPitchLexeme(noteNode: any): string {
  const pitchResult = findChildByTag(noteNode, TAGS.Pitch);
  if (!pitchResult) return "";
  let result = "";
  let current = pitchResult.node.firstChild;
  while (current !== null) {
    if (isTokenNode(current)) {
      result += getTokenData(current).lexeme;
    }
    current = current.nextSibling;
  }
  return result;
}

function createPitch(ctx: ABCContext, letter: string, alteration?: string, octaveStr?: string): Pitch {
  const alterationToken = alteration ? new Token(TT.ACCIDENTAL, alteration, ctx.generateId()) : undefined;
  const noteLetterToken = new Token(TT.NOTE_LETTER, letter, ctx.generateId());
  const octaveToken = octaveStr ? new Token(TT.OCTAVE, octaveStr, ctx.generateId()) : undefined;
  return new Pitch(ctx.generateId(), {
    alteration: alterationToken,
    noteLetter: noteLetterToken,
    octave: octaveToken,
  });
}

describe("harmonize", () => {
  describe("helper functions", () => {
    describe("pitchToDiatonic", () => {
      it("C returns { index: 0, octave: 4 }", () => {
        const ctx = new ABCContext();
        const pitch = createPitch(ctx, "C");
        const result = pitchToDiatonic(pitch);
        expect(result).to.deep.equal({ index: 0, octave: 4 });
      });

      it("c returns { index: 0, octave: 5 }", () => {
        const ctx = new ABCContext();
        const pitch = createPitch(ctx, "c");
        const result = pitchToDiatonic(pitch);
        expect(result).to.deep.equal({ index: 0, octave: 5 });
      });

      it("G, returns { index: 4, octave: 3 }", () => {
        const ctx = new ABCContext();
        const pitch = createPitch(ctx, "G", undefined, ",");
        const result = pitchToDiatonic(pitch);
        expect(result).to.deep.equal({ index: 4, octave: 3 });
      });

      it("d' returns { index: 1, octave: 6 }", () => {
        const ctx = new ABCContext();
        const pitch = createPitch(ctx, "d", undefined, "'");
        const result = pitchToDiatonic(pitch);
        expect(result).to.deep.equal({ index: 1, octave: 6 });
      });

      it("B,, returns { index: 6, octave: 2 }", () => {
        const ctx = new ABCContext();
        const pitch = createPitch(ctx, "B", undefined, ",,");
        const result = pitchToDiatonic(pitch);
        expect(result).to.deep.equal({ index: 6, octave: 2 });
      });

      it("E returns { index: 2, octave: 4 }", () => {
        const ctx = new ABCContext();
        const pitch = createPitch(ctx, "E");
        const result = pitchToDiatonic(pitch);
        expect(result).to.deep.equal({ index: 2, octave: 4 });
      });

      it("a returns { index: 5, octave: 5 }", () => {
        const ctx = new ABCContext();
        const pitch = createPitch(ctx, "a");
        const result = pitchToDiatonic(pitch);
        expect(result).to.deep.equal({ index: 5, octave: 5 });
      });
    });

    describe("diatonicToPitch", () => {
      it("{ index: 0, octave: 4 } produces C", () => {
        const ctx = new ABCContext();
        const pitch = diatonicToPitch(0, 4, undefined, ctx);
        expect(pitch.noteLetter.lexeme).to.equal("C");
        expect(pitch.octave).to.be.undefined;
      });

      it("{ index: 0, octave: 5 } produces c", () => {
        const ctx = new ABCContext();
        const pitch = diatonicToPitch(0, 5, undefined, ctx);
        expect(pitch.noteLetter.lexeme).to.equal("c");
        expect(pitch.octave).to.be.undefined;
      });

      it("{ index: 4, octave: 3 } produces G,", () => {
        const ctx = new ABCContext();
        const pitch = diatonicToPitch(4, 3, undefined, ctx);
        expect(pitch.noteLetter.lexeme).to.equal("G");
        expect(pitch.octave?.lexeme).to.equal(",");
      });

      it("{ index: 1, octave: 6 } produces d'", () => {
        const ctx = new ABCContext();
        const pitch = diatonicToPitch(1, 6, undefined, ctx);
        expect(pitch.noteLetter.lexeme).to.equal("d");
        expect(pitch.octave?.lexeme).to.equal("'");
      });

      it("{ index: 6, octave: 2 } produces B,,", () => {
        const ctx = new ABCContext();
        const pitch = diatonicToPitch(6, 2, undefined, ctx);
        expect(pitch.noteLetter.lexeme).to.equal("B");
        expect(pitch.octave?.lexeme).to.equal(",,");
      });

      it("preserves alteration token", () => {
        const ctx = new ABCContext();
        const alteration = new Token(TT.ACCIDENTAL, "^", ctx.generateId());
        const pitch = diatonicToPitch(0, 4, alteration, ctx);
        expect(pitch.alteration).to.equal(alteration);
      });
    });

    describe("stepDiatonic", () => {
      it("C stepped by +2 produces E", () => {
        const ctx = new ABCContext();
        const pitch = createPitch(ctx, "C");
        const result = stepDiatonic(pitch, 2, ctx);
        expect(result.noteLetter.lexeme).to.equal("E");
        expect(result.octave).to.be.undefined;
      });

      it("A stepped by +2 produces c (octave wrap up)", () => {
        const ctx = new ABCContext();
        const pitch = createPitch(ctx, "A");
        const result = stepDiatonic(pitch, 2, ctx);
        expect(result.noteLetter.lexeme).to.equal("c");
        expect(result.octave).to.be.undefined;
      });

      it("c stepped by -2 produces A (octave wrap down)", () => {
        const ctx = new ABCContext();
        const pitch = createPitch(ctx, "c");
        const result = stepDiatonic(pitch, -2, ctx);
        expect(result.noteLetter.lexeme).to.equal("A");
        expect(result.octave).to.be.undefined;
      });

      it("B stepped by +1 produces c", () => {
        const ctx = new ABCContext();
        const pitch = createPitch(ctx, "B");
        const result = stepDiatonic(pitch, 1, ctx);
        expect(result.noteLetter.lexeme).to.equal("c");
        expect(result.octave).to.be.undefined;
      });

      it("c stepped by -1 produces B", () => {
        const ctx = new ABCContext();
        const pitch = createPitch(ctx, "c");
        const result = stepDiatonic(pitch, -1, ctx);
        expect(result.noteLetter.lexeme).to.equal("B");
        expect(result.octave).to.be.undefined;
      });

      it("accidentals preserved: ^C stepped by +2 produces ^E", () => {
        const ctx = new ABCContext();
        const pitch = createPitch(ctx, "C", "^");
        const result = stepDiatonic(pitch, 2, ctx);
        expect(result.noteLetter.lexeme).to.equal("E");
        expect(result.alteration?.lexeme).to.equal("^");
      });

      it("G stepped by +4 produces D (5th up, octave change)", () => {
        const ctx = new ABCContext();
        const pitch = createPitch(ctx, "G");
        const result = stepDiatonic(pitch, 4, ctx);
        expect(result.noteLetter.lexeme).to.equal("d");
        expect(result.octave).to.be.undefined;
      });

      it("D stepped by -4 produces G, (5th down, octave change)", () => {
        const ctx = new ABCContext();
        const pitch = createPitch(ctx, "D");
        const result = stepDiatonic(pitch, -4, ctx);
        expect(result.noteLetter.lexeme).to.equal("G");
        expect(result.octave?.lexeme).to.equal(",");
      });
    });
  });

  describe("single note harmonization", () => {
    it("C with steps +2 produces [CE]", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nC|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      harmonize(sel, 2, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("[CE]");
    });

    it("A with steps +2 produces [Ac]", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nA|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      harmonize(sel, 2, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("[Ac]");
    });

    it("E with steps +4 produces [EB] (5th up)", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nE|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      harmonize(sel, 4, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("[EB]");
    });

    it("G with steps -2 produces [GE] (3rd down)", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nG|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      harmonize(sel, -2, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("[GE]");
    });

    it("D with steps +3 produces [DG] (4th up)", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nD|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      harmonize(sel, 3, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("[DG]");
    });

    it("C with steps +5 produces [CA] (6th up)", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nC|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      harmonize(sel, 5, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("[CA]");
    });
  });

  describe("chord harmonization", () => {
    it("[CA] with steps +2 produces chord with C, A, E, c (original notes then harmonies)", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\n[CA]|\n");
      const chords = findByTag(root, TAGS.Chord);
      const sel: Selection = { root, cursors: [new Set([chords[0].id])] };
      harmonize(sel, 2, ctx);
      const formatted = formatSelection(sel);
      // Algorithm inserts all harmony notes after original notes: [CA] -> [CAEc]
      expect(formatted).to.contain("[CAEc]");
    });

    it("[CE] with steps +2 produces chord with C, E, G, B (original notes then harmonies)", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\n[CE]|\n");
      const chords = findByTag(root, TAGS.Chord);
      const sel: Selection = { root, cursors: [new Set([chords[0].id])] };
      harmonize(sel, 2, ctx);
      const formatted = formatSelection(sel);
      // C + 2 = E, E + 2 = G -> [CE] + harmonies = [CEEG]
      expect(formatted).to.contain("[CEEG]");
    });
  });

  describe("note with rhythm", () => {
    it("C2 with steps +2 produces [CE]2 (rhythm on chord)", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nC2|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      harmonize(sel, 2, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("[CE]2");
    });

    it("D/2 with steps +2 produces [DF]/2", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nD/2|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      harmonize(sel, 2, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("[DF]/2");
    });
  });

  describe("note with tie", () => {
    it("C- with steps +2 produces [CE]- (tie preserved)", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nC-|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      harmonize(sel, 2, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("[CE]-");
    });
  });

  describe("note with accidental", () => {
    it("^C with steps +2 produces [^C^E] (accidental preserved)", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\n^C|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      harmonize(sel, 2, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("[^C^E]");
    });

    it("_B with steps -2 produces [_B_G] (flat preserved)", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\n_B|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      harmonize(sel, -2, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("[_B_G]");
    });
  });

  describe("steps of 0 is identity", () => {
    it("does not modify the note when steps is 0", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nC|\n");
      const notes = findByTag(root, TAGS.Note);
      const beforeFormat = formatSelection({ root, cursors: [] });
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      harmonize(sel, 0, ctx);
      const afterFormat = formatSelection(sel);
      expect(afterFormat).to.equal(beforeFormat);
    });
  });

  describe("multiple cursors", () => {
    it("harmonizes multiple selected notes independently", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nC D E|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id]), new Set([notes[2].id])] };
      harmonize(sel, 2, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("[CE]");
      expect(formatted).to.contain("[EG]");
      expect(formatted).to.match(/D/);
    });
  });

  describe("octave boundary crossings", () => {
    it("B with steps +2 produces [Bd] (crosses into octave 5)", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nB|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      harmonize(sel, 2, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("[Bd]");
    });

    it("c with steps -2 produces [cA] (crosses into octave 4)", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nc|\n");
      const notes = findByTag(root, TAGS.Note);
      const sel: Selection = { root, cursors: [new Set([notes[0].id])] };
      harmonize(sel, -2, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("[cA]");
    });
  });

  describe("property-based tests", () => {
    it("stepping up then down by the same amount returns equivalent pitch", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 7 }),
          (steps) => {
            const ctx = new ABCContext();
            const pitch = createPitch(ctx, "C");
            const steppedUp = stepDiatonic(pitch, steps, ctx);
            const steppedBack = stepDiatonic(steppedUp, -steps, ctx);
            const original = pitchToDiatonic(pitch);
            const result = pitchToDiatonic(steppedBack);
            expect(result.index).to.equal(original.index);
            expect(result.octave).to.equal(original.octave);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("diatonic index is always in range [0, 6]", () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant("C"),
            fc.constant("D"),
            fc.constant("E"),
            fc.constant("F"),
            fc.constant("G"),
            fc.constant("A"),
            fc.constant("B"),
            fc.constant("c"),
            fc.constant("d"),
            fc.constant("e"),
            fc.constant("f"),
            fc.constant("g"),
            fc.constant("a"),
            fc.constant("b")
          ),
          fc.integer({ min: -14, max: 14 }),
          (letter, steps) => {
            const ctx = new ABCContext();
            const pitch = createPitch(ctx, letter);
            const stepped = stepDiatonic(pitch, steps, ctx);
            const result = pitchToDiatonic(stepped);
            expect(result.index).to.be.at.least(0);
            expect(result.index).to.be.at.most(6);
          }
        ),
        { numRuns: 200 }
      );
    });

    it("stepping preserves accidentals", () => {
      fc.assert(
        fc.property(
          fc.oneof(fc.constant("^"), fc.constant("_"), fc.constant("^^"), fc.constant("__")),
          fc.integer({ min: -7, max: 7 }),
          (accidental, steps) => {
            const ctx = new ABCContext();
            const pitch = createPitch(ctx, "C", accidental);
            const result = stepDiatonic(pitch, steps, ctx);
            expect(result.alteration?.lexeme).to.equal(accidental);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("harmonizing a note produces a chord", () => {
      fc.assert(
        fc.property(genAbcTune, (source) => {
          const { root, ctx } = toCSTreeWithContext(source);
          const notes = findByTag(root, TAGS.Note);
          if (notes.length === 0) return;
          // Select the first note that is not inside a chord or grace group
          const standaloneNotes = notes.filter((n) => {
            // Check if the note is inside a Chord or Grace_group
            const chords = findByTag(root, TAGS.Chord);
            for (const chord of chords) {
              let child = chord.firstChild;
              while (child !== null) {
                if (child.id === n.id) return false;
                child = child.nextSibling;
              }
            }
            // Also exclude notes inside grace groups
            const graceGroups = findByTag(root, TAGS.Grace_group);
            for (const graceGroup of graceGroups) {
              let child = graceGroup.firstChild;
              while (child !== null) {
                if (child.id === n.id) return false;
                child = child.nextSibling;
              }
            }
            return true;
          });
          if (standaloneNotes.length === 0) return;
          const targetNote = standaloneNotes[0];
          const sel: Selection = { root, cursors: [new Set([targetNote.id])] };
          harmonize(sel, 2, ctx);
          // After harmonizing, the formatted output should contain a chord
          const formatted = formatSelection(sel);
          expect(formatted).to.match(/\[.*\]/);
        }),
        { numRuns: 200 }
      );
    });

    it("harmonizing a chord increases note count", () => {
      fc.assert(
        fc.property(genAbcWithChords, (source) => {
          const { root, ctx } = toCSTreeWithContext(source);
          const chords = findByTag(root, TAGS.Chord);
          if (chords.length === 0) return;
          const chord = chords[0];
          // Count notes before
          let noteCountBefore = 0;
          let current = chord.firstChild;
          while (current !== null) {
            if (current.tag === TAGS.Note) noteCountBefore++;
            current = current.nextSibling;
          }
          if (noteCountBefore === 0) return;
          const sel: Selection = { root, cursors: [new Set([chord.id])] };
          harmonize(sel, 2, ctx);
          // Count notes after
          let noteCountAfter = 0;
          current = chord.firstChild;
          while (current !== null) {
            if (current.tag === TAGS.Note) noteCountAfter++;
            current = current.nextSibling;
          }
          expect(noteCountAfter).to.equal(noteCountBefore * 2);
        }),
        { numRuns: 200 }
      );
    });
  });
});
