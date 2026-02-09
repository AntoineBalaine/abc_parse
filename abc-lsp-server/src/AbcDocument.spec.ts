import { expect } from "chai";
import { describe, it } from "mocha";
import { AbcDocument } from "./AbcDocument";
import { AbcxDocument } from "./AbcxDocument";
import { TextDocument } from "vscode-languageserver-textdocument";

function createTextDocument(uri: string, content: string): TextDocument {
  return TextDocument.create(uri, "abc", 0, content);
}

describe("AbcDocument context reset on re-parse", () => {
  describe("linear flag reset", () => {
    it("should reset file-level linear flag when directive is removed", () => {
      const initialContent = `%%abcls-parse linear

X:1
K:C
CDEF|
`;
      const doc = new AbcDocument(createTextDocument("file:///test.abc", initialContent));
      doc.analyze();

      expect(doc.ctx.linear).to.equal(true);

      // Re-parse without the directive
      const updatedContent = `X:1
K:C
CDEF|
`;
      doc.document = createTextDocument("file:///test.abc", updatedContent);
      doc.analyze();

      expect(doc.ctx.linear).to.equal(false);
      expect(doc.ctx.tuneLinear).to.equal(false);
    });

    it("should reset tune-level linear flag when directive is removed", () => {
      const initialContent = `X:1
%%abcls-parse linear
K:C
CDEF|
`;
      const doc = new AbcDocument(createTextDocument("file:///test.abc", initialContent));
      doc.analyze();

      expect(doc.ctx.tuneLinear).to.equal(true);

      // Re-parse without the directive
      const updatedContent = `X:1
K:C
CDEF|
`;
      doc.document = createTextDocument("file:///test.abc", updatedContent);
      doc.analyze();

      expect(doc.ctx.tuneLinear).to.equal(false);
    });
  });

  describe("formatterConfig reset", () => {
    it("should reset systemComments flag when directive is removed", () => {
      const initialContent = `%%abcls-fmt system-comments

X:1
K:C
CDEF|
`;
      const doc = new AbcDocument(createTextDocument("file:///test.abc", initialContent));
      doc.analyze();

      expect(doc.ctx.formatterConfig.systemComments).to.equal(true);

      // Re-parse without the directive
      const updatedContent = `X:1
K:C
CDEF|
`;
      doc.document = createTextDocument("file:///test.abc", updatedContent);
      doc.analyze();

      expect(doc.ctx.formatterConfig.systemComments).to.equal(false);
    });

    it("should reset voiceMarkerStyle flag when directive is removed", () => {
      const initialContent = `%%abcls-fmt voice-markers=inline

X:1
K:C
CDEF|
`;
      const doc = new AbcDocument(createTextDocument("file:///test.abc", initialContent));
      doc.analyze();

      expect(doc.ctx.formatterConfig.voiceMarkerStyle).to.equal("inline");

      // Re-parse without the directive
      const updatedContent = `X:1
K:C
CDEF|
`;
      doc.document = createTextDocument("file:///test.abc", updatedContent);
      doc.analyze();

      expect(doc.ctx.formatterConfig.voiceMarkerStyle).to.equal(null);
    });
  });

  describe("multiple re-parse cycles", () => {
    it("should correctly toggle linear flag across multiple re-parses", () => {
      const withDirective = `%%abcls-parse linear

X:1
K:C
CDEF|
`;
      const withoutDirective = `X:1
K:C
CDEF|
`;

      const doc = new AbcDocument(createTextDocument("file:///test.abc", withDirective));

      // First parse with directive
      doc.analyze();
      expect(doc.ctx.linear).to.equal(true);

      // Remove directive
      doc.document = createTextDocument("file:///test.abc", withoutDirective);
      doc.analyze();
      expect(doc.ctx.linear).to.equal(false);

      // Add directive back
      doc.document = createTextDocument("file:///test.abc", withDirective);
      doc.analyze();
      expect(doc.ctx.linear).to.equal(true);

      // Remove directive again
      doc.document = createTextDocument("file:///test.abc", withoutDirective);
      doc.analyze();
      expect(doc.ctx.linear).to.equal(false);
    });
  });
});

describe("AbcxDocument context reset on re-parse", () => {
  // Note: AbcxDocument uses ScannerAbcx and parseAbcx which do not support the
  // %%abcls-parse linear directive. We verify that the reset mechanism works
  // by testing formatterConfig reset, which is handled at the context level.
  it("should reset context flags between parses", () => {
    const initialContent = `X:1
K:C
CDEF|
`;
    const doc = new AbcxDocument(createTextDocument("file:///test.abcx", initialContent));

    // Manually set a flag to simulate it being set during a previous parse
    doc.ctx.linear = true;
    doc.ctx.formatterConfig.systemComments = true;

    // Re-parse - the reset() call should clear the flags
    doc.analyze();

    expect(doc.ctx.linear).to.equal(false);
    expect(doc.ctx.formatterConfig.systemComments).to.equal(false);
  });
});
