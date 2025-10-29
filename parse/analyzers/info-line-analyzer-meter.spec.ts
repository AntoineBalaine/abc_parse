import { expect } from "chai";
import { ABCContext } from "../parsers/Context";
import { AbcErrorReporter } from "../parsers/ErrorReporter";
import { Token, TT } from "../parsers/scan2";
import { MeterType } from "../types/abcjs-ast";
import { Info_line, Binary, Grouping, KV } from "../types/Expr2";
import { SemanticAnalyzer } from "./semantic-analyzer";

describe("Meter Info Line Analyzer - Example-Based Tests", () => {
  let analyzer: SemanticAnalyzer;
  let context: ABCContext;

  beforeEach(() => {
    const errorReporter = new AbcErrorReporter();
    context = new ABCContext(errorReporter);
    analyzer = new SemanticAnalyzer(context);
  });

  // ============================================================================
  // Special Meter Symbols
  // ============================================================================

  describe("Special Meter Symbols", () => {
    it("should parse M:C (common time)", () => {
      const cToken = new Token(TT.SPECIAL_LITERAL, "C", context.generateId());
      const cKV = new KV(context.generateId(), cToken);

      const infoLine = new Info_line(context.generateId(), [new Token(TT.IDENTIFIER, "M", context.generateId())], undefined, [cKV]);

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "meter") return;
      expect(result.data.type).to.equal(MeterType.CommonTime);
      expect(result.data.value).to.deep.equal([{ numerator: 4, denominator: 4 }]);
    });

    it("should parse M:C| (cut time)", () => {
      const cutTimeToken = new Token(TT.SPECIAL_LITERAL, "C|", context.generateId());
      const cutTimeKV = new KV(context.generateId(), cutTimeToken);

      const infoLine = new Info_line(context.generateId(), [new Token(TT.IDENTIFIER, "M", context.generateId())], undefined, [cutTimeKV]);

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "meter") return;
      expect(result.data.type).to.equal(MeterType.CutTime);
      expect(result.data.value).to.deep.equal([{ numerator: 2, denominator: 2 }]);
    });
  });

  // ============================================================================
  // Simple Time Signatures
  // ============================================================================

  describe("Simple Time Signatures", () => {
    it("should parse M:4/4 (four-four time)", () => {
      const meterBinary = new Binary(
        context.generateId(),
        new Token(TT.NUMBER, "4", context.generateId()),
        new Token(TT.SLASH, "/", context.generateId()),
        new Token(TT.NUMBER, "4", context.generateId())
      );

      const infoLine = new Info_line(context.generateId(), [new Token(TT.IDENTIFIER, "M", context.generateId())], undefined, [meterBinary]);

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "meter") return;
      expect(result.data.type).to.equal(MeterType.Specified);
      expect(result.data.value).to.deep.equal([{ numerator: 4, denominator: 4 }]);
    });

    it("should parse M:3/4 (three-four time)", () => {
      const meterBinary = new Binary(
        context.generateId(),
        new Token(TT.NUMBER, "3", context.generateId()),
        new Token(TT.SLASH, "/", context.generateId()),
        new Token(TT.NUMBER, "4", context.generateId())
      );

      const infoLine = new Info_line(context.generateId(), [new Token(TT.IDENTIFIER, "M", context.generateId())], undefined, [meterBinary]);

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "meter") return;
      expect(result.data.type).to.equal(MeterType.Specified);
      expect(result.data.value).to.deep.equal([{ numerator: 3, denominator: 4 }]);
    });

    it("should parse M:2/4 (two-four time)", () => {
      const meterBinary = new Binary(
        context.generateId(),
        new Token(TT.NUMBER, "2", context.generateId()),
        new Token(TT.SLASH, "/", context.generateId()),
        new Token(TT.NUMBER, "4", context.generateId())
      );

      const infoLine = new Info_line(context.generateId(), [new Token(TT.IDENTIFIER, "M", context.generateId())], undefined, [meterBinary]);

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "meter") return;
      expect(result.data.type).to.equal(MeterType.Specified);
      expect(result.data.value).to.deep.equal([{ numerator: 2, denominator: 4 }]);
    });

    it("should parse M:6/8 (six-eight time)", () => {
      const meterBinary = new Binary(
        context.generateId(),
        new Token(TT.NUMBER, "6", context.generateId()),
        new Token(TT.SLASH, "/", context.generateId()),
        new Token(TT.NUMBER, "8", context.generateId())
      );

      const infoLine = new Info_line(context.generateId(), [new Token(TT.IDENTIFIER, "M", context.generateId())], undefined, [meterBinary]);

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "meter") return;
      expect(result.data.type).to.equal(MeterType.Specified);
      expect(result.data.value).to.deep.equal([{ numerator: 6, denominator: 8 }]);
    });

    it("should parse M:9/8 (nine-eight time)", () => {
      const meterBinary = new Binary(
        context.generateId(),
        new Token(TT.NUMBER, "9", context.generateId()),
        new Token(TT.SLASH, "/", context.generateId()),
        new Token(TT.NUMBER, "8", context.generateId())
      );

      const infoLine = new Info_line(context.generateId(), [new Token(TT.IDENTIFIER, "M", context.generateId())], undefined, [meterBinary]);

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "meter") return;
      expect(result.data.type).to.equal(MeterType.Specified);
      expect(result.data.value).to.deep.equal([{ numerator: 9, denominator: 8 }]);
    });

    it("should parse M:12/8 (twelve-eight time)", () => {
      const meterBinary = new Binary(
        context.generateId(),
        new Token(TT.NUMBER, "12", context.generateId()),
        new Token(TT.SLASH, "/", context.generateId()),
        new Token(TT.NUMBER, "8", context.generateId())
      );

      const infoLine = new Info_line(context.generateId(), [new Token(TT.IDENTIFIER, "M", context.generateId())], undefined, [meterBinary]);

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "meter") return;
      expect(result.data.type).to.equal(MeterType.Specified);
      expect(result.data.value).to.deep.equal([{ numerator: 12, denominator: 8 }]);
    });
  });

  // ============================================================================
  // Unusual Time Signatures
  // ============================================================================

  describe("Unusual Time Signatures", () => {
    it("should parse M:5/4 (five-four time)", () => {
      const meterBinary = new Binary(
        context.generateId(),
        new Token(TT.NUMBER, "5", context.generateId()),
        new Token(TT.SLASH, "/", context.generateId()),
        new Token(TT.NUMBER, "4", context.generateId())
      );

      const infoLine = new Info_line(context.generateId(), [new Token(TT.IDENTIFIER, "M", context.generateId())], undefined, [meterBinary]);

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "meter") return;
      expect(result.data.type).to.equal(MeterType.Specified);
      expect(result.data.value).to.deep.equal([{ numerator: 5, denominator: 4 }]);
    });

    it("should parse M:7/8 (seven-eight time)", () => {
      const meterBinary = new Binary(
        context.generateId(),
        new Token(TT.NUMBER, "7", context.generateId()),
        new Token(TT.SLASH, "/", context.generateId()),
        new Token(TT.NUMBER, "8", context.generateId())
      );

      const infoLine = new Info_line(context.generateId(), [new Token(TT.IDENTIFIER, "M", context.generateId())], undefined, [meterBinary]);

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "meter") return;
      expect(result.data.type).to.equal(MeterType.Specified);
      expect(result.data.value).to.deep.equal([{ numerator: 7, denominator: 8 }]);
    });

    it("should parse M:11/8 (eleven-eight time)", () => {
      const meterBinary = new Binary(
        context.generateId(),
        new Token(TT.NUMBER, "11", context.generateId()),
        new Token(TT.SLASH, "/", context.generateId()),
        new Token(TT.NUMBER, "8", context.generateId())
      );

      const infoLine = new Info_line(context.generateId(), [new Token(TT.IDENTIFIER, "M", context.generateId())], undefined, [meterBinary]);

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "meter") return;
      expect(result.data.type).to.equal(MeterType.Specified);
      expect(result.data.value).to.deep.equal([{ numerator: 11, denominator: 8 }]);
    });

    it("should parse M:3/8 (three-eight time)", () => {
      const meterBinary = new Binary(
        context.generateId(),
        new Token(TT.NUMBER, "3", context.generateId()),
        new Token(TT.SLASH, "/", context.generateId()),
        new Token(TT.NUMBER, "8", context.generateId())
      );

      const infoLine = new Info_line(context.generateId(), [new Token(TT.IDENTIFIER, "M", context.generateId())], undefined, [meterBinary]);

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "meter") return;
      expect(result.data.type).to.equal(MeterType.Specified);
      expect(result.data.value).to.deep.equal([{ numerator: 3, denominator: 8 }]);
    });

    it("should parse M:2/2 (two-two time)", () => {
      const meterBinary = new Binary(
        context.generateId(),
        new Token(TT.NUMBER, "2", context.generateId()),
        new Token(TT.SLASH, "/", context.generateId()),
        new Token(TT.NUMBER, "2", context.generateId())
      );

      const infoLine = new Info_line(context.generateId(), [new Token(TT.IDENTIFIER, "M", context.generateId())], undefined, [meterBinary]);

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "meter") return;
      expect(result.data.type).to.equal(MeterType.Specified);
      expect(result.data.value).to.deep.equal([{ numerator: 2, denominator: 2 }]);
    });
  });

  // ============================================================================
  // Compound Meters
  // ============================================================================

  describe("Compound Meters", () => {
    it("should parse M:(2+3)/8 (compound meter with grouping)", () => {
      // Create the addition expression: 2+3
      const addition = new Binary(
        context.generateId(),
        new Token(TT.NUMBER, "2", context.generateId()),
        new Token(TT.PLUS, "+", context.generateId()),
        new Token(TT.NUMBER, "3", context.generateId())
      );

      // Create the division expression: (2+3)/8
      const division = new Binary(
        context.generateId(),
        addition,
        new Token(TT.SLASH, "/", context.generateId()),
        new Token(TT.NUMBER, "8", context.generateId())
      );

      // Wrap in a grouping
      const grouping = new Grouping(context.generateId(), division);

      const infoLine = new Info_line(context.generateId(), [new Token(TT.IDENTIFIER, "M", context.generateId())], undefined, [grouping]);

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "meter") return;
      expect(result.data.type).to.equal(MeterType.Specified);
      expect(result.data.value).to.deep.equal([{ numerator: 5, denominator: 8 }]);
    });

    it("should parse M:(3+2+2)/8 (compound meter with multiple additions)", () => {
      // Create the addition chain: 3+2+2
      const firstAdd = new Binary(
        context.generateId(),
        new Token(TT.NUMBER, "3", context.generateId()),
        new Token(TT.PLUS, "+", context.generateId()),
        new Token(TT.NUMBER, "2", context.generateId())
      );

      const secondAdd = new Binary(
        context.generateId(),
        firstAdd,
        new Token(TT.PLUS, "+", context.generateId()),
        new Token(TT.NUMBER, "2", context.generateId())
      );

      // Create the division expression: (3+2+2)/8
      const division = new Binary(
        context.generateId(),
        secondAdd,
        new Token(TT.SLASH, "/", context.generateId()),
        new Token(TT.NUMBER, "8", context.generateId())
      );

      // Wrap in a grouping
      const grouping = new Grouping(context.generateId(), division);

      const infoLine = new Info_line(context.generateId(), [new Token(TT.IDENTIFIER, "M", context.generateId())], undefined, [grouping]);

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "meter") return;
      expect(result.data.type).to.equal(MeterType.Specified);
      expect(result.data.value).to.deep.equal([{ numerator: 7, denominator: 8 }]);
    });

    it("should parse M:(2+2+3)/8 (compound meter with different grouping)", () => {
      // Create the addition chain: 2+2+3
      const firstAdd = new Binary(
        context.generateId(),
        new Token(TT.NUMBER, "2", context.generateId()),
        new Token(TT.PLUS, "+", context.generateId()),
        new Token(TT.NUMBER, "2", context.generateId())
      );

      const secondAdd = new Binary(
        context.generateId(),
        firstAdd,
        new Token(TT.PLUS, "+", context.generateId()),
        new Token(TT.NUMBER, "3", context.generateId())
      );

      // Create the division expression: (2+2+3)/8
      const division = new Binary(
        context.generateId(),
        secondAdd,
        new Token(TT.SLASH, "/", context.generateId()),
        new Token(TT.NUMBER, "8", context.generateId())
      );

      // Wrap in a grouping
      const grouping = new Grouping(context.generateId(), division);

      const infoLine = new Info_line(context.generateId(), [new Token(TT.IDENTIFIER, "M", context.generateId())], undefined, [grouping]);

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "meter") return;
      expect(result.data.type).to.equal(MeterType.Specified);
      expect(result.data.value).to.deep.equal([{ numerator: 7, denominator: 8 }]);
    });

    it("should parse M:(2+2+2+3)/8 (compound meter with four groups)", () => {
      // Create the addition chain: 2+2+2+3
      const firstAdd = new Binary(
        context.generateId(),
        new Token(TT.NUMBER, "2", context.generateId()),
        new Token(TT.PLUS, "+", context.generateId()),
        new Token(TT.NUMBER, "2", context.generateId())
      );

      const secondAdd = new Binary(
        context.generateId(),
        firstAdd,
        new Token(TT.PLUS, "+", context.generateId()),
        new Token(TT.NUMBER, "2", context.generateId())
      );

      const thirdAdd = new Binary(
        context.generateId(),
        secondAdd,
        new Token(TT.PLUS, "+", context.generateId()),
        new Token(TT.NUMBER, "3", context.generateId())
      );

      // Create the division expression: (2+2+2+3)/8
      const division = new Binary(
        context.generateId(),
        thirdAdd,
        new Token(TT.SLASH, "/", context.generateId()),
        new Token(TT.NUMBER, "8", context.generateId())
      );

      // Wrap in a grouping
      const grouping = new Grouping(context.generateId(), division);

      const infoLine = new Info_line(context.generateId(), [new Token(TT.IDENTIFIER, "M", context.generateId())], undefined, [grouping]);

      const result = analyzer.visitInfoLineExpr(infoLine);

      expect(result).to.not.be.null;
      if (!result || result.type !== "meter") return;
      expect(result.data.type).to.equal(MeterType.Specified);
      expect(result.data.value).to.deep.equal([{ numerator: 9, denominator: 8 }]);
    });
  });
});
