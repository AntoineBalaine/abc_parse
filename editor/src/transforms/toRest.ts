import { ABCContext, TT } from "abc-parser";
import { remove, appendChild } from "cstree";
import { createCSNode, CSNode, TAGS } from "../csTree/types";
import { Selection } from "../selection";
import { findRhythmChild } from "./treeUtils";
import { findNodesById } from "./types";

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

  // Remove all existing children
  while (csNode.firstChild) remove(csNode.firstChild);

  // Create rest Token CSNode
  const restToken = createCSNode(TAGS.Token, ctx.generateId(), {
    lexeme: "z",
    tokenType: TT.REST,
    line: 0,
    position: 0,
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

  // Remove all existing children
  while (csNode.firstChild) remove(csNode.firstChild);

  // Create rest Token CSNode
  const restToken = createCSNode(TAGS.Token, ctx.generateId(), {
    lexeme: "z",
    tokenType: TT.REST,
    line: 0,
    position: 0,
  });

  // Rebuild child chain: [REST_TOKEN, Rhythm?]
  csNode.tag = TAGS.Rest;
  appendChild(csNode, restToken);
  if (rhythmNode) appendChild(csNode, rhythmNode);
}
