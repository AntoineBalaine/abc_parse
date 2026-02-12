/**
 * toSlashNotation Transform
 *
 * Converts selected measures to slash notation by replacing time-sensitive content
 * (notes, chords, rests) with stemless quarter-note slashes (B0), wrapped in style markers.
 *
 * The number of slashes is calculated based on the total duration of selected content
 * divided by 1/4 (quarter note visual spacing), using rational arithmetic for accuracy.
 *
 * Duration calculations are measure-sensitive: each measure's content is calculated
 * separately, and broken rhythm does not persist across barlines.
 */

import { CSNode, TAGS, isTokenNode, getTokenData, isBarLine } from "../csTree/types";
import { firstTokenData } from "../selectors/treeWalk";
import { Selection } from "../selection";
import { fromAst } from "../csTree/fromAst";
import { findParent, removeChild } from "./treeUtils";
import { DocumentSnapshots, ContextSnapshot, getRangeSnapshots, encode } from "abc-parser/interpreter/ContextInterpreter";
import { Range } from "abc-parser/types/types";
import { ABCContext } from "abc-parser/parsers/Context";
import { Token, TT } from "abc-parser/parsers/scan2";
import { Note, Pitch, Rhythm, Inline_field } from "abc-parser/types/Expr2";
import { ClefProperties, ClefType } from "abc-parser/types/abcjs-ast";
import { IRational, createRational, addRational, multiplyRational, divideRational, greaterRational } from "abc-parser/Visitors/fmt2/rational";

// ============================================================================
// Types
// ============================================================================

/**
 * A contiguous region of selected nodes that should be processed together.
 * Regions are split by voice markers since each voice may have different context.
 * Extends Selection to maintain cursor information.
 */
interface Region extends Selection {
  parent: CSNode;
  nodes: CSNode[];
  firstIndex: number;
  lastIndex: number;
}

/**
 * State for tracking broken rhythm across notes within a measure.
 * Reset at barlines.
 */
interface BrokenRhythmState {
  nextNoteDurationMultiplier: IRational | undefined;
}

/**
 * A measure segment within a region, containing nodes between barlines.
 */
interface MeasureSegment {
  nodes: CSNode[];
  startIndex: number;
  endIndex: number;
}

/**
 * A region of nodes that share the same context snapshot.
 * Extends Region with a snapshot reference.
 */
interface SnapshotRegion extends Region {
  snapshot: ContextSnapshot;
}

// ============================================================================
// Main Transform
// ============================================================================

/**
 * Converts selected content to slash notation.
 *
 * @param selection The current selection (each cursor is treated as a region)
 * @param tuneSnapshots Context snapshots from ContextInterpreter
 * @param ctx ABC context for generating IDs
 * @returns Updated selection
 */
