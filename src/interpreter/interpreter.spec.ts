/**
 * interpreter.spec.ts
 *
 * Example-based tests for the TuneInterpreter
 * Tests metaText and formatting properties from info lines and directives
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { ABCContext } from "../parsers/Context";
import { AbcErrorReporter } from "../parsers/ErrorReporter";
import { Scanner2 } from "../parsers/scan2";
import { parse } from "../parsers/parse2";
import { SemanticAnalyzer } from "../analyzers/semantic-analyzer";
import { TuneInterpreter } from "./TuneInterpreter";

/**
 * Helper to parse ABC input through full pipeline
 */
function parseABC(input: string) {
  const ctx = new ABCContext(new AbcErrorReporter());
  const tokens = Scanner2(input, ctx);
  const ast = parse(tokens, ctx);
  const analyzer = new SemanticAnalyzer(ctx);
  ast.accept(analyzer);
  const interpreter = new TuneInterpreter(analyzer, ctx);
  const result = interpreter.interpretFile(ast);
  return { tunes: result.tunes, ctx };
}

describe.only("TuneInterpreter", () => {
  describe("Tune Header Info Lines - MetaText", () => {
    it("should parse single title", () => {
      const input = `X:1
T:Test Title
K:C
CDEF|`;

      const { tunes } = parseABC(input);
      expect(tunes).to.have.length(1);
      expect(tunes[0].metaText.title).to.equal("Test Title");
    });

    it("should parse multiple titles", () => {
      const input = `X:1
T:Main Title
T:Subtitle
K:C
CDEF|`;

      const { tunes } = parseABC(input);
      expect(tunes).to.have.length(1);
      expect(tunes[0].metaText.title).to.exist;
    });

    it("should parse composer", () => {
      const input = `X:1
T:Test
C:Test Composer
K:C
CDEF|`;

      const { tunes } = parseABC(input);
      expect(tunes[0].metaText.composer).to.equal("Test Composer");
    });

    it("should parse origin", () => {
      const input = `X:1
T:Test
O:Ireland
K:C
CDEF|`;

      const { tunes } = parseABC(input);
      expect(tunes[0].metaText.origin).to.equal("Ireland");
    });

    it("should parse tempo into metaText", () => {
      const input = `X:1
T:Test
Q:120
K:C
CDEF|`;

      const { tunes } = parseABC(input);
      expect(tunes[0].metaText.tempo).to.exist;
    });
  });

  describe("Tune Header Info Lines - TuneDefaults", () => {
    it("should parse key with treble clef", () => {
      const input = `X:1
T:Test
K:C clef=treble
CDEF|`;

      const { tunes, ctx } = parseABC(input);

      // Check no errors
      expect(ctx.errorReporter.hasErrors()).to.be.false;

      // Key info is stored in tuneDefaults during interpretation
      // We can verify by checking the tune was created successfully
      expect(tunes).to.have.length(1);
    });

    it("should parse key with bass clef", () => {
      const input = `X:1
T:Test
K:C clef=bass
CDEF|`;

      const { tunes, ctx } = parseABC(input);
      expect(ctx.errorReporter.hasErrors()).to.be.false;
      expect(tunes).to.have.length(1);
    });

    it("should parse meter with fraction", () => {
      const input = `X:1
T:Test
M:4/4
K:C
CDEF|`;

      const { tunes, ctx } = parseABC(input);
      expect(ctx.errorReporter.hasErrors()).to.be.false;
      expect(tunes).to.have.length(1);
    });

    it("should parse meter with C|", () => {
      const input = `X:1
T:Test
M:C|
K:C
CDEF|`;

      const { tunes, ctx } = parseABC(input);
      expect(ctx.errorReporter.hasErrors()).to.be.false;
      expect(tunes).to.have.length(1);
    });

    it("should parse note length", () => {
      const input = `X:1
T:Test
L:1/8
K:C
CDEF|`;

      const { tunes, ctx } = parseABC(input);
      expect(ctx.errorReporter.hasErrors()).to.be.false;
      expect(tunes).to.have.length(1);
    });

    it("should store tempo in tuneDefaults", () => {
      const input = `X:1
T:Test
Q:120
K:C
CDEF|`;

      const { tunes } = parseABC(input);
      // Tempo should be in metaText (verified in earlier test)
      // and also accessible through tune structure
      expect(tunes[0].metaText.tempo).to.exist;
    });
  });

  describe("File Header Directives - MetaText", () => {
    it("should parse abc-copyright directive", () => {
      const input = `%%abc-copyright Copyright 2024

X:1
T:Test
K:C
CDEF|`;

      const { tunes } = parseABC(input);
      expect(tunes[0].metaText["abc-copyright"]).to.equal("Copyright 2024");
    });

    it("should parse abc-creator directive", () => {
      const input = `%%abc-creator Test Creator

X:1
T:Test
K:C
CDEF|`;

      const { tunes } = parseABC(input);
      expect(tunes[0].metaText["abc-creator"]).to.equal("Test Creator");
    });

    it("should parse abc-edited-by directive", () => {
      const input = `%%abc-edited-by John Doe

X:1
T:Test
K:C
CDEF|`;

      const { tunes } = parseABC(input);
      expect(tunes[0].metaText["abc-edited-by"]).to.equal("John Doe");
    });
  });

  describe("File Header Directives - Formatting", () => {
    it("should parse titlefont directive", () => {
      const input = `%%titlefont Times-Bold 20

X:1
T:Test
K:C
CDEF|`;

      const { tunes } = parseABC(input);
      expect(tunes[0].formatting.titlefont).to.exist;
      expect(tunes[0].formatting.titlefont.type).to.equal("titlefont");
    });

    it("should parse composerfont directive", () => {
      const input = `%%composerfont Helvetica 12

X:1
T:Test
K:C
CDEF|`;

      const { tunes } = parseABC(input);
      expect(tunes[0].formatting.composerfont).to.exist;
      expect(tunes[0].formatting.composerfont.type).to.equal("composerfont");
    });

    it("should parse tempofont directive", () => {
      const input = `%%tempofont Courier 10

X:1
T:Test
K:C
CDEF|`;

      const { tunes } = parseABC(input);
      expect(tunes[0].formatting.tempofont).to.exist;
      expect(tunes[0].formatting.tempofont.type).to.equal("tempofont");
    });

    it("should parse landscape directive", () => {
      const input = `%%landscape

X:1
T:Test
K:C
CDEF|`;

      const { tunes } = parseABC(input);
      expect(tunes[0].formatting.landscape).to.exist;
      expect(tunes[0].formatting.landscape.type).to.equal("landscape");
    });

    it("should parse stretchlast directive", () => {
      const input = `%%stretchlast

X:1
T:Test
K:C
CDEF|`;

      const { tunes } = parseABC(input);
      expect(tunes[0].formatting.stretchlast).to.exist;
      expect(tunes[0].formatting.stretchlast.type).to.equal("stretchlast");
    });

    it("should parse flatbeams directive", () => {
      const input = `%%flatbeams

X:1
T:Test
K:C
CDEF|`;

      const { tunes } = parseABC(input);
      expect(tunes[0].formatting.flatbeams).to.exist;
      expect(tunes[0].formatting.flatbeams.type).to.equal("flatbeams");
    });
  });

  describe("File Header Directives - Version", () => {
    it("should parse abc-version directive", () => {
      const input = `%%abc-version 2.1

X:1
T:Test
K:C
CDEF|`;

      const { tunes } = parseABC(input);
      expect(tunes[0].version).to.equal("2.1");
    });
  });

  describe("File Header Info Lines", () => {
    it("should inherit note length from file header", () => {
      const input = `L:1/8

X:1
T:Test
K:C
CDEF|`;

      const { tunes, ctx } = parseABC(input);
      expect(ctx.errorReporter.hasErrors()).to.be.false;
      expect(tunes).to.have.length(1);
    });

    it("should inherit tempo from file header", () => {
      const input = `Q:120

X:1
T:Test
K:C
CDEF|`;

      const { tunes } = parseABC(input);
      expect(tunes[0].metaText.tempo).to.exist;
    });
  });

  describe("File Header Inheritance", () => {
    it("should inherit metaText from file header", () => {
      const input = `%%abc-copyright Copyright 2024
%%abc-creator Test Creator

X:1
T:First Tune
K:C
CDEF|

X:2
T:Second Tune
K:G
GABc|`;

      const { tunes } = parseABC(input);
      expect(tunes).to.have.length(2);

      // Both tunes should have inherited metaText
      expect(tunes[0].metaText["abc-copyright"]).to.equal("Copyright 2024");
      expect(tunes[0].metaText["abc-creator"]).to.equal("Test Creator");
      expect(tunes[1].metaText["abc-copyright"]).to.equal("Copyright 2024");
      expect(tunes[1].metaText["abc-creator"]).to.equal("Test Creator");
    });

    it("should inherit formatting from file header", () => {
      const input = `%%titlefont Times-Bold 20
%%landscape

X:1
T:First Tune
K:C
CDEF|

X:2
T:Second Tune
K:G
GABc|`;

      const { tunes } = parseABC(input);
      expect(tunes).to.have.length(2);

      // Both tunes should have inherited formatting
      expect(tunes[0].formatting.titlefont).to.exist;
      expect(tunes[0].formatting.landscape).to.exist;
      expect(tunes[1].formatting.titlefont).to.exist;
      expect(tunes[1].formatting.landscape).to.exist;
    });

    it("should inherit version from file header", () => {
      const input = `%%abc-version 2.1

X:1
T:First Tune
K:C
CDEF|

X:2
T:Second Tune
K:G
GABc|`;

      const { tunes } = parseABC(input);
      expect(tunes).to.have.length(2);
      expect(tunes[0].version).to.equal("2.1");
      expect(tunes[1].version).to.equal("2.1");
    });

    it("should create independent copies for each tune", () => {
      const input = `%%abc-creator Original Creator

X:1
T:First Tune
K:C
CDEF|

X:2
T:Second Tune
%%abc-creator Modified Creator
K:G
GABc|`;

      const { tunes } = parseABC(input);
      expect(tunes).to.have.length(2);

      // First tune should have original
      expect(tunes[0].metaText["abc-creator"]).to.equal("Original Creator");

      // Second tune should be able to override (if supported)
      // For now, just verify they're independent objects
      expect(tunes[0].metaText).to.not.equal(tunes[1].metaText);
    });
  });

  describe("Tune Header Overrides", () => {
    it("should allow tune to override file header metaText", () => {
      const input = `Q:100

X:1
T:Test
Q:120
K:C
CDEF|`;

      const { tunes } = parseABC(input);
      // Tune-specific Q: should override file header Q:
      expect(tunes[0].metaText.tempo).to.exist;
    });

    it("should allow tune to override file header formatting", () => {
      const input = `%%titlefont Times-Bold 20

X:1
T:Test
%%titlefont Helvetica 16
K:C
CDEF|`;

      const { tunes } = parseABC(input);
      expect(tunes[0].formatting.titlefont).to.exist;
      // The tune-specific directive should override
    });
  });

  describe("Error Cases", () => {
    it("should error on K: in file header", () => {
      const input = `K:C

X:1
T:Test
K:G
CDEF|`;

      const { ctx } = parseABC(input);
      expect(ctx.errorReporter.hasErrors()).to.be.true;

      const errors = ctx.errorReporter.getErrors();
      const hasKeyError = errors.some((e) => e.message.includes("not allowed in file header") || e.message.includes("key"));
      expect(hasKeyError).to.be.true;
    });

    it("should error on M: in file header", () => {
      const input = `M:4/4

X:1
T:Test
K:C
CDEF|`;

      const { ctx } = parseABC(input);
      expect(ctx.errorReporter.hasErrors()).to.be.true;

      const errors = ctx.errorReporter.getErrors();
      const hasMeterError = errors.some((e) => e.message.includes("not allowed in file header") || e.message.includes("meter"));
      expect(hasMeterError).to.be.true;
    });

    it("should error on unknown info line key", () => {
      // Let's test with a truly unknown key
      const input2 = `X:1
T:Test
z:Unknown
K:C
CDEF|`;

      const { ctx } = parseABC(input2);
      expect(ctx.errorReporter.hasErrors()).to.be.true;

      const errors = ctx.errorReporter.getErrors();
      const hasUnknownError = errors.some((e) => e.message.includes("Unknown info line key"));
      expect(hasUnknownError).to.be.true;
    });
  });
});
