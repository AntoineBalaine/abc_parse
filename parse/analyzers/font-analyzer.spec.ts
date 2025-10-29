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
});