export function toSlashNotation(selection: Selection, ctx: ABCContext, snapshots: DocumentSnapshots): Selection {
  // Handle empty selection
  if (selection.cursors.length === 0 || selection.cursors.every((c) => c.size === 0)) {
    return selection;
  }

  // Each cursor is treated as its own region
  for (const cursor of selection.cursors) {
    if (cursor.size === 0) continue;

    // 1. Get cursor's range from its nodes
    const range = getCursorRange(cursor, selection.root);
    if (!range) continue;

    // 2. Get all snapshots within range (queries flat list, no voiceId needed)
    const rangeSnapshots = getRangeSnapshots(snapshots, range);
    if (rangeSnapshots.length === 0) continue;

    // Track all measures across all snapshots for this cursor (for style markers)
    const allMeasures: SnapshotRegion[] = [];

    // 3. Iterate snapshots in outer loop
    for (let i = 0; i < rangeSnapshots.length; i++) {
      const { pos: snapshotPos, snapshot } = rangeSnapshots[i];
      const nextSnapshotPos = i < rangeSnapshots.length - 1 ? rangeSnapshots[i + 1].pos : Number.MAX_SAFE_INTEGER;

      // Collect nodes in this snapshot's range (already filtered to tune body)
      const nodesWithParents = collectNodesInRange(cursor, selection.root, snapshotPos, nextSnapshotPos);
      if (nodesWithParents.length === 0) continue;

      // Find common parent for all nodes
      const parent = nodesWithParents[0].parent;

      // 4. Split by barlines - returns SnapshotRegion[] with same snapshot
      const measures = splitByBarlines(nodesWithParents, parent, snapshot, selection.root);
      allMeasures.push(...measures);

      const pitch = getPitchForClef(snapshot.clef);
      const expectedMeasureDuration = getExpectedMeasureDuration(snapshot);

      for (const measure of measures) {
        // 5. Calculate duration and generate slashes
        const actualDuration = calculateMeasureDuration(measure.nodes, snapshot);
        // Use min(actual, expected): if actual > expected, use expected
        const targetDuration = greaterRational(actualDuration, expectedMeasureDuration) ? expectedMeasureDuration : actualDuration;
        const quarterNote = createRational(1, 4);
        const slashCountRational = divideRational(targetDuration, quarterNote);
        const slashCount = Math.max(1, Math.round(slashCountRational.numerator / slashCountRational.denominator));

        // Replace measure content with slashes
        replaceWithSlashes(measure, slashCount, pitch, ctx);
      }
    }

    // 6. Insert style markers around first and last measure of this cursor
    if (allMeasures.length > 0) {
      insertStyleMarkers(allMeasures[0], allMeasures[allMeasures.length - 1], ctx);
    }
  }

  return selection;
}

/**
 * Replaces a measure's content with slash notes.
 * Preserves barlines, annotations, and non-context inline fields.
 */
function replaceWithSlashes(measure: SnapshotRegion, slashCount: number, pitch: string, ctx: ABCContext): void {
  if (measure.nodes.length === 0) return;

  // Create slash notes
  const slashes = createSlashNotes(slashCount, pitch, ctx);

  // Find nodes to preserve (barlines, annotations, inline fields except voice markers)
  const toRemove: CSNode[] = [];
  const preserved: CSNode[] = [];
  for (const node of measure.nodes) {
    if (shouldPreserve(node)) {
      preserved.push(node);
    } else {
      toRemove.push(node);
    }
  }

  // Find prev node before the first node in measure
  const firstNode = measure.nodes[0];
  const parentInfo = findParent(measure.parent, firstNode);
  if (!parentInfo) return;

  const anchorPrev = parentInfo.prev;

  // Remove nodes that should be removed
  for (const node of toRemove) {
    const nodeParentInfo = findParent(measure.parent, node);
    if (nodeParentInfo) {
      removeChild(nodeParentInfo.parent, nodeParentInfo.prev, node);
    }
  }

  // Link new slash nodes together
  for (let i = 0; i < slashes.length - 1; i++) {
    slashes[i].nextSibling = slashes[i + 1];
  }

  // Connect the last slash to what comes after
  const nextAfterAnchor = anchorPrev ? anchorPrev.nextSibling : measure.parent.firstChild;
  if (slashes.length > 0) {
    slashes[slashes.length - 1].nextSibling = nextAfterAnchor;

    // Insert the slashes
    if (anchorPrev === null) {
      measure.parent.firstChild = slashes[0];
    } else {
      anchorPrev.nextSibling = slashes[0];
    }
  }

  // Store slashes in measure for style marker insertion
  measure.nodes = slashes;
}

/**
 * Inserts style markers around the first and last measures.
 * Wraps all content between first and last with [K: style=rhythm]...[K: style=normal].
 */
