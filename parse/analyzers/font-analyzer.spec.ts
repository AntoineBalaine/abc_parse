import { expect } from "chai";
import { ABCContext } from "../parsers/Context";
import { AbcErrorReporter } from "../parsers/ErrorReporter";
import { Token, TT } from "../parsers/scan2";
import { FontSpec } from "../types/directive-specs";
import { Directive } from "../types/Expr2";
import { SemanticAnalyzer } from "./semantic-analyzer";

describe("Font Directive Analysis", () => {
  let analyzer: SemanticAnalyzer;
  let context: ABCContext;

  beforeEach(() => {
    const errorReporter = new AbcErrorReporter();
    context = new ABCContext(errorReporter);
    analyzer = new SemanticAnalyzer(context);
  });

  it("should analyze a simple titlefont directive", () => {
    // Create a titlefont directive: %%titlefont Times 16 bold
    const directive = new Directive(
      1, // id
      new Token(TT.IDENTIFIER, "titlefont", 6), // key
      [new Token(TT.IDENTIFIER, "Times", 2), new Token(TT.NUMBER, "16", 3), new Token(TT.IDENTIFIER, "bold", 4)] // values
    );

    const result = analyzer.visitDirectiveExpr(directive);

    expect(result).not.to.be.null;
    expect(result?.type).to.equal("titlefont");

    const fontData = result?.data as FontSpec;
    expect(fontData.face).to.equal("Times");
    expect(fontData.size).to.equal(16);
    expect(fontData.weight).to.equal("bold");
    expect(fontData.style).to.equal("normal");
    expect(fontData.decoration).to.equal("none");
  });

  it("should analyze a font directive with quoted face name", () => {
    // Create a gchordfont directive: %%gchordfont "Times New Roman" 12 italic
    const directive = new Directive(
      2, // id
      new Token(TT.IDENTIFIER, "gchordfont", 6), // key
      [new Token(TT.IDENTIFIER, '"Times New Roman"', 7), new Token(TT.NUMBER, "12", 8), new Token(TT.IDENTIFIER, "italic", 9)] // values
    );

    const result = analyzer.visitDirectiveExpr(directive);

    expect(result).not.to.be.null;
    expect(result?.type).to.equal("gchordfont");

    const fontData = result?.data as FontSpec;
    expect(fontData.face).to.equal("Times New Roman"); // Quotes should be removed
    expect(fontData.size).to.equal(12);
    expect(fontData.weight).to.equal("normal");
    expect(fontData.style).to.equal("italic");
  });

  it("should analyze a font directive with box parameter", () => {
    // Create a textfont directive: %%textfont Arial 14 box
    const directive = new Directive(
      3, // id
      new Token(TT.IDENTIFIER, "textfont", 11), // key
      [new Token(TT.IDENTIFIER, "Arial", 12), new Token(TT.NUMBER, "14", 13), new Token(TT.IDENTIFIER, "box", 14)] // values
    );

    const result = analyzer.visitDirectiveExpr(directive);

    expect(result).not.to.be.null;
    expect(result?.type).to.equal("textfont");

    const fontData = result?.data as FontSpec;
    expect(fontData.face).to.equal("Arial");
    expect(fontData.size).to.equal(14);
    expect(fontData.box).to.equal(true);
  });

  it("should handle font directive with asterisk (keep current)", () => {
    // Create a composerfont directive: %%composerfont * 18
    // Note: asterisk format only supports: * <size> [box]
    // Modifiers like "underline" are not valid after asterisk
    const directive = new Directive(
      4, // id
      new Token(TT.IDENTIFIER, "composerfont", 16), // key
      [new Token(TT.IDENTIFIER, "*", 17), new Token(TT.NUMBER, "18", 18)] // values
    );

    const result = analyzer.visitDirectiveExpr(directive);

    expect(result).not.to.be.null;
    expect(result?.type).to.equal("composerfont");

    const fontData = result?.data as FontSpec;
    expect(fontData.face).to.be.undefined; // Asterisk means keep current
    expect(fontData.size).to.equal(18);
  });

  it("should ignore utf8 keyword", () => {
    // Create a subtitlefont directive: %%subtitlefont Helvetica utf8 20
    const directive = new Directive(
      5, // id
      new Token(TT.IDENTIFIER, "subtitlefont", 21), // key
      [new Token(TT.IDENTIFIER, "Helvetica", 22), new Token(TT.IDENTIFIER, "utf8", 23), new Token(TT.NUMBER, "20", 24)] // values
    );

    const result = analyzer.visitDirectiveExpr(directive);

    expect(result).not.to.be.null;
    expect(result?.type).to.equal("subtitlefont");

    const fontData = result?.data as FontSpec;
    expect(fontData.face).to.equal("Helvetica");
    expect(fontData.size).to.equal(20);
  });

  it("should store semantic data in the analyzer", () => {
    const directive = new Directive(
      6, // id
      new Token(TT.IDENTIFIER, "titlefont", 26), // key
      [new Token(TT.IDENTIFIER, "Arial", 27), new Token(TT.NUMBER, "16", 28)] // values
    );

    analyzer.visitDirectiveExpr(directive);

    const semanticData = analyzer.data;
    expect(semanticData.size).to.equal(1);
    expect(semanticData.has(6)).to.equal(true);

    const storedData = analyzer.data.get(6);
    expect(storedData?.type).to.equal("titlefont");
  });

  it("should handle multiple font directives", () => {
    const directive1 = new Directive(
      7, // id
      new Token(TT.IDENTIFIER, "titlefont", 30), // key
      [new Token(TT.IDENTIFIER, "Arial", 31)] // values
    );

    const directive2 = new Directive(
      8, // id
      new Token(TT.IDENTIFIER, "gchordfont", 33), // key
      [new Token(TT.NUMBER, "12", 34)] // values
    );

    analyzer.visitDirectiveExpr(directive1);
    analyzer.visitDirectiveExpr(directive2);

    const semanticData = analyzer.data;
    expect(semanticData.size).to.equal(2);
  });

  describe("setfont directive", () => {
    it("should analyze setfont-1 directive with full font spec", () => {
      // Create a setfont-1 directive: %%setfont-1 Times 18 bold
      const directive = new Directive(
        10, // id
        new Token(TT.IDENTIFIER, "setfont-1", 40), // key
        [new Token(TT.IDENTIFIER, "Times", 41), new Token(TT.NUMBER, "18", 42), new Token(TT.IDENTIFIER, "bold", 43)] // values
      );

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).not.to.be.null;
      expect(result?.type).to.equal("setfont");

      const setfontData = result?.data as { number: number; font: FontSpec };
      expect(setfontData.number).to.equal(1);
      expect(setfontData.font.face).to.equal("Times");
      expect(setfontData.font.size).to.equal(18);
      expect(setfontData.font.weight).to.equal("bold");
    });

    it("should analyze setfont-9 directive (boundary case)", () => {
      // Create a setfont-9 directive: %%setfont-9 Arial 12
      const directive = new Directive(
        11, // id
        new Token(TT.IDENTIFIER, "setfont-9", 45), // key
        [new Token(TT.IDENTIFIER, "Arial", 46), new Token(TT.NUMBER, "12", 47)] // values
      );

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).not.to.be.null;
      expect(result?.type).to.equal("setfont");

      const setfontData = result?.data as { number: number; font: FontSpec };
      expect(setfontData.number).to.equal(9);
      expect(setfontData.font.face).to.equal("Arial");
      expect(setfontData.font.size).to.equal(12);
    });

    it("should analyze setfont directive with italic modifier", () => {
      // Create a setfont-3 directive: %%setfont-3 Helvetica 14 italic
      const directive = new Directive(
        12, // id
        new Token(TT.IDENTIFIER, "setfont-3", 49), // key
        [new Token(TT.IDENTIFIER, "Helvetica", 50), new Token(TT.NUMBER, "14", 51), new Token(TT.IDENTIFIER, "italic", 52)] // values
      );

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).not.to.be.null;
      expect(result?.type).to.equal("setfont");

      const setfontData = result?.data as { number: number; font: FontSpec };
      expect(setfontData.number).to.equal(3);
      expect(setfontData.font.style).to.equal("italic");
    });

    it("should analyze setfont directive with underline modifier", () => {
      // Create a setfont-5 directive: %%setfont-5 Courier 10 underline
      const directive = new Directive(
        13, // id
        new Token(TT.IDENTIFIER, "setfont-5", 54), // key
        [new Token(TT.IDENTIFIER, "Courier", 55), new Token(TT.NUMBER, "10", 56), new Token(TT.IDENTIFIER, "underline", 57)] // values
      );

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).not.to.be.null;
      const setfontData = result?.data as { number: number; font: FontSpec };
      expect(setfontData.number).to.equal(5);
      expect(setfontData.font.decoration).to.equal("underline");
    });

    it("should analyze setfont directive with size only", () => {
      // Create a setfont-2 directive: %%setfont-2 16
      const directive = new Directive(
        14, // id
        new Token(TT.IDENTIFIER, "setfont-2", 59), // key
        [new Token(TT.NUMBER, "16", 60)] // values
      );

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).not.to.be.null;
      const setfontData = result?.data as { number: number; font: FontSpec };
      expect(setfontData.number).to.equal(2);
      expect(setfontData.font.size).to.equal(16);
      expect(setfontData.font.face).to.be.undefined;
    });

    it("should reject setfont-0 (invalid font number)", () => {
      // Create a setfont-0 directive (invalid): %%setfont-0 Times 12
      const directive = new Directive(
        15, // id
        new Token(TT.IDENTIFIER, "setfont-0", 62), // key
        [new Token(TT.IDENTIFIER, "Times", 63), new Token(TT.NUMBER, "12", 64)] // values
      );

      const result = analyzer.visitDirectiveExpr(directive);

      // Because setfont-0 doesn't match the pattern /^setfont-[1-9]$/,
      // it should be treated as an unknown directive and return null
      expect(result).to.be.null;
    });

    it("should reject setfont-10 (invalid font number)", () => {
      // Create a setfont-10 directive (invalid): %%setfont-10 Arial 14
      const directive = new Directive(
        16, // id
        new Token(TT.IDENTIFIER, "setfont-10", 66), // key
        [new Token(TT.IDENTIFIER, "Arial", 67), new Token(TT.NUMBER, "14", 68)] // values
      );

      const result = analyzer.visitDirectiveExpr(directive);

      // Because setfont-10 doesn't match the pattern /^setfont-[1-9]$/,
      // it should be treated as an unknown directive and return null
      expect(result).to.be.null;
    });

    it("should reject setfont without font parameters", () => {
      // Create a setfont-4 directive with no parameters: %%setfont-4
      const directive = new Directive(
        17, // id
        new Token(TT.IDENTIFIER, "setfont-4", 70), // key
        [] // no values
      );

      const result = analyzer.visitDirectiveExpr(directive);

      // Because no font parameters are provided, it should return null
      expect(result).to.be.null;
    });

    it("should not support box parameter (unlike other font directives)", () => {
      // Create a setfont-6 directive: %%setfont-6 Times 14 box
      // Because setfont does not support box parameter, it should be ignored or rejected
      const directive = new Directive(
        18, // id
        new Token(TT.IDENTIFIER, "setfont-6", 72), // key
        [new Token(TT.IDENTIFIER, "Times", 73), new Token(TT.NUMBER, "14", 74), new Token(TT.IDENTIFIER, "box", 75)] // values
      );

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).not.to.be.null;
      const setfontData = result?.data as { number: number; font: FontSpec };
      expect(setfontData.number).to.equal(6);
      // box parameter should be undefined because setfont doesn't support it
      expect(setfontData.font.box).to.be.undefined;
    });
  });
});
