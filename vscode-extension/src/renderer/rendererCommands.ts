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
  // Optional argument: { viewColumn: vscode.ViewColumn } to control panel placement
  const previewCommand = vscode.commands.registerCommand(
    "abc.showPreview",
    (args?: { viewColumn?: vscode.ViewColumn }) => showPreview(context, undefined, args?.viewColumn)
  );
  context.subscriptions.push(previewCommand);

  // Show Preview (Light) command
  const previewLightCommand = vscode.commands.registerCommand("abc.showPreviewLight", () =>
    showPreview(context, "light")
  );
  context.subscriptions.push(previewLightCommand);

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