function insertStyleMarkers(firstMeasure: SnapshotRegion, lastMeasure: SnapshotRegion, ctx: ABCContext): void {
  if (firstMeasure.nodes.length === 0) return;

  // Create style markers
  const styleRhythm = createStyleMarker("rhythm", ctx);
  const styleNormal = createStyleMarker("normal", ctx);

  // Insert opening style marker before first measure's first node
  const firstNode = firstMeasure.nodes[0];
  const firstParentInfo = findParent(firstMeasure.parent, firstNode);
  if (firstParentInfo) {
    // Link opening marker to first node
    styleRhythm.nextSibling = firstNode;
    if (firstParentInfo.prev === null) {
      firstMeasure.parent.firstChild = styleRhythm;
    } else {
      firstParentInfo.prev.nextSibling = styleRhythm;
    }
  }

  // Insert closing style marker after last measure's last node
  const lastNode = lastMeasure.nodes[lastMeasure.nodes.length - 1];
  styleNormal.nextSibling = lastNode.nextSibling;
  lastNode.nextSibling = styleNormal;
}

// ============================================================================
// Snapshot-Based Region Processing
// ============================================================================

/**
 * Context object for getCursorRange tree walk.
 */
interface CursorRangeCtx {
  cursor: Set<number>;
  minLine: number;
  minChar: number;
  maxLine: number;
  maxChar: number;
}

/**
 * Tree walk helper for getCursorRange.
 * Traverses the tree and updates the context with min/max positions
 * for tokens that are selected or descendants of selected nodes.
 */
function walkForCursorRange(ctx: CursorRangeCtx, node: CSNode, insideSelected: boolean): void {
  const isSelected = insideSelected || ctx.cursor.has(node.id);

  if (isSelected && isTokenNode(node)) {
    const data = getTokenData(node);
    // Update min
    if (data.line < ctx.minLine || (data.line === ctx.minLine && data.position < ctx.minChar)) {
      ctx.minLine = data.line;
      ctx.minChar = data.position;
    }
    // Update max (use end position: position + lexeme length)
    const endChar = data.position + data.lexeme.length;
    if (data.line > ctx.maxLine || (data.line === ctx.maxLine && endChar > ctx.maxChar)) {
      ctx.maxLine = data.line;
      ctx.maxChar = endChar;
    }
  }

  let child = node.firstChild;
  while (child !== null) {
    walkForCursorRange(ctx, child, isSelected);
    child = child.nextSibling;
  }
}

/**
 * Gets the position range covered by a cursor.
 * Walks the tree to find nodes with IDs in the cursor set
 * and extracts their token positions (including tokens within selected nodes).
 */
function getCursorRange(cursor: Set<number>, root: CSNode): Range | null {
  const ctx: CursorRangeCtx = {
    cursor,
    minLine: Infinity,
    minChar: Infinity,
    maxLine: -1,
    maxChar: -1,
  };

  walkForCursorRange(ctx, root, false);

  if (ctx.minLine === Infinity) return null;

  return {
    start: { line: ctx.minLine, character: ctx.minChar },
    end: { line: ctx.maxLine, character: ctx.maxChar },
  };
}

/**
 * Context object for collectNodesInRange tree walk.
 */
interface CollectNodesCtx {
  cursor: Set<number>;
  startPos: number;
  endPos: number;
  result: Array<{ node: CSNode; parent: CSNode }>;
  collectedIds: Set<number>; // Track IDs we've already added to avoid duplicates
}

/**
 * Tree walk helper for collectNodesInRange.
 * Collects nodes that are selected, within the position range,
 * and inside a Tune_Body.
 *
 * When a selected node is inside a Beam, we collect the Beam instead
 * (at its parent level) since slash notes shouldn't be beamed and
 * we need to replace the entire Beam with slashes.
 *
 * Barlines are always collected (even if not selected) so that
 * splitByBarlines can properly determine measure boundaries.
 */
