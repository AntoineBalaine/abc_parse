import { Selection } from "../selection";
import { CSNode, isRest, isBarLine, isTokenNode, getTokenData } from "../csTree/types";
import { ABCContext, addRational, equalRational, TT } from "abc-parser";
import { findNodesById } from "./types";
import { getNodeRhythm, rationalToRhythm } from "./rhythm";
import { findParent, replaceRhythm, removeChild } from "./treeUtils";
import { isPowerOfTwoRational, nextMeaningfulSibling } from "./consolidationUtils";
import { isVoiceMarker } from "../selectors/voiceSelector";

/**
 * Extracts the rest type ('z' or 'x') from a Rest node.
 */
function getRestType(restNode: CSNode): string | null {
  let current = restNode.firstChild;
  while (current !== null) {
    if (isTokenNode(current)) {
      const tokenData = getTokenData(current);
      if (tokenData.tokenType === TT.REST) {
        return tokenData.lexeme;
      }
    }
    current = current.nextSibling;
  }
  return null;
}

/**
 * Performs a single pass of rest consolidation.
 * Returns true if any consolidation was performed.
 */
function consolidatePass(selection: Selection, ctx: ABCContext, consumedIds: Set<number>): boolean {
  let changed = false;

  for (const cursor of selection.cursors) {
    const nodes = findNodesById(selection.root, cursor);
    const restNodes = nodes.filter(isRest);

    for (const restNode of restNodes) {
      if (consumedIds.has(restNode.id)) {
        continue;
      }

      const restType = getRestType(restNode);
      if (restType === null) {
        continue;
      }

      const rhythm1 = getNodeRhythm(restNode);
      const next = nextMeaningfulSibling(restNode);

      if (next === null) {
        continue;
      }
      if (isBarLine(next) || isVoiceMarker(next)) {
        continue;
      }
      if (!isRest(next)) {
        continue;
      }

      const nextRestType = getRestType(next);
      if (nextRestType !== restType) {
        continue;
      }

      const rhythm2 = getNodeRhythm(next);
      if (!equalRational(rhythm1, rhythm2)) {
        continue;
      }

      const summed = addRational(rhythm1, rhythm2);
      if (!isPowerOfTwoRational(summed)) {
        continue;
      }

      // Perform the consolidation
      const newRhythm = rationalToRhythm(summed, ctx);
      replaceRhythm(restNode, newRhythm);

      // Remove the next rest from the tree
      const parentResult = findParent(selection.root, next);
      if (parentResult !== null) {
        removeChild(parentResult.parent, parentResult.prev, next);
      }

      consumedIds.add(next.id);
      cursor.delete(next.id);
      changed = true;
    }
  }

  return changed;
}

/**
 * Consolidates consecutive identical rests into a single rest with doubled duration.
 *
 * The transform uses a conservative approach: it only performs "safe" consolidations
 * where both rests have identical duration and the result is a power-of-two duration
 * (no dotted rests).
 *
 * Valid consolidations:
 * - z/8 + z/8 becomes z/4
 * - z/4 + z/4 becomes z/2
 * - z/2 + z/2 becomes z
 * - z/16 + z/16 becomes z/8
 *
 * Invalid (skipped):
 * - z/8 + z/4 (different durations)
 * - z/8 + z/8 + z/8 would yield z3/8 (result is dotted, not power-of-2)
 * - z + x (different rest types)
 *
 * Consolidation stops at bar lines and voice-changing inline fields.
 *
 * The transform is idempotent: it loops until no more consolidations are possible,
 * so applying it twice yields the same result as applying it once.
 */
export function consolidateRests(selection: Selection, ctx: ABCContext): Selection {
  const consumedIds = new Set<number>();

  // Loop until no more consolidations can be made (idempotent)
  while (consolidatePass(selection, ctx, consumedIds)) {
    // Continue until no changes
  }

  return selection;
}
