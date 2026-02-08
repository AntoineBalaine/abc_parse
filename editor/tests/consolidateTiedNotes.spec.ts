import { expect } from "chai";
import { describe, it } from "mocha";
import * as fc from "fast-check";
import { toCSTreeWithContext, formatSelection, findByTag } from "./helpers";
import { TAGS, isTokenNode, getTokenData } from "../src/csTree/types";
import { Selection } from "../src/selection";
import { consolidateTiedNotes } from "../src/transforms/consolidateTiedNotes";
import { getNodeRhythm } from "../src/transforms/rhythm";
import { addRational, createRational, IRational, TT } from "abc-parser";

function selectAll(root: any, tags: string[]): Set<number> {
  const ids = new Set<number>();
  for (const tag of tags) {
    const nodes = findByTag(root, tag);
    for (const node of nodes) {
      ids.add(node.id);
    }
  }
  return ids;
}

function sumNoteDurations(root: any): IRational {
  const notes = findByTag(root, TAGS.Note);
  let sum = createRational(0, 1);
  for (const note of notes) {
    sum = addRational(sum, getNodeRhythm(note));
  }
  return sum;
}

function countByTag(root: any, tag: string): number {
  return findByTag(root, tag).length;
}

function hasTie(node: any): boolean {
  let current = node.firstChild;
  while (current !== null) {
    if (isTokenNode(current) && getTokenData(current).tokenType === TT.TIE) {
      return true;
    }
    current = current.nextSibling;
  }
  return false;
}

function getPitchFromNote(node: any): string | null {
  let current = node.firstChild;
  while (current !== null) {
    if (current.tag === TAGS.Pitch) {
      let pitch = "";
      let child = current.firstChild;
      while (child !== null) {
        if (isTokenNode(child)) {
          pitch += getTokenData(child).lexeme;
        }
        child = child.nextSibling;
      }
      return pitch || null;
    }
    current = current.nextSibling;
  }
  return null;
}

