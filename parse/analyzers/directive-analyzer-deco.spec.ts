import { expect } from "chai";
import { ABCContext } from "../parsers/Context";
import { AbcErrorReporter } from "../parsers/ErrorReporter";
import { Token, TT } from "../parsers/scan2";
import { Directive } from "../types/Expr2";
import { SemanticAnalyzer } from "./semantic-analyzer";

/**
 * Example-based tests for %%deco directive parsing.
 * Reference: DIRECTIVE_IMPLEMENTATION_TICKETS.md lines 743-851
 */

describe("Directive Analyzer - %%deco", () => {
  let analyzer: SemanticAnalyzer;
  let context: ABCContext;
  let errorReporter: AbcErrorReporter;

  beforeEach(() => {
    errorReporter = new AbcErrorReporter();
    context = new ABCContext(errorReporter);
    analyzer = new SemanticAnalyzer(context);
  });

  describe("Valid cases", () => {
    it("should parse deco with name only", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "deco", context.generateId()), [
        new Token(TT.IDENTIFIER, "fermata", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.type).to.equal("deco");
      expect(result!.data).to.deep.equal({
        name: "fermata",
        definition: undefined,
      });

      // Because decoration redefinition is not fully supported, we expect a warning
      expect(errorReporter.getErrors()).to.have.lengthOf(1);
      expect(errorReporter.getErrors()[0].message).to.include("parsed but not fully implemented");
    });

    it("should parse deco with name and simple definition", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "deco", context.generateId()), [
        new Token(TT.IDENTIFIER, "trill", context.generateId()),
        new Token(TT.NUMBER, "1", context.generateId()),
        new Token(TT.NUMBER, "2", context.generateId()),
        new Token(TT.NUMBER, "3", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.type).to.equal("deco");
      expect(result!.data).to.deep.equal({
        name: "trill",
        definition: "1 2 3",
      });

      expect(errorReporter.getErrors()).to.have.lengthOf(1);
      expect(errorReporter.getErrors()[0].message).to.include("parsed but not fully implemented");
    });

    it("should parse deco with name and mixed definition", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "deco", context.generateId()), [
        new Token(TT.IDENTIFIER, "mordent", context.generateId()),
        new Token(TT.IDENTIFIER, "abc", context.generateId()),
        new Token(TT.IDENTIFIER, "def", context.generateId()),
        new Token(TT.NUMBER, "123", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.type).to.equal("deco");
      expect(result!.data).to.deep.equal({
        name: "mordent",
        definition: "abc def 123",
      });

      expect(errorReporter.getErrors()).to.have.lengthOf(1);
      expect(errorReporter.getErrors()[0].message).to.include("parsed but not fully implemented");
    });

    it("should parse deco with hyphenated name", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "deco", context.generateId()), [
        new Token(TT.IDENTIFIER, "my-custom-deco", context.generateId()),
        new Token(TT.IDENTIFIER, "some", context.generateId()),
        new Token(TT.IDENTIFIER, "definition", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.type).to.equal("deco");
      expect((result!.data as any).name).to.equal("my-custom-deco");
      expect((result!.data as any).definition).to.equal("some definition");

      expect(errorReporter.getErrors()).to.have.lengthOf(1);
      expect(errorReporter.getErrors()[0].message).to.include("parsed but not fully implemented");
    });

    it("should parse deco with single-letter name", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "deco", context.generateId()), [
        new Token(TT.IDENTIFIER, "T", context.generateId()),
        new Token(TT.IDENTIFIER, "postscript", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.type).to.equal("deco");
      expect((result!.data as any).name).to.equal("T");
      expect((result!.data as any).definition).to.equal("postscript");
    });
  });

  describe("Error cases", () => {
    it("should report error when no parameters provided", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "deco", context.generateId()), []);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.be.null;
      expect(errorReporter.getErrors()).to.have.length.greaterThan(0);
      expect(errorReporter.getErrors().some((e) => e.message.includes("requires a decoration name"))).to.be.true;
    });

    it("should report error when first parameter is not an identifier", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "deco", context.generateId()), [
        new Token(TT.NUMBER, "123", context.generateId()),
        new Token(TT.IDENTIFIER, "definition", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.be.null;
      expect(errorReporter.getErrors()).to.have.length.greaterThan(0);
      expect(errorReporter.getErrors().some((e) => e.message.includes("expects decoration name as first parameter"))).to.be.true;
    });
  });

  describe("Edge cases", () => {
    it("should handle very long definitions", () => {
      const tokens = [new Token(TT.IDENTIFIER, "myDeco", context.generateId())];
      for (let i = 0; i < 50; i++) {
        tokens.push(new Token(TT.IDENTIFIER, "word", context.generateId()));
      }

      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "deco", context.generateId()), tokens);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.type).to.equal("deco");
      expect((result!.data as any).name).to.equal("myDeco");
      // Because the definition is joined with spaces, we expect 50 words
      expect((result!.data as any).definition?.split(" ")).to.have.lengthOf(50);
    });

    it("should handle definition with mixed token types", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "deco", context.generateId()), [
        new Token(TT.IDENTIFIER, "custom", context.generateId()),
        new Token(TT.IDENTIFIER, "abc", context.generateId()),
        new Token(TT.NUMBER, "123", context.generateId()),
        new Token(TT.IDENTIFIER, "def", context.generateId()),
        new Token(TT.NUMBER, "456", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect((result!.data as any).name).to.equal("custom");
      // Because the definition is joined with spaces, we expect mixed content
      expect((result!.data as any).definition).to.equal("abc 123 def 456");
    });
  });
});
