import { Selection, Cursor } from "../selection";
import { CSNode } from "../csTree/types";

export function remove(selection: Selection): Selection {
  for (const cursor of selection.cursors) {
    if (selection.root.firstChild) {
      walkAndSplice(selection.root, selection.root.firstChild, cursor);
    }
  }
  return selection;
}

function walkAndSplice(parent: CSNode, startNode: CSNode, selectedIds: Cursor): void {
  let prev: CSNode | null = null;
  let current: CSNode | null = startNode;
  while (current !== null) {
    const next: CSNode | null = current.nextSibling;
    if (selectedIds.has(current.id)) {
      // Splice this node out
      if (prev === null) {
        parent.firstChild = next;
      } else {
        prev.nextSibling = next;
      }
      // Do not recurse into removed nodes
    } else {
      // Recurse into this node's children
      if (current.firstChild) {
        walkAndSplice(current, current.firstChild, selectedIds);
      }
      prev = current;
    }
    current = next;
  }
}
