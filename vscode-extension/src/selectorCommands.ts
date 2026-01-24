import * as vscode from "vscode";
import { LanguageClient } from "vscode-languageclient/node";

interface ApplySelectorResult {
  ranges: Array<{ start: { line: number; character: number }; end: { line: number; character: number } }>;
  cursorCount: number;
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

function updateStatusBar(statusBarItem: vscode.StatusBarItem, cursorCount: number): void {
  if (cursorCount > 0) {
    statusBarItem.text = `$(selection) ${cursorCount} cursor${cursorCount > 1 ? "s" : ""}`;
    statusBarItem.tooltip = "Click to reset selection";
    statusBarItem.show();
  } else {
    statusBarItem.hide();
  }
}

export function registerSelectorCommands(context: vscode.ExtensionContext, client: LanguageClient): void {
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = "abc.resetSelection";
  context.subscriptions.push(statusBarItem);

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

        try {
          const result = await client.sendRequest<ApplySelectorResult>("abct2.applySelector", {
            uri: editor.document.uri.toString(),
            selector: selectorName,
          });

          applySelectionsToEditor(editor, result.ranges);
          updateStatusBar(statusBarItem, result.cursorCount);
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

      try {
        const result = await client.sendRequest<ApplySelectorResult>("abct2.applySelector", {
          uri: editor.document.uri.toString(),
          selector: "selectNthFromTop",
          args: [Number(input)],
        });

        applySelectionsToEditor(editor, result.ranges);
        updateStatusBar(statusBarItem, result.cursorCount);
      } catch (error) {
        vscode.window.showErrorMessage(`Selector command failed: ${error}`);
      }
    })
  );

  // resetSelection sends a different request
  context.subscriptions.push(
    vscode.commands.registerCommand("abc.resetSelection", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.languageId !== "abc") return;

      try {
        await client.sendRequest<ApplySelectorResult>("abct2.resetSelection", {
          uri: editor.document.uri.toString(),
        });

        updateStatusBar(statusBarItem, 0);
      } catch (error) {
        vscode.window.showErrorMessage(`Reset selection failed: ${error}`);
      }
    })
  );
}
