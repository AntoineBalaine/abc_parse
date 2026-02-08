// ============================================================================
// Error Codes (JSON-RPC style)
// ============================================================================

import { TAGS } from "editor";

export const ERROR_CODES = {
  DOCUMENT_NOT_FOUND: -32001,
  FILE_TYPE_NOT_SUPPORTED: -32002,
  INVALID_REQUEST: -32600,
  UNKNOWN_METHOD: -32601,
  INVALID_PARAMS: -32602,
};
/**
 * Transforms that require all selected nodes to be in a single cursor.
 * Because these transforms operate on the sequential relationship between nodes,
 * they need to see all nodes together rather than each node in isolation.
 */
export const GROUPED_CURSOR_TRANSFORMS = new Set(["legato", "consolidateRests"]);

// ============================================================================
// Transform Node Tags Mapping
// ============================================================================
/**
 * Maps transform names to the node tags they operate on.
 * If a transform is not listed, it defaults to [Note, Chord].
 */
export const TRANSFORM_NODE_TAGS: Record<string, string[]> = {
  harmonize: [TAGS.Note, TAGS.Chord],
  consolidateRests: [TAGS.Rest],
  insertVoiceLine: [TAGS.Note, TAGS.Chord],
  voiceInfoLineToInline: [TAGS.Info_line],
  voiceInlineToInfoLine: [TAGS.Inline_field],
  legato: [TAGS.Note, TAGS.Chord, TAGS.Rest, TAGS.YSPACER],
};
