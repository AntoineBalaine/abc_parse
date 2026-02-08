import { Selection } from "../selection";
import { CSNode, TAGS, isNote, isChord, isYSpacer, createCSNode } from "../csTree/types";
import { ABCContext, TT } from "abc-parser";
import { findParent, replaceChild, findTieChild, replaceRhythm, appendChild } from "./treeUtils";
import { getNodeRhythm, rationalToRhythm } from "./rhythm";
import { consolidateTiedNotes } from "./consolidateTiedNotes";
import { reassignIds } from "./lineUtils";
import { isVoiceMarker } from "../selectors/voiceSelector";

interface ReplacementRecord {
  old: CSNode;
  new: CSNode;
  parent: CSNode;
  prev: CSNode | null;
}

interface LegatoContext {
  currentSource: CSNode | null;
  replacements: ReplacementRecord[];
  selectedIds: Set<number>;
  ctx: ABCContext;
  root: CSNode;
}

/**
 * We only target regular rests (TAGS.Rest), not multi-measure rests (TAGS.MultiMeasureRest).
 * Because multi-measure rests represent multiple bars of silence, filling them with tied notes
 * would be semantically incorrect.
 */
function isRegularRest(node: CSNode): boolean {
  return node.tag === TAGS.Rest;
}

function isSource(node: CSNode): boolean {
  return isNote(node) || isChord(node);
}

function isTarget(node: CSNode): boolean {
  return isRegularRest(node) || isYSpacer(node);
}

function isMultiMeasureRest(node: CSNode): boolean {
  return node.tag === TAGS.MultiMeasureRest;
}

/**
 * We use structuredClone for a deep copy, then reassign fresh IDs to avoid ID collisions.
 */
function cloneNode(node: CSNode, ctx: ABCContext): CSNode {
  const cloned = structuredClone(node);
  reassignIds(cloned, ctx);
  return cloned;
}

/**
 * If the node already has a tie, we do nothing.
 */
function addTieToNode(node: CSNode, ctx: ABCContext): void {
  if (findTieChild(node) !== null) {
    return;
  }

  const tieToken = createCSNode(TAGS.Token, ctx.generateId(), {
    type: "token",
    lexeme: "-",
    tokenType: TT.TIE,
    line: 0,
    position: 0,
  });

  appendChild(node, tieToken);
}

/**
 * The clone inherits the rhythm of the target (rest or y-spacer) it replaces.
 * This ensures the musical duration is preserved.
 */
function copyRhythmFromTarget(target: CSNode, clone: CSNode, ctx: ABCContext): void {
  const targetRhythm = getNodeRhythm(target);
  const newRhythmNode = rationalToRhythm(targetRhythm, ctx);
  replaceRhythm(clone, newRhythmNode);
}

function traverseSiblings(startNode: CSNode | null, legatoCtx: LegatoContext): void {
  let current = startNode;

  while (current !== null) {
    const next = current.nextSibling;
    const isSelected = legatoCtx.selectedIds.has(current.id);

    // We only process nodes that are in the selection.
    if (isSelected) {
      // Voice markers reset the current source because different voices are musically independent.
      if (isVoiceMarker(current)) {
        legatoCtx.currentSource = null;
        current = next;
        continue;
      }

      // Multi-measure rests reset the current source because they represent multiple bars
      // of silence and should not be filled. They act as boundaries similar to voice markers.
      if (isMultiMeasureRest(current)) {
        legatoCtx.currentSource = null;
        current = next;
        continue;
      }

      // Notes and chords become the current source for subsequent rest filling.
      if (isSource(current)) {
        legatoCtx.currentSource = current;
        current = next;
        continue;
      }

      // Rests and y-spacers get replaced if we have a source to copy from.
      if (isTarget(current) && legatoCtx.currentSource !== null) {
        const cloned = cloneNode(legatoCtx.currentSource, legatoCtx.ctx);
        copyRhythmFromTarget(current, cloned, legatoCtx.ctx);
        addTieToNode(legatoCtx.currentSource, legatoCtx.ctx);

        const parentResult = findParent(legatoCtx.root, current);
        if (parentResult !== null) {
          legatoCtx.replacements.push({
            old: current,
            new: cloned,
            parent: parentResult.parent,
            prev: parentResult.prev,
          });
        }

        // The clone becomes the new source so that subsequent rests are tied to it.
        legatoCtx.currentSource = cloned;
        current = next;
        continue;
      }
    }

    // We always descend into nodes with children to find nested selected nodes.
    // This is necessary because container nodes like Tune, Tune_Body, System, and Beam
    // are typically not in the selection, but their children may be.
    if (current.firstChild !== null) {
      traverseSiblings(current.firstChild, legatoCtx);
    }

    current = next;
  }
}

