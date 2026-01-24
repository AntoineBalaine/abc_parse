import { expect } from "chai";
import { describe, it } from "mocha";
import { resolveSelectionRanges } from "./selectionRangeResolver";
import { lookupSelector } from "./selectorLookup";
import { fromAst } from "../../abct2/src/csTree/fromAst";
import { createSelection } from "../../abct2/src/selection";
import { Scanner, parse } from "abc-parser";
import { ABCContext } from "../../parse/parsers/Context";
import { File_structure } from "../../parse/types/Expr2";

function parseAbc(source: string): File_structure {
  const ctx = new ABCContext();
  const tokens = Scanner(source, ctx);
  return parse(tokens, ctx);
}

function applySelector(
  ast: File_structure,
  selectorName: string,
  cursorNodeIds: number[],
  args?: number[]
): { ranges: any[]; cursorNodeIds: number[] } {
  const root = fromAst(ast);

  const selectorFn = lookupSelector(selectorName);
  if (!selectorFn) {
    throw new Error(`Unknown selector: "${selectorName}"`);
  }

  let selection;
  if (cursorNodeIds.length === 0) {
    selection = createSelection(root);
  } else {
    selection = {
      root,
      cursors: cursorNodeIds.map((id) => new Set([id])),
    };
  }

  const newSelection = selectorFn(selection, ...(args ?? []));
  const ranges = resolveSelectionRanges(newSelection);
  const outputIds = newSelection.cursors.map((cursor) => [...cursor][0]);
  return { ranges, cursorNodeIds: outputIds };
}

