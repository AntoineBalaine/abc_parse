/**
 * Measure selector for the editor module.
 *
 * Splits the input selection by barlines, returning one cursor per measure.
 * Contiguous elements within each measure are grouped into a single cursor.
 * Barlines act as delimiters and are excluded from the output.
 */

import { CSNode, TAGS, isTokenNode, getTokenData } from "../csTree/types";
import { Selection } from "../selection";
import { findByTag } from "./treeWalk";
import {
  collectCursorIds,
  expandScopeToDescendants,
  isInScope,
} from "./scopeUtils";

interface MeasureWalkCtx {
  outputCursors: Set<number>[];
  currentRun: Set<number>;
  scopeIds: Set<number>;
  hasScope: boolean;
  foundMatch: boolean;
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

/**
 * Checks if a node is an inline voice marker [V:...].
 * Inline voice markers act as measure delimiters because switching voices
 * starts a new musical context.
 */
function isInlineVoiceMarker(node: CSNode): boolean {
  if (node.tag !== TAGS.Inline_field) {
    return false;
  }
  const headerChild = node.firstChild?.nextSibling;
  if (headerChild === null || headerChild === undefined || !isTokenNode(headerChild)) {
    return false;
  }
  return getTokenData(headerChild).lexeme.trim().startsWith("V:");
}

/**
 * Flushes the current run of contiguous matching elements to outputCursors.
 */
function flushCurrentRun(ctx: MeasureWalkCtx): void {
  if (ctx.currentRun.size > 0) {
    ctx.outputCursors.push(ctx.currentRun);
    ctx.currentRun = new Set<number>();
  }
}

/**
 * Walks the children of a container node (Tune_Body, System, or Music_code), splitting
 * by barlines and collecting music elements that are in scope.
 * Recurses into System and Music_code nodes because the CSTree wraps tune body content
 * in System nodes, and multi-line tunes have barlines inside Music_code children.
 */
function walkChildren(ctx: MeasureWalkCtx, containerNode: CSNode): void {
  let child = containerNode.firstChild;
  while (child !== null) {
    // Recurse into System nodes (Tune_Body's direct children after CSTree conversion).
    // Because System nodes represent line boundaries in ABC source, and a line break
    // implicitly ends the current measure (since ABC notation is displayed line by line),
    // we flush measures at System boundaries to prevent content from one line carrying
    // over to the next. This differs from voiceSelector which does NOT flush at System
    // boundaries because voices span multiple lines.
    if (child.tag === TAGS.System) {
      walkChildren(ctx, child);
      flushCurrentRun(ctx);
    } else if (child.tag === TAGS.Music_code) {
      walkChildren(ctx, child);
    } else if (child.tag === TAGS.BarLine) {
      flushCurrentRun(ctx);
    } else if (isInlineVoiceMarker(child)) {
      // Inline voice markers act as measure delimiters because switching voices
      // starts a new musical context. This also works around CSTree not creating
      // separate System nodes for consecutive lines starting with voice markers.
      flushCurrentRun(ctx);
    } else if (isMusicElement(child) && isInScope(child, ctx.scopeIds, ctx.hasScope)) {
      ctx.foundMatch = true;
      ctx.currentRun.add(child.id);
    }
    child = child.nextSibling;
  }
}

/**
 * Walks all tune bodies in the tree, splitting content by barlines into
 * separate cursors.
 */
function walkForMeasures(ctx: MeasureWalkCtx, root: CSNode): void {
  const tuneBodies = findByTag(root, TAGS.Tune_Body);

  for (const tuneBody of tuneBodies) {
    walkChildren(ctx, tuneBody);
    flushCurrentRun(ctx);
  }
}

/**
 * Splits the input selection by barlines, returning one cursor per measure.
 *
 * Behavior:
 * - Respects input selection scope: only elements within the input cursors are included
 * - Splits by barlines: each measure becomes a separate cursor
 * - Groups contiguous elements: all elements within a measure are grouped into one cursor
 * - Barlines are excluded: they act as delimiters only
 *
 * Edge cases:
 * - Empty input selection (no cursors or only root): processes entire document
 * - Selection spans multiple tunes: each tune body processed independently
 * - Selection covers partial measure: only selected elements within that measure are included
 * - No elements in scope: returns original input selection
 * - All elements are barlines: returns empty cursors
 *
 * @param input - The input selection
 * @returns A new Selection with one cursor per measure containing grouped element IDs,
 *          or the original selection if no music elements were found in scope
 */
export function selectMeasures(input: Selection): Selection {
  const rawScopeIds = collectCursorIds(input.cursors);

  const hasScope =
    input.cursors.length > 0 &&
    !(input.cursors.length === 1 && input.cursors[0].size === 1 && input.cursors[0].has(input.root.id));

  const scopeIds = hasScope ? expandScopeToDescendants(input.root, rawScopeIds) : rawScopeIds;

  const outputCursors: Set<number>[] = [];
  const ctx: MeasureWalkCtx = {
    outputCursors,
    currentRun: new Set<number>(),
    scopeIds,
    hasScope,
    foundMatch: false,
  };

  walkForMeasures(ctx, input.root);

  if (!ctx.foundMatch) {
    return input;
  }

  return { root: input.root, cursors: outputCursors };
}
