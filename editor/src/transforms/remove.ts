import { remove as cstreeRemove } from "abcls-cstree";
import { CSNode } from "../csTree/types";
import { Selection, Cursor } from "../selection";

export function remove(selection: Selection): Selection {
  for (const cursor of selection.cursors) {
    if (selection.root.firstChild) {
      walkAndSplice(selection.root.firstChild, cursor);
    }
  }
  return selection;
}

function walkAndSplice(startNode: CSNode, selectedIds: Cursor): void {
  let current: CSNode | null = startNode;
  while (current !== null) {
    const next: CSNode | null = current.nextSibling;
    if (selectedIds.has(current.id)) {
      cstreeRemove(current);
    } else {
      if (current.firstChild) {
        walkAndSplice(current.firstChild, selectedIds);
      }
    }
    current = next;
  }
}
