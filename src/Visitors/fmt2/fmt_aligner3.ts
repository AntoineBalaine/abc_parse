import { DurationContext, isTimeEvent, calculateDuration, calculateNoteDuration, calculateBaseDuration, parseTuplet } from "./fmt_timeMap";
import { Token, TT } from "../../parsers/scan2";
import { Expr, Rest, System } from "../../types/Expr2";
import { BarAlignment, isBarLine, Location, NodeID, VoiceSplit, getNodeId } from "./fmt_timeMapHelpers";
import { equalRational, greaterRational, isRational, Rational, createRational, addRational, isInfiniteRational, rationalToString } from "./rational";
import { isChord, isNote } from "../../helpers2";
import { alignBars } from "./fmt_aligner";
import { findFmtblLines } from "./fmt_timeMapHelpers";
import { equalizer } from "./fmt_alignerHelpers";
import { AbcFormatter2 } from "../Formatter2";
import { ABCContext } from "../../parsers/Context";

class VxCtx {
  nodes: Array<Expr | Token>;
  bar: number = 0;
  pos: number = 0;
  time: Rational = {
    numerator: 0,
    denominator: 1, // Changed from 0 to 1 to avoid division by zero
  };
  voiceIdx: number;
  durationCtx: DurationContext = {};
  constructor(nodes: Array<Expr | Token>, voiceIdx: number) {
    this.nodes = nodes;
    this.voiceIdx = voiceIdx;
  }
}
type BarNumber = number;
type AlignPt = [Rational | BarNumber, Array<Location>];
class GCtx {
  list: Array<AlignPt> = [[0, []]];
  barIndexes: Array<number> = [0];
  push(pt: [Rational | BarNumber, Location], vxCtx: VxCtx) {
    const key = pt[0];
    const value = pt[1];
    if (typeof key === "number") {
      // bar number
      this.pushBar(key, value);
    } else {
      this.pushTimeStamp(vxCtx, key, value);
    }
  }

  private pushTimeStamp(vxCtx: VxCtx, key: Rational, value: Location) {
    // bar exists?
    if (vxCtx.bar >= this.barIndexes.length) {
      throw Error(`Bar number ${vxCtx.bar} not found in barIndexes (length: ${this.barIndexes.length})`);
    }
    const startIdx = this.barIndexes[vxCtx.bar];
    let endIdx: number;
    if (vxCtx.bar + 1 >= this.barIndexes.length) {
      endIdx = this.list.length;
    } else {
      endIdx = this.barIndexes[vxCtx.bar + 1];
    }

    for (let i = startIdx; i < endIdx; i++) {
      const listEntry = this.list[i][0];
      if (isRational(listEntry)) {
        if (greaterRational(listEntry, key)) {
          this.list.splice(i, 0, [key, [value]]);
          return;
        }
        if (equalRational(listEntry, key)) {
          this.list[i][1].push(value);
          return;
        }
      }
    }

    // If we didn't find a place to insert, add at the end
    if (startIdx + 1 === endIdx || endIdx === this.list.length) {
      this.list.push([key, [value]]);
    }
  }

  /**
   * Adds a bar entry to the list or updates an existing one
   */
  private pushBar(key: number, value: Location) {
    if (this.barIndexes.length <= key) {
      this.list.push([key, [value]]);
      this.barIndexes[key] = this.list.length - 1;
    } else if (value) {
      this.list[this.barIndexes[key]][1].push(value);
    }

    const nextBarKey = key + 1;
    if (this.barIndexes.length <= nextBarKey) {
      this.list.push([nextBarKey, []]);
      this.barIndexes[nextBarKey] = this.list.length - 1;
    }
  }

  /**
   * Converts the alignment points list to a format compatible with the existing alignment code
   */
  toBarAlignments(): BarAlignment[] {
    const result: BarAlignment[] = [];

    // Find all bar boundaries
    const barBoundaries: number[] = [];
    this.list.forEach((item, idx) => {
      const key = item[0];
      if (typeof key === "number") {
        barBoundaries.push(idx);
      }
    });

    // Process each bar
    for (let i = 0; i < barBoundaries.length; i++) {
      const startIdx = barBoundaries[i];
      const endIdx = i < barBoundaries.length - 1 ? barBoundaries[i + 1] : this.list.length;

      // Get bar number
      const barNum = this.list[startIdx][0] as number;

      // Get start nodes
      const startNodes = new Map<number, NodeID>();
      this.list[startIdx][1].forEach((loc: Location) => {
        startNodes.set(loc.voiceIdx, loc.nodeID);
      });

      // Get time points
      const timePoints = new Map<string, Array<Location>>();
      for (let j = startIdx + 1; j < endIdx; j++) {
        const [key, locations] = this.list[j];
        if (typeof key !== "number") {
          // It's a time point
          timePoints.set(rationalToString(key as Rational), locations as Array<Location>);
        }
      }

      result.push({
        startNodes,
        map: timePoints,
      });
    }

    return result;
  }

  /**
   * Returns a string representation of the alignment points for debugging
   */
  toString(): string {
    let result = "Alignment Points:\n";

    this.list.forEach((item, idx) => {
      const [key, locations] = item;

      if (typeof key === "number") {
        result += `\n=== BAR ${key} ===\n`;
        result += `Start nodes: ${locations.map((loc) => `Voice ${loc.voiceIdx}: Node ${loc.nodeID}`).join(", ")}\n`;
      } else {
        result += `Time ${rationalToString(key as Rational)}: `;
        result += locations.map((loc) => `Voice ${loc.voiceIdx}: Node ${loc.nodeID}`).join(", ");
        result += "\n";
      }
    });

    return result;
  }

