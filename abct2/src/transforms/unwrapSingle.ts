import { Selection } from "../selection";
import { CSNode, TAGS, isTokenNode, getTokenData } from "../csTree/types";
import { TT } from "abc-parser";
import { findNodesById } from "./types";
import {
  findRhythmChild,
  findTieChild,
  findParent,
  insertBefore,
  removeChild,
  appendChild,
  replaceRhythm,
} from "./treeUtils";

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
      const noteChildren = contentChildren.filter(c => c.tag === TAGS.Note);
      if (noteChildren.length !== 1) continue;

      const singleNoteChild = noteChildren[0];
      const nonNoteChildren = contentChildren.filter(c => c.tag !== TAGS.Note);

      // Save chord-level rhythm and tie before restructuring
      const chordRhythm = findRhythmChild(csNode);
      const chordTie = findTieChild(csNode);

      // Promote non-Note content children (annotations, etc.) as siblings
      // before the chord in the parent's child chain
      if (nonNoteChildren.length > 0) {
        const parentResult = findParent(selection.root, csNode);
        if (parentResult) {
          let prev = parentResult.prev;
          for (const child of nonNoteChildren) {
            child.nextSibling = null;
            insertBefore(parentResult.parent, prev, csNode, child);
            prev = child; // the inserted child is now prev of csNode
          }
        }
      }

      // Change tag to Note
      csNode.tag = TAGS.Note;

      // Promote the Note child's children as this node's children
      csNode.firstChild = singleNoteChild.firstChild;

      // Handle rhythm inheritance: chord's rhythm takes precedence
      if (chordRhythm) {
        replaceRhythm(csNode, chordRhythm.node);
      }

      // Handle tie inheritance: chord's tie is appended at the end
      if (chordTie) {
        // Remove any existing tie from the promoted children (chord's takes precedence)
        const existingTie = findTieChild(csNode);
        if (existingTie) {
          removeChild(csNode, existingTie.prev, existingTie.node);
        }
        chordTie.node.nextSibling = null;
        appendChild(csNode, chordTie.node);
      }
    }
  }
  return selection;
}
