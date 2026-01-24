import { Selection } from "../selection";
import { TAGS } from "../csTree/types";
import { ABCContext, IRational } from "abc-parser";
import { findNodesById } from "./types";
import { findRhythmChild, replaceRhythm } from "./treeUtils";
import { extractBrokenToken, rationalToRhythm } from "./rhythm";

export function setRhythm(selection: Selection, rational: IRational, ctx: ABCContext): Selection {
  for (const cursor of selection.cursors) {
    const nodes = findNodesById(selection.root, cursor);
    for (const csNode of nodes) {
      if (csNode.tag === TAGS.Note || csNode.tag === TAGS.Rest || csNode.tag === TAGS.Chord) {
        const existingRhythm = findRhythmChild(csNode);
        const brokenToken = existingRhythm ? extractBrokenToken(existingRhythm.node) : null;
        const newRhythm = rationalToRhythm(rational, ctx, brokenToken);
        replaceRhythm(csNode, newRhythm);
      }
    }
  }
  return selection;
}
