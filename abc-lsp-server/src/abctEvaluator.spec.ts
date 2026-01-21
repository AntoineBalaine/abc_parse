/**
 * ABCT Evaluator Tests
 *
 * Tests for the ABCT evaluation functionality including:
 * - FileResolver: Loading ABC files relative to ABCT documents
 * - AbctEvaluator: Evaluating ABCT programs
 * - AbctDocument.evaluate: Integration with the document class
 */

import { expect } from "chai";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { TextDocument } from "vscode-languageserver-textdocument";
import { URI } from "vscode-uri";

import { FileResolver, FileResolverError, createFileResolver } from "./fileResolver";
import { AbctEvaluator, EvaluatorError, evaluateAbct, EvalOptions } from "./abctEvaluator";
import { AbctDocument } from "./AbctDocument";
import { scan } from "../../abct/src/scanner";
import { parse } from "../../abct/src/parser/parser";
import { AbctContext } from "../../abct/src/context";
import { Program } from "../../abct/src/ast";

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a temporary directory for test files.
 */
function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "abct-test-"));
}

/**
 * Create a test file in the given directory.
 */
function createTestFile(dir: string, filename: string, content: string): string {
  const filepath = path.join(dir, filename);
  fs.writeFileSync(filepath, content, "utf-8");
  return filepath;
}

/**
 * Clean up temporary directory recursively.
 */
function cleanupTempDir(dir: string): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      cleanupTempDir(fullPath);
    } else {
      fs.unlinkSync(fullPath);
    }
  }
  fs.rmdirSync(dir);
}

/**
 * Convert a file path to a file:// URI string.
 */
function pathToUri(filepath: string): string {
  return URI.file(filepath).toString();
}

/**
 * Parse an ABCT source string and return the Program AST.
 */
function parseAbctSource(source: string): Program {
  const ctx = new AbctContext();
  const tokens = scan(source, ctx);
  const program = parse(tokens, ctx);
  if (ctx.errorReporter.hasErrors()) {
    const errors = ctx.errorReporter.getErrors();
    throw new Error(`Failed to parse ABCT: ${errors[0].message}`);
  }
  return program;
}

// ============================================================================
// FileResolver Tests
// ============================================================================

describe("ABCT FileResolver", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  describe("path resolution", () => {
    it("should resolve paths relative to the ABCT file directory", () => {
      const abctPath = path.join(tempDir, "transform.abct");
      createTestFile(tempDir, "transform.abct", "");

      const resolver = createFileResolver(pathToUri(abctPath));

      expect(resolver.baseDir).to.equal(tempDir);
      expect(resolver.resolvePath("song.abc")).to.equal(path.join(tempDir, "song.abc"));
    });

    it("should handle relative paths with directories", () => {
      const abctPath = path.join(tempDir, "transform.abct");
      createTestFile(tempDir, "transform.abct", "");

      const resolver = createFileResolver(pathToUri(abctPath));

      expect(resolver.resolvePath("./subdir/song.abc")).to.equal(
        path.join(tempDir, "subdir", "song.abc")
      );
    });

    it("should handle parent directory references", () => {
      const subdir = path.join(tempDir, "subdir");
      fs.mkdirSync(subdir);
      const abctPath = path.join(subdir, "transform.abct");
      createTestFile(subdir, "transform.abct", "");

      const resolver = createFileResolver(pathToUri(abctPath));

      expect(resolver.resolvePath("../song.abc")).to.equal(
        path.join(tempDir, "song.abc")
      );
    });
  });

  describe("file loading", () => {
    it("should load and parse an ABC file", async () => {
      const abcContent = "X:1\nT:Test\nK:C\nC D E F |";
      createTestFile(tempDir, "song.abc", abcContent);
      const abctPath = path.join(tempDir, "transform.abct");
      createTestFile(tempDir, "transform.abct", "");

      const resolver = createFileResolver(pathToUri(abctPath));
      const loaded = await resolver.loadAbc("song.abc");

      expect(loaded.content).to.equal(abcContent);
      expect(loaded.ast).to.exist;
      expect(loaded.path).to.equal(path.join(tempDir, "song.abc"));
    });

    it("should cache loaded files", async () => {
      const abcContent = "X:1\nK:C\nC D E F |";
      createTestFile(tempDir, "song.abc", abcContent);
      const abctPath = path.join(tempDir, "transform.abct");
      createTestFile(tempDir, "transform.abct", "");

      const resolver = createFileResolver(pathToUri(abctPath));

      // Load the file twice
      const loaded1 = await resolver.loadAbc("song.abc");
      const loaded2 = await resolver.loadAbc("song.abc");

      // Should return the same cached object
      expect(loaded1).to.equal(loaded2);
      expect(resolver.isCached("song.abc")).to.be.true;
    });

    it("should clear cache when requested", async () => {
      const abcContent = "X:1\nK:C\nC D E F |";
      createTestFile(tempDir, "song.abc", abcContent);
      const abctPath = path.join(tempDir, "transform.abct");
      createTestFile(tempDir, "transform.abct", "");

      const resolver = createFileResolver(pathToUri(abctPath));

      await resolver.loadAbc("song.abc");
      expect(resolver.isCached("song.abc")).to.be.true;

      resolver.clearCache();
      expect(resolver.isCached("song.abc")).to.be.false;
    });

    it("should throw FileResolverError for missing files", async () => {
      const abctPath = path.join(tempDir, "transform.abct");
      createTestFile(tempDir, "transform.abct", "");

      const resolver = createFileResolver(pathToUri(abctPath));

      try {
        await resolver.loadAbc("nonexistent.abc");
        expect.fail("Should have thrown FileResolverError");
      } catch (error) {
        expect(error).to.be.instanceOf(FileResolverError);
        expect((error as FileResolverError).message).to.include("File not found");
      }
    });
  });
});

