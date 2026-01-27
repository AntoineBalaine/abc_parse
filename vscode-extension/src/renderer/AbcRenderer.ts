/**
 * ABC Renderer - handles preview panel and ABCx conversion
 * Based on abcjs-vscode by Alen Siljak (GPL-3.0)
 */
import * as vscode from "vscode";
import * as path from "path";
import * as os from "os";
import { pathToFileURL } from "url";
import { LanguageClient } from "vscode-languageclient/node";

// Import ABC parser for ABCx conversion and voice filtering
import { ABCContext, AbcErrorReporter, convertAbcxToAbc as abcxToAbc, filterVoicesInAbc } from "abc-parser";

let panel: vscode.WebviewPanel | undefined;
let outputChannel: vscode.OutputChannel;
let svgHandler: ((svg: string) => void) | undefined;
let _context: vscode.ExtensionContext;
let _client: LanguageClient | undefined;

/**
 * Result from ABCT evaluation LSP request
 */
interface AbctEvalResult {
  abc: string;
  diagnostics: Array<{
    severity: number; // 1 = error, 2 = warning, 3 = info, 4 = hint
    range: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
    message: string;
  }>;
}

/**
 * Set the LSP client for ABCT evaluation
 */
export function setLspClient(client: LanguageClient | undefined) {
  _client = client;
}

/**
 * Evaluate ABCT file for preview, with partial output on error
 * @param uri The URI of the ABCT file to evaluate
 * @returns The evaluated ABC string, or partial output up to the first error
 */
export async function evaluateAbctForPreview(uri: string): Promise<string> {
  if (!_client) {
    outputChannel.appendLine("ABCT evaluation: No LSP client available");
    return "";
  }

  try {
    const result = await _client.sendRequest<AbctEvalResult>("abct.evaluate", { uri });

    // Check for errors (severity 1 = Error)
    const hasErrors = result.diagnostics.some((d) => d.severity === 1);

    if (!hasErrors) {
      return result.abc;
    }

    // On error, evaluate up to the line before the first error
    // Sort errors by line number to find the topmost error
    const errors = result.diagnostics.filter((d) => d.severity === 1).sort((a, b) => a.range.start.line - b.range.start.line);
    const firstError = errors[0];
    if (!firstError) {
      return result.abc;
    }

    const errorLine = firstError.range.start.line; // 0-based

    if (errorLine > 0) {
      // Evaluate up to but not including the error line
      // evaluateToLine expects the 0-based line number of the first line to exclude
      try {
        const partialResult = await _client.sendRequest<AbctEvalResult>("abct.evaluateToLine", {
          uri,
          line: errorLine,
        });
        return partialResult.abc;
      } catch (partialError) {
        outputChannel.appendLine(`ABCT partial evaluation error: ${partialError}`);
        return "";
      }
    } else {
      // Error on first line (line 0), no partial output possible
      return "";
    }
  } catch (error) {
    outputChannel.appendLine(`ABCT evaluation error: ${error}`);
    return "";
  }
}

export function initRenderer(context: vscode.ExtensionContext) {
  _context = context;
  outputChannel = vscode.window.createOutputChannel("abc-renderer");
  outputChannel.appendLine("ABC Renderer initialized");
}

export function getOutputChannel(): vscode.OutputChannel {
  return outputChannel;
}

/**
 * Show the preview panel
 * @param context Extension context
 * @param theme Optional theme override ("light" or "dark")
 * @param viewColumn Optional view column for panel placement (default: Beside)
 */
export async function showPreview(context: vscode.ExtensionContext, theme?: "light" | "dark", viewColumn?: vscode.ViewColumn) {
  initializePanel(context, viewColumn);

  if (panel) {
    panel.webview.html = await getHtml(context, getFileNameFromEditor());
    // Send initial configuration after panel loads
    const options = readConfiguration();
    await panel.webview.postMessage({
      command: "configurationChange",
      content: options,
    });
    // Set theme if specified
    if (theme) {
      await panel.webview.postMessage({
        command: "setTheme",
        theme: theme,
      });
    }
  }
}

/**
 * Request HTML export - requires preview panel to be open
 */
export async function requestHtmlExport() {
  if (!panel) {
    vscode.window.showWarningMessage("The HTML Export requires the preview panel to be open, to render content.");
    return;
  }

  svgHandler = exportHtml;
  await panel.webview.postMessage({ command: "requestSvg" });
}

/**
 * Request SVG export - requires preview panel to be open
 */
