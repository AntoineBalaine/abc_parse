import { ABCContext, TT } from "abc-parser";
import { remove, appendChild } from "cstree";
import { createCSNode, CSNode, TAGS, isTokenNode, getTokenData } from "../csTree/types";
import { Selection } from "../selection";
import { findRhythmChild } from "./treeUtils";
import { findNodesById } from "./types";

/**
 * Finds the first leaf Token descendant of a node and returns its line and position.
 */
function firstLeafPosition(node: CSNode): { line: number; position: number } | null {
  if (isTokenNode(node)) {
    const data = getTokenData(node);
    return { line: data.line, position: data.position };
  }
  let child = node.firstChild;
  while (child !== null) {
    const result = firstLeafPosition(child);
    if (result !== null) return result;
    child = child.nextSibling;
  }
  return null;
}

export function toRest(selection: Selection, ctx: ABCContext): Selection {
  for (const cursor of selection.cursors) {
    const nodes = findNodesById(selection.root, cursor);
    for (const csNode of nodes) {
      if (csNode.tag === TAGS.Note) {
        noteToRest(csNode, ctx);
      } else if (csNode.tag === TAGS.Chord) {
        chordToRest(csNode, ctx);
      }
    }
  }
  return selection;
}

export function noteToRest(csNode: CSNode, ctx: ABCContext): void {
  // Preserve rhythm if present (including any broken token within the Rhythm subtree)
  const rhythmNode = findRhythmChild(csNode);
  if (rhythmNode) remove(rhythmNode);

  // Capture the original position from the first leaf token before removing
  // children, so that the rest token inherits it. This is needed by the
  // explosion transform's trimToSelection, which uses character positions
  // to determine overlap.
  const orig = firstLeafPosition(csNode) ?? { line: 0, position: 0 };

  // Remove all existing children
  while (csNode.firstChild) remove(csNode.firstChild);

  // Create rest Token CSNode
  const restToken = createCSNode(TAGS.Token, ctx.generateId(), {
    lexeme: "z",
    tokenType: TT.REST,
    line: orig.line,
    position: orig.position,
  });

  // Rebuild child chain: [REST_TOKEN, Rhythm?]
  csNode.tag = TAGS.Rest;
  appendChild(csNode, restToken);
  if (rhythmNode) appendChild(csNode, rhythmNode);
}

export function chordToRest(csNode: CSNode, ctx: ABCContext): void {
  // Resolve rhythm: chord's own Rhythm child takes precedence.
  let rhythmNode: CSNode | null = findRhythmChild(csNode);
  if (rhythmNode === null) {
    // Look for rhythm in the first Note child
    let current = csNode.firstChild;
    while (current !== null) {
      if (current.tag === TAGS.Note) {
        rhythmNode = findRhythmChild(current);
        if (rhythmNode) remove(rhythmNode);
        break;
      }
      current = current.nextSibling;
    }
  } else {
    remove(rhythmNode);
  }

  // Capture the original position from the first leaf token before removing children.
  const orig = firstLeafPosition(csNode) ?? { line: 0, position: 0 };

  // Remove all existing children
  while (csNode.firstChild) remove(csNode.firstChild);

  // Create rest Token CSNode
  const restToken = createCSNode(TAGS.Token, ctx.generateId(), {
    lexeme: "z",
    tokenType: TT.REST,
    line: orig.line,
    position: orig.position,
  });

  // Rebuild child chain: [REST_TOKEN, Rhythm?]
  csNode.tag = TAGS.Rest;
  appendChild(csNode, restToken);
  if (rhythmNode) appendChild(csNode, rhythmNode);
}
