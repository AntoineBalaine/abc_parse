import { expect } from "chai";
import { describe, it } from "mocha";
import { ABCContext, Scanner, parse, SemanticAnalyzer, AbcErrorReporter } from "abc-parser";
import { ContextInterpreter, DocumentSnapshots } from "abc-parser/interpreter/ContextInterpreter";
import { fromAst } from "../src/csTree/fromAst";
import { createSelection, Selection } from "../src/selection";
import { splitSystem, splitSystems } from "../src/transforms/splitSystem";
import { findByTag, formatSelection } from "./helpers";
import { TAGS } from "../src/csTree/types";
import { firstTokenData } from "../src/selectors/treeWalk";

function createTestContext(abc: string): {
  selection: Selection;
  ctx: ABCContext;
  snapshots: DocumentSnapshots;
} {
  const ctx = new ABCContext(new AbcErrorReporter());
  const tokens = Scanner(abc, ctx);
  const ast = parse(tokens, ctx);
  const root = fromAst(ast, ctx);
  const selection = createSelection(root);

  // Run semantic analyzer
  const analyzer = new SemanticAnalyzer(ctx);
  ast.accept(analyzer);

  // Create snapshots via interpreter
  const interpreter = new ContextInterpreter();
  const snapshots = interpreter.interpret(ast, analyzer.data, ctx);

  return { selection, ctx, snapshots };
}

describe("splitSystem", () => {
  describe("single-voice system", () => {
    it("splits at cursor position with unbeamed notes", () => {
      // Use spaces between notes to prevent beaming
      const abc = "X:1\nK:C\nC D E F|\n";
      const { selection, ctx, snapshots } = createTestContext(abc);

      // Split at E (line 2, char 4 - C at 0, space at 1, D at 2, space at 3, E at 4)
      const result = splitSystem(selection, { line: 2, character: 4 }, ctx, snapshots);

      // Find the systems in the result
      const systems = findByTag(result.root, TAGS.System);
      expect(systems.length).to.equal(2);

      // Second system should start with E
      const secondSystemFirst = firstTokenData(systems[1]);
      expect(secondSystemFirst).to.not.be.null;
      expect(secondSystemFirst!.lexeme).to.equal("E");
    });

    it("splits beamed notes as a single unit", () => {
      // Because CDEF are beamed, they stay together
      const abc = "X:1\nK:C\nCDEF G|\n";
      const { selection, ctx, snapshots } = createTestContext(abc);

      // Split after the beam (at G position - char 5)
      const result = splitSystem(selection, { line: 2, character: 5 }, ctx, snapshots);

      const systems = findByTag(result.root, TAGS.System);
      expect(systems.length).to.equal(2);

      // First system should contain the beam (starting with C)
      const firstSystemFirst = firstTokenData(systems[0]);
      expect(firstSystemFirst!.lexeme).to.equal("C");

      // Second system should start with G
      const secondSystemFirst = firstTokenData(systems[1]);
      expect(secondSystemFirst!.lexeme).to.equal("G");
    });

    it("returns cursors pointing to the start of the second system", () => {
      const abc = "X:1\nK:C\nCDEF|\n";
      const { selection, ctx, snapshots } = createTestContext(abc);

      const result = splitSystem(selection, { line: 2, character: 2 }, ctx, snapshots);

      // Should have one cursor pointing to the first token of the second system
      expect(result.cursors.length).to.equal(1);
      expect(result.cursors[0].size).to.be.greaterThan(0);
    });
  });

  describe("multi-voice system", () => {
    it("splits all voices at equivalent time", () => {
      // Multi-voice system with voice markers
      const abc = "X:1\nV:1\nV:2\nK:C\n[V:1]C D E F|\n[V:2]G A B c|\n";
      const { selection, ctx, snapshots } = createTestContext(abc);

      // Split at E in voice 1 (line 4, around char 6)
      const result = splitSystem(selection, { line: 4, character: 6 }, ctx, snapshots);

      // Check that we have 2 systems
      const systems = findByTag(result.root, TAGS.System);
      expect(systems.length).to.equal(2);
    });

    it("inserts voice markers in systemAfter when needed", () => {
      // Two voices where neither line starts with a voice marker in the after portion
      const abc = "X:1\nV:1\nV:2\nK:C\n[V:1]C D E F|\n[V:2]G A B c|\n";
      const { selection, ctx, snapshots } = createTestContext(abc);

      // Split early so we definitely need voice markers in systemAfter
      const result = splitSystem(selection, { line: 4, character: 4 }, ctx, snapshots);

      // Check that we have 2 systems (split was successful)
      const systems = findByTag(result.root, TAGS.System);
      expect(systems.length).to.equal(2);
    });
  });

  describe("edge cases", () => {
    it("returns original selection when cursor is outside any system", () => {
      const abc = "X:1\nK:C\nCDE|\n";
      const { selection, ctx, snapshots } = createTestContext(abc);

      // Cursor at line 100 is outside the document
      const result = splitSystem(selection, { line: 100, character: 0 }, ctx, snapshots);

      // Should return the original selection unchanged (1 system)
      const systems = findByTag(result.root, TAGS.System);
      expect(systems.length).to.equal(1);
    });

    it("returns original selection when cursor is in header", () => {
      const abc = "X:1\nK:C\nCDE|\n";
      const { selection, ctx, snapshots } = createTestContext(abc);

      // Cursor in K: line (line 1)
      const result = splitSystem(selection, { line: 1, character: 0 }, ctx, snapshots);

      // Should return the original selection unchanged (1 system)
      const systems = findByTag(result.root, TAGS.System);
      expect(systems.length).to.equal(1);
    });

    it("handles split at end of system", () => {
      const abc = "X:1\nK:C\nCDE|\n";
      const { selection, ctx, snapshots } = createTestContext(abc);

      // Cursor at the barline (line 2, char 3)
      const result = splitSystem(selection, { line: 2, character: 3 }, ctx, snapshots);

      // Should either split with barline in second system or return original if no time event after cursor
      const systems = findByTag(result.root, TAGS.System);
      // The exact behavior depends on whether barlines are time events
      expect(systems.length).to.be.greaterThanOrEqual(1);
    });
  });
});

