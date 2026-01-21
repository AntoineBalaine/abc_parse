import * as assert from "assert";
import * as vscode from "vscode";
import { AbctEvalDocProvider, ABCT_EVAL_SCHEME } from "../../abct/AbctEvalDocProvider";

suite("AbctEvalDocProvider Tests", () => {
  let provider: AbctEvalDocProvider;

  setup(() => {
    provider = new AbctEvalDocProvider();
  });

  teardown(() => {
    provider.dispose();
  });

  suite("createDocument", () => {
    test("should create a document with correct URI scheme", () => {
      const sourceUri = vscode.Uri.file("/path/to/test.abct");
      const content = "X:1\nT:Test\nK:C\nCDEF|";
      const sourceExpr = "myVar";

      const docUri = provider.createDocument(sourceUri, content, sourceExpr);

      assert.strictEqual(docUri.scheme, ABCT_EVAL_SCHEME);
      assert.ok(docUri.path.endsWith(".abc"), "URI should have .abc extension");
    });

    test("should store document state correctly", () => {
      const sourceUri = vscode.Uri.file("/path/to/test.abct");
      const content = "X:1\nT:Test\nK:C\nCDEF|";
      const sourceExpr = "myVar";

      const docUri = provider.createDocument(sourceUri, content, sourceExpr);
      const state = provider.getDocument(docUri);

      assert.ok(state, "Document state should exist");
      assert.strictEqual(state.originalContent, content);
      assert.strictEqual(state.currentContent, content);
      assert.strictEqual(state.sourceUri, sourceUri.toString());
      assert.strictEqual(state.sourceExpr, sourceExpr);
      assert.ok(typeof state.evaluatedAt === "number");
    });

    test("should generate unique URIs for different timestamps", () => {
      const sourceUri = vscode.Uri.file("/path/to/test.abct");
      const content = "X:1\nK:C\nC|";

      const uri1 = provider.createDocument(sourceUri, content, "a");
      // Force a different timestamp
      const uri2 = provider.createDocument(sourceUri, content, "b");

      assert.notStrictEqual(uri1.toString(), uri2.toString());
    });
  });

  suite("readFile", () => {
    test("should return stored content", () => {
      const sourceUri = vscode.Uri.file("/path/to/test.abct");
      const content = "X:1\nT:Test\nK:C\nCDEF|";
      const docUri = provider.createDocument(sourceUri, content, "expr");

      const result = provider.readFile(docUri);

      assert.strictEqual(Buffer.from(result).toString("utf8"), content);
    });

    test("should throw FileNotFound for unknown URI", () => {
      const unknownUri = vscode.Uri.parse(`${ABCT_EVAL_SCHEME}:/unknown/path.abc`);

      assert.throws(() => provider.readFile(unknownUri), (err: vscode.FileSystemError) => {
        return err.code === "FileNotFound";
      });
    });
  });

  suite("writeFile", () => {
    test("should update current content", () => {
      const sourceUri = vscode.Uri.file("/path/to/test.abct");
      const originalContent = "X:1\nK:C\nC|";
      const newContent = "X:1\nK:C\nCDEF|";
      const docUri = provider.createDocument(sourceUri, originalContent, "expr");

      provider.writeFile(docUri, Buffer.from(newContent), { create: false, overwrite: true });

      const state = provider.getDocument(docUri);
      assert.strictEqual(state?.currentContent, newContent);
      assert.strictEqual(state?.originalContent, originalContent, "Original should be unchanged");
    });

    test("should throw FileNotFound for unknown URI", () => {
      const unknownUri = vscode.Uri.parse(`${ABCT_EVAL_SCHEME}:/unknown/path.abc`);

      assert.throws(
        () => provider.writeFile(unknownUri, Buffer.from("content"), { create: false, overwrite: true }),
        (err: vscode.FileSystemError) => {
          return err.code === "FileNotFound";
        }
      );
    });
  });

  suite("stat", () => {
    test("should return correct file type", () => {
      const sourceUri = vscode.Uri.file("/path/to/test.abct");
      const content = "X:1\nK:C\nC|";
      const docUri = provider.createDocument(sourceUri, content, "expr");

      const stat = provider.stat(docUri);

      assert.strictEqual(stat.type, vscode.FileType.File);
    });

    test("should return correct size", () => {
      const sourceUri = vscode.Uri.file("/path/to/test.abct");
      const content = "X:1\nK:C\nC|";
      const docUri = provider.createDocument(sourceUri, content, "expr");

      const stat = provider.stat(docUri);

      assert.strictEqual(stat.size, Buffer.byteLength(content, "utf8"));
    });

    test("should throw FileNotFound for unknown URI", () => {
      const unknownUri = vscode.Uri.parse(`${ABCT_EVAL_SCHEME}:/unknown/path.abc`);

      assert.throws(() => provider.stat(unknownUri), (err: vscode.FileSystemError) => {
        return err.code === "FileNotFound";
      });
    });
  });

  suite("isDocumentDirty", () => {
    test("should return false for unchanged document", () => {
      const sourceUri = vscode.Uri.file("/path/to/test.abct");
      const content = "X:1\nK:C\nC|";
      const docUri = provider.createDocument(sourceUri, content, "expr");

      assert.strictEqual(provider.isDocumentDirty(docUri), false);
    });

    test("should return true after writeFile", () => {
      const sourceUri = vscode.Uri.file("/path/to/test.abct");
      const content = "X:1\nK:C\nC|";
      const docUri = provider.createDocument(sourceUri, content, "expr");

      provider.writeFile(docUri, Buffer.from("X:1\nK:C\nCDEF|"), { create: false, overwrite: true });

      assert.strictEqual(provider.isDocumentDirty(docUri), true);
    });

    test("should return false for unknown URI", () => {
      const unknownUri = vscode.Uri.parse(`${ABCT_EVAL_SCHEME}:/unknown/path.abc`);

      assert.strictEqual(provider.isDocumentDirty(unknownUri), false);
    });
  });

  suite("updateDocument", () => {
    test("should update both original and current content", () => {
      const sourceUri = vscode.Uri.file("/path/to/test.abct");
      const originalContent = "X:1\nK:C\nC|";
      const docUri = provider.createDocument(sourceUri, originalContent, "expr");

      const newContent = "X:1\nK:C\nCDEFG|";
      provider.updateDocument(docUri, newContent);

      const state = provider.getDocument(docUri);
      assert.strictEqual(state?.originalContent, newContent);
      assert.strictEqual(state?.currentContent, newContent);
    });
  });

  suite("markAsSaved", () => {
    test("should update original to match current", () => {
      const sourceUri = vscode.Uri.file("/path/to/test.abct");
      const content = "X:1\nK:C\nC|";
      const docUri = provider.createDocument(sourceUri, content, "expr");

      const newContent = "X:1\nK:C\nCDEF|";
      provider.writeFile(docUri, Buffer.from(newContent), { create: false, overwrite: true });
      assert.strictEqual(provider.isDocumentDirty(docUri), true);

      provider.markAsSaved(docUri);

      assert.strictEqual(provider.isDocumentDirty(docUri), false);
      const state = provider.getDocument(docUri);
      assert.strictEqual(state?.originalContent, newContent);
    });
  });

  suite("getSourceUri", () => {
    test("should return the source URI", () => {
      const sourceUri = vscode.Uri.file("/path/to/test.abct");
      const docUri = provider.createDocument(sourceUri, "content", "expr");

      const result = provider.getSourceUri(docUri);

      assert.strictEqual(result?.toString(), sourceUri.toString());
    });

    test("should return undefined for unknown URI", () => {
      const unknownUri = vscode.Uri.parse(`${ABCT_EVAL_SCHEME}:/unknown/path.abc`);

      assert.strictEqual(provider.getSourceUri(unknownUri), undefined);
    });
  });

  suite("disposeDocument", () => {
    test("should remove document from storage", () => {
      const sourceUri = vscode.Uri.file("/path/to/test.abct");
      const docUri = provider.createDocument(sourceUri, "content", "expr");

      provider.disposeDocument(docUri);

      assert.strictEqual(provider.getDocument(docUri), undefined);
    });
  });

  suite("onDidChangeFile events", () => {
    test("should fire event on writeFile", (done) => {
      const sourceUri = vscode.Uri.file("/path/to/test.abct");
      const docUri = provider.createDocument(sourceUri, "original", "expr");

      const subscription = provider.onDidChangeFile((events) => {
        subscription.dispose();
        assert.strictEqual(events.length, 1);
        assert.strictEqual(events[0].type, vscode.FileChangeType.Changed);
        assert.strictEqual(events[0].uri.toString(), docUri.toString());
        done();
      });

      provider.writeFile(docUri, Buffer.from("new content"), { create: false, overwrite: true });
    });

    test("should fire event on updateDocument", (done) => {
      const sourceUri = vscode.Uri.file("/path/to/test.abct");
      const docUri = provider.createDocument(sourceUri, "original", "expr");

      const subscription = provider.onDidChangeFile((events) => {
        subscription.dispose();
        assert.strictEqual(events.length, 1);
        assert.strictEqual(events[0].type, vscode.FileChangeType.Changed);
        done();
      });

      provider.updateDocument(docUri, "updated content");
    });
  });

  suite("URI encoding", () => {
    test("should handle URIs with special characters", () => {
      const sourceUri = vscode.Uri.file("/path/to/file with spaces & symbols!.abct");
      const docUri = provider.createDocument(sourceUri, "content", "expr");
      const retrieved = provider.getSourceUri(docUri);
      assert.strictEqual(retrieved?.toString(), sourceUri.toString());
    });
  });
});
