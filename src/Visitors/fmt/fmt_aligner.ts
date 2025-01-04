import { isToken } from "../../helpers";
import { ABCContext } from "../../parsers/Context";
import { Tune, Tune_Body } from "../../types/Expr";
import { Token } from "../../types/token";
import { System, TokenType } from "../../types/types";
import { AbcFormatter } from "../Formatter";
import { TimeStamp, NodeID, mapVoices } from "./fmt_timeMapHelpers";
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
    for (const system of systems) {
      // Split system into voices/noformat lines
      const voiceSplits: Array<VoiceSplit> = mapVoices(system);

      // Skip if no formattable content
      if (!this.hasFormattableContent(voiceSplits)) {
        continue;
      }

      // Get bar-based alignment points
      const barArray = mapTimePoints(voiceSplits);

      // Process each bar
      for (const bar of barArray) {
        this.alignBar(voiceSplits, bar);
      }
    }
    return systems;
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
          const insertAt = this.findPaddingInsertionPoint(voice, loc.nodeID, loc.startNode);

          // Insert padding
          if (insertAt !== -1) {
            voice.splice(insertAt + 1, 0, new Token(TokenType.WHITESPACE, " ".repeat(padding), null, -1, -1, this.ctx));
          }
        }
      }
    }
  }

  private getStringBetweenNodes(voice: System, startId: NodeID, endId: NodeID): string {
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

  private getFormattedVoice(split: VoiceSplit): System {
    return split.type === "formatted" ? split.content : [];
  }

  private hasFormattableContent(splits: VoiceSplit[]): boolean {
    return splits.some((split) => split.type === "formatted");
  }
}
