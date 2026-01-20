// ABCT Validator Tests
// Tests for semantic validation of ABCT AST

import { expect } from "chai";
import { DiagnosticSeverity } from "vscode-languageserver";
import { parse } from "../src/parser";
import { AbctValidator } from "../../abc-lsp-server/src/abct/AbctValidator";

describe("ABCT Validator", () => {
  const validator = new AbctValidator();

  /**
   * Helper to parse and validate input, returning diagnostics
   */
  function validateInput(input: string) {
    const result = parse(input);
    if (!result.success) {
      throw new Error(`Parse failed: ${result.error.message}`);
    }
    return validator.validateProgram(result.value);
  }

  describe("Unknown Transforms", () => {
    it("should flag unknown transform names", () => {
      const diagnostics = validateInput("src.abc | @chords |= frobulate 4");
      expect(diagnostics).to.have.length(1);
      expect(diagnostics[0].severity).to.equal(DiagnosticSeverity.Error);
      expect(diagnostics[0].message).to.include("Unknown transform 'frobulate'");
    });

    it("should suggest similar transform names", () => {
      const diagnostics = validateInput("src.abc | @chords |= transpse 2");
      expect(diagnostics).to.have.length(1);
      expect(diagnostics[0].message).to.include("Did you mean 'transpose'");
    });

    it("should not flag known transforms", () => {
      const diagnostics = validateInput("src.abc | @chords |= transpose 2");
      expect(diagnostics).to.have.length(0);
    });

    it("should not flag transform with no arguments when none required", () => {
      const diagnostics = validateInput("src.abc | @notes |= retrograde");
      expect(diagnostics).to.have.length(0);
    });

    it("should flag unknown transform in a pipeline", () => {
      const diagnostics = validateInput("src.abc | unknownfn | transpose 2");
      expect(diagnostics).to.have.length(1);
      expect(diagnostics[0].message).to.include("Unknown transform 'unknownfn'");
    });
  });

  describe("Unknown Selectors", () => {
    it("should flag unknown selector names", () => {
      const diagnostics = validateInput("src.abc | @widgets");
      expect(diagnostics).to.have.length(1);
      expect(diagnostics[0].severity).to.equal(DiagnosticSeverity.Error);
      expect(diagnostics[0].message).to.include("Unknown selector '@widgets'");
    });

    it("should suggest similar selector names", () => {
      const diagnostics = validateInput("src.abc | @chors");
      expect(diagnostics).to.have.length(1);
      expect(diagnostics[0].message).to.include("Did you mean '@chords'");
    });

    it("should not flag known selectors (full form)", () => {
      const diagnostics = validateInput("src.abc | @chords");
      expect(diagnostics).to.have.length(0);
    });

    it("should not flag known selectors (short form)", () => {
      const diagnostics = validateInput("src.abc | @c");
      expect(diagnostics).to.have.length(0);
    });

    it("should not flag voice selectors", () => {
      const diagnostics = validateInput("src.abc | @V:melody");
      expect(diagnostics).to.have.length(0);
    });

    it("should not flag measure selectors", () => {
      const diagnostics = validateInput("src.abc | @M:5-8");
      expect(diagnostics).to.have.length(0);
    });
  });

  describe("Type Errors in Transform Arguments", () => {
    it("should flag missing required argument", () => {
      const diagnostics = validateInput("src.abc | @notes |= transpose");
      expect(diagnostics).to.have.length(1);
      expect(diagnostics[0].severity).to.equal(DiagnosticSeverity.Error);
      expect(diagnostics[0].message).to.include("requires argument");
      expect(diagnostics[0].message).to.include("n");
    });

    it("should flag fraction when integer expected", () => {
      const diagnostics = validateInput("src.abc | @notes |= transpose 1/2");
      expect(diagnostics).to.have.length(1);
      expect(diagnostics[0].severity).to.equal(DiagnosticSeverity.Error);
      expect(diagnostics[0].message).to.include("expects integer argument, got fraction");
    });

    it("should flag ABC literal when integer expected", () => {
      const diagnostics = validateInput("src.abc | @notes |= transpose <<CEG>>");
      expect(diagnostics).to.have.length(1);
      expect(diagnostics[0].severity).to.equal(DiagnosticSeverity.Error);
      expect(diagnostics[0].message).to.include("expects integer argument, got ABC literal");
    });
  });

  describe("Warnings", () => {
    it("should warn for transpose 0", () => {
      const diagnostics = validateInput("src.abc | @chords |= transpose 0");
      expect(diagnostics).to.have.length(1);
      expect(diagnostics[0].severity).to.equal(DiagnosticSeverity.Warning);
      expect(diagnostics[0].message).to.equal("transpose 0 has no effect");
    });

    it("should warn for octave 0", () => {
      const diagnostics = validateInput("src.abc | @chords |= octave 0");
      expect(diagnostics).to.have.length(1);
      expect(diagnostics[0].severity).to.equal(DiagnosticSeverity.Warning);
      expect(diagnostics[0].message).to.equal("octave 0 has no effect");
    });
  });

  describe("Complex Expressions", () => {
    it("should validate nested updates", () => {
      const diagnostics = validateInput(
        "src.abc | @chords |= (@notes |= transpose 2)"
      );
      expect(diagnostics).to.have.length(0);
    });

    it("should validate pipelines with multiple transforms", () => {
      const diagnostics = validateInput(
        "src.abc | @chords |= (transpose 2 | retrograde)"
      );
      expect(diagnostics).to.have.length(0);
    });

    it("should flag errors in nested expressions", () => {
      const diagnostics = validateInput(
        "src.abc | @chords |= (@notes |= unknownfn 2)"
      );
      expect(diagnostics).to.have.length(1);
      expect(diagnostics[0].message).to.include("Unknown transform 'unknownfn'");
    });

    it("should validate concatenation expressions", () => {
      const diagnostics = validateInput("a.abc + b.abc | @chords");
      expect(diagnostics).to.have.length(0);
    });

    it("should validate assignments with unknown transforms", () => {
      const diagnostics = validateInput("result = src.abc | @chords |= badtransform 1");
      expect(diagnostics).to.have.length(1);
      expect(diagnostics[0].message).to.include("Unknown transform 'badtransform'");
    });

    it("should validate list expressions in transform arguments", () => {
      const diagnostics = validateInput(
        "src.abc | @chords |= transpose 2"
      );
      expect(diagnostics).to.have.length(0);
    });
  });

  describe("Valid Programs", () => {
    it("should pass validation for complex arrangement example", () => {
      const input = `source = lead_sheet.abc
strings = source | @chords |= transpose 2
trumpet = source | @V:melody | transpose 2
bass = source | @chords | bass | transpose -12
strings + trumpet + bass`;
      const diagnostics = validateInput(input);
      expect(diagnostics).to.have.length(0);
    });

    it("should pass validation for chained transforms", () => {
      const diagnostics = validateInput(
        "src.abc | @chords |= transpose 4 | @notes |= octave -1"
      );
      expect(diagnostics).to.have.length(0);
    });
  });

  describe("Diagnostic Locations", () => {
    it("should report correct range for unknown transform", () => {
      const diagnostics = validateInput("src.abc | unknownfn");
      expect(diagnostics).to.have.length(1);
      const range = diagnostics[0].range;
      // The transform name 'unknownfn' should be highlighted
      expect(range.start.line).to.equal(0);
      expect(range.start.character).to.be.greaterThanOrEqual(10);
    });

    it("should report correct range for unknown selector", () => {
      const diagnostics = validateInput("src.abc | @badsel");
      expect(diagnostics).to.have.length(1);
      const range = diagnostics[0].range;
      // The selector '@badsel' should be highlighted
      expect(range.start.line).to.equal(0);
    });
  });
});
