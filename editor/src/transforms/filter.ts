import { Selection } from "../selection";
import { CSNode } from "../csTree/types";
import { findNodesById } from "./types";

export function filter(selection: Selection, predicate: (node: CSNode) => boolean): Selection {
  const newCursors: Set<number>[] = [];
  for (const cursor of selection.cursors) {
    const nodes = findNodesById(selection.root, cursor);
    if (nodes.length > 0 && predicate(nodes[0])) {
      newCursors.push(cursor);
    }
  }
  return { root: selection.root, cursors: newCursors };
}
