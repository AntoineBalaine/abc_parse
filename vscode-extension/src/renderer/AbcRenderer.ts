/**
 * ABC Renderer - handles preview panel and ABCx conversion
 * Based on abcjs-vscode by Alen Siljak (GPL-3.0)
 */
import * as vscode from "vscode";
import * as path from "path";
import * as os from "os";
import { pathToFileURL } from "url";

// Import ABC parser for ABCx conversion
import { ABCContext, AbcErrorReporter, Scanner, parse } from "abc-parser";
import { AbcxToAbcConverter } from "abc-parser/Visitors/AbcxToAbcConverter";
import { AbcFormatter } from "abc-parser/Visitors/Formatter2";

let panel: vscode.WebviewPanel | undefined;
let outputChannel: vscode.OutputChannel;
let svgHandler: ((svg: string) => void) | undefined;
let _context: vscode.ExtensionContext;

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
 */
export async function showPreview(context: vscode.ExtensionContext) {
  initializePanel(context);

  if (panel) {
    panel.webview.html = await getHtml(context, getFileNameFromEditor());
    // Send initial configuration after panel loads
    const options = readConfiguration();
    await panel.webview.postMessage({
      command: "configurationChange",
      content: options,
    });
  }
}

/**
 * Request HTML export - requires preview panel to be open
 */
export async function requestHtmlExport() {
  if (!panel) {
    vscode.window.showWarningMessage(
      "The HTML Export requires the preview panel to be open, to render content."
    );
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
    vscode.window.showWarningMessage(
      "The SVG Export requires the preview panel to be open, to render content."
    );
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

  const editorContent = getCurrentEditorContent();
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

function initializePanel(context: vscode.ExtensionContext) {
  panel = createPanel(context);

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

function createPanel(context: vscode.ExtensionContext): vscode.WebviewPanel {
  return vscode.window.createWebviewPanel(
    "abcPreview",
    "ABC Preview",
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.file(path.join(context.extensionPath, "abcjs-renderer", "resources")),
      ],
    }
  );
}

async function getHtml(context: vscode.ExtensionContext, fileName: string): Promise<string> {
  const editorContent = getCurrentEditorContent();
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
  if (language !== "abc" && language !== "plaintext") {
    return;
  }

  const editorContent = getCurrentEditorContent();

  await panel.webview.postMessage({
    command: "contentChange",
    content: editorContent,
  });

  panel.title = "abc: " + getFileNameFromEditor();
}

/**
 * Get editor content, converting ABCx to ABC if needed
 */
function getCurrentEditorContent(): string {
  const editor = getEditor();
  if (!editor) {
    return "";
  }

  let content = getNormalizedEditorContent(editor);
  const filePath = editor.document.fileName;

  // Convert ABCx to ABC if needed
  if (filePath.endsWith(".abcx")) {
    content = convertAbcxToAbc(content);
  }

  return content;
}

/**
 * Convert ABCx content to ABC format
 */
function convertAbcxToAbc(content: string): string {
  try {
    const errorReporter = new AbcErrorReporter();
    const ctx = new ABCContext(errorReporter);
    const tokens = Scanner(content, ctx);
    const ast = parse(tokens, ctx);

    const converter = new AbcxToAbcConverter(ctx);
    const abcAst = converter.convert(ast);

    const formatter = new AbcFormatter(ctx);
    return formatter.stringify(abcAst);
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
