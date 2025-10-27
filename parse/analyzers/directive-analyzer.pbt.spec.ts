import * as fc from "fast-check";
import { expect } from "chai";
import { SemanticAnalyzer } from "./semantic-analyzer";
import { ABCContext } from "../parsers/Context";
import { AbcErrorReporter } from "../parsers/ErrorReporter";
import { FontSpec, MeasurementSpec } from "../types/directive-specs";
import * as Gen from "./directive-analyzer.pbt.generators";
import { Token } from "../parsers/scan2";
import { Directive } from "../types/Expr2";

describe("Directive Analyzer - Property-Based Tests", () => {
  let analyzer: SemanticAnalyzer;
  let context: ABCContext;

  beforeEach(() => {
    const errorReporter = new AbcErrorReporter();
    context = new ABCContext(errorReporter);
    analyzer = new SemanticAnalyzer(context);
  });

  // ============================================================================
  // Font Directive Properties
  // ============================================================================

  describe("Font Directives", () => {
    it("should correctly parse font directive format 1 (* size [box])", () => {
      fc.assert(
        fc.property(Gen.genFontDirectiveFormat1, (gen) => {
          const result = analyzer.visitDirectiveExpr(gen.directive);

          if (!result) return false;

          expect(result.type).to.equal(gen.expected.type);

          const fontData = result.data as FontSpec;
          expect(fontData.size).to.equal(gen.expected.size);
          expect(fontData.face).to.be.undefined;

          if (gen.expected.box) {
            expect(fontData.box).to.equal(true);
          }

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it("should correctly parse font directive format 2 (size [box])", () => {
      fc.assert(
        fc.property(Gen.genFontDirectiveFormat2, (gen) => {
          const result = analyzer.visitDirectiveExpr(gen.directive);

          if (!result) return false;

          expect(result.type).to.equal(gen.expected.type);

          const fontData = result.data as FontSpec;
          expect(fontData.size).to.equal(gen.expected.size);
          expect(fontData.face).to.be.undefined;

          if (gen.expected.box) {
            expect(fontData.box).to.equal(true);
          }

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it("should correctly parse font directive format 3 (full definition)", () => {
      fc.assert(
        fc.property(Gen.genFontDirectiveFormat3, (gen) => {
          const result = analyzer.visitDirectiveExpr(gen.directive);

          if (!result) return false;

          expect(result.type).to.equal(gen.expected.type);

          const fontData = result.data as FontSpec;

          if (gen.expected.face !== undefined) {
            expect(fontData.face).to.equal(gen.expected.face);
          }

          if (gen.expected.size !== undefined) {
            expect(fontData.size).to.equal(gen.expected.size);
          }

          if (gen.expected.weight !== undefined) {
            expect(fontData.weight).to.equal(gen.expected.weight);
          }

          if (gen.expected.style !== undefined) {
            expect(fontData.style).to.equal(gen.expected.style);
          }

          if (gen.expected.decoration !== undefined) {
            expect(fontData.decoration).to.equal(gen.expected.decoration);
          }

          if (gen.expected.box) {
            expect(fontData.box).to.equal(true);
          }

          return true;
        }),
        { numRuns: 200 }
      );
    });

    it("should strip quotes from quoted font names", () => {
      fc.assert(
        fc.property(Gen.genQuotedFontFace, Gen.genFontDirectiveNameWithBox, (quotedFace, name) => {
          const tokens = [new Token(Gen.sharedContext.generateId(), quotedFace, Gen.sharedContext.generateId())];
          const directive = new Directive(
            Gen.sharedContext.generateId(),
            new Token(Gen.sharedContext.generateId(), name, Gen.sharedContext.generateId()),
            tokens
          );

          const result = analyzer.visitDirectiveExpr(directive);
          if (!result) return false;

          const fontData = result.data as FontSpec;
          const expectedFace = quotedFace.slice(1, -1); // Remove quotes

          return fontData.face === expectedFace;
        }),
        { numRuns: 50 }
      );
    });

    it("should have idempotent analysis (same directive = same result)", () => {
      fc.assert(
        fc.property(Gen.genFontDirective, (gen) => {
          const context1 = new ABCContext(new AbcErrorReporter());
          const analyzer1 = new SemanticAnalyzer(context1);
          const result1 = analyzer1.visitDirectiveExpr(gen.directive);

          const context2 = new ABCContext(new AbcErrorReporter());
          const analyzer2 = new SemanticAnalyzer(context2);
          const result2 = analyzer2.visitDirectiveExpr(gen.directive);

          return JSON.stringify(result1) === JSON.stringify(result2);
        }),
        { numRuns: 50 }
      );
    });
  });

  // ============================================================================
  // Boolean Flag Properties
  // ============================================================================

  describe("Boolean Flag Directives", () => {
    it("should always return data: true for boolean flags", () => {
      fc.assert(
        fc.property(Gen.genBooleanFlagDirective, (gen) => {
          const result = analyzer.visitDirectiveExpr(gen.directive);

          expect(result).not.to.be.null;
          expect(result?.type).to.equal(gen.expected.type);
          expect(result?.data).to.equal(true);

          return true;
        }),
        { numRuns: 50 }
      );
    });
  });

  // ============================================================================
  // Identifier Directive Properties
  // ============================================================================

  describe("Identifier Directives", () => {
    it("should correctly extract identifier values", () => {
      fc.assert(
        fc.property(Gen.genIdentifierDirective, (gen) => {
          const result = analyzer.visitDirectiveExpr(gen.directive);

          expect(result).not.to.be.null;
          expect(result?.type).to.equal(gen.expected.type);
          expect(result?.data).to.equal(gen.expected.data);

          return true;
        }),
        { numRuns: 50 }
      );
    });
  });

  // ============================================================================
  // Boolean Value Directive Properties
  // ============================================================================

  describe("Boolean Value Directives", () => {
    it("should correctly parse boolean values (true/false and 0/1)", () => {
      fc.assert(
        fc.property(Gen.genBooleanValueDirective, (gen) => {
          const result = analyzer.visitDirectiveExpr(gen.directive);

          expect(result).not.to.be.null;
          expect(result?.type).to.equal(gen.expected.type);
          expect(result?.data).to.equal(gen.expected.data);

          return true;
        }),
        { numRuns: 50 }
      );
    });
  });

  // ============================================================================
  // Number Directive Properties
  // ============================================================================

  describe("Number Directives", () => {
    it("should correctly parse numbers within constraints", () => {
      fc.assert(
        fc.property(Gen.genNumberDirective, (gen) => {
          const result = analyzer.visitDirectiveExpr(gen.directive);

          if (result === null) {
            // Check if it was rejected due to constraints
            if (gen.constraints.min !== undefined && gen.expected.data < gen.constraints.min) {
              return true; // Correctly rejected
            }
            if (gen.constraints.max !== undefined && gen.expected.data > gen.constraints.max) {
              return true; // Correctly rejected
            }
            return false; // Should not have been rejected
          }

          expect(result.type).to.equal(gen.expected.type);
          expect(result.data).to.be.closeTo(gen.expected.data, 0.0001);

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it("should respect min/max constraints", () => {
      fc.assert(
        fc.property(Gen.genNumberDirective, (gen) => {
          const result = analyzer.visitDirectiveExpr(gen.directive);

          if (result === null) return true; // Rejected values are fine

          const value = result.data as number;

          if (gen.constraints.min !== undefined) {
            expect(value).to.be.at.least(gen.constraints.min);
          }

          if (gen.constraints.max !== undefined) {
            expect(value).to.be.at.most(gen.constraints.max);
          }

          return true;
        }),
        { numRuns: 100 }
      );
    });
  });

  // ============================================================================
  // Position Choice Directive Properties
  // ============================================================================

  describe("Position Choice Directives", () => {
    it("should only accept valid position values", () => {
      fc.assert(
        fc.property(Gen.genPositionDirective, (gen) => {
          const result = analyzer.visitDirectiveExpr(gen.directive);

          expect(result).not.to.be.null;
          expect(result?.type).to.equal(gen.expected.type);
          expect(result?.data).to.be.oneOf(["auto", "above", "below", "hidden"]);
          expect(result?.data).to.equal(gen.expected.data);

          return true;
        }),
        { numRuns: 50 }
      );
    });
  });

  // ============================================================================
  // Measurement Directive Properties
  // ============================================================================

  describe("Measurement Directives", () => {
    it("should correctly parse measurements with units", () => {
      fc.assert(
        fc.property(Gen.genMeasurementDirectiveWithUnit, (gen) => {
          const result = analyzer.visitDirectiveExpr(gen.directive);

          expect(result).not.to.be.null;
          expect(result?.type).to.equal(gen.expected.type);

          const measurementData = result?.data as MeasurementSpec;
          expect(measurementData.value).to.be.closeTo(gen.expected.data.value, 0.0001);
          expect(measurementData.unit).to.equal(gen.expected.data.unit);

          return true;
        }),
        { numRuns: 50 }
      );
    });

    it("should correctly parse measurements without units", () => {
      fc.assert(
        fc.property(Gen.genMeasurementDirectiveWithoutUnit, (gen) => {
          const result = analyzer.visitDirectiveExpr(gen.directive);

          expect(result).not.to.be.null;
          expect(result?.type).to.equal(gen.expected.type);

          const measurementData = result?.data as MeasurementSpec;
          expect(measurementData.value).to.be.closeTo(gen.expected.data.value, 0.0001);
          expect(measurementData.unit).to.be.undefined;

          return true;
        }),
        { numRuns: 50 }
      );
    });

    it("should only accept valid measurement units", () => {
      fc.assert(
        fc.property(Gen.genMeasurementDirectiveWithUnit, (gen) => {
          const result = analyzer.visitDirectiveExpr(gen.directive);

          if (!result) return false;

          const measurementData = result.data as MeasurementSpec;
          if (measurementData.unit) {
            expect(measurementData.unit).to.be.oneOf(["pt", "in", "cm", "mm"]);
          }

          return true;
        }),
        { numRuns: 50 }
      );
    });
  });

  // ============================================================================
  // Sep Directive Properties
  // ============================================================================

  describe("Sep Directive", () => {
    it("should correctly parse sep directive parameters", () => {
      fc.assert(
        fc.property(Gen.genSepDirective, (gen) => {
          const result = analyzer.visitDirectiveExpr(gen.directive);

          expect(result).not.to.be.null;
          expect(result?.type).to.equal("sep");

          const sepData = result?.data as { above?: number; below?: number; length?: number };

          if (gen.expected.data.above !== undefined) {
            expect(sepData.above).to.be.closeTo(gen.expected.data.above, 0.0001);
          }

          if (gen.expected.data.below !== undefined) {
            expect(sepData.below).to.be.closeTo(gen.expected.data.below, 0.0001);
          }

          if (gen.expected.data.length !== undefined) {
            expect(sepData.length).to.be.closeTo(gen.expected.data.length, 0.0001);
          }

          return true;
        }),
        { numRuns: 50 }
      );
    });
  });

  // ============================================================================
  // Annotation Directive Properties
  // ============================================================================

  describe("Annotation Directives", () => {
    it("should correctly extract annotation text", () => {
      fc.assert(
        fc.property(Gen.genAnnotationDirective, (gen) => {
          const result = analyzer.visitDirectiveExpr(gen.directive);

          expect(result).not.to.be.null;
          expect(result?.type).to.equal(gen.expected.type);
          expect(result?.data).to.equal(gen.expected.data);

          return true;
        }),
        { numRuns: 50 }
      );
    });
  });

  // ============================================================================
  // Newpage Directive Properties
  // ============================================================================

  describe("Newpage Directive", () => {
    it("should correctly handle optional page numbers", () => {
      fc.assert(
        fc.property(Gen.genNewpageDirective, (gen) => {
          const result = analyzer.visitDirectiveExpr(gen.directive);

          expect(result).not.to.be.null;
          expect(result?.type).to.equal("newpage");

          if (gen.expected.data === null) {
            expect(result?.data).to.be.null;
          } else {
            expect(result?.data).to.equal(gen.expected.data);
          }

          return true;
        }),
        { numRuns: 50 }
      );
    });
  });

  // ============================================================================
  // Cross-cutting Properties
  // ============================================================================

  describe("General Properties", () => {
    it("should store all analyzed directives in the data map", () => {
      fc.assert(
        fc.property(Gen.genAnyDirective, (gen) => {
          const result = analyzer.visitDirectiveExpr(gen.directive);

          if (result !== null) {
            expect(analyzer.data.has(gen.directive.id)).to.be.true;
            expect(analyzer.data.get(gen.directive.id)).to.deep.equal(result);
          }

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it("should have monotonically growing data map", () => {
      fc.assert(
        fc.property(fc.array(Gen.genAnyDirective, { minLength: 1, maxLength: 20 }), (directives) => {
          const analyzer = new SemanticAnalyzer(new ABCContext(new AbcErrorReporter()));
          let previousSize = 0;

          for (const gen of directives) {
            const result = analyzer.visitDirectiveExpr(gen.directive);

            if (result !== null) {
              expect(analyzer.data.size).to.be.at.least(previousSize);
              previousSize = analyzer.data.size;
            }
          }

          return true;
        }),
        { numRuns: 50 }
      );
    });
  });
});
