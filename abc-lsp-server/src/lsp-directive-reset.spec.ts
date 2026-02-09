import { expect } from "chai";
import { describe, it } from "mocha";
import { TextDocument } from "vscode-languageserver-textdocument";
import { TextEdit } from "vscode-languageserver";
import { AbcLspServer } from "./AbcLspServer";

/**
 * Helper to extract the formatted text from onFormat result.
 */
function getFormattedText(result: TextEdit[] | null | undefined): string {
  if (!result || result.length === 0) {
    return "";
  }
  return result[0].newText;
}

/**
 * Mock TextDocuments class that simulates the vscode-languageserver TextDocuments behavior.
 * Stores documents by URI and fires onDidChangeContent callbacks when content changes.
 */
class MockTextDocuments {
  documents: Map<string, TextDocument> = new Map();
  changeListeners: Array<(change: { document: TextDocument }) => void> = [];
  closeListeners: Array<(event: { document: TextDocument }) => void> = [];
  version = 0;

  onDidChangeContent(listener: (change: { document: TextDocument }) => void): void {
    this.changeListeners.push(listener);
  }

  onDidClose(listener: (event: { document: TextDocument }) => void): void {
    this.closeListeners.push(listener);
  }

  get(uri: string): TextDocument | undefined {
    return this.documents.get(uri);
  }

  /**
   * Simulates opening or updating a document.
   * Creates a new TextDocument and fires onDidChangeContent.
   */
  update(uri: string, content: string): void {
    this.version++;
    const document = TextDocument.create(uri, "abc", this.version, content);
    this.documents.set(uri, document);

    for (const listener of this.changeListeners) {
      listener({ document });
    }
  }
}

describe("LSP Integration - Directive reset on document change", () => {
  const TEST_URI = "file:///test.abc";

  // Base content: V:1 has two lines of music, V:2 has one line
  const baseContent = `X:1
T:my cool title
V:1
GDEF | ABc^c |
abc
V:2
[CEG]DEF | [CFA]Bc^c |
`;

  // Base content is idempotent - formatting produces same output
  const expectedBaseOutput = `X:1
T:my cool title
V:1
GDEF | ABc^c |
abc
V:2
[CEG]DEF | [CFA]Bc^c |
`;

  // Content with both directives
  const contentWithBothDirectives = `%%abcls-parse linear
%%abcls-fmt system-comments
X:1
T:my cool title
V:1
gdef | abc^c |
abc
V:2
[ceg]def | [cfa]bc^c |
`;

  // Expected output: % separator inserted between system boundary
  const expectedWithBothDirectives = `%%abcls-parse linear
%%abcls-fmt system-comments
X:1
T:my cool title
V:1
gdef | abc^c |
%
abc
V:2
[ceg]def | [cfa]bc^c |
`;

  // Content with only system-comments directive (no linear)
  const contentWithOnlySystemComments = `%%abcls-fmt system-comments
X:1
T:my cool title
V:1
GDEF | ABc^c |
abc
V:2
[CEG]DEF | [CFA]Bc^c |
`;

  // Expected output: no separator because linear not enabled
  const expectedWithOnlySystemComments = `%%abcls-fmt system-comments
X:1
T:my cool title
V:1
GDEF | ABc^c |
abc
V:2
[CEG]DEF | [CFA]Bc^c |
`;

  it("should produce correct formatter output across document changes", () => {
    const mockDocuments = new MockTextDocuments();

    const server = new AbcLspServer(mockDocuments as any, () => {});

    // Step 1: Open document with base content (no directives)
    mockDocuments.update(TEST_URI, baseContent);
    let formattedOutput = getFormattedText(server.onFormat(TEST_URI) as TextEdit[]);
    expect(formattedOutput).to.equal(expectedBaseOutput);

    // Step 2: Update document to add both directives
    mockDocuments.update(TEST_URI, contentWithBothDirectives);
    formattedOutput = getFormattedText(server.onFormat(TEST_URI) as TextEdit[]);
    expect(formattedOutput).to.equal(expectedWithBothDirectives);

    // Step 3: Update document back to base content (remove directives)
    mockDocuments.update(TEST_URI, baseContent);
    formattedOutput = getFormattedText(server.onFormat(TEST_URI) as TextEdit[]);
    expect(formattedOutput).to.equal(expectedBaseOutput);
  });

  it("should not insert system comments when only system-comments directive is present (no linear)", () => {
    const mockDocuments = new MockTextDocuments();

    const server = new AbcLspServer(mockDocuments as any, () => {});

    // Step 1: Open document with base content
    mockDocuments.update(TEST_URI, baseContent);
    let formattedOutput = getFormattedText(server.onFormat(TEST_URI) as TextEdit[]);
    expect(formattedOutput).to.equal(expectedBaseOutput);

    // Step 2: Add only system-comments directive (without linear)
    mockDocuments.update(TEST_URI, contentWithOnlySystemComments);
    formattedOutput = getFormattedText(server.onFormat(TEST_URI) as TextEdit[]);
    expect(formattedOutput).to.equal(expectedWithOnlySystemComments);

    // Step 3: Add both directives
    mockDocuments.update(TEST_URI, contentWithBothDirectives);
    formattedOutput = getFormattedText(server.onFormat(TEST_URI) as TextEdit[]);
    expect(formattedOutput).to.equal(expectedWithBothDirectives);

    // Step 4: Go back to base content
    mockDocuments.update(TEST_URI, baseContent);
    formattedOutput = getFormattedText(server.onFormat(TEST_URI) as TextEdit[]);
    expect(formattedOutput).to.equal(expectedBaseOutput);
  });
});
