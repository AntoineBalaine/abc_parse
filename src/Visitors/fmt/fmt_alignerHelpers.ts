import { isToken } from "../../helpers";
import { System, TokenType } from "../../types/types";
import { VoiceSplit } from "./fmt_aligner";
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

export function findPaddingInsertionPoint(voice: System, nodeId: NodeID, startNodeId: NodeID): number {
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