function walkForCollectNodes(ctx: CollectNodesCtx, node: CSNode, parent: CSNode | null, grandparent: CSNode | null, insideTuneBody: boolean): void {
  // Track whether we've entered a Tune_Body during descent
  const inBody = insideTuneBody || node.tag === TAGS.Tune_Body;

  // Collect barlines in range (always, for measure boundary detection)
  if (inBody && node.tag === TAGS.BarLine && parent && !ctx.collectedIds.has(node.id)) {
    const tokenData = firstTokenData(node);
    if (tokenData) {
      const pos = encode(tokenData.line, tokenData.position);
      if (pos >= ctx.startPos && pos < ctx.endPos) {
        ctx.collectedIds.add(node.id);
        ctx.result.push({ node, parent });
      }
    }
  }

  // Collect selected nodes that are inside the tune body
  if (inBody && ctx.cursor.has(node.id)) {
    const tokenData = firstTokenData(node);
    if (tokenData && parent) {
      const pos = encode(tokenData.line, tokenData.position);
      if (pos >= ctx.startPos && pos < ctx.endPos) {
        // If the node is inside a Beam, collect the Beam instead (at grandparent level)
        // This ensures we replace the entire beamed group with slashes
        if (parent.tag === TAGS.Beam && grandparent && !ctx.collectedIds.has(parent.id)) {
          ctx.collectedIds.add(parent.id);
          ctx.result.push({ node: parent, parent: grandparent });
        } else if (parent.tag !== TAGS.Beam && !ctx.collectedIds.has(node.id)) {
          ctx.collectedIds.add(node.id);
          ctx.result.push({ node, parent });
        }
        // If parent is Beam but we already collected it, skip this node
      }
    }
  }

  let child = node.firstChild;
  while (child !== null) {
    walkForCollectNodes(ctx, child, node, parent, inBody);
    child = child.nextSibling;
  }
}

/**
 * Collects selected nodes whose positions fall within the given range.
 * Used to gather nodes that belong to a specific snapshot's context.
 * Only collects nodes that are inside a Tune_Body (music content, not header).
 *
 * When a selected note is inside a Beam, the Beam is collected instead
 * (at its parent level) so that the entire beamed group can be replaced.
 *
 * @param cursor - Set of selected node IDs
 * @param root - Root of the CSTree
 * @param startPos - Encoded start position (inclusive)
 * @param endPos - Encoded end position (exclusive), or Infinity for last snapshot
 * @returns Array of nodes with their parents
 */
function collectNodesInRange(cursor: Set<number>, root: CSNode, startPos: number, endPos: number): Array<{ node: CSNode; parent: CSNode }> {
  const ctx: CollectNodesCtx = {
    cursor,
    startPos,
    endPos,
    result: [],
    collectedIds: new Set(),
  };

  walkForCollectNodes(ctx, root, null, null, false);
  return ctx.result;
}

/**
 * Splits nodes at barline boundaries into SnapshotRegions.
 * Each resulting region has the same snapshot (barlines don't change context).
 *
 * @param nodes - Nodes to split (from a single snapshot's range)
 * @param parent - Parent node for the regions
 * @param snapshot - Context snapshot that applies to all resulting regions
 * @param root - Root of the CSTree (for Selection compatibility)
 * @returns Array of SnapshotRegions, one per measure
 */
function splitByBarlines(nodes: Array<{ node: CSNode; parent: CSNode }>, parent: CSNode, snapshot: ContextSnapshot, root: CSNode): SnapshotRegion[] {
  if (nodes.length === 0) return [];

  const regions: SnapshotRegion[] = [];
  let currentMeasureNodes: CSNode[] = [];
  let firstIndex = 0;

  for (let i = 0; i < nodes.length; i++) {
    const { node } = nodes[i];

    if (isBarLine(node)) {
      // End current measure (exclude barline itself)
      if (currentMeasureNodes.length > 0) {
        regions.push({
          root,
          cursors: [new Set(currentMeasureNodes.map((n) => n.id))],
          parent,
          nodes: currentMeasureNodes,
          firstIndex,
          lastIndex: i - 1,
          snapshot,
        });
      }
      // Start new measure
      currentMeasureNodes = [];
      firstIndex = i + 1;
    } else {
      currentMeasureNodes.push(node);
    }
  }

  // Add final measure
  if (currentMeasureNodes.length > 0) {
    regions.push({
      root,
      cursors: [new Set(currentMeasureNodes.map((n) => n.id))],
      parent,
      nodes: currentMeasureNodes,
      firstIndex,
      lastIndex: nodes.length - 1,
      snapshot,
    });
  }

  return regions;
}

