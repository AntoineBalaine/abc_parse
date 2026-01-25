import { expect } from "chai";
import { describe, it } from "mocha";
import * as fc from "fast-check";
import { toCSTreeWithContext, formatSelection, findByTag } from "./helpers";
import { TAGS, isTokenNode, getTokenData } from "../src/csTree/types";
import { Selection } from "../src/selection";
import { consolidateRests } from "../src/transforms/consolidateRests";
import { getNodeRhythm } from "../src/transforms/rhythm";
import { addRational, createRational, IRational, TT } from "abc-parser";

function countRests(formatted: string): number {
  // Count both visible (z) and invisible (x) rests
  let count = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (formatted[i] === "z" || formatted[i] === "x") {
      count++;
    }
  }
  return count;
}

function sumRestDurations(root: any): IRational {
  const rests = findByTag(root, TAGS.Rest);
  let sum = createRational(0, 1);
  for (const rest of rests) {
    sum = addRational(sum, getNodeRhythm(rest));
  }
  return sum;
}

function getRestType(restNode: any): string | null {
  let current = restNode.firstChild;
  while (current !== null) {
    if (isTokenNode(current)) {
      const tokenData = getTokenData(current);
      if (tokenData.tokenType === TT.REST) {
        return tokenData.lexeme;
      }
    }
    current = current.nextSibling;
  }
  return null;
}

