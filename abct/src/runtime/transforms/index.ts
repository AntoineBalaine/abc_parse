// ABCT Transform Functions Index
// Exports all available transform functions

export { transpose, octave } from "./transpose";
export { retrograde } from "./retrograde";
export { bass } from "./bass";

// Re-export for convenience
import { transpose, octave } from "./transpose";
import { retrograde } from "./retrograde";
import { bass } from "./bass";
import { TransformFn } from "../types";

/**
 * Registry of all available transform functions by name.
 * Used by the runtime to look up transforms by their ABCT identifiers.
 */
export const transforms: Record<string, TransformFn> = {
  transpose,
  octave,
  retrograde,
  bass,
};

/**
 * Get a transform function by name.
 * @param name - The transform name (e.g., "transpose", "bass")
 * @returns The transform function, or undefined if not found
 */
export function getTransform(name: string): TransformFn | undefined {
  return transforms[name];
}
