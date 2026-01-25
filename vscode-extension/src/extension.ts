// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below

import * as path from "path";
import * as os from "os";
import * as vscode from "vscode";

import { ExtensionContext } from "vscode";
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from "vscode-languageclient/node";
import { setMscorePath } from "abc-musesampler-native";
import { registerCommands } from "./extensionCommands";
import { registerRendererCommands, setLspClient } from "./renderer";
import { registerPlaybackCommands } from "./playback";
import { registerAbctCommands, disposeAbctCommands } from "./abctCommands";
import { registerSelectorCommands } from "./selectorCommands";
import { registerTransformCommands } from "./transformCommands";

let client: LanguageClient;

/**
 * This method is called when the extension is activated.
 *
 * The extension is activated the very first time the command is executed
 */
export async function activate(context: ExtensionContext) {
  // Configure the path to the mscore binary for MuseSampler playback
  const binaryName = os.platform() === "win32" ? "mscore.exe" : "mscore";
  setMscorePath(context.asAbsolutePath(path.join("bin", binaryName)));

  // The server is implemented in node
  const serverModule = context.asAbsolutePath(path.join("dist", "server.js"));

  let debugOptions = { execArgv: ["--nolazy", "--inspect=6009"] };

  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions,
    },
  };

  // Options to control the language client
  const clientOptions: LanguageClientOptions = {
    // Register the server for abc and abct documents
    documentSelector: [
      { scheme: "file", language: "abc" },
      { scheme: "file", language: "abct" },
      // Register the abct-eval scheme with abc language for semantic highlighting on virtual docs
      { scheme: "abct-eval", language: "abc" },
    ],
  };

  // Create the language client and start the client.
  client = new LanguageClient("abcLanguageServer", "ABC Language Server", serverOptions, clientOptions);

  // Set the LSP client for the renderer (enables ABCT preview)
  setLspClient(client);

  // register list of extension's commands
  registerCommands(context, client);

  // register renderer commands (preview, export, print)
  registerRendererCommands(context);

  // register playback commands (play, stop, pause)
  registerPlaybackCommands(context);

  // register ABCT evaluation commands
  registerAbctCommands(context, client);

  // Start the client. This will also launch the server
  await client.start();

  // Create shared statusBarItem for selector and transform commands
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = "abc.resetSelection";
  context.subscriptions.push(statusBarItem);

  // Register selector commands (depends on client being ready)
  registerSelectorCommands(context, client, statusBarItem);

  // Register transform commands (depends on client being ready)
  registerTransformCommands(context, client, statusBarItem);
}

export function deactivate(): Thenable<void> | undefined {
  // Dispose ABCT resources
  disposeAbctCommands();

  if (!client) {
    return undefined;
  }
  return client.stop();
}
