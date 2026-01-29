import { expect } from "chai";
import { describe, it, beforeEach, afterEach } from "mocha";
import * as net from "net";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { SocketHandler, computeSocketPath, ERROR_CODES } from "./socketHandler";
import { AbcDocument } from "./AbcDocument";
import { AbcxDocument } from "./AbcxDocument";
import { fromAst, CSNode } from "editor";
import { Scanner, parse, ABCContext, File_structure, ScannerAbcx, parseAbcx } from "abc-parser";
import { TextDocument } from "vscode-languageserver-textdocument";

// Helper to parse ABC content
function parseAbc(source: string): File_structure {
  const ctx = new ABCContext();
  const tokens = Scanner(source, ctx);
  return parse(tokens, ctx);
}

// Create a mock AbcDocument with a real instance
function createMockAbcDocument(source: string): AbcDocument {
  const textDoc = TextDocument.create("file:///test.abc", "abc", 1, source);
  const doc = new AbcDocument(textDoc);
  doc.analyze();
  return doc;
}

// Create a mock AbcxDocument with a real instance
function createMockAbcxDocument(): AbcxDocument {
  const source = "X:1\nK:C\nC D E F|\n";
  const textDoc = TextDocument.create("file:///test.abcx", "abcx", 1, source);
  const doc = new AbcxDocument(textDoc);
  doc.analyze();
  return doc;
}

