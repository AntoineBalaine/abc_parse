import { ABCContext, isVoiceMarker, isBarLine, isEmptyRange, isNote, isChord, isEOL, Expr, RangeVisitor } from "abc-parser";
import { DocumentSnapshots, getSnapshotAtPosition, encode } from "abc-parser/interpreter/ContextInterpreter";
import { Token, TT } from "abc-parser/parsers/scan2";
import { extractVoiceId } from "abc-parser/parsers/voices2";
import {
  Note,
  Chord,
  Rest,
  Beam,
  Grace_group,
  Tune_Body,
  BarLine,
  Info_line,
  Inline_field,
  Rhythm,
  MultiMeasureRest,
  tune_body_code,
} from "abc-parser/types/Expr2";
import { System } from "abc-parser/types/Expr2";
import { Range, Position } from "abc-parser/types/types";
import { buildBarMap, type BarEntry, type BarMap } from "abc-parser/Visitors/BarMapVisitor";
import { cloneLine, cloneExpr } from "abc-parser/Visitors/CloneVisitor";
import { calculateDuration, isTimeEvent, DurationContext } from "abc-parser/Visitors/fmt2/fmt_timeMap";
import {
  IRational,
  createRational,
  addRational,
  subtractRational,
  compareRational,
  isInfiniteRational,
  rationalToRhythmExpr,
} from "abc-parser/Visitors/fmt2/rational";
import { collectChildren, replace } from "cstree";
import { fromAst } from "../csTree/fromAst";
import { toAst } from "../csTree/toAst";
import { CSNode } from "../csTree/types";
import { TAGS } from "../csTree/types";
import { Selection } from "../selection";
import { walkByTag } from "../selectors/treeWalk";
import { isVoiceMarker as isCSNodeVoiceMarker, extractVoiceId as extractCSNodeVoiceId } from "../selectors/voiceSelector";
import { computeNodeRange, rangesOverlap } from "../utils/rangeUtils";
import { consolidateRests } from "./consolidateRests";
import { collectSiblingIds } from "./explode";
import { findTuneBody } from "./lineUtils";
import { toCSTreeSystem, prependVoiceMarker, appendEOL } from "./splitSystem";
import { getCursorRange } from "./toSlashNotation";

/**
 * Filters a chord's contents to keep only the notes at the specified part
 * indices (top-down, 0-based). Because Chord.contents stores notes bottom-up,
 * we convert each top-down index to a bottom-up index. If no notes survive,
 * the chord is replaced in the content array by a rest with the same rhythm.
 * If exactly one note survives, the chord is unwrapped to that note (carrying
 * over the chord's rhythm and tie).
 */
export function filterChordToPart(content: System, contentIdx: number, partIndices: number[], ctx: ABCContext): void {
  const chord = content[contentIdx] as Chord;
  const notes = chord.contents.filter((e): e is Note => e instanceof Note);

  // Convert top-down part indices to note-array indices (notes are stored bottom-up)
  const noteIndicesToKeep = new Set<number>();
  for (const pi of partIndices) {
    const noteIdx = notes.length - 1 - pi;
    if (noteIdx >= 0) {
      noteIndicesToKeep.add(noteIdx);
    }
  }

  if (noteIndicesToKeep.size === 0) {
    // Replace chord with a rest carrying the same rhythm
    const restToken = new Token(TT.REST, "z", ctx.generateId());
    content[contentIdx] = new Rest(ctx.generateId(), restToken, chord.rhythm);
    return;
  }

  // Filter the chord's contents, keeping only the notes at the specified indices
  let noteIdx = 0;
  chord.contents = chord.contents.filter((e) => {
    if (e instanceof Note) {
      const keep = noteIndicesToKeep.has(noteIdx);
      noteIdx++;
      return keep;
    }
    return true; // keep non-note children (annotations, tokens)
  });

  // If only one note remains, unwrap the chord to that note
  const survivingNotes = chord.contents.filter((e): e is Note => e instanceof Note);
  if (survivingNotes.length === 1) {
    const note = survivingNotes[0];
    // The chord's rhythm and tie override the note's own if present
    if (chord.rhythm) note.rhythm = chord.rhythm;
    if (chord.tie) note.tie = chord.tie;
    content[contentIdx] = note;
  }
}

/**
 * Walks a System array and filters elements based on the part indices.
 * Chords are filtered to keep only the notes at partIndices.
 * A standalone note is effectively a 1-note chord where part 0 is the only
 * note, so it becomes a rest when 0 is not in partIndices.
 * Grace groups follow the top part, so they are removed when 0 is not in
 * partIndices.
 * Recurses into Beam containers (Beam.contents). Tuplets in the AST only
 * hold their parameters, not their notes, so no recursion is needed for them.
 */
