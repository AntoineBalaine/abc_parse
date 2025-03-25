import { ABCContext } from "../../parsers/Context";
import { Ctx, Token, TT } from "../../parsers/scan2";
import { Expr, System, Tune, Tune_Body, tune_body_code } from "../../types/Expr2";
import { BarAlignment, Location, TimeStamp, NodeID, VoiceSplit, findFmtblLines, getNodeId, isToken } from "./fmt_timeMapHelpers";
import { mapTimePoints } from "./fmt_timeMap";
import { createLocationMapper, equalizeBarLengths, equalizer, findPaddingInsertionPoint } from "./fmt_alignerHelpers";
import { AbcFormatter2 } from "../Formatter2";
import { createRational, rationalToNumber, rationalFromNumber } from "./rational";

/**
 * collect the time points for each bar, create a map of locations. Locations means: VoiceIndex and NodeID.
 *
 * `TimeMapper() => VoicesArray<BarArray<TimeMap<TimeStamp, NodeID>>>`
 *
 * `mapTimePoints() => BarArray<TimeMap<TimeStamp, Array<{ VoiceIdx, NodeID }>> >`
 */

export class SystemAligner2 {
  constructor(private ctx: ABCContext, private stringifyVisitor: AbcFormatter2) {}

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
        voiceSplits = alignBars(voiceSplits, barTimeMap, this.stringifyVisitor, this.ctx);
      }
      // voiceSplits = equalizeBarLengths(voiceSplits, this.ctx, this.stringifyVisitor);
      voiceSplits = equalizer(voiceSplits, this.ctx, this.stringifyVisitor);
      // Reconstruct system from aligned voices

      return voiceSplits.flatMap((split) => split.content);
    });
  }
}

/**
 * At each time stamp, compare where there are nodes in each voice which land at that time stamp.
 * Then, compare the lengths of the stringified segments up to those nodes in each voice.
 * and insert some padding to make the strings the same length.
 * The padding is inserted at the first whitespace token before the node in the voice.
 * Lastly, compare the whole bars' lengths and add padding to the end of the shorter bars.
 */
export function alignBars(voiceSplits: VoiceSplit[], barTimeMap: BarAlignment, stringifyVisitor: AbcFormatter2, ctx: ABCContext): VoiceSplit[] {
  // Get sorted timestamps - convert string keys to rational numbers for sorting
  const timeStamps = Array.from(barTimeMap.map.keys()).sort((a, b) => {
    // Parse the rational numbers from the string keys
    const [aNumerator, aDenominator] = a.split("/").map(Number);
    const [bNumerator, bDenominator] = b.split("/").map(Number);

    // Compare the rational numbers
    if (aDenominator === 0 && bDenominator === 0) {
      return 0; // Both are infinity
    }
    if (aDenominator === 0) return 1; // a is infinity
    if (bDenominator === 0) return -1; // b is infinity

    // Regular comparison: a/b ⋛ c/d ⟺ ad ⋛ bc
    return aNumerator * bDenominator - bNumerator * aDenominator;
  });

  // Process each time point
  timeStamps.forEach((timeStamp) => {
    const locations = barTimeMap.map.get(timeStamp)!;

    // new map with locations, start node and stringified content between startNode and current node
    const locsWithStrings = locations.map(createLocationMapper(voiceSplits, barTimeMap, stringifyVisitor));

    // Find maximum length
    const maxLen = Math.max(...locsWithStrings.map((l) => l.str.length));

    // Add padding where needed
    locsWithStrings.forEach((location) => {
      if (location.str.length < maxLen) {
        const paddingLen = maxLen - location.str.length;

        // Find insertion point
        const insertIdx = findPaddingInsertionPoint(voiceSplits[location.voiceIdx].content, location.nodeID, location.startNode);

        // Insert padding
        if (insertIdx !== -1) {
          const tknCtx: Ctx = new Ctx(" ".repeat(paddingLen));
          tknCtx.current = tknCtx.source.length;
          const padding = new Token(TT.WS, tknCtx);
          voiceSplits[location.voiceIdx].content.splice(insertIdx, 0, padding);

          const startNodeIdx = voiceSplits[location.voiceIdx].content.findIndex((node) => getNodeId(node) === location.startNode);
          if (insertIdx < startNodeIdx) {
            barTimeMap.startNodes.set(location.voiceIdx, getNodeId(padding));
          }
        }
      }
    });
  });

  return voiceSplits;
}