describe("Socket Handler", () => {
  let socketPath: string;
  let handler: SocketHandler;
  let documents: Map<string, AbcDocument | AbcxDocument>;
  let csTreeCache: WeakMap<File_structure, CSNode>;

  function getCsTree(ast: File_structure): CSNode {
    let tree = csTreeCache.get(ast);
    if (!tree) {
      tree = fromAst(ast);
      csTreeCache.set(ast, tree);
    }
    return tree;
  }

  beforeEach(() => {
    // Create a unique socket path for each test
    socketPath = path.join(os.tmpdir(), `abc-lsp-test-${Date.now()}-${Math.random().toString(36).slice(2)}.sock`);
    documents = new Map();
    csTreeCache = new WeakMap();

    handler = new SocketHandler(
      socketPath,
      (uri) => documents.get(uri),
      getCsTree
    );
  });

  afterEach(() => {
    handler.stop();
    // Clean up socket file if it exists
    if (fs.existsSync(socketPath)) {
      fs.unlinkSync(socketPath);
    }
  });

  describe("computeSocketPath", () => {
    it("uses XDG_RUNTIME_DIR when set", () => {
      const originalXdg = process.env.XDG_RUNTIME_DIR;
      process.env.XDG_RUNTIME_DIR = "/run/user/1000";
      try {
        const result = computeSocketPath();
        expect(result).to.equal("/run/user/1000/abc-lsp.sock");
      } finally {
        if (originalXdg !== undefined) {
          process.env.XDG_RUNTIME_DIR = originalXdg;
        } else {
          delete process.env.XDG_RUNTIME_DIR;
        }
      }
    });

    it("falls back to /tmp/abc-lsp-$USER when XDG_RUNTIME_DIR is not set", () => {
      const originalXdg = process.env.XDG_RUNTIME_DIR;
      delete process.env.XDG_RUNTIME_DIR;
      try {
        const result = computeSocketPath();
        const user = process.env.USER || process.env.USERNAME || "unknown";
        expect(result).to.equal(`/tmp/abc-lsp-${user}/lsp.sock`);
      } finally {
        if (originalXdg !== undefined) {
          process.env.XDG_RUNTIME_DIR = originalXdg;
        }
      }
    });
  });

  describe("start()", () => {
    it("creates socket and returns true when path is available", async () => {
      const isOwner = await handler.start();
      expect(isOwner).to.be.true;
      expect(fs.existsSync(socketPath)).to.be.true;
    });

    it("returns false when another server owns the socket", async () => {
      // Start first handler
      const isOwner1 = await handler.start();
      expect(isOwner1).to.be.true;

      // Try to start second handler on same path
      const handler2 = new SocketHandler(
        socketPath,
        (uri) => documents.get(uri),
        getCsTree
      );

      const isOwner2 = await handler2.start();
      expect(isOwner2).to.be.false;

      handler2.stop();
    });
  });

  describe("request handling", () => {
    beforeEach(async () => {
      await handler.start();
    });

    function sendRequest(request: object): Promise<object> {
      return new Promise((resolve, reject) => {
        const client = net.createConnection(socketPath, () => {
          client.write(JSON.stringify(request) + "\n");
        });

        let data = "";
        client.on("data", (chunk) => {
          data += chunk.toString();
          if (data.includes("\n")) {
            client.destroy();
            try {
              resolve(JSON.parse(data.trim()));
            } catch {
              reject(new Error("Invalid JSON response"));
            }
          }
        });

        client.on("error", reject);
        setTimeout(() => {
          client.destroy();
          reject(new Error("Timeout"));
        }, 5000);
      });
    }

    it("returns error for invalid JSON", async () => {
      const response = await new Promise<object>((resolve, reject) => {
        const client = net.createConnection(socketPath, () => {
          client.write("not valid json\n");
        });

        let data = "";
        client.on("data", (chunk) => {
          data += chunk.toString();
          if (data.includes("\n")) {
            client.destroy();
            resolve(JSON.parse(data.trim()));
          }
        });
        client.on("error", reject);
      });

      expect(response).to.have.property("error");
      expect((response as any).error.code).to.equal(ERROR_CODES.INVALID_REQUEST);
    });

    it("returns error for missing method", async () => {
      const response = await sendRequest({ id: 1 });
      expect(response).to.have.property("error");
      expect((response as any).error.code).to.equal(ERROR_CODES.INVALID_REQUEST);
    });

    it("returns error for unknown method", async () => {
      const response = await sendRequest({
        id: 1,
        method: "unknownMethod",
        params: {},
      });
      expect(response).to.have.property("error");
      expect((response as any).error.code).to.equal(ERROR_CODES.UNKNOWN_METHOD);
    });

    it("returns error for missing URI", async () => {
      const response = await sendRequest({
        id: 1,
        method: "abct2.applySelector",
        params: {
          selector: "selectChords",
        },
      });
      expect(response).to.have.property("error");
      expect((response as any).error.code).to.equal(ERROR_CODES.INVALID_PARAMS);
    });

    it("returns error for invalid URI format", async () => {
      const response = await sendRequest({
        id: 1,
        method: "abct2.applySelector",
        params: {
          uri: "http://example.com/file.abc",
          selector: "selectChords",
        },
      });
      expect(response).to.have.property("error");
      expect((response as any).error.code).to.equal(ERROR_CODES.INVALID_PARAMS);
    });

    it("returns error for path traversal in URI", async () => {
      const response = await sendRequest({
        id: 1,
        method: "abct2.applySelector",
        params: {
          uri: "file:///path/../etc/passwd",
          selector: "selectChords",
        },
      });
      expect(response).to.have.property("error");
      expect((response as any).error.code).to.equal(ERROR_CODES.INVALID_PARAMS);
    });

    it("returns error for unknown selector", async () => {
      const response = await sendRequest({
        id: 1,
        method: "abct2.applySelector",
        params: {
          uri: "file:///path/to/file.abc",
          selector: "nonExistentSelector",
        },
      });
      expect(response).to.have.property("error");
      expect((response as any).error.code).to.equal(ERROR_CODES.INVALID_PARAMS);
    });

    it("returns error when document is not found", async () => {
      const response = await sendRequest({
        id: 1,
        method: "abct2.applySelector",
        params: {
          uri: "file:///path/to/file.abc",
          selector: "selectChords",
        },
      });
      expect(response).to.have.property("error");
      expect((response as any).error.code).to.equal(ERROR_CODES.DOCUMENT_NOT_FOUND);
    });

    it("returns error for ABCx files", async () => {
      documents.set("file:///path/to/file.abcx", createMockAbcxDocument());

      const response = await sendRequest({
        id: 1,
        method: "abct2.applySelector",
        params: {
          uri: "file:///path/to/file.abcx",
          selector: "selectChords",
        },
      });
      expect(response).to.have.property("error");
      expect((response as any).error.code).to.equal(ERROR_CODES.FILE_TYPE_NOT_SUPPORTED);
    });

    it("returns ranges for valid selector request", async () => {
      const source = "X:1\nK:C\n[CEG]2 C2 D2|\n";
      documents.set("file:///path/to/file.abc", createMockAbcDocument(source));

      const response = await sendRequest({
        id: 1,
        method: "abct2.applySelector",
        params: {
          uri: "file:///path/to/file.abc",
          selector: "selectChords",
          cursorNodeIds: [],
        },
      });

      expect(response).to.have.property("result");
      const result = (response as any).result;
      expect(result.ranges).to.have.length(1);
      expect(result.cursorNodeIds).to.have.length(1);
    });

    it("supports scope filtering", async () => {
      const source = "X:1\nK:C\n[CEG] [FAC]|\n";
      documents.set("file:///path/to/file.abc", createMockAbcDocument(source));

      // First get all chords
      const fullResponse = await sendRequest({
        id: 1,
        method: "abct2.applySelector",
        params: {
          uri: "file:///path/to/file.abc",
          selector: "selectChords",
          cursorNodeIds: [],
        },
      });
      expect((fullResponse as any).result.ranges).to.have.length(2);

      // Now scope to only the first chord's range
      const scopedResponse = await sendRequest({
        id: 2,
        method: "abct2.applySelector",
        params: {
          uri: "file:///path/to/file.abc",
          selector: "selectChords",
          cursorNodeIds: [],
          scope: [{ start: { line: 2, character: 0 }, end: { line: 2, character: 5 } }],
        },
      });
      expect((scopedResponse as any).result.ranges).to.have.length(1);
    });

    it("supports narrowing with cursorNodeIds", async () => {
      const source = "X:1\nK:C\n[CEG]2 C2 D2|\n";
      documents.set("file:///path/to/file.abc", createMockAbcDocument(source));

      // First select chords
      const chordsResponse = await sendRequest({
        id: 1,
        method: "abct2.applySelector",
        params: {
          uri: "file:///path/to/file.abc",
          selector: "selectChords",
          cursorNodeIds: [],
        },
      });

      const chordIds = (chordsResponse as any).result.cursorNodeIds;
      expect(chordIds).to.have.length(1);

      // Now narrow to notes within those chords
      const notesResponse = await sendRequest({
        id: 2,
        method: "abct2.applySelector",
        params: {
          uri: "file:///path/to/file.abc",
          selector: "selectNotes",
          cursorNodeIds: chordIds,
        },
      });

      // Should get 3 notes (C, E, G) from within the chord
      expect((notesResponse as any).result.ranges).to.have.length(3);
    });

    it("returns id from request in response", async () => {
      const source = "X:1\nK:C\nC2|\n";
      documents.set("file:///path/to/file.abc", createMockAbcDocument(source));

      const response = await sendRequest({
        id: 42,
        method: "abct2.applySelector",
        params: {
          uri: "file:///path/to/file.abc",
          selector: "selectNotes",
          cursorNodeIds: [],
        },
      });

      expect((response as any).id).to.equal(42);
    });
  });
});