export function walkAndFilter(content: System, partIndices: number[], ctx: ABCContext): void {
  const isLowerPart = !partIndices.includes(0);

  // Remove grace groups for lower parts
  if (isLowerPart) {
    for (let i = content.length - 1; i >= 0; i--) {
      if (content[i] instanceof Grace_group) {
        content.splice(i, 1);
      }
    }
  }

  for (let i = 0; i < content.length; i++) {
    const element = content[i];

    if (element instanceof Chord) {
      filterChordToPart(content, i, partIndices, ctx);
    } else if (element instanceof Note) {
      if (isLowerPart) {
        const restToken = new Token(TT.REST, "z", ctx.generateId());
        content[i] = new Rest(ctx.generateId(), restToken, element.rhythm);
      }
    } else if (element instanceof Beam) {
      // Recurse into beam contents (cast is safe because Beam.contents
      // is Array<Beam_contents> which is a subset of System elements)
      walkAndFilter(element.contents as System, partIndices, ctx);
    }
  }
}

// --- Type definitions ---

export interface BarRange {
  start: number;
  end: number;
}

export interface PartAssignment {
  sourceVoiceId: string;
  partIndices: number[];
}

export interface PreparedPart {
  targetVoiceId: string;
  sourceVoiceId: string;
  content: System;
  sourceContent: System;
  partIndices: number[];
}

export interface SourceVoiceContent {
  voiceId: string;
  content: System;
}

export interface TimeRange {
  start: { numerator: number; denominator: number };
  end: { numerator: number; denominator: number };
}

/**
 * Returns the content boundaries of a bar within a system array, given
 * a BarEntry. The closing anchor's type determines whether it is included
 * in the content: barline anchors are delimiters (excluded), while content-
 * node anchors (EOL closures, voice-switch closures, end-of-stream) are
 * the bar's last content element (included). The backward walk stops at
 * a barline, voice marker, EOL token, or the start of the array.
 */
export function getBarSlice(system: System, barEntry: BarEntry): { content: System; startIdx: number; endIdx: number } | null {
  // Find the closing anchor by node ID
  let anchorIdx = -1;
  for (let i = 0; i < system.length; i++) {
    if (system[i].id === barEntry.closingNodeId) {
      anchorIdx = i;
      break;
    }
  }
  if (anchorIdx === -1) return null;

  // Derive endIdx (exclusive). If the anchor is a barline, it is a
  // delimiter and excluded from content. Otherwise, the anchor is the
  // bar's last content element and is included.
  const endIdx = isBarLine(system[anchorIdx]) ? anchorIdx : anchorIdx + 1;

  // Walk backward from the anchor to find startIdx
  let startIdx = 0;
  for (let i = anchorIdx - 1; i >= 0; i--) {
    const el = system[i];
    if (isBarLine(el) || isVoiceMarker(el) || isEOL(el)) {
      startIdx = i + 1;
      break;
    }
  }

  return { content: system, startIdx, endIdx };
}

// --- Voice utilities (CSTree-side) ---

interface VoiceMarkerCtx {
  voiceIds: Set<string>;
  selectionRange: Range;
}

function collectVoiceMarkerCallback(node: CSNode, ctx: VoiceMarkerCtx): void {
  if (!isCSNodeVoiceMarker(node)) return;

  const nodeRange = computeNodeRange(node);
  if (!nodeRange || !rangesOverlap(nodeRange, ctx.selectionRange)) return;

  const vid = extractCSNodeVoiceId(node);
  if (vid !== null) {
    ctx.voiceIds.add(vid);
  }
}

/**
 * Derives the set of source voice IDs from the selection. We compute the
 * selection's bounding range, resolve the starting voice from snapshots,
 * then walk the tree for voice markers that fall within that range.
 */
export function getVoiceIdsFromSelection(selection: Selection, snapshots: DocumentSnapshots): Set<string> {
  const tuneBody = findTuneBody(selection.root);
  if (!tuneBody) return new Set();

  const allIds = new Set<number>();
  for (const cursor of selection.cursors) {
    for (const id of cursor) {
      allIds.add(id);
    }
  }
  const selectionRange = getCursorRange(allIds, selection.root);
  if (!selectionRange) return new Set();

  const pos = encode(selectionRange.start.line, selectionRange.start.character);
  const startingVoice = getSnapshotAtPosition(snapshots, pos).voiceId;

  const voiceIds = new Set<string>([startingVoice]);

  walkByTag([TAGS.Inline_field, TAGS.Info_line], { voiceIds, selectionRange }, collectVoiceMarkerCallback, tuneBody.firstChild);

  return voiceIds;
}

// --- Phase 4: Time map, source bar range, part preparation ---

export interface TimeMapEntry {
  node: Expr | Token;
  contentIdx: number;
  startTime: IRational;
  duration: IRational;
}

/**
 * Builds a time map for the content between startIdx and endIdx. Each entry
 * records the node, its index in the content array, its start time, and its
 * duration. Because the duration calculator maintains state for broken rhythms
 * and tuplets, we iterate sequentially and accumulate time.
 */
