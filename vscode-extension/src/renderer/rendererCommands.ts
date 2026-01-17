/**
 * Renderer command registration
 * Based on abcjs-vscode by Alen Siljak (GPL-3.0)
 */
import * as vscode from "vscode";
import {
  initRenderer,
  showPreview,
  requestHtmlExport,
  requestSvgExport,
  printPreview,
  registerRendererEvents,
} from "./AbcRenderer";

export function registerRendererCommands(context: vscode.ExtensionContext) {
  // Initialize the renderer
  initRenderer(context);

  // Show Preview command
  const previewCommand = vscode.commands.registerCommand("abc.showPreview", () =>
    showPreview(context)
  );
  context.subscriptions.push(previewCommand);

  // Export HTML command
  const exportHtmlCommand = vscode.commands.registerCommand(
    "abc.exportHtml",
    () => requestHtmlExport()
  );
  context.subscriptions.push(exportHtmlCommand);

  // Export SVG command
  const exportSvgCommand = vscode.commands.registerCommand(
    "abc.exportSvg",
    () => requestSvgExport()
  );
  context.subscriptions.push(exportSvgCommand);

  // Print Preview command
  const printCommand = vscode.commands.registerCommand("abc.printPreview", () =>
    printPreview(context)
  );
  context.subscriptions.push(printCommand);

  // Register event handlers
  registerRendererEvents(context);
}
