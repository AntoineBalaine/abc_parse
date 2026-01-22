/**
 * Property-based tests for TreeSitter comparison
 *
 * These tests use fast-check to generate valid ABC syntax and verify
 * that parsing is consistent.
 *
 * Test categories:
 * 1. TypeScript parser consistency (self-comparison) - always runs
 * 2. Tree structure invariants - always runs
 * 3. TreeSitter vs TypeScript comparison - only runs when TreeSitter is built
 *
 * To enable TreeSitter comparison tests:
 *   cd tree-sitter-abc && npm run build
 */

import chai, { expect } from "chai";
import fc from "fast-check";
import {
  genValidABCSyntax,
  genTune,
  genMusicContent,
  genInfoLine,
  genNoteWithRhythm,
  genChord,
  genGraceGroup,
  genComplexTune,
} from "./generators";
import {
  parseWithTypeScript,
  parseWithBoth,
  compareBothParsers,
  isTreeSitterAvailable,
  assertSelfComparisonEqual,
  assertNonEmptyParse,
  countTreeNodes,
  collectNodeTypes,
  formatTree,
} from "./helpers";
import { compareCSNodes, formatCompareResult } from "../../comparison";

describe("Property-based tests: TypeScript parser consistency", () => {
  it("parses all generated notes consistently", () => {
    fc.assert(
      fc.property(genNoteWithRhythm, (note) => {
        const input = `X:1\nK:C\n${note}|`;
        assertSelfComparisonEqual(input);
      }),
      { numRuns: 100 }
    );
  });

  it("parses all generated tunes consistently", () => {
    fc.assert(
      fc.property(genTune, (tune) => {
        assertSelfComparisonEqual(tune);
      }),
      { numRuns: 50 }
    );
  });

  it("parses all generated music content consistently", () => {
    fc.assert(
      fc.property(genMusicContent, (music) => {
        const input = `X:1\nK:C\n${music}\n`;
        assertSelfComparisonEqual(input);
      }),
      { numRuns: 100 }
    );
  });

  it("parses all generated info lines consistently", () => {
    fc.assert(
      fc.property(genInfoLine, (infoLine) => {
        const input = `X:1\n${infoLine}\nK:C\nC|`;
        assertSelfComparisonEqual(input);
      }),
      { numRuns: 50 }
    );
  });

  it("parses all generated valid ABC syntax consistently", () => {
    fc.assert(
      fc.property(genValidABCSyntax, (abc) => {
        assertSelfComparisonEqual(abc);
      }),
      { numRuns: 100 }
    );
  });
});

describe("Property-based tests: Non-empty parse", () => {
  it("generates non-empty parse trees for all tunes", () => {
    fc.assert(
      fc.property(genTune, (tune) => {
        assertNonEmptyParse(tune);
      }),
      { numRuns: 50 }
    );
  });

  it("generates non-empty parse trees for music content", () => {
    fc.assert(
      fc.property(genMusicContent, (music) => {
        const input = `X:1\nK:C\n${music}\n`;
        assertNonEmptyParse(input);
      }),
      { numRuns: 100 }
    );
  });
});

describe("Property-based tests: Tree structure invariants", () => {
  it("root node is always File_structure", () => {
    fc.assert(
      fc.property(genTune, (tune) => {
        const { csNode } = parseWithTypeScript(tune);
        expect(csNode?.type).to.equal("File_structure");
      }),
      { numRuns: 50 }
    );
  });

  it("tunes contain Tune nodes", () => {
    fc.assert(
      fc.property(genTune, (tune) => {
        const { csNode } = parseWithTypeScript(tune);
        const types = collectNodeTypes(csNode);
        expect(types.has("Tune")).to.be.true;
      }),
      { numRuns: 50 }
    );
  });

  it("music with notes contains Note nodes", () => {
    fc.assert(
      fc.property(genMusicContent, (music) => {
        // Only test if music contains letters (notes)
        if (!/[a-gA-G]/.test(music)) return;
        const input = `X:1\nK:C\n${music}\n`;
        const { csNode } = parseWithTypeScript(input);
        const types = collectNodeTypes(csNode);
        expect(types.has("Note")).to.be.true;
      }),
      { numRuns: 100 }
    );
  });

  it("tree depth is bounded", () => {
    fc.assert(
      fc.property(genTune, (tune) => {
        const { csNode } = parseWithTypeScript(tune);
        const depth = countDepth(csNode);
        // Trees should not be unreasonably deep
        expect(depth).to.be.lessThan(50);
      }),
      { numRuns: 50 }
    );
  });
});

