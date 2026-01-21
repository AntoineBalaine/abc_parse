/**
 * ABCT Commands for VSCode Extension
 *
 * Provides commands for evaluating ABCT (ABC Transform) files:
 * - abct.evaluate: Evaluate entire file
 * - abct.evaluateToLine: Evaluate up to cursor line
 * - abct.evaluateSelection: Evaluate selected expression
 * - abct.exportToFile: Evaluate and save to ABC file
 * - abct.openEvaluatedOutput: Open evaluated output in editable virtual document
 */

import * as vscode from "vscode";
import { LanguageClient } from "vscode-languageclient/node";
import { AbctEvalDocProvider, ABCT_EVAL_SCHEME } from "./abct/AbctEvalDocProvider";
import { diffChars, generatePatches } from "./abct/diffToPatches";

/**
 * Result returned from ABCT evaluation LSP requests.
 */
interface AbctEvalResult {
  abc: string;
  diagnostics: Array<{
    severity: number;
    range: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
    message: string;
    source: string;
  }>;
}

// Output channel for ABCT results
let abctOutput: vscode.OutputChannel | undefined;

// FileSystemProvider for virtual documents
let evalDocProvider: AbctEvalDocProvider | undefined;

// Subscriptions for cleanup
let providerSubscription: vscode.Disposable | undefined;
let saveSubscription: vscode.Disposable | undefined;
let sourceChangeSubscription: vscode.Disposable | undefined;

// Guard to prevent concurrent save operations
const savesInProgress = new Set<string>();

// Store client reference for refresh command
let lspClient: LanguageClient | undefined;

/**
 * Get or create the ABCT output channel.
 */
function getAbctOutput(): vscode.OutputChannel {
  if (!abctOutput) {
    abctOutput = vscode.window.createOutputChannel("ABCT Output");
  }
  return abctOutput;
}

/**
 * Show the ABC output in the output panel.
 */
function showAbcOutput(abc: string): void {
  const output = getAbctOutput();
  output.clear();
  if (abc) {
    output.appendLine(abc);
  } else {
    output.appendLine("(No output)");
  }
  output.show(true);
}

/**
 * Show evaluation errors in the output panel.
 */
function showErrors(diagnostics: AbctEvalResult["diagnostics"]): void {
  if (diagnostics.length === 0) return;

  const output = getAbctOutput();
  output.appendLine("");
  output.appendLine("--- Errors ---");
  for (const diag of diagnostics) {
    const line = diag.range.start.line + 1;
    const col = diag.range.start.character + 1;
    output.appendLine(`Line ${line}:${col}: ${diag.message}`);
  }
}

/**
 * Check if the current editor has an ABCT file open.
 */
function isAbctFile(editor: vscode.TextEditor | undefined): boolean {
  if (!editor) return false;
  return editor.document.uri.path.endsWith(".abct");
}

/**
 * Register all ABCT commands.
 *
 * @param context - The extension context
 * @param client - The language client for communicating with the LSP server
 */