// ============================================================================
// Preserved Node Detection
// ============================================================================

/**
 * Checks if an inline field is a voice marker [V:...].
 */
function isVoiceMarker(node: CSNode): boolean {
  let child = node.firstChild;
  while (child !== null) {
    if (isTokenNode(child)) {
      const data = getTokenData(child);
      // INF_HDR is the info key token type
      if (data.tokenType === TT.INF_HDR && data.lexeme.toUpperCase() === "V:") {
        return true;
      }
    }
    child = child.nextSibling;
  }
  return false;
}

/**
 * Checks if a node should be preserved during slash notation conversion.
 * Barlines, annotations, and non-voice inline fields are preserved.
 */
function shouldPreserve(node: CSNode): boolean {
  if (node.tag === TAGS.BarLine) return true;
  if (node.tag === TAGS.Annotation) return true;
  if (node.tag === TAGS.Inline_field && !isVoiceMarker(node)) return true;
  return false;
}

// ============================================================================
// Duration Calculation (Rational Arithmetic)
// ============================================================================

/**
 * Gets the expected measure duration from the context's meter.
 * Because the interpreter always inserts a default meter when none is specified,
 * this function will always return a valid duration.
 */
function getExpectedMeasureDuration(context: ContextSnapshot): IRational {
  const meter = context.meter;
  if (meter.value && meter.value.length > 0) {
    return meter.value[0];
  }
  // Fallback to 1/1 (whole note) if meter structure is unexpected
  return createRational(1, 1);
}

/**
 * Calculates the total duration of nodes in a measure segment using rational arithmetic.
 * Handles broken rhythm with state tracking (reset at barlines via segment splitting).
 */
function calculateMeasureDuration(nodes: CSNode[], context: ContextSnapshot): IRational {
  let totalDuration = createRational(0, 1);
  const defaultNoteLength = context.noteLength;
  const brokenRhythmState: BrokenRhythmState = { nextNoteDurationMultiplier: undefined };

  for (const node of nodes) {
    if (node.tag === TAGS.Note) {
      const duration = calculateNoteDuration(node, defaultNoteLength, brokenRhythmState);
      totalDuration = addRational(totalDuration, duration);
    } else if (node.tag === TAGS.Chord) {
      const duration = calculateChordDuration(node, defaultNoteLength, brokenRhythmState);
      totalDuration = addRational(totalDuration, duration);
    } else if (node.tag === TAGS.Rest) {
      const duration = calculateRestDuration(node, defaultNoteLength, brokenRhythmState);
      totalDuration = addRational(totalDuration, duration);
    } else if (node.tag === TAGS.Beam) {
      // For Beams, recursively calculate duration of contents
      const beamContents = collectBeamContents(node);
      const beamDuration = calculateMeasureDuration(beamContents, context);
      totalDuration = addRational(totalDuration, beamDuration);
    } else if (node.tag === TAGS.MultiMeasureRest) {
      const barCount = getMultiMeasureRestCount(node);
      const meter = context.meter;
      const meterDuration = meter.value && meter.value.length > 0 ? createRational(meter.value[0].numerator, meter.value[0].denominator) : createRational(1, 1);
      const mmrDuration = multiplyRational(meterDuration, createRational(barCount, 1));
      totalDuration = addRational(totalDuration, mmrDuration);
    } else if (node.tag === TAGS.BarLine) {
      // Reset broken rhythm state at barlines
      brokenRhythmState.nextNoteDurationMultiplier = undefined;
    }
    // Grace notes, decorations, etc. contribute no duration
  }

  return totalDuration;
}

