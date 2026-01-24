import { Selection } from "../selection";
import { TAGS } from "../csTree/types";
import { ABCContext, IRational, addRational } from "abc-parser";
import { findNodesById } from "./types";
import { findRhythmChild, replaceRhythm } from "./treeUtils";
import { extractBrokenToken, rationalToRhythm, getNodeRhythm } from "./rhythm";

export function addToRhythm(selection: Selection, rational: IRational, ctx: ABCContext): Selection {
  // Adding zero is a no-op
  if (rational.numerator === 0) return selection;

  for (const cursor of selection.cursors) {
    const nodes = findNodesById(selection.root, cursor);
    for (const csNode of nodes) {
      if (csNode.tag === TAGS.Note || csNode.tag === TAGS.Rest || csNode.tag === TAGS.Chord) {
        const existingRhythm = findRhythmChild(csNode);
        const brokenToken = existingRhythm ? extractBrokenToken(existingRhythm.node) : null;
        const current = getNodeRhythm(csNode);
        const newRational = addRational(current, rational);
        const newRhythm = rationalToRhythm(newRational, ctx, brokenToken);
        replaceRhythm(csNode, newRhythm);
      }
    }
  }
  return selection;
}
