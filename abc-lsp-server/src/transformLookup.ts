/**
 * Transform lookup module for the LSP server.
 *
 * Maps transform names to their implementation functions from the editor module.
 * Each transform operates on a Selection and returns a modified Selection.
 *
 * Context-aware transforms (like toSlashNotation) require additional context
 * from the ContextInterpreter. These are identified by CONTEXT_AWARE_TRANSFORMS.
 */

import {
  Selection,
  transpose,
  enharmonize,
  setRhythm,
  addToRhythm,
  toRest,
  unwrapSingle,
  remove,
  addVoice,
  VoiceParams,
  insertVoiceLine,
  harmonize,
  harmonizeVoicing,
  VoicingType,
  consolidateRests,
  voiceInfoLineToInline,
  voiceInlineToInfoLine,
  explode,
  explode2,
  explode3,
  explode4,
  addSharp,
  addFlat,
  multiplyRhythm,
  divideRhythm,
  legato,
  toSlashNotation,
} from "editor";
import { ABCContext, IRational } from "abc-parser";
import { DocumentSnapshots } from "abc-parser/interpreter/ContextInterpreter";

export type TransformFn = (selection: Selection, ctx: ABCContext, ...args: unknown[]) => Selection;

const TRANSFORM_MAP: Record<string, TransformFn> = {
  transpose: (sel, ctx, ...args) => transpose(sel, args[0] as number, ctx),
  enharmonize: (sel, ctx) => enharmonize(sel, ctx),
  setRhythm: (sel, ctx, ...args) => setRhythm(sel, args[0] as IRational, ctx),
  addToRhythm: (sel, ctx, ...args) => addToRhythm(sel, args[0] as IRational, ctx),
  toRest: (sel, ctx) => toRest(sel, ctx),
  unwrapSingle: (sel) => unwrapSingle(sel),
  remove: (sel) => remove(sel),
  addVoice: (sel, ctx, ...args) => addVoice(sel, args[0] as string, args[1] as VoiceParams, ctx),
  harmonize: (sel, ctx, ...args) => harmonize(sel, args[0] as number, ctx),
  consolidateRests: (sel, ctx) => consolidateRests(sel, ctx),
  insertVoiceLine: (sel, ctx, ...args) => insertVoiceLine(sel, args[0] as string, ctx),
  voiceInfoLineToInline: (sel, ctx) => voiceInfoLineToInline(sel, ctx),
  voiceInlineToInfoLine: (sel, ctx) => voiceInlineToInfoLine(sel, ctx),
  explode: (sel, ctx, ...args) => explode(sel, args[0] as number, ctx),
  explode2: (sel, ctx) => explode2(sel, ctx),
  explode3: (sel, ctx) => explode3(sel, ctx),
  explode4: (sel, ctx) => explode4(sel, ctx),
  addSharp: (sel, ctx) => addSharp(sel, ctx),
  addFlat: (sel, ctx) => addFlat(sel, ctx),
  multiplyRhythm: (sel, ctx, ...args) => multiplyRhythm(sel, args[0] !== undefined ? Number(args[0]) : 2, ctx),
  divideRhythm: (sel, ctx, ...args) => divideRhythm(sel, args[0] !== undefined ? Number(args[0]) : 2, ctx),
  legato: (sel, ctx) => legato(sel, ctx),
  toSlashNotation: (sel, ctx, ...args) => toSlashNotation(sel, ctx, args[0] as DocumentSnapshots),
  // For context-aware transforms, socketHandler prepends snapshots at args[0]
  harmonizeVoicing: (sel, ctx, ...args) =>
    harmonizeVoicing(sel, args[1] as VoicingType, args[2] as number, args[3] as number | null, ctx, args[0] as DocumentSnapshots),
};

export function lookupTransform(name: string): TransformFn | null {
  return TRANSFORM_MAP[name] ?? null;
}

// ============================================================================
// Context-Aware Transforms
// ============================================================================

/**
 * Transforms that require DocumentSnapshots from ContextInterpreter.
 * These transforms need musical context like meter, note length, and clef.
 */
export const CONTEXT_AWARE_TRANSFORMS = new Set(["toSlashNotation", "harmonizeVoicing"]);