/**
 * Collects the contents of a Beam node (notes, chords, etc.).
 */
function collectBeamContents(beam: CSNode): CSNode[] {
  const contents: CSNode[] = [];
  let child = beam.firstChild;
  while (child !== null) {
    contents.push(child);
    child = child.nextSibling;
  }
  return contents;
}

/**
 * Calculates the duration of a note, including broken rhythm adjustments.
 */
function calculateNoteDuration(node: CSNode, defaultNoteLength: IRational, state: BrokenRhythmState): IRational {
  const rhythmNode = findRhythmChild(node);
  let duration = calculateBaseRhythmDuration(rhythmNode, defaultNoteLength);

  // Zero-duration notes count as 1/4 visual spacing
  if (duration.numerator === 0) {
    return createRational(1, 4);
  }

  // Apply pending broken rhythm from previous note
  if (state.nextNoteDurationMultiplier) {
    duration = multiplyRational(duration, state.nextNoteDurationMultiplier);
    state.nextNoteDurationMultiplier = undefined;
  }

  // Check for broken rhythm modifier on this note
  const brokenRhythm = findBrokenRhythmToken(node);
  if (brokenRhythm) {
    const [currentMultiplier, nextMultiplier] = getBrokenRhythmMultipliers(brokenRhythm);
    duration = multiplyRational(duration, currentMultiplier);
    state.nextNoteDurationMultiplier = nextMultiplier;
  }

  return duration;
}

/**
 * Calculates the duration of a chord.
 * Uses chord's rhythm if present, otherwise uses first note's rhythm.
 */
function calculateChordDuration(node: CSNode, defaultNoteLength: IRational, state: BrokenRhythmState): IRational {
  // First try chord-level rhythm
  let rhythmNode = findRhythmChild(node);

  // If chord has no rhythm, check first note's rhythm
  if (!rhythmNode) {
    const firstNote = findFirstNoteInChord(node);
    if (firstNote) {
      rhythmNode = findRhythmChild(firstNote);
    }
  }

  let duration = calculateBaseRhythmDuration(rhythmNode, defaultNoteLength);

  // Zero-duration chords count as 1/4 visual spacing
  if (duration.numerator === 0) {
    return createRational(1, 4);
  }

  // Apply pending broken rhythm from previous note
  if (state.nextNoteDurationMultiplier) {
    duration = multiplyRational(duration, state.nextNoteDurationMultiplier);
    state.nextNoteDurationMultiplier = undefined;
  }

  // Check for broken rhythm modifier
  const brokenRhythm = findBrokenRhythmToken(node);
  if (brokenRhythm) {
    const [currentMultiplier, nextMultiplier] = getBrokenRhythmMultipliers(brokenRhythm);
    duration = multiplyRational(duration, currentMultiplier);
    state.nextNoteDurationMultiplier = nextMultiplier;
  }

  return duration;
}

/**
 * Calculates the duration of a rest.
 */
function calculateRestDuration(node: CSNode, defaultNoteLength: IRational, state: BrokenRhythmState): IRational {
  const rhythmNode = findRhythmChild(node);
  let duration = calculateBaseRhythmDuration(rhythmNode, defaultNoteLength);

  // Apply pending broken rhythm from previous note
  if (state.nextNoteDurationMultiplier) {
    duration = multiplyRational(duration, state.nextNoteDurationMultiplier);
    state.nextNoteDurationMultiplier = undefined;
  }

  return duration;
}

/**
 * Finds the Rhythm child node of a given node.
 */
