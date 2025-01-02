import { isToken } from "../../helpers";
import { ABCContext } from "../../parsers/Context";
import { Token } from "../../types/token";
import { System, TokenType } from "../../types/types";
import { TimeStamp, NodeID } from "./fmt_timeMapper";

interface VoiceLocation {
  voiceIdx: number;
  nodeId: NodeID;
}

/**
 * collect the time points for each bar, create a map of locations. Locations means: VoiceIndex and NodeID.
 *
 * `TimeMapper() => VoicesArray<BarArray<TimeMap<TimeStamp, NodeID>>>`
 *
 * `mapTimePoints() => BarArray<TimeMap<TimeStamp, Array<{ VoiceIdx, NodeID }>> >`
 */
function mapTimePoints(timeMaps: Array<Array<Map<TimeStamp, NodeID>>>): Array<Map<TimeStamp, VoiceLocation[]>> {
  const barCount = Math.max(...timeMaps.map((voice) => voice.length));
  const barsTimePoints: Array<Map<TimeStamp, VoiceLocation[]>> = [];

  // For each bar
  for (let barIdx = 0; barIdx < barCount; barIdx++) {
    const barTimePoints = new Map<TimeStamp, VoiceLocation[]>();

    // For each voice
    timeMaps.forEach((voiceBars, voiceIdx) => {
      // Skip if voice doesn't have this bar
      if (barIdx >= voiceBars.length) {
        return;
      }

      const barMap = voiceBars[barIdx];

      // For each time point in this voice's bar
      barMap.forEach((nodeId, timeStamp) => {
        let locations = barTimePoints.get(timeStamp);
        if (!locations) {
          locations = [];
          barTimePoints.set(timeStamp, locations);
        }

        locations.push({
          voiceIdx,
          nodeId,
        });
      });
    });

    barsTimePoints.push(barTimePoints);
  }

  return barsTimePoints;
}

class VoiceAligner {
  ctx: ABCContext;
  constructor(ctx: ABCContext) {
    this.ctx = ctx;
  }
  /**
  Iterate the maxBars count per System and collect the time points,
  For each bar, sort the time points, then iterate them:
  At each time point, calculate the width of each of the voices
    for each voice that is shorter than the longest one
      padding_length = maxWidthAtTime - voiceWidthAtTime
      insert padding after the first whitespace position that precedes the alignment point - i.e. between the WS and the first non-WS node.
  This requires flipping the data struct:
  */
  alignVoices(
    voices: System[],
    timeMaps: Array<Array<Map<TimeStamp, NodeID>>>
    //        ^     ^     ^
    //        voices
    //              bars
    //                    timeMap
  ) {
    // Get bar-based time points
    const barTimeMaps = mapTimePoints(timeMaps);

    // Process each bar
    barTimeMaps.forEach((barTimeMap, barIndex) => {
      // Get sorted time points for this bar
      const timePoints = Array.from(barTimeMap.keys()).sort((a, b) => a - b);

      // Process each time segment (between time points)
      for (let i = 0; i < timePoints.length - 1; i++) {
        const currentTime = timePoints[i];
        const nextTime = timePoints[i + 1];

        // Get nodes at current time point
        const currentLocations = barTimeMap.get(currentTime) || [];
        const nextLocations = barTimeMap.get(nextTime) || [];

        // Calculate width for each voice between these time points
        const widths = new Map<number, number>(); // voiceIdx -> width

        currentLocations.forEach(({ voiceIdx, nodeId }) => {
          const voice = voices[voiceIdx];
          const nextNodeId = nextLocations.find((loc) => loc.voiceIdx === voiceIdx)?.nodeId;

          // Find nodes in voice by ID
          const startIdx = voice.findIndex((node) => node.id === nodeId);
          const endIdx = nextNodeId ? voice.findIndex((node) => node.id === nextNodeId) : undefined;

          // Calculate width of this segment
          const width = this.calculateWidth(voice.slice(startIdx, endIdx));
          widths.set(voiceIdx, width);
        });

        // Find maximum width
        const maxWidth = Math.max(...widths.values());

        // Add padding where needed
        currentLocations.forEach(({ voiceIdx, nodeId }) => {
          const voice = voices[voiceIdx];
          const currentWidth = widths.get(voiceIdx) || 0;

          if (currentWidth < maxWidth) {
            const padding = maxWidth - currentWidth;

            // Find node in voice by ID
            const nodeIdx = voice.findIndex((node) => node.id === nodeId);

            if (nodeIdx !== -1) {
              this.insertPadding(voice, nodeIdx, padding);
            }
          }
        });
      }
    });
  }

  private insertPadding(voice: System, afterIndex: number, padding: number) {
    // Find first WS after index
    let paddingIndex = afterIndex;
    while (paddingIndex < voice.length) {
      const node = voice[paddingIndex];
      if (isToken(node) && node.type === TokenType.WHITESPACE) {
        break;
      }
      paddingIndex++;
    }

    // Insert padding token
    voice.splice(paddingIndex + 1, 0, new Token(TokenType.WHITESPACE, " ".repeat(padding), null, -1, -1, this.ctx));
  }

  private calculateWidth(nodes: System): number {
    // Sum up visual width of nodes
    return nodes.reduce((total, node) => {
      if (isToken(node) && node.type === TokenType.WHITESPACE) {
        return total + node.lexeme.length;
      }
      // Add other width calculations
      return total;
    }, 0);
  }
}