export function buildTimeMap(content: System, startIdx: number, endIdx: number): TimeMapEntry[] {
  const entries: TimeMapEntry[] = [];
  let currentTime = createRational(0, 1);
  const durCtx: DurationContext = {};

  for (let i = startIdx; i < endIdx; i++) {
    const node = content[i];
    if (!isTimeEvent(node)) continue;

    const duration = calculateDuration(node, durCtx);
    if (isInfiniteRational(duration)) break;

    entries.push({ node, contentIdx: i, startTime: currentTime, duration });
    currentTime = addRational(currentTime, duration);
  }

  return entries;
}

/**
 * Searches across multiple system arrays for a node by its ID.
 * Because system arrays hold AST nodes (Expr | Token), this helper
 * operates on the AST side and does not require CSTree conversion.
 */
export function findNodeInSystems(systems: System[], nodeId: number): Expr | Token | null {
  for (const system of systems) {
    for (const element of system) {
      if (element.id === nodeId) return element;
    }
  }
  return null;
}

/**
 * Resolves the voice ID at a given document position using context
 * interpreter snapshots.
 */
export function resolveVoiceAtPosition(position: Position, snapshots: DocumentSnapshots): string {
  const pos = encode(position.line, position.character);
  return getSnapshotAtPosition(snapshots, pos).voiceId;
}

/**
 * Determines the bar range spanned by a cursor selection. We resolve the
 * voice ID at the cursor start from snapshots, then iterate that voice's
 * bar entries in the bar map. For each entry, we locate the closing anchor
 * node in the system arrays and compare its position against the cursor
 * range. The closing anchor belongs to the bar it closes, so a cursor
 * positioned exactly on the anchor is still inside that bar.
 *
 * If the cursor start is before any anchor, startBarNum defaults to 0.
 */
export function getSourceBarRange(barMap: BarMap, systems: System[], cursorRange: Range, snapshots: DocumentSnapshots): BarRange {
  const rangeVisitor = new RangeVisitor();
  const voiceId = resolveVoiceAtPosition(cursorRange.start, snapshots);
  const voiceEntries = barMap.get(voiceId);

  let startBarNum = 0;
  let endBarNum = 0;

  if (voiceEntries) {
    for (const entry of voiceEntries.values()) {
      const anchorNode = findNodeInSystems(systems, entry.closingNodeId);
      if (!anchorNode) continue;

      const anchorRange = anchorNode.accept(rangeVisitor);
      if (isEmptyRange(anchorRange)) continue;

      const anchorPos = anchorRange.start;

      // An anchor is "before" a position if it starts strictly before it.
      // Bar entry N's anchor closes bar N. When the anchor is the last one
      // before the cursor, the cursor is in bar N+1 (the content after it).
      if (anchorPos.line < cursorRange.start.line || (anchorPos.line === cursorRange.start.line && anchorPos.character < cursorRange.start.character)) {
        startBarNum = entry.barNumber + 1;
      }

      if (anchorPos.line < cursorRange.end.line || (anchorPos.line === cursorRange.end.line && anchorPos.character < cursorRange.end.character)) {
        endBarNum = entry.barNumber + 1;
      }
    }
  }

  return { start: startBarNum, end: endBarNum };
}

/**
 * Searches across multiple system arrays for the bar described by a
 * BarEntry. Returns null if the closing anchor is not found in any system.
 */
export function findBarSliceInSystems(systems: System[], barEntry: BarEntry): { content: System; startIdx: number; endIdx: number } | null {
  for (const system of systems) {
    const slice = getBarSlice(system, barEntry);
    if (slice) return slice;
  }
  return null;
}

/**
 * Extracts the content of a range of bars for a given voice. We iterate
 * the bar map entries for the voice, filter to the bar range, and
 * concatenate bar content. A barline delimiter is inserted between bars
 * only when the previous bar's closing anchor is a barline (not when
 * it is an EOL or content node).
 */
export function extractBarsContent(barMap: BarMap, barRange: BarRange, voiceId: string, systems: System[]): System {
  const voiceEntries = barMap.get(voiceId);
  if (!voiceEntries) return [];

  const result: System = [];
  let isFirstBar = true;

  for (let barNum = barRange.start; barNum <= barRange.end; barNum++) {
    const entry = voiceEntries.get(barNum);
    if (!entry) continue;

    const slice = findBarSliceInSystems(systems, entry);
    if (!slice) continue;

    const barContent = slice.content.slice(slice.startIdx, slice.endIdx);

    // Insert a barline delimiter between bars, but only when the previous
    // bar's closing anchor is actually a barline (not an EOL or content node)
    if (!isFirstBar) {
      const prevEntry = voiceEntries.get(barNum - 1);
      if (prevEntry) {
        const prevAnchor = findNodeInSystems(systems, prevEntry.closingNodeId);
        if (prevAnchor && isBarLine(prevAnchor)) {
          result.push(prevAnchor as BarLine);
        }
      }
    }
    result.push(...barContent);
    isFirstBar = false;
  }

  return result;
}

/**
 * Walks a content array and returns the maximum number of notes in any chord.
 * Standalone notes count as 1.
 */
