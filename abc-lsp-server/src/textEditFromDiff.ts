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
  return changes.map(change => changeToTextEdit(change, oldText));
}

/**
 * Converts a Change from diffChars to an LSP TextEdit.
 * diffChars uses 1-based positions; LSP uses 0-based.
 *
 * Because newline characters require special handling in LSP ranges (the end
 * position should be at the start of the next line, not past the line's end),
 * we need access to the original text to check if deleted/replaced content
 * ends with a newline.
 */
function changeToTextEdit(change: Change, oldText: string): TextEdit {
  // Convert from 1-based to 0-based positions
  const start = {
    line: change.originalStart.line - 1,
    character: change.originalStart.column - 1
  };

  let end: { line: number; character: number };

  if (change.type === "insert") {
    // For inserts, start and end are the same position
    end = { line: start.line, character: start.character };
  } else {
    // For deletes/replaces, we need to compute the end position carefully.
    // diffChars gives us 1-based line:column of the last character (inclusive).
    // We need to convert to LSP's exclusive end position.
    //
    // The tricky case is when the last character is a newline: the LSP end
    // position should be { line: nextLine, character: 0 }, not { line: sameLine, character: col+1 }
    const endLine = change.originalEnd.line - 1;
    const endCol = change.originalEnd.column - 1;

    // Find the character at the end position in the original text
    const charAtEnd = getCharAtPosition(oldText, endLine, endCol);

    if (charAtEnd === "\n") {
      // The range ends with a newline, so the exclusive end is at the start of the next line
      end = { line: endLine + 1, character: 0 };
    } else {
      // Normal case: exclusive end is one character past the inclusive end
      end = { line: endLine, character: endCol + 1 };
    }
  }

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

/**
 * Gets the character at a given 0-based line and column position.
 * Returns empty string if position is out of bounds.
 */
function getCharAtPosition(text: string, line: number, column: number): string {
  const lines = text.split("\n");
  if (line < 0 || line >= lines.length) return "";

  const lineText = lines[line];
  // The newline character is conceptually at position lineText.length
  if (column === lineText.length) return "\n";
  if (column < 0 || column > lineText.length) return "";

  return lineText[column];
}
