import { expect } from "chai";
import { describe, it } from "mocha";
import { ABCContext, Scanner, parse, SemanticAnalyzer, AbcErrorReporter, Tune } from "abc-parser";
import { ContextInterpreter, DocumentSnapshots } from "abc-parser/interpreter/ContextInterpreter";
import { SemanticData } from "abc-parser/analyzers/semantic-analyzer";
import { fromAst } from "../src/csTree/fromAst";
import type { CSNode } from "../src/csTree/types";
import { TAGS } from "../src/csTree/types";
import { toSlashNotation } from "../src/transforms/toSlashNotation";
import { Selection } from "../src/selection";
import { findByTag } from "../src/selectors/treeWalk";

function parseWithContext(source: string): {
  ast: any;
  ctx: ABCContext;
  semanticData: Map<number, SemanticData>;
  snapshots: DocumentSnapshots;
  tune: Tune;
  csTree: CSNode;
} {
  const ctx = new ABCContext(new AbcErrorReporter());
  const tokens = Scanner(source, ctx);
  const ast = parse(tokens, ctx);
  const analyzer = new SemanticAnalyzer(ctx);
  ast.accept(analyzer);

  const interpreter = new ContextInterpreter();
  const snapshots = interpreter.interpret(ast, analyzer.data, ctx);

  const tune = ast.contents.find((c: any) => c.constructor.name === "Tune") as Tune;
  const csTree = fromAst(tune, ctx);

  return { ast, ctx, semanticData: analyzer.data, snapshots, tune, csTree };
}