export async function requestSvgExport() {
  if (!panel) {
    vscode.window.showWarningMessage("The SVG Export requires the preview panel to be open, to render content.");
    return;
  }

  svgHandler = exportSvg;
  await panel.webview.postMessage({ command: "requestSvg" });
}

/**
 * Print preview - opens in browser for printing
 */
export async function printPreview(context: vscode.ExtensionContext) {
  const filePath = path.join(context.extensionPath, "abcjs-renderer", "resources", "print.html");
  let html = await loadFileContent(filePath);

  const editorContent = await getCurrentEditorContent();
  html = html.replace("{{body}}", editorContent);

  const savePath = getHtmlFilenameForExport();
  const url = pathToFileURL(savePath).toString();
  const uri = vscode.Uri.parse(url);
  const content = Uint8Array.from(html.split("").map((x) => x.charCodeAt(0)));
  await vscode.workspace.fs.writeFile(uri, content);

  await vscode.env.openExternal(uri);
}

/**
 * Register event handlers for the renderer
 */
export function registerRendererEvents(context: vscode.ExtensionContext) {
  // Update preview when document changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((eventArgs) => {
      updatePreview(eventArgs);
    })
  );

  // Update preview when switching editors
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(async (eventArgs) => {
      if (eventArgs && panel && vscode.window.activeTextEditor) {
        updatePreview(eventArgs);
      }
    })
  );

  // Handle configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async () => {
      if (panel) {
        const options = readConfiguration();
        await panel.webview.postMessage({
          command: "configurationChange",
          content: options,
        });
      }
    })
  );
}

// --- Internal functions ---

function initializePanel(context: vscode.ExtensionContext, viewColumn?: vscode.ViewColumn) {
  // Reuse existing panel if available, just reveal it in the target column
  if (panel) {
    panel.reveal(viewColumn);
    return;
  }

  panel = createPanel(context, viewColumn);

  panel.webview.onDidReceiveMessage((message) => {
    switch (message.name) {
      case "click":
        select(message.startChar, message.endChar);
        break;

      case "svgExport":
        if (svgHandler) {
          svgHandler(message.content);
        }
        break;
    }
  });

  panel.onDidDispose(() => {
    panel = undefined;
  });
}

function createPanel(context: vscode.ExtensionContext, viewColumn?: vscode.ViewColumn): vscode.WebviewPanel {
  return vscode.window.createWebviewPanel("abcPreview", "ABC Preview", viewColumn ?? vscode.ViewColumn.Beside, {
    enableScripts: true,
    localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, "abcjs-renderer", "resources"))],
  });
}

async function getHtml(context: vscode.ExtensionContext, fileName: string): Promise<string> {
  const editorContent = await getCurrentEditorContent();
  const filePath = path.join(context.extensionPath, "abcjs-renderer", "resources", "viewer.html");
  let html = await loadFileContent(filePath);

  // Inject initial configuration
  const config = readConfiguration();
  html = html.replace("{initialConfig}", JSON.stringify(config));

  html = html.replace("{editorContent}", editorContent);
  html = html.replace("${fileName}", fileName);
  html = html.replace("${title}", fileName);

  return html;
}

async function updatePreview(eventArgs: vscode.TextEditor | vscode.TextDocumentChangeEvent) {
  const editor = getEditor();

  if (!editor || !panel) {
    return;
  }

  const language = eventArgs.document.languageId;
  if (language !== "abc" && language !== "plaintext" && language !== "abct") {
    return;
  }

  const editorContent = await getCurrentEditorContent();

  await panel.webview.postMessage({
    command: "contentChange",
    content: editorContent,
  });

  panel.title = "abc: " + getFileNameFromEditor();
}

/**
 * Get editor content, converting ABCx to ABC or evaluating ABCT if needed
 */
async function getCurrentEditorContent(): Promise<string> {
  const editor = getEditor();
  if (!editor) {
    return "";
  }

  const filePath = editor.document.fileName;
  const languageId = editor.document.languageId;

  // Evaluate ABCT files via LSP
  if (languageId === "abct" || filePath.endsWith(".abct")) {
    const uri = editor.document.uri.toString();
    return await evaluateAbctForPreview(uri);
  }

  let content = getNormalizedEditorContent(editor);

  // Convert ABCx to ABC if needed
  if (filePath.endsWith(".abcx")) {
    content = convertAbcxToAbc(content);
  }

  // Apply voice filter if %%abcls directive is present
  content = applyVoiceFilter(content);

  return content;
}

/**
 * Apply voice filter to ABC content based on %%abcls directives.
 * Because the directive is embedded in the ABC content, we process it here
 * to filter out voices before rendering.
 */
