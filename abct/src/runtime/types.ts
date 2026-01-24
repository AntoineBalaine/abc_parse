// ABCT Runtime Type Definitions
// Core interfaces for the transform function library

import { File_structure, Expr } from "abc-parser";

/**
 * Selection represents a subset of nodes within an ABC AST.
 * The selection carries both the full AST and a set of references
 * to the nodes that match a selector criterion.
 *
 * Using direct node references (Set<Expr>) rather than IDs because:
 * - No need to build ID-to-node lookup map
 * - More efficient - avoids ID lookup during transform
 * - Visitor pattern naturally provides node references
 */
export interface Selection {
  /** The full ABC AST */
  ast: File_structure;
  /** Direct references to matching nodes */
  selected: Set<Expr>;
}

/**
 * Transform functions mutate the AST in place.
 * They receive a Selection (full AST + selected nodes) and arguments,
 * and modify only the selected nodes.
 *
 * The pattern follows Transposer.ts from abc_parse:
 * - Walk AST using visitor pattern
 * - Modify only nodes in selection.selected
 * - Mutate node properties in place
 * - Create new Token objects with correct lexemes when needed
 */
export type TransformFn = (selection: Selection, args: unknown[]) => void;

/**
 * A named transform with its implementation function.
 * Used for registering transforms in the runtime registry.
 */
export interface Transform {
  name: string;
  fn: TransformFn;
}

/**
 * Selector function type - takes an AST and returns a Selection
 * with nodes matching the selector criterion.
 */
export type SelectorFn = (ast: File_structure, ...args: unknown[]) => Selection;

/**
 * Result of evaluating an ABCT expression.
 * Can be either a Selection (for piping) or a formatted ABC string (terminal).
 */
export type EvalResult = Selection | string;
