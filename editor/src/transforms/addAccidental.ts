import { ABCContext, TT } from "abc-parser";
import { remove, replace, insertBefore } from "cstree";
import { createCSNode, CSNode, TAGS, isTokenNode, getTokenData } from "../csTree/types";
import { Selection } from "../selection";
import { findChildByTag } from "./treeUtils";
import { findNodesById } from "./types";

type AccidentalState = "none" | "sharp" | "flat" | "natural" | "dblsharp" | "dblflat";

/**
 * Find the accidental token in a Pitch node.
 */
function findAccidentalInPitch(pitchNode: CSNode): CSNode | null {
  let current = pitchNode.firstChild;

  while (current !== null) {
    if (isTokenNode(current) && getTokenData(current).tokenType === TT.ACCIDENTAL) {
      return current;
    }
    current = current.nextSibling;
  }
  return null;
}

/**
 * Find the NOTE_LETTER token in a Pitch node.
 */
function findNoteLetterInPitch(pitchNode: CSNode): CSNode | null {
  let current = pitchNode.firstChild;

  while (current !== null) {
    if (isTokenNode(current) && getTokenData(current).tokenType === TT.NOTE_LETTER) {
      return current;
    }
    current = current.nextSibling;
  }
  return null;
}

/**
 * Get the current accidental state from a Pitch node.
 */
function getAccidentalState(pitchNode: CSNode): AccidentalState {
  const accNode = findAccidentalInPitch(pitchNode);
  if (accNode === null) return "none";

  const lexeme = getTokenData(accNode).lexeme;
  switch (lexeme) {
    case "^":
      return "sharp";
    case "_":
      return "flat";
    case "=":
      return "natural";
    case "^^":
      return "dblsharp";
    case "__":
      return "dblflat";
    default:
      return "none";
  }
}

/**
 * Create an accidental token CSNode.
 */
function createAccidentalNode(lexeme: string, ctx: ABCContext): CSNode {
  return createCSNode(TAGS.Token, ctx.generateId(), {
    lexeme: lexeme,
    tokenType: TT.ACCIDENTAL,
    line: 0,
    position: 0,
  });
}

/**
 * Apply sharp accidental logic to a Note node.
 *
 * Progression:
 * - none → sharp
 * - flat → natural (remove accidental)
 * - natural → sharp
 * - sharp → dblsharp
 * - dblflat → flat
 * - dblsharp → (no change, already maximum)
 */
function applySharpToNote(noteNode: CSNode, ctx: ABCContext): void {
  const pitchNode = findChildByTag(noteNode, TAGS.Pitch);
  if (pitchNode === null) return;
  const currentState = getAccidentalState(pitchNode);
  const accNode = findAccidentalInPitch(pitchNode);

  switch (currentState) {
    case "none": {
      const noteLetterNode = findNoteLetterInPitch(pitchNode);
      if (noteLetterNode !== null) {
        const sharpNode = createAccidentalNode("^", ctx);
        insertBefore(noteLetterNode, sharpNode);
      }
      break;
    }

    case "flat":
      if (accNode !== null) {
        remove(accNode);
      }
      break;

    case "natural":
      if (accNode !== null) {
        const sharpNode = createAccidentalNode("^", ctx);
        replace(accNode, sharpNode);
      }
      break;

    case "sharp":
      if (accNode !== null) {
        const dblSharpNode = createAccidentalNode("^^", ctx);
        replace(accNode, dblSharpNode);
      }
      break;

    case "dblflat":
      if (accNode !== null) {
        const flatNode = createAccidentalNode("_", ctx);
        replace(accNode, flatNode);
      }
      break;

    case "dblsharp":
      // Already maximum, no change
      break;
  }
}

/**
 * Apply flat accidental logic to a Note node.
 *
 * Progression:
 * - none → flat
 * - sharp → natural (remove accidental)
 * - natural → flat
 * - flat → dblflat
 * - dblsharp → sharp
 * - dblflat → (no change, already maximum)
 */
function applyFlatToNote(noteNode: CSNode, ctx: ABCContext): void {
  const pitchNode = findChildByTag(noteNode, TAGS.Pitch);
  if (pitchNode === null) return;
  const currentState = getAccidentalState(pitchNode);
  const accNode = findAccidentalInPitch(pitchNode);

  switch (currentState) {
    case "none": {
      const noteLetterNode = findNoteLetterInPitch(pitchNode);
      if (noteLetterNode !== null) {
        const flatNode = createAccidentalNode("_", ctx);
        insertBefore(noteLetterNode, flatNode);
      }
      break;
    }

    case "sharp":
      if (accNode !== null) {
        remove(accNode);
      }
      break;

    case "natural":
      if (accNode !== null) {
        const flatNode = createAccidentalNode("_", ctx);
        replace(accNode, flatNode);
      }
      break;

    case "flat":
      if (accNode !== null) {
        const dblFlatNode = createAccidentalNode("__", ctx);
        replace(accNode, dblFlatNode);
      }
      break;

    case "dblsharp":
      if (accNode !== null) {
        const sharpNode = createAccidentalNode("^", ctx);
        replace(accNode, sharpNode);
      }
      break;

    case "dblflat":
      // Already maximum, no change
      break;
  }
}

/**
 * Add a sharp to selected notes.
 *
 * When a chord is selected, all notes within the chord are modified.
 */
export function addSharp(selection: Selection, ctx: ABCContext): Selection {
  for (const cursor of selection.cursors) {
    const nodes = findNodesById(selection.root, cursor);
    for (const node of nodes) {
      if (node.tag === TAGS.Note) {
        applySharpToNote(node, ctx);
      } else if (node.tag === TAGS.Chord) {
        let child = node.firstChild;
        while (child !== null) {
          if (child.tag === TAGS.Note) {
            applySharpToNote(child, ctx);
          }
          child = child.nextSibling;
        }
      }
    }
  }
  return selection;
}

/**
 * Add a flat to selected notes.
 *
 * When a chord is selected, all notes within the chord are modified.
 */
export function addFlat(selection: Selection, ctx: ABCContext): Selection {
  for (const cursor of selection.cursors) {
    const nodes = findNodesById(selection.root, cursor);
    for (const node of nodes) {
      if (node.tag === TAGS.Note) {
        applyFlatToNote(node, ctx);
      } else if (node.tag === TAGS.Chord) {
        let child = node.firstChild;
        while (child !== null) {
          if (child.tag === TAGS.Note) {
            applyFlatToNote(child, ctx);
          }
          child = child.nextSibling;
        }
      }
    }
  }
  return selection;
}
