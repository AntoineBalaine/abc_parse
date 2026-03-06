import { expect } from "chai";
import { ABCContext } from "../parsers/Context";
import { parse } from "../parsers/parse2";
import { Scanner } from "../parsers/scan2";
import { Tune, Tune_Body } from "../types/Expr2";
import { buildBarMap, BarMap } from "./BarMapVisitor";

function parseTuneBody(input: string): { tuneBody: Tune_Body; ctx: ABCContext } {
  const ctx = new ABCContext();
  const tokens = Scanner(input, ctx);
  const ast = parse(tokens, ctx);
  const tune = ast.contents[0] as Tune;
  if (!tune.tune_body) {
    throw new Error("Tune has no body");
  }
  return { tuneBody: tune.tune_body, ctx };
}

function barMap(input: string, startingVoiceId = "1"): BarMap {
  const { tuneBody } = parseTuneBody(input);
  return buildBarMap(tuneBody, startingVoiceId);
}

function barCount(map: BarMap, voiceId: string): number {
  return map.get(voiceId)?.size ?? 0;
}

function barNumbers(map: BarMap, voiceId: string): number[] {
  const entries = map.get(voiceId);
  if (!entries) return [];
  return [...entries.keys()].sort((a, b) => a - b);
}

describe("BarMapVisitor", () => {
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
      // The barline closes bar 0, then EOL sees hasContent=false, so no extra bar.
      const map = barMap("X:1\nK:C\nC D |\n");
      expect(barCount(map, "1")).to.equal(1);
    });

    it("consecutive barlines create bars for each", () => {
      const map = barMap("X:1\nK:C\nC | D || E |\n");
      // C closes at first |, D closes at ||, E closes at final |
      expect(barCount(map, "1")).to.equal(3);
    });

    it("closing node ID points to the barline node", () => {
      const { tuneBody } = parseTuneBody("X:1\nK:C\nC D | E F\n");
      const map = buildBarMap(tuneBody, "1");
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
      // Voice 1 has content "C D" with no barline. When V:2 is encountered,
      // voice 1's bar should be closed.
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
      // The voice is ensured but has no content, so finalize does nothing.
      expect(barCount(map, "1")).to.equal(0);
    });

    it("only barlines with no content still produce bars", () => {
      // Each barline always closes the current bar, even without content.
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
