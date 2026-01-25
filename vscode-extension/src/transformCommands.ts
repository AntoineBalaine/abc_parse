/**
 * Transform commands for the VSCode extension.
 *
 * These commands apply ABCt2 transforms to the current selection state.
 * The cursor state is preserved across transforms, allowing chained operations.
 */

import * as vscode from "vscode";
import { LanguageClient } from "vscode-languageclient/node";
import {
  getCursorNodeIds,
  setCursorNodeIds,
  setExpectedVersion,
} from "./cursorState";
import { updateStatusBar } from "./selectorCommands";

interface ApplyTransformResult {
  textEdits: Array<{ range: { start: { line: number; character: number }; end: { line: number; character: number } }; newText: string }>;
  cursorNodeIds: number[];
  cursorRanges: Array<{ start: { line: number; character: number }; end: { line: number; character: number } }>;
}

interface WrapDynamicResult {
  text: string;
}

export function registerTransformCommands(
  context: vscode.ExtensionContext,
  client: LanguageClient,
  statusBarItem: vscode.StatusBarItem
): void {
  // Wrap dynamic commands (crescendo/decrescendo)
  const wrapCommands: Array<[string, string]> = [
    ["abc.wrapCrescendo", "crescendo"],
    ["abc.wrapDecrescendo", "decrescendo"],
  ];

  for (const [commandId, dynamicType] of wrapCommands) {
    context.subscriptions.push(
      vscode.commands.registerCommand(commandId, async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.languageId !== "abc") return;

        const selection = editor.selection;
        if (selection.isEmpty) {
          vscode.window.showInformationMessage("Please select some notes first.");
          return;
        }

        const uri = editor.document.uri.toString();

        try {
          const result = await client.sendRequest<WrapDynamicResult>("abc.wrapDynamic", {
            uri,
            dynamicType,
            selection: {
              start: { line: selection.start.line, character: selection.start.character },
              end: { line: selection.end.line, character: selection.end.character },
            },
          });

          if (result.text) {
            const fullRange = new vscode.Range(
              editor.document.positionAt(0),
              editor.document.positionAt(editor.document.getText().length)
            );
            await editor.edit((editBuilder) => {
              editBuilder.replace(fullRange, result.text);
            });
          }
        } catch (error) {
          vscode.window.showErrorMessage(`Transform command failed: ${error}`);
        }
      })
    );
  }

  // Transforms without arguments
  const simpleTransforms: Array<[string, string]> = [
    ["abc.enharmonize", "enharmonize"],
    ["abc.toRest", "toRest"],
    ["abc.unwrapSingle", "unwrapSingle"],
    ["abc.remove", "remove"],
  ];

  for (const [commandId, transformName] of simpleTransforms) {
    context.subscriptions.push(
      vscode.commands.registerCommand(commandId, () =>
        applyTransform(client, transformName, [], statusBarItem)
      )
    );
  }

  // transpose: prompt for semitones
  context.subscriptions.push(
    vscode.commands.registerCommand("abc.transpose", async () => {
      const input = await vscode.window.showInputBox({
        prompt: "Semitones to transpose (negative = down)",
        validateInput: v => isNaN(Number(v)) ? "Must be a number" : null,
      });
      if (input === undefined) return;
      await applyTransform(client, "transpose", [Number(input)], statusBarItem);
    })
  );

  // setRhythm: prompt for rational value
  context.subscriptions.push(
    vscode.commands.registerCommand("abc.setRhythm", async () => {
      const input = await vscode.window.showInputBox({
        prompt: "Rhythm value (e.g., 1/4, 1/2, 3/8)",
        placeHolder: "1/4",
      });
      if (input === undefined) return;
      const rational = parseRational(input);
      if (!rational) {
        vscode.window.showErrorMessage("Invalid rational format");
        return;
      }
      await applyTransform(client, "setRhythm", [rational], statusBarItem);
    })
  );

  // addToRhythm: prompt for rational value
  context.subscriptions.push(
    vscode.commands.registerCommand("abc.addToRhythm", async () => {
      const input = await vscode.window.showInputBox({
        prompt: "Value to add to rhythm (e.g., 1/8, -1/4)",
        placeHolder: "1/8",
      });
      if (input === undefined) return;
      const rational = parseRational(input);
      if (!rational) {
        vscode.window.showErrorMessage("Invalid rational format");
        return;
      }
      await applyTransform(client, "addToRhythm", [rational], statusBarItem);
    })
  );

  // addVoice: prompt for voice ID and optional params
  context.subscriptions.push(
    vscode.commands.registerCommand("abc.addVoice", async () => {
      const voiceId = await vscode.window.showInputBox({
        prompt: "Voice ID (e.g., V1, T, S)",
      });
      if (!voiceId) return;

      const name = await vscode.window.showInputBox({
        prompt: "Voice name (optional)",
      });

      await applyTransform(client, "addVoice", [
        voiceId,
        { name: name || undefined }
      ], statusBarItem);
    })
  );

  // Quick-access transpose commands with preset values
  const transposePresets: Array<[string, number]> = [
    ["abc.transposeOctaveUp", 12],
    ["abc.transposeOctaveDown", -12],
    ["abc.transposeHalfStepUp", 1],
    ["abc.transposeHalfStepDown", -1],
  ];

  for (const [commandId, semitones] of transposePresets) {
    context.subscriptions.push(
      vscode.commands.registerCommand(commandId, () =>
        applyTransform(client, "transpose", [semitones], statusBarItem)
      )
    );
  }
}

