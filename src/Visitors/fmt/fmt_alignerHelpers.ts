import { isBarLine, isToken } from "../../helpers";
import { ABCContext } from "../../parsers/Context";
import { Token } from "../../types/token";
import { System, TokenType } from "../../types/types";
import { AbcFormatter } from "../Formatter";
import { BarAlignment, Location, VoiceSplit } from "./fmt_aligner";
import { NodeID } from "./fmt_timeMapHelpers";

export function reconstructSystem(voiceSplits: VoiceSplit[]): System {
  const newSystem: System = [];

  for (const split of voiceSplits) {
    switch (split.type) {
      case "formatted":
        // Add aligned voice content
        newSystem.push(...split.content);
        break;
      case "noformat":
        // Preserve unformatted lines as-is
        newSystem.push(...split.content);
        break;
    }
  }

  return newSystem;
}

/**
 * Returns a fn for use in map() that creates a location object with stringified content between start and current node.
 */
export function createLocationMapper(voiceSplits: VoiceSplit[], barTimeMap: BarAlignment, stringifyVisitor: AbcFormatter) {
  return (loc: Location) => {
    const startNode = barTimeMap.startNodes.get(loc.voiceIdx)!;
    const voice = voiceSplits[loc.voiceIdx].content;

    // Get string representation between start and current
    const str = stringifyVoiceSlice(voice, startNode, loc.nodeID, stringifyVisitor);

    return {
      str,
      startNode,
      ...loc,
    };
  };
}
export function stringifyVoiceSlice(voice: System, startId: NodeID, endId: NodeID, stringifyVisitor: AbcFormatter): string {
  const startIdx = voice.findIndex((node) => node.id === startId);
  const endIdx = voice.findIndex((node) => node.id === endId);

  if (startIdx === -1 || endIdx === -1) {
    return "";
  }

  const segment = voice.slice(startIdx, endIdx);
  return segment.map((node) => stringifyVisitor.stringify(node)).join("");
}

function getBarsIndexes(voice: System): number[] {
  const bars: Array<number> = [-1];

  voice.forEach((node, idx) => {
    if (isBarLine(node)) {
      bars.push(idx);
    }
  });
  return bars;
}

interface BarLocation {
  startIdx: number;
  endIdx: number;
  voiceIdx: number;
}

/** returns a map of KVs where the K is a bar number,
 * and the V is the location of the bar start node:
 * start idx, end idx, voice idx.
 */
function getBarMap(voiceSplits: VoiceSplit[]): Map<number, BarLocation[]> {
  const barMap = new Map<number, BarLocation[]>();

  voiceSplits.forEach((split, voiceIdx) => {
    if (split.type !== "formatted") {
      return;
    }

    const barIndexes = getBarsIndexes(split.content);

    // For each bar
    for (let barNum = 0; barNum < barIndexes.length; barNum++) {
      const startIdx = barIndexes[barNum];
      const endIdx = barIndexes[barNum + 1] ?? split.content.length;

      if (!barMap.has(barNum)) {
        barMap.set(barNum, []);
      }

      barMap.get(barNum)!.push({
        startIdx,
        endIdx,
        voiceIdx,
      });
    }
  });

  return barMap;
}

export function equalizeBarLengths(voiceSplits: Array<VoiceSplit>, ctx: ABCContext, stringifyVisitor: AbcFormatter): Array<VoiceSplit> {
  const barMap = getBarMap(voiceSplits);

  // Get last bar number for each voice
  const lastBarsPerVoice = new Map<number, number>();
  voiceSplits.forEach((split, voiceIdx) => {
    if (split.type === "formatted") {
      const barIndexes = getBarsIndexes(split.content);
      lastBarsPerVoice.set(voiceIdx, barIndexes.length - 1);
    }
  });

  // Process bars in reverse order
  Array.from(barMap.keys())
    .sort((a, b) => b - a)
    .forEach((barNum) => {
      const locations = barMap.get(barNum)!;

      const barLengths = locations.map((loc) => {
        // Skip if this is the last bar for this voice
        if (lastBarsPerVoice.get(loc.voiceIdx) === barNum) {
          return { ...loc, length: 0, isLastBar: true };
        }

        const voice = voiceSplits[loc.voiceIdx].content;
        const barContent = voice.slice(loc.startIdx + 1, loc.endIdx).filter((node) => !(isToken(node) && node.type === TokenType.EOL));
        return {
          ...loc,
          length: barContent.map((node) => stringifyVisitor.stringify(node)).join("").length,
          isLastBar: false,
        };
      });
      if (barLengths.every((bar) => bar.isLastBar)) {
        return;
      }
      // Only consider lengths of non-last bars for max length
      const maxLen = Math.max(...barLengths.filter((b) => !b.isLastBar).map((b) => b.length));

      // Add padding where needed (skip last bars)
      barLengths.forEach(({ voiceIdx, endIdx, length, isLastBar }) => {
        if (!isLastBar && length < maxLen) {
          const paddingLen = maxLen - length;
          const padding = new Token(TokenType.WHITESPACE, " ".repeat(paddingLen), null, -1, -1, ctx);
          voiceSplits[voiceIdx].content.splice(endIdx, 0, padding);
        }
      });
    });

  return voiceSplits;
}
/**
 * Find first WS position before `nodeId` - or use `startNodeId`.
 */
export function findPaddingInsertionPoint(voice: System, nodeId: NodeID, startNodeId: NodeID): number {
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

export function equalizer(voiceSplits: Array<VoiceSplit>, ctx: ABCContext, stringifyVisitor: AbcFormatter): Array<VoiceSplit> {
  let voices = voiceSplits.map((split) => ({
    ...split,
    cursor: 0,
    stringified: "",
  }));

  while (voices.some((voice) => voice.type === "formatted")) {
    // Update cursor and stringified content for each voice
    voices.forEach((voice) => {
      if (voice.type !== "formatted") return;

      // Find next barline
      const nextBarIndex = voice.content.findIndex((node, idx) => idx > voice.cursor && isBarLine(node));

      // If no more bars or hit EOL/EOF, mark as noformat
      if (nextBarIndex === -1) {
        voice.type = "noformat";
        return;
      } else {
        // Update cursor and get stringified content
        voice.cursor = nextBarIndex;
        voice.stringified = voice.content
          .slice(0, voice.cursor)
          .map((node) => stringifyVisitor.stringify(node))
          .join("");
      }
    });

    // Check if we still have formatted voices
    if (!voices.some((voice) => voice.type === "formatted")) break;

    // Find max length and add padding where needed
    const maxLen = Math.max(...voices.filter((voice) => voice.type === "formatted").map((voice) => voice.stringified.length));

    voices.forEach((voice) => {
      if (voice.type !== "formatted") return;

      if (voice.stringified.length < maxLen) {
        const paddingLen = maxLen - voice.stringified.length;
        const insertIdx = findPaddingInsertionPoint(voice.content, voice.content[voice.cursor].id, voice.content[0].id);

        if (insertIdx !== -1) {
          const padding = new Token(TokenType.WHITESPACE, " ".repeat(paddingLen), null, -1, -1, ctx);
          voice.content.splice(insertIdx + 1, 0, padding);
          voice.cursor++;
        }
      }
    });
  }

  return voices;
}
