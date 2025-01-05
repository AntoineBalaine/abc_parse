import { isInfo_line, isToken } from "../../helpers";
import { ABCContext } from "../../parsers/Context";
import { Tune, Tune_Body } from "../../types/Expr";
import { Token } from "../../types/token";
import { System, TokenType } from "../../types/types";
import { AbcFormatter } from "../Formatter";
import { TimeStamp, NodeID, findFmtblLines } from "./fmt_timeMapHelpers";
import { mapTimePoints } from "./fmt_timeMap";
import { createLocationMapper, equalizeBarLengths } from "./fmt_alignerHelpers";

export type Location = { voiceIdx: number; nodeID: number };

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

export interface BarAlignment {
  startNodes: Map<number, NodeID>; // voiceIdx -> startNodeId
  map: Map<TimeStamp, Array<Location>>;
}

export class SystemAligner {
  constructor(
    private ctx: ABCContext,
    private stringifyVisitor: AbcFormatter
  ) {}

  /**
   * Add alignment padding to multi-voice tunes.
   * Does nothing if tune is single-voice.
   */
  alignTune(tune: Tune): Tune {
    if (tune.tune_body && tune.tune_header.voices.length > 1) {
      tune.tune_body.sequence = this.align(tune.tune_body.sequence);
    }
    return tune;
  }

  private align(systems: Tune_Body["sequence"]): Tune_Body["sequence"] {
    return systems.map((system) => {
      // Split system into voices/noformat lines
      let voiceSplits: Array<VoiceSplit> = findFmtblLines(system);

      // Skip if no formattable content

      if (!voiceSplits.some((split) => split.type === "formatted")) {
        return system;
      }

      // Get bar-based alignment points
      const barTimeMaps = mapTimePoints(voiceSplits);

      // Process each bar
      for (const barTimeMap of barTimeMaps) {
        voiceSplits = this.alignBar(voiceSplits, barTimeMap);
      }

      // Reconstruct system from aligned voices

      return voiceSplits.flatMap((split) => split.content);
    });
  }

  /**
   * At each time stamp, compare where there are nodes in each voice which land at that time stamp.
   * Then, compare the lengths of the stringified segments up to those nodes in each voice.
   * and insert some padding to make the strings the same length.
   * The padding is inserted at the first whitespace token before the node in the voice.
   * Lastly, compare the whole bars’ lengths and add padding to the end of the shorter bars.
   */
  private alignBar(voiceSplits: VoiceSplit[], barTimeMap: BarAlignment): VoiceSplit[] {
    // Get sorted timestamps
    const timeStamps = Array.from(barTimeMap.map.keys()).sort((a, b) => a - b);

    // Process each time point
    timeStamps.forEach((timeStamp) => {
      const locations = barTimeMap.map.get(timeStamp)!;

      // new map with locations, start node and stringified content between startNode and current node
      const locsWithStrings = locations.map(createLocationMapper(voiceSplits, barTimeMap, this.stringifyVisitor));

      // Find maximum length
      const maxLen = Math.max(...locsWithStrings.map((l) => l.str.length));

      // Add padding where needed
      locsWithStrings.forEach((location) => {
        if (location.str.length < maxLen) {
          const paddingLen = maxLen - location.str.length;

          // Find insertion point
          const insertIdx = this.findPaddingInsertionPoint(voiceSplits[location.voiceIdx].content, location.nodeID, location.startNode);

          // Insert padding
          if (insertIdx !== -1) {
            const padding = new Token(TokenType.WHITESPACE, " ".repeat(paddingLen), null, -1, -1, this.ctx);
            voiceSplits[location.voiceIdx].content.splice(insertIdx + 1, 0, padding);
          }
        }
      });
    });

    return equalizeBarLengths(voiceSplits, this.ctx, this.stringifyVisitor);
  }

  /**
   * Find first WS position before `nodeId` - or use `startNodeId`.
   */
  private findPaddingInsertionPoint(voice: System, nodeId: NodeID, startNodeId: NodeID): number {
    const nodeIdx = voice.findIndex((node) => node.id === nodeId);

    if (nodeIdx === -1) {
      return -1;
    }

    let idx = nodeIdx;
    while (idx > 0) {
      const node = voice[idx];
      if (node.id === startNodeId) {
        break;
      }
      if (isToken(node) && node.type === TokenType.WHITESPACE) {
        break;
      }
      idx--;
    }

    return idx;
  }
}
