import { expect } from "chai";
import { ABCContext } from "../parsers/Context";
import { AbcErrorReporter } from "../parsers/ErrorReporter";
import { Token, TT } from "../parsers/scan2";
import { Directive } from "../types/Expr2";
import { SemanticAnalyzer } from "./semantic-analyzer";

describe("Directive Analyzer - Percmap", () => {
  let analyzer: SemanticAnalyzer;
  let context: ABCContext;

  beforeEach(() => {
    const errorReporter = new AbcErrorReporter();
    context = new ABCContext(errorReporter);
    analyzer = new SemanticAnalyzer(context);
  });

  describe("Valid percmap with MIDI numbers", () => {
    it("should parse %%percmap C 36", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "percmap", context.generateId()), [
        new Token(TT.IDENTIFIER, "C", context.generateId()),
        new Token(TT.NUMBER, "36", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.type).to.equal("percmap");
      expect(result!.data).to.deep.equal({
        note: "C",
        sound: 36,
        noteHead: undefined,
      });
    });

    it("should parse %%percmap D 38", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "percmap", context.generateId()), [
        new Token(TT.IDENTIFIER, "D", context.generateId()),
        new Token(TT.NUMBER, "38", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.data).to.deep.equal({
        note: "D",
        sound: 38,
        noteHead: undefined,
      });
    });

    it("should parse %%percmap F 41 with boundary MIDI number (35)", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "percmap", context.generateId()), [
        new Token(TT.IDENTIFIER, "F", context.generateId()),
        new Token(TT.NUMBER, "35", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.data).to.deep.equal({
        note: "F",
        sound: 35,
        noteHead: undefined,
      });
    });

    it("should parse %%percmap G 81 with boundary MIDI number (81)", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "percmap", context.generateId()), [
        new Token(TT.IDENTIFIER, "G", context.generateId()),
        new Token(TT.NUMBER, "81", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.data).to.deep.equal({
        note: "G",
        sound: 81,
        noteHead: undefined,
      });
    });
  });

  describe("Valid percmap with drum names", () => {
    it("should parse %%percmap C acoustic-bass-drum", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "percmap", context.generateId()), [
        new Token(TT.IDENTIFIER, "C", context.generateId()),
        new Token(TT.IDENTIFIER, "acoustic-bass-drum", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.type).to.equal("percmap");
      // Because acoustic-bass-drum is index 0, we add 35 to get MIDI note 35
      expect(result!.data).to.deep.equal({
        note: "C",
        sound: 35,
        noteHead: undefined,
      });
    });

    it("should parse %%percmap D acoustic-snare", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "percmap", context.generateId()), [
        new Token(TT.IDENTIFIER, "D", context.generateId()),
        new Token(TT.IDENTIFIER, "acoustic-snare", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      // Because acoustic-snare is index 3, we add 35 to get MIDI note 38
      expect(result!.data).to.deep.equal({
        note: "D",
        sound: 38,
        noteHead: undefined,
      });
    });

    it("should parse %%percmap F cowbell", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "percmap", context.generateId()), [
        new Token(TT.IDENTIFIER, "F", context.generateId()),
        new Token(TT.IDENTIFIER, "cowbell", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      // Because cowbell is index 21, we add 35 to get MIDI note 56
      expect(result!.data).to.deep.equal({
        note: "F",
        sound: 56,
        noteHead: undefined,
      });
    });

    it("should parse %%percmap G open-triangle", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "percmap", context.generateId()), [
        new Token(TT.IDENTIFIER, "G", context.generateId()),
        new Token(TT.IDENTIFIER, "open-triangle", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      // Because open-triangle is index 46 (last), we add 35 to get MIDI note 81
      expect(result!.data).to.deep.equal({
        note: "G",
        sound: 81,
        noteHead: undefined,
      });
    });
  });

  describe("Case-insensitive drum names", () => {
    it("should parse %%percmap C ACOUSTIC-BASS-DRUM (uppercase)", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "percmap", context.generateId()), [
        new Token(TT.IDENTIFIER, "C", context.generateId()),
        new Token(TT.IDENTIFIER, "ACOUSTIC-BASS-DRUM", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.data).to.deep.equal({
        note: "C",
        sound: 35,
        noteHead: undefined,
      });
    });

    it("should parse %%percmap D CoWbElL (mixed case)", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "percmap", context.generateId()), [
        new Token(TT.IDENTIFIER, "D", context.generateId()),
        new Token(TT.IDENTIFIER, "CoWbElL", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.data).to.deep.equal({
        note: "D",
        sound: 56,
        noteHead: undefined,
      });
    });
  });

  describe("Valid percmap with optional note head", () => {
    it("should parse %%percmap C 36 triangle", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "percmap", context.generateId()), [
        new Token(TT.IDENTIFIER, "C", context.generateId()),
        new Token(TT.NUMBER, "36", context.generateId()),
        new Token(TT.IDENTIFIER, "triangle", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.type).to.equal("percmap");
      expect(result!.data).to.deep.equal({
        note: "C",
        sound: 36,
        noteHead: "triangle",
      });
    });

    it("should parse %%percmap D acoustic-snare x", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "percmap", context.generateId()), [
        new Token(TT.IDENTIFIER, "D", context.generateId()),
        new Token(TT.IDENTIFIER, "acoustic-snare", context.generateId()),
        new Token(TT.IDENTIFIER, "x", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.data).to.deep.equal({
        note: "D",
        sound: 38,
        noteHead: "x",
      });
    });

    it("should parse %%percmap F 41 diamond", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "percmap", context.generateId()), [
        new Token(TT.IDENTIFIER, "F", context.generateId()),
        new Token(TT.NUMBER, "41", context.generateId()),
        new Token(TT.IDENTIFIER, "diamond", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.data).to.deep.equal({
        note: "F",
        sound: 41,
        noteHead: "diamond",
      });
    });
  });

  describe("Error cases - invalid parameter count", () => {
    it("should report error when percmap has no parameters", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "percmap", context.generateId()), []);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.be.null;
    });

    it("should report error when percmap has only one parameter", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "percmap", context.generateId()), [
        new Token(TT.IDENTIFIER, "C", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.be.null;
    });

    it("should report error when percmap has too many parameters (4)", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "percmap", context.generateId()), [
        new Token(TT.IDENTIFIER, "C", context.generateId()),
        new Token(TT.NUMBER, "36", context.generateId()),
        new Token(TT.IDENTIFIER, "triangle", context.generateId()),
        new Token(TT.IDENTIFIER, "extra", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.be.null;
    });
  });

  describe("Error cases - invalid MIDI numbers", () => {
    it("should report error when MIDI number is too low (34)", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "percmap", context.generateId()), [
        new Token(TT.IDENTIFIER, "C", context.generateId()),
        new Token(TT.NUMBER, "34", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.be.null;
    });

    it("should report error when MIDI number is too high (82)", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "percmap", context.generateId()), [
        new Token(TT.IDENTIFIER, "C", context.generateId()),
        new Token(TT.NUMBER, "82", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.be.null;
    });

    it("should report error when MIDI number is negative", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "percmap", context.generateId()), [
        new Token(TT.IDENTIFIER, "C", context.generateId()),
        new Token(TT.NUMBER, "-1", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.be.null;
    });

    it("should report error when MIDI number is zero", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "percmap", context.generateId()), [
        new Token(TT.IDENTIFIER, "C", context.generateId()),
        new Token(TT.NUMBER, "0", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.be.null;
    });
  });

  describe("Error cases - invalid drum names", () => {
    it("should report error when drum name is unknown", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "percmap", context.generateId()), [
        new Token(TT.IDENTIFIER, "C", context.generateId()),
        new Token(TT.IDENTIFIER, "unknown-drum", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.be.null;
    });

    it("should report error when drum name is misspelled", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "percmap", context.generateId()), [
        new Token(TT.IDENTIFIER, "C", context.generateId()),
        new Token(TT.IDENTIFIER, "acoustic-bass", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.be.null;
    });

    it("should report error when drum name is arbitrary text", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "percmap", context.generateId()), [
        new Token(TT.IDENTIFIER, "C", context.generateId()),
        new Token(TT.IDENTIFIER, "foobar", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.be.null;
    });
  });

  describe("Various ABC note formats", () => {
    it("should parse %%percmap with accidental note (^C)", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "percmap", context.generateId()), [
        new Token(TT.IDENTIFIER, "^C", context.generateId()),
        new Token(TT.NUMBER, "36", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.data).to.deep.equal({
        note: "^C",
        sound: 36,
        noteHead: undefined,
      });
    });

    it("should parse %%percmap with flat note (_B)", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "percmap", context.generateId()), [
        new Token(TT.IDENTIFIER, "_B", context.generateId()),
        new Token(TT.NUMBER, "40", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.data).to.deep.equal({
        note: "_B",
        sound: 40,
        noteHead: undefined,
      });
    });

    it("should parse %%percmap with lowercase note (c)", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "percmap", context.generateId()), [
        new Token(TT.IDENTIFIER, "c", context.generateId()),
        new Token(TT.NUMBER, "42", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.data).to.deep.equal({
        note: "c",
        sound: 42,
        noteHead: undefined,
      });
    });
  });
});