function findRhythmChild(node: CSNode): CSNode | null {
  let child = node.firstChild;
  while (child !== null) {
    if (child.tag === TAGS.Rhythm) {
      return child;
    }
    child = child.nextSibling;
  }
  return null;
}

/**
 * Finds the first Note child within a Chord node.
 */
function findFirstNoteInChord(chordNode: CSNode): CSNode | null {
  let child = chordNode.firstChild;
  while (child !== null) {
    if (child.tag === TAGS.Note) {
      return child;
    }
    child = child.nextSibling;
  }
  return null;
}

/**
 * Calculates base duration from a rhythm node using rational arithmetic.
 */
function calculateBaseRhythmDuration(rhythmNode: CSNode | null, defaultNoteLength: IRational): IRational {
  if (!rhythmNode) {
    return defaultNoteLength;
  }

  // Extract numerator and denominator from rhythm
  let numerator = 1;
  let denominator = 1;

  let rhythmChild = rhythmNode.firstChild;
  while (rhythmChild !== null) {
    if (isTokenNode(rhythmChild)) {
      const data = getTokenData(rhythmChild);
      if (data.tokenType === TT.RHY_NUMER) {
        numerator = parseInt(data.lexeme, 10);
      } else if (data.tokenType === TT.RHY_SEP) {
        // Multiple slashes like // means /4, /// means /8
        if (denominator === 1) {
          denominator = Math.pow(2, data.lexeme.length);
        }
      } else if (data.tokenType === TT.RHY_DENOM) {
        denominator = parseInt(data.lexeme, 10);
      }
    }
    rhythmChild = rhythmChild.nextSibling;
  }

  if (numerator === 0) {
    return createRational(0, 1);
  }

  const rhythmMultiplier = createRational(numerator, denominator);
  return multiplyRational(defaultNoteLength, rhythmMultiplier);
}

/**
 * Finds the broken rhythm token in a note's rhythm.
 */
function findBrokenRhythmToken(node: CSNode): string | null {
  let child = node.firstChild;
  while (child !== null) {
    if (child.tag === TAGS.Rhythm) {
      let rhythmChild = child.firstChild;
      while (rhythmChild !== null) {
        if (isTokenNode(rhythmChild)) {
          const data = getTokenData(rhythmChild);
          if (data.tokenType === TT.RHY_BRKN) {
            return data.lexeme;
          }
        }
        rhythmChild = rhythmChild.nextSibling;
      }
    }
    child = child.nextSibling;
  }
  return null;
}

/**
 * Gets the broken rhythm multipliers based on the broken rhythm symbol.
 * Returns [currentNoteMultiplier, nextNoteMultiplier] as rationals.
 *
 * For ">": current note gets longer (2 - 1/2^n), next note gets shorter (1/2^n)
 * For "<": current note gets shorter (1/2^n), next note gets longer (2 - 1/2^n)
 *
 * Examples:
 *   > (n=1): [3/2, 1/2]
 *   >> (n=2): [7/4, 1/4]
 *   < (n=1): [1/2, 3/2]
 */
function getBrokenRhythmMultipliers(lexeme: string): [IRational, IRational] {
  const n = lexeme.length;
  const char = lexeme[0];

  // Long note: 2 - 1/2^n = (2^(n+1) - 1) / 2^n
  const powerOfTwo = Math.pow(2, n);
  const longNoteNumerator = 2 * powerOfTwo - 1;
  const longNoteDenominator = powerOfTwo;

  // Short note: 1/2^n
  const shortNoteNumerator = 1;
  const shortNoteDenominator = powerOfTwo;

  if (char === ">") {
    // Current note gets longer, next note gets shorter
    return [createRational(longNoteNumerator, longNoteDenominator), createRational(shortNoteNumerator, shortNoteDenominator)];
  } else if (char === "<") {
    // Current note gets shorter, next note gets longer
    return [createRational(shortNoteNumerator, shortNoteDenominator), createRational(longNoteNumerator, longNoteDenominator)];
  }

  return [createRational(1, 1), createRational(1, 1)];
}

