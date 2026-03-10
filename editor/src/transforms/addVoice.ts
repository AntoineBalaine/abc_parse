import { insertBefore, appendChild } from "abcls-cstree";
import { ABCContext, TT } from "abcls-parser";
import { createCSNode, CSNode, TAGS, isTokenNode, getTokenData } from "../csTree/types";
import { Selection } from "../selection";
import { findFirstByTag } from "../selectors/treeWalk";

export interface VoiceParams {
  name?: string;
  clef?: string;
  transpose?: number;
}

export function addVoice(selection: Selection, voiceId: string, params: VoiceParams, ctx: ABCContext): Selection {
  const tuneHeader = findTuneHeader(selection.root);
  if (tuneHeader === null) return selection;

  const voiceText = buildVoiceText(voiceId, params);
  const voiceInfoLine = buildVoiceInfoLineNode(voiceText, ctx);

  const kLineResult = findKLine(tuneHeader);
  if (kLineResult !== null) {
    insertBefore(kLineResult.node, voiceInfoLine);
  } else {
    appendChild(tuneHeader, voiceInfoLine);
  }

  return selection;
}

function buildVoiceText(voiceId: string, params: VoiceParams): string {
  const parts = [voiceId];
  if (params.name !== undefined) {
    parts.push('name="' + params.name + '"');
  }
  if (params.clef !== undefined) {
    parts.push("clef=" + params.clef);
  }
  if (params.transpose !== undefined) {
    parts.push("transpose=" + params.transpose.toString());
  }
  return parts.join(" ");
}

function buildVoiceInfoLineNode(voiceText: string, ctx: ABCContext): CSNode {
  const keyToken = createCSNode(TAGS.Token, ctx.generateId(), {
    lexeme: "V:",
    tokenType: TT.INF_HDR,
    line: 0,
    position: 0,
  });

  const valueToken = createCSNode(TAGS.Token, ctx.generateId(), {
    lexeme: voiceText,
    tokenType: TT.INFO_STR,
    line: 0,
    position: 2,
  });

  const infoLineNode = createCSNode(TAGS.Info_line, ctx.generateId(), null);
  appendChild(infoLineNode, keyToken);
  appendChild(infoLineNode, valueToken);

  return infoLineNode;
}

function findTuneHeader(root: CSNode): CSNode | null {
  return findFirstByTag(root, TAGS.Tune_header);
}

function findKLine(tuneHeader: CSNode): { node: CSNode; prev: CSNode | null } | null {
  let prev: CSNode | null = null;
  let current = tuneHeader.firstChild;
  while (current !== null) {
    if (current.tag === TAGS.Info_line) {
      const keyChild = current.firstChild;
      if (keyChild !== null && isTokenNode(keyChild)) {
        if (getTokenData(keyChild).lexeme === "K:") {
          return { node: current, prev };
        }
      }
    }
    prev = current;
    current = current.nextSibling;
  }
  return null;
}
