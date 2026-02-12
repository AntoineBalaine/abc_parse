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

describe("AbcDocument lazy snapshots", () => {
  describe("getSnapshots()", () => {
    it("returns null before analyze() is called", () => {
      const content = `X:1\nK:C\nCDEF|`;
      const doc = new AbcDocument(createTextDocument("file:///test.abc", content));
      // Do not call analyze()
      expect(doc.getSnapshots()).to.equal(null);
    });

    it("returns DocumentSnapshots array after analyze()", () => {
      const content = `X:1\nM:4/4\nK:C\nCDEF|`;
      const doc = new AbcDocument(createTextDocument("file:///test.abc", content));
      doc.analyze();

      const snapshots = doc.getSnapshots();
      expect(snapshots).to.not.equal(null);
      expect(Array.isArray(snapshots)).to.equal(true);
      expect(snapshots!.length).to.be.greaterThan(0);
    });

    it("returns same cached array on repeated calls (referential equality)", () => {
      const content = `X:1\nK:C\nCDEF|`;
      const doc = new AbcDocument(createTextDocument("file:///test.abc", content));
      doc.analyze();

      const first = doc.getSnapshots();
      const second = doc.getSnapshots();
      expect(first).to.equal(second);
    });

    it("returns fresh array after document update and analyze()", () => {
      const content1 = `X:1\nK:C\nCDEF|`;
      const doc = new AbcDocument(createTextDocument("file:///test.abc", content1));
      doc.analyze();

      const first = doc.getSnapshots();

      // Update document and re-analyze
      const content2 = `X:1\nK:G\nGABc|`;
      doc.document = createTextDocument("file:///test.abc", content2);
      doc.analyze();

      const second = doc.getSnapshots();
      expect(first).to.not.equal(second);
    });

    it("captures context from header directives", () => {
      const content = `X:1\nM:4/4\nL:1/8\nK:G\nGABc|`;
      const doc = new AbcDocument(createTextDocument("file:///test.abc", content));
      doc.analyze();

      const snapshots = doc.getSnapshots();
      expect(snapshots).to.not.equal(null);

      // Find a snapshot and verify it has the expected context
      const snapshot = snapshots![snapshots!.length - 1].snapshot;
      expect(snapshot.key?.root).to.equal("G");
      expect(snapshot.noteLength.numerator).to.equal(1);
      expect(snapshot.noteLength.denominator).to.equal(8);
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
