import { expect } from "chai";
import { describe, it, beforeEach } from "mocha";
import { SelectionStateManager } from "./selectionState";
import { Scanner, parse } from "abc-parser";
import { ABCContext } from "../../parse/parsers/Context";
import { File_structure } from "../../parse/types/Expr2";

function parseAbc(source: string): File_structure {
  const ctx = new ABCContext();
  const tokens = Scanner(source, ctx);
  return parse(tokens, ctx);
}

describe("SelectionStateManager", () => {
  let manager: SelectionStateManager;
  let ast: File_structure;

  beforeEach(() => {
    manager = new SelectionStateManager();
    ast = parseAbc("X:1\nK:C\n[CEG]2 C2 D2|\n");
  });

  it("getOrCreate returns a valid SelectionState with a CS tree root and initial selection", () => {
    const state = manager.getOrCreate("file:///test.abc", ast);
    expect(state).to.have.property("ast");
    expect(state).to.have.property("selection");
    expect(state.selection.root).to.have.property("id");
    expect(state.selection.root).to.have.property("tag");
    expect(state.selection.cursors).to.have.length(1);
  });

  it("getOrCreate called twice with the same URI returns the same state object", () => {
    const state1 = manager.getOrCreate("file:///test.abc", ast);
    const state2 = manager.getOrCreate("file:///test.abc", ast);
    expect(state1).to.equal(state2);
  });

  it("invalidate removes the state; subsequent getOrCreate rebuilds from scratch", () => {
    const state1 = manager.getOrCreate("file:///test.abc", ast);
    manager.invalidate("file:///test.abc");
    const state2 = manager.getOrCreate("file:///test.abc", ast);
    expect(state1).to.not.equal(state2);
  });

  it("update replaces the selection in the existing state", () => {
    const state = manager.getOrCreate("file:///test.abc", ast);
    const originalSelection = state.selection;
    const newSelection = { root: state.selection.root, cursors: [] };
    manager.update("file:///test.abc", newSelection);
    const updatedState = manager.getOrCreate("file:///test.abc", ast);
    expect(updatedState.selection).to.equal(newSelection);
    expect(updatedState.selection).to.not.equal(originalSelection);
  });

  it("update on non-existent URI does nothing", () => {
    const newSelection = { root: { tag: "test", id: 0, data: { type: "empty" as const }, firstChild: null, nextSibling: null }, cursors: [] };
    manager.update("file:///nonexistent.abc", newSelection);
    // No error is thrown; getOrCreate still creates a new state
    const state = manager.getOrCreate("file:///nonexistent.abc", ast);
    expect(state.selection.cursors).to.have.length(1);
  });

  it("reset always recreates the state even if one exists", () => {
    const state1 = manager.getOrCreate("file:///test.abc", ast);
    const state2 = manager.reset("file:///test.abc", ast);
    expect(state1).to.not.equal(state2);
    expect(state2.selection.cursors).to.have.length(1);
  });
});
