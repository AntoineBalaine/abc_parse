/**
 * Text edit computation from character-level diffs.
 *
 * Adapts the LCS-based diffChars function to produce LSP TextEdits.
 */

import { TextEdit, Range } from "vscode-languageserver";
import { diffChars, Change } from "editor";

/**
 * Computes LSP TextEdits from character-level diff between old and new text.
 */
export function computeTextEditsFromDiff(oldText: string, newText: string): TextEdit[] {
  const changes = diffChars(oldText, newText);
  return changes.map(change => changeToTextEdit(change));
}

/**
 * Converts a Change from diffChars to an LSP TextEdit.
 * diffChars uses 1-based positions; LSP uses 0-based.
 */
function changeToTextEdit(change: Change): TextEdit {
  // Convert from 1-based to 0-based positions
  const start = {
    line: change.originalStart.line - 1,
    character: change.originalStart.column - 1
  };

  // For inserts at a point, start and end are the same
  // For deletes/replaces, end column from diffChars is inclusive (last char position)
  // LSP end is exclusive, so we add 1 to the column for single-line ranges
  const end = {
    line: change.originalEnd.line - 1,
    character: change.type === "insert"
      ? change.originalStart.column - 1
      : change.originalEnd.column  // Already exclusive: diffChars gives last char col, LSP needs col after
  };

  const range: Range = { start, end };

  if (change.type === "insert") {
    return TextEdit.insert(start, change.newContent);
  }

  if (change.type === "delete") {
    return TextEdit.del(range);
  }

  // replace
  return TextEdit.replace(range, change.newContent);
}
