import { expect } from "chai";
import { describe, it } from "mocha";

// The wrapDynamic functionality is now a simple text insertion in the server.
// These tests verify the text manipulation logic.

const DYNAMIC_MARKERS = {
  crescendo: { start: "!<(!", end: "!<)!" },
  decrescendo: { start: "!>(!", end: "!>)!" },
};

function wrapDynamic(
  text: string,
  startOffset: number,
  endOffset: number,
  dynamicType: "crescendo" | "decrescendo"
): string {
  const markers = DYNAMIC_MARKERS[dynamicType];
  return (
    text.slice(0, startOffset) +
    markers.start +
    text.slice(startOffset, endOffset) +
    markers.end +
    text.slice(endOffset)
  );
}

describe("wrapDynamic (text-based)", () => {
  describe("crescendo", () => {
    it("wraps a single note", () => {
      const text = "X:1\nK:C\nCDE|\n";
      const result = wrapDynamic(text, 8, 9, "crescendo"); // wrap 'C'
      expect(result).to.equal("X:1\nK:C\n!<(!C!<)!DE|\n");
    });

    it("wraps multiple notes", () => {
      const text = "X:1\nK:C\nCDE|\n";
      const result = wrapDynamic(text, 8, 11, "crescendo"); // wrap 'CDE'
      expect(result).to.equal("X:1\nK:C\n!<(!CDE!<)!|\n");
    });

    it("wraps notes in a chord", () => {
      const text = "X:1\nK:C\n[CEG]|\n";
      const result = wrapDynamic(text, 8, 13, "crescendo"); // wrap '[CEG]'
      expect(result).to.equal("X:1\nK:C\n!<(![CEG]!<)!|\n");
    });

    it("handles selection at start of line", () => {
      const text = "X:1\nK:C\nABCD|\n";
      const result = wrapDynamic(text, 8, 10, "crescendo"); // wrap 'AB'
      expect(result).to.equal("X:1\nK:C\n!<(!AB!<)!CD|\n");
    });

    it("handles selection at end of line", () => {
      const text = "X:1\nK:C\nABCD|\n";
      const result = wrapDynamic(text, 10, 12, "crescendo"); // wrap 'CD'
      expect(result).to.equal("X:1\nK:C\nAB!<(!CD!<)!|\n");
    });
  });

  describe("decrescendo", () => {
    it("wraps notes in decrescendo", () => {
      const text = "X:1\nK:C\nCDE|\n";
      const result = wrapDynamic(text, 8, 11, "decrescendo"); // wrap 'CDE'
      expect(result).to.equal("X:1\nK:C\n!>(!CDE!>)!|\n");
    });
  });

  describe("multiline", () => {
    it("handles selection spanning multiple lines", () => {
      const text = "X:1\nK:C\nABC|\nDEF|\n";
      const result = wrapDynamic(text, 8, 16, "crescendo"); // wrap 'ABC|\nDEF' (before second |)
      expect(result).to.equal("X:1\nK:C\n!<(!ABC|\nDEF!<)!|\n");
    });
  });

  describe("edge cases", () => {
    it("handles empty selection (markers adjacent)", () => {
      const text = "X:1\nK:C\nCDE|\n";
      const result = wrapDynamic(text, 9, 9, "crescendo"); // empty selection after 'C'
      expect(result).to.equal("X:1\nK:C\nC!<(!!<)!DE|\n");
    });

    it("handles selection with rhythm values", () => {
      const text = "X:1\nK:C\nC2D2E2|\n";
      const result = wrapDynamic(text, 8, 14, "crescendo"); // wrap 'C2D2E2'
      expect(result).to.equal("X:1\nK:C\n!<(!C2D2E2!<)!|\n");
    });

    it("handles selection with decorations already present", () => {
      const text = "X:1\nK:C\n!f!CDE|\n";
      const result = wrapDynamic(text, 8, 14, "crescendo"); // wrap '!f!CDE'
      expect(result).to.equal("X:1\nK:C\n!<(!!f!CDE!<)!|\n");
    });
  });
});
