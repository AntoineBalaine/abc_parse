import { expect } from "chai";
import { describe, it } from "mocha";
import { resolveSelectionRanges } from "./selectionRangeResolver";
import { lookupSelector } from "./selectorLookup";
import { ScopeRange } from "./server";
import { fromAst } from "../../abct2/src/csTree/fromAst";
import { createSelection, Selection } from "../../abct2/src/selection";
import { selectRange } from "../../abct2/src/selectors/rangeSelector";
import { Scanner, parse, ABCContext, File_structure } from "abc-parser";

function parseAbc(source: string): File_structure {
  const ctx = new ABCContext();
  const tokens = Scanner(source, ctx);
  return parse(tokens, ctx);
}

function applySelector(
  ast: File_structure,
  selectorName: string,
  cursorNodeIds: number[],
  args?: number[],
  scopeRanges?: ScopeRange[]
): { ranges: any[]; cursorNodeIds: number[] } {
  const root = fromAst(ast);

  const selectorFn = lookupSelector(selectorName);
  if (!selectorFn) {
    throw new Error(`Unknown selector: "${selectorName}"`);
  }

  let selection: Selection;
  if (cursorNodeIds.length === 0) {
    if (scopeRanges && scopeRanges.length > 0) {
      // Manual selections provided: constrain to nodes within those ranges
      const allCursors: Set<number>[] = [];
      for (const range of scopeRanges) {
        const baseSelection = createSelection(root);
        const narrowed = selectRange(
          baseSelection,
          range.start.line,
          range.start.character,
          range.end.line,
          range.end.character
        );
        allCursors.push(...narrowed.cursors);
      }
      if (allCursors.length === 0) {
        return { ranges: [], cursorNodeIds: [] };
      }
      selection = { root, cursors: allCursors };
    } else {
      selection = createSelection(root);
    }
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

describe("Selector Integration with scopeRanges", () => {
  it("selectNotes with scopeRanges constrains to notes within the range", () => {
    // Line 2: [CEG]2 C2 D2|
    // Positions: [CEG]2 = 0-5, space = 6, C2 = 7-8, space = 9, D2 = 10-11, | = 12
    // Without scopeRanges, selectNotes returns 5 notes (C, E, G in chord + C2 + D2)
    // With scopeRanges covering positions 7-12 (C2 and D2), should return 2 notes
    // Note: end position is exclusive, so we need 12 to include D2 which ends at position 11
    const ast = parseAbc("X:1\nK:C\n[CEG]2 C2 D2|\n");

    // First verify without scopeRanges: all 5 notes
    const allNotes = applySelector(ast, "selectNotes", []);
    expect(allNotes.cursorNodeIds).to.have.length(5);

    // Now with scopeRanges covering only C2 and D2 (positions 7-12 on line 2)
    const scopeRanges = [{ start: { line: 2, character: 7 }, end: { line: 2, character: 12 } }];
    const scopedNotes = applySelector(ast, "selectNotes", [], undefined, scopeRanges);
    expect(scopedNotes.cursorNodeIds).to.have.length(2);
  });

  it("selectChords with scopeRanges returns only chords within the range", () => {
    // Line 2: [CEG]2 C2 [FAC]2|
    // With scopeRanges covering only the first chord, should return 1 chord
    const ast = parseAbc("X:1\nK:C\n[CEG]2 C2 [FAC]2|\n");

    // Without scopeRanges: 2 chords
    const allChords = applySelector(ast, "selectChords", []);
    expect(allChords.cursorNodeIds).to.have.length(2);

    // With scopeRanges covering only first chord (positions 0-6 on line 2)
    const scopeRanges = [{ start: { line: 2, character: 0 }, end: { line: 2, character: 6 } }];
    const scopedChords = applySelector(ast, "selectChords", [], undefined, scopeRanges);
    expect(scopedChords.cursorNodeIds).to.have.length(1);
  });

  it("scopeRanges with no matching nodes returns empty results", () => {
    // Line 2: C2 D2 E2|
    // scopeRanges covering only the barline (position 9) should return no notes
    const ast = parseAbc("X:1\nK:C\nC2 D2 E2|\n");

    const scopeRanges = [{ start: { line: 2, character: 9 }, end: { line: 2, character: 10 } }];
    const result = applySelector(ast, "selectNotes", [], undefined, scopeRanges);
    expect(result.cursorNodeIds).to.have.length(0);
    expect(result.ranges).to.have.length(0);
  });

  it("multiple scopeRanges combine results from all ranges", () => {
    // Line 2: C2 D2 E2 F2|
    // Two scopeRanges: one covering C2 (0-2), one covering F2 (9-11)
    const ast = parseAbc("X:1\nK:C\nC2 D2 E2 F2|\n");

    // Without scopeRanges: 4 notes
    const allNotes = applySelector(ast, "selectNotes", []);
    expect(allNotes.cursorNodeIds).to.have.length(4);

    // With two scopeRanges
    const scopeRanges = [
      { start: { line: 2, character: 0 }, end: { line: 2, character: 2 } },
      { start: { line: 2, character: 9 }, end: { line: 2, character: 11 } },
    ];
    const scopedNotes = applySelector(ast, "selectNotes", [], undefined, scopeRanges);
    expect(scopedNotes.cursorNodeIds).to.have.length(2);
  });

  it("cursorNodeIds takes precedence over scopeRanges", () => {
    // When cursorNodeIds is provided, scopeRanges should be ignored
    const ast = parseAbc("X:1\nK:C\n[CEG]2 C2 D2|\n");

    // Get the chord's cursorNodeId
    const chordsResult = applySelector(ast, "selectChords", []);
    expect(chordsResult.cursorNodeIds).to.have.length(1);

    // selectNotes with cursorNodeIds from chord should return only chord notes
    // even if scopeRanges covers the standalone notes
    const scopeRanges = [{ start: { line: 2, character: 7 }, end: { line: 2, character: 11 } }];
    const result = applySelector(ast, "selectNotes", chordsResult.cursorNodeIds, undefined, scopeRanges);
    // Should return 3 notes from the chord, not 2 from scopeRanges
    expect(result.cursorNodeIds).to.have.length(3);
  });

  it("scopeRanges spanning multiple lines works correctly", () => {
    // Two lines of music
    const ast = parseAbc("X:1\nK:C\nC2 D2|\nE2 F2|\n");

    // Without scopeRanges: 4 notes across both lines
    const allNotes = applySelector(ast, "selectNotes", []);
    expect(allNotes.cursorNodeIds).to.have.length(4);

    // With scopeRanges covering only first line (line 2)
    const scopeRanges = [{ start: { line: 2, character: 0 }, end: { line: 2, character: 6 } }];
    const scopedNotes = applySelector(ast, "selectNotes", [], undefined, scopeRanges);
    expect(scopedNotes.cursorNodeIds).to.have.length(2);
  });

  it("scopeRanges crossing line boundaries selects partial lines correctly", () => {
    // Two lines of music: line 2 has C2 D2|, line 3 has E2 F2|
    // Positions: C2=0-1, space=2, D2=3-4, |=5 (line 2)
    //            E2=0-1, space=2, F2=3-4, |=5 (line 3)
    const ast = parseAbc("X:1\nK:C\nC2 D2|\nE2 F2|\n");

    // Range from D2 on line 2 (char 3) to E2 on line 3 (char 2)
    // This should capture D2 on line 2 and E2 on line 3
    const scopeRanges = [{ start: { line: 2, character: 3 }, end: { line: 3, character: 2 } }];
    const scopedNotes = applySelector(ast, "selectNotes", [], undefined, scopeRanges);
    expect(scopedNotes.cursorNodeIds).to.have.length(2);
  });

  it("empty scopeRanges array behaves like undefined (selects entire document)", () => {
    const ast = parseAbc("X:1\nK:C\nC2 D2 E2|\n");
    // Empty array should be treated the same as undefined
    const result = applySelector(ast, "selectNotes", [], undefined, []);
    expect(result.cursorNodeIds).to.have.length(3);
  });
});
