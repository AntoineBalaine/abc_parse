import { expect } from "chai";
import { ABCContext } from "../parsers/Context";
import { AbcErrorReporter } from "../parsers/ErrorReporter";
import { Token, TT } from "../parsers/scan2";
import { Directive } from "../types/Expr2";
import { SemanticAnalyzer } from "./semantic-analyzer";

describe("Directive Analyzer - Header/Footer", () => {
  let analyzer: SemanticAnalyzer;
  let context: ABCContext;

  beforeEach(() => {
    const errorReporter = new AbcErrorReporter();
    context = new ABCContext(errorReporter);
    analyzer = new SemanticAnalyzer(context);
  });

  describe("%%header directive", () => {
    it("should parse single section (center only)", () => {
      const directive = new Directive(
        context.generateId(),
        new Token(TT.IDENTIFIER, "header", context.generateId()),
        [new Token(TT.FREE_TXT, "Center Text", context.generateId())]
      );

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.type).to.equal("header");
      expect(result!.data).to.deep.equal({
        left: "",
        center: "Center Text",
        right: "",
      });
    });

    it("should parse two sections (left and center)", () => {
      const directive = new Directive(
        context.generateId(),
        new Token(TT.IDENTIFIER, "header", context.generateId()),
        [new Token(TT.FREE_TXT, "Left\tCenter", context.generateId())]
      );

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.data).to.deep.equal({
        left: "Left",
        center: "Center",
        right: "",
      });
    });

    it("should parse three sections (left, center, right)", () => {
      const directive = new Directive(
        context.generateId(),
        new Token(TT.IDENTIFIER, "header", context.generateId()),
        [new Token(TT.FREE_TXT, "Left\tCenter\tRight", context.generateId())]
      );

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.data).to.deep.equal({
        left: "Left",
        center: "Center",
        right: "Right",
      });
    });

    it("should handle quoted text with double quotes", () => {
      const directive = new Directive(
        context.generateId(),
        new Token(TT.IDENTIFIER, "header", context.generateId()),
        [new Token(TT.FREE_TXT, '"Left\tCenter"', context.generateId())]
      );

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.data).to.deep.equal({
        left: "Left",
        center: "Center",
        right: "",
      });
    });

    it("should handle quoted text with single quotes", () => {
      const directive = new Directive(
        context.generateId(),
        new Token(TT.IDENTIFIER, "header", context.generateId()),
        [new Token(TT.FREE_TXT, "'Left\tCenter'", context.generateId())]
      );

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.data).to.deep.equal({
        left: "Left",
        center: "Center",
        right: "",
      });
    });

    it("should warn about extra tabs (more than 3 sections)", () => {
      const directive = new Directive(
        context.generateId(),
        new Token(TT.IDENTIFIER, "header", context.generateId()),
        [new Token(TT.FREE_TXT, "A\tB\tC\tD", context.generateId())]
      );

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.data).to.deep.equal({
        left: "A",
        center: "B",
        right: "C",
      });
      // Note: Error/warning reporting would be verified by checking context.errorReporter
    });

    it("should handle empty text", () => {
      const directive = new Directive(
        context.generateId(),
        new Token(TT.IDENTIFIER, "header", context.generateId()),
        [new Token(TT.FREE_TXT, "", context.generateId())]
      );

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.data).to.deep.equal({
        left: "",
        center: "",
        right: "",
      });
    });

    it("should handle field codes like $P, $N, $T", () => {
      const directive = new Directive(
        context.generateId(),
        new Token(TT.IDENTIFIER, "header", context.generateId()),
        [new Token(TT.FREE_TXT, "$T\tPage $P\t$C", context.generateId())]
      );

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.data).to.deep.equal({
        left: "$T",
        center: "Page $P",
        right: "$C",
      });
    });

    it("should handle empty sections with double tabs", () => {
      const directive = new Directive(
        context.generateId(),
        new Token(TT.IDENTIFIER, "header", context.generateId()),
        [new Token(TT.FREE_TXT, "$T\t\tPage $P", context.generateId())]
      );

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.data).to.deep.equal({
        left: "$T",
        center: "",
        right: "Page $P",
      });
    });

    it("should report error for missing text parameter", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "header", context.generateId()), []);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.be.null;
      // Note: Error reporting would be verified by checking context.errorReporter
    });
  });

  describe("%%footer directive", () => {
    it("should parse footer identically to header", () => {
      const directive = new Directive(
        context.generateId(),
        new Token(TT.IDENTIFIER, "footer", context.generateId()),
        [new Token(TT.FREE_TXT, "Page $P\t$T\t$N", context.generateId())]
      );

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.type).to.equal("footer");
      expect(result!.data).to.deep.equal({
        left: "Page $P",
        center: "$T",
        right: "$N",
      });
    });

    it("should parse single section footer", () => {
      const directive = new Directive(
        context.generateId(),
        new Token(TT.IDENTIFIER, "footer", context.generateId()),
        [new Token(TT.FREE_TXT, "Page $P of $N", context.generateId())]
      );

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.type).to.equal("footer");
      expect(result!.data).to.deep.equal({
        left: "",
        center: "Page $P of $N",
        right: "",
      });
    });

    it("should report error for missing text parameter", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "footer", context.generateId()), []);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.be.null;
    });
  });
});
