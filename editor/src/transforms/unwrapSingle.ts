import { remove, insertBefore, appendChild, getParent } from "abcls-cstree";
import { TT } from "abcls-parser";
import { CSNode, TAGS, isTokenNode, getTokenData } from "../csTree/types";
import { Selection } from "../selection";
import { findRhythmChild, findTieChild, replaceRhythm } from "./treeUtils";
import { findNodesById } from "./types";

export function unwrapSingle(selection: Selection): Selection {
  for (const cursor of selection.cursors) {
    const nodes = findNodesById(selection.root, cursor);
    for (const csNode of nodes) {
      if (csNode.tag !== TAGS.Chord) continue;

      // Collect content children, skipping structural elements (Rhythm, Tie, bracket delimiters).
      // The split is safe because Rhythm is always a compound Expr node (never a Token node).
      const contentChildren: CSNode[] = [];
      let current = csNode.firstChild;
      while (current !== null) {
        const isRhythm = current.tag === TAGS.Rhythm;
        if (isTokenNode(current)) {
          const tt = getTokenData(current).tokenType;
          const isStructural = tt === TT.TIE || tt === TT.CHRD_LEFT_BRKT || tt === TT.CHRD_RIGHT_BRKT;
          if (!isStructural) contentChildren.push(current);
        } else if (!isRhythm) {
          contentChildren.push(current);
        }
        current = current.nextSibling;
      }

      // Only unwrap if there is exactly one Note among the content children
      const noteChildren = contentChildren.filter((c) => c.tag === TAGS.Note);
      if (noteChildren.length !== 1) continue;

      const singleNoteChild = noteChildren[0];
      const nonNoteChildren = contentChildren.filter((c) => c.tag !== TAGS.Note);

      // Save chord-level rhythm and tie before restructuring
      const chordRhythm = findRhythmChild(csNode);
      const chordTie = findTieChild(csNode);

      // Promote non-Note content children (annotations, etc.) as siblings
      // before the chord in the parent's child chain
      if (nonNoteChildren.length > 0 && getParent(csNode)) {
        for (const child of nonNoteChildren) {
          remove(child);
          insertBefore(csNode, child);
        }
      }

      // Change tag to Note
      // We intentionally repurpose this Chord node as a Note node by mutating its tag.
      // The cast is needed because the DataMap pattern makes the tag field narrowly typed.
      (csNode as unknown as { tag: string }).tag = TAGS.Note;

      // Remove all remaining children of csNode (brackets, etc.)
      while (csNode.firstChild) remove(csNode.firstChild);

      // Move the single note's children into csNode
      while (singleNoteChild.firstChild) {
        const child = singleNoteChild.firstChild;
        remove(child);
        appendChild(csNode, child);
      }

      // Handle rhythm inheritance: chord's rhythm takes precedence
      if (chordRhythm) {
        replaceRhythm(csNode, chordRhythm);
      }

      // Handle tie inheritance: chord's tie is appended at the end
      if (chordTie) {
        // Remove any existing tie from the promoted children (chord's takes precedence)
        const existingTie = findTieChild(csNode);
        if (existingTie) {
          remove(existingTie);
        }
        remove(chordTie);
        appendChild(csNode, chordTie);
      }
    }
  }
  return selection;
}
