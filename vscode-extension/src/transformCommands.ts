import * as vscode from "vscode";
import { LanguageClient } from "vscode-languageclient/node";

interface WrapDynamicResult {
  text: string;
}

export function registerTransformCommands(context: vscode.ExtensionContext, client: LanguageClient): void {
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
}
