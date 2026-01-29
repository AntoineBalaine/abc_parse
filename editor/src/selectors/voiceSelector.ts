import { CSNode, TAGS, isTokenNode, getTokenData } from "../csTree/types";
import { Selection } from "../selection";

interface VoiceWalkCtx {
  targetVoice: string;
  outputCursors: Set<number>[];
}

function isVoiceMarker(node: CSNode): boolean {
  if (node.tag === TAGS.Info_line) {
    if (!node.firstChild || !isTokenNode(node.firstChild)) return false;
    return getTokenData(node.firstChild).lexeme.trim() === "V:";
  }
  if (node.tag === TAGS.Inline_field) {
    // For Inline_field the first child is "[", and the second child is the field header
    const second = node.firstChild?.nextSibling;
    if (!second || !isTokenNode(second)) return false;
    return getTokenData(second).lexeme.trim() === "V:";
  }
  return false;
}

function extractVoiceId(node: CSNode): string | null {
  let valueChild: CSNode | null = null;
  if (node.tag === TAGS.Info_line) {
    // For Info_line: firstChild is "V:", secondChild is the voice ID
    valueChild = node.firstChild?.nextSibling ?? null;
  } else if (node.tag === TAGS.Inline_field) {
    // For Inline_field: firstChild is "[", secondChild is "V:", thirdChild is the voice ID
    valueChild = node.firstChild?.nextSibling?.nextSibling ?? null;
  }
  if (!valueChild || !isTokenNode(valueChild)) return null;
  // The voice ID is the first whitespace-delimited word, because the rest may
  // contain properties (name="Trumpet" clef=treble)
  return getTokenData(valueChild).lexeme.trim().split(/\s+/)[0] || null;
}

function findTuneBodies(node: CSNode, result: CSNode[]): void {
  let current: CSNode | null = node;
  while (current !== null) {
    if (current.tag === TAGS.Tune_Body) {
      result.push(current);
    }
    if (current.firstChild) {
      findTuneBodies(current.firstChild, result);
    }
    current = current.nextSibling;
  }
}

function walkForVoice(ctx: VoiceWalkCtx, root: CSNode): void {
  const bodies: CSNode[] = [];
  findTuneBodies(root, bodies);

  for (const body of bodies) {
    let currentVoice: string | null = null;
    let child = body.firstChild;
    while (child !== null) {
      if (isVoiceMarker(child)) {
        currentVoice = extractVoiceId(child);
      } else if (currentVoice === ctx.targetVoice) {
        ctx.outputCursors.push(new Set([child.id]));
      }
      child = child.nextSibling;
    }
  }
}

export function selectVoice(input: Selection, voiceId: string): Selection {
  const outputCursors: Set<number>[] = [];
  const ctx: VoiceWalkCtx = { targetVoice: voiceId.trim(), outputCursors };
  walkForVoice(ctx, input.root);
  return { root: input.root, cursors: outputCursors };
}
