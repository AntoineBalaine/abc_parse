import { expect } from "chai";
import { describe, it } from "mocha";
import * as fc from "fast-check";
import { toCSTreeWithContext, findByTag } from "./helpers";
import { TAGS, createCSNode } from "../src/csTree/types";
import { TT } from "../../parse/parsers/scan2";
import { ABCContext } from "../../parse/parsers/Context";
import { toAst } from "../src/csTree/toAst";
import { AbcFormatter } from "../../parse/Visitors/Formatter2";
import { Expr } from "../../parse/types/Expr2";
import { createRational } from "../../parse/Visitors/fmt2/rational";
import { findChildByTag } from "../src/transforms/treeUtils";
import {
  rhythmToRational,
  rationalToRhythm,
  extractBrokenToken,
  getNodeRhythm,
} from "../src/transforms/rhythm";

function formatRhythmCSNode(rhythmNode: any, ctx: ABCContext): string {
  const ast = toAst(rhythmNode);
  return new AbcFormatter(ctx).stringify(ast as Expr);
}

describe("rhythm utilities", () => {
  describe("rhythmToRational", () => {
    it("converts rhythm '2' (numerator only) to {2, 1}", () => {
      const { root } = toCSTreeWithContext("X:1\nK:C\nC2|\n");
      const notes = findByTag(root, TAGS.Note);
      const rhythmResult = findChildByTag(notes[0], TAGS.Rhythm);
      expect(rhythmResult).to.not.be.null;
      const r = rhythmToRational(rhythmResult!.node);
      expect(r.numerator).to.equal(2);
      expect(r.denominator).to.equal(1);
    });

    it("converts rhythm '/' (separator only) to {1, 2}", () => {
      const { root } = toCSTreeWithContext("X:1\nK:C\nC/|\n");
      const notes = findByTag(root, TAGS.Note);
      const rhythmResult = findChildByTag(notes[0], TAGS.Rhythm);
      expect(rhythmResult).to.not.be.null;
      const r = rhythmToRational(rhythmResult!.node);
      expect(r.numerator).to.equal(1);
      expect(r.denominator).to.equal(2);
    });

    it("converts rhythm '3/4' to {3, 4}", () => {
      const { root } = toCSTreeWithContext("X:1\nK:C\nC3/4|\n");
      const notes = findByTag(root, TAGS.Note);
      const rhythmResult = findChildByTag(notes[0], TAGS.Rhythm);
      expect(rhythmResult).to.not.be.null;
      const r = rhythmToRational(rhythmResult!.node);
      expect(r.numerator).to.equal(3);
      expect(r.denominator).to.equal(4);
    });

    it("converts rhythm '//' (two slashes) to {1, 4}", () => {
      const { root } = toCSTreeWithContext("X:1\nK:C\nC//|\n");
      const notes = findByTag(root, TAGS.Note);
      const rhythmResult = findChildByTag(notes[0], TAGS.Rhythm);
      expect(rhythmResult).to.not.be.null;
      const r = rhythmToRational(rhythmResult!.node);
      expect(r.numerator).to.equal(1);
      expect(r.denominator).to.equal(4);
    });

    it("converts rhythm '2>' (broken): rhythmToRational returns {2, 1}", () => {
      const { root } = toCSTreeWithContext("X:1\nK:C\nC2>D|\n");
      const notes = findByTag(root, TAGS.Note);
      const rhythmResult = findChildByTag(notes[0], TAGS.Rhythm);
      expect(rhythmResult).to.not.be.null;
      const r = rhythmToRational(rhythmResult!.node);
      expect(r.numerator).to.equal(2);
      expect(r.denominator).to.equal(1);
      const broken = extractBrokenToken(rhythmResult!.node);
      expect(broken).to.not.be.null;
    });
  });

  describe("rationalToRhythm", () => {
    it("creates a CSNode for {3, 4} that formats as '3/4'", () => {
      const ctx = new ABCContext();
      const result = rationalToRhythm(createRational(3, 4), ctx);
      expect(result).to.not.be.null;
      const formatted = formatRhythmCSNode(result!, ctx);
      expect(formatted).to.equal("3/4");
    });

    it("returns null for {1, 1} (default note length)", () => {
      const ctx = new ABCContext();
      const result = rationalToRhythm(createRational(1, 1), ctx);
      expect(result).to.be.null;
    });

    it("creates a CSNode with only the broken token for {1, 1} when brokenToken is provided", () => {
      const ctx = new ABCContext();
      const brokenToken = createCSNode(TAGS.Token, ctx.generateId(), {
        type: "token", lexeme: ">", tokenType: TT.RHY_BRKN, line: 0, position: 0
      });
      const result = rationalToRhythm(createRational(1, 1), ctx, brokenToken);
      expect(result).to.not.be.null;
      // The result should contain only the broken token
      const formatted = formatRhythmCSNode(result!, ctx);
      expect(formatted).to.equal(">");
    });

    it("creates a CSNode for {2, 1} that formats as '2'", () => {
      const ctx = new ABCContext();
      const result = rationalToRhythm(createRational(2, 1), ctx);
      expect(result).to.not.be.null;
      const formatted = formatRhythmCSNode(result!, ctx);
      expect(formatted).to.equal("2");
    });

    it("creates a CSNode for {2, 1} with brokenToken that formats as '2>'", () => {
      const ctx = new ABCContext();
      const brokenToken = createCSNode(TAGS.Token, ctx.generateId(), {
        type: "token", lexeme: ">", tokenType: TT.RHY_BRKN, line: 0, position: 0
      });
      const result = rationalToRhythm(createRational(2, 1), ctx, brokenToken);
      expect(result).to.not.be.null;
      const formatted = formatRhythmCSNode(result!, ctx);
      expect(formatted).to.equal("2>");
    });

    it("creates a CSNode for {1, 2} that formats as '/'", () => {
      const ctx = new ABCContext();
      const result = rationalToRhythm(createRational(1, 2), ctx);
      expect(result).to.not.be.null;
      const formatted = formatRhythmCSNode(result!, ctx);
      expect(formatted).to.equal("/");
    });

    it("returns null for {0, 1} (clamped to {1, 1})", () => {
      const ctx = new ABCContext();
      const result = rationalToRhythm(createRational(0, 1), ctx);
      expect(result).to.be.null;
    });

    it("returns null for {-1, 2} (clamped to {1, 1})", () => {
      const ctx = new ABCContext();
      const result = rationalToRhythm(createRational(-1, 2), ctx);
      expect(result).to.be.null;
    });

    it("produces only the broken token for {0, 1} with brokenToken", () => {
      const ctx = new ABCContext();
      const brokenToken = createCSNode(TAGS.Token, ctx.generateId(), {
        type: "token", lexeme: "<", tokenType: TT.RHY_BRKN, line: 0, position: 0
      });
      const result = rationalToRhythm(createRational(0, 1), ctx, brokenToken);
      expect(result).to.not.be.null;
      const formatted = formatRhythmCSNode(result!, ctx);
      expect(formatted).to.equal("<");
    });
  });

  describe("getNodeRhythm", () => {
    it("returns {1, 1} on a Note without a Rhythm child", () => {
      const { root } = toCSTreeWithContext("X:1\nK:C\nC|\n");
      const notes = findByTag(root, TAGS.Note);
      const r = getNodeRhythm(notes[0]);
      expect(r.numerator).to.equal(1);
      expect(r.denominator).to.equal(1);
    });

    it("returns the correct rational for a Note with a Rhythm child", () => {
      const { root } = toCSTreeWithContext("X:1\nK:C\nC3/4|\n");
      const notes = findByTag(root, TAGS.Note);
      const r = getNodeRhythm(notes[0]);
      expect(r.numerator).to.equal(3);
      expect(r.denominator).to.equal(4);
    });
  });

  describe("property-based: rhythmToRational roundtrip", () => {
    it("for Rhythm CSNodes without broken tokens, roundtripping via rationals preserves the formatted output", () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.integer({ min: 1, max: 16 }),
            fc.integer({ min: 1, max: 16 })
          ),
          ([num, den]) => {
            const ctx = new ABCContext();
            const rational = createRational(num, den);
            const rhythmNode = rationalToRhythm(rational, ctx);
            if (rhythmNode === null) {
              // This is the {1, 1} case - the default note length
              expect(rational.numerator).to.equal(1);
              expect(rational.denominator).to.equal(1);
              return;
            }
            const roundtripped = rhythmToRational(rhythmNode);
            expect(roundtripped.numerator).to.equal(rational.numerator);
            expect(roundtripped.denominator).to.equal(rational.denominator);
          }
        ),
        { numRuns: 1000 }
      );
    });

    it("for Rhythm CSNodes with broken tokens, the broken token is preserved through roundtrip", () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.integer({ min: 1, max: 16 }),
            fc.integer({ min: 1, max: 16 }),
            fc.constantFrom(">", "<", ">>", "<<")
          ),
          ([num, den, brokenLexeme]) => {
            const ctx = new ABCContext();
            const rational = createRational(num, den);
            const brokenToken = createCSNode(TAGS.Token, ctx.generateId(), {
              type: "token", lexeme: brokenLexeme, tokenType: TT.RHY_BRKN, line: 0, position: 0
            });
            const rhythmNode = rationalToRhythm(rational, ctx, brokenToken);
            expect(rhythmNode).to.not.be.null;
            const extracted = extractBrokenToken(rhythmNode!);
            expect(extracted).to.not.be.null;
          }
        ),
        { numRuns: 1000 }
      );
    });
  });
});