export function registerAbctCommands(
  context: vscode.ExtensionContext,
  client: LanguageClient
): void {
  // Store client reference for refresh command
  lspClient = client;
  // abct.evaluate - Evaluate entire file
  const evaluateCmd = vscode.commands.registerCommand("abct.evaluate", async () => {
    const editor = vscode.window.activeTextEditor;
    if (!isAbctFile(editor)) {
      vscode.window.showWarningMessage("Please open an ABCT file to evaluate");
      return;
    }

    try {
      const result = await client.sendRequest<AbctEvalResult>("abct.evaluate", {
        uri: editor!.document.uri.toString(),
      });

      showAbcOutput(result.abc);
      showErrors(result.diagnostics);

      if (result.abc && result.diagnostics.length === 0) {
        vscode.window.showInformationMessage("ABCT evaluation completed successfully");
      }
    } catch (error) {
      vscode.window.showErrorMessage(`ABCT evaluation failed: ${error}`);
    }
  });
  context.subscriptions.push(evaluateCmd);

  // abct.evaluateToLine - Evaluate up to cursor line
  const evaluateToLineCmd = vscode.commands.registerCommand("abct.evaluateToLine", async () => {
    const editor = vscode.window.activeTextEditor;
    if (!isAbctFile(editor)) {
      vscode.window.showWarningMessage("Please open an ABCT file to evaluate");
      return;
    }

    // Get the current cursor line (1-based for the LSP request)
    const line = editor!.selection.active.line + 1;

    try {
      const result = await client.sendRequest<AbctEvalResult>("abct.evaluateToLine", {
        uri: editor!.document.uri.toString(),
        line,
      });

      showAbcOutput(result.abc);
      showErrors(result.diagnostics);

      if (result.abc) {
        vscode.window.showInformationMessage(`ABCT evaluated up to line ${line}`);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`ABCT evaluation failed: ${error}`);
    }
  });
  context.subscriptions.push(evaluateToLineCmd);

  // abct.evaluateSelection - Evaluate selected expression
  const evaluateSelectionCmd = vscode.commands.registerCommand("abct.evaluateSelection", async () => {
    const editor = vscode.window.activeTextEditor;
    if (!isAbctFile(editor)) {
      vscode.window.showWarningMessage("Please open an ABCT file to evaluate");
      return;
    }

    const selection = editor!.selection;
    if (selection.isEmpty) {
      vscode.window.showWarningMessage("Please select an ABCT expression to evaluate");
      return;
    }

    try {
      const result = await client.sendRequest<AbctEvalResult>("abct.evaluateSelection", {
        uri: editor!.document.uri.toString(),
        selection: {
          start: { line: selection.start.line, character: selection.start.character },
          end: { line: selection.end.line, character: selection.end.character },
        },
      });

      showAbcOutput(result.abc);
      showErrors(result.diagnostics);

      if (result.abc && result.diagnostics.length === 0) {
        vscode.window.showInformationMessage("ABCT selection evaluated successfully");
      }
    } catch (error) {
      vscode.window.showErrorMessage(`ABCT evaluation failed: ${error}`);
    }
  });
  context.subscriptions.push(evaluateSelectionCmd);

  // abct.exportToFile - Evaluate and save to ABC file
  const exportToFileCmd = vscode.commands.registerCommand("abct.exportToFile", async () => {
    const editor = vscode.window.activeTextEditor;
    if (!isAbctFile(editor)) {
      vscode.window.showWarningMessage("Please open an ABCT file to export");
      return;
    }

    try {
      // First evaluate the file
      const result = await client.sendRequest<AbctEvalResult>("abct.evaluate", {
        uri: editor!.document.uri.toString(),
      });

      if (!result.abc) {
        vscode.window.showWarningMessage("Evaluation produced no output");
        showErrors(result.diagnostics);
        return;
      }

      if (result.diagnostics.length > 0) {
        const proceed = await vscode.window.showWarningMessage(
          "Evaluation had errors. Export anyway?",
          "Export",
          "Cancel"
        );
        if (proceed !== "Export") {
          showAbcOutput(result.abc);
          showErrors(result.diagnostics);
          return;
        }
      }

      // Suggest a filename based on the ABCT file
      const abctPath = editor!.document.uri.fsPath;
      const suggestedPath = abctPath.replace(/\.abct$/, ".abc");

      // Show save dialog
      const saveUri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(suggestedPath),
        filters: { "ABC files": ["abc"] },
      });

      if (saveUri) {
        // Write the file
        await vscode.workspace.fs.writeFile(saveUri, Buffer.from(result.abc, "utf-8"));
        vscode.window.showInformationMessage(`Exported to ${saveUri.fsPath}`);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`ABCT export failed: ${error}`);
    }
  });
  context.subscriptions.push(exportToFileCmd);

  // Initialize virtual document provider
  evalDocProvider = new AbctEvalDocProvider();
  providerSubscription = vscode.workspace.registerFileSystemProvider(ABCT_EVAL_SCHEME, evalDocProvider, {
    isCaseSensitive: true,
    isReadonly: false,
  });
  context.subscriptions.push(providerSubscription);

  // abct.openEvaluatedOutput - Open evaluated output in editable virtual document
  const openEvaluatedOutputCmd = vscode.commands.registerCommand("abct.openEvaluatedOutput", async () => {
    const editor = vscode.window.activeTextEditor;
    if (!isAbctFile(editor)) {
      vscode.window.showWarningMessage("Please open an ABCT file to open evaluated output");
      return;
    }

    if (!evalDocProvider) {
      vscode.window.showErrorMessage("Virtual document provider not initialized");
      return;
    }

    try {
      // Evaluate the ABCT file
      const result = await client.sendRequest<AbctEvalResult>("abct.evaluate", {
        uri: editor!.document.uri.toString(),
      });

      if (!result.abc) {
        vscode.window.showWarningMessage("Evaluation produced no output");
        showErrors(result.diagnostics);
        return;
      }

      // Get the source expression for patches
      // Try to get it from the LSP server, fall back to a default
      let sourceExpr: string;
      try {
        sourceExpr = await client.sendRequest<string>("abct.getLastExpression", {
          uri: editor!.document.uri.toString(),
        });
        if (!sourceExpr) {
          sourceExpr = "_"; // Fallback to underscore (ABCT's "previous result" reference)
        }
      } catch {
        sourceExpr = "_"; // Fallback if LSP request not supported
      }

      // Create virtual document
      const docUri = evalDocProvider.createDocument(editor!.document.uri, result.abc, sourceExpr);

      // Open in editor
      const doc = await vscode.workspace.openTextDocument(docUri);
      await vscode.window.showTextDocument(doc, { preview: false });

      if (result.diagnostics.length > 0) {
        vscode.window.showWarningMessage("Evaluation had errors. Output may be incomplete.");
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to open evaluated output: ${error}`);
    }
  });
  context.subscriptions.push(openEvaluatedOutputCmd);

  // Handle save events for virtual documents
  saveSubscription = vscode.workspace.onDidSaveTextDocument(async (doc) => {
    // Only handle our virtual documents
    if (doc.uri.scheme !== ABCT_EVAL_SCHEME) {
      return;
    }

    if (!evalDocProvider) {
      return;
    }

    const docUriStr = doc.uri.toString();

    // Prevent concurrent saves for the same document
    if (savesInProgress.has(docUriStr)) {
      return;
    }
    savesInProgress.add(docUriStr);

    try {
      const state = evalDocProvider.getDocument(doc.uri);
      if (!state) {
        return;
      }

      // Compute diff between original and current content
      const changes = diffChars(state.originalContent, state.currentContent);

      // No changes? Skip silently
      if (changes.length === 0) {
        return;
      }

      // Generate patches
      const patches = generatePatches(changes, state.sourceExpr);

      // Open the source ABCT file
      const sourceUri = vscode.Uri.parse(state.sourceUri);
      let sourceDoc: vscode.TextDocument;
      try {
        sourceDoc = await vscode.workspace.openTextDocument(sourceUri);
      } catch {
        vscode.window.showErrorMessage("Source ABCT file no longer exists");
        return;
      }

      // Append patches to source ABCT file
      // Only add header if this is the first set of patches
      const edit = new vscode.WorkspaceEdit();
      const endOfFile = new vscode.Position(sourceDoc.lineCount, 0);
      const sourceContent = sourceDoc.getText();
      const hasExistingPatches = sourceContent.includes("# Generated patches");
      const patchText = hasExistingPatches
        ? "\n" + patches.join("\n")
        : "\n\n# Generated patches\n" + patches.join("\n");
      edit.insert(sourceUri, endOfFile, patchText);

      const success = await vscode.workspace.applyEdit(edit);
      if (!success) {
        vscode.window.showErrorMessage("Failed to apply patches to source file");
        return;
      }

      // Mark the virtual document as saved (original = current)
      evalDocProvider.markAsSaved(doc.uri);

      vscode.window.showInformationMessage(`Applied ${patches.length} patch(es) to source file`);
    } finally {
      savesInProgress.delete(docUriStr);
    }
  });
  context.subscriptions.push(saveSubscription);

  // abct.refreshEvaluatedOutput - Refresh the virtual document with new evaluation
  const refreshCmd = vscode.commands.registerCommand("abct.refreshEvaluatedOutput", async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.uri.scheme !== ABCT_EVAL_SCHEME) {
      vscode.window.showWarningMessage("Please focus an evaluated output document to refresh");
      return;
    }

    if (!evalDocProvider || !lspClient) {
      return;
    }

    const state = evalDocProvider.getDocument(editor.document.uri);
    if (!state) {
      return;
    }

    // Check if document has unsaved changes
    if (editor.document.isDirty) {
      const proceed = await vscode.window.showWarningMessage(
        "This document has unsaved changes. Refreshing will discard them.",
        "Refresh Anyway",
        "Cancel"
      );
      if (proceed !== "Refresh Anyway") {
        return;
      }
    }

    try {
      // Re-evaluate the source ABCT file
      const result = await lspClient.sendRequest<AbctEvalResult>("abct.evaluate", {
        uri: state.sourceUri,
      });

      if (!result.abc) {
        vscode.window.showWarningMessage("Re-evaluation produced no output");
        return;
      }

      // Update the virtual document
      evalDocProvider.updateDocument(editor.document.uri, result.abc);

      vscode.window.showInformationMessage("Refreshed evaluated output");
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to refresh: ${error}`);
    }
  });
  context.subscriptions.push(refreshCmd);

  // Watch for source ABCT file changes to auto-update clean virtual documents
  sourceChangeSubscription = vscode.workspace.onDidChangeTextDocument(async (event) => {
    // Only watch ABCT files
    if (!event.document.uri.path.endsWith(".abct")) {
      return;
    }

    if (!evalDocProvider || !lspClient) {
      return;
    }

    // Get all virtual docs linked to this source
    const virtualDocUris = evalDocProvider.getVirtualDocsForSource(event.document.uri);
    if (virtualDocUris.length === 0) {
      return;
    }

    // For each virtual doc, check if it's clean and update it
    for (const virtualUri of virtualDocUris) {
      const state = evalDocProvider.getDocument(virtualUri);
      if (!state) {
        continue;
      }

      // Check if the virtual document is dirty (has unsaved edits)
      // We can't easily check if a TextDocument is dirty without opening it,
      // so we check our internal state instead
      if (evalDocProvider.isDocumentDirty(virtualUri)) {
        // Show a one-time notification
        vscode.window.showWarningMessage(
          "Source ABCT file changed. Use 'ABCT: Refresh Evaluated Output' to update."
        );
        continue;
      }

      // Auto-update the clean document
      try {
        const result = await lspClient.sendRequest<AbctEvalResult>("abct.evaluate", {
          uri: state.sourceUri,
        });

        if (result.abc) {
          evalDocProvider.updateDocument(virtualUri, result.abc);
        }
      } catch {
        // Silently ignore evaluation errors during auto-update
      }
    }
  });
  context.subscriptions.push(sourceChangeSubscription);
}

/**
 * Dispose all ABCT resources.
 * Call this when the extension is deactivated.
 */
export function disposeAbctCommands(): void {
  if (abctOutput) {
    abctOutput.dispose();
    abctOutput = undefined;
  }
  if (evalDocProvider) {
    evalDocProvider.dispose();
    evalDocProvider = undefined;
  }
  if (providerSubscription) {
    providerSubscription.dispose();
    providerSubscription = undefined;
  }
  if (saveSubscription) {
    saveSubscription.dispose();
    saveSubscription = undefined;
  }
  if (sourceChangeSubscription) {
    sourceChangeSubscription.dispose();
    sourceChangeSubscription = undefined;
  }
  lspClient = undefined;
}