  /**
   * Validates that time points are always increasing within each bar
   */
  validate(): boolean {
    // Find all bar boundaries
    const barBoundaries: number[] = [];
    this.list.forEach((item, idx) => {
      const key = item[0];
      if (typeof key === "number") {
        barBoundaries.push(idx);
      }
    });

    // Check each bar
    for (let i = 0; i < barBoundaries.length; i++) {
      const startIdx = barBoundaries[i];
      const endIdx = i < barBoundaries.length - 1 ? barBoundaries[i + 1] : this.list.length;

      let prevTime: Rational | null = null;

      // Check time points in this bar
      for (let j = startIdx + 1; j < endIdx; j++) {
        const [key, _] = this.list[j];
        if (typeof key !== "number") {
          // It's a time point
          const time = key as Rational;

          if (prevTime !== null && !greaterRational(time, prevTime)) {
            console.error(`Time point ${rationalToString(time)} is not greater than previous time point ${rationalToString(prevTime)}`);
            return false;
          }

          prevTime = time;
        }
      }
    }

    return true;
  }
}

export function scanAlignPoints(voiceSplits: Array<VoiceSplit>) {
  const gCtx = new GCtx();
  for (let i = 0; i < voiceSplits.length; i++) {
    if (voiceSplits[i].type === "formatted") {
      const vxCtx = new VxCtx(voiceSplits[i].content, i);
      scanVxAlignPts(gCtx, vxCtx);
    }
  }
  return gCtx;
}

export function scanVxAlignPts(gCtx: GCtx, vxCtx: VxCtx): boolean {
  while (!isAtEnd(vxCtx)) {
    if (barlinePts(gCtx, vxCtx)) continue;
    if (timeEventPts(gCtx, vxCtx)) continue;
    advance(vxCtx);
  }
  return false;
}

function barlinePts(gCtx: GCtx, vxCtx: VxCtx): boolean {
  const cur = peek(vxCtx);
  if (!isBarLine(cur)) return false;
  gCtx.push([vxCtx.bar, { voiceIdx: vxCtx.voiceIdx, nodeID: cur.id }], vxCtx);
  vxCtx.bar++;
  vxCtx.time = {
    numerator: 0,
    denominator: 1,
  };
  advance(vxCtx);
  return true;
}

function timeEventPts(gCtx: GCtx, vxCtx: VxCtx): boolean {
  const cur = peek(vxCtx);
  if (!isTimeEvent(cur)) return false;
  const timeKey = vxCtx.time;
  gCtx.push([timeKey, { voiceIdx: vxCtx.voiceIdx, nodeID: getNodeId(cur) }], vxCtx);

  const duration = calculateDuration(cur, vxCtx.durationCtx);

  // If duration is infinite (multi-measure rest), don't update time
  if (!isInfiniteRational(duration)) {
    // Add the duration to current time
    vxCtx.time = addRational(vxCtx.time, duration);
  }

  // Update tuplet counting if we're in a tuplet and this is a note-carrying event
  if (vxCtx.durationCtx.tuplet && (isNote(cur) || isChord(cur))) {
    vxCtx.durationCtx.tuplet.notesRemaining--;
    if (vxCtx.durationCtx.tuplet.notesRemaining <= 0) {
      vxCtx.durationCtx.tuplet = undefined;
    }
  }

  // Update broken rhythm context
  if ((isNote(cur) || isChord(cur) || cur instanceof Rest) && cur.rhythm?.broken) {
    vxCtx.durationCtx.brokenRhythmPending = {
      token: cur.rhythm.broken,
      isGreater: cur.rhythm.broken.lexeme.includes(">"),
    };
  } else {
    vxCtx.durationCtx.brokenRhythmPending = undefined;
  }

  advance(vxCtx);
  return true;
}

export function peek(ctx: VxCtx) {
  return ctx.nodes[ctx.pos];
}

export function isAtEnd(ctx: VxCtx) {
  return ctx.pos >= ctx.nodes.length;
}

function advance(ctx: VxCtx) {
  ctx.pos++;
}

/**
 * Add alignment padding to multi-voice tunes using the new alignment algorithm.
 * Does nothing if tune is single-voice.
 */
export function alignTuneWithNewAlgorithm(tune: System, ctx: ABCContext, stringifyVisitor: AbcFormatter2): System {
  // Split system into voices/noformat lines
  let voiceSplits: Array<VoiceSplit> = findFmtblLines(tune);

  // Skip if no formattable content
  if (!voiceSplits.some((split) => split.type === "formatted")) {
    return tune;
  }

  // Get alignment points using the new algorithm
  const gCtx = scanAlignPoints(voiceSplits);

  // Validate the alignment points
  if (!gCtx.validate()) {
    console.error("Invalid alignment points detected");
    return tune;
  }

  // Convert to bar alignments for compatibility with existing code
  const barAlignments = gCtx.toBarAlignments();

  // Process each bar alignment
  for (const barAlignment of barAlignments) {
    // Use the existing alignBars function
    voiceSplits = alignBars(voiceSplits, barAlignment, stringifyVisitor, ctx);
  }

  // Apply bar length equalization
  voiceSplits = equalizer(voiceSplits, stringifyVisitor);

  // Reconstruct system from aligned voices
  return voiceSplits.flatMap((split) => split.content);
}
