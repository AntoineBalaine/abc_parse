/**
 * PlaybackManager
 *
 * Manages MuseSampler playback for the VSCode extension.
 * Handles initialization, playback control, and resource cleanup.
 */

import * as vscode from "vscode";
import { MuseSamplerClient } from "abc-musesampler-native";
import { parseAbc, PlaybackController, convertTuneToMuseSamplerEvents } from "abc-parser";

/**
 * Singleton manager for MuseSampler playback.
 */
export class PlaybackManager {
  private static instance: PlaybackManager | null = null;

  private client: MuseSamplerClient | null = null;
  private currentController: PlaybackController | null = null;
  private isInitialized = false;
  private statusBarItem: vscode.StatusBarItem;
  private outputChannel: vscode.OutputChannel;

  private constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.outputChannel = vscode.window.createOutputChannel("ABC Playback");
  }

  /**
   * Get the singleton instance.
   */
  static getInstance(): PlaybackManager {
    if (!PlaybackManager.instance) {
      PlaybackManager.instance = new PlaybackManager();
    }
    return PlaybackManager.instance;
  }

  /**
   * Initialize the MuseSampler client.
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      return true;
    }

    try {
      this.updateStatusBar("Initializing...", "sync~spin");

      this.client = new MuseSamplerClient();
      await this.client.start();

      const version = await this.client.loadLibrary();
      this.outputChannel.appendLine(`MuseSampler loaded: version ${version}`);

      const instruments = await this.client.getInstruments();
      this.outputChannel.appendLine(`Found ${instruments.length} instruments`);

      this.isInitialized = true;
      this.updateStatusBar("Ready", "play");
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`Initialization failed: ${message}`);

      vscode.window.showErrorMessage(
        `MuseSampler initialization failed: ${message}. ` +
          "Make sure Muse Sounds is installed via MuseHub."
      );

      this.updateStatusBar("Not Available", "error");
      return false;
    }
  }

  /**
   * Play the ABC content from the active editor.
   */
  async playCurrentDocument(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage("No active editor with ABC content");
      return;
    }

    if (editor.document.languageId !== "abc") {
      vscode.window.showWarningMessage("Active document is not an ABC file");
      return;
    }

    await this.playText(editor.document.getText());
  }

  /**
   * Play the selected ABC text.
   */
  async playSelection(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.selection.isEmpty) {
      vscode.window.showWarningMessage("No text selected");
      return;
    }

    const selectedText = editor.document.getText(editor.selection);
    await this.playText(selectedText);
  }

  /**
   * Play ABC text.
   */
  async playText(abcText: string): Promise<void> {
    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) {
        return;
      }
    }

    // Stop any current playback
    await this.stop();

    try {
      this.updateStatusBar("Parsing...", "loading~spin");

      // Parse the ABC text
      const { tunes, errors } = parseAbc(abcText);

      if (errors.length > 0) {
        this.outputChannel.appendLine(`Parse warnings: ${errors.join(", ")}`);
      }

      if (tunes.length === 0) {
        vscode.window.showWarningMessage("No tunes found in ABC text");
        this.updateStatusBar("Ready", "play");
        return;
      }

      // Convert to MuseSampler events
      const events = convertTuneToMuseSamplerEvents(tunes[0]);
      this.outputChannel.appendLine(
        `Converted ${events.noteEvents.length} notes, duration: ${Number(events.totalDuration_us) / 1000000}s`
      );

      if (events.noteEvents.length === 0) {
        vscode.window.showWarningMessage("No playable notes found");
        this.updateStatusBar("Ready", "play");
        return;
      }

      // Get instruments and select first available
      const instruments = await this.client!.getInstruments();
      if (instruments.length === 0) {
        vscode.window.showErrorMessage("No instruments available");
        this.updateStatusBar("Ready", "play");
        return;
      }

      // Create session and play
      this.updateStatusBar("Playing...", "debug-pause");

      const session = await this.client!.createSession(44100, 512, 2);
      const track = await session.addTrack(instruments[0].id);

      for (const noteEvent of events.noteEvents) {
        await track.addNoteEvent(noteEvent);
      }

      for (const dynamicsEvent of events.dynamicsEvents) {
        await track.addDynamicsEvent(dynamicsEvent);
      }

      await track.finalize();
      await session.play();

      // Store controller for stop/pause
      this.currentController = {
        async stop() {
          await session.stop();
          await session.destroy();
        },
        async pause() {
          await session.pause();
        },
        async resume() {
          await session.play();
        },
        async seek(positionUs: bigint) {
          await session.seek(positionUs);
        },
        getEvents() {
          return events;
        },
        async waitForCompletion(timeoutMs?: number) {
          const durationMs = Number(events.totalDuration_us) / 1000;
          const waitTime = timeoutMs ?? durationMs + 1000;
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        },
      };

      // Update status bar with stop command
      this.statusBarItem.command = "abc.stopPlayback";

      // Auto-stop after duration
      const durationMs = Number(events.totalDuration_us) / 1000;
      setTimeout(() => {
        if (this.currentController) {
          this.updateStatusBar("Ready", "play");
          this.statusBarItem.command = "abc.playDocument";
        }
      }, durationMs + 500);

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`Playback error: ${message}`);
      vscode.window.showErrorMessage(`Playback failed: ${message}`);
      this.updateStatusBar("Ready", "play");
    }
  }

  /**
   * Stop current playback.
   */
  async stop(): Promise<void> {
    if (this.currentController) {
      try {
        await this.currentController.stop();
      } catch (error) {
        // Ignore errors during stop
      }
      this.currentController = null;
    }
    this.updateStatusBar("Ready", "play");
    this.statusBarItem.command = "abc.playDocument";
  }

  /**
   * Pause current playback.
   */
  async pause(): Promise<void> {
    if (this.currentController) {
      await this.currentController.pause();
      this.updateStatusBar("Paused", "debug-start");
      this.statusBarItem.command = "abc.resumePlayback";
    }
  }

  /**
   * Resume paused playback.
   */
  async resume(): Promise<void> {
    if (this.currentController) {
      await this.currentController.resume();
      this.updateStatusBar("Playing...", "debug-pause");
      this.statusBarItem.command = "abc.pausePlayback";
    }
  }

  /**
   * Get available instruments.
   */
  async getInstruments(): Promise<Array<{ id: number; name: string; category: string }>> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    return this.client?.getInstruments() ?? [];
  }

  /**
   * Update the status bar.
   */
  private updateStatusBar(text: string, icon: string): void {
    this.statusBarItem.text = `$(${icon}) ABC: ${text}`;
    this.statusBarItem.show();
  }

  /**
   * Show the status bar item.
   */
  showStatusBar(): void {
    this.statusBarItem.command = "abc.playDocument";
    this.updateStatusBar("Ready", "play");
  }

  /**
   * Dispose resources.
   */
  async dispose(): Promise<void> {
    await this.stop();

    if (this.client) {
      try {
        await this.client.quit();
      } catch (error) {
        // Ignore errors during cleanup
      }
      this.client = null;
    }

    this.statusBarItem.dispose();
    this.outputChannel.dispose();
    this.isInitialized = false;
    PlaybackManager.instance = null;
  }
}
