import { expect } from "chai";
import { describe, it } from "mocha";
import * as fc from "fast-check";
import { toCSTreeWithContext, formatSelection, findByTag } from "./helpers";
import { TAGS, isTokenNode, getTokenData } from "../src/csTree/types";
import { Selection } from "../src/selection";
import { legato } from "../src/transforms/legato";
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

function sumDurations(root: any): IRational {
  const nodes = [
    ...findByTag(root, TAGS.Note),
    ...findByTag(root, TAGS.Rest),
    ...findByTag(root, TAGS.Chord),
    ...findByTag(root, TAGS.YSPACER),
  ];
  let sum = createRational(0, 1);
  for (const node of nodes) {
    sum = addRational(sum, getNodeRhythm(node));
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

describe("legato", () => {
  describe("example-based tests", () => {
    it("single rest after note: C z D becomes C2 D", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nC z D|\n");
      const sel: Selection = {
        root,
        cursors: [selectAll(root, [TAGS.Note, TAGS.Rest])],
      };
      legato(sel, ctx);
      expect(formatSelection(sel)).to.equal("X:1\nK:C\nC2  D|\n");
    });

    it("multiple rests after note: C z z z D becomes C4 D", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nC z z z D|\n");
      const sel: Selection = {
        root,
        cursors: [selectAll(root, [TAGS.Note, TAGS.Rest])],
      };
      legato(sel, ctx);
      expect(formatSelection(sel)).to.equal("X:1\nK:C\nC4    D|\n");
    });

    it("rest at bar boundary: C z | z z D produces tied notes across bars", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nC z | z z D|\n");
      const sel: Selection = {
        root,
        cursors: [selectAll(root, [TAGS.Note, TAGS.Rest])],
      };
      legato(sel, ctx);
      expect(formatSelection(sel)).to.equal("X:1\nK:C\nC2-  | C2  D|\n");
    });

    it("chord with rest: [CE] z G becomes [CE]2 G", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\n[CE] z G|\n");
      const sel: Selection = {
        root,
        cursors: [selectAll(root, [TAGS.Note, TAGS.Chord, TAGS.Rest])],
      };
      legato(sel, ctx);
      expect(formatSelection(sel)).to.equal("X:1\nK:C\n[CE]2  G|\n");
    });

    it("chord to chord: [CE] z [CG] becomes [CE]2 [CG]", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\n[CE] z [CG]|\n");
      const sel: Selection = {
        root,
        cursors: [selectAll(root, [TAGS.Chord, TAGS.Rest])],
      };
      legato(sel, ctx);
      expect(formatSelection(sel)).to.equal("X:1\nK:C\n[CE]2  [CG]|\n");
    });

    it("rest at end with no following note: C z z z | becomes C4 | (no trailing tie)", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nC z z z|\n");
      const sel: Selection = {
        root,
        cursors: [selectAll(root, [TAGS.Note, TAGS.Rest])],
      };
      legato(sel, ctx);
      expect(formatSelection(sel)).to.equal("X:1\nK:C\nC4   |\n");
    });

    it("y-spacer as target: C y D becomes C2 D", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nC y D|\n");
      const sel: Selection = {
        root,
        cursors: [selectAll(root, [TAGS.Note, TAGS.YSPACER])],
      };
      legato(sel, ctx);
      expect(formatSelection(sel)).to.equal("X:1\nK:C\nC2  D|\n");
    });

    it("no source before rest: z C stays unchanged", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nz C|\n");
      const sel: Selection = {
        root,
        cursors: [selectAll(root, [TAGS.Note, TAGS.Rest])],
      };
      legato(sel, ctx);
      expect(formatSelection(sel)).to.equal("X:1\nK:C\nz C|\n");
    });

    it("grace group is not a source: {B}C z D becomes {B}C2 D (C is the source)", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\n{B}C z D|\n");
      const sel: Selection = {
        root,
        cursors: [selectAll(root, [TAGS.Note, TAGS.Rest, TAGS.Grace_group])],
      };
      legato(sel, ctx);
      expect(formatSelection(sel)).to.equal("X:1\nK:C\n{B}C2  D|\n");
    });

    it("multi-measure rest is not a target: C Z D stays unchanged for Z", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nC Z D|\n");
      const sel: Selection = {
        root,
        cursors: [selectAll(root, [TAGS.Note, TAGS.MultiMeasureRest])],
      };
      legato(sel, ctx);
      expect(formatSelection(sel)).to.equal("X:1\nK:C\nC Z D|\n");
    });

    it("multi-measure rest resets source: C Z z D leaves z unchanged", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nC Z z D|\n");
      const sel: Selection = {
        root,
        cursors: [selectAll(root, [TAGS.Note, TAGS.MultiMeasureRest, TAGS.Rest])],
      };
      legato(sel, ctx);
      expect(formatSelection(sel)).to.equal("X:1\nK:C\nC Z z D|\n");
    });

    it("selection ends mid-bar: C z with D outside becomes C2 (no trailing tie)", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nC z D|\n");
      const notes = findByTag(root, TAGS.Note);
      const rests = findByTag(root, TAGS.Rest);
      const sel: Selection = {
        root,
        cursors: [new Set([notes[0].id, rests[0].id])],
      };
      legato(sel, ctx);
      // Only C and z are selected, D remains unchanged
      expect(formatSelection(sel)).to.equal("X:1\nK:C\nC2  D|\n");
    });

    it("empty selection is a no-op", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nC z D|\n");
      const sel: Selection = {
        root,
        cursors: [new Set()],
      };
      legato(sel, ctx);
      expect(formatSelection(sel)).to.equal("X:1\nK:C\nC z D|\n");
    });

    it("selection boundary respected: only selected rests are replaced", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nC z z D|\n");
      const notes = findByTag(root, TAGS.Note);
      const rests = findByTag(root, TAGS.Rest);
      const sel: Selection = {
        root,
        cursors: [new Set([notes[0].id, rests[0].id])],
      };
      legato(sel, ctx);
      // Only the first rest is replaced; the second rest remains
      expect(countByTag(root, TAGS.Rest)).to.equal(1);
    });

    it("different duration rests: C z z/2 D partially consolidates", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nC z z/2 D|\n");
      const sel: Selection = {
        root,
        cursors: [selectAll(root, [TAGS.Note, TAGS.Rest])],
      };
      legato(sel, ctx);
      expect(formatSelection(sel)).to.equal("X:1\nK:C\nC2-  C/ D|\n");
    });

    it("rest with explicit duration: C z2 D becomes C- C2 D (no consolidation due to different durations)", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nC z2 D|\n");
      const sel: Selection = {
        root,
        cursors: [selectAll(root, [TAGS.Note, TAGS.Rest])],
      };
      legato(sel, ctx);
      expect(formatSelection(sel)).to.equal("X:1\nK:C\nC- C2 D|\n");
    });
  });

  describe("property-based tests", () => {
    const genNoteOrRest = fc.constantFrom("C", "D", "E", "z");
    const genSequence = fc.array(genNoteOrRest, { minLength: 2, maxLength: 8 });

    it("idempotence: applying legato twice yields the same result as once", () => {
      fc.assert(
        fc.property(genSequence, (elements) => {
          const source = "X:1\nK:C\n" + elements.join(" ") + "|\n";
          const { root: root1, ctx: ctx1 } = toCSTreeWithContext(source);
          const sel1: Selection = {
            root: root1,
            cursors: [selectAll(root1, [TAGS.Note, TAGS.Rest])],
          };
          legato(sel1, ctx1);
          const afterOnce = formatSelection(sel1);

          const { root: root2, ctx: ctx2 } = toCSTreeWithContext(afterOnce);
          const sel2: Selection = {
            root: root2,
            cursors: [selectAll(root2, [TAGS.Note, TAGS.Rest])],
          };
          legato(sel2, ctx2);
          const afterTwice = formatSelection(sel2);

          expect(afterTwice).to.equal(afterOnce);
        }),
        { numRuns: 100 }
      );
    });

    it("total duration is preserved", () => {
      fc.assert(
        fc.property(genSequence, (elements) => {
          const source = "X:1\nK:C\n" + elements.join(" ") + "|\n";
          const { root, ctx } = toCSTreeWithContext(source);

          const durationBefore = sumDurations(root);

          const sel: Selection = {
            root,
            cursors: [selectAll(root, [TAGS.Note, TAGS.Rest])],
          };
          legato(sel, ctx);

          const durationAfter = sumDurations(root);

          expect(durationAfter.numerator * durationBefore.denominator).to.equal(
            durationBefore.numerator * durationAfter.denominator
          );
        }),
        { numRuns: 100 }
      );
    });

    it("rest count is non-increasing", () => {
      fc.assert(
        fc.property(genSequence, (elements) => {
          const source = "X:1\nK:C\n" + elements.join(" ") + "|\n";
          const { root, ctx } = toCSTreeWithContext(source);

          const restCountBefore = countByTag(root, TAGS.Rest);

          const sel: Selection = {
            root,
            cursors: [selectAll(root, [TAGS.Note, TAGS.Rest])],
          };
          legato(sel, ctx);

          const restCountAfter = countByTag(root, TAGS.Rest);

          expect(restCountAfter).to.be.at.most(restCountBefore);
        }),
        { numRuns: 100 }
      );
    });

    it("note count is non-decreasing", () => {
      fc.assert(
        fc.property(genSequence, (elements) => {
          const source = "X:1\nK:C\n" + elements.join(" ") + "|\n";
          const { root, ctx } = toCSTreeWithContext(source);

          const noteCountBefore = countByTag(root, TAGS.Note);

          const sel: Selection = {
            root,
            cursors: [selectAll(root, [TAGS.Note, TAGS.Rest])],
          };
          legato(sel, ctx);

          const noteCountAfter = countByTag(root, TAGS.Note);

          expect(noteCountAfter).to.be.at.least(noteCountBefore);
        }),
        { numRuns: 100 }
      );
    });

    it("pitch content is preserved: every pitch in output appears in input", () => {
      fc.assert(
        fc.property(genSequence, (elements) => {
          const source = "X:1\nK:C\n" + elements.join(" ") + "|\n";
          const { root, ctx } = toCSTreeWithContext(source);

          const pitchesBefore = new Set<string>();
          for (const note of findByTag(root, TAGS.Note)) {
            const pitch = getPitchFromNote(note);
            if (pitch) pitchesBefore.add(pitch);
          }

          const sel: Selection = {
            root,
            cursors: [selectAll(root, [TAGS.Note, TAGS.Rest])],
          };
          legato(sel, ctx);

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

    it("no orphaned ties in single-bar sequences", () => {
      fc.assert(
        fc.property(genSequence, (elements) => {
          const source = "X:1\nK:C\n" + elements.join(" ") + "|\n";
          const { root, ctx } = toCSTreeWithContext(source);

          const sel: Selection = {
            root,
            cursors: [selectAll(root, [TAGS.Note, TAGS.Rest])],
          };
          legato(sel, ctx);

          const notes = findByTag(root, TAGS.Note);
          for (let i = 0; i < notes.length; i++) {
            if (hasTie(notes[i])) {
              expect(i).to.be.lessThan(notes.length - 1);
            }
          }
        }),
        { numRuns: 100 }
      );
    });
  });
});
