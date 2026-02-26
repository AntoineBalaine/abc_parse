import { Pitch as PitchExpr, toMidiPitch } from "abc-parser";
import { toAst } from "../csTree/toAst";
import { CSNode, TAGS } from "../csTree/types";
import { Selection } from "../selection";
import { findChildByTag } from "./treeUtils";
import { findNodesById } from "./types";

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
    const pitchNode = findChildByTag(csNode, TAGS.Pitch);
    if (pitchNode === null) return null;
    const pitchExpr = toAst(pitchNode) as PitchExpr;
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
