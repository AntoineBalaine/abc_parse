import { expect } from "chai";
import { SemanticAnalyzer } from "./semantic-analyzer";
import { ABCContext } from "../parsers/Context";
import { AbcErrorReporter } from "../parsers/ErrorReporter";
import { Token, TT } from "../parsers/scan2";
import { Info_line, KV, Binary, Annotation } from "../types/Expr2";

describe("Tempo Info Line Analyzer - Example-Based Tests", () => {
  let analyzer: SemanticAnalyzer;
  let context: ABCContext;

  beforeEach(() => {
    const errorReporter = new AbcErrorReporter();
    context = new ABCContext(errorReporter);
    analyzer = new SemanticAnalyzer(context);
  });

  // ============================================================================
  // Simple BPM
  // ============================================================================

  describe("Simple BPM", () => {
    it("should parse Q:120 (simple BPM)", () => {
      const infoLine = new Info_line(context.generateId(), [
        new Token(TT.IDENTIFIER, "Q", context.generateId()),
        new Token(TT.NUMBER, "120", context.generateId()),
      ]);

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "tempo") return;
      expect(result.data.bpm).to.equal(120);
      expect(result.data.duration).to.be.undefined;
      expect(result.data.preString).to.be.undefined;
      expect(result.data.postString).to.be.undefined;
    });

    it("should parse Q:60 (slow tempo)", () => {
      const infoLine = new Info_line(context.generateId(), [
        new Token(TT.IDENTIFIER, "Q", context.generateId()),
        new Token(TT.NUMBER, "60", context.generateId()),
      ]);

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "tempo") return;
      expect(result.data.bpm).to.equal(60);
    });

    it("should parse Q:180 (fast tempo)", () => {
      const infoLine = new Info_line(context.generateId(), [
        new Token(TT.IDENTIFIER, "Q", context.generateId()),
        new Token(TT.NUMBER, "180", context.generateId()),
      ]);

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "tempo") return;
      expect(result.data.bpm).to.equal(180);
    });
  });

  // ============================================================================
  // BPM with Duration (Note Value)
  // ============================================================================

  describe("BPM with Duration", () => {
    it("should parse Q:1/4=120 (quarter note = 120 BPM)", () => {
      const durationBinary = new Binary(
        context.generateId(),
        new Token(TT.NUMBER, "1", context.generateId()),
        new Token(TT.SLASH, "/", context.generateId()),
        new Token(TT.NUMBER, "4", context.generateId())
      );

      const tempoKV = new KV(
        context.generateId(),
        new Token(TT.NUMBER, "120", context.generateId()),
        durationBinary as any,
        new Token(TT.EQL, "=", context.generateId())
      );

      const infoLine = new Info_line(context.generateId(), [new Token(TT.IDENTIFIER, "Q", context.generateId())], undefined, [tempoKV]);

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "tempo") return;
      expect(result.data.bpm).to.equal(120);
      expect(result.data.duration).to.deep.equal([1, 4]);
    });

    it("should parse Q:1/8=90 (eighth note = 90 BPM)", () => {
      const durationBinary = new Binary(
        context.generateId(),
        new Token(TT.NUMBER, "1", context.generateId()),
        new Token(TT.SLASH, "/", context.generateId()),
        new Token(TT.NUMBER, "8", context.generateId())
      );

      const tempoKV = new KV(
        context.generateId(),
        new Token(TT.NUMBER, "90", context.generateId()),
        durationBinary as any,
        new Token(TT.EQL, "=", context.generateId())
      );

      const infoLine = new Info_line(context.generateId(), [new Token(TT.IDENTIFIER, "Q", context.generateId())], undefined, [tempoKV]);

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "tempo") return;
      expect(result.data.bpm).to.equal(90);
      expect(result.data.duration).to.deep.equal([1, 8]);
    });

    it("should parse Q:3/8=60 (dotted quarter = 60 BPM)", () => {
      const durationBinary = new Binary(
        context.generateId(),
        new Token(TT.NUMBER, "3", context.generateId()),
        new Token(TT.SLASH, "/", context.generateId()),
        new Token(TT.NUMBER, "8", context.generateId())
      );

      const tempoKV = new KV(
        context.generateId(),
        new Token(TT.NUMBER, "60", context.generateId()),
        durationBinary as any,
        new Token(TT.EQL, "=", context.generateId())
      );

      const infoLine = new Info_line(context.generateId(), [new Token(TT.IDENTIFIER, "Q", context.generateId())], undefined, [tempoKV]);

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "tempo") return;
      expect(result.data.bpm).to.equal(60);
      expect(result.data.duration).to.deep.equal([3, 8]);
    });
  });

  // ============================================================================
  // Tempo with Text (Annotations)
  // ============================================================================

  describe("Tempo with Text", () => {
    it('should parse Q:"Allegro" (text only)', () => {
      const annotation = new Annotation(context.generateId(), new Token(TT.ANNOTATION, "Allegro", context.generateId()));

      const infoLine = new Info_line(context.generateId(), [new Token(TT.IDENTIFIER, "Q", context.generateId())], undefined, [annotation]);

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "tempo") return;
      expect(result.data.preString).to.equal("Allegro");
      expect(result.data.bpm).to.be.undefined;
    });

    it('should parse Q:"Allegro" 1/4=120 (text before BPM)', () => {
      const preAnnotation = new Annotation(context.generateId(), new Token(TT.ANNOTATION, "Allegro", context.generateId()));

      const durationBinary = new Binary(
        context.generateId(),
        new Token(TT.NUMBER, "1", context.generateId()),
        new Token(TT.SLASH, "/", context.generateId()),
        new Token(TT.NUMBER, "4", context.generateId())
      );

      const tempoKV = new KV(
        context.generateId(),
        new Token(TT.NUMBER, "120", context.generateId()),
        durationBinary as any,
        new Token(TT.EQL, "=", context.generateId())
      );

      const infoLine = new Info_line(context.generateId(), [new Token(TT.IDENTIFIER, "Q", context.generateId())], undefined, [preAnnotation, tempoKV]);

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "tempo") return;
      expect(result.data.preString).to.equal("Allegro");
      expect(result.data.bpm).to.equal(120);
      expect(result.data.duration).to.deep.equal([1, 4]);
    });

    it('should parse Q:1/4=120 "Allegro" (text after BPM)', () => {
      const durationBinary = new Binary(
        context.generateId(),
        new Token(TT.NUMBER, "1", context.generateId()),
        new Token(TT.SLASH, "/", context.generateId()),
        new Token(TT.NUMBER, "4", context.generateId())
      );

      const tempoKV = new KV(
        context.generateId(),
        new Token(TT.NUMBER, "120", context.generateId()),
        durationBinary as any,
        new Token(TT.EQL, "=", context.generateId())
      );

      const postAnnotation = new Annotation(context.generateId(), new Token(TT.ANNOTATION, "Allegro", context.generateId()));

      const infoLine = new Info_line(context.generateId(), [new Token(TT.IDENTIFIER, "Q", context.generateId())], undefined, [tempoKV, postAnnotation]);

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "tempo") return;
      expect(result.data.bpm).to.equal(120);
      expect(result.data.duration).to.deep.equal([1, 4]);
      expect(result.data.postString).to.equal("Allegro");
    });

    it('should parse Q:"Presto" 1/8=160 "lively" (text before and after)', () => {
      const preAnnotation = new Annotation(context.generateId(), new Token(TT.ANNOTATION, "Presto", context.generateId()));

      const durationBinary = new Binary(
        context.generateId(),
        new Token(TT.NUMBER, "1", context.generateId()),
        new Token(TT.SLASH, "/", context.generateId()),
        new Token(TT.NUMBER, "8", context.generateId())
      );

      const tempoKV = new KV(
        context.generateId(),
        new Token(TT.NUMBER, "160", context.generateId()),
        durationBinary as any,
        new Token(TT.EQL, "=", context.generateId())
      );

      const postAnnotation = new Annotation(context.generateId(), new Token(TT.ANNOTATION, "lively", context.generateId()));

      const infoLine = new Info_line(context.generateId(), [new Token(TT.IDENTIFIER, "Q", context.generateId())], undefined, [
        preAnnotation,
        tempoKV,
        postAnnotation,
      ]);

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "tempo") return;
      expect(result.data.preString).to.equal("Presto");
      expect(result.data.bpm).to.equal(160);
      expect(result.data.duration).to.deep.equal([1, 8]);
      expect(result.data.postString).to.equal("lively");
    });
  });

  // ============================================================================
  // Common Tempo Markings
  // ============================================================================

  describe("Common Tempo Markings", () => {
    it('should parse Q:"Largo" (very slow)', () => {
      const annotation = new Annotation(context.generateId(), new Token(TT.ANNOTATION, "Largo", context.generateId()));

      const infoLine = new Info_line(context.generateId(), [new Token(TT.IDENTIFIER, "Q", context.generateId())], undefined, [annotation]);

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "tempo") return;
      expect(result.data.preString).to.equal("Largo");
    });

    it('should parse Q:"Moderato" 1/4=108', () => {
      const preAnnotation = new Annotation(context.generateId(), new Token(TT.ANNOTATION, "Moderato", context.generateId()));

      const durationBinary = new Binary(
        context.generateId(),
        new Token(TT.NUMBER, "1", context.generateId()),
        new Token(TT.SLASH, "/", context.generateId()),
        new Token(TT.NUMBER, "4", context.generateId())
      );

      const tempoKV = new KV(
        context.generateId(),
        new Token(TT.NUMBER, "108", context.generateId()),
        durationBinary as any,
        new Token(TT.EQL, "=", context.generateId())
      );

      const infoLine = new Info_line(context.generateId(), [new Token(TT.IDENTIFIER, "Q", context.generateId())], undefined, [preAnnotation, tempoKV]);

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "tempo") return;
      expect(result.data.preString).to.equal("Moderato");
      expect(result.data.bpm).to.equal(108);
      expect(result.data.duration).to.deep.equal([1, 4]);
    });

    it('should parse Q:"Vivace" 1/4=140', () => {
      const preAnnotation = new Annotation(context.generateId(), new Token(TT.ANNOTATION, "Vivace", context.generateId()));

      const durationBinary = new Binary(
        context.generateId(),
        new Token(TT.NUMBER, "1", context.generateId()),
        new Token(TT.SLASH, "/", context.generateId()),
        new Token(TT.NUMBER, "4", context.generateId())
      );

      const tempoKV = new KV(
        context.generateId(),
        new Token(TT.NUMBER, "140", context.generateId()),
        durationBinary as any,
        new Token(TT.EQL, "=", context.generateId())
      );

      const infoLine = new Info_line(context.generateId(), [new Token(TT.IDENTIFIER, "Q", context.generateId())], undefined, [preAnnotation, tempoKV]);

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "tempo") return;
      expect(result.data.preString).to.equal("Vivace");
      expect(result.data.bpm).to.equal(140);
      expect(result.data.duration).to.deep.equal([1, 4]);
    });
  });
});