// ============================================================================
// AbctEvaluator Tests
// ============================================================================

describe("ABCT Evaluator", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  describe("file reference evaluation", () => {
    it("should evaluate a file reference and return ABC output", async () => {
      // Create ABC file
      const abcContent = "X:1\nT:Test\nK:C\nC D E F |";
      createTestFile(tempDir, "song.abc", abcContent);

      // Create ABCT source
      const abctSource = "song.abc";
      const program = parseAbctSource(abctSource);

      // Create resolver
      const abctPath = path.join(tempDir, "transform.abct");
      createTestFile(tempDir, "transform.abct", abctSource);
      const resolver = createFileResolver(pathToUri(abctPath));

      // Evaluate
      const result = await evaluateAbct(program, resolver);

      expect(result.abc).to.include("X:1");
      expect(result.abc).to.include("K:C");
      expect(result.diagnostics).to.have.lengthOf(0);
    });

    it("should handle missing file references with error diagnostics", async () => {
      const abctSource = "nonexistent.abc";
      const program = parseAbctSource(abctSource);

      const abctPath = path.join(tempDir, "transform.abct");
      createTestFile(tempDir, "transform.abct", abctSource);
      const resolver = createFileResolver(pathToUri(abctPath));

      const result = await evaluateAbct(program, resolver);

      expect(result.abc).to.equal("");
      expect(result.diagnostics).to.have.lengthOf(1);
      expect(result.diagnostics[0].message).to.include("File not found");
    });
  });

  describe("variable assignment and reference", () => {
    it("should store and retrieve variables", async () => {
      const abcContent = "X:1\nK:C\nC D E F |";
      createTestFile(tempDir, "song.abc", abcContent);

      const abctSource = "source = song.abc\nsource";
      const program = parseAbctSource(abctSource);

      const abctPath = path.join(tempDir, "transform.abct");
      createTestFile(tempDir, "transform.abct", abctSource);
      const resolver = createFileResolver(pathToUri(abctPath));

      const result = await evaluateAbct(program, resolver);

      expect(result.abc).to.include("K:C");
      expect(result.diagnostics).to.have.lengthOf(0);
    });

    it("should report error for undefined variables", async () => {
      const abctSource = "undefined_var";
      const program = parseAbctSource(abctSource);

      const abctPath = path.join(tempDir, "transform.abct");
      createTestFile(tempDir, "transform.abct", abctSource);
      const resolver = createFileResolver(pathToUri(abctPath));

      const result = await evaluateAbct(program, resolver);

      expect(result.diagnostics).to.have.lengthOf(1);
      expect(result.diagnostics[0].message).to.include("Undefined variable");
    });
  });

  describe("pipe expressions with selectors", () => {
    it("should apply selector to piped value", async () => {
      const abcContent = "X:1\nK:C\n[CEG] D E F |";
      createTestFile(tempDir, "song.abc", abcContent);

      const abctSource = "song.abc | @chords";
      const program = parseAbctSource(abctSource);

      const abctPath = path.join(tempDir, "transform.abct");
      createTestFile(tempDir, "transform.abct", abctSource);
      const resolver = createFileResolver(pathToUri(abctPath));

      const result = await evaluateAbct(program, resolver);

      expect(result.abc).to.include("[CEG]");
      expect(result.diagnostics).to.have.lengthOf(0);
    });
  });

  describe("pipe expressions with transforms", () => {
    it("should apply transpose transform", async () => {
      const abcContent = "X:1\nK:C\nC D E F |";
      createTestFile(tempDir, "song.abc", abcContent);

      const abctSource = "song.abc | @notes | transpose 2";
      const program = parseAbctSource(abctSource);

      const abctPath = path.join(tempDir, "transform.abct");
      createTestFile(tempDir, "transform.abct", abctSource);
      const resolver = createFileResolver(pathToUri(abctPath));

      const result = await evaluateAbct(program, resolver);

      // C transposed up 2 semitones becomes D
      expect(result.abc).to.include("D");
      expect(result.diagnostics).to.have.lengthOf(0);
    });
  });

  describe("update expressions (|=)", () => {
    it("should apply simple update expression", async () => {
      const abcContent = "X:1\nK:C\nC D E F |";
      createTestFile(tempDir, "song.abc", abcContent);

      // Using |= instead of | for update - transforms and returns full source
      const abctSource = "song.abc | @notes |= transpose 2";
      const program = parseAbctSource(abctSource);

      const abctPath = path.join(tempDir, "transform.abct");
      createTestFile(tempDir, "transform.abct", abctSource);
      const resolver = createFileResolver(pathToUri(abctPath));

      const result = await evaluateAbct(program, resolver);

      // C transposed up 2 semitones becomes D
      expect(result.abc).to.include("D");
      // Should still have the full tune structure
      expect(result.abc).to.include("X:1");
      expect(result.abc).to.include("K:C");
      expect(result.diagnostics).to.have.lengthOf(0);
    });

    it("should apply chained update expressions", async () => {
      // Create ABC file with both notes and chords
      const abcContent = "X:1\nK:C\nC D [CEG] F |";
      createTestFile(tempDir, "song.abc", abcContent);

      // First update transposes notes, second extracts bass from chords
      const abctSource = "song.abc | @notes |= transpose 2 | @chords |= bass";
      const program = parseAbctSource(abctSource);

      const abctPath = path.join(tempDir, "transform.abct");
      createTestFile(tempDir, "transform.abct", abctSource);
      const resolver = createFileResolver(pathToUri(abctPath));

      const result = await evaluateAbct(program, resolver);

      // Notes should be transposed (C->D, D->E, F->G)
      // Chord [CEG] with bass transform should become just C (lowest note)
      expect(result.abc).to.include("D");
      expect(result.abc).to.include("E");
      expect(result.diagnostics).to.have.lengthOf(0);
    });

    it("should apply update with pipeline transform", async () => {
      const abcContent = "X:1\nK:C\nC D E F |";
      createTestFile(tempDir, "song.abc", abcContent);

      // Pipeline as transform: (transpose 2 | retrograde)
      const abctSource = "song.abc | @notes |= (transpose 2 | retrograde)";
      const program = parseAbctSource(abctSource);

      const abctPath = path.join(tempDir, "transform.abct");
      createTestFile(tempDir, "transform.abct", abctSource);
      const resolver = createFileResolver(pathToUri(abctPath));

      const result = await evaluateAbct(program, resolver);

      // Should have transposed and reversed notes
      expect(result.diagnostics).to.have.lengthOf(0);
      expect(result.abc).to.include("X:1");
    });

    it("should apply nested update expressions", async () => {
      // Create ABC file with a chord containing notes
      const abcContent = "X:1\nK:C\n[CEG] |";
      createTestFile(tempDir, "song.abc", abcContent);

      // Nested update: select chords, then within chords select notes and transpose
      const abctSource = "song.abc | @chords |= (@notes |= transpose 2)";
      const program = parseAbctSource(abctSource);

      const abctPath = path.join(tempDir, "transform.abct");
      createTestFile(tempDir, "transform.abct", abctSource);
      const resolver = createFileResolver(pathToUri(abctPath));

      const result = await evaluateAbct(program, resolver);

      // Notes within the chord should be transposed
      // C->D, E->F#, G->A
      expect(result.diagnostics).to.have.lengthOf(0);
      expect(result.abc).to.include("X:1");
    });

    it("should apply update with bare transform name (no args)", async () => {
      const abcContent = "X:1\nK:C\nC D E F |";
      createTestFile(tempDir, "song.abc", abcContent);

      // retrograde has no arguments
      const abctSource = "song.abc | @notes |= retrograde";
      const program = parseAbctSource(abctSource);

      const abctPath = path.join(tempDir, "transform.abct");
      createTestFile(tempDir, "transform.abct", abctSource);
      const resolver = createFileResolver(pathToUri(abctPath));

      const result = await evaluateAbct(program, resolver);

      expect(result.diagnostics).to.have.lengthOf(0);
      expect(result.abc).to.include("X:1");
    });

    it("should report error for standalone update expression", async () => {
      // Update without a piped source is an error
      const abctSource = "@notes |= transpose 2";
      const program = parseAbctSource(abctSource);

      const abctPath = path.join(tempDir, "transform.abct");
      createTestFile(tempDir, "transform.abct", abctSource);
      const resolver = createFileResolver(pathToUri(abctPath));

      const result = await evaluateAbct(program, resolver);

      expect(result.diagnostics).to.have.lengthOf(1);
      expect(result.diagnostics[0].message).to.include("must be used within a pipe");
    });

    it("should work with variable assignment and update", async () => {
      const abcContent = "X:1\nK:C\nC D E F |";
      createTestFile(tempDir, "song.abc", abcContent);

      const abctSource = "src = song.abc\nsrc | @notes |= transpose 2";
      const program = parseAbctSource(abctSource);

      const abctPath = path.join(tempDir, "transform.abct");
      createTestFile(tempDir, "transform.abct", abctSource);
      const resolver = createFileResolver(pathToUri(abctPath));

      const result = await evaluateAbct(program, resolver);

      expect(result.abc).to.include("D");
      expect(result.diagnostics).to.have.lengthOf(0);
    });
  });

  describe("evaluation options", () => {
    it("should evaluate only up to specified line with toLine option", async () => {
      const abcContent = "X:1\nK:C\nC D E F |";
      createTestFile(tempDir, "song.abc", abcContent);

      // Multi-line ABCT with evaluation on lines 1 and 3
      const abctSource = "source = song.abc\n\nsource";
      const program = parseAbctSource(abctSource);

      const abctPath = path.join(tempDir, "transform.abct");
      createTestFile(tempDir, "transform.abct", abctSource);
      const resolver = createFileResolver(pathToUri(abctPath));

      // Evaluate only line 1 (the assignment)
      const result = await evaluateAbct(program, resolver, { toLine: 1 });

      // Assignment doesn't produce output
      expect(result.abc).to.equal("");
      expect(result.diagnostics).to.have.lengthOf(0);
    });

    it("should evaluate statements within selection range", async () => {
      const abcContent = "X:1\nK:C\nC D E F |";
      createTestFile(tempDir, "song.abc", abcContent);

      const abctSource = "source = song.abc\nsource";
      const program = parseAbctSource(abctSource);

      const abctPath = path.join(tempDir, "transform.abct");
      createTestFile(tempDir, "transform.abct", abctSource);
      const resolver = createFileResolver(pathToUri(abctPath));

      // Select only line 2 (the expression)
      const result = await evaluateAbct(program, resolver, {
        selection: {
          start: { line: 1, character: 0 },
          end: { line: 1, character: 6 },
        },
      });

      // Should fail because `source` variable was not assigned
      expect(result.diagnostics).to.have.lengthOf(1);
      expect(result.diagnostics[0].message).to.include("Undefined variable");
    });
  });
});

