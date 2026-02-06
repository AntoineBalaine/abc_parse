import { TAGS } from "../csTree/types";
import { Selection } from "../selection";
import { findAncestorByTag, findByTag, findNodeById } from "./treeWalk";

export function selectTune(input: Selection): Selection {
  // Check if we have a meaningful scope (not empty and not just the root)
  const hasScope =
    input.cursors.length > 0 &&
    !(input.cursors.length === 1 && input.cursors[0].size === 1 && input.cursors[0].has(input.root.id));

  // If no meaningful scope, return all Tunes in the document
  if (!hasScope) {
    const allTunes = findByTag(input.root, TAGS.Tune);
    const outputCursors = allTunes.map((tune) => new Set([tune.id]));
    return { root: input.root, cursors: outputCursors };
  }

  // Otherwise, find the ancestor Tune for each node in the cursors
  const seenTuneIds = new Set<number>();
  const outputCursors: Set<number>[] = [];

  for (const cursor of input.cursors) {
    for (const nodeId of cursor) {
      let tuneNode = findAncestorByTag(input.root, nodeId, TAGS.Tune);
      // If no ancestor Tune found, check if the node itself is a Tune
      if (tuneNode === null) {
        const node = findNodeById(input.root, nodeId);
        if (node !== null && node.tag === TAGS.Tune) {
          tuneNode = node;
        }
      }
      if (tuneNode !== null && !seenTuneIds.has(tuneNode.id)) {
        seenTuneIds.add(tuneNode.id);
        outputCursors.push(new Set([tuneNode.id]));
      }
    }
  }

  return { root: input.root, cursors: outputCursors };
}
