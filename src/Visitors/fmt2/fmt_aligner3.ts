import { isChord, isNote, isToken } from "../../helpers2";
import { Token, TT } from "../../parsers/scan2";
import { Expr, Rest } from "../../types/Expr2";
import { AbcFormatter2 } from "../Formatter2";
import { calculateDuration, DurationContext, isTimeEvent } from "./fmt_timeMap";
import { getNodeId, isBarLine, Location, VoiceSplit } from "./fmt_timeMapHelpers";
import { addRational, equalRational, greaterRational, isInfiniteRational, isRational, Rational, rationalToString } from "./rational";

class SymbolLnCtx {
  nodes: Array<Expr | Token>;
  bar: number = 0;
  pos: number = 0;
  parentPos: number | null = null;
  voiceIdx: number;
  constructor(nodes: Array<Expr | Token>, voiceIdx: number) {
    this.nodes = nodes;
    this.voiceIdx = voiceIdx;
  }
}
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
  push(pt: [Rational | BarNumber, Location], vxCtx: VxCtx | SymbolLnCtx) {
    const key = pt[0];
    const value = pt[1];
    if (typeof key === "number") {
      // bar number
      this.pushBar(key, value);
    } else {
      this.pushTimeStamp(vxCtx, key, value);
    }
  }

  private pushTimeStamp(vxCtx: VxCtx | SymbolLnCtx, key: Rational, value: Location) {
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

          // Update all bar indexes that come after the insertion point
          for (let barIdx = 0; barIdx < this.barIndexes.length; barIdx++) {
            if (this.barIndexes[barIdx] >= i) {
              this.barIndexes[barIdx]++;
            }
          }
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
    if (voiceSplits[i].type === "symbol_line") {
      const vxCtx = new SymbolLnCtx(voiceSplits[i].content, i);
      const prevVx = (() => {
        for (let j = i - 1; j > 0; j--) {
          if (voiceSplits[j].type === "formatted") return j;
        }
        return null;
      })();
      prevVx !== null && scanSymbolLinePts(gCtx, vxCtx, prevVx);
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

function barlinePts(gCtx: GCtx, vxCtx: VxCtx | SymbolLnCtx): boolean {
  const cur = peek(vxCtx);
  if (!isBarLine(cur)) return false;
  gCtx.push([++vxCtx.bar, { voiceIdx: vxCtx.voiceIdx, nodeID: cur.id }], vxCtx);
  if (vxCtx instanceof VxCtx) {
    vxCtx.time = {
      numerator: 0,
      denominator: 1,
    };
  }
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

export function peek(ctx: VxCtx | SymbolLnCtx) {
  return ctx.nodes[ctx.pos];
}

export function isAtEnd(ctx: VxCtx | SymbolLnCtx) {
  return ctx.pos >= ctx.nodes.length;
}

function advance(ctx: VxCtx | SymbolLnCtx) {
  ctx.pos++;
}

export function aligner(gCtx: GCtx, voiceSplits: Array<VoiceSplit>, stringifyVisitor: AbcFormatter2): Array<VoiceSplit> {
  for (let i = 0; i < gCtx.list.length; i++) {
    const [_, locations] = gCtx.list[i];
    const maxLength = Math.max(
      ...locations.map((v) => {
        const voice = voiceSplits[v.voiceIdx].content;
        const idx = voice.findIndex((n) => !isToken(n) && getNodeId(n) === v.nodeID);
        if (idx === -1) throw Error("Node not found");
        const slice = voice.slice(0, idx);
        return slice.map((node) => stringifyVisitor.stringify(node)).join("").length;
      })
    );

    // Insert whitespace tokens to equalize lengths
    for (const loc of locations) {
      const voiceIdx = loc.voiceIdx;
      if (voiceSplits[voiceIdx].type !== "formatted") continue;

      const voice = voiceSplits[voiceIdx].content;
      const nodeidx = voice.findIndex((n) => !isToken(n) && getNodeId(n) === loc.nodeID);
      if (nodeidx === -1) throw Error("Node not found");
      const slice = voice.slice(0, nodeidx);
      const currentLength = slice.map((node) => stringifyVisitor.stringify(node)).join("").length;

      const padding = maxLength - currentLength;

      if (padding <= 0) continue;

      // Insert whitespace token before the current node
      const wsToken = new Token(TT.WS, " ".repeat(padding), stringifyVisitor.ctx.generateId());
      voiceSplits[voiceIdx].content.splice(nodeidx, 0, wsToken);
    }
  }

  return voiceSplits;
}

function scanSymbolLinePts(gCtx: GCtx, vxCtx: SymbolLnCtx, prntVx: number) {
  const parentAlignPts = gCtx.list
    .map((aPt): AlignPt | null => {
      if (typeof aPt[0] === "number") {
        return aPt;
      }
      const newLocs = aPt[1].filter((loc) => loc.voiceIdx === prntVx);
      if (newLocs.length === 0) return null;
      return [aPt[0], newLocs];
    })
    .filter((n): n is AlignPt => n != null);

  const first = peek(vxCtx);
  if (!(isToken(first) && first.type !== TT.SY_HDR)) return false;
  advance(vxCtx);
  while (!isAtEnd(vxCtx)) {
    const cur = peek(vxCtx);
    if (barlinePts(gCtx, vxCtx)) continue;
    // if (timeEventPts(gCtx, vxCtx)) continue;
    advance(vxCtx);
  }
  return false;
}
