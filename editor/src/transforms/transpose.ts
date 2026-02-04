import { Selection } from "../selection";
import { CSNode, TAGS } from "../csTree/types";
import { ABCContext, Pitch, toMidiPitch, fromMidiPitch } from "abc-parser";
import { toAst } from "../csTree/toAst";
import { fromAst } from "../csTree/fromAst";
import { findNodesById } from "./types";
import { findChildByTag, replaceChild } from "./treeUtils";

export function transpose(selection: Selection, semitones: number, ctx: ABCContext): Selection {
  if (semitones === 0) return selection;

  for (const cursor of selection.cursors) {
    const nodes = findNodesById(selection.root, cursor);
    for (const csNode of nodes) {
      if (csNode.tag === TAGS.Note) {
        transposePitchChild(csNode, semitones, ctx);
      } else if (csNode.tag === TAGS.Chord) {
        let current = csNode.firstChild;
        while (current !== null) {
          if (current.tag === TAGS.Note) {
            transposePitchChild(current, semitones, ctx);
          }
          current = current.nextSibling;
        }
      }
    }
  }
  return selection;
}

function transposePitchChild(noteNode: CSNode, semitones: number, ctx: ABCContext): void {
  const pitchResult = findChildByTag(noteNode, TAGS.Pitch);
  if (pitchResult === null) return;

  const pitchCSNode = pitchResult.node;

  // Bridge: convert CSNode Pitch to Expr Pitch
  const pitchExpr = toAst(pitchCSNode) as Pitch;

  // Use existing utilities to compute transposition
  const midiPitch = toMidiPitch(pitchExpr);
  const newMidi = midiPitch + semitones;

  // Guard: skip transposition if the result is out of valid MIDI range
  if (newMidi < 0 || newMidi > 127) return;

  const newPitchExpr = fromMidiPitch(newMidi, ctx);

  // Bridge: convert computed Pitch Expr back to CSNode subtree
  const newPitchCSNode = fromAst(newPitchExpr, ctx);

  // Replace the old Pitch child with the new one
  replaceChild(noteNode, pitchResult.prev, pitchCSNode, newPitchCSNode);
}
