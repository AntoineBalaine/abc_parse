/**
 * Playback Commands
 *
 * Registers VSCode commands for ABC playback.
 */

import * as vscode from "vscode";
import { PlaybackManager } from "./PlaybackManager";

/**
 * Register all playback-related commands.
 */
export function registerPlaybackCommands(context: vscode.ExtensionContext): void {
  const manager = PlaybackManager.getInstance();

  // Play the current document
  const playDocumentCmd = vscode.commands.registerCommand(
    "abc.playDocument",
    async () => {
      await manager.playCurrentDocument();
    }
  );
  context.subscriptions.push(playDocumentCmd);

  // Play the selected text
  const playSelectionCmd = vscode.commands.registerCommand(
    "abc.playSelection",
    async () => {
      await manager.playSelection();
    }
  );
  context.subscriptions.push(playSelectionCmd);

  // Stop playback
  const stopPlaybackCmd = vscode.commands.registerCommand(
    "abc.stopPlayback",
    async () => {
      await manager.stop();
    }
  );
  context.subscriptions.push(stopPlaybackCmd);

  // Pause playback
  const pausePlaybackCmd = vscode.commands.registerCommand(
    "abc.pausePlayback",
    async () => {
      await manager.pause();
    }
  );
  context.subscriptions.push(pausePlaybackCmd);

  // Resume playback
  const resumePlaybackCmd = vscode.commands.registerCommand(
    "abc.resumePlayback",
    async () => {
      await manager.resume();
    }
  );
  context.subscriptions.push(resumePlaybackCmd);

  // Show available instruments
  const showInstrumentsCmd = vscode.commands.registerCommand(
    "abc.showInstruments",
    async () => {
      const instruments = await manager.getInstruments();

      if (instruments.length === 0) {
        vscode.window.showInformationMessage(
          "No instruments available. Install Muse Sounds via MuseHub."
        );
        return;
      }

      const items = instruments.map((inst) => ({
        label: inst.name,
        description: inst.category,
        id: inst.id,
      }));

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: "Available instruments",
      });

      if (selected) {
        vscode.window.showInformationMessage(
          `Selected: ${selected.label} (ID: ${selected.id})`
        );
      }
    }
  );
  context.subscriptions.push(showInstrumentsCmd);

  // Initialize playback on extension activation
  const initPlaybackCmd = vscode.commands.registerCommand(
    "abc.initPlayback",
    async () => {
      await manager.initialize();
    }
  );
  context.subscriptions.push(initPlaybackCmd);

  // Show the status bar
  manager.showStatusBar();

  // Clean up on deactivation
  context.subscriptions.push({
    dispose: async () => {
      await manager.dispose();
    },
  });
}
