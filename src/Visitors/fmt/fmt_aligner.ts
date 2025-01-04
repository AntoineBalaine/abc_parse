import { isToken } from "../../helpers";
import { ABCContext } from "../../parsers/Context";
import { Tune, Tune_Body } from "../../types/Expr";
import { Token } from "../../types/token";
import { System, TokenType } from "../../types/types";
import { AbcFormatter } from "../Formatter";
import { TimeStamp, NodeID, findFmtblLines } from "./fmt_timeMapHelpers";
import { mapTimePoints } from "./fmt_timeMap";

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

interface BarAlignment {
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

  private alignBar(voiceSplits: VoiceSplit[], barTimeMap: BarAlignment): VoiceSplit[] {
    // Get sorted timestamps
    const timeStamps = Array.from(barTimeMap.map.keys()).sort((a, b) => a - b);

    // Process each time point
    for (const timeStamp of timeStamps) {
      const locations = barTimeMap.map.get(timeStamp)!;

      // new map with locations, start node and stringified content between startNode and current node
      const locsWithStrings = locations.map((loc) => {
        const startNode = barTimeMap.startNodes.get(loc.voiceIdx)!;
        const voice = voiceSplits[loc.voiceIdx].content;

        // Get string representation between start and current
        const str = this.stringifyVoiceSlice(voice, startNode, loc.nodeID);

        return {
          str,
          startNode,
          ...loc,
        };
      });

      // Find maximum length
      const maxLen = Math.max(...locsWithStrings.map((l) => l.str.length));

      // Add padding where needed
      for (const location of locsWithStrings) {
        if (location.str.length < maxLen) {
          const padding = maxLen - location.str.length;

          // Find insertion point
          const insertIdx = this.findPaddingInsertionPoint(voiceSplits[location.voiceIdx].content, location.nodeID, location.startNode);

          // Insert padding
          if (insertIdx !== -1) {
            voiceSplits[location.voiceIdx].content.splice(insertIdx, 0, new Token(TokenType.WHITESPACE, " ".repeat(padding), null, -1, -1, this.ctx));
          }
        }
      }
    }
    return voiceSplits;
  }

  private stringifyVoiceSlice(voice: System, startId: NodeID, endId: NodeID): string {
    const startIdx = voice.findIndex((node) => node.id === startId);
    const endIdx = voice.findIndex((node) => node.id === endId);

    if (startIdx === -1 || endIdx === -1) {
      return "";
    }

    const segment = voice.slice(startIdx, endIdx + 1);
    return segment.map((node) => this.stringifyVisitor.stringify(node)).join("");
  }

  private findPaddingInsertionPoint(voice: System, nodeId: NodeID, startNodeId: NodeID): number {
    const nodeIdx = voice.findIndex((node) => "id" in node && node.id === nodeId);

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
