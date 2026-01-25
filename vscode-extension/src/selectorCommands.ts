import * as vscode from "vscode";
import { LanguageClient } from "vscode-languageclient/node";
import {
  getCursorNodeIds,
  setCursorNodeIds,
  clearCursorState,
  hasCursorState,
  shouldSkipClear,
} from "./cursorState";

interface ApplySelectorResult {
  ranges: Array<{ start: { line: number; character: number }; end: { line: number; character: number } }>;
  cursorNodeIds: number[];
}

function applySelectionsToEditor(editor: vscode.TextEditor, ranges: ApplySelectorResult["ranges"]): void {
  if (ranges.length === 0) {
    vscode.window.showInformationMessage("No matches found.");
    return;
  }

  editor.selections = ranges.map((r) => {
    const start = new vscode.Position(r.start.line, r.start.character);
    const end = new vscode.Position(r.end.line, r.end.character);
    return new vscode.Selection(start, end);
  });

  editor.revealRange(editor.selections[0], vscode.TextEditorRevealType.InCenterIfOutsideViewport);
}

export function updateStatusBar(statusBarItem: vscode.StatusBarItem, cursorCount: number): void {
  if (cursorCount > 0) {
    statusBarItem.text = `$(selection) ${cursorCount} cursor${cursorCount > 1 ? "s" : ""}`;
    statusBarItem.tooltip = "Click to reset selection";
    statusBarItem.show();
  } else {
    statusBarItem.hide();
  }
}

export function registerSelectorCommands(
  context: vscode.ExtensionContext,
  client: LanguageClient,
  statusBarItem: vscode.StatusBarItem
): void {
  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection((event) => {
      if (event.textEditor.document.languageId !== "abc") return;
      // Only clear state for user-initiated selection changes (keyboard or mouse).
      // Programmatic changes (from our own editor.selections assignment) fire with
      // kind === Command or undefined, which we must ignore to preserve cursor state
      // between successive selector commands.
      if (event.kind !== vscode.TextEditorSelectionChangeKind.Keyboard &&
          event.kind !== vscode.TextEditorSelectionChangeKind.Mouse) {
        return;
      }
      const uri = event.textEditor.document.uri.toString();
      clearCursorState(uri);
      statusBarItem.hide();
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.languageId !== "abc") return;
      const changedUri = event.document.uri.toString();

      // Skip clearing if this change is from a transform command
      if (shouldSkipClear(changedUri, event.document.version)) {
        return;
      }

      if (hasCursorState(changedUri)) {
        clearCursorState(changedUri);
      }
      const activeUri = vscode.window.activeTextEditor?.document.uri.toString();
      if (changedUri === activeUri) {
        statusBarItem.hide();
      }
    })
  );

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        const uri = editor.document.uri.toString();
        const ids = getCursorNodeIds(uri);
        if (ids.length > 0) {
          updateStatusBar(statusBarItem, ids.length);
        } else {
          statusBarItem.hide();
        }
      } else {
        statusBarItem.hide();
      }
    })
  );

  const selectorCommands: Array<[string, string]> = [
    ["abc.selectChords", "selectChords"],
    ["abc.selectNotes", "selectNotes"],
    ["abc.selectNonChordNotes", "selectNonChordNotes"],
    ["abc.selectChordNotes", "selectChordNotes"],
    ["abc.selectRests", "selectRests"],
    ["abc.selectTune", "selectTune"],
    ["abc.selectTop", "selectTop"],
    ["abc.selectBottom", "selectBottom"],
    ["abc.selectAllButTop", "selectAllButTop"],
    ["abc.selectAllButBottom", "selectAllButBottom"],
  ];

  for (const [commandId, selectorName] of selectorCommands) {
    context.subscriptions.push(
      vscode.commands.registerCommand(commandId, async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.languageId !== "abc") return;

        const uri = editor.document.uri.toString();
        const cursorNodeIds = getCursorNodeIds(uri);

        try {
          const result = await client.sendRequest<ApplySelectorResult>("abct2.applySelector", {
            uri,
            selector: selectorName,
            cursorNodeIds,
          });

          if (result.cursorNodeIds.length > 0) {
            setCursorNodeIds(uri, result.cursorNodeIds);
            applySelectionsToEditor(editor, result.ranges);
            updateStatusBar(statusBarItem, result.cursorNodeIds.length);
          } else {
            clearCursorState(uri);
            statusBarItem.hide();
          }
        } catch (error) {
          vscode.window.showErrorMessage(`Selector command failed: ${error}`);
        }
      })
    );
  }

  // selectNthFromTop requires a numeric argument from user input
  context.subscriptions.push(
    vscode.commands.registerCommand("abc.selectNthFromTop", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.languageId !== "abc") return;

      const input = await vscode.window.showInputBox({
        prompt: "Enter n (0 = top, 1 = second from top, ...)",
        validateInput: (v) => isNaN(Number(v)) ? "Must be a number" : null,
      });
      if (input === undefined) return;

      const uri = editor.document.uri.toString();
      const cursorNodeIds = getCursorNodeIds(uri);

      try {
        const result = await client.sendRequest<ApplySelectorResult>("abct2.applySelector", {
          uri,
          selector: "selectNthFromTop",
          args: [Number(input)],
          cursorNodeIds,
        });

        if (result.cursorNodeIds.length > 0) {
          setCursorNodeIds(uri, result.cursorNodeIds);
          applySelectionsToEditor(editor, result.ranges);
          updateStatusBar(statusBarItem, result.cursorNodeIds.length);
        } else {
          clearCursorState(uri);
          statusBarItem.hide();
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Selector command failed: ${error}`);
      }
    })
  );

  // resetSelection is now purely local: clear stored IDs and hide the status bar
  context.subscriptions.push(
    vscode.commands.registerCommand("abc.resetSelection", () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.languageId !== "abc") return;

      const uri = editor.document.uri.toString();
      clearCursorState(uri);
      statusBarItem.hide();
    })
  );
}
