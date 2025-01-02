import { isBarLine, isBeam, isMultiMeasureRest, isNote } from "../../helpers";
import { Expr } from "../../types/Expr";
import { Token } from "../../types/token";
import { System } from "../../types/types";

export type NodeID = number;
export type TimeStamp = number;

class TimeMapper {
  mapVoices(voices: System[]): Array<Map<TimeStamp, NodeID>>[] {
    return voices.map((voice) => this.mapVoice(voice));
  }

  /**
   * returns 1 time map per bar.
   * So Map<TimeStamp, NodeID> is a list of time stamps for time-events
   * @param voice
   * @returns
   */
  private mapVoice(voice: System): Array<Map<TimeStamp, NodeID>> {
    const barMaps: Array<Map<TimeStamp, NodeID>> = [];
    let currentBar: System = [];

    // Split into bars and process each
    for (const node of voice) {
      if (isBarLine(node)) {
        currentBar.push(node);
        barMaps.push(this.processBar(currentBar));
        currentBar = [];
      } else {
        currentBar.push(node);
      }
    }

    // Handle last bar if exists
    if (currentBar.length > 0) {
      barMaps.push(this.processBar(currentBar));
    }

    return barMaps;
  }

  private processBar(bar: System): Map<TimeStamp, NodeID> {
    const timeMap = new Map<number, NodeID>();
    let currentTime = 0;

    bar.forEach((node, index) => {
      if (this.isTimeEvent(node)) {
        timeMap.set(currentTime, index);
        currentTime += this.calculateDuration(node);
      }
    });

    return timeMap;
  }

  private isTimeEvent(node: Expr | Token): boolean {
    return isNote(node) || isBeam(node) || isMultiMeasureRest(node);
  }

  private calculateDuration(node: Expr | Token): number {
    throw Error("unimplemented");
  }
}
