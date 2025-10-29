import { expect } from "chai";
import { ABCContext } from "../parsers/Context";
import { AbcErrorReporter } from "../parsers/ErrorReporter";
import { Token, TT } from "../parsers/scan2";
import { KeyRoot, KeyAccidental, Mode, ClefType, NoteHeadStyle } from "../types/abcjs-ast";
import { Info_line, KV } from "../types/Expr2";
import { SemanticAnalyzer } from "./semantic-analyzer";

describe("Key Info Line Analyzer - Example-Based Tests", () => {
  let analyzer: SemanticAnalyzer;
  let context: ABCContext;

  beforeEach(() => {
    const errorReporter = new AbcErrorReporter();
    context = new ABCContext(errorReporter);
    analyzer = new SemanticAnalyzer(context);
  });

  // ============================================================================
  // Simple Key Signatures
  // ============================================================================

  describe("Simple Key Signatures", () => {
    it("should parse K:C (C Major)", () => {
      const infoLine = new Info_line(context.generateId(), [
        new Token(TT.IDENTIFIER, "K", context.generateId()),
        new Token(TT.IDENTIFIER, "C", context.generateId()),
      ]);

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "key") return;
      expect(result.data.keySignature.root).to.equal(KeyRoot.C);
      expect(result.data.keySignature.acc).to.equal(KeyAccidental.None);
      expect(result.data.keySignature.mode).to.equal(Mode.Major);
    });

    it("should parse K:G (G Major)", () => {
      const infoLine = new Info_line(context.generateId(), [
        new Token(TT.IDENTIFIER, "K", context.generateId()),
        new Token(TT.IDENTIFIER, "G", context.generateId()),
      ]);

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "key") return;
      expect(result.data.keySignature.root).to.equal(KeyRoot.G);
      expect(result.data.keySignature.acc).to.equal(KeyAccidental.None);
      expect(result.data.keySignature.mode).to.equal(Mode.Major);
    });

    it("should parse K:D (D Major)", () => {
      const infoLine = new Info_line(context.generateId(), [
        new Token(TT.IDENTIFIER, "K", context.generateId()),
        new Token(TT.IDENTIFIER, "D", context.generateId()),
      ]);

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "key") return;
      expect(result.data.keySignature.root).to.equal(KeyRoot.D);
      expect(result.data.keySignature.acc).to.equal(KeyAccidental.None);
      expect(result.data.keySignature.mode).to.equal(Mode.Major);
    });
  });

  // ============================================================================
  // Key Signatures with Accidentals (ABC pitch notation: ^ for sharp, _ for flat)
  // ============================================================================

  describe("Key Signatures with Accidentals", () => {
    it("should parse K:^f major (F# Major)", () => {
      const infoLine = new Info_line(context.generateId(), [
        new Token(TT.IDENTIFIER, "K", context.generateId()),
        new Token(TT.IDENTIFIER, "^f", context.generateId()),
        new Token(TT.IDENTIFIER, "major", context.generateId()),
      ]);

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "key") return;
      expect(result.data.keySignature.root).to.equal(KeyRoot.F);
      expect(result.data.keySignature.acc).to.equal(KeyAccidental.Sharp);
      expect(result.data.keySignature.mode).to.equal(Mode.Major);
    });

    it("should parse K:_b major (Bb Major)", () => {
      const infoLine = new Info_line(context.generateId(), [
        new Token(TT.IDENTIFIER, "K", context.generateId()),
        new Token(TT.IDENTIFIER, "_b", context.generateId()),
        new Token(TT.IDENTIFIER, "major", context.generateId()),
      ]);

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "key") return;
      expect(result.data.keySignature.root).to.equal(KeyRoot.B);
      expect(result.data.keySignature.acc).to.equal(KeyAccidental.Flat);
      expect(result.data.keySignature.mode).to.equal(Mode.Major);
    });

    it("should parse K:^c major (C# Major)", () => {
      const infoLine = new Info_line(context.generateId(), [
        new Token(TT.IDENTIFIER, "K", context.generateId()),
        new Token(TT.IDENTIFIER, "^c", context.generateId()),
        new Token(TT.IDENTIFIER, "major", context.generateId()),
      ]);

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "key") return;
      expect(result.data.keySignature.root).to.equal(KeyRoot.C);
      expect(result.data.keySignature.acc).to.equal(KeyAccidental.Sharp);
      expect(result.data.keySignature.mode).to.equal(Mode.Major);
    });
  });

  // ============================================================================
  // Key Signatures with Modes
  // ============================================================================

  describe("Key Signatures with Modes", () => {
    it("should parse K:A minor (A Minor)", () => {
      const infoLine = new Info_line(context.generateId(), [
        new Token(TT.IDENTIFIER, "K", context.generateId()),
        new Token(TT.IDENTIFIER, "A", context.generateId()),
        new Token(TT.IDENTIFIER, "minor", context.generateId()),
      ]);

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "key") return;
      expect(result.data.keySignature.root).to.equal(KeyRoot.A);
      expect(result.data.keySignature.acc).to.equal(KeyAccidental.None);
      expect(result.data.keySignature.mode).to.equal(Mode.Minor);
    });

    it("should parse K:G Mixolydian", () => {
      const infoLine = new Info_line(context.generateId(), [
        new Token(TT.IDENTIFIER, "K", context.generateId()),
        new Token(TT.IDENTIFIER, "G", context.generateId()),
        new Token(TT.IDENTIFIER, "Mixolydian", context.generateId()),
      ]);

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "key") return;
      expect(result.data.keySignature.root).to.equal(KeyRoot.G);
      expect(result.data.keySignature.acc).to.equal(KeyAccidental.None);
      expect(result.data.keySignature.mode).to.equal(Mode.Mixolydian);
    });

    it("should parse K:D Dorian", () => {
      const infoLine = new Info_line(context.generateId(), [
        new Token(TT.IDENTIFIER, "K", context.generateId()),
        new Token(TT.IDENTIFIER, "D", context.generateId()),
        new Token(TT.IDENTIFIER, "Dorian", context.generateId()),
      ]);

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "key") return;
      expect(result.data.keySignature.root).to.equal(KeyRoot.D);
      expect(result.data.keySignature.acc).to.equal(KeyAccidental.None);
      expect(result.data.keySignature.mode).to.equal(Mode.Dorian);
    });
  });

  // ============================================================================
  // Key with Clef
  // ============================================================================

  describe("Key with Clef", () => {
    it("should parse K:D clef=bass", () => {
      const clefKV = new KV(
        context.generateId(),
        new Token(TT.IDENTIFIER, "bass", context.generateId()),
        new Token(TT.IDENTIFIER, "clef", context.generateId()),
        new Token(TT.EQL, "=", context.generateId())
      );

      const infoLine = new Info_line(
        context.generateId(),
        [new Token(TT.IDENTIFIER, "K", context.generateId()), new Token(TT.IDENTIFIER, "D", context.generateId())],
        undefined,
        [clefKV]
      );

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "key") return;
      expect(result.data.keySignature.root).to.equal(KeyRoot.D);
      const clef = result.data.clef;
      expect(clef).to.not.be.undefined;
      if (!clef) return;
      expect(clef.type).to.equal(ClefType.Bass);
    });

    it("should parse K:G clef=treble-8 (complex clef with octave shift)", () => {
      const clefKV = new KV(
        context.generateId(),
        new Token(TT.IDENTIFIER, "treble-8", context.generateId()),
        new Token(TT.IDENTIFIER, "clef", context.generateId()),
        new Token(TT.EQL, "=", context.generateId())
      );

      const infoLine = new Info_line(
        context.generateId(),
        [new Token(TT.IDENTIFIER, "K", context.generateId()), new Token(TT.IDENTIFIER, "G", context.generateId())],
        undefined,
        [clefKV]
      );

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "key") return;
      expect(result.data.keySignature.root).to.equal(KeyRoot.G);
      const clef = result.data.clef;
      expect(clef).to.not.be.undefined;
      if (!clef) return;
      expect(clef.type).to.equal(ClefType.TrebleMinus8);
    });
  });

  // ============================================================================
  // Key with Transpose
  // ============================================================================

  describe("Key with Transpose", () => {
    it("should parse K:C transpose=-12", () => {
      const transposeKV = new KV(
        context.generateId(),
        new Token(TT.NUMBER, "-12", context.generateId()),
        new Token(TT.IDENTIFIER, "transpose", context.generateId()),
        new Token(TT.EQL, "=", context.generateId())
      );

      const infoLine = new Info_line(
        context.generateId(),
        [new Token(TT.IDENTIFIER, "K", context.generateId()), new Token(TT.IDENTIFIER, "C", context.generateId())],
        undefined,
        [transposeKV]
      );

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "key") return;
      const clef = result.data.clef;
      expect(clef).to.not.be.undefined;
      if (!clef) return;
      expect(clef.transpose).to.equal(-12);
    });
  });

  // ============================================================================
  // Key with Staff Properties
  // ============================================================================

  describe("Key with Staff Properties", () => {
    it("should parse K:D stafflines=4", () => {
      const stafflinesKV = new KV(
        context.generateId(),
        new Token(TT.NUMBER, "4", context.generateId()),
        new Token(TT.IDENTIFIER, "stafflines", context.generateId()),
        new Token(TT.EQL, "=", context.generateId())
      );

      const infoLine = new Info_line(
        context.generateId(),
        [new Token(TT.IDENTIFIER, "K", context.generateId()), new Token(TT.IDENTIFIER, "D", context.generateId())],
        undefined,
        [stafflinesKV]
      );

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "key") return;
      const clef = result.data.clef;
      expect(clef).to.not.be.undefined;
      if (!clef) return;
      expect(clef.stafflines).to.equal(4);
    });

    it("should parse K:G staffscale=0.8", () => {
      const staffscaleKV = new KV(
        context.generateId(),
        new Token(TT.NUMBER, "0.8", context.generateId()),
        new Token(TT.IDENTIFIER, "staffscale", context.generateId()),
        new Token(TT.EQL, "=", context.generateId())
      );

      const infoLine = new Info_line(
        context.generateId(),
        [new Token(TT.IDENTIFIER, "K", context.generateId()), new Token(TT.IDENTIFIER, "G", context.generateId())],
        undefined,
        [staffscaleKV]
      );

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "key") return;
      const clef = result.data.clef;
      expect(clef).to.not.be.undefined;
      if (!clef) return;
      expect(clef.staffscale).to.equal(0.8);
    });
  });

  // ============================================================================
  // Key with Style
  // ============================================================================

  describe("Key with Style", () => {
    it("should parse K:C style=harmonic", () => {
      const styleKV = new KV(
        context.generateId(),
        new Token(TT.IDENTIFIER, "harmonic", context.generateId()),
        new Token(TT.IDENTIFIER, "style", context.generateId()),
        new Token(TT.EQL, "=", context.generateId())
      );

      const infoLine = new Info_line(
        context.generateId(),
        [new Token(TT.IDENTIFIER, "K", context.generateId()), new Token(TT.IDENTIFIER, "C", context.generateId())],
        undefined,
        [styleKV]
      );

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "key") return;
      const clef = result.data.clef;
      expect(clef).to.not.be.undefined;
      if (!clef) return;
      expect(clef.style).to.equal(NoteHeadStyle.Harmonic);
    });
  });

  // ============================================================================
  // Key with Multiple Properties
  // ============================================================================

  describe("Key with Multiple Properties", () => {
    it("should parse K:^f minor clef=treble transpose=-12", () => {
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
        [
          new Token(TT.IDENTIFIER, "K", context.generateId()),
          new Token(TT.IDENTIFIER, "^f", context.generateId()),
          new Token(TT.IDENTIFIER, "minor", context.generateId()),
        ],
        undefined,
        [clefKV, transposeKV]
      );

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "key") return;
      expect(result.data.keySignature.root).to.equal(KeyRoot.F);
      expect(result.data.keySignature.acc).to.equal(KeyAccidental.Sharp);
      expect(result.data.keySignature.mode).to.equal(Mode.Minor);
      const clef = result.data.clef;
      expect(clef).to.not.be.undefined;
      if (!clef) return;
      expect(clef.type).to.equal(ClefType.Treble);
      expect(clef.transpose).to.equal(-12);
    });

    it("should parse K:_b Major clef=bass stafflines=4 staffscale=0.3 style=harmonic", () => {
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

      const staffscaleKV = new KV(
        context.generateId(),
        new Token(TT.NUMBER, "0.3", context.generateId()),
        new Token(TT.IDENTIFIER, "staffscale", context.generateId()),
        new Token(TT.EQL, "=", context.generateId())
      );

      const styleKV = new KV(
        context.generateId(),
        new Token(TT.IDENTIFIER, "harmonic", context.generateId()),
        new Token(TT.IDENTIFIER, "style", context.generateId()),
        new Token(TT.EQL, "=", context.generateId())
      );

      const infoLine = new Info_line(
        context.generateId(),
        [
          new Token(TT.IDENTIFIER, "K", context.generateId()),
          new Token(TT.IDENTIFIER, "_b", context.generateId()),
          new Token(TT.IDENTIFIER, "Major", context.generateId()),
        ],
        undefined,
        [clefKV, stafflinesKV, staffscaleKV, styleKV]
      );

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "key") return;
      expect(result.data.keySignature.root).to.equal(KeyRoot.B);
      expect(result.data.keySignature.acc).to.equal(KeyAccidental.Flat);
      expect(result.data.keySignature.mode).to.equal(Mode.Major);
      const clef = result.data.clef;
      expect(clef).to.not.be.undefined;
      if (!clef) return;
      expect(clef.type).to.equal(ClefType.Bass);
      expect(clef.stafflines).to.equal(4);
      expect(clef.staffscale).to.equal(0.3);
      expect(clef.style).to.equal(NoteHeadStyle.Harmonic);
    });
  });

  // ============================================================================
  // Special Case: K:none
  // ============================================================================

  describe("Special Cases", () => {
    it("should parse K:none (no key signature)", () => {
      const infoLine = new Info_line(context.generateId(), [
        new Token(TT.IDENTIFIER, "K", context.generateId()),
        new Token(TT.IDENTIFIER, "none", context.generateId()),
      ]);

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "key") return;
      // K:none uses default values
      expect(result.data.keySignature.root).to.equal(KeyRoot.C);
      expect(result.data.keySignature.mode).to.equal(Mode.Major);
    });
  });
});
