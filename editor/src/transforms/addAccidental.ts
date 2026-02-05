import { ABCContext, TT } from "abc-parser";
import { Selection } from "../selection";
import { CSNode, TAGS, isTokenNode, getTokenData, createCSNode } from "../csTree/types";
import { findNodesById } from "./types";
import { findChildByTag, removeChild, replaceChild, insertBefore } from "./treeUtils";

type AccidentalState = "none" | "sharp" | "flat" | "natural" | "dblsharp" | "dblflat";

/**
 * Find the accidental token in a Pitch node.
 * Returns the token node and its predecessor for removal/replacement.
 */
function findAccidentalInPitch(
  pitchNode: CSNode
): { node: CSNode; prev: CSNode | null } | null {
  let prev: CSNode | null = null;
  let current = pitchNode.firstChild;

  while (current !== null) {
    if (isTokenNode(current) && getTokenData(current).tokenType === TT.ACCIDENTAL) {
      return { node: current, prev };
    }
    prev = current;
    current = current.nextSibling;
  }
  return null;
}

/**
 * Find the NOTE_LETTER token in a Pitch node.
 */
function findNoteLetterInPitch(
  pitchNode: CSNode
): { node: CSNode; prev: CSNode | null } | null {
  let prev: CSNode | null = null;
  let current = pitchNode.firstChild;

  while (current !== null) {
    if (isTokenNode(current) && getTokenData(current).tokenType === TT.NOTE_LETTER) {
      return { node: current, prev };
    }
    prev = current;
    current = current.nextSibling;
  }
  return null;
}

/**
 * Get the current accidental state from a Pitch node.
 */
function getAccidentalState(pitchNode: CSNode): AccidentalState {
  const accResult = findAccidentalInPitch(pitchNode);
  if (accResult === null) return "none";

  const lexeme = getTokenData(accResult.node).lexeme;
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
    type: "token",
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
  const pitchResult = findChildByTag(noteNode, TAGS.Pitch);
  if (pitchResult === null) return;

  const pitchNode = pitchResult.node;
  const currentState = getAccidentalState(pitchNode);
  const accResult = findAccidentalInPitch(pitchNode);

  switch (currentState) {
    case "none": {
      const noteLetterResult = findNoteLetterInPitch(pitchNode);
      if (noteLetterResult !== null) {
        const sharpNode = createAccidentalNode("^", ctx);
        insertBefore(pitchNode, noteLetterResult.prev, noteLetterResult.node, sharpNode);
      }
      break;
    }

    case "flat":
      if (accResult !== null) {
        removeChild(pitchNode, accResult.prev, accResult.node);
      }
      break;

    case "natural":
      if (accResult !== null) {
        const sharpNode = createAccidentalNode("^", ctx);
        replaceChild(pitchNode, accResult.prev, accResult.node, sharpNode);
      }
      break;

    case "sharp":
      if (accResult !== null) {
        const dblSharpNode = createAccidentalNode("^^", ctx);
        replaceChild(pitchNode, accResult.prev, accResult.node, dblSharpNode);
      }
      break;

    case "dblflat":
      if (accResult !== null) {
        const flatNode = createAccidentalNode("_", ctx);
        replaceChild(pitchNode, accResult.prev, accResult.node, flatNode);
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
  const pitchResult = findChildByTag(noteNode, TAGS.Pitch);
  if (pitchResult === null) return;

  const pitchNode = pitchResult.node;
  const currentState = getAccidentalState(pitchNode);
  const accResult = findAccidentalInPitch(pitchNode);

  switch (currentState) {
    case "none": {
      const noteLetterResult = findNoteLetterInPitch(pitchNode);
      if (noteLetterResult !== null) {
        const flatNode = createAccidentalNode("_", ctx);
        insertBefore(pitchNode, noteLetterResult.prev, noteLetterResult.node, flatNode);
      }
      break;
    }

    case "sharp":
      if (accResult !== null) {
        removeChild(pitchNode, accResult.prev, accResult.node);
      }
      break;

    case "natural":
      if (accResult !== null) {
        const flatNode = createAccidentalNode("_", ctx);
        replaceChild(pitchNode, accResult.prev, accResult.node, flatNode);
      }
      break;

    case "flat":
      if (accResult !== null) {
        const dblFlatNode = createAccidentalNode("__", ctx);
        replaceChild(pitchNode, accResult.prev, accResult.node, dblFlatNode);
      }
      break;

    case "dblsharp":
      if (accResult !== null) {
        const sharpNode = createAccidentalNode("^", ctx);
        replaceChild(pitchNode, accResult.prev, accResult.node, sharpNode);
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
