/**
 * Transform lookup module for the LSP server.
 *
 * Maps transform names to their implementation functions from abct2.
 * Each transform operates on a Selection and returns a modified Selection.
 */

import { Selection } from "../../abct2/src/selection";
import { ABCContext, IRational } from "abc-parser";
import {
  transpose,
  enharmonize,
  setRhythm,
  addToRhythm,
  toRest,
  unwrapSingle,
  remove,
  addVoice,
  VoiceParams,
} from "../../abct2/src/transforms";
import { harmonize } from "../../abct2/src/transforms/harmonize";

export type TransformFn = (
  selection: Selection,
  ctx: ABCContext,
  ...args: unknown[]
) => Selection;

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
};

export function lookupTransform(name: string): TransformFn | null {
  return TRANSFORM_MAP[name] ?? null;
}
