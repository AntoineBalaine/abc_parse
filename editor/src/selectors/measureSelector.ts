/**
 * Measure selector for the editor module.
 *
 * Selects all musical elements within a specified measure range.
 * Measures are delimited by bar lines, with the content before the first
 * bar line considered measure 1.
 */

import { CSNode, TAGS } from "../csTree/types";
import { Selection } from "../selection";
import { findByTag } from "./treeWalk";

interface MeasureWalkCtx {
  startMeasure: number;
  endMeasure: number;
  outputCursors: Set<number>[];
}

function isMusicElement(node: CSNode): boolean {
  return node.tag === TAGS.Note
    || node.tag === TAGS.Chord
    || node.tag === TAGS.Rest
    || node.tag === TAGS.Beam
    || node.tag === TAGS.Grace_group
    || node.tag === TAGS.MultiMeasureRest
    || node.tag === TAGS.Tuplet;
}

function walkForMeasures(ctx: MeasureWalkCtx, root: CSNode): void {
  const bodies = findByTag(root, TAGS.Tune_Body);

  for (const body of bodies) {
    let currentMeasure = 1;
    let child = body.firstChild;

    while (child !== null) {
      if (child.tag === TAGS.BarLine) {
        currentMeasure++;
      } else if (isMusicElement(child)) {
        if (currentMeasure >= ctx.startMeasure && currentMeasure <= ctx.endMeasure) {
          ctx.outputCursors.push(new Set([child.id]));
        }
      }
      child = child.nextSibling;
    }
  }
}

/**
 * Selects all musical elements within a measure range.
 *
 * @param input - The input selection
 * @param start - Start measure number (inclusive, 1-indexed)
 * @param end - End measure number (inclusive, 1-indexed)
 * @returns A new Selection containing cursors for all elements in the range,
 *          or the original selection if parameters are invalid
 */
export function selectMeasures(input: Selection, start: number, end: number): Selection {
  if (!Number.isInteger(start) || start < 1) {
    return input;
  }
  if (!Number.isInteger(end) || end < 1) {
    return input;
  }
  if (start > end) {
    return input;
  }

  const outputCursors: Set<number>[] = [];
  const ctx: MeasureWalkCtx = { startMeasure: start, endMeasure: end, outputCursors };
  walkForMeasures(ctx, input.root);
  return { root: input.root, cursors: outputCursors };
}