describe("Selector Integration (end-to-end flow)", () => {
  it("selectChords on [CEG]2 C2 D2| returns 1 range matching the chord's position", () => {
    const ast = parseAbc("X:1\nK:C\n[CEG]2 C2 D2|\n");
    const result = applySelector(ast, "selectChords", []);
    expect(result.cursorNodeIds).to.have.length(1);
    expect(result.ranges).to.have.length(1);
    expect(result.ranges[0].start.line).to.equal(2);
    // The chord range includes the '[' bracket at position 0
    expect(result.ranges[0].start.character).to.equal(0);
  });

  it("selectChords followed by selectTop (composition): returns 1 range for G's position", () => {
    const ast = parseAbc("X:1\nK:C\n[CEG]2 C2 D2|\n");
    const chordsResult = applySelector(ast, "selectChords", []);
    const result = applySelector(ast, "selectTop", chordsResult.cursorNodeIds);
    expect(result.cursorNodeIds).to.have.length(1);
    expect(result.ranges).to.have.length(1);
    expect(result.ranges[0].start.line).to.equal(2);
    expect(result.ranges[0].start.character).to.equal(3);
  });

  it("selectChords followed by selectNotes: returns only notes inside chords, not standalone notes", () => {
    const ast = parseAbc("X:1\nK:C\n[CEG]2 C2 D2|\n");
    const chordsResult = applySelector(ast, "selectChords", []);
    expect(chordsResult.cursorNodeIds).to.have.length(1);
    const result = applySelector(ast, "selectNotes", chordsResult.cursorNodeIds);
    // Only 3 notes inside the chord (C, E, G), not the 2 standalone notes (C2, D2)
    expect(result.cursorNodeIds).to.have.length(3);
    expect(result.ranges).to.have.length(3);
  });

  it("applying a selector with empty cursorNodeIds starts from root (equivalent to reset)", () => {
    const ast = parseAbc("X:1\nK:C\n[CEG]2 C2 D2|\n");
    const chordsResult = applySelector(ast, "selectChords", []);
    expect(chordsResult.cursorNodeIds).to.have.length(1);
    // Simulate reset by calling with empty cursorNodeIds
    const freshResult = applySelector(ast, "selectChords", []);
    expect(freshResult.cursorNodeIds).to.have.length(1);
    expect(freshResult.ranges).to.have.length(1);
  });

  it("unknown selector name throws an error", () => {
    const ast = parseAbc("X:1\nK:C\nC2 D2|\n");
    expect(() => applySelector(ast, "nonExistentSelector", []))
      .to.throw('Unknown selector: "nonExistentSelector"');
  });

  it("selectNotes returns one range per note", () => {
    const ast = parseAbc("X:1\nK:C\nC2 D2 E2|\n");
    const result = applySelector(ast, "selectNotes", []);
    expect(result.cursorNodeIds).to.have.length(3);
    expect(result.ranges).to.have.length(3);
  });

  it("selectRests returns one range per rest", () => {
    const ast = parseAbc("X:1\nK:C\nC2 z2 D2 z2|\n");
    const result = applySelector(ast, "selectRests", []);
    expect(result.cursorNodeIds).to.have.length(2);
    expect(result.ranges).to.have.length(2);
  });

  it("selectNthFromTop with n=0 returns the top note of each chord", () => {
    const ast = parseAbc("X:1\nK:C\n[CEG]2|\n");
    const chordsResult = applySelector(ast, "selectChords", []);
    const result = applySelector(ast, "selectNthFromTop", chordsResult.cursorNodeIds, [0]);
    expect(result.cursorNodeIds).to.have.length(1);
    expect(result.ranges[0].start.character).to.equal(3);
  });

  it("selectTune returns one range per tune", () => {
    const ast = parseAbc("X:1\nK:C\nC2 D2|\n");
    const result = applySelector(ast, "selectTune", []);
    expect(result.cursorNodeIds).to.have.length(1);
    expect(result.ranges).to.have.length(1);
  });

  it("stale node IDs from a previous parse return empty results", () => {
    // The server reuses the same ABCContext for a given document.
    // Parsing twice with the same context causes the IdGenerator to continue
    // incrementing, so the second parse produces entirely different node IDs.
    const ctx = new ABCContext();
    const source = "X:1\nK:C\n[CEG]2 C2 D2|\n";

    const tokens1 = Scanner(source, ctx);
    const ast1 = parse(tokens1, ctx);
    const result1 = applySelector(ast1, "selectChords", []);
    expect(result1.cursorNodeIds).to.have.length(1);

    // Re-parse with the same context: IDs are now different
    const tokens2 = Scanner(source, ctx);
    const ast2 = parse(tokens2, ctx);
    const result2 = applySelector(ast2, "selectChords", result1.cursorNodeIds);
    expect(result2.ranges).to.have.length(0);
    expect(result2.cursorNodeIds).to.have.length(0);
  });

  it("partial cursor failure: valid cursors produce results, stale cursors are dropped", () => {
    const ast = parseAbc("X:1\nK:C\n[CEG] [FAC]|\n");
    const chordsResult = applySelector(ast, "selectChords", []);
    expect(chordsResult.cursorNodeIds).to.have.length(2);

    // Add a fabricated invalid ID to the mix
    const mixedIds = [...chordsResult.cursorNodeIds, 99999];
    const result = applySelector(ast, "selectTop", mixedIds);
    // Only the two valid chord cursors produce top-note results
    expect(result.ranges).to.have.length(2);
    expect(result.cursorNodeIds).to.have.length(2);
  });

  it("empty document returns empty results", () => {
    const ast = parseAbc("");
    const result = applySelector(ast, "selectTune", []);
    expect(result.ranges).to.have.length(0);
    expect(result.cursorNodeIds).to.have.length(0);
  });

  it("multi-step composition with explicit threading: selectTune -> selectChords -> selectTop", () => {
    const ast = parseAbc("X:1\nK:C\n[CEG]2 [FAC]2|\n");
    const tuneResult = applySelector(ast, "selectTune", []);
    const chordsResult = applySelector(ast, "selectChords", tuneResult.cursorNodeIds);
    expect(chordsResult.cursorNodeIds).to.have.length(2);
    const topResult = applySelector(ast, "selectTop", chordsResult.cursorNodeIds);
    expect(topResult.ranges).to.have.length(2);
    expect(topResult.cursorNodeIds).to.have.length(2);
    expect(topResult.ranges[0].start.line).to.equal(2);
  });
});