export function getMaxChordSize(content: System): number {
  let maxSize = 1;
  for (const node of content) {
    if (isChord(node)) {
      const noteCount = node.contents.reduce((prev, cur) => (isNote(cur) ? prev + 1 : prev), 0);
      maxSize = Math.max(maxSize, noteCount);
    }
  }
  return maxSize;
}

/**
 * Assigns part indices to target voices based on the maximum chord size
 * of each source voice. When there are more chord notes than remaining
 * target voices, the last target voice gets all leftover part indices.
 */
export function assignParts(sourceContents: SourceVoiceContent[], targetVoiceIds: string[]): Map<string, PartAssignment> {
  const assignments = new Map<string, PartAssignment>();
  let targetIdx = 0;

  for (const source of sourceContents) {
    const maxChordSize = getMaxChordSize(source.content);
    const numPartsForThisVoice = Math.min(maxChordSize, targetVoiceIds.length - targetIdx);

    for (let partIndex = 0; partIndex < numPartsForThisVoice; partIndex++) {
      let partIndices: number[];
      if (partIndex === numPartsForThisVoice - 1 && maxChordSize > numPartsForThisVoice) {
        // Leftover: the last target voice gets all remaining chord notes
        partIndices = Array.from({ length: maxChordSize - partIndex }, (_, k) => partIndex + k);
      } else {
        partIndices = [partIndex];
      }

      assignments.set(targetVoiceIds[targetIdx], {
        sourceVoiceId: source.voiceId,
        partIndices,
      });
      targetIdx++;
    }
  }

  return assignments;
}

/**
 * Filters cloned content to keep only the specified part indices. We call
 * walkAndFilter (which is AST-native) to do the filtering, then run a
 * targeted CSTree round trip for consolidateRests (which merges consecutive
 * rests).
 */
export function filterToParts(clonedContent: System, partIndices: number[], ctx: ABCContext): System {
  walkAndFilter(clonedContent, partIndices, ctx);

  // consolidateRests is a CSTree-level transform, so we do a targeted
  // round trip just for the cleanup pass.
  const systemNode = toCSTreeSystem(clonedContent, ctx);
  const allIds = collectSiblingIds(systemNode.firstChild);
  const lineSelection: Selection = { root: systemNode, cursors: [allIds] };
  consolidateRests(lineSelection, ctx);

  // Convert back to AST
  const csChildren = collectChildren(systemNode);
  return csChildren.map((child) => toAst(child)) as System;
}

/**
 * Orchestrates cloning, filtering, and assembly of prepared parts. For each
 * target voice, we extract the source content for the assigned voice, clone
 * it twice (one unfiltered clone with preserved positions for time range
 * computation, one filtered clone), and apply the part filter.
 */
export function prepareParts(
  barMap: BarMap,
  barRange: BarRange,
  sourceVoiceIds: string[],
  targetVoiceIds: string[],
  systems: System[],
  ctx: ABCContext
): PreparedPart[] {
  // Extract source content once per source voice
  const sourceContents = new Map<string, System>();
  for (const voiceId of sourceVoiceIds) {
    sourceContents.set(voiceId, extractBarsContent(barMap, barRange, voiceId, systems));
  }

  const assignments = assignParts(
    sourceVoiceIds.map((voiceId) => ({
      voiceId,
      content: sourceContents.get(voiceId)!,
    })),
    targetVoiceIds
  );
  const parts: PreparedPart[] = [];

  for (const targetVoiceId of targetVoiceIds) {
    const assignment = assignments.get(targetVoiceId);
    if (!assignment) continue;

    const sourceContent = sourceContents.get(assignment.sourceVoiceId)!;
    // The unfiltered clone preserves token positions so that
    // cursorRangeToTimeRange can compute range overlaps against the
    // original cursor range. The filtered clone does not need positions.
    const unfilteredClone = cloneLine(sourceContent, ctx, true);
    const filteredClone = cloneLine(sourceContent, ctx);
    const filtered = filterToParts(filteredClone, assignment.partIndices, ctx);

    parts.push({
      targetVoiceId,
      sourceVoiceId: assignment.sourceVoiceId,
      content: filtered,
      sourceContent: unfilteredClone,
      partIndices: assignment.partIndices,
    });
  }

  return parts;
}

// --- Phase 5: Time range utilities + explosion core + entry points ---

/**
 * Computes the musical time interval within a bar that corresponds to the
 * cursor's character range. We build a time map for the bar, then iterate
 * entries and check which ones overlap with cursorRange using RangeVisitor
 * (for AST nodes) and rangesOverlap.
 */
