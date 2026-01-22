/**
 * Tests for parsing example ABC scores
 *
 * These tests verify that all example scores in the example_scores
 * directory parse successfully and produce consistent results.
 *
 * Test categories:
 * 1. TypeScript parser self-comparison - always runs
 * 2. TreeSitter vs TypeScript comparison - only runs when TreeSitter is built
 *
 * To enable TreeSitter comparison tests:
 *   cd tree-sitter-abc && npm run build
 */

import chai, { expect } from "chai";
import { readdirSync, readFileSync, statSync } from "fs";
import { join, basename } from "path";
import {
  parseWithTypeScript,
  compareBothParsers,
  isTreeSitterAvailable,
  assertSelfComparisonEqual,
  assertNonEmptyParse,
  countTreeNodes,
  collectNodeTypes,
} from "./helpers";
import { formatCompareResult } from "../../comparison";

// Path to example_scores directory
const EXAMPLE_SCORES_DIR = join(__dirname, "../../../example_scores");

/**
 * Recursively find all .abc files in a directory
 */
function findAbcFiles(dir: string): string[] {
  const files: string[] = [];
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          files.push(...findAbcFiles(fullPath));
        } else if (entry.endsWith(".abc")) {
          files.push(fullPath);
        }
      } catch {
        // Skip files we can't stat
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }
  return files;
}

// Find all example ABC files
const abcFiles = findAbcFiles(EXAMPLE_SCORES_DIR);

describe("Example scores: self-comparison", () => {
  if (abcFiles.length === 0) {
    it.skip("no example scores found", () => {});
    return;
  }

  for (const file of abcFiles) {
    const name = basename(file);
    it(`self-compares ${name}`, () => {
      const content = readFileSync(file, "utf-8");
      assertSelfComparisonEqual(content);
    });
  }
});

describe("Example scores: parse structure", () => {
  if (abcFiles.length === 0) {
    it.skip("no example scores found", () => {});
    return;
  }

  for (const file of abcFiles) {
    const name = basename(file);
    it(`parses ${name} with non-empty tree`, () => {
      const content = readFileSync(file, "utf-8");
      assertNonEmptyParse(content);
    });
  }
});

describe("Example scores: basic structure validation", () => {
  if (abcFiles.length === 0) {
    it.skip("no example scores found", () => {});
    return;
  }

  for (const file of abcFiles) {
    const name = basename(file);
    it(`${name} has File_structure root`, () => {
      const content = readFileSync(file, "utf-8");
      const { csNode } = parseWithTypeScript(content);
      expect(csNode?.type).to.equal("File_structure");
    });
  }
});

describe("Example scores: statistics", () => {
  if (abcFiles.length === 0) {
    it.skip("no example scores found", () => {});
    return;
  }

  it("reports statistics for all example scores", () => {
    const stats: Array<{
      file: string;
      nodeCount: number;
      nodeTypes: number;
      hasNotes: boolean;
      hasChords: boolean;
      errors: number;
    }> = [];

    for (const file of abcFiles) {
      const content = readFileSync(file, "utf-8");
      const { csNode, errors } = parseWithTypeScript(content);
      const types = collectNodeTypes(csNode);

      stats.push({
        file: basename(file),
        nodeCount: countTreeNodes(csNode),
        nodeTypes: types.size,
        hasNotes: types.has("Note"),
        hasChords: types.has("Chord"),
        errors: errors.length,
      });
    }

    // Log statistics summary
    const totalNodes = stats.reduce((sum, s) => sum + s.nodeCount, 0);
    const totalErrors = stats.reduce((sum, s) => sum + s.errors, 0);
    const filesWithNotes = stats.filter((s) => s.hasNotes).length;
    const filesWithChords = stats.filter((s) => s.hasChords).length;

    console.log(`\nExample scores statistics:`);
    console.log(`  Total files: ${stats.length}`);
    console.log(`  Total nodes: ${totalNodes}`);
    console.log(`  Total errors: ${totalErrors}`);
    console.log(`  Files with notes: ${filesWithNotes}`);
    console.log(`  Files with chords: ${filesWithChords}`);

    // All files should parse successfully
    expect(totalErrors).to.equal(0);
  });
});

describe("Example scores: node type coverage", () => {
  if (abcFiles.length === 0) {
    it.skip("no example scores found", () => {});
    return;
  }

  it("covers expected node types across all examples", () => {
    const allTypes = new Set<string>();

    for (const file of abcFiles) {
      const content = readFileSync(file, "utf-8");
      const { csNode } = parseWithTypeScript(content);
      const types = collectNodeTypes(csNode);
      types.forEach((t) => allTypes.add(t));
    }

    // Check for expected node types
    const expectedTypes = [
      "File_structure",
      "Tune",
      "Tune_header",
      "Info_line",
    ];

    for (const type of expectedTypes) {
      expect(allTypes.has(type)).to.be.true;
    }

    console.log(`\nNode types found: ${Array.from(allTypes).sort().join(", ")}`);
  });
});

/**
 * TreeSitter vs TypeScript comparison tests for example scores
 *
 * These tests only run when the TreeSitter native module is built.
 * They verify that both parsers produce identical AST structure for
 * all example score files.
 */
describe("Example scores: TreeSitter vs TypeScript comparison", function() {
  // Check TreeSitter availability once before all tests
  let treeSitterReady = false;

  before(function() {
    treeSitterReady = isTreeSitterAvailable();
    if (!treeSitterReady) {
      console.log("\n  [SKIPPED] TreeSitter native module not built.");
      console.log("  To enable these tests: cd tree-sitter-abc && npm run build\n");
    }
  });

  if (abcFiles.length === 0) {
    it.skip("no example scores found", () => {});
    return;
  }

  // Create a single aggregate test for all files
  it("parses all example scores identically with both parsers", function() {
    if (!treeSitterReady) {
      this.skip();
      return;
    }

    const failures: Array<{ file: string; message: string }> = [];
    let testedCount = 0;

    for (const file of abcFiles) {
      const content = readFileSync(file, "utf-8");
      const result = compareBothParsers(content);

      if (!result.treeSitterAvailable) {
        // TreeSitter became unavailable mid-test
        break;
      }

      testedCount++;

      if (!result.equal) {
        const msg = formatCompareResult(result);
        failures.push({
          file: basename(file),
          message: msg ?? "Unknown difference",
        });
      }
    }

    if (failures.length > 0) {
      const failureList = failures
        .slice(0, 10)
        .map((f) => `  ${f.file}: ${f.message.split("\n")[0]}`)
        .join("\n");
      const moreMsg = failures.length > 10 ? `\n  ... and ${failures.length - 10} more` : "";

      throw new Error(
        `${failures.length} out of ${testedCount} files failed comparison:\n${failureList}${moreMsg}`
      );
    }

    console.log(`\n  Compared ${testedCount} files with both parsers - all identical`);
  });
});
