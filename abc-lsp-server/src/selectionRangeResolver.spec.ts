import { expect } from "chai";
import { describe, it } from "mocha";
import { resolveSelectionRanges, findNodeById } from "./selectionRangeResolver";
import { Scanner, parse } from "abc-parser";
import { ABCContext } from "../../parse/parsers/Context";
import { File_structure } from "../../parse/types/Expr2";
import { fromAst } from "../../abct2/src/csTree/fromAst";
import { createSelection } from "../../abct2/src/selection";
import { selectChords, selectNotes } from "../../abct2/src/selectors/typeSelectors";
import { selectTop } from "../../abct2/src/selectors/chordSelectors";

function parseAbc(source: string): File_structure {
  const ctx = new ABCContext();
  const tokens = Scanner(source, ctx);
  return parse(tokens, ctx);
}

describe("findNodeById", () => {
  it("returns the root node when the target ID matches the root", () => {
    const ast = parseAbc("X:1\nK:C\nC2|\n");
    const root = fromAst(ast);
    const found = findNodeById(root, root.id);
    expect(found).to.equal(root);
  });

  it("returns null for an ID that does not exist in the tree", () => {
    const ast = parseAbc("X:1\nK:C\nC2|\n");
    const root = fromAst(ast);
    const found = findNodeById(root, 999999);
    expect(found).to.be.null;
  });

  it("finds a nested child node by ID", () => {
    const ast = parseAbc("X:1\nK:C\nC2|\n");
    const root = fromAst(ast);
    // The first child of root should exist
    const child = root.firstChild;
    expect(child).to.not.be.null;
    const found = findNodeById(root, child!.id);
    expect(found).to.equal(child);
  });
});

describe("resolveSelectionRanges", () => {
  it("on an initial selection returns a single range spanning the file", () => {
    const ast = parseAbc("X:1\nK:C\nC2 D2|\n");
    const root = fromAst(ast);
    const selection = createSelection(root);
    const ranges = resolveSelectionRanges(selection);
    expect(ranges).to.have.length(1);
    expect(ranges[0].start).to.have.property("line");
    expect(ranges[0].start).to.have.property("character");
    expect(ranges[0].end).to.have.property("line");
    expect(ranges[0].end).to.have.property("character");
  });

  it("after selectChords returns one range per chord", () => {
    const ast = parseAbc("X:1\nK:C\n[CEG]2 C2 D2|\n");
    const root = fromAst(ast);
    const selection = createSelection(root);
    const chordSelection = selectChords(selection);
    const ranges = resolveSelectionRanges(chordSelection);
    expect(ranges).to.have.length(1);
    // The chord range should start at the C position on line 2
    expect(ranges[0].start.line).to.equal(2);
  });

  it("after selectNotes returns one range per note", () => {
    const ast = parseAbc("X:1\nK:C\n[CEG]2 C2 D2|\n");
    const root = fromAst(ast);
    const selection = createSelection(root);
    const noteSelection = selectNotes(selection);
    const ranges = resolveSelectionRanges(noteSelection);
    // 3 notes inside chord + 2 standalone notes = 5, but the notes in chord are C, E, G
    // plus standalone C2 and D2 = 5 total notes
    expect(ranges).to.have.length(5);
  });

  it("after selectTop(selectChords(...)) returns ranges for the top note of each chord only", () => {
    const ast = parseAbc("X:1\nK:C\n[CEG]2 C2 D2|\n");
    const root = fromAst(ast);
    const selection = createSelection(root);
    const topSelection = selectTop(selectChords(selection));
    const ranges = resolveSelectionRanges(topSelection);
    expect(ranges).to.have.length(1);
    // The top note is G
    expect(ranges[0].start.line).to.equal(2);
  });

  it("returns empty array for a selection with no cursors", () => {
    const ast = parseAbc("X:1\nK:C\nC2|\n");
    const root = fromAst(ast);
    const selection = { root, cursors: [] };
    const ranges = resolveSelectionRanges(selection);
    expect(ranges).to.have.length(0);
  });

  it("skips cursors whose ID cannot be found in the tree", () => {
    const ast = parseAbc("X:1\nK:C\nC2|\n");
    const root = fromAst(ast);
    const selection = { root, cursors: [new Set([999999])] };
    const ranges = resolveSelectionRanges(selection);
    expect(ranges).to.have.length(0);
  });
});