export function cursorRangeToTimeRange(content: System, startIdx: number, endIdx: number, cursorRange: Range): TimeRange {
  const rangeVisitor = new RangeVisitor();
  const timeMap = buildTimeMap(content, startIdx, endIdx);

  let minTime: IRational | null = null;
  let maxTime: IRational = createRational(0, 1);

  for (const entry of timeMap) {
    const elementRange = entry.node.accept(rangeVisitor);
    if (isEmptyRange(elementRange)) continue;

    if (rangesOverlap(elementRange, cursorRange)) {
      if (minTime === null || compareRational(entry.startTime, minTime) < 0) {
        minTime = entry.startTime;
      }
      const entryEnd = addRational(entry.startTime, entry.duration);
      if (compareRational(entryEnd, maxTime) > 0) {
        maxTime = entryEnd;
      }
    }
  }

  if (minTime === null) {
    return { start: createRational(0, 1), end: createRational(0, 1) };
  }

  return { start: minTime, end: maxTime };
}

/**
 * Splits a note at a given time offset within its duration, producing two
 * notes with adjusted durations. No ties are added. We use cloneExpr from
 * CloneVisitor because structuredClone on AST class instances loses
 * prototype methods (like accept).
 */
export function splitNoteAt(content: System, contentIdx: number, splitAt: IRational, ctx: ABCContext): void {
  const originalNote = content[contentIdx];
  const originalDuration = calculateDuration(originalNote as Note | Chord | Rest | Beam | MultiMeasureRest, {});

  // Guard: if splitAt is non-positive or exceeds the note's duration,
  // the split is invalid and we leave the content unchanged.
  if (compareRational(splitAt, createRational(0, 1)) <= 0 || compareRational(splitAt, originalDuration) >= 0) {
    return;
  }

  const firstHalf = cloneExpr(originalNote as Expr, ctx);
  const remainingDuration = subtractRational(originalDuration, splitAt);
  const secondHalf = cloneExpr(originalNote as Expr, ctx);

  // All time events (Note, Chord, Rest, YSpacer) have an optional rhythm
  // field. We update the rhythm on both halves unconditionally.
  if ("rhythm" in firstHalf) {
    (firstHalf as { rhythm?: Rhythm }).rhythm = rationalToRhythmExpr(splitAt, ctx) ?? undefined;
  }

  if ("rhythm" in secondHalf) {
    (secondHalf as { rhythm?: Rhythm }).rhythm = rationalToRhythmExpr(remainingDuration, ctx) ?? undefined;
  }

  content.splice(contentIdx, 1, firstHalf as tune_body_code, secondHalf as tune_body_code);
}

/**
 * Replaces the content within a time range in a target bar with new content.
 * If a note in the target straddles a boundary of the time range, it is split
 * into two notes with adjusted durations. When the time range covers the
 * entire bar, no splitting occurs and the whole bar content is replaced.
 */
export function replaceTimeRangeInBar(content: System, startIdx: number, endIdx: number, timeRange: TimeRange, replacement: System, ctx: ABCContext): void {
  let timeMap = buildTimeMap(content, startIdx, endIdx);

  let firstOverlapIdx: number | null = null;
  let lastOverlapIdx: number | null = null;

  for (let i = 0; i < timeMap.length; i++) {
    const entry = timeMap[i];
    const entryEnd = addRational(entry.startTime, entry.duration);
    if (compareRational(entryEnd, timeRange.start) > 0 && compareRational(entry.startTime, timeRange.end) < 0) {
      if (firstOverlapIdx === null) firstOverlapIdx = i;
      lastOverlapIdx = i;
    }
  }

  if (firstOverlapIdx === null || lastOverlapIdx === null) return;

  // Track how many elements splits have added so far, because each
  // splitNoteAt replaces one element with two, shifting the bar's end
  // boundary by 1.
  let splitCount = 0;

  // Split the first overlapping note if it starts before the time range
  const firstEntry = timeMap[firstOverlapIdx];
  if (compareRational(firstEntry.startTime, timeRange.start) < 0) {
    const splitAtOffset = subtractRational(timeRange.start, firstEntry.startTime);
    splitNoteAt(content, firstEntry.contentIdx, splitAtOffset, ctx);
    splitCount++;
    // After splitting, re-scan to get updated indices. Both overlap indices
    // must be incremented because the split inserted a new element before
    // all subsequent entries, shifting them by 1 in the rebuilt time map.
    timeMap = buildTimeMap(content, startIdx, endIdx + splitCount);
    firstOverlapIdx = firstOverlapIdx + 1;
    lastOverlapIdx = lastOverlapIdx + 1;
  }

  // Split the last overlapping note if it extends beyond the time range
  const lastEntry = timeMap[lastOverlapIdx];
  const lastEnd = addRational(lastEntry.startTime, lastEntry.duration);
  if (compareRational(lastEnd, timeRange.end) > 0) {
    const splitAtOffset = subtractRational(timeRange.end, lastEntry.startTime);
    splitNoteAt(content, lastEntry.contentIdx, splitAtOffset, ctx);
    splitCount++;
    // lastOverlapIdx stays the same: we replace only the first half
    // Re-scan so that the splice indices below are correct
    timeMap = buildTimeMap(content, startIdx, endIdx + splitCount);
  }

  // Splice: remove the overlapping elements, insert replacement
  const spliceStart = timeMap[firstOverlapIdx].contentIdx;
  const spliceEnd = timeMap[lastOverlapIdx].contentIdx + 1;
  content.splice(spliceStart, spliceEnd - spliceStart, ...replacement);
}