describe("consolidateTiedNotes", () => {
  describe("example-based tests", () => {
    it("two tied identical notes consolidate: C-C | becomes C2 |", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nC-C |\n");
      const sel: Selection = {
        root,
        cursors: [selectAll(root, [TAGS.Note])],
      };
      consolidateTiedNotes(sel, ctx);
      expect(formatSelection(sel)).to.equal("X:1\nK:C\nC2 |\n");
    });

    it("three tied identical notes partially consolidate: C-C-C | becomes C2-C |", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nC-C-C |\n");
      const sel: Selection = {
        root,
        cursors: [selectAll(root, [TAGS.Note])],
      };
      consolidateTiedNotes(sel, ctx);
      expect(formatSelection(sel)).to.equal("X:1\nK:C\nC2-C |\n");
    });

    it("different pitches do not consolidate: C-D | stays unchanged", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nC-D |\n");
      const sel: Selection = {
        root,
        cursors: [selectAll(root, [TAGS.Note])],
      };
      consolidateTiedNotes(sel, ctx);
      expect(formatSelection(sel)).to.equal("X:1\nK:C\nC-D |\n");
    });

    it("different octaves do not consolidate: C,-C | stays unchanged", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nC,-C |\n");
      const sel: Selection = {
        root,
        cursors: [selectAll(root, [TAGS.Note])],
      };
      consolidateTiedNotes(sel, ctx);
      expect(formatSelection(sel)).to.equal("X:1\nK:C\nC,-C |\n");
    });

    it("two tied identical chords consolidate: [CE]-[CE] | becomes [CE]2 |", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\n[CE]-[CE] |\n");
      const sel: Selection = {
        root,
        cursors: [selectAll(root, [TAGS.Chord, TAGS.Note])],
      };
      consolidateTiedNotes(sel, ctx);
      expect(formatSelection(sel)).to.equal("X:1\nK:C\n[CE]2 |\n");
    });

    it("chord with different order consolidates: [CE]-[EC] | becomes [CE]2 | (sorted comparison)", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\n[CE]-[EC] |\n");
      const sel: Selection = {
        root,
        cursors: [selectAll(root, [TAGS.Chord, TAGS.Note])],
      };
      consolidateTiedNotes(sel, ctx);
      expect(formatSelection(sel)).to.equal("X:1\nK:C\n[CE]2 |\n");
    });

    it("consolidation respects bar boundaries: C-C | C-C | becomes C2 | C2 |", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nC-C | C-C |\n");
      const sel: Selection = {
        root,
        cursors: [selectAll(root, [TAGS.Note])],
      };
      consolidateTiedNotes(sel, ctx);
      expect(formatSelection(sel)).to.equal("X:1\nK:C\nC2 | C2 |\n");
    });

    it("cross-bar tie preserved, no consolidation: C- | C | stays unchanged", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nC- | C |\n");
      const sel: Selection = {
        root,
        cursors: [selectAll(root, [TAGS.Note])],
      };
      consolidateTiedNotes(sel, ctx);
      expect(formatSelection(sel)).to.equal("X:1\nK:C\nC- | C |\n");
    });

    it("different durations do not consolidate: C-C2 | stays unchanged", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nC-C2 |\n");
      const sel: Selection = {
        root,
        cursors: [selectAll(root, [TAGS.Note])],
      };
      consolidateTiedNotes(sel, ctx);
      expect(formatSelection(sel)).to.equal("X:1\nK:C\nC-C2 |\n");
    });

    it("note without tie does not consolidate: C C | stays unchanged", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nC C |\n");
      const sel: Selection = {
        root,
        cursors: [selectAll(root, [TAGS.Note])],
      };
      consolidateTiedNotes(sel, ctx);
      expect(formatSelection(sel)).to.equal("X:1\nK:C\nC C |\n");
    });

    it("four tied notes consolidate fully: C-C-C-C | becomes C4 |", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nC-C-C-C |\n");
      const sel: Selection = {
        root,
        cursors: [selectAll(root, [TAGS.Note])],
      };
      consolidateTiedNotes(sel, ctx);
      expect(formatSelection(sel)).to.equal("X:1\nK:C\nC4 |\n");
    });

    it("grace notes between tied notes prevent consolidation: C-{B}C | stays unchanged", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nC-{B}C |\n");
      const sel: Selection = {
        root,
        cursors: [selectAll(root, [TAGS.Note, TAGS.Grace_group])],
      };
      consolidateTiedNotes(sel, ctx);
      expect(formatSelection(sel)).to.equal("X:1\nK:C\nC-{B}C |\n");
    });
  });

  describe("property-based tests", () => {
    const genTiedSequence = fc.array(fc.constantFrom("C-", "C", "D-", "D"), { minLength: 2, maxLength: 6 });

    it("idempotence: applying consolidateTiedNotes twice yields the same result as once", () => {
      fc.assert(
        fc.property(genTiedSequence, (elements) => {
          const source = "X:1\nK:C\n" + elements.join("") + " |\n";
          const { root: root1, ctx: ctx1 } = toCSTreeWithContext(source);
          const sel1: Selection = {
            root: root1,
            cursors: [selectAll(root1, [TAGS.Note])],
          };
          consolidateTiedNotes(sel1, ctx1);
          const afterOnce = formatSelection(sel1);

          const { root: root2, ctx: ctx2 } = toCSTreeWithContext(afterOnce);
          const sel2: Selection = {
            root: root2,
            cursors: [selectAll(root2, [TAGS.Note])],
          };
          consolidateTiedNotes(sel2, ctx2);
          const afterTwice = formatSelection(sel2);

          expect(afterTwice).to.equal(afterOnce);
        }),
        { numRuns: 100 }
      );
    });

    it("total duration is preserved", () => {
      fc.assert(
        fc.property(genTiedSequence, (elements) => {
          const source = "X:1\nK:C\n" + elements.join("") + " |\n";
          const { root, ctx } = toCSTreeWithContext(source);

          const durationBefore = sumNoteDurations(root);

          const sel: Selection = {
            root,
            cursors: [selectAll(root, [TAGS.Note])],
          };
          consolidateTiedNotes(sel, ctx);

          const durationAfter = sumNoteDurations(root);

          expect(durationAfter.numerator * durationBefore.denominator).to.equal(
            durationBefore.numerator * durationAfter.denominator
          );
        }),
        { numRuns: 100 }
      );
    });

    it("note count is non-increasing", () => {
      fc.assert(
        fc.property(genTiedSequence, (elements) => {
          const source = "X:1\nK:C\n" + elements.join("") + " |\n";
          const { root, ctx } = toCSTreeWithContext(source);

          const countBefore = countByTag(root, TAGS.Note);

          const sel: Selection = {
            root,
            cursors: [selectAll(root, [TAGS.Note])],
          };
          consolidateTiedNotes(sel, ctx);

          const countAfter = countByTag(root, TAGS.Note);

          expect(countAfter).to.be.at.most(countBefore);
        }),
        { numRuns: 100 }
      );
    });

    it("pitch content is preserved: every pitch in output appears in input", () => {
      fc.assert(
        fc.property(genTiedSequence, (elements) => {
          const source = "X:1\nK:C\n" + elements.join("") + " |\n";
          const { root, ctx } = toCSTreeWithContext(source);

          const pitchesBefore = new Set<string>();
          for (const note of findByTag(root, TAGS.Note)) {
            const pitch = getPitchFromNote(note);
            if (pitch) pitchesBefore.add(pitch);
          }

          const sel: Selection = {
            root,
            cursors: [selectAll(root, [TAGS.Note])],
          };
          consolidateTiedNotes(sel, ctx);

          const pitchesAfter = new Set<string>();
          for (const note of findByTag(root, TAGS.Note)) {
            const pitch = getPitchFromNote(note);
            if (pitch) pitchesAfter.add(pitch);
          }

          for (const pitch of pitchesAfter) {
            expect(pitchesBefore.has(pitch)).to.be.true;
          }
        }),
        { numRuns: 100 }
      );
    });

    it("no orphaned ties: every note with a tie has a following note with same pitch", () => {
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom("C-", "C"), { minLength: 2, maxLength: 6 }),
          (elements) => {
            const source = "X:1\nK:C\n" + elements.join("") + " |\n";
            const { root, ctx } = toCSTreeWithContext(source);

            const sel: Selection = {
              root,
              cursors: [selectAll(root, [TAGS.Note])],
            };
            consolidateTiedNotes(sel, ctx);

            const notes = findByTag(root, TAGS.Note);
            for (let i = 0; i < notes.length - 1; i++) {
              if (hasTie(notes[i])) {
                const pitch1 = getPitchFromNote(notes[i]);
                const pitch2 = getPitchFromNote(notes[i + 1]);
                expect(pitch1).to.equal(pitch2);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
