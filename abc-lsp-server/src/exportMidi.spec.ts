import { expect } from "chai";
import { TextDocuments } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { AbcDocument } from "./AbcDocument";
import { AbcLspServer } from "./AbcLspServer";
import { AbcxDocument } from "./AbcxDocument";

function createMockDocuments(): TextDocuments<TextDocument> {
  // Because we only need the onDidChangeContent and onDidClose event hooks
  // for the AbcLspServer constructor, we provide a minimal mock.
  return {
    onDidChangeContent: () => {},
    onDidClose: () => {},
  } as unknown as TextDocuments<TextDocument>;
}

function createTextDocument(uri: string, content: string): TextDocument {
  return TextDocument.create(uri, "abc", 1, content);
}

describe("AbcLspServer.exportMidi", () => {
  it("returns base64-encoded MIDI bytes for a valid ABC document", () => {
    const server = new AbcLspServer(createMockDocuments(), () => {});
    const uri = "file:///test.abc";
    const textDoc = createTextDocument(uri, "X:1\nT:Test\nK:C\nCDEF|\n");
    const abcDoc = new AbcDocument(textDoc);
    abcDoc.analyze();
    server.abcDocuments.set(uri, abcDoc);

    const base64 = server.exportMidi(uri);
    const bytes = Buffer.from(base64, "base64");

    // MIDI files start with the magic bytes "MThd"
    expect(bytes[0]).to.equal(0x4d); // M
    expect(bytes[1]).to.equal(0x54); // T
    expect(bytes[2]).to.equal(0x68); // h
    expect(bytes[3]).to.equal(0x64); // d
  });

  it("throws for an ABCx document", () => {
    const server = new AbcLspServer(createMockDocuments(), () => {});
    const uri = "file:///test.abcx";
    const textDoc = createTextDocument(uri, "X:1\nT:Test\nK:C\nC Am | F G |\n");
    const abcxDoc = new AbcxDocument(textDoc);
    abcxDoc.analyze();
    server.abcDocuments.set(uri, abcxDoc);

    expect(() => server.exportMidi(uri)).to.throw("MIDI export is not supported for ABCx chord sheet files");
  });

  it("throws for an unknown document URI", () => {
    const server = new AbcLspServer(createMockDocuments(), () => {});
    expect(() => server.exportMidi("file:///nonexistent.abc")).to.throw("Document not found");
  });

  it("filters tunes by X: number when tuneNumbers is provided", () => {
    const server = new AbcLspServer(createMockDocuments(), () => {});
    const uri = "file:///multi.abc";
    const content = "X:1\nT:First\nK:C\nCDEF|\n\nX:2\nT:Second\nK:G\nGABc|\n";
    const textDoc = createTextDocument(uri, content);
    const abcDoc = new AbcDocument(textDoc);
    abcDoc.analyze();
    server.abcDocuments.set(uri, abcDoc);

    // Because different tunes have different keys and notes,
    // exporting tune 1 vs tune 2 should yield different MIDI bytes.
    const midi1 = server.exportMidi(uri, [1]);
    const midi2 = server.exportMidi(uri, [2]);

    expect(midi1).to.not.equal(midi2);

    // Both should decode to valid MIDI
    for (const b64 of [midi1, midi2]) {
      const bytes = Buffer.from(b64, "base64");
      expect(bytes[0]).to.equal(0x4d);
      expect(bytes[1]).to.equal(0x54);
      expect(bytes[2]).to.equal(0x68);
      expect(bytes[3]).to.equal(0x64);
    }
  });
});