/**
 * O(1) lookup in the nested bar map.
 */
export function findBarEntry(barMap: BarMap, voiceId: string, barNum: number): BarEntry | null {
  return barMap.get(voiceId)?.get(barNum) ?? null;
}

function isTuneBody(target: System | Tune_Body): target is Tune_Body {
  return "sequence" in target;
}

interface ExistingVoicePosition {
  voiceId: string;
  position: number;
}

/**
 * Collects voice IDs and their element-array positions from an insertion
 * target. For a Tune_Body, the "position" is the system index in sequence.
 * For a System (linear), the position is the element index in the array.
 */
function collectExistingVoicePositions(target: System | Tune_Body): ExistingVoicePosition[] {
  const result: ExistingVoicePosition[] = [];

  if (isTuneBody(target)) {
    for (let i = 0; i < target.sequence.length; i++) {
      const system = target.sequence[i];
      for (const element of system) {
        if (isVoiceMarker(element)) {
          const vid = extractVoiceId(element as Info_line | Inline_field);
          if (vid !== null && !result.some((r) => r.voiceId === vid)) {
            result.push({ voiceId: vid, position: i });
          }
          break; // Only the first voice marker per system matters
        }
      }
    }
  } else {
    for (let i = 0; i < target.length; i++) {
      const element = target[i];
      if (isVoiceMarker(element)) {
        const vid = extractVoiceId(element as Info_line | Inline_field);
        if (vid !== null) {
          result.push({ voiceId: vid, position: i });
        }
      }
    }
  }

  return result;
}

/**
 * Creates a new voice line and registers it in the bar map. The voice line
 * consists of a voice marker [V:voiceId], a Z multi-measure rest, and a
 * barline |. The insertion position is determined by the canonical voice
 * ordering: we find the first existing voice whose position in voiceOrder
 * is greater than the new voice's position, and insert before it.
 */
function createVoiceLine(barMap: BarMap, voiceId: string, insertionTarget: System | Tune_Body, voiceOrder: string[], ctx: ABCContext): void {
  const voiceLine: System = [];
  prependVoiceMarker(voiceLine, voiceId, ctx);

  const zRest = new MultiMeasureRest(ctx.generateId(), new Token(TT.REST, "Z", ctx.generateId()));
  const barline = new BarLine(ctx.generateId(), [new Token(TT.BARLINE, "|", ctx.generateId())]);
  voiceLine.push(zRest);
  voiceLine.push(barline);

  const targetIdx = voiceOrder.indexOf(voiceId);

  if (targetIdx === -1) {
    // Fallback: append at end
    if (isTuneBody(insertionTarget)) {
      insertionTarget.sequence.push(voiceLine);
    } else {
      appendEOL(insertionTarget, voiceLine, ctx);
    }
  } else {
    const existingVoices = collectExistingVoicePositions(insertionTarget);

    let insertBeforePosition: number | null = null;
    for (const existing of existingVoices) {
      const existingIdx = voiceOrder.indexOf(existing.voiceId);
      if (existingIdx > targetIdx) {
        insertBeforePosition = existing.position;
        break;
      }
    }

    if (insertBeforePosition !== null) {
      if (isTuneBody(insertionTarget)) {
        insertionTarget.sequence.splice(insertBeforePosition, 0, voiceLine);
      } else {
        insertionTarget.splice(insertBeforePosition, 0, ...voiceLine);
      }
    } else {
      if (isTuneBody(insertionTarget)) {
        insertionTarget.sequence.push(voiceLine);
      } else {
        appendEOL(insertionTarget, voiceLine, ctx);
      }
    }
  }

  // Register in the bar map
  const voiceEntries = new Map<number, BarEntry>();
  voiceEntries.set(0, {
    barNumber: 0,
    closingNodeId: barline.id,
  });
  barMap.set(voiceId, voiceEntries);
}

/**
 * Creates a rest-filled bar for a voice and registers it in the bar map.
 * Appends a Z rest + barline to the voice's content in the system array,
 * then registers the new barline's node ID in the bar map.
 */
