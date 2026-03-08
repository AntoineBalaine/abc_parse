import { ABCContext, Scanner, parse } from "abc-parser";
import { expect } from "chai";
import * as barmap from "../src/context/csBarMap";
import { fromAst } from "../src/csTree/fromAst";
import { CSNode, TAGS } from "../src/csTree/types";
import { findFirstByTag } from "../src/selectors/treeWalk";

function parseToCSTree(input: string): CSNode {
  const ctx = new ABCContext();
  const tokens = Scanner(input, ctx);
  const ast = parse(tokens, ctx);
  return fromAst(ast, ctx);
}

function findTuneBody(root: CSNode): CSNode {
  const tuneBody = findFirstByTag(root, TAGS.Tune_Body);
  if (!tuneBody) {
    throw new Error("Tune has no body");
  }
  return tuneBody;
}

function barMap(input: string, startingVoiceId = "1"): barmap.BarMap {
  const root = parseToCSTree(input);
  const tuneBody = findTuneBody(root);
  return barmap.buildMap(tuneBody, startingVoiceId);
}

function barCount(map: barmap.BarMap, voiceId: string): number {
  return map.get(voiceId)?.size ?? 0;
}

function barNumbers(map: barmap.BarMap, voiceId: string): number[] {
  const entries = map.get(voiceId);
  if (!entries) return [];
  return [...entries.keys()].sort((a, b) => a - b);
}

describe("CSTree barmap.BarMap", () => {
  describe("single voice", () => {
    it("content with no barlines produces one bar (closed by finalize)", () => {
      const map = barMap("X:1\nK:C\nC D E F\n");
      expect(barCount(map, "1")).to.equal(1);
      expect(barNumbers(map, "1")).to.deep.equal([0]);
    });

    it("barlines split content into bars", () => {
      const map = barMap("X:1\nK:C\nC D | E F |\n");
      expect(barCount(map, "1")).to.equal(2);
      expect(barNumbers(map, "1")).to.deep.equal([0, 1]);
    });

    it("three bars with trailing content after last barline", () => {
      const map = barMap("X:1\nK:C\nC D | E F | G A\n");
      expect(barCount(map, "1")).to.equal(3);
      expect(barNumbers(map, "1")).to.deep.equal([0, 1, 2]);
    });

    it("EOL after barline does not create a spurious empty bar", () => {
      const map = barMap("X:1\nK:C\nC D |\n");
      expect(barCount(map, "1")).to.equal(1);
    });

    it("consecutive barlines create bars for each", () => {
      const map = barMap("X:1\nK:C\nC | D || E |\n");
      expect(barCount(map, "1")).to.equal(3);
    });

    it("closing node ID points to distinct nodes per bar", () => {
      const root = parseToCSTree("X:1\nK:C\nC D | E F\n");
      const tuneBody = findTuneBody(root);
      const map = barmap.buildMap(tuneBody, "1");
      const entries = map.get("1")!;

      // Bar 0 is closed by the barline; bar 1 is closed by the last note
      const bar0 = entries.get(0)!;
      const bar1 = entries.get(1)!;
      expect(bar0.closingNodeId).to.be.a("number");
      expect(bar1.closingNodeId).to.be.a("number");
      expect(bar0.closingNodeId).to.not.equal(bar1.closingNodeId);
    });

    it("multi-measure rest counts as content", () => {
      const map = barMap("X:1\nK:C\nC D | Z4 |\n");
      expect(barCount(map, "1")).to.equal(2);
    });
  });

  describe("multi-voice with info lines", () => {
    it("creates separate entries per voice", () => {
      const map = barMap("X:1\nK:C\nV:1\nC D |\nV:2\nE F |\n");
      expect(barCount(map, "1")).to.equal(1);
      expect(barCount(map, "2")).to.equal(1);
    });

    it("voice switch closes the outgoing voice's bar", () => {
      const map = barMap("X:1\nK:C\nV:1\nC D\nV:2\nE F\n");
      expect(barCount(map, "1")).to.equal(1);
      expect(barCount(map, "2")).to.equal(1);
    });

    it("voices with different bar counts", () => {
      const map = barMap("X:1\nK:C\nV:1\nC D | E F | G A\nV:2\nB c |\n");
      expect(barCount(map, "1")).to.equal(3);
      expect(barCount(map, "2")).to.equal(1);
    });

    it("switching back to an existing voice continues its bar numbering", () => {
      const map = barMap("X:1\nK:C\nV:1\nC D |\nV:2\nE F |\nV:1\nG A |\n");
      expect(barCount(map, "1")).to.equal(2);
      expect(barCount(map, "2")).to.equal(1);
      expect(barNumbers(map, "1")).to.deep.equal([0, 1]);
    });
  });

  describe("multi-voice with inline fields", () => {
    it("inline [V:] triggers voice switch", () => {
      const map = barMap("X:1\nK:C\nC D | [V:2] E F |\n");
      expect(barCount(map, "1")).to.equal(1);
      expect(barCount(map, "2")).to.equal(1);
    });
  });

  describe("bar number sequencing", () => {
    it("bar numbers start at 0 and increment", () => {
      const map = barMap("X:1\nK:C\nC | D | E | F\n");
      expect(barNumbers(map, "1")).to.deep.equal([0, 1, 2, 3]);
    });

    it("bar numbers are independent per voice", () => {
      const map = barMap("X:1\nK:C\nV:1\nC | D | E\nV:2\nF | G\n");
      expect(barNumbers(map, "1")).to.deep.equal([0, 1, 2]);
      expect(barNumbers(map, "2")).to.deep.equal([0, 1]);
    });
  });

  describe("edge cases", () => {
    it("empty tune body produces no bars", () => {
      const map = barMap("X:1\nK:C\n");
      expect(barCount(map, "1")).to.equal(0);
    });

    it("only barlines with no content still produce bars", () => {
      const map = barMap("X:1\nK:C\n| |\n");
      expect(barCount(map, "1")).to.equal(2);
    });

    it("decorations count as content", () => {
      const map = barMap("X:1\nK:C\n.C D |\n");
      expect(barCount(map, "1")).to.equal(1);
    });

    it("grace notes count as content", () => {
      const map = barMap("X:1\nK:C\n{B}C D |\n");
      expect(barCount(map, "1")).to.equal(1);
    });

    it("multiple systems (lines) accumulate bars", () => {
      const map = barMap("X:1\nK:C\nC D |\nE F |\n");
      expect(barCount(map, "1")).to.equal(2);
    });

    it("named voices work as voice IDs", () => {
      const map = barMap("X:1\nK:C\nV:Tenor\nC D |\nV:Bass\nE F |\n", "Tenor");
      expect(barCount(map, "Tenor")).to.equal(1);
      expect(barCount(map, "Bass")).to.equal(1);
    });
  });
});