function applyVoiceFilter(content: string): string {
  // Quick check: only process if %%abcls directive is present
  if (!content.includes("%%abcls")) {
    return content;
  }

  try {
    const errorReporter = new AbcErrorReporter();
    const ctx = new ABCContext(errorReporter);
    return filterVoicesInAbc(content, ctx);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    outputChannel.appendLine(`Voice filter error: ${message}`);
    // Return original content if filter fails
    return content;
  }
}

/**
 * Convert ABCx content to ABC format
 */
function convertAbcxToAbc(content: string): string {
  try {
    const errorReporter = new AbcErrorReporter();
    const ctx = new ABCContext(errorReporter);
    return abcxToAbc(content, ctx);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    outputChannel.appendLine(`ABCx conversion error: ${message}`);
    // Return original content if conversion fails
    return content;
  }
}

function getNormalizedEditorContent(editor: vscode.TextEditor): string {
  let content = editor.document.getText();

  // Escape backslashes
  content = content.replaceAll("\\", "\\\\");

  // Normalize line endings
  if (editor.document.eol === vscode.EndOfLine.CRLF) {
    content = content.replace(/\r\n/g, "\n");
  }

  return content;
}

function getEditor(): vscode.TextEditor | undefined {
  let editor = vscode.window.activeTextEditor;
  if (!editor) {
    editor = vscode.window.visibleTextEditors[0];
  }
  return editor;
}

function getEditorFilePath(): string {
  const editor = getEditor();
  return editor?.document.fileName ?? "";
}

function getFileNameFromEditor(): string {
  const filePath = getEditorFilePath();
  const arr = filePath.split(path.sep);
  return arr[arr.length - 1];
}

function select(start: number, end: number) {
  const editor = getEditor();
  if (!editor) return;

  const startPos = editor.document.positionAt(start);
  const endPos = editor.document.positionAt(end);

  editor.selection = new vscode.Selection(startPos, endPos);
  editor.revealRange(editor.selection);
}

function readConfiguration(): object {
  const editor = getEditor();
  const currentDocument = editor?.document;
  const configuration = vscode.workspace.getConfiguration("abc", currentDocument?.uri);

  const tablatureValue: string | undefined = configuration.get("renderer.tablature");
  const tablature = tablatureValue ? [{ instrument: tablatureValue.toLowerCase() }] : undefined;

  return {
    oneSvgPerLine: configuration.get("renderer.oneSvgPerLine"),
    responsive: configuration.get("renderer.responsive"),
    print: configuration.get("renderer.print"),
    showDebug: configuration.get("renderer.showDebug") ? ["grid", "box"] : [],
    jazzchords: configuration.get("renderer.jazzchords"),
    tablature: tablature,
    visualTranspose: configuration.get("renderer.visualTranspose"),
    showTransposedSource: configuration.get("renderer.showTransposedSource"),
  };
}

async function exportHtml(svg: string) {
  const templatePath = path.join(_context.extensionPath, "abcjs-renderer", "resources", "export.html");
  let html = await loadFileContent(templatePath);
  html = html.replace("{{body}}", svg);

  const editorFilePath = getEditorFilePath();
  const filePath = editorFilePath + ".html";
  saveToFile(filePath, html);

  vscode.window.showInformationMessage("HTML exported to", filePath);

  let url = filePath.replaceAll("\\", "/");
  url = "file:///" + url;
  await vscode.env.openExternal(vscode.Uri.parse(url));
}

function exportSvg(svg: string) {
  const editorFilePath = getEditorFilePath();
  const filePath = editorFilePath + ".svg";

  saveToFile(filePath, svg);

  vscode.window.showInformationMessage("SVG exported to", filePath);
}

function getHtmlFilenameForExport(): string {
  const editor = getEditor();

  if (editor?.document.isUntitled) {
    return getTempFilePath("abc-printPreview.html");
  }

  const filePath = editor?.document.fileName;
  if (filePath && path.isAbsolute(filePath)) {
    return filePath + ".html";
  }

  return getTempFilePath("abc-printPreview.html");
}

function getTempFilePath(filename: string): string {
  const tempDir = os.tmpdir();
  return path.join(tempDir, filename);
}

function saveToFile(filePath: string, content: string) {
  const fs = require("fs");
  fs.writeFileSync(filePath, content);
}

async function loadFileContent(filePath: string): Promise<string> {
  const onDiskPath = vscode.Uri.file(filePath);
  const fileContent = await vscode.workspace.fs.readFile(onDiskPath);
  return fileContent.toString();
}
