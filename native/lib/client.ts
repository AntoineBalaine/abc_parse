/**
 * MuseSampler Client
 *
 * TypeScript client for communicating with the mscore helper binary
 * via JSON over stdin/stdout.
 */

import { spawn, ChildProcess } from "child_process";
import { createInterface, Interface } from "readline";
import * as path from "path";
import * as os from "os";
import {
  InstrumentInfo,
  NoteEvent,
  DynamicsEvent,
  Command,
  Response,
  noteEventToJson,
  dynamicsEventToJson,
} from "./types";

/**
 * Default paths where MuseSampler library is installed.
 */
function getDefaultLibraryPath(): string {
  const home = os.homedir();
  switch (os.platform()) {
    case "darwin":
      return path.join(
        home,
        "Library/Application Support/MuseHub/MuseSampler/lib/libMuseSamplerCoreLib.dylib"
      );
    case "linux":
      return path.join(
        home,
        ".local/share/MuseHub/MuseSampler/lib/libMuseSamplerCoreLib.so"
      );
    case "win32":
      return path.join(
        process.env.APPDATA || "",
        "MuseHub/MuseSampler/lib/MuseSamplerCoreLib.dll"
      );
    default:
      throw new Error(`Unsupported platform: ${os.platform()}`);
  }
}

/**
 * Get the path to the mscore binary.
 */
function getMscorePath(): string {
  // Look for mscore binary relative to this file
  const nativeDir = path.dirname(__dirname);
  const buildDir = path.join(nativeDir, "build");
  const binaryName = os.platform() === "win32" ? "mscore.exe" : "mscore";
  return path.join(buildDir, binaryName);
}

/**
 * Track handle for adding events.
 */
export class Track {
  constructor(
    private client: MuseSamplerClient,
    private sessionId: number,
    private trackId: number
  ) {}

  /**
   * Add a note event to this track.
   */
  async addNoteEvent(event: NoteEvent): Promise<void> {
    await this.client.sendCommand({
      cmd: "add_note_event",
      session_id: this.sessionId,
      track_id: this.trackId,
      event: noteEventToJson(event),
    });
  }

  /**
   * Add a dynamics event to this track.
   */
  async addDynamicsEvent(event: DynamicsEvent): Promise<void> {
    await this.client.sendCommand({
      cmd: "add_dynamics_event",
      session_id: this.sessionId,
      track_id: this.trackId,
      dynamics: dynamicsEventToJson(event),
    });
  }

  /**
   * Finalize this track (must be called after adding all events).
   */
  async finalize(): Promise<void> {
    await this.client.sendCommand({
      cmd: "finalize_track",
      session_id: this.sessionId,
      track_id: this.trackId,
    });
  }

  /**
   * Clear all events from this track.
   */
  async clear(): Promise<void> {
    await this.client.sendCommand({
      cmd: "clear_track",
      session_id: this.sessionId,
      track_id: this.trackId,
    });
  }
}

/**
 * Session handle for playback control.
 */
export class Session {
  constructor(
    private client: MuseSamplerClient,
    private sessionId: number
  ) {}

  /**
   * Add a track with the specified instrument.
   */
  async addTrack(instrumentId: number): Promise<Track> {
    const response = await this.client.sendCommand({
      cmd: "add_track",
      session_id: this.sessionId,
      instrument_id: instrumentId,
    });
    return new Track(this.client, this.sessionId, response.track_id!);
  }

  /**
   * Start playback.
   */
  async play(): Promise<void> {
    await this.client.sendCommand({
      cmd: "play",
      session_id: this.sessionId,
    });
  }

  /**
   * Pause playback.
   */
  async pause(): Promise<void> {
    await this.client.sendCommand({
      cmd: "pause",
      session_id: this.sessionId,
    });
  }

  /**
   * Stop playback and reset position.
   */
  async stop(): Promise<void> {
    await this.client.sendCommand({
      cmd: "stop",
      session_id: this.sessionId,
    });
  }

