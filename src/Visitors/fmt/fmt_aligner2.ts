import { isToken } from "../../helpers";
import { ABCContext } from "../../parsers/Context";
import { Token } from "../../types/token";
import { System, TokenType } from "../../types/types";
import { TimeStamp, NodeIndex } from "./fmt_timeMapper";

class VoiceAligner {
  ctx: ABCContext;
  constructor(ctx: ABCContext) {
    this.ctx = ctx;
  }
  alignVoices(
    voices: System[],
    timeMaps: Array<Array<Map<TimeStamp, NodeIndex>>>
    //        ^     ^     ^
    //        voices
    //              bars
    //                    timeMap
  ) {
    /**
    From what I understand of the voiceAligner’s current implementation, there should be some changes:

   Iterate the maxBars count per System and collect the time points,
   For each bar, sort the time points, then iterate them:
    At each time point, calculate the width of each of the voices
      for each voice that is shorter than the longest one
        padding_length = maxWidthAtTime - voiceWidthAtTime
        insert padding after the first whitespace position that precedes the alignment point - i.e. between the WS and the first non-WS node.
   This requires flipping the data struct:
   collect the time points for each bar, create a map of locations. Locations means: VoiceIndex and NodeIndex.
   TimeMapper() => VoicesArray<BarArray<TimeMap<TimeStamp, NodeIndex>>>
   TimesPointsPerBar() => BarArray<TimeMap<TimeStamp, Array<{ VoiceIdx, NodeIndex }>> >
   The problem is that as I start inserting padding into the voices,
   the offset of the nodes’ indexes changes. So, as I insert padding, the NodeIndexes in the the timeMaps get invalidated.
   This breaks the logic.
   What are the alternatives? How can this be addressed?
    One possible approach would be to track unique IDs instead of nodeIndexes.
    This requires going back into the updating the token and expression constructors to include an ID property in the nodes.
  Is there another alternative?
   */
    // For each bar's worth of timeMaps
    // for (let barIndex = 0; barIndex < timeMaps.length; barIndex++) {
    //   // Collect all unique time points in this bar across voices
    //   const timePoints = new Set<number>();
    //   voices.forEach((voice, voiceIndex) => {
    //     timeMaps[voiceIndex][barIndex].forEach((_, time) => {
    //       timePoints.add(time);
    //     });
    //   });
    //   // Sort time points
    //   const sortedTimePoints = Array.from(timePoints).sort((a, b) => a - b);
    //   // For each time point
    //   for (let i = 0; i < sortedTimePoints.length - 1; i++) {
    //     const currentTime = sortedTimePoints[i];
    //     const nextTime = sortedTimePoints[i + 1];
    //     // For each voice, calculate width between current and next time point
    //     const widths = voices.map((voice, voiceIndex) => {
    //       const timeMap = timeMaps[voiceIndex][barIndex];
    //       const currentIndex = timeMap.get(currentTime)?.nodeIndex;
    //       const nextIndex = timeMap.get(nextTime)?.nodeIndex;
    //       if (currentIndex === undefined || nextIndex === undefined) {
    //         return 0; // Voice doesn't have elements at this time point
    //       }
    //       // Calculate width of elements between these indices
    //       return this.calculateWidth(voice.slice(currentIndex, nextIndex));
    //     });
    //     // Find maximum width
    //     const maxWidth = Math.max(...widths);
    //     // Add padding where needed
    //     voices.forEach((voice, voiceIndex) => {
    //       const timeMap = timeMaps[voiceIndex][barIndex];
    //       const currentIndex = timeMap.get(currentTime)?.nodeIndex;
    //       if (currentIndex !== undefined) {
    //         const currentWidth = widths[voiceIndex];
    //         const padding = maxWidth - currentWidth;
    //         if (padding > 0) {
    //           // Insert padding after first WS following currentIndex
    //           this.insertPadding(voice, currentIndex, padding);
    //         }
    //       }
    //     });
    //   }
    // }
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