describe("consolidateRests", () => {
  describe("example-based tests", () => {
    it("two half-note rests become one whole rest: z/2 z/2 -> z", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nz/2 z/2 |\n");
      const rests = findByTag(root, TAGS.Rest);
      const sel: Selection = { root, cursors: [new Set(rests.map((r) => r.id))] };
      consolidateRests(sel, ctx);
      const formatted = formatSelection(sel);
      // The formatted output should have just z followed by whitespace and bar
      expect(formatted).to.match(/z\s*\|/);
      expect(countRests(formatted)).to.equal(1);
    });

    it("two quarter rests become one half rest: z z -> z2", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nz z |\n");
      const rests = findByTag(root, TAGS.Rest);
      const sel: Selection = { root, cursors: [new Set(rests.map((r) => r.id))] };
      consolidateRests(sel, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("z2");
      expect(countRests(formatted)).to.equal(1);
    });

    it("two half rests become one whole rest: z2 z2 -> z4", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nz2 z2 |\n");
      const rests = findByTag(root, TAGS.Rest);
      const sel: Selection = { root, cursors: [new Set(rests.map((r) => r.id))] };
      consolidateRests(sel, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("z4");
      expect(countRests(formatted)).to.equal(1);
    });

    it("different durations are not consolidated: z z/2 stays unchanged", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nz z/2 |\n");
      const rests = findByTag(root, TAGS.Rest);
      const sel: Selection = { root, cursors: [new Set(rests.map((r) => r.id))] };
      consolidateRests(sel, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.match(/z\s+z\/2/);
      expect(countRests(formatted)).to.equal(2);
    });

    it("different rest types are not consolidated: z x stays unchanged", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nz x |\n");
      const rests = findByTag(root, TAGS.Rest);
      const sel: Selection = { root, cursors: [new Set(rests.map((r) => r.id))] };
      consolidateRests(sel, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.match(/z\s+x/);
      expect(countRests(formatted)).to.equal(2);
    });

    it("invisible rests consolidate: x x -> x2", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nx x |\n");
      const rests = findByTag(root, TAGS.Rest);
      const sel: Selection = { root, cursors: [new Set(rests.map((r) => r.id))] };
      consolidateRests(sel, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("x2");
      expect(countRests(formatted)).to.equal(1);
    });

    it("bar line stops consolidation: z | z stays unchanged", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nz | z |\n");
      const rests = findByTag(root, TAGS.Rest);
      const sel: Selection = { root, cursors: [new Set(rests.map((r) => r.id))] };
      consolidateRests(sel, ctx);
      const formatted = formatSelection(sel);
      expect(countRests(formatted)).to.equal(2);
    });

    it("three identical rests: first two consolidate, third stays: z z z -> z2 z", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nz z z |\n");
      const rests = findByTag(root, TAGS.Rest);
      const sel: Selection = { root, cursors: [new Set(rests.map((r) => r.id))] };
      consolidateRests(sel, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("z2");
      expect(countRests(formatted)).to.equal(2);
    });

    it("non-power-of-two result is not consolidated: z/3 z/3 stays unchanged", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nz/3 z/3 |\n");
      const rests = findByTag(root, TAGS.Rest);
      const sel: Selection = { root, cursors: [new Set(rests.map((r) => r.id))] };
      consolidateRests(sel, ctx);
      const formatted = formatSelection(sel);
      expect(countRests(formatted)).to.equal(2);
    });

    it("note between rests prevents consolidation: z C z stays unchanged", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nz C z |\n");
      const rests = findByTag(root, TAGS.Rest);
      const sel: Selection = { root, cursors: [new Set(rests.map((r) => r.id))] };
      consolidateRests(sel, ctx);
      const formatted = formatSelection(sel);
      expect(countRests(formatted)).to.equal(2);
    });

    it("selection of only first rest still consolidates with next sibling", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nz z |\n");
      const rests = findByTag(root, TAGS.Rest);
      // Only select the first rest - the algorithm still looks at next sibling
      const sel: Selection = { root, cursors: [new Set([rests[0].id])] };
      consolidateRests(sel, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("z2");
    });

    it("eighth rests consolidate: z/8 z/8 -> z/4", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nz/8 z/8 |\n");
      const rests = findByTag(root, TAGS.Rest);
      const sel: Selection = { root, cursors: [new Set(rests.map((r) => r.id))] };
      consolidateRests(sel, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("z/4");
      expect(countRests(formatted)).to.equal(1);
    });

    it("sixteenth rests consolidate: z/16 z/16 -> z/8", () => {
      const { root, ctx } = toCSTreeWithContext("X:1\nK:C\nz/16 z/16 |\n");
      const rests = findByTag(root, TAGS.Rest);
      const sel: Selection = { root, cursors: [new Set(rests.map((r) => r.id))] };
      consolidateRests(sel, ctx);
      const formatted = formatSelection(sel);
      expect(formatted).to.contain("z/8");
      expect(countRests(formatted)).to.equal(1);
    });
  });

  describe("property-based tests", () => {
    it("idempotence: applying consolidateRests twice yields the same result as once", () => {
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom("z", "z/2", "z2", "z/4", "z4"), { minLength: 1, maxLength: 5 }),
          (restStrings) => {
            const source = "X:1\nK:C\n" + restStrings.join(" ") + " |\n";
            const { root: root1, ctx: ctx1 } = toCSTreeWithContext(source);
            const rests1 = findByTag(root1, TAGS.Rest);
            const sel1: Selection = { root: root1, cursors: [new Set(rests1.map((r) => r.id))] };
            consolidateRests(sel1, ctx1);
            const afterOnce = formatSelection(sel1);

            // Apply again
            const { root: root2, ctx: ctx2 } = toCSTreeWithContext(afterOnce);
            const rests2 = findByTag(root2, TAGS.Rest);
            const sel2: Selection = { root: root2, cursors: [new Set(rests2.map((r) => r.id))] };
            consolidateRests(sel2, ctx2);
            const afterTwice = formatSelection(sel2);

            expect(afterTwice).to.equal(afterOnce);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("total duration is preserved", () => {
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom("z", "z/2", "z2", "z/4", "z4", "z/8", "z8"), { minLength: 2, maxLength: 6 }),
          (restStrings) => {
            const source = "X:1\nK:C\n" + restStrings.join(" ") + " |\n";
            const { root, ctx } = toCSTreeWithContext(source);

            const durationBefore = sumRestDurations(root);

            const rests = findByTag(root, TAGS.Rest);
            const sel: Selection = { root, cursors: [new Set(rests.map((r) => r.id))] };
            consolidateRests(sel, ctx);

            const durationAfter = sumRestDurations(root);

            expect(durationAfter.numerator * durationBefore.denominator).to.equal(
              durationBefore.numerator * durationAfter.denominator
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it("rest count is non-increasing", () => {
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom("z", "z/2", "z2", "z/4", "z4"), { minLength: 1, maxLength: 5 }),
          (restStrings) => {
            const source = "X:1\nK:C\n" + restStrings.join(" ") + " |\n";
            const { root, ctx } = toCSTreeWithContext(source);

            const countBefore = findByTag(root, TAGS.Rest).length;

            const rests = findByTag(root, TAGS.Rest);
            const sel: Selection = { root, cursors: [new Set(rests.map((r) => r.id))] };
            consolidateRests(sel, ctx);

            const countAfter = findByTag(root, TAGS.Rest).length;

            expect(countAfter).to.be.at.most(countBefore);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("rest type is preserved: no z becomes x or vice versa", () => {
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom("z", "z/2", "z2"), { minLength: 1, maxLength: 4 }),
          fc.array(fc.constantFrom("x", "x/2", "x2"), { minLength: 1, maxLength: 4 }),
          (zRests, xRests) => {
            // Interleave z and x rests to ensure they don't get consolidated together
            const source = "X:1\nK:C\n" + zRests.join(" ") + " | " + xRests.join(" ") + " |\n";
            const { root, ctx } = toCSTreeWithContext(source);

            const restsBefore = findByTag(root, TAGS.Rest);
            const zCountBefore = restsBefore.filter((r) => getRestType(r) === "z").length;
            const xCountBefore = restsBefore.filter((r) => getRestType(r) === "x").length;

            const sel: Selection = { root, cursors: [new Set(restsBefore.map((r) => r.id))] };
            consolidateRests(sel, ctx);

            const restsAfter = findByTag(root, TAGS.Rest);
            const zCountAfter = restsAfter.filter((r) => getRestType(r) === "z").length;
            const xCountAfter = restsAfter.filter((r) => getRestType(r) === "x").length;

            // Type counts should be non-increasing (consolidation may reduce count, but not change type)
            expect(zCountAfter).to.be.at.most(zCountBefore);
            expect(xCountAfter).to.be.at.most(xCountBefore);
            // And there should be no new types appearing
            if (zCountBefore === 0) {
              expect(zCountAfter).to.equal(0);
            }
            if (xCountBefore === 0) {
              expect(xCountAfter).to.equal(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