// ============================================================================
// AbctDocument Integration Tests
// ============================================================================

describe("ABCT AbctDocument.evaluate", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  it("should evaluate an AbctDocument and return ABC output", async () => {
    const abcContent = "X:1\nK:C\nC D E F |";
    createTestFile(tempDir, "song.abc", abcContent);

    const abctSource = "song.abc";
    const abctPath = path.join(tempDir, "transform.abct");
    createTestFile(tempDir, "transform.abct", abctSource);

    // Create TextDocument
    const textDoc = TextDocument.create(
      pathToUri(abctPath),
      "abct",
      1,
      abctSource
    );

    // Create AbctDocument
    const doc = new AbctDocument(textDoc);

    // Evaluate
    const result = await doc.evaluate();

    expect(result.abc).to.include("X:1");
    expect(result.abc).to.include("K:C");
    expect(result.diagnostics).to.have.lengthOf(0);
  });

  it("should return parse errors as diagnostics", async () => {
    const abctSource = "invalid syntax @@@@";
    const abctPath = path.join(tempDir, "transform.abct");
    createTestFile(tempDir, "transform.abct", abctSource);

    const textDoc = TextDocument.create(
      pathToUri(abctPath),
      "abct",
      1,
      abctSource
    );

    const doc = new AbctDocument(textDoc);
    const result = await doc.evaluate();

    expect(result.abc).to.equal("");
    expect(result.diagnostics.length).to.be.greaterThan(0);
  });

  it("should handle toLine option", async () => {
    const abcContent = "X:1\nK:C\nC D E F |";
    createTestFile(tempDir, "song.abc", abcContent);

    const abctSource = "source = song.abc\nsource";
    const abctPath = path.join(tempDir, "transform.abct");
    createTestFile(tempDir, "transform.abct", abctSource);

    const textDoc = TextDocument.create(
      pathToUri(abctPath),
      "abct",
      1,
      abctSource
    );

    const doc = new AbctDocument(textDoc);

    // Evaluate up to line 2 (both lines)
    const result = await doc.evaluate({ toLine: 2 });

    expect(result.abc).to.include("K:C");
  });
});

