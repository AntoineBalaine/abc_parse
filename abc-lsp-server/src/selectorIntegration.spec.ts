import { expect } from "chai";
import { describe, it, beforeEach } from "mocha";
import { SelectionStateManager } from "./selectionState";
import { resolveSelectionRanges } from "./selectionRangeResolver";
import { lookupSelector } from "./selectorLookup";
import { Scanner, parse } from "abc-parser";
import { ABCContext } from "../../parse/parsers/Context";
import { File_structure } from "../../parse/types/Expr2";

function parseAbc(source: string): File_structure {
  const ctx = new ABCContext();
  const tokens = Scanner(source, ctx);
  return parse(tokens, ctx);
}

/**
 * Simulates what the abct2.applySelector handler does.
 */
function applySelector(
  manager: SelectionStateManager,
  uri: string,
  ast: File_structure,
  selectorName: string,
  args?: number[]
): { ranges: any[]; cursorCount: number } {
  const state = manager.getOrCreate(uri, ast);
  const selectorFn = lookupSelector(selectorName);
  if (!selectorFn) {
    throw new Error(`Unknown selector: "${selectorName}"`);
  }
  const newSelection = selectorFn(state.selection, ...(args ?? []));
  manager.update(uri, newSelection);
  const ranges = resolveSelectionRanges(newSelection);
  return { ranges, cursorCount: newSelection.cursors.length };
}

/**
 * Simulates what the abct2.resetSelection handler does.
 */
function resetSelection(
  manager: SelectionStateManager,
  uri: string,
  ast: File_structure
): { ranges: any[]; cursorCount: number } {
  manager.reset(uri, ast);
  return { ranges: [], cursorCount: 0 };
}

describe("Selector Integration (end-to-end flow)", () => {
  let manager: SelectionStateManager;
  const uri = "file:///test.abc";

  beforeEach(() => {
    manager = new SelectionStateManager();
  });

  it("selectChords on [CEG]2 C2 D2| returns 1 range matching the chord's position", () => {
    const ast = parseAbc("X:1\nK:C\n[CEG]2 C2 D2|\n");
    const result = applySelector(manager, uri, ast, "selectChords");
    expect(result.cursorCount).to.equal(1);
    expect(result.ranges).to.have.length(1);
    // The chord's range spans the notes inside it (C, E, G), starting at character 1
    expect(result.ranges[0].start.line).to.equal(2);
    expect(result.ranges[0].start.character).to.equal(1);
  });

  it("selectChords followed by selectTop (composition): returns 1 range for G's position", () => {
    const ast = parseAbc("X:1\nK:C\n[CEG]2 C2 D2|\n");
    applySelector(manager, uri, ast, "selectChords");
    const result = applySelector(manager, uri, ast, "selectTop");
    expect(result.cursorCount).to.equal(1);
    expect(result.ranges).to.have.length(1);
    // G is the last note in the chord [CEG], at character 3
    expect(result.ranges[0].start.line).to.equal(2);
    expect(result.ranges[0].start.character).to.equal(3);
  });

  it("resetSelection after applying selectors returns fresh initial state", () => {
    const ast = parseAbc("X:1\nK:C\n[CEG]2 C2 D2|\n");
    applySelector(manager, uri, ast, "selectChords");
    const resetResult = resetSelection(manager, uri, ast);
    // Reset returns empty ranges and 0 cursors to avoid selecting the whole file
    expect(resetResult.cursorCount).to.equal(0);
    expect(resetResult.ranges).to.have.length(0);
    // After reset, applying selectChords should return fresh results
    const result = applySelector(manager, uri, ast, "selectChords");
    expect(result.cursorCount).to.equal(1);
  });

  it("unknown selector name throws an error", () => {
    const ast = parseAbc("X:1\nK:C\nC2 D2|\n");
    expect(() => applySelector(manager, uri, ast, "nonExistentSelector"))
      .to.throw('Unknown selector: "nonExistentSelector"');
  });

  it("state is invalidated and rebuilt when document changes", () => {
    const ast1 = parseAbc("X:1\nK:C\n[CEG]2 C2 D2|\n");
    applySelector(manager, uri, ast1, "selectChords");
    // Simulate document change by invalidating
    manager.invalidate(uri);
    // New document with different content
    const ast2 = parseAbc("X:1\nK:C\n[DF]2 [CE]2|\n");
    const result = applySelector(manager, uri, ast2, "selectChords");
    // Now there should be 2 chords
    expect(result.cursorCount).to.equal(2);
    expect(result.ranges).to.have.length(2);
  });

  it("selectNotes returns one range per note", () => {
    const ast = parseAbc("X:1\nK:C\nC2 D2 E2|\n");
    const result = applySelector(manager, uri, ast, "selectNotes");
    expect(result.cursorCount).to.equal(3);
    expect(result.ranges).to.have.length(3);
  });

  it("selectRests returns one range per rest", () => {
    const ast = parseAbc("X:1\nK:C\nC2 z2 D2 z2|\n");
    const result = applySelector(manager, uri, ast, "selectRests");
    expect(result.cursorCount).to.equal(2);
    expect(result.ranges).to.have.length(2);
  });

  it("selectNthFromTop with n=0 returns the top note of each chord", () => {
    const ast = parseAbc("X:1\nK:C\n[CEG]2|\n");
    applySelector(manager, uri, ast, "selectChords");
    const result = applySelector(manager, uri, ast, "selectNthFromTop", [0]);
    expect(result.cursorCount).to.equal(1);
    // G is the top note (last in the chord)
    expect(result.ranges[0].start.character).to.equal(3);
  });

  it("selectTune returns one range per tune", () => {
    const ast = parseAbc("X:1\nK:C\nC2 D2|\n");
    const result = applySelector(manager, uri, ast, "selectTune");
    expect(result.cursorCount).to.equal(1);
    expect(result.ranges).to.have.length(1);
  });
});
