import { CSNode } from "../csTree/types";
import { Selection } from "../selection";
import { buildIdMap } from "./treeWalk";

export function selectSiblingsAfter(
  input: Selection,
  predicate: (node: CSNode) => boolean
): Selection {
  const idMap = buildIdMap(input.root);
  const outputCursors: Set<number>[] = [];

  for (const cursor of input.cursors) {
    for (const id of cursor) {
      const node = idMap.get(id);
      if (node === undefined) continue;
      let sibling = node.nextSibling;
      while (sibling !== null && predicate(sibling)) {
        outputCursors.push(new Set([sibling.id]));
        sibling = sibling.nextSibling;
      }
    }
  }

  return { root: input.root, cursors: outputCursors };
}
