// ABCT Runtime
// Evaluates parsed ABCT expressions against ABC ASTs

import { ABCContext } from "../../../parse/parsers/Context";
import { AbcFormatter } from "../../../parse/Visitors/Formatter2";
import { File_structure, Expr } from "../../../parse/types/Expr2";
import { Selection, TransformFn, EvalResult } from "./types";
import {
  selectChords,
  selectNotes,
  selectVoice,
  selectMeasures,
  selectBass,
  selectNotesFromSelection,
  selectChordsFromSelection,
  selectBassFromSelection,
} from "./selectors";
import { getTransform, transforms } from "./transforms";

// Re-export types and functions for public API
export { Selection, TransformFn, EvalResult } from "./types";
export {
  selectChords,
  selectNotes,
  selectVoice,
  selectMeasures,
  selectBass,
  selectNotesFromSelection,
  selectChordsFromSelection,
  selectBassFromSelection,
} from "./selectors";
export { transpose, octave, retrograde, bass, getTransform, transforms } from "./transforms";

/**
 * Create a Selection that includes all music nodes from an AST.
 * This is the starting point for most ABCT operations.
 */
export function selectAll(ast: File_structure): Selection {
  // Select all notes and chords
  const notesSelection = selectNotes(ast);
  const chordsSelection = selectChords(ast);

  // Combine the selections
  const combined = new Set<Expr>();
  for (const node of notesSelection.selected) {
    combined.add(node);
  }
  for (const node of chordsSelection.selected) {
    combined.add(node);
  }

  return { ast, selected: combined };
}

/**
 * Apply a selector to an AST based on a selector path.
 *
 * @param ast - The ABC AST
 * @param selectorId - The selector identifier (e.g., "chords", "notes", "V", "M")
 * @param value - Optional value for parameterized selectors (e.g., voice name, measure range)
 */
export function applySelector(
  ast: File_structure,
  selectorId: string,
  value?: string | number | { start: number; end: number }
): Selection {
  switch (selectorId.toLowerCase()) {
    case "c":
    case "chords":
      return selectChords(ast);

    case "n":
    case "notes":
      return selectNotes(ast);

    case "v":
    case "voices":
      if (typeof value === "string" || typeof value === "number") {
        return selectVoice(ast, String(value));
      }
      throw new Error("Voice selector requires a voice name or number");

    case "m":
    case "measures":
      if (typeof value === "object" && value !== null && "start" in value && "end" in value) {
        return selectMeasures(ast, value.start, value.end);
      }
      if (typeof value === "number") {
        return selectMeasures(ast, value, value);
      }
      throw new Error("Measure selector requires a range (start-end) or single measure number");

    case "bass":
      return selectBass(ast);

    default:
      throw new Error(`Unknown selector: ${selectorId}`);
  }
}

/**
 * Apply a transform to a selection.
 *
 * @param selection - The current selection
 * @param transformName - The name of the transform to apply
 * @param args - Arguments to pass to the transform
 */
export function applyTransform(
  selection: Selection,
  transformName: string,
  args: unknown[] = []
): Selection {
  const transform = getTransform(transformName);
  if (!transform) {
    throw new Error(`Unknown transform: ${transformName}`);
  }

  // Apply the transform (mutates AST in place)
  transform(selection, args);

  // Return the same selection (with mutated AST)
  return selection;
}

/**
 * Format a selection's AST to ABC string output.
 *
 * @param selection - The selection to format
 * @returns The formatted ABC string
 */
export function formatSelection(selection: Selection): string {
  const ctx = new ABCContext();
  const formatter = new AbcFormatter(ctx);
  return formatter.stringify(selection.ast, true);
}

/**
 * Runtime configuration for the ABCT evaluator.
 */
export interface RuntimeConfig {
  /** Whether to format output (pretty print) or stringify as-is */
  format?: boolean;
}

/**
 * ABCT Runtime class for evaluating ABCT expressions.
 * Provides a high-level API for working with ABCT programs.
 */
export class ABCTRuntime {
  config: RuntimeConfig;
  variables: Map<string, Selection>;

  constructor(config: RuntimeConfig = {}) {
    this.config = config;
    this.variables = new Map();
  }

  /**
   * Set a variable in the runtime environment.
   */
  setVariable(name: string, value: Selection): void {
    this.variables.set(name, value);
  }

  /**
   * Get a variable from the runtime environment.
   */
  getVariable(name: string): Selection | undefined {
    return this.variables.get(name);
  }

  /**
   * Create a selection from an AST.
   */
  createSelection(ast: File_structure): Selection {
    return { ast, selected: new Set() };
  }

  /**
   * Apply a selector to a selection.
   */
  select(
    selection: Selection,
    selectorId: string,
    value?: string | number | { start: number; end: number }
  ): Selection {
    return applySelector(selection.ast, selectorId, value);
  }

  /**
   * Apply a transform to a selection.
   */
  transform(
    selection: Selection,
    transformName: string,
    args: unknown[] = []
  ): Selection {
    return applyTransform(selection, transformName, args);
  }

  /**
   * Format a selection to ABC string.
   */
  format(selection: Selection): string {
    return formatSelection(selection);
  }
}

/**
 * Create a new ABCT runtime instance.
 */
export function createRuntime(config: RuntimeConfig = {}): ABCTRuntime {
  return new ABCTRuntime(config);
}
