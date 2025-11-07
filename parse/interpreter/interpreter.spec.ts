/**
 * interpreter.spec.ts
 *
 * Example-based tests for the TuneInterpreter
 * Tests metaText and formatting properties from info lines and directives
 */

import { expect } from "chai";
import { describe, it } from "mocha";
import { SemanticAnalyzer } from "../analyzers/semantic-analyzer";
import { ABCContext } from "../parsers/Context";
import { AbcErrorReporter } from "../parsers/ErrorReporter";
import { parse } from "../parsers/parse2";
import { Scanner } from "../parsers/scan2";
import { expectNoErrors, parseWithYourParser } from "../tests/interpreter-comparison/test-helpers";
import { TuneInterpreter } from "./TuneInterpreter";

/**
 * Helper to parse ABC input through full pipeline
 */
function parseABC(input: string) {
  const ctx = new ABCContext(new AbcErrorReporter());
  const tokens = Scanner(input, ctx);
  const ast = parse(tokens, ctx);
  const analyzer = new SemanticAnalyzer(ctx);
  ast.accept(analyzer);
  const interpreter = new TuneInterpreter(analyzer, ctx);
  const result = interpreter.interpretFile(ast);
  return { tunes: result.tunes, ctx };
}

describe("TuneInterpreter", () => {
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

    it("should apply titlecaps directive to titles", () => {
      const input = `%%titlecaps

X:1
T:test title
K:C`;

      const { tunes } = parseABC(input);
      expect(tunes).to.have.length(1);
      expect(tunes[0].metaText.title).to.equal("TEST TITLE");
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

    it("should parse header directive with single section", () => {
      const input = `%%header Page $P

X:1
T:Test
K:C
CDEF|`;

      const { tunes } = parseABC(input);
      expect(tunes[0].metaText.header).to.deep.equal({
        left: "",
        center: "Page $P",
        right: "",
      });
    });

    it("should parse header directive with three sections", () => {
      const input = `%%header Left\tCenter\tRight

X:1
T:Test
K:C
CDEF|`;

      const { tunes } = parseABC(input);
      expect(tunes[0].metaText.header).to.deep.equal({
        left: "Left",
        center: "Center",
        right: "Right",
      });
    });

    it("should parse footer directive with field codes", () => {
      const input = `%%footer $T\tPage $P\t$C

X:1
T:Test
K:C
CDEF|`;

      const { tunes } = parseABC(input);
      expect(tunes[0].metaText.footer).to.deep.equal({
        left: "$T",
        center: "Page $P",
        right: "$C",
      });
    });

    it("should parse footer directive with empty middle section", () => {
      const input = `%%footer $T\t\tPage $P

X:1
T:Test
K:C
CDEF|`;

      const { tunes } = parseABC(input);
      expect(tunes[0].metaText.footer).to.deep.equal({
        left: "$T",
        center: "",
        right: "Page $P",
      });
    });

    it("should handle header and footer in tune header", () => {
      const input = `X:1
T:Test
%%header Title Header
%%footer Footer Text
K:C
CDEF|`;

      const { tunes } = parseABC(input);
      expect(tunes[0].metaText.header).to.deep.equal({
        left: "",
        center: "Title Header",
        right: "",
      });
      expect(tunes[0].metaText.footer).to.deep.equal({
        left: "",
        center: "Footer Text",
        right: "",
      });
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

      const { tunes, ctx } = parseABC(input);
      // landscape is a parser config directive, allowed in file header
      // but NOT exposed in tune.formatting (internal only)
      expect(ctx.errorReporter.hasErrors()).to.be.false;
      expect(tunes[0].formatting.landscape).to.be.undefined;
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

    it("should error on flatbeams directive in file header", () => {
      const input = `%%flatbeams

X:1
T:Test
K:C
CDEF|`;

      const { ctx } = parseABC(input);
      // flatbeams is a formatting directive, requires tune context
      expect(ctx.errorReporter.hasErrors()).to.be.true;
      const errors = ctx.errorReporter.getErrors();
      const hasDirectiveError = errors.some((e) => e.message.includes("flatbeams") && e.message.includes("not allowed in file header"));
      expect(hasDirectiveError).to.be.true;
    });

    it("should parse flatbeams directive in tune header", () => {
      const input = `X:1
T:Test
%%flatbeams
K:C
CDEF|`;

      const { tunes, ctx } = parseABC(input);
      expect(ctx.errorReporter.hasErrors()).to.be.false;
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

      const { tunes, ctx } = parseABC(input);
      expect(ctx.errorReporter.hasErrors()).to.be.false;
      expect(tunes).to.have.length(2);

      // Both tunes should have inherited titlefont (formatting directive)
      expect(tunes[0].formatting.titlefont).to.exist;
      expect(tunes[1].formatting.titlefont).to.exist;

      // landscape is a parser config directive, NOT exposed in formatting
      expect(tunes[0].formatting.landscape).to.be.undefined;
      expect(tunes[1].formatting.landscape).to.be.undefined;
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

describe("Edge Cases from Property-Based Testing", () => {
  it("should not cause endless loop with complex metaText fields", () => {
    const input = `X:1
T:C4
C:S7 q
O:EaL
B:W g R
S:Evt2g
D:Wz'6 00 AA
N:1,'.'..a5'"(
Z:lK
H:,').
A:m 'v
M:C|
L:1/32
K:clef=none`;

    // Parse with our parser - should not hang
    const { tunes, ctx } = parseWithYourParser(input);

    // Should produce a tune
    expect(tunes).to.be.an("array");
    expect(tunes.length).to.be.greaterThan(0);
    expectNoErrors(ctx, "Your parser");

    // Verify metaText fields were parsed
    const tune = tunes[0];
    expect(tune.metaText.title).to.equal("C4");
    expect(tune.metaText.composer).to.equal("S7 q");
    expect(tune.metaText.origin).to.equal("EaL");
  });

  describe("Text Content Directives - TextLine Entries", () => {
    it("should create TextLine entry for %%text directive", () => {
      const input = `X:1
T:Test
K:C
%%text This is some text
CDEF|`;

      const { tunes } = parseABC(input);
      expect(tunes).to.have.length(1);

      // Because text directives create entries in systems[], we need to verify the entry
      const systems = tunes[0].systems;
      const textLines = systems.filter((system) => "text" in system);

      expect(textLines).to.have.length(1);
      const textLine = textLines[0];
      expect(textLine.text).to.be.an("array");
      expect(textLine.text).to.have.length(1);
      expect(textLine.text[0].text).to.equal("This is some text");
      expect(textLine.text[0].center).to.be.false;
    });

    it("should create TextLine entry for %%center directive with center flag", () => {
      const input = `X:1
T:Test
K:C
%%center Centered text
CDEF|`;

      const { tunes } = parseABC(input);
      expect(tunes).to.have.length(1);

      const systems = tunes[0].systems;
      const textLines = systems.filter((system) => "text" in system);

      expect(textLines).to.have.length(1);
      const textLine = textLines[0];
      expect(textLine.text).to.be.an("array");
      expect(textLine.text).to.have.length(1);
      expect(textLine.text[0].text).to.equal("Centered text");
      expect(textLine.text[0].center).to.be.true;
    });

    it("should create multiple TextLine entries for multiple text directives", () => {
      const input = `X:1
T:Test
K:C
%%text First line
%%center Second line centered
%%text Third line
CDEF|`;

      const { tunes } = parseABC(input);
      expect(tunes).to.have.length(1);

      const systems = tunes[0].systems;
      const textLines = systems.filter((system) => "text" in system);

      expect(textLines).to.have.length(3);

      // First text line (left-aligned)
      const firstLine = textLines[0];
      expect(firstLine.text[0].text).to.equal("First line");
      expect(firstLine.text[0].center).to.be.false;

      // Second text line (centered)
      const secondLine = textLines[1];
      expect(secondLine.text[0].text).to.equal("Second line centered");
      expect(secondLine.text[0].center).to.be.true;

      // Third text line (left-aligned)
      const thirdLine = textLines[2];
      expect(thirdLine.text[0].text).to.equal("Third line");
      expect(thirdLine.text[0].center).to.be.false;
    });

    it("should handle text directives in tune header", () => {
      const input = `X:1
T:Test
%%text Header text
K:C
CDEF|`;

      const { tunes } = parseABC(input);
      expect(tunes).to.have.length(1);

      const systems = tunes[0].systems;
      const textLines = systems.filter((system) => "text" in system);

      expect(textLines).to.have.length(1);
      const textLine = textLines[0];
      expect(textLine.text[0].text).to.equal("Header text");
    });

    it("should handle text directives in tune body", () => {
      const input = `X:1
T:Test
K:C
CDEF|
%%text Body text
CDEF|`;

      const { tunes } = parseABC(input);
      expect(tunes).to.have.length(1);

      const systems = tunes[0].systems;
      const textLines = systems.filter((system) => "text" in system);

      expect(textLines).to.have.length(1);
      const textLine = textLines[0];
      expect(textLine.text[0].text).to.equal("Body text");
    });
  });

  describe("Setfont Directive and Inline Font Switching", () => {
    it("should register font with setfont-1 directive", () => {
      const input = `X:1
T:Test
K:C
%%setfont-1 Times 18 bold
CDEF|`;

      const { tunes, ctx } = parseABC(input);
      expect(tunes).to.have.length(1);
      expectNoErrors(ctx, "parser");
    });

    it("should apply inline font switching with $1", () => {
      const input = `X:1
T:Test
K:C
%%setfont-1 Times 18 bold
%%text Normal $1bold$0 normal
CDEF|`;

      const { tunes } = parseABC(input);
      expect(tunes).to.have.length(1);

      const systems = tunes[0].systems;
      const textLines = systems.filter((system) => "text" in system);
      expect(textLines).to.have.length(1);

      const textLine = textLines[0];
      expect(textLine.text).to.be.an("array");
      expect(textLine.text).to.have.length(3);

      // First segment: "Normal " (default font)
      expect(textLine.text[0].text).to.equal("Normal ");
      expect(textLine.text[0].font).to.be.undefined;

      // Second segment: "bold" (font 1)
      expect(textLine.text[1].text).to.equal("bold");
      expect(textLine.text[1].font).to.exist;
      expect(textLine.text[1].font?.face).to.equal("Times");
      expect(textLine.text[1].font?.size).to.equal(18);
      expect(textLine.text[1].font?.weight).to.equal("bold");

      // Third segment: " normal" (back to default)
      expect(textLine.text[2].text).to.equal(" normal");
      expect(textLine.text[2].font).to.be.undefined;
    });

    it("should handle multiple font switches in one line", () => {
      const input = `X:1
T:Test
K:C
%%setfont-1 Times 18 bold
%%setfont-2 Arial 14 italic
%%setfont-3 Courier 12
%%text $1bold$0 $2italic$0 $3mono$0
CDEF|`;

      const { tunes } = parseABC(input);
      const systems = tunes[0].systems;
      const textLines = systems.filter((system) => "text" in system);
      expect(textLines).to.have.length(1);

      const textLine = textLines[0];
      expect(textLine.text).to.have.length(5); // 5 segments

      // Check each segment has the right font
      // Segment 0: "bold" with font 1
      expect(textLine.text[0].text).to.equal("bold");
      expect(textLine.text[0].font?.face).to.equal("Times");

      // Segment 1: " " with default font
      expect(textLine.text[1].text).to.equal(" ");

      // Segment 2: "italic" with font 2
      expect(textLine.text[2].text).to.equal("italic");
      expect(textLine.text[2].font?.face).to.equal("Arial");
      expect(textLine.text[2].font?.style).to.equal("italic");

      // Segment 3: " " with default font
      expect(textLine.text[3].text).to.equal(" ");

      // Segment 4: "mono" with font 3
      expect(textLine.text[4].text).to.equal("mono");
      expect(textLine.text[4].font?.face).to.equal("Courier");
    });

    it("should handle dollar sign escaping with $$", () => {
      const input = `X:1
T:Test
K:C
%%text Price: $$100
CDEF|`;

      const { tunes } = parseABC(input);
      const systems = tunes[0].systems;
      const textLines = systems.filter((system) => "text" in system);
      expect(textLines).to.have.length(1);

      const textLine = textLines[0];
      expect(textLine.text).to.have.length(1);
      expect(textLine.text[0].text).to.equal("Price: $100");
    });

    it("should treat unregistered font reference as literal text", () => {
      const input = `X:1
T:Test
K:C
%%text Normal $5unregistered text
CDEF|`;

      const { tunes } = parseABC(input);
      const systems = tunes[0].systems;
      const textLines = systems.filter((system) => "text" in system);
      expect(textLines).to.have.length(1);

      const textLine = textLines[0];
      expect(textLine.text).to.have.length(1);
      // Because font 5 is not registered, $5 should be treated as literal
      expect(textLine.text[0].text).to.equal("Normal $5unregistered text");
    });

    it("should support inline font switching in %%center directives", () => {
      const input = `X:1
T:Test
K:C
%%setfont-1 Times 18 bold
%%center Normal $1bold$0 centered
CDEF|`;

      const { tunes } = parseABC(input);
      const systems = tunes[0].systems;
      const textLines = systems.filter((system) => "text" in system);
      expect(textLines).to.have.length(1);

      const textLine = textLines[0];
      expect(textLine.text).to.have.length(3);

      // All segments should have center=true
      expect(textLine.text[0].center).to.be.true;
      expect(textLine.text[1].center).to.be.true;
      expect(textLine.text[2].center).to.be.true;

      // Check font switching still works
      expect(textLine.text[1].font?.face).to.equal("Times");
      expect(textLine.text[1].font?.weight).to.equal("bold");
    });

    it("should handle all 9 font registrations", () => {
      const input = `X:1
T:Test
K:C
%%setfont-1 Font1 12
%%setfont-2 Font2 12
%%setfont-3 Font3 12
%%setfont-4 Font4 12
%%setfont-5 Font5 12
%%setfont-6 Font6 12
%%setfont-7 Font7 12
%%setfont-8 Font8 12
%%setfont-9 Font9 12
%%text $1a$2b$3c$4d$5e$6f$7g$8h$9i$0
CDEF|`;

      const { tunes } = parseABC(input);
      const systems = tunes[0].systems;
      const textLines = systems.filter((system) => "text" in system);
      expect(textLines).to.have.length(1);

      const textLine = textLines[0];
      expect(textLine.text).to.have.length(9); // 9 fonts (no segment for empty $0 at end)

      // Verify each segment has the correct font
      for (let i = 0; i < 9; i++) {
        expect(textLine.text[i].font?.face).to.equal(`Font${i + 1}`);
      }
    });

    it("should allow font registration in file header", () => {
      const input = `X:1
T:Test
%%setfont-1 Times 18 bold
K:C
%%text $1bold$0
CDEF|`;

      const { tunes, ctx } = parseABC(input);
      expect(tunes).to.have.length(1);
      expectNoErrors(ctx, "parser");

      const systems = tunes[0].systems;
      const textLines = systems.filter((system) => "text" in system);

      expect(textLines).to.have.length(1);
      const textLine = textLines[0];
      expect(textLine.text).to.have.length(1);
      expect(textLine.text[0].text).to.equal("bold");
      expect(textLine.text[0].font).to.exist;
      expect(textLine.text[0].font?.face).to.equal("Times");
    });

    it("should handle font with italic modifier", () => {
      const input = `X:1
T:Test
K:C
%%setfont-1 Helvetica 14 italic
%%text $1italic text$0
CDEF|`;

      const { tunes } = parseABC(input);
      const systems = tunes[0].systems;
      const textLines = systems.filter((system) => "text" in system);
      const textLine = textLines[0];

      expect(textLine.text[0].font?.style).to.equal("italic");
    });

    it("should handle font with underline modifier", () => {
      const input = `X:1
T:Test
K:C
%%setfont-1 Courier 12 underline
%%text $1underlined$0
CDEF|`;

      const { tunes } = parseABC(input);
      const systems = tunes[0].systems;
      const textLines = systems.filter((system) => "text" in system);
      const textLine = textLines[0];

      expect(textLine.text[0].font?.decoration).to.equal("underline");
    });

    it("should handle empty font switch segments", () => {
      const input = `X:1
T:Test
K:C
%%setfont-1 Times 18 bold
%%text $1$0text
CDEF|`;

      const { tunes } = parseABC(input);
      const systems = tunes[0].systems;
      const textLines = systems.filter((system) => "text" in system);
      const textLine = textLines[0];

      // Because $1 and $0 have no text between them, only $0text should create a segment
      expect(textLine.text).to.have.length(1);
      expect(textLine.text[0].text).to.equal("text");
    });
  });
});