  /**
   * Seek to a position in microseconds.
   */
  async seek(positionUs: bigint): Promise<void> {
    await this.client.sendCommand({
      cmd: "seek",
      session_id: this.sessionId,
      position_us: Number(positionUs),
    });
  }

  /**
   * Destroy this session.
   */
  async destroy(): Promise<void> {
    await this.client.sendCommand({
      cmd: "destroy_session",
      session_id: this.sessionId,
    });
  }
}

/**
 * MuseSampler client.
 *
 * Manages communication with the mscore helper binary.
 */
export class MuseSamplerClient {
  private process: ChildProcess | null = null;
  private readline: Interface | null = null;
  private responseHandlers: Map<number, (response: Response) => void> =
    new Map();
  private requestId = 0;
  private version: string | null = null;

  /**
   * Start the mscore helper process.
   */
  async start(): Promise<void> {
    if (this.process) {
      throw new Error("Client already started");
    }

    const mscorePath = getMscorePath();
    this.process = spawn(mscorePath, [], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Handle stdout (JSON responses)
    this.readline = createInterface({
      input: this.process.stdout!,
      crlfDelay: Infinity,
    });

    this.readline.on("line", (line) => {
      try {
        const response = JSON.parse(line) as Response;
        // For now, we use a simple request-response model
        // Each response is delivered to the oldest pending handler
        const handlerEntry = this.responseHandlers.entries().next();
        if (!handlerEntry.done) {
          const [id, handler] = handlerEntry.value;
          this.responseHandlers.delete(id);
          handler(response);
        }
      } catch (e) {
        console.error("Failed to parse response:", line, e);
      }
    });

    // Handle stderr (logging)
    this.process.stderr?.on("data", (data) => {
      console.error("[mscore]", data.toString().trim());
    });

    // Handle process exit
    this.process.on("exit", (code) => {
      console.error("[mscore] Process exited with code:", code);
      this.process = null;
      this.readline = null;
    });

    // Handle errors
    this.process.on("error", (error) => {
      console.error("[mscore] Process error:", error);
      throw error;
    });
  }

  /**
   * Load the MuseSampler library.
   *
   * @param libraryPath Path to the library, or undefined to use default
   * @returns The library version string
   */
  async loadLibrary(libraryPath?: string): Promise<string> {
    const path = libraryPath || getDefaultLibraryPath();
    const response = await this.sendCommand({
      cmd: "load_library",
      path,
    });

    this.version = response.version || "unknown";
    return this.version;
  }

  /**
   * Get the list of available instruments.
   */
  async getInstruments(): Promise<InstrumentInfo[]> {
    const response = await this.sendCommand({
      cmd: "get_instruments",
    });
    return response.instruments || [];
  }

  /**
   * Create a new playback session.
   */
  async createSession(
    sampleRate = 44100,
    blockSize = 512,
    channels = 2
  ): Promise<Session> {
    const response = await this.sendCommand({
      cmd: "create_session",
      sample_rate: sampleRate,
      block_size: blockSize,
      channels,
    });
    return new Session(this, response.session_id!);
  }

  /**
   * Quit the mscore helper process.
   */
  async quit(): Promise<void> {
    if (!this.process) {
      return;
    }

    await this.sendCommand({ cmd: "quit" });
    this.process = null;
    this.readline = null;
  }

  /**
   * Send a command to the mscore process and wait for response.
   * @internal
   */
  async sendCommand(command: Command): Promise<Response> {
    if (!this.process || !this.process.stdin) {
      throw new Error("Client not started");
    }

    const id = this.requestId++;

    return new Promise((resolve, reject) => {
      this.responseHandlers.set(id, (response) => {
        if (!response.ok) {
          reject(new Error(response.error || "Unknown error"));
        } else {
          resolve(response);
        }
      });

      const json = JSON.stringify(command);
      this.process!.stdin!.write(json + "\n");
    });
  }

  /**
   * Check if the client is connected.
   */
  isConnected(): boolean {
    return this.process !== null;
  }

  /**
   * Get the loaded library version.
   */
  getVersion(): string | null {
    return this.version;
  }
}
