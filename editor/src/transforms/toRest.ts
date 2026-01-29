import { Selection } from "../selection";
import { CSNode, TAGS, createCSNode } from "../csTree/types";
import { ABCContext, TT } from "abc-parser";
import { findNodesById } from "./types";
import { findRhythmChild } from "./treeUtils";

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
  const rhythmResult = findRhythmChild(csNode);
  const rhythmNode = rhythmResult ? rhythmResult.node : null;

  // Create rest Token CSNode
  const restToken = createCSNode(TAGS.Token, ctx.generateId(), {
    type: "token", lexeme: "z", tokenType: TT.REST, line: 0, position: 0
  });

  // Rebuild child chain: [REST_TOKEN, Rhythm?]
  csNode.tag = TAGS.Rest;
  csNode.firstChild = restToken;
  if (rhythmNode) {
    rhythmNode.nextSibling = null;
    restToken.nextSibling = rhythmNode;
  } else {
    restToken.nextSibling = null;
  }
}

export function chordToRest(csNode: CSNode, ctx: ABCContext): void {
  // Resolve rhythm: chord's own Rhythm child takes precedence.
  let rhythmNode: CSNode | null = null;
  const rhythmResult = findRhythmChild(csNode);
  if (rhythmResult) {
    rhythmNode = rhythmResult.node;
  } else {
    // Look for rhythm in the first Note child
    let current = csNode.firstChild;
    while (current !== null) {
      if (current.tag === TAGS.Note) {
        const noteRhythm = findRhythmChild(current);
        if (noteRhythm) {
          rhythmNode = noteRhythm.node;
        }
        break;
      }
      current = current.nextSibling;
    }
  }

  // Create rest Token CSNode
  const restToken = createCSNode(TAGS.Token, ctx.generateId(), {
    type: "token", lexeme: "z", tokenType: TT.REST, line: 0, position: 0
  });

  // Rebuild child chain: [REST_TOKEN, Rhythm?]
  csNode.tag = TAGS.Rest;
  csNode.firstChild = restToken;
  if (rhythmNode) {
    rhythmNode.nextSibling = null;
    restToken.nextSibling = rhythmNode;
  } else {
    restToken.nextSibling = null;
  }
}