function createBar(barMap: BarMap, voiceId: string, barNum: number, systems: System[], ctx: ABCContext): void {
  const voiceEntries = barMap.get(voiceId);
  if (!voiceEntries || voiceEntries.size === 0) return;

  // Find the last entry to determine where to append
  const lastEntry = [...voiceEntries.values()].reduce((a, b) => (a.barNumber > b.barNumber ? a : b));

  // Find the system array containing the last barline
  let targetSystem: System | null = null;
  let insertAfterIdx = -1;
  for (const system of systems) {
    for (let i = 0; i < system.length; i++) {
      if (system[i].id === lastEntry.closingNodeId) {
        targetSystem = system;
        insertAfterIdx = i;
        break;
      }
    }
    if (targetSystem) break;
  }
  if (!targetSystem) return;

  const zRest = new MultiMeasureRest(ctx.generateId(), new Token(TT.REST, "Z", ctx.generateId()));
  const barline = new BarLine(ctx.generateId(), [new Token(TT.BARLINE, "|", ctx.generateId())]);

  // Because multiple voices can share the same system array in linear
  // mode, we must insert before the next voice marker to stay within
  // the correct voice's content region.
  let insertionPoint = insertAfterIdx + 1;
  for (let i = insertAfterIdx + 1; i < targetSystem.length; i++) {
    if (isVoiceMarker(targetSystem[i])) {
      insertionPoint = i;
      break;
    }
  }

  targetSystem.splice(insertionPoint, 0, zRest, barline);

  voiceEntries.set(barNum, {
    barNumber: barNum,
    closingNodeId: barline.id,
  });
}

/**
 * The core explosion loop. For each prepared part, we iterate its bars
 * sequentially. For each bar, we ensure the target voice and bar exist
 * (creating them if not), compute the time range from the unfiltered
 * source bar, and perform the time-range-based replacement in the target.
 */
function explodeParts(
  parts: PreparedPart[],
  barMap: BarMap,
  barRange: BarRange,
  cursorRange: Range,
  systems: System[],
  ctx: ABCContext,
  outputSelections: Map<string, Set<number>>,
  insertionTarget: System | Tune_Body,
  voiceOrder: string[]
): void {
  for (const part of parts) {
    let filteredIdx = 0;
    let sourceIdx = 0;

    for (let barNum = barRange.start; barNum <= barRange.end; barNum++) {
      // Collect the current bar's filtered elements (AST)
      const partBarContent: System = [];
      while (filteredIdx < part.content.length && !isBarLine(part.content[filteredIdx])) {
        partBarContent.push(part.content[filteredIdx]);
        filteredIdx++;
      }
      // Skip the barline delimiter
      if (filteredIdx < part.content.length && isBarLine(part.content[filteredIdx])) {
        filteredIdx++;
      }

      // Collect the current bar's unfiltered source elements (for time range)
      const sourceBarContent: System = [];
      while (sourceIdx < part.sourceContent.length && !isBarLine(part.sourceContent[sourceIdx])) {
        sourceBarContent.push(part.sourceContent[sourceIdx]);
        sourceIdx++;
      }
      if (sourceIdx < part.sourceContent.length && isBarLine(part.sourceContent[sourceIdx])) {
        sourceIdx++;
      }

      // Ensure target voice exists
      if (!barMap.has(part.targetVoiceId)) {
        createVoiceLine(barMap, part.targetVoiceId, insertionTarget, voiceOrder, ctx);
      }

      // Ensure target bar exists
      let targetBarEntry = findBarEntry(barMap, part.targetVoiceId, barNum);
      if (targetBarEntry === null) {
        createBar(barMap, part.targetVoiceId, barNum, systems, ctx);
        targetBarEntry = findBarEntry(barMap, part.targetVoiceId, barNum);
      }
      if (targetBarEntry === null) continue;

      // Compute time range from unfiltered source bar
      const timeRange = cursorRangeToTimeRange(sourceBarContent, 0, sourceBarContent.length, cursorRange);

      // Perform replacement in target bar. Because getBarSlice re-derives
      // startIdx by scanning the array, it is immune to staleness from splices.
      const targetSlice = findBarSliceInSystems(systems, targetBarEntry);
      if (!targetSlice) continue;
      replaceTimeRangeInBar(targetSlice.content, targetSlice.startIdx, targetSlice.endIdx, timeRange, partBarContent, ctx);

      // Collect output selection IDs
      const outSet = outputSelections.get(part.targetVoiceId);
      if (outSet) {
        for (const node of partBarContent) {
          outSet.add(node.id);
        }
      }
    }
  }
}

// --- Entry points ---

/**
 * Dispatches to explosionLinear or explosionDeferred based on ctx.tuneLinear.
 * The explosion transform splits chords into separate voices.
 */
export function explosion(selection: Selection, targetVoiceIds: string[], ctx: ABCContext, snapshots: DocumentSnapshots): Selection {
  if (ctx.tuneLinear) {
    return explosionLinear(selection, targetVoiceIds, ctx, snapshots);
  } else {
    return explosionDeferred(selection, targetVoiceIds, ctx, snapshots);
  }
}

/**
 * Handles explosion for linear-style tunes (all voices inline in the same
 * system). Processes each system that overlaps the cursor independently.
 */