async function applyTransform(
  client: LanguageClient,
  transform: string,
  args: unknown[],
  statusBarItem: vscode.StatusBarItem
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== "abc") return;

  const uri = editor.document.uri.toString();
  const cursorNodeIds = getCursorNodeIds(uri);

  if (cursorNodeIds.length === 0) {
    vscode.window.showInformationMessage("No selection. Use selector commands first.");
    return;
  }

  try {
    const result = await client.sendRequest<ApplyTransformResult>(
      "abct2.applyTransform",
      { uri, transform, cursorNodeIds, args }
    );

    // Record expected version BEFORE applying edit to prevent state clearing
    const currentVersion = editor.document.version;
    setExpectedVersion(uri, currentVersion + 1);

    // Apply text edits
    const workspaceEdit = new vscode.WorkspaceEdit();
    for (const edit of result.textEdits) {
      const range = new vscode.Range(
        edit.range.start.line, edit.range.start.character,
        edit.range.end.line, edit.range.end.character
      );
      workspaceEdit.replace(editor.document.uri, range, edit.newText);
    }

    const editSuccess = await vscode.workspace.applyEdit(workspaceEdit);
    if (!editSuccess) {
      // Edit failed, clear the expected version to avoid stale state
      setExpectedVersion(uri, null);
      vscode.window.showErrorMessage("Failed to apply transform edits");
      return;
    }

    // Update cursor state with surviving IDs
    setCursorNodeIds(uri, result.cursorNodeIds);

    // Update editor selections
    if (result.cursorRanges.length > 0) {
      editor.selections = result.cursorRanges.map(r => new vscode.Selection(
        new vscode.Position(r.start.line, r.start.character),
        new vscode.Position(r.end.line, r.end.character)
      ));
      updateStatusBar(statusBarItem, result.cursorNodeIds.length);
    } else {
      // After remove or when no cursors remain, reset the status bar
      statusBarItem.hide();
    }

  } catch (error) {
    // Clear expected version on error to avoid stale state
    setExpectedVersion(uri, null);
    vscode.window.showErrorMessage(`Transform failed: ${error}`);
  }
}

function parseRational(input: string): { numerator: number; denominator: number } | null {
  const match = input.match(/^(-?\d+)(?:\/(\d+))?$/);
  if (!match) return null;
  const numerator = parseInt(match[1], 10);
  const denominator = match[2] ? parseInt(match[2], 10) : 1;
  if (denominator === 0) return null;
  return { numerator, denominator };
}
