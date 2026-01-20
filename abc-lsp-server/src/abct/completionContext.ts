// Completion context detection for ABCT files
// Determines what type of completion is appropriate based on cursor position

import { Position } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

/**
 * Type of completion context.
 */
export type CompletionContextType =
  | "transform"
  | "selector"
  | "file"
  | "variable"
  | "selectorArg"
  | "none";

/**
 * Completion context information.
 */
export interface CompletionContext {
  type: CompletionContextType;
  prefix: string;
  selector?: string; // For selectorArg context, the name of the selector
}

/**
 * Determines the completion context based on the cursor position in the document.
 *
 * The context is determined by analyzing text before the cursor:
 * - After `@` -> selector completion
 * - After `@selector:` -> selector argument completion
 * - After `|` or `|=` -> transform completion
 * - After `=` at assignment start -> file completion
 * - Default identifier -> variable completion
 *
 * @param document - The ABCT text document
 * @param position - The cursor position
 * @returns The completion context
 */
export function getCompletionContext(
  document: TextDocument,
  position: Position
): CompletionContext {
  const text = document.getText();
  const lines = text.split("\n");
  const lineIndex = position.line;

  if (lineIndex >= lines.length) {
    return { type: "none", prefix: "" };
  }

  const lineText = lines[lineIndex];
  const textBefore = lineText.substring(0, position.character);

  // After @selector: -> selector argument completion
  // Match patterns like @V:, @v:, @M:, @m:
  const selectorArgMatch = textBefore.match(/@([Vv]):(\w*)$/);
  if (selectorArgMatch) {
    return {
      type: "selectorArg",
      selector: selectorArgMatch[1].toLowerCase(),
      prefix: selectorArgMatch[2],
    };
  }

  // After @M: or @m: -> measure argument completion
  const measureArgMatch = textBefore.match(/@([Mm]):(\d*(?:-\d*)?)$/);
  if (measureArgMatch) {
    return {
      type: "selectorArg",
      selector: measureArgMatch[1].toLowerCase(),
      prefix: measureArgMatch[2],
    };
  }

  // After @ -> selector completion
  const selectorMatch = textBefore.match(/@(\w*)$/);
  if (selectorMatch) {
    return { type: "selector", prefix: selectorMatch[1] };
  }

  // After | or |= -> transform completion
  // Match patterns like "| ", "|= ", "| tr", "|= trans"
  const pipeMatch = textBefore.match(/\|\s*=?\s*(\w*)$/);
  if (pipeMatch) {
    return { type: "transform", prefix: pipeMatch[1] };
  }

  // After = (assignment RHS) -> file context
  // Match patterns like "var = song", "result = "
  const assignRhsMatch = textBefore.match(/^\s*\w+\s*=\s*(\w*\.?\w*)$/);
  if (assignRhsMatch) {
    return { type: "file", prefix: assignRhsMatch[1] || "" };
  }

  // At line start with potential filename -> file context
  // Match patterns like "song", "song.abc"
  const lineStartMatch = textBefore.match(/^(\w*\.?\w*)$/);
  if (lineStartMatch) {
    return { type: "file", prefix: lineStartMatch[1] };
  }

  // Default: check if we're typing an identifier that could be a variable
  const identMatch = textBefore.match(/(\w+)$/);
  if (identMatch) {
    return { type: "variable", prefix: identMatch[1] };
  }

  return { type: "none", prefix: "" };
}

/**
 * Extracts all variable names defined in the document before the given position.
 *
 * Variables are defined by assignment statements like:
 *   varName = expression
 *
 * @param document - The ABCT text document
 * @param position - The current cursor position
 * @returns Array of variable names defined before the position
 */
export function getDefinedVariables(
  document: TextDocument,
  position: Position
): { name: string; line: number }[] {
  const text = document.getText();
  const lines = text.split("\n");
  const variables: { name: string; line: number }[] = [];

  // Only look at lines before the current position
  const maxLine = Math.min(position.line, lines.length);

  for (let i = 0; i < maxLine; i++) {
    const line = lines[i];
    // Match variable assignment: identifier = ...
    const match = line.match(/^\s*(\w+)\s*=/);
    if (match) {
      const varName = match[1];
      // Don't add duplicates - keep the most recent definition
      const existingIndex = variables.findIndex((v) => v.name === varName);
      if (existingIndex >= 0) {
        variables[existingIndex] = { name: varName, line: i + 1 };
      } else {
        variables.push({ name: varName, line: i + 1 });
      }
    }
  }

  return variables;
}