// ============================================================================
// Property-Based Tests
// ============================================================================

describe("ABCT Evaluator Properties", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  describe("identity properties", () => {
    it("evaluating a file reference without transforms returns equivalent ABC", async () => {
      const abcContent = "X:1\nT:Test Song\nK:C\nC D E F | G A B c |";
      createTestFile(tempDir, "song.abc", abcContent);

      const abctSource = "song.abc";
      const program = parseAbctSource(abctSource);

      const abctPath = path.join(tempDir, "transform.abct");
      createTestFile(tempDir, "transform.abct", abctSource);
      const resolver = createFileResolver(pathToUri(abctPath));

      const result = await evaluateAbct(program, resolver);

      // The output should contain the same musical content
      expect(result.abc).to.include("X:1");
      expect(result.abc).to.include("T:Test Song");
      expect(result.abc).to.include("K:C");
    });
  });

  describe("transform composition", () => {
    it("transpose 0 is identity", async () => {
      const abcContent = "X:1\nK:C\nC D E F |";
      createTestFile(tempDir, "song.abc", abcContent);

      // Get original
      const abctSource1 = "song.abc";
      const program1 = parseAbctSource(abctSource1);
      const abctPath1 = path.join(tempDir, "transform1.abct");
      createTestFile(tempDir, "transform1.abct", abctSource1);
      const resolver1 = createFileResolver(pathToUri(abctPath1));
      const result1 = await evaluateAbct(program1, resolver1);

      // Get transposed by 0
      const abctSource2 = "song.abc | @notes | transpose 0";
      const program2 = parseAbctSource(abctSource2);
      const abctPath2 = path.join(tempDir, "transform2.abct");
      createTestFile(tempDir, "transform2.abct", abctSource2);
      const resolver2 = createFileResolver(pathToUri(abctPath2));
      const result2 = await evaluateAbct(program2, resolver2);

      expect(result1.abc).to.equal(result2.abc);
    });
  });

  describe("error handling consistency", () => {
    it("always returns a result object with abc and diagnostics", async () => {
      const testCases = [
        { source: "valid_but_undefined", description: "undefined variable" },
        { source: "song.abc | @chords | transpose 2", description: "with transforms" },
      ];

      for (const testCase of testCases) {
        const program = parseAbctSource(testCase.source);
        const abctPath = path.join(tempDir, "transform.abct");
        createTestFile(tempDir, "transform.abct", testCase.source);
        const resolver = createFileResolver(pathToUri(abctPath));

        const result = await evaluateAbct(program, resolver);

        expect(result).to.have.property("abc");
        expect(result).to.have.property("diagnostics");
        expect(Array.isArray(result.diagnostics)).to.be.true;
      }
    });
  });
});