function applyReplacements(replacements: ReplacementRecord[], cursor: Set<number>): void {
  for (const { old, new: newNode, parent, prev } of replacements) {
    replaceChild(parent, prev, old, newNode);
    cursor.delete(old.id);
    cursor.add(newNode.id);
  }
}

/**
 * Recursive traversal helper that collects notes and chords in document order.
 * The traversal is left-to-right, depth-first, which produces document order.
 */
function traverseNotesAndChords(node: CSNode | null, cursor: Set<number>, result: CSNode[]): void {
  while (node !== null) {
    if (cursor.has(node.id) && isSource(node)) {
      result.push(node);
    }
    // Descend into children (handles Beam, System, and other container nodes)
    if (node.firstChild !== null) {
      traverseNotesAndChords(node.firstChild, cursor, result);
    }
    node = node.nextSibling;
  }
}

/**
 * We collect notes and chords in document order using recursive traversal.
 */
function collectNotesAndChordsInOrder(root: CSNode, cursor: Set<number>): CSNode[] {
  const result: CSNode[] = [];
  traverseNotesAndChords(root.firstChild, cursor, result);
  return result;
}

function removeTrailingTie(cursor: Set<number>, root: CSNode): void {
  const notesAndChords = collectNotesAndChordsInOrder(root, cursor);

  if (notesAndChords.length === 0) {
    return;
  }

  // The last element in the document-ordered array has no successors in the cursor
  // by definition, so if it has a tie, that tie is trailing and should be removed.
  const last = notesAndChords[notesAndChords.length - 1];
  const tieResult = findTieChild(last);

  if (tieResult !== null) {
    // Because this is the last note in the selection, we remove the tie.
    if (tieResult.prev === null) {
      last.firstChild = tieResult.node.nextSibling;
    } else {
      tieResult.prev.nextSibling = tieResult.node.nextSibling;
    }
    tieResult.node.nextSibling = null;
  }
}

/**
 * The legato transform fills rests and y-spacers between notes or chords
 * with tied copies of the preceding note or chord. This creates a sustained,
 * connected (legato) sound where previously there were gaps.
 *
 * The transform operates in three stages:
 * 1. Replacement: iterate through the selection left-to-right, replacing
 *    rests and y-spacers with tied copies of the preceding note/chord.
 * 2. Consolidation: consolidate consecutive tied notes with identical pitch
 *    within each bar.
 * 3. Trailing tie removal: remove any tie on the last note in the selection
 *    if it has no successor to connect to.
 *
 * Boundary conditions:
 * - Voice markers [V:...] reset the chain because different voices are independent.
 * - Bar lines do not reset the chain, but consolidation only operates within bars.
 * - Multi-measure rests are not replaced (they represent multiple bars of silence).
 * - Selection boundaries are respected: nodes outside the cursor are not modified.
 */
export function legato(selection: Selection, ctx: ABCContext): Selection {
  // Stage 1: Replacement pass
  for (const cursor of selection.cursors) {
    const legatoCtx: LegatoContext = {
      currentSource: null,
      replacements: [],
      selectedIds: cursor,
      ctx,
      root: selection.root,
    };

    traverseSiblings(selection.root.firstChild, legatoCtx);
    applyReplacements(legatoCtx.replacements, cursor);
  }

  // Stage 2: Consolidation
  consolidateTiedNotes(selection, ctx);

  // Stage 3: Trailing tie removal
  for (const cursor of selection.cursors) {
    removeTrailingTie(cursor, selection.root);
  }

  return selection;
}
