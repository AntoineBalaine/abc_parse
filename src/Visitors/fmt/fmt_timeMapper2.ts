import { isBarLine, isBeam, isMultiMeasureRest, isNote } from "../../helpers";
import { Expr, Beam, Note, Rhythm } from "../../types/Expr";
import { Token } from "../../types/token";
import { System, TokenType } from "../../types/types";

interface TimeMap {
  timeStamp: number;
  nodeIndex: number;
}

class TimeMapper {
  mapVoices(voices: System[]): Map<number, TimeMap>[][] {
    return voices.map((voice) => this.mapVoice(voice));
  }

  private mapVoice(voice: System): Map<number, TimeMap>[] {
    const barMaps: Map<number, TimeMap>[] = [];
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

  private processBar(bar: System): Map<number, TimeMap> {
    const timeMap = new Map<number, TimeMap>();
    let currentTime = 0;

    bar.forEach((node, index) => {
      if (this.isTimeEvent(node)) {
        timeMap.set(currentTime, {
          timeStamp: currentTime,
          nodeIndex: index,
        });
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
