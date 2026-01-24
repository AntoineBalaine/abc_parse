import { Selection, createSelection } from "../../abct2/src/selection";
import { fromAst } from "../../abct2/src/csTree/fromAst";
import { File_structure } from "abc-parser";

export interface SelectionState {
  ast: File_structure;
  selection: Selection;
}

export class SelectionStateManager {
  private states: Map<string, SelectionState> = new Map();

  getOrCreate(uri: string, ast: File_structure): SelectionState {
    const existing = this.states.get(uri);
    if (existing) return existing;

    const root = fromAst(ast);
    const selection = createSelection(root);
    const state: SelectionState = { ast, selection };
    this.states.set(uri, state);
    return state;
  }

  reset(uri: string, ast: File_structure): SelectionState {
    const root = fromAst(ast);
    const selection = createSelection(root);
    const state: SelectionState = { ast, selection };
    this.states.set(uri, state);
    return state;
  }

  update(uri: string, selection: Selection): void {
    const existing = this.states.get(uri);
    if (existing) {
      existing.selection = selection;
    }
  }

  invalidate(uri: string): void {
    this.states.delete(uri);
  }
}
