import { isBarLine, isBeam, isChord, isComment, isInfo_line, isMultiMeasureRest, isNote, isToken, isVoiceMarker } from "../../helpers";
import { System, TokenType } from "../../types/types";

export type NodeID = number;
export type TimeStamp = number;

interface VoiceSplit {
  type: "formatted" | "noformat";
  content: System;
}

export function mapVoices(system: System): VoiceSplit[] {
  const splits = splitLines(system);
  return splits.map((split) => {
    if (isFormattableLine(split)) {
      return {
        type: "formatted",
        content: split,
      };
    } else {
      return {
        type: "noformat",
        content: split,
      };
    }
  });
}

export function splitLines(system: System): System[] {
  const splits: System[] = [];
  let currentSplit: System = [];

  for (const node of system) {
    if (
      // isInfo_line(node) ||
      isToken(node) &&
      node.type === TokenType.EOL
    ) {
      currentSplit.push(node);
      splits.push(currentSplit);
      currentSplit = [];
    }
    currentSplit.push(node);
  }

  if (currentSplit.length > 0) {
    splits.push(currentSplit);
  }

  return splits;
}
function isFormattableLine(line: System): boolean {
  // Check if line contains music content that needs formatting
  return line.some((node) => isNote(node) || isBeam(node) || isBarLine(node) || isMultiMeasureRest(node) || isChord(node));
}