function explosionLinear(selection: Selection, targetVoiceIds: string[], ctx: ABCContext, snapshots: DocumentSnapshots): Selection {
  const tuneBody = findTuneBody(selection.root);
  if (!tuneBody || tuneBody.tag !== TAGS.Tune_Body) return selection;

  const sourceVoiceIds = getVoiceIdsFromSelection(selection, snapshots);
  if (sourceVoiceIds.size > 1) return selection;

  const voiceOrder = tuneBody.data.voices;

  const outputSelections = new Map<string, Set<number>>();
  for (const id of targetVoiceIds) {
    outputSelections.set(id, new Set());
  }

  // Iterate cursors in reverse so that earlier positions remain valid
  for (let ci = selection.cursors.length - 1; ci >= 0; ci--) {
    const cursor = selection.cursors[ci];
    const cursorRange = getCursorRange(cursor, selection.root);
    if (!cursorRange) continue;

    let prev: CSNode | null = null;
    let currentSystem: CSNode | null = tuneBody.firstChild;

    while (currentSystem !== null) {
      const nextSystem = currentSystem.nextSibling;

      if (currentSystem.tag !== TAGS.System) {
        prev = currentSystem;
        currentSystem = nextSystem;
        continue;
      }

      const systemRange = computeNodeRange(currentSystem);
      if (!systemRange || !rangesOverlap(systemRange, cursorRange)) {
        prev = currentSystem;
        currentSystem = nextSystem;
        continue;
      }

      const systemAst = collectChildren(currentSystem).map((child) => toAst(child)) as System;

      const systems = [systemAst];

      // Resolve the starting voice from snapshots at the first element's
      // position, because content before any V: marker belongs to that voice.
      const rangeVisitor = new RangeVisitor();
      const firstElement = systemAst[0];
      if (!firstElement) {
        prev = currentSystem;
        currentSystem = nextSystem;
        continue;
      }
      const elementRange = firstElement.accept(rangeVisitor);
      const pos = encode(elementRange.start.line, elementRange.start.character);
      const startingVoiceId = getSnapshotAtPosition(snapshots, pos).voiceId;

      const syntheticBody = new Tune_Body(ctx.generateId(), [systemAst]);
      const barMap = buildBarMap(syntheticBody, startingVoiceId);
      const barRange = getSourceBarRange(barMap, systems, cursorRange, snapshots);
      const parts = prepareParts(barMap, barRange, Array.from(sourceVoiceIds), targetVoiceIds, systems, ctx);

      explodeParts(parts, barMap, barRange, cursorRange, systems, ctx, outputSelections, systemAst, voiceOrder);

      // Convert the modified AST array back to a CSTree System node
      const modifiedSystemNode = toCSTreeSystem(systemAst, ctx);
      replace(currentSystem, modifiedSystemNode);
      currentSystem = nextSystem;
    }
  }

  return {
    root: selection.root,
    cursors: targetVoiceIds.map((id) => outputSelections.get(id) ?? new Set()),
  };
}

/**
 * Handles explosion for deferred-style tunes (each voice in a separate
 * system). Converts the entire tune body to AST once and processes globally.
 */
function explosionDeferred(selection: Selection, targetVoiceIds: string[], ctx: ABCContext, snapshots: DocumentSnapshots): Selection {
  const tuneBody = findTuneBody(selection.root);
  if (!tuneBody || tuneBody.tag !== TAGS.Tune_Body) return selection;

  const sourceVoiceIds = getVoiceIdsFromSelection(selection, snapshots);
  if (sourceVoiceIds.size > 1) return selection;

  const voiceOrder = tuneBody.data.voices;

  const outputSelections = new Map<string, Set<number>>();
  for (const id of targetVoiceIds) {
    outputSelections.set(id, new Set());
  }

  const tuneAst = toAst(tuneBody) as Tune_Body;
  const systems = tuneAst.sequence;

  // Resolve the starting voice from snapshots at the first system's
  // first element, because content before any V: marker belongs to that voice.
  const rangeVisitor = new RangeVisitor();
  const firstSystem = systems.find((s) => s.length > 0);
  if (!firstSystem) return selection;
  const firstElement = firstSystem[0];
  const elementRange = firstElement.accept(rangeVisitor);
  const pos = encode(elementRange.start.line, elementRange.start.character);
  const startingVoiceId = getSnapshotAtPosition(snapshots, pos).voiceId;

  const barMap = buildBarMap(tuneAst, startingVoiceId);

  for (let ci = selection.cursors.length - 1; ci >= 0; ci--) {
    const cursor = selection.cursors[ci];
    const cursorRange = getCursorRange(cursor, selection.root);
    if (!cursorRange) continue;

    const barRange = getSourceBarRange(barMap, systems, cursorRange, snapshots);

    const parts = prepareParts(barMap, barRange, Array.from(sourceVoiceIds), targetVoiceIds, systems, ctx);

    explodeParts(parts, barMap, barRange, cursorRange, systems, ctx, outputSelections, tuneAst, voiceOrder);
  }

  // Convert modified tune body AST back to CSTree and replace
  const modifiedTuneBody = fromAst(tuneAst, ctx);

  replace(tuneBody, modifiedTuneBody);

  return {
    root: selection.root,
    cursors: targetVoiceIds.map((id) => outputSelections.get(id) ?? new Set()),
  };
}
