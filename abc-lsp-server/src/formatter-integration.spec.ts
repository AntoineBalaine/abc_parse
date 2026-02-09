import { expect } from "chai";
import { describe, it } from "mocha";
import { AbcDocument } from "./AbcDocument";
import { TextDocument } from "vscode-languageserver-textdocument";
import { AbcFormatter } from "abc-parser";

function createTextDocument(uri: string, content: string): TextDocument {
  return TextDocument.create(uri, "abc", 0, content);
}

describe("Formatter integration - directive behavior on re-parse", () => {
  // Base content with INLINE voice markers [V:1] and [V:2]
  const baseContentWithInlineMarkers = `X:1
T:my cool title
[V:1]GDEF | ABc^c |[V:2][CEG]DEF | [CFA]Bc^c |
`;

  // Content with directive to convert inline to infoline style
  const contentWithInfolineDirective = `%%abcls-fmt voice-markers=infoline

X:1
T:my cool title
[V:1]GDEF | ABc^c |[V:2][CEG]DEF | [CFA]Bc^c |
`;

  // Content with infoline markers
  const baseContentWithInfolineMarkers = `X:1
T:my cool title
V:1
GDEF | ABc^c |
V:2
[CEG]DEF | [CFA]Bc^c |
`;

  // Content with directive to convert infoline to inline style
  const contentWithInlineDirective = `%%abcls-fmt voice-markers=inline

X:1
T:my cool title
V:1
GDEF | ABc^c |
V:2
[CEG]DEF | [CFA]Bc^c |
`;

  it("should set formatterConfig when directive is present and reset when removed", () => {
    // First parse WITHOUT directive
    const doc = new AbcDocument(createTextDocument("file:///test.abc", baseContentWithInlineMarkers));
    doc.analyze();

    expect(doc.AST).to.not.be.null;
    expect(doc.ctx.errorReporter.hasErrors()).to.be.false;

    // Verify formatterConfig has default values (no transformation requested)
    expect(doc.AST!.formatterConfig.voiceMarkerStyle).to.equal(null);
    expect(doc.ctx.formatterConfig.voiceMarkerStyle).to.equal(null);

    // Now add directive
    doc.document = createTextDocument("file:///test.abc", contentWithInfolineDirective);
    doc.analyze();

    expect(doc.AST).to.not.be.null;
    expect(doc.ctx.errorReporter.hasErrors()).to.be.false;

    // Verify formatterConfig now has the directive value
    expect(doc.AST!.formatterConfig.voiceMarkerStyle).to.equal("infoline");
    expect(doc.ctx.formatterConfig.voiceMarkerStyle).to.equal("infoline");

    // The formatted output should be different (the formatter attempts transformation)
    const formattedWithout = new AbcFormatter(doc.ctx).formatFile(doc.AST!);

    // Now remove directive and re-parse
    doc.document = createTextDocument("file:///test.abc", baseContentWithInlineMarkers);
    doc.analyze();

    // Verify formatterConfig is reset to defaults
    expect(doc.AST!.formatterConfig.voiceMarkerStyle).to.equal(null);
    expect(doc.ctx.formatterConfig.voiceMarkerStyle).to.equal(null);
  });

  it("should reset to no voice marker conversion when directive is removed", () => {
    // First parse WITH directive - converts inline to infoline
    const doc = new AbcDocument(createTextDocument("file:///test.abc", contentWithInfolineDirective));
    doc.analyze();

    expect(doc.AST).to.not.be.null;
    const formattedWith = new AbcFormatter(doc.ctx).formatFile(doc.AST!);

    // Now REMOVE directive and re-parse with content that has inline markers
    doc.document = createTextDocument("file:///test.abc", baseContentWithInlineMarkers);
    doc.analyze();

    expect(doc.AST).to.not.be.null;
    const formattedWithout = new AbcFormatter(doc.ctx).formatFile(doc.AST!);

    // Verify the AST formatterConfig is reset to defaults
    expect(doc.AST!.formatterConfig.voiceMarkerStyle).to.equal(null);

    // Verify context is also reset
    expect(doc.ctx.formatterConfig.voiceMarkerStyle).to.equal(null);

    // The output should keep inline markers (no conversion)
    expect(formattedWithout).to.include("[V:1]");
    expect(formattedWithout).to.include("[V:2]");

    // The formatted outputs should be different
    expect(formattedWith).to.not.equal(formattedWithout);
  });

  it("should set inline voiceMarkerStyle when inline directive is present", () => {
    // Parse with inline directive
    const doc = new AbcDocument(createTextDocument("file:///test.abc", contentWithInlineDirective));
    doc.analyze();

    expect(doc.AST).to.not.be.null;
    expect(doc.ctx.errorReporter.hasErrors()).to.be.false;

    // Verify formatterConfig has inline style
    expect(doc.AST!.formatterConfig.voiceMarkerStyle).to.equal("inline");
    expect(doc.ctx.formatterConfig.voiceMarkerStyle).to.equal("inline");

    // Now remove directive and re-parse
    doc.document = createTextDocument("file:///test.abc", baseContentWithInfolineMarkers);
    doc.analyze();

    // Verify formatterConfig is reset to defaults
    expect(doc.AST!.formatterConfig.voiceMarkerStyle).to.equal(null);
    expect(doc.ctx.formatterConfig.voiceMarkerStyle).to.equal(null);
  });
});