describe("Property-based tests: Chords and grace groups", () => {
  it("parses chords consistently", () => {
    fc.assert(
      fc.property(genChord, (chord) => {
        const input = `X:1\nK:C\n${chord}|`;
        assertSelfComparisonEqual(input);
      }),
      { numRuns: 50 }
    );
  });

  it("parses grace groups consistently", () => {
    fc.assert(
      fc.property(genGraceGroup, (grace) => {
        const input = `X:1\nK:C\n${grace}C|`;
        assertSelfComparisonEqual(input);
      }),
      { numRuns: 50 }
    );
  });
});

describe("Property-based tests: Complex tunes", () => {
  it("parses complex tunes consistently", () => {
    fc.assert(
      fc.property(genComplexTune, (tune) => {
        assertSelfComparisonEqual(tune);
      }),
      { numRuns: 30 }
    );
  });
});

describe("Property-based tests: CSNode comparison symmetry", () => {
  it("comparison is symmetric", () => {
    fc.assert(
      fc.property(genTune, genTune, (tune1, tune2) => {
        const { csNode: node1 } = parseWithTypeScript(tune1);
        const { csNode: node2 } = parseWithTypeScript(tune2);
        const result1 = compareCSNodes(node1, node2);
        const result2 = compareCSNodes(node2, node1);
        // If one says equal, the other must too
        expect(result1.equal).to.equal(result2.equal);
      }),
      { numRuns: 30 }
    );
  });

  it("comparison is reflexive", () => {
    fc.assert(
      fc.property(genTune, (tune) => {
        const { csNode } = parseWithTypeScript(tune);
        const result = compareCSNodes(csNode, csNode);
        expect(result.equal).to.be.true;
      }),
      { numRuns: 50 }
    );
  });
});

// Helper function to count tree depth
function countDepth(node: { firstChild: typeof node | null; nextSibling: typeof node | null } | null): number {
  if (!node) return 0;
  const childDepth = node.firstChild ? countDepth(node.firstChild) + 1 : 0;
  const siblingDepth = countDepth(node.nextSibling);
  return Math.max(childDepth, siblingDepth);
}

/**
 * TreeSitter vs TypeScript comparison tests
 *
 * These tests require the TreeSitter native module to be built.
 * They verify that both parsers produce identical AST structure for
 * generated ABC input.
 */
describe("Property-based tests: TreeSitter vs TypeScript comparison", function() {
  before(function() {
    if (!isTreeSitterAvailable()) {
      throw new Error(
        "TreeSitter native module not available. " +
        "Run: cd tree-sitter-abc && npm run build && cd .. && npm rebuild tree-sitter"
      );
    }
  });

  it("parses generated tunes identically with both parsers", function() {
    fc.assert(
      fc.property(genTune, (tune) => {
        const result = compareBothParsers(tune);
        if (!result.equal) {
          const msg = formatCompareResult(result);
          throw new Error(`Parsers differ:\n${msg}\nInput: ${tune.slice(0, 200)}`);
        }
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it("parses generated music content identically with both parsers", function() {
    fc.assert(
      fc.property(genMusicContent, (music) => {
        const input = `X:1\nK:C\n${music}\n`;
        const result = compareBothParsers(input);
        if (!result.equal) {
          const msg = formatCompareResult(result);
          throw new Error(`Parsers differ:\n${msg}\nInput: ${input.slice(0, 200)}`);
        }
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it("parses generated chords identically with both parsers", function() {
    fc.assert(
      fc.property(genChord, (chord) => {
        const input = `X:1\nK:C\n${chord}|`;
        const result = compareBothParsers(input);
        if (!result.equal) {
          const msg = formatCompareResult(result);
          throw new Error(`Parsers differ:\n${msg}\nInput: ${input}`);
        }
        return true;
      }),
      { numRuns: 50 }
    );
  });

  it("parses complex tunes identically with both parsers", function() {
    fc.assert(
      fc.property(genComplexTune, (tune) => {
        const result = compareBothParsers(tune);
        if (!result.equal) {
          const msg = formatCompareResult(result);
          throw new Error(`Parsers differ:\n${msg}\nInput: ${tune.slice(0, 300)}`);
        }
        return true;
      }),
      { numRuns: 30 }
    );
  });
});
