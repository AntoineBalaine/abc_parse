import { CSNode, TAGS, isTokenNode, getTokenData } from "../csTree/types";
import { Selection } from "../selection";
import { findByTag } from "./treeWalk";
import {
  collectCursorIds,
  expandScopeToDescendants,
  isInScope,
} from "./scopeUtils";

/**
 * Parses a voice ID input string into an array of unique voice IDs.
 * Supports space, comma, or tab separators.
 * Normalizes "default" to empty string.
 */
function parseVoiceIds(input: string): string[] {
  const ids = input.split(/[, \t]+/).filter(id => id !== "");
  const normalized = ids.map(id => id === "default" ? "" : id);
  return [...new Set(normalized)];
}

/**
 * Checks if a node is a voice marker (V: info line or [V:...] inline field).
 */
function isVoiceMarker(node: CSNode): boolean {
  if (node.tag === TAGS.Info_line) {
    if (node.firstChild === null || !isTokenNode(node.firstChild)) {
      return false;
    }
    return getTokenData(node.firstChild).lexeme.trim().startsWith("V:");
  }

  if (node.tag === TAGS.Inline_field) {
    const headerChild = node.firstChild?.nextSibling;
    if (headerChild === null || headerChild === undefined || !isTokenNode(headerChild)) {
      return false;
    }
    return getTokenData(headerChild).lexeme.trim().startsWith("V:");
  }

  return false;
}

/**
 * Extracts the voice ID from a voice marker node.
 * Returns the first whitespace-delimited word from the value (to ignore metadata like clef=treble).
 * Returns null if extraction fails.
 */
function extractVoiceId(node: CSNode): string | null {
  let valueChild: CSNode | null | undefined = null;

  if (node.tag === TAGS.Info_line) {
    valueChild = node.firstChild?.nextSibling;
  }

  if (node.tag === TAGS.Inline_field) {
    valueChild = node.firstChild?.nextSibling?.nextSibling;
  }

  if (valueChild === null || valueChild === undefined || !isTokenNode(valueChild)) {
    return null;
  }

  const lexeme = getTokenData(valueChild).lexeme.trim();
  const firstWord = lexeme.split(/\s+/)[0];
  return firstWord || null;
}

/**
 * Context for voice selection walk.
 */
interface VoiceWalkCtx {
  targetVoiceIds: Set<string>;
  currentVoice: string;
  lastMatchingVoice: string | null;
  outputCursors: Set<number>[];
  currentRun: Set<number>;
  scopeIds: Set<number>;
  hasScope: boolean;
  foundMatch: boolean;
}

/**
 * Flushes the current run of contiguous matching elements to outputCursors.
 */
function flushCurrentRun(ctx: VoiceWalkCtx): void {
  if (ctx.currentRun.size > 0) {
    ctx.outputCursors.push(ctx.currentRun);
    ctx.currentRun = new Set<number>();
  }
}

/**
 * Walks the children of a container node (Tune_Body, System, or Music_code), tracking voice
 * changes and selecting matching elements. Recurses into System and Music_code nodes.
 */
function walkChildren(ctx: VoiceWalkCtx, containerNode: CSNode): void {
  let child = containerNode.firstChild;
  while (child !== null) {
    // Recurse into System nodes (Tune_Body's direct children after CSTree conversion)
    if (child.tag === TAGS.System) {
      walkChildren(ctx, child);
      child = child.nextSibling;
      continue;
    }

    if (isVoiceMarker(child)) {
      const extractedId = extractVoiceId(child);
      ctx.currentVoice = extractedId || "";
    }

    const targetMatches = ctx.targetVoiceIds.has(ctx.currentVoice);

    // Flush when voice changes, even if both voices are targets
    // This ensures separate cursors per voice
    if (targetMatches && ctx.lastMatchingVoice !== null && ctx.lastMatchingVoice !== ctx.currentVoice) {
      flushCurrentRun(ctx);
    }

    if (child.tag === TAGS.Music_code) {
      walkChildren(ctx, child);
    } else if (targetMatches) {
      ctx.foundMatch = true;
      ctx.lastMatchingVoice = ctx.currentVoice;
      if (isInScope(child, ctx.scopeIds, ctx.hasScope)) {
        ctx.currentRun.add(child.id);
      } else {
        flushCurrentRun(ctx);
      }
    } else {
      flushCurrentRun(ctx);
    }

    child = child.nextSibling;
  }
}

/**
 * Walks all tune bodies in the tree, selecting elements that belong to the target voice(s).
 */
function walkForVoice(ctx: VoiceWalkCtx, root: CSNode): void {
  const tuneBodies = findByTag(root, TAGS.Tune_Body);

  for (const tuneBody of tuneBodies) {
    ctx.currentVoice = "";
    ctx.lastMatchingVoice = null;
    walkChildren(ctx, tuneBody);
    flushCurrentRun(ctx);
  }
}

/**
 * Selects all tune body elements belonging to the specified voice(s).
 *
 * The voice ID is matched against voice markers (V: info lines and [V:...] inline fields).
 * Elements before any voice marker belong to the default voice (empty string).
 *
 * Input format:
 * - Single voice: "1", "Soprano", "default", ""
 * - Multiple voices: "1 2", "1,2", "1, 2" (space, comma, or tab separated)
 *
 * Special values:
 * - "" (empty string): selects content before any V: marker (single voice mode only)
 * - "default": normalized to "" (single voice mode only)
 *
 * In multi-voice mode, the default voice is excluded (filtered out).
 * Non-existent voice IDs are skipped silently.
 *
 * Limitation: A voice literally named "default" cannot be selected.
 *
 * If no matching voice IDs exist in the tune, returns the input selection unchanged.
 * Contiguous elements belonging to the same voice are grouped into a single cursor.
 * Cursors are not merged between different voices.
 */
export function selectVoices(input: Selection, voiceIds: string): Selection {
  const parsedIds = parseVoiceIds(voiceIds);

  // Determine target voice IDs:
  // - If only default voice(s), select default voice (single voice behavior)
  // - If multiple IDs, filter out default voice
  let targetVoiceIds: Set<string>;
  if (parsedIds.length === 0 || (parsedIds.length === 1 && parsedIds[0] === "")) {
    // Single default voice selection
    targetVoiceIds = new Set([""]);
  } else {
    // Multi-voice or single non-default voice: filter out default
    const nonDefaultIds = parsedIds.filter(id => id !== "");
    targetVoiceIds = new Set(nonDefaultIds.length > 0 ? nonDefaultIds : [""]);
  }

  const rawScopeIds = collectCursorIds(input.cursors);

  const hasScope =
    input.cursors.length > 0 &&
    !(input.cursors.length === 1 && input.cursors[0].size === 1 && input.cursors[0].has(input.root.id));

  // Expand scope to include all descendants of selected nodes.
  // This ensures that when a parent (e.g., Tune) is selected, all its children are in scope.
  const scopeIds = hasScope ? expandScopeToDescendants(input.root, rawScopeIds) : rawScopeIds;

  const outputCursors: Set<number>[] = [];
  const ctx: VoiceWalkCtx = {
    targetVoiceIds,
    currentVoice: "",
    lastMatchingVoice: null,
    outputCursors,
    currentRun: new Set<number>(),
    scopeIds,
    hasScope,
    foundMatch: false,
  };

  walkForVoice(ctx, input.root);

  if (!ctx.foundMatch) {
    return input;
  }

  return { root: input.root, cursors: outputCursors };
}
