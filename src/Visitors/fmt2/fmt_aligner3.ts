import { DurationContext, isTimeEvent } from "./fmt_timeMap";
import { Token } from "../../parsers/scan2";
import { Expr } from "../../types/Expr2";
import { isBarLine, Location, VoiceSplit } from "./fmt_timeMapHelpers";
import { equalRational, greaterRational, isRational, Rational } from "./rational";

class VxCtx {
  nodes: Array<Expr | Token>;
  bar: number = 0;
  pos: number = 0;
  time: Rational = {
    numerator: 0,
    denominator: 0,
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
  list: Array<AlignPt> = [];
  barIndexes: Array<number> = [];
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
    /**
     * find the segment which corresponds to the vxCtx’s bar number
     */
    if (vxCtx.bar >= this.barIndexes.length) {
      throw Error("bar number not found");
    }
    const startIdx = this.barIndexes[vxCtx.bar];
    let endIdx: number;
    if (vxCtx.bar + 1 >= this.barIndexes.length) {
      endIdx = this.list.length;
    } else {
      endIdx = this.barIndexes[vxCtx.bar + 1];
    }

    for (let i = startIdx + 1; i < endIdx; i++) {
      const listEntry = this.list[i][0];
      if (isRational(listEntry)) {
        if (greaterRational(listEntry, key)) {
          this.list.splice(i, 0, [key, [value]]);
          break;
        }
        if (equalRational(listEntry, key)) {
          this.list[i][1].push(value);
          break;
        }
      }
    }
  }

  private pushBar(key: number, value: Location) {
    if (this.barIndexes.length < key) {
      this.list.push([key, [value]]);
      this.barIndexes[key] = this.list.length - 1;
    } else {
      this.list[this.barIndexes[key]][1].push(value);
    }
  }
}

export function scanAlignPoints(voiceSplits: Array<VoiceSplit>) {
  const gCtx = new GCtx();
  for (let i = 0; i < voiceSplits.length; i++) {
    const vxCtx = new VxCtx(voiceSplits[i].content, i);
    scanVxAlignPts(gCtx, vxCtx);
  }
  return gCtx.list;
}

export function scanVxAlignPts(gCtx: GCtx, vxCtx: VxCtx): boolean {
  while (!isAtEnd(vxCtx)) {
    advance(vxCtx);
    if (barlinePts(gCtx, vxCtx)) continue;
    if (timeEventPts(gCtx, vxCtx)) continue;
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
    denominator: 0,
  };
  return true;
}

function timeEventPts(gCtx: GCtx, vxCtx: VxCtx): boolean {
  const cur = peek(vxCtx);
  if (!isTimeEvent(cur)) return false;
  const timeKey = vxCtx.time;
  gCtx.push([timeKey, { voiceIdx: vxCtx.voiceIdx, nodeID: cur.id }], vxCtx);
  // TODO: calculate duration, based on implementation example from processBar.

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
