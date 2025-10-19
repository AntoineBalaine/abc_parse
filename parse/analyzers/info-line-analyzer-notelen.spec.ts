import { expect } from "chai";
import { SemanticAnalyzer } from "./semantic-analyzer";
import { ABCContext } from "../parsers/Context";
import { AbcErrorReporter } from "../parsers/ErrorReporter";
import { Token, TT } from "../parsers/scan2";
import { Info_line, Binary } from "../types/Expr2";

describe("Note Length Info Line Analyzer - Example-Based Tests", () => {
  let analyzer: SemanticAnalyzer;
  let context: ABCContext;

  beforeEach(() => {
    const errorReporter = new AbcErrorReporter();
    context = new ABCContext(errorReporter);
    analyzer = new SemanticAnalyzer(context);
  });

  // ============================================================================
  // Common Note Lengths
  // ============================================================================

  describe("Common Note Lengths", () => {
    it("should parse L:1/4 (quarter note default)", () => {
      const noteLenBinary = new Binary(
        context.generateId(),
        new Token(TT.NUMBER, "1", context.generateId()),
        new Token(TT.SLASH, "/", context.generateId()),
        new Token(TT.NUMBER, "4", context.generateId())
      );

      const infoLine = new Info_line(context.generateId(), [new Token(TT.IDENTIFIER, "L", context.generateId())], undefined, [noteLenBinary]);

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "note_length") return;
      expect(result.data.numerator).to.equal(1);
      expect(result.data.denominator).to.equal(4);
    });

    it("should parse L:1/8 (eighth note default)", () => {
      const noteLenBinary = new Binary(
        context.generateId(),
        new Token(TT.NUMBER, "1", context.generateId()),
        new Token(TT.SLASH, "/", context.generateId()),
        new Token(TT.NUMBER, "8", context.generateId())
      );

      const infoLine = new Info_line(context.generateId(), [new Token(TT.IDENTIFIER, "L", context.generateId())], undefined, [noteLenBinary]);

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "note_length") return;
      expect(result.data.numerator).to.equal(1);
      expect(result.data.denominator).to.equal(8);
    });

    it("should parse L:1/16 (sixteenth note default)", () => {
      const noteLenBinary = new Binary(
        context.generateId(),
        new Token(TT.NUMBER, "1", context.generateId()),
        new Token(TT.SLASH, "/", context.generateId()),
        new Token(TT.NUMBER, "16", context.generateId())
      );

      const infoLine = new Info_line(context.generateId(), [new Token(TT.IDENTIFIER, "L", context.generateId())], undefined, [noteLenBinary]);

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "note_length") return;
      expect(result.data.numerator).to.equal(1);
      expect(result.data.denominator).to.equal(16);
    });

    it("should parse L:1/2 (half note default)", () => {
      const noteLenBinary = new Binary(
        context.generateId(),
        new Token(TT.NUMBER, "1", context.generateId()),
        new Token(TT.SLASH, "/", context.generateId()),
        new Token(TT.NUMBER, "2", context.generateId())
      );

      const infoLine = new Info_line(context.generateId(), [new Token(TT.IDENTIFIER, "L", context.generateId())], undefined, [noteLenBinary]);

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "note_length") return;
      expect(result.data.numerator).to.equal(1);
      expect(result.data.denominator).to.equal(2);
    });

    it("should parse L:1/1 (whole note default)", () => {
      const noteLenBinary = new Binary(
        context.generateId(),
        new Token(TT.NUMBER, "1", context.generateId()),
        new Token(TT.SLASH, "/", context.generateId()),
        new Token(TT.NUMBER, "1", context.generateId())
      );

      const infoLine = new Info_line(context.generateId(), [new Token(TT.IDENTIFIER, "L", context.generateId())], undefined, [noteLenBinary]);

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "note_length") return;
      expect(result.data.numerator).to.equal(1);
      expect(result.data.denominator).to.equal(1);
    });
  });

  // ============================================================================
  // Less Common Note Lengths
  // ============================================================================

  describe("Less Common Note Lengths", () => {
    it("should parse L:1/32 (thirty-second note default)", () => {
      const noteLenBinary = new Binary(
        context.generateId(),
        new Token(TT.NUMBER, "1", context.generateId()),
        new Token(TT.SLASH, "/", context.generateId()),
        new Token(TT.NUMBER, "32", context.generateId())
      );

      const infoLine = new Info_line(context.generateId(), [new Token(TT.IDENTIFIER, "L", context.generateId())], undefined, [noteLenBinary]);

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "note_length") return;
      expect(result.data.numerator).to.equal(1);
      expect(result.data.denominator).to.equal(32);
    });

    it("should parse L:1/64 (sixty-fourth note default)", () => {
      const noteLenBinary = new Binary(
        context.generateId(),
        new Token(TT.NUMBER, "1", context.generateId()),
        new Token(TT.SLASH, "/", context.generateId()),
        new Token(TT.NUMBER, "64", context.generateId())
      );

      const infoLine = new Info_line(context.generateId(), [new Token(TT.IDENTIFIER, "L", context.generateId())], undefined, [noteLenBinary]);

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "note_length") return;
      expect(result.data.numerator).to.equal(1);
      expect(result.data.denominator).to.equal(64);
    });
  });

  // ============================================================================
  // Uncommon Numerators (for compound note lengths)
  // ============================================================================

  describe("Uncommon Numerators", () => {
    it("should parse L:3/8 (dotted quarter note)", () => {
      const noteLenBinary = new Binary(
        context.generateId(),
        new Token(TT.NUMBER, "3", context.generateId()),
        new Token(TT.SLASH, "/", context.generateId()),
        new Token(TT.NUMBER, "8", context.generateId())
      );

      const infoLine = new Info_line(context.generateId(), [new Token(TT.IDENTIFIER, "L", context.generateId())], undefined, [noteLenBinary]);

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "note_length") return;
      expect(result.data.numerator).to.equal(3);
      expect(result.data.denominator).to.equal(8);
    });

    it("should parse L:3/16 (dotted eighth note)", () => {
      const noteLenBinary = new Binary(
        context.generateId(),
        new Token(TT.NUMBER, "3", context.generateId()),
        new Token(TT.SLASH, "/", context.generateId()),
        new Token(TT.NUMBER, "16", context.generateId())
      );

      const infoLine = new Info_line(context.generateId(), [new Token(TT.IDENTIFIER, "L", context.generateId())], undefined, [noteLenBinary]);

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "note_length") return;
      expect(result.data.numerator).to.equal(3);
      expect(result.data.denominator).to.equal(16);
    });

    it("should parse L:3/4 (dotted half note)", () => {
      const noteLenBinary = new Binary(
        context.generateId(),
        new Token(TT.NUMBER, "3", context.generateId()),
        new Token(TT.SLASH, "/", context.generateId()),
        new Token(TT.NUMBER, "4", context.generateId())
      );

      const infoLine = new Info_line(context.generateId(), [new Token(TT.IDENTIFIER, "L", context.generateId())], undefined, [noteLenBinary]);

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "note_length") return;
      expect(result.data.numerator).to.equal(3);
      expect(result.data.denominator).to.equal(4);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe("Edge Cases", () => {
    it("should parse L:2/4 (two quarter notes worth)", () => {
      const noteLenBinary = new Binary(
        context.generateId(),
        new Token(TT.NUMBER, "2", context.generateId()),
        new Token(TT.SLASH, "/", context.generateId()),
        new Token(TT.NUMBER, "4", context.generateId())
      );

      const infoLine = new Info_line(context.generateId(), [new Token(TT.IDENTIFIER, "L", context.generateId())], undefined, [noteLenBinary]);

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "note_length") return;
      expect(result.data.numerator).to.equal(2);
      expect(result.data.denominator).to.equal(4);
    });

    it("should parse L:5/8 (five eighth notes worth)", () => {
      const noteLenBinary = new Binary(
        context.generateId(),
        new Token(TT.NUMBER, "5", context.generateId()),
        new Token(TT.SLASH, "/", context.generateId()),
        new Token(TT.NUMBER, "8", context.generateId())
      );

      const infoLine = new Info_line(context.generateId(), [new Token(TT.IDENTIFIER, "L", context.generateId())], undefined, [noteLenBinary]);

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "note_length") return;
      expect(result.data.numerator).to.equal(5);
      expect(result.data.denominator).to.equal(8);
    });
  });
});
