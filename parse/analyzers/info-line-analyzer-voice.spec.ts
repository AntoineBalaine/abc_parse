import { expect } from "chai";
import { SemanticAnalyzer } from "./semantic-analyzer";
import { ABCContext } from "../parsers/Context";
import { AbcErrorReporter } from "../parsers/ErrorReporter";
import { Token, TT } from "../parsers/scan2";
import { Info_line, KV } from "../types/Expr2";
import { ClefType, StemDirection, ChordPlacement, BracketBracePosition } from "../types/abcjs-ast";

describe("Voice Info Line Analyzer - Example-Based Tests", () => {
  let analyzer: SemanticAnalyzer;
  let context: ABCContext;

  beforeEach(() => {
    const errorReporter = new AbcErrorReporter();
    context = new ABCContext(errorReporter);
    analyzer = new SemanticAnalyzer(context);
  });

  // ============================================================================
  // Simple Voice ID Tests
  // ============================================================================

  describe("Simple Voice IDs", () => {
    it("should parse V:1 (numeric voice ID)", () => {
      const infoLine = new Info_line(context.generateId(), [
        new Token(TT.IDENTIFIER, "V", context.generateId()),
        new Token(TT.NUMBER, "1", context.generateId()),
      ]);

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "voice") return;
      expect(result.data.id).to.equal("1");
      expect(result.data.properties).to.not.be.undefined;
    });

    it("should parse V:T1 (alphanumeric voice ID)", () => {
      const infoLine = new Info_line(context.generateId(), [
        new Token(TT.IDENTIFIER, "V", context.generateId()),
        new Token(TT.IDENTIFIER, "T1", context.generateId()),
      ]);

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "voice") return;
      expect(result.data.id).to.equal("T1");
    });

    it("should parse V:Soprano (text voice ID)", () => {
      const infoLine = new Info_line(context.generateId(), [
        new Token(TT.IDENTIFIER, "V", context.generateId()),
        new Token(TT.IDENTIFIER, "Soprano", context.generateId()),
      ]);

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "voice") return;
      expect(result.data.id).to.equal("Soprano");
    });
  });

  // ============================================================================
  // Voice with Name Property
  // ============================================================================

  describe("Voice with Name", () => {
    it('should parse V:1 name="Tenor"', () => {
      const nameKV = new KV(
        context.generateId(),
        new Token(TT.IDENTIFIER, "Tenor", context.generateId()),
        new Token(TT.IDENTIFIER, "name", context.generateId()),
        new Token(TT.EQL, "=", context.generateId())
      );

      const infoLine = new Info_line(
        context.generateId(),
        [new Token(TT.IDENTIFIER, "V", context.generateId()), new Token(TT.NUMBER, "1", context.generateId())],
        undefined,
        [nameKV]
      );

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "voice") return;
      expect(result.data.id).to.equal("1");
      expect(result.data.properties.name).to.equal("Tenor");
    });
  });

  // ============================================================================
  // Voice with Clef
  // ============================================================================

  describe("Voice with Clef", () => {
    it("should parse V:B clef=bass (simple clef)", () => {
      const clefKV = new KV(
        context.generateId(),
        new Token(TT.IDENTIFIER, "bass", context.generateId()),
        new Token(TT.IDENTIFIER, "clef", context.generateId()),
        new Token(TT.EQL, "=", context.generateId())
      );

      const infoLine = new Info_line(
        context.generateId(),
        [new Token(TT.IDENTIFIER, "V", context.generateId()), new Token(TT.IDENTIFIER, "B", context.generateId())],
        undefined,
        [clefKV]
      );

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "voice") return;
      const clef = result.data.properties.clef;
      expect(clef).to.not.be.undefined;
      if (!clef) return;
      expect(clef.type).to.equal(ClefType.Bass);
    });

    it("should parse V:1 clef=treble-8 (complex clef with octave shift)", () => {
      const clefKV = new KV(
        context.generateId(),
        new Token(TT.IDENTIFIER, "treble-8", context.generateId()),
        new Token(TT.IDENTIFIER, "clef", context.generateId()),
        new Token(TT.EQL, "=", context.generateId())
      );

      const infoLine = new Info_line(
        context.generateId(),
        [new Token(TT.IDENTIFIER, "V", context.generateId()), new Token(TT.NUMBER, "1", context.generateId())],
        undefined,
        [clefKV]
      );

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "voice") return;
      const clef = result.data.properties.clef;
      expect(clef).to.not.be.undefined;
      if (!clef) return;
      expect(clef.type).to.equal(ClefType.TrebleMinus8);
    });
  });

  // ============================================================================
  // Voice with Transpose
  // ============================================================================

  describe("Voice with Transpose", () => {
    it("should parse V:1 transpose=-12", () => {
      const transposeKV = new KV(
        context.generateId(),
        new Token(TT.NUMBER, "-12", context.generateId()),
        new Token(TT.IDENTIFIER, "transpose", context.generateId()),
        new Token(TT.EQL, "=", context.generateId())
      );

      const infoLine = new Info_line(
        context.generateId(),
        [new Token(TT.IDENTIFIER, "V", context.generateId()), new Token(TT.NUMBER, "1", context.generateId())],
        undefined,
        [transposeKV]
      );

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "voice") return;
      expect(result.data.properties.transpose).to.equal(-12);
    });

    it("should parse V:1 transpose=7", () => {
      const transposeKV = new KV(
        context.generateId(),
        new Token(TT.NUMBER, "7", context.generateId()),
        new Token(TT.IDENTIFIER, "transpose", context.generateId()),
        new Token(TT.EQL, "=", context.generateId())
      );

      const infoLine = new Info_line(
        context.generateId(),
        [new Token(TT.IDENTIFIER, "V", context.generateId()), new Token(TT.NUMBER, "1", context.generateId())],
        undefined,
        [transposeKV]
      );

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "voice") return;
      expect(result.data.properties.transpose).to.equal(7);
    });
  });

  // ============================================================================
  // Voice with Staff Properties
  // ============================================================================

  describe("Voice with Staff Properties", () => {
    it("should parse V:1 stafflines=4", () => {
      const stafflinesKV = new KV(
        context.generateId(),
        new Token(TT.NUMBER, "4", context.generateId()),
        new Token(TT.IDENTIFIER, "stafflines", context.generateId()),
        new Token(TT.EQL, "=", context.generateId())
      );

      const infoLine = new Info_line(
        context.generateId(),
        [new Token(TT.IDENTIFIER, "V", context.generateId()), new Token(TT.NUMBER, "1", context.generateId())],
        undefined,
        [stafflinesKV]
      );

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "voice") return;
      expect(result.data.properties.stafflines).to.equal(4);
    });

    it("should parse V:1 staffscale=0.8", () => {
      const staffscaleKV = new KV(
        context.generateId(),
        new Token(TT.NUMBER, "0.8", context.generateId()),
        new Token(TT.IDENTIFIER, "staffscale", context.generateId()),
        new Token(TT.EQL, "=", context.generateId())
      );

      const infoLine = new Info_line(
        context.generateId(),
        [new Token(TT.IDENTIFIER, "V", context.generateId()), new Token(TT.NUMBER, "1", context.generateId())],
        undefined,
        [staffscaleKV]
      );

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "voice") return;
      expect(result.data.properties.staffscale).to.equal(0.8);
    });
  });

  // ============================================================================
  // Voice with Stem Direction
  // ============================================================================

  describe("Voice with Stems", () => {
    it("should parse V:1 stems=up", () => {
      const stemsKV = new KV(
        context.generateId(),
        new Token(TT.IDENTIFIER, "up", context.generateId()),
        new Token(TT.IDENTIFIER, "stems", context.generateId()),
        new Token(TT.EQL, "=", context.generateId())
      );

      const infoLine = new Info_line(
        context.generateId(),
        [new Token(TT.IDENTIFIER, "V", context.generateId()), new Token(TT.NUMBER, "1", context.generateId())],
        undefined,
        [stemsKV]
      );

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "voice") return;
      expect(result.data.properties.stems).to.equal(StemDirection.Up);
    });

    it("should parse V:1 stems=down", () => {
      const stemsKV = new KV(
        context.generateId(),
        new Token(TT.IDENTIFIER, "down", context.generateId()),
        new Token(TT.IDENTIFIER, "stems", context.generateId()),
        new Token(TT.EQL, "=", context.generateId())
      );

      const infoLine = new Info_line(
        context.generateId(),
        [new Token(TT.IDENTIFIER, "V", context.generateId()), new Token(TT.NUMBER, "1", context.generateId())],
        undefined,
        [stemsKV]
      );

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "voice") return;
      expect(result.data.properties.stems).to.equal(StemDirection.Down);
    });
  });

  // ============================================================================
  // Voice with GChord Placement
  // ============================================================================

  describe("Voice with GChord", () => {
    it("should parse V:1 gchord=above", () => {
      const gchordKV = new KV(
        context.generateId(),
        new Token(TT.IDENTIFIER, "above", context.generateId()),
        new Token(TT.IDENTIFIER, "gchord", context.generateId()),
        new Token(TT.EQL, "=", context.generateId())
      );

      const infoLine = new Info_line(
        context.generateId(),
        [new Token(TT.IDENTIFIER, "V", context.generateId()), new Token(TT.NUMBER, "1", context.generateId())],
        undefined,
        [gchordKV]
      );

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "voice") return;
      expect(result.data.properties.gchord).to.equal(ChordPlacement.Above);
    });
  });

  // ============================================================================
  // Voice with Bracket/Brace
  // ============================================================================

  describe("Voice with Bracket and Brace", () => {
    it("should parse V:1 bracket=start", () => {
      const bracketKV = new KV(
        context.generateId(),
        new Token(TT.IDENTIFIER, "start", context.generateId()),
        new Token(TT.IDENTIFIER, "bracket", context.generateId()),
        new Token(TT.EQL, "=", context.generateId())
      );

      const infoLine = new Info_line(
        context.generateId(),
        [new Token(TT.IDENTIFIER, "V", context.generateId()), new Token(TT.NUMBER, "1", context.generateId())],
        undefined,
        [bracketKV]
      );

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "voice") return;
      expect(result.data.properties.bracket).to.equal(BracketBracePosition.Start);
    });

    it("should parse V:1 brace=end", () => {
      const braceKV = new KV(
        context.generateId(),
        new Token(TT.IDENTIFIER, "end", context.generateId()),
        new Token(TT.IDENTIFIER, "brace", context.generateId()),
        new Token(TT.EQL, "=", context.generateId())
      );

      const infoLine = new Info_line(
        context.generateId(),
        [new Token(TT.IDENTIFIER, "V", context.generateId()), new Token(TT.NUMBER, "1", context.generateId())],
        undefined,
        [braceKV]
      );

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "voice") return;
      expect(result.data.properties.brace).to.equal(BracketBracePosition.End);
    });
  });

  // ============================================================================
  // Voice with Multiple Properties
  // ============================================================================

  describe("Voice with Multiple Properties", () => {
    it('should parse V:T1 name="Tenor" clef=treble transpose=-12', () => {
      const nameKV = new KV(
        context.generateId(),
        new Token(TT.IDENTIFIER, "Tenor", context.generateId()),
        new Token(TT.IDENTIFIER, "name", context.generateId()),
        new Token(TT.EQL, "=", context.generateId())
      );

      const clefKV = new KV(
        context.generateId(),
        new Token(TT.IDENTIFIER, "treble", context.generateId()),
        new Token(TT.IDENTIFIER, "clef", context.generateId()),
        new Token(TT.EQL, "=", context.generateId())
      );

      const transposeKV = new KV(
        context.generateId(),
        new Token(TT.NUMBER, "-12", context.generateId()),
        new Token(TT.IDENTIFIER, "transpose", context.generateId()),
        new Token(TT.EQL, "=", context.generateId())
      );

      const infoLine = new Info_line(
        context.generateId(),
        [new Token(TT.IDENTIFIER, "V", context.generateId()), new Token(TT.IDENTIFIER, "T1", context.generateId())],
        undefined,
        [nameKV, clefKV, transposeKV]
      );

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "voice") return;
      expect(result.data.id).to.equal("T1");
      expect(result.data.properties.name).to.equal("Tenor");
      const clef = result.data.properties.clef;
      expect(clef).to.not.be.undefined;
      if (!clef) return;
      expect(clef.type).to.equal(ClefType.Treble);
      expect(result.data.properties.transpose).to.equal(-12);
    });

    it("should parse V:B clef=bass stafflines=4 stems=down", () => {
      const clefKV = new KV(
        context.generateId(),
        new Token(TT.IDENTIFIER, "bass", context.generateId()),
        new Token(TT.IDENTIFIER, "clef", context.generateId()),
        new Token(TT.EQL, "=", context.generateId())
      );

      const stafflinesKV = new KV(
        context.generateId(),
        new Token(TT.NUMBER, "4", context.generateId()),
        new Token(TT.IDENTIFIER, "stafflines", context.generateId()),
        new Token(TT.EQL, "=", context.generateId())
      );

      const stemsKV = new KV(
        context.generateId(),
        new Token(TT.IDENTIFIER, "down", context.generateId()),
        new Token(TT.IDENTIFIER, "stems", context.generateId()),
        new Token(TT.EQL, "=", context.generateId())
      );

      const infoLine = new Info_line(
        context.generateId(),
        [new Token(TT.IDENTIFIER, "V", context.generateId()), new Token(TT.IDENTIFIER, "B", context.generateId())],
        undefined,
        [clefKV, stafflinesKV, stemsKV]
      );

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "voice") return;
      expect(result.data.id).to.equal("B");
      const clef = result.data.properties.clef;
      expect(clef).to.not.be.undefined;
      if (!clef) return;
      expect(clef.type).to.equal(ClefType.Bass);
      expect(result.data.properties.stafflines).to.equal(4);
      expect(result.data.properties.stems).to.equal(StemDirection.Down);
    });
  });
});
