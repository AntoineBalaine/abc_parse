import { Selection } from "../selection";
import { CSNode, TAGS } from "../csTree/types";
import { findNodesById } from "./types";
import { findChildByTag } from "./treeUtils";
import { toAst } from "../csTree/toAst";
import { Pitch as PitchExpr } from "../../../parse/types/Expr2";
import { toMidiPitch } from "../../../parse/Visitors/Formatter2";

export function pitch(selection: Selection): number[] {
  const results: number[] = [];
  for (const cursor of selection.cursors) {
    const nodes = findNodesById(selection.root, cursor);
    if (nodes.length === 0) continue;
    const midiValue = extractPitch(nodes[0]);
    if (midiValue !== null) {
      results.push(midiValue);
    }
  }
  return results;
}

function extractPitch(csNode: CSNode): number | null {
  if (csNode.tag === TAGS.Note) {
    const pitchResult = findChildByTag(csNode, TAGS.Pitch);
    if (pitchResult === null) return null;
    const pitchExpr = toAst(pitchResult.node) as PitchExpr;
    return toMidiPitch(pitchExpr);
  } else if (csNode.tag === TAGS.Chord) {
    let lastNote: CSNode | null = null;
    let current = csNode.firstChild;
    while (current !== null) {
      if (current.tag === TAGS.Note) {
        lastNote = current;
      }
      current = current.nextSibling;
    }
    if (lastNote !== null) {
      return extractPitch(lastNote);
    }
  }
  return null;
}
