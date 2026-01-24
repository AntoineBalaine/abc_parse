import { Selection } from "../selection";
import { TAGS } from "../csTree/types";
import { IRational, createRational, addRational } from "../../../parse/Visitors/fmt2/rational";
import { findNodesById } from "./types";
import { getNodeRhythm } from "./rhythm";

export function sumRhythm(selection: Selection): IRational[] {
  const results: IRational[] = [];
  for (const cursor of selection.cursors) {
    const nodes = findNodesById(selection.root, cursor);
    let sum = createRational(0, 1);
    for (const csNode of nodes) {
      if (csNode.tag === TAGS.Note || csNode.tag === TAGS.Rest || csNode.tag === TAGS.Chord) {
        sum = addRational(sum, getNodeRhythm(csNode));
      }
    }
    results.push(sum);
  }
  return results;
}
