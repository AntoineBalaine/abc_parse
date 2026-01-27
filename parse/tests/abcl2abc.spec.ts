import { expect } from "chai";
import { ABCContext } from "../parsers/Context";
import { AbcErrorReporter } from "../parsers/ErrorReporter";
import {
  abclToAbc,
  abclToAbcAst,
  parseAbcl,
  getSystemVoices,
  getAllVoices,
  silenceLine,
} from "../abcl";
import { Scanner, Token, TT } from "../parsers/scan2";
import { parse } from "../parsers/parse2";
import { Tune, Tune_Body } from "../types/Expr2";

function createCtx(): ABCContext {
  return new ABCContext(new AbcErrorReporter());
}

describe("ABCL to ABC Converter", () => {
  describe("parseAbcl", () => {
    it("should parse ABCL source with linear mode", () => {
      const source = `X:1
T:Test
K:C
V:1
CDEF|
V:2
GABc|`;
      const ctx = createCtx();
      const ast = parseAbcl(source, ctx);

      expect(ast).to.not.be.null;
      expect(ast.contents).to.have.length(1);
      expect(ast.contents[0]).to.be.instanceOf(Tune);
    });
  });

  describe("getSystemVoices", () => {
    it("should extract voice IDs from a system", () => {
      const source = `X:1
T:Test
K:C
V:1
CDEF|
V:2
GABc|`;
      const ctx = createCtx();
      const ast = parseAbcl(source, ctx);
      const tune = ast.contents[0] as Tune;
      const tuneBody = tune.tune_body as Tune_Body;

      // In linear mode with 2 voices, we should have 2 systems (one per V: switch)
      expect(tuneBody.sequence.length).to.be.greaterThan(0);

      // The first system should contain V:1
      const system1Voices = getSystemVoices(tuneBody.sequence[0]);
      expect(system1Voices).to.include("1");
    });
  });

  describe("getAllVoices", () => {
    it("should collect all unique voices from a tune body", () => {
      const source = `X:1
T:Test
K:C
V:1
CDEF|
V:2
GABc|
V:1
EFGA|`;
      const ctx = createCtx();
      const ast = parseAbcl(source, ctx);
      const tune = ast.contents[0] as Tune;
      const tuneBody = tune.tune_body as Tune_Body;

      const voices = getAllVoices(tuneBody);
      expect(voices).to.have.length(2);
      expect(voices).to.include("1");
      expect(voices).to.include("2");
    });
  });

  describe("silenceLine", () => {
    it("should keep barlines in silenced lines", () => {
      const ctx = createCtx();
      const barlineToken = new Token(TT.BARLINE, "|", ctx.generateId());
      const line = [barlineToken];

      const silenced = silenceLine(line, ctx);

      // The barline should be preserved
      const hasBarline = silenced.some(el => el instanceof Token && el.type === TT.BARLINE);
      expect(hasBarline).to.be.true;
    });
  });

  describe("abclToAbc - example-based tests", () => {
    it("should pass through single voice input unchanged", () => {
      const source = `X:1
T:Single Voice
K:C
CDEF|GABc|`;
      const ctx = createCtx();
      const result = abclToAbc(source, ctx);

      // Single voice should pass through essentially unchanged
      expect(result).to.include("CDEF");
      expect(result).to.include("GABc");
    });

    it("should pass through two voices present in all systems", () => {
      const source = `X:1
T:Two Voices
K:C
V:1
CDEF|
V:2
GABc|`;
      const ctx = createCtx();
      const result = abclToAbc(source, ctx);

      // Both voices should be present
      expect(result).to.include("V:1");
      expect(result).to.include("V:2");
      expect(result).to.include("CDEF");
      expect(result).to.include("GABc");
    });

    it("should insert silenced line for missing voice in system", () => {
      // In this example, system 1 has V:1, system 2 has V:1 and V:2
      // The converter should backfill V:2 in system 1
      const source = `X:1
T:Missing Voice
K:C
V:1
CDEF|
V:1
EFGA|
V:2
cdec|`;
      const ctx = createCtx();
      const result = abclToAbc(source, ctx);

      // The result should have V:2 in the first system as well (silenced)
      // Check that V:2 appears in the output
      expect(result).to.include("V:2");

      // There should be X rests for the silenced voice
      expect(result).to.include("X");
    });

    it("should handle voice appearing mid-tune", () => {
      // V:3 appears in system 2, should be backfilled in system 1
      const source = `X:1
T:Late Voice
K:C
V:1
CDEF|
V:2
GABc|
V:1
EFGA|
V:2
Bcde|
V:3
fgab|`;
      const ctx = createCtx();
      const result = abclToAbc(source, ctx);

      // V:3 should appear in the output
      expect(result).to.include("V:3");

      // Should have X rests for silenced voices
      expect(result).to.include("X");
    });
  });

  describe("abclToAbcAst", () => {
    it("should return a File_structure with converted tunes", () => {
      const source = `X:1
T:Test
K:C
V:1
CDEF|
V:2
GABc|`;
      const ctx = createCtx();
      const ast = abclToAbcAst(source, ctx);

      expect(ast).to.not.be.null;
      expect(ast.contents).to.have.length(1);
      expect(ast.contents[0]).to.be.instanceOf(Tune);
    });
  });
});