/**
 * Gets the bar count from a multi-measure rest.
 */
function getMultiMeasureRestCount(node: CSNode): number {
  let child = node.firstChild;
  while (child !== null) {
    if (isTokenNode(child)) {
      const data = getTokenData(child);
      if (/^[0-9]+$/.test(data.lexeme)) {
        return parseInt(data.lexeme, 10);
      }
    }
    child = child.nextSibling;
  }
  return 1;
}

// ============================================================================
// Clef-Based Pitch Selection
// ============================================================================

/**
 * Returns the appropriate pitch letter for slash notation based on clef.
 * The pitch should be on the middle line of the staff.
 * Handles all clef variants including octave transpositions (+8, -8).
 */
function getPitchForClef(clef: ClefProperties | undefined): string {
  if (!clef) {
    return "B"; // Default to treble
  }

  const clefType = clef.type;

  // Treble clef variants - middle line is B
  if (clefType === ClefType.Treble || clefType === ClefType.TreblePlus8 || clefType === ClefType.TrebleMinus8) {
    return "B";
  }

  // Bass clef variants - middle line is D
  if (clefType === ClefType.Bass || clefType === ClefType.BassPlus8 || clefType === ClefType.BassMinus8) {
    return "D";
  }

  // Alto clef variants - middle line is C
  if (clefType === ClefType.Alto || clefType === ClefType.AltoPlus8 || clefType === ClefType.AltoMinus8) {
    return "C";
  }

  // Tenor clef variants - middle line is A (octave below)
  if (clefType === ClefType.Tenor || clefType === ClefType.TenorPlus8 || clefType === ClefType.TenorMinus8) {
    return "A,";
  }

  // Percussion and none - default to B
  if (clefType === ClefType.Perc || clefType === ClefType.None) {
    return "B";
  }

  // Fallback for any unhandled types
  return "B";
}

// ============================================================================
// Node Creation
// ============================================================================

/**
 * Creates an array of slash note CSNodes.
 */
function createSlashNotes(count: number, pitch: string, ctx: ABCContext): CSNode[] {
  const notes: CSNode[] = [];
  for (let i = 0; i < count; i++) {
    notes.push(createSlashNote(pitch, ctx));
  }
  return notes;
}

/**
 * Creates a single slash note CSNode (e.g., B0 for treble clef).
 */
function createSlashNote(pitch: string, ctx: ABCContext): CSNode {
  const pitchToken = new Token(TT.NOTE_LETTER, pitch, ctx.generateId());
  const rhythmToken = new Token(TT.RHY_NUMER, "0", ctx.generateId());

  const pitchExpr = new Pitch(ctx.generateId(), { noteLetter: pitchToken });
  const rhythmExpr = new Rhythm(ctx.generateId(), rhythmToken, undefined, null);
  const noteExpr = new Note(ctx.generateId(), pitchExpr, rhythmExpr, undefined);

  return fromAst(noteExpr, ctx);
}

/**
 * Creates a style marker inline field (e.g., [K: style=rhythm]).
 */
function createStyleMarker(style: "rhythm" | "normal", ctx: ABCContext): CSNode {
  const fieldToken = new Token(TT.INF_HDR, "K:", ctx.generateId());
  const valueToken = new Token(TT.INFO_STR, ` style=${style}`, ctx.generateId());
  const leftBracket = new Token(TT.INLN_FLD_LFT_BRKT, "[", ctx.generateId());
  const rightBracket = new Token(TT.INLN_FLD_RGT_BRKT, "]", ctx.generateId());

  // The Inline_field class invariant requires text[0] === field
  const inlineField = new Inline_field(ctx.generateId(), fieldToken, [fieldToken, valueToken], undefined, leftBracket, rightBracket);

  return fromAst(inlineField, ctx);
}
