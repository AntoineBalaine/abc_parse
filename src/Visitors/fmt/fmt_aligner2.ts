import { isToken } from "../../helpers";
import { ABCContext } from "../../parsers/Context";
import { Token } from "../../types/token";
import { System, TokenType } from "../../types/types";
import { AbcFormatter } from "../Formatter";
import { TimeStamp, NodeID, TimeMapper } from "./fmt_timeMapper";
import { mapTimePoints } from "./fmt_tmPts";
export type Location = { voiceIdx: number; nodeID: number };
type BarArray<T> = Array<T>;
type VoicesArray<T> = Array<T>;
type NoFmtLine = System;
type VoiceUnion =
  | BarArray<{ startNodeId: NodeID; map: Map<TimeStamp, NodeID> }>
  | NoFmtLine; // (i.e. just a System)

interface VoiceLocation {
  voiceIdx: number;
  nodeId: NodeID;
}
type voiceIdx = number;
type startNodeId = number;
type TimeMap<T, U> = Map<T, U>;
type BarMap = {
  startNodes: Map<voiceIdx, Array<startNodeId>>;
  map: TimeMap<TimeStamp, Array<VoiceLocation>>;
};
/**
 * collect the time points for each bar, create a map of locations. Locations means: VoiceIndex and NodeID.
 *
 * `TimeMapper() => VoicesArray<BarArray<TimeMap<TimeStamp, NodeID>>>`
 *
 * `mapTimePoints() => BarArray<TimeMap<TimeStamp, Array<{ VoiceIdx, NodeID }>> >`
 */
export interface VoiceSplit {
  type: "formatted" | "noformat";
  content: System;
}

export interface BarTimeMap {
  startNodeId: NodeID;
  map: Map<TimeStamp, NodeID>;
}

interface BarAlignment {
  startNodes: Map<number, NodeID>; // voiceIdx -> startNodeId
  map: Map<TimeStamp, Array<Location>>;
}

class SystemAligner {
  constructor(
    private ctx: ABCContext,
    private stringifyVisitor: AbcFormatter,
  ) {}

  align(systems: System[]) {
    for (const system of systems) {
      // Split system into voices/noformat lines
      const voiceSplits: Array<VoiceSplit> = new TimeMapper().mapVoices(system);

      // Skip if no formattable content
      if (!this.hasFormattableContent(voiceSplits)) continue;

      // Get bar-based alignment points
      const barArray = mapTimePoints(voiceSplits);

      // Process each bar
      for (const bar of barArray) {
        this.alignBar(voiceSplits, bar);
      }
    }
  }

  private alignBar(voiceSplits: VoiceSplit[], bar: BarAlignment) {
    // Get sorted timestamps
    const timeStamps = Array.from(bar.map.keys()).sort((a, b) => a - b);

    // Process each time point
    for (const timeStamp of timeStamps) {
      const locations = bar.map.get(timeStamp)!;

      // Calculate strings and lengths for each location
      const locsWithStrings = locations.map((loc) => {
        const startNode = bar.startNodes.get(loc.voiceIdx)!;
        const voice = this.getFormattedVoice(voiceSplits[loc.voiceIdx]);

        // Get string representation between start and current
        const str = this.getStringBetweenNodes(voice, startNode, loc.nodeID);

        return {
          str,
          startNode,
          ...loc,
        };
      });

      // Find maximum length
      const maxLen = Math.max(...locsWithStrings.map((l) => l.str.length));

      // Add padding where needed
      for (const loc of locsWithStrings) {
        if (loc.str.length < maxLen) {
          const padding = maxLen - loc.str.length;
          const voice = this.getFormattedVoice(voiceSplits[loc.voiceIdx]);

          // Find insertion point
          const insertAt = this.findPaddingInsertionPoint(
            voice,
            loc.nodeID,
            loc.startNode,
          );

          // Insert padding
          if (insertAt !== -1) {
            voice.splice(
              insertAt + 1,
              0,
              new Token(
                TokenType.WHITESPACE,
                " ".repeat(padding),
                null,
                -1,
                -1,
                this.ctx,
              ),
            );
          }
        }
      }
    }
  }

  private getStringBetweenNodes(
    voice: System,
    startId: NodeID,
    endId: NodeID,
  ): string {
    const startIdx = voice.findIndex((node) => node.id === startId);
    const endIdx = voice.findIndex((node) => node.id === endId);

    if (startIdx === -1 || endIdx === -1) return "";

    const segment = voice.slice(startIdx, endIdx + 1);
    return segment
      .map((node) => this.stringifyVisitor.stringify(node))
      .join("");
  }

  private findPaddingInsertionPoint(
    voice: System,
    nodeId: NodeID,
    startNodeId: NodeID,
  ): number {
    const nodeIdx = voice.findIndex(
      (node) => "id" in node && node.id === nodeId,
    );

    if (nodeIdx === -1) return -1;

    let idx = nodeIdx;
    while (idx > 0) {
      const node = voice[idx];
      if ("id" in node && node.id === startNodeId) break;
      if (isToken(node) && node.type === TokenType.WHITESPACE) break;
      idx--;
    }

    return idx;
  }

  private getFormattedVoice(split: VoiceSplit): System {
    return split.type === "formatted" ? split.content : [];
  }

  private hasFormattableContent(splits: VoiceSplit[]): boolean {
    return splits.some((split) => split.type === "formatted");
  }
}