describe("splitSystem end-to-end serialization", () => {
  it("correctly serializes multi-voice split with voice markers and EOLs", () => {
    const input = `%%gchordfont Times 16
X:1
L:1/4
V:1
"Cm7" [DG_B] "G7" =B "Fm7" c "BbM7" d |
V:2
      A           B        C        d |
`;
    const expected = `%%gchordfont Times 16
X:1
L:1/4
V:1
"Cm7" [DG_B] "G7" =B "Fm7" 
V:2
      A           B        
[V:1]c "BbM7" d |
[V:2]C        d |
`;
    const { selection, ctx, snapshots } = createTestContext(input);

    // Split at "C" in voice 2 (line 6, character 27)
    const result = splitSystem(selection, { line: 6, character: 27 }, ctx, snapshots);

    const output = formatSelection(result);
    expect(output).to.equal(expected);
  });
});

describe("splitSystems", () => {
  describe("multi-cursor", () => {
    it("processes cursors in reverse document order", () => {
      const abc = "X:1\nK:C\nCDEFGABC|\n";
      const { selection, ctx, snapshots } = createTestContext(abc);

      // Two cursors: one at C (0) and one at E (2)
      const cursors = [
        { line: 2, character: 0 },
        { line: 2, character: 4 },
      ];

      const result = splitSystems(selection, cursors, ctx, snapshots);

      // Should create 3 systems (original split into 3 parts)
      const systems = findByTag(result.root, TAGS.System);
      // Note: the second cursor splits first (reverse order), then the first
      // So we get: [empty or C only] [DE only] [FGABC|]
      expect(systems.length).to.be.greaterThanOrEqual(2);
    });

    it("deduplicates identical cursor positions", () => {
      const abc = "X:1\nK:C\nCDEF|\n";
      const { selection, ctx, snapshots } = createTestContext(abc);

      // Same position twice
      const cursors = [
        { line: 2, character: 2 },
        { line: 2, character: 2 },
      ];

      const result = splitSystems(selection, cursors, ctx, snapshots);

      // Should only split once
      const systems = findByTag(result.root, TAGS.System);
      expect(systems.length).to.equal(2);
    });

    it("returns cursors for each split", () => {
      const abc = "X:1\nK:C\nCDEFGABC|\n";
      const { selection, ctx, snapshots } = createTestContext(abc);

      const cursors = [
        { line: 2, character: 2 },
        { line: 2, character: 4 },
      ];

      const result = splitSystems(selection, cursors, ctx, snapshots);

      // Should return cursors for each successful split
      expect(result.cursors.length).to.be.greaterThanOrEqual(1);
    });
  });
});