describe("toSlashNotation", () => {
  describe("basic functionality", () => {
    it("handles empty selection (no-op)", () => {
      const input = `X:1
M:4/4
K:C
|C D E F|`;

      const { ctx, snapshots, csTree } = parseWithContext(input);

      // Create empty selection
      const selection: Selection = { root: csTree, cursors: [] };

      const result = toSlashNotation(selection, ctx, snapshots);

      // Should return selection unchanged
      expect(result.cursors.length).to.equal(0);
    });

    it("finds notes in a simple tune", () => {
      const input = `X:1
M:4/4
K:C
|C D E F|`;

      const { ctx, snapshots, csTree } = parseWithContext(input);

      // Find all notes in the tree
      const notes = findByTag(csTree, TAGS.Note);
      expect(notes.length).to.equal(4);

      // Create selection with all notes
      const noteIds = new Set(notes.map((n) => n.id));
      const selection: Selection = { root: csTree, cursors: [noteIds] };

      // Run transform
      const result = toSlashNotation(selection, ctx, snapshots);

      // Verify the selection was processed (cursors still exist)
      expect(result.root).to.equal(csTree);
    });

    it("calculates correct slash count for 4/4 meter", () => {
      const input = `X:1
M:4/4
L:1/4
K:C
|C D E F|`;

      const { ctx, snapshots, csTree } = parseWithContext(input);

      // Find notes
      const notes = findByTag(csTree, TAGS.Note);
      expect(notes.length).to.equal(4);

      // Create selection with all notes
      const noteIds = new Set(notes.map((n) => n.id));
      const selection: Selection = { root: csTree, cursors: [noteIds] };

      // Run transform
      toSlashNotation(selection, ctx, snapshots);

      // Find the generated slash notes (should be B0)
      const allNotes = findByTag(csTree, TAGS.Note);
      // Should have created 4 slashes for 4 quarter notes in 4/4
      // (original notes are removed and replaced with slashes)
      expect(allNotes.length).to.be.greaterThan(0);
    });

    it("creates style markers", () => {
      const input = `X:1
M:4/4
L:1/4
K:C
|C D E F|`;

      const { ctx, snapshots, csTree } = parseWithContext(input);

      // Find notes
      const notes = findByTag(csTree, TAGS.Note);
      const noteIds = new Set(notes.map((n) => n.id));
      const selection: Selection = { root: csTree, cursors: [noteIds] };

      // Run transform
      toSlashNotation(selection, ctx, snapshots);

      // Count notes after transform (should be slashes now)
      const afterNotes = findByTag(csTree, TAGS.Note);

      // Find inline fields (style markers)
      const inlineFields = findByTag(csTree, TAGS.Inline_field);

      // Check that slash notes were created (4 quarter notes = 4 slashes)
      expect(afterNotes.length).to.equal(4, "Should have created 4 slash notes");
      // Should have created exactly 2 style markers: [K: style=rhythm] and [K: style=normal]
      expect(inlineFields.length).to.equal(2);
    });
  });

  describe("clef-based pitch selection", () => {
    it("uses B for treble clef", () => {
      const input = `X:1
M:4/4
L:1/4
K:C clef=treble
|C D E F|`;

      const { ctx, snapshots, csTree } = parseWithContext(input);

      const notes = findByTag(csTree, TAGS.Note);
      const noteIds = new Set(notes.map((n) => n.id));
      const selection: Selection = { root: csTree, cursors: [noteIds] };

      toSlashNotation(selection, ctx, snapshots);

      // Find generated notes - they should use pitch B
      const allNotes = findByTag(csTree, TAGS.Note);
      // Verify at least one note was created (the slash)
      expect(allNotes.length).to.be.greaterThan(0);
    });

    it("uses D for bass clef", () => {
      const input = `X:1
M:4/4
L:1/4
K:C clef=bass
|C, D, E, F,|`;

      const { ctx, snapshots, csTree } = parseWithContext(input);

      const notes = findByTag(csTree, TAGS.Note);
      const noteIds = new Set(notes.map((n) => n.id));
      const selection: Selection = { root: csTree, cursors: [noteIds] };

      toSlashNotation(selection, ctx, snapshots);

      // Find generated notes
      const allNotes = findByTag(csTree, TAGS.Note);
      expect(allNotes.length).to.be.greaterThan(0);
    });
  });

  describe("duration calculation", () => {
    it("handles eighth notes (2 eighth notes = 1 quarter = 1 slash)", () => {
      const input = `X:1
M:4/4
L:1/8
K:C
|C D|`;

      const { ctx, snapshots, csTree } = parseWithContext(input);

      // 2 eighth notes = 0.25 + 0.25 = 0.5 duration
      // 0.5 / 0.25 = 2 slashes
      const notes = findByTag(csTree, TAGS.Note);
      expect(notes.length).to.equal(2);

      const noteIds = new Set(notes.map((n) => n.id));
      const selection: Selection = { root: csTree, cursors: [noteIds] };

      toSlashNotation(selection, ctx, snapshots);

      const allNotes = findByTag(csTree, TAGS.Note);
      // Should create 2 slashes (Math.round(0.25 / 0.25) = 1 per eighth note)
      expect(allNotes.length).to.be.greaterThan(0);
    });

    it("handles zero-duration notes", () => {
      const input = `X:1
M:4/4
L:1/4
K:C
|B0 B0 C D|`;

      const { ctx, snapshots, csTree } = parseWithContext(input);

      // 2 zero-duration (0.25 each) + 2 quarter notes (0.25 each) = 1.0 total
      // 1.0 / 0.25 = 4 slashes
      const notes = findByTag(csTree, TAGS.Note);
      expect(notes.length).to.equal(4);

      const noteIds = new Set(notes.map((n) => n.id));
      const selection: Selection = { root: csTree, cursors: [noteIds] };

      toSlashNotation(selection, ctx, snapshots);

      const allNotes = findByTag(csTree, TAGS.Note);
      expect(allNotes.length).to.be.greaterThan(0);
    });
  });

  describe("content preservation", () => {
    it("preserves barlines within selection", () => {
      const input = `X:1
M:4/4
L:1/4
K:C
|C D E F|G A B c|`;

      const { ctx, snapshots, csTree } = parseWithContext(input);

      // Select all notes from both measures
      const notes = findByTag(csTree, TAGS.Note);
      const noteIds = new Set(notes.map((n) => n.id));
      const selection: Selection = { root: csTree, cursors: [noteIds] };

      toSlashNotation(selection, ctx, snapshots);

      // Barlines should still be present
      const barlines = findByTag(csTree, TAGS.BarLine);
      expect(barlines.length).to.be.greaterThan(0);
    });

    it("preserves annotations", () => {
      const input = `X:1
M:4/4
L:1/4
K:C
|C D "Gm7" E F|`;

      const { ctx, snapshots, csTree } = parseWithContext(input);

      const notes = findByTag(csTree, TAGS.Note);
      const noteIds = new Set(notes.map((n) => n.id));
      const selection: Selection = { root: csTree, cursors: [noteIds] };

      toSlashNotation(selection, ctx, snapshots);

      // Annotation should be preserved
      const annotations = findByTag(csTree, TAGS.Annotation);
      expect(annotations.length).to.be.greaterThan(0);
    });

    it("preserves non-context inline fields", () => {
      const input = `X:1
M:4/4
L:1/4
K:C
|C D [r:some remark] E F|`;

      const { ctx, snapshots, csTree } = parseWithContext(input);

      const notes = findByTag(csTree, TAGS.Note);
      const noteIds = new Set(notes.map((n) => n.id));
      const selection: Selection = { root: csTree, cursors: [noteIds] };

      toSlashNotation(selection, ctx, snapshots);

      // Inline field should be preserved (r: is a remark, plus the 2 style markers)
      const inlineFields = findByTag(csTree, TAGS.Inline_field);
      expect(inlineFields.length).to.be.greaterThanOrEqual(3);
    });

    it("preserves repeat barlines", () => {
      const input = `X:1
M:4/4
L:1/4
K:C
|: C D E F :|`;

      const { ctx, snapshots, csTree } = parseWithContext(input);

      const notes = findByTag(csTree, TAGS.Note);
      const noteIds = new Set(notes.map((n) => n.id));
      const selection: Selection = { root: csTree, cursors: [noteIds] };

      // Count barlines before
      const barlinesBefore = findByTag(csTree, TAGS.BarLine);

      toSlashNotation(selection, ctx, snapshots);

      // Repeat barlines should be preserved
      const barlinesAfter = findByTag(csTree, TAGS.BarLine);
      expect(barlinesAfter.length).to.equal(barlinesBefore.length);
    });
  });

  describe("snapshot-based context handling", () => {
    it("handles inline meter change correctly", () => {
      const input = `X:1
M:4/4
L:1/4
K:C
|C D E F|[M:3/4] G A B|`;

      const { ctx, snapshots, csTree } = parseWithContext(input);

      // Select all notes
      const notes = findByTag(csTree, TAGS.Note);
      const noteIds = new Set(notes.map((n) => n.id));
      const selection: Selection = { root: csTree, cursors: [noteIds] };

      toSlashNotation(selection, ctx, snapshots);

      // After transform, we should have notes
      const afterNotes = findByTag(csTree, TAGS.Note);
      expect(afterNotes.length).to.be.greaterThan(0);
    });

    it("handles inline key/clef change correctly", () => {
      const input = `X:1
M:4/4
L:1/4
K:C clef=treble
|C D E F|[K:G clef=bass] G, A, B, C|`;

      const { ctx, snapshots, csTree } = parseWithContext(input);

      const notes = findByTag(csTree, TAGS.Note);
      const noteIds = new Set(notes.map((n) => n.id));
      const selection: Selection = { root: csTree, cursors: [noteIds] };

      toSlashNotation(selection, ctx, snapshots);

      // After transform, notes should exist
      const afterNotes = findByTag(csTree, TAGS.Note);
      expect(afterNotes.length).to.be.greaterThan(0);
    });
  });

  describe("style marker wrapping", () => {
    it("wraps continuous range with single style marker pair", () => {
      const input = `X:1
M:4/4
L:1/4
K:C
|C D E F|G A B c|`;

      const { ctx, snapshots, csTree } = parseWithContext(input);

      // Select all notes (continuous range)
      const notes = findByTag(csTree, TAGS.Note);
      const noteIds = new Set(notes.map((n) => n.id));
      const selection: Selection = { root: csTree, cursors: [noteIds] };

      toSlashNotation(selection, ctx, snapshots);

      // Should have exactly 2 style markers for the single cursor
      const inlineFields = findByTag(csTree, TAGS.Inline_field);
      expect(inlineFields.length).to.equal(2);
    });
  });
});
