import { expect } from "chai";
import { describe, it } from "mocha";
import { toCSTreeWithContext, findByTag, formatSelection } from "./helpers";
import { TAGS } from "../src/csTree/types";
import { Selection } from "../src/selection";
import { voiceInfoLineToInline, voiceInlineToInfoLine } from "../src/transforms/voiceMarkerTransform";

/**
 * Applies voiceInfoLineToInline to all V: info lines in the input and returns the formatted result.
 */
function applyInfoLineToInline(input: string): string {
  const { root, ctx } = toCSTreeWithContext(input);
  const infoLines = findByTag(root, TAGS.Info_line).filter(
    (n) => n.firstChild && n.firstChild.data.type === "token" && n.firstChild.data.lexeme === "V:"
  );
  if (infoLines.length === 0) {
    return formatSelection({ root, cursors: [] });
  }
  const sel: Selection = { root, cursors: infoLines.map((n) => new Set([n.id])) };
  voiceInfoLineToInline(sel, ctx);
  return formatSelection(sel);
}

/**
 * Applies voiceInlineToInfoLine to all V: inline fields in the input and returns the formatted result.
 */
function applyInlineToInfoLine(input: string): string {
  const { root, ctx } = toCSTreeWithContext(input);
  const inlineFields = findByTag(root, TAGS.Inline_field).filter((n) => {
    let child = n.firstChild;
    while (child) {
      if (child.data.type === "token" && child.data.lexeme === "V:") {
        return true;
      }
      child = child.nextSibling;
    }
    return false;
  });
  if (inlineFields.length === 0) {
    return formatSelection({ root, cursors: [] });
  }
  const sel: Selection = { root, cursors: inlineFields.map((n) => new Set([n.id])) };
  voiceInlineToInfoLine(sel, ctx);
  return formatSelection(sel);
}

describe("voiceMarkerTransform", () => {
  describe("voiceInfoLineToInline", () => {
    it("converts single V:1 info line to [V:1] inline", () => {
      const input = "X:1\nK:C\nV:1\nCDEF|\n";
      const expected = "X:1\nK:C\n[V:1] CDEF|\n";
      expect(applyInfoLineToInline(input)).to.equal(expected);
    });

    it("converts V:1 with clef parameter", () => {
      const input = "X:1\nK:C\nV:1 clef=treble\nCDEF|\n";
      const expected = "X:1\nK:C\n[V:1 clef=treble] CDEF|\n";
      expect(applyInfoLineToInline(input)).to.equal(expected);
    });

    it("converts V:1 with multiple parameters", () => {
      const input = "X:1\nK:C\nV:1 clef=bass stem=down\nCDEF|\n";
      const expected = "X:1\nK:C\n[V:1 clef=bass stem=down] CDEF|\n";
      expect(applyInfoLineToInline(input)).to.equal(expected);
    });

    it("converts multiple V: info lines", () => {
      const input = "X:1\nK:C\nV:1\nCDEF|\nV:2\nGABc|\n";
      const expected = "X:1\nK:C\n[V:1] CDEF|\n[V:2] GABc|\n";
      expect(applyInfoLineToInline(input)).to.equal(expected);
    });

    it("converts V: at end of tune with no following content", () => {
      const input = "X:1\nK:C\nCDEF|\nV:1\n";
      const expected = "X:1\nK:C\nCDEF|\n[V:1]\n";
      expect(applyInfoLineToInline(input)).to.equal(expected);
    });

    it("does not modify non-voice info lines", () => {
      const input = "X:1\nT:Test\nK:C\nCDEF|\n";
      const expected = "X:1\nT:Test\nK:C\nCDEF|\n";
      expect(applyInfoLineToInline(input)).to.equal(expected);
    });

    it("does not convert header V: lines, only body V: lines", () => {
      const input = "X:1\nT:Test\nM:4/4\nL:1/4\nV:1 name=A clef=treble\nV:2 name=B clef=bass\nK:C\nV:1\nFDEC\nV:2\n[F,A,]2\n";
      // Header V: lines (before K:) should stay as info lines
      // Body V: lines (after K:) should be converted to inline
      // Formatter adds spaces around = and /
      const expected = "X:1\nT:Test\nM:4 / 4\nL:1 / 4\nV:1 name = A clef = treble\nV:2 name = B clef = bass\nK:C\n[V:1] FDEC\n[V:2] [F,A,]2\n";
      expect(applyInfoLineToInline(input)).to.equal(expected);
    });
  });

  describe("voiceInlineToInfoLine", () => {
    it("converts single [V:1] inline to V:1 info line", () => {
      const input = "X:1\nK:C\n[V:1] CDEF|\n";
      const expected = "X:1\nK:C\nV:1\nCDEF|\n";
      expect(applyInlineToInfoLine(input)).to.equal(expected);
    });

    it("converts [V:1 clef=bass] with parameter", () => {
      const input = "X:1\nK:C\n[V:1 clef=bass] CDEF|\n";
      // Formatter adds spaces around = in info line content
      const expected = "X:1\nK:C\nV:1 clef = bass\nCDEF|\n";
      expect(applyInlineToInfoLine(input)).to.equal(expected);
    });

    it("converts [V:1] with multiple parameters", () => {
      const input = "X:1\nK:C\n[V:1 clef=treble stem=up] CDEF|\n";
      // Formatter adds spaces around = in info line content
      const expected = "X:1\nK:C\nV:1 clef = treble stem = up\nCDEF|\n";
      expect(applyInlineToInfoLine(input)).to.equal(expected);
    });

    it("converts multiple [V:] inline fields on same line", () => {
      const input = "X:1\nK:C\n[V:1] CDEF [V:2] GABc|\n";
      const expected = "X:1\nK:C\nV:1\nCDEF\nV:2\nGABc|\n";
      expect(applyInlineToInfoLine(input)).to.equal(expected);
    });

    it("converts multiple [V:] inline fields on different lines", () => {
      const input = "X:1\nK:C\n[V:1] CDEF|\n[V:2] GABc|\n";
      const expected = "X:1\nK:C\nV:1\nCDEF|\nV:2\nGABc|\n";
      expect(applyInlineToInfoLine(input)).to.equal(expected);
    });

    it("does not modify non-voice inline fields", () => {
      const input = "X:1\nK:C\n[M:3/4] CDEF|\n";
      const expected = "X:1\nK:C\n[M:3/4] CDEF|\n";
      expect(applyInlineToInfoLine(input)).to.equal(expected);
    });
  });

  describe("roundtrip", () => {
    it("info line to inline and back preserves content", () => {
      const input = "X:1\nK:C\nV:1\nCDEF|\n";
      const afterToInline = applyInfoLineToInline(input);
      const afterRoundtrip = applyInlineToInfoLine(afterToInline);
      expect(afterRoundtrip).to.equal(input);
    });

    it("roundtrip preserves voice parameters", () => {
      const input = "X:1\nK:C\nV:1 clef=treble\nCDEF|\n";
      const afterToInline = applyInfoLineToInline(input);
      const afterRoundtrip = applyInlineToInfoLine(afterToInline);
      // Formatter adds spaces around = in info line content
      const expected = "X:1\nK:C\nV:1 clef = treble\nCDEF|\n";
      expect(afterRoundtrip).to.equal(expected);
    });

    it("inline to info line and back preserves content", () => {
      const input = "X:1\nK:C\n[V:1] CDEF|\n";
      const afterToInfoLine = applyInlineToInfoLine(input);
      const afterRoundtrip = applyInfoLineToInline(afterToInfoLine);
      expect(afterRoundtrip).to.equal(input);
    });
  });
});
