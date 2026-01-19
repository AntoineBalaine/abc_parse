/**
 * ABC Player
 *
 * End-to-end integration that parses ABC text and plays it
 * via the MuseSampler native binding.
 */

import { SemanticAnalyzer } from "../analyzers/semantic-analyzer";
import { TuneInterpreter } from "../interpreter/TuneInterpreter";
import { ABCContext } from "../parsers/Context";
import { AbcErrorReporter } from "../parsers/ErrorReporter";
import { parse } from "../parsers/parse2";
import { Scanner } from "../parsers/scan2";
import { Tune } from "../types/abcjs-ast";
import { convertTuneToMuseSamplerEvents, createSimpleNoteEvents } from "./converter";
import { ConversionResult, NoteEvent, DynamicsEvent } from "./types";

/**
 * Result of parsing ABC text.
 */
export interface ParseResult {
  tunes: Tune[];
  errors: string[];
}

/**
 * Parses ABC text into Tune objects.
 *
 * @param abcText - The ABC notation text
 * @returns ParseResult with tunes and any errors
 */
export function parseAbc(abcText: string): ParseResult {
  const ctx = new ABCContext(new AbcErrorReporter());

  const tokens = Scanner(abcText, ctx);
  const ast = parse(tokens, ctx);

  const analyzer = new SemanticAnalyzer(ctx);
  ast.accept(analyzer);

  const interpreter = new TuneInterpreter(analyzer, ctx, abcText);
  const result = interpreter.interpretFile(ast);

  const errors = ctx.errorReporter.hasErrors()
    ? ctx.errorReporter.getErrors().map((e) => e.message)
    : [];

  return {
    tunes: result.tunes,
    errors,
  };
}

/**
 * Parses ABC text and converts to MuseSampler events.
 *
 * @param abcText - The ABC notation text
 * @param tuneIndex - Which tune to convert (default: 0)
 * @returns ConversionResult with note events, or null if parsing failed
 */
export function abcToMuseSamplerEvents(
  abcText: string,
  tuneIndex: number = 0
): ConversionResult | null {
  const { tunes, errors } = parseAbc(abcText);

  if (errors.length > 0) {
    console.error("Parse errors:", errors);
  }

  if (!tunes[tuneIndex]) {
    console.error(`No tune at index ${tuneIndex}`);
    return null;
  }

  return convertTuneToMuseSamplerEvents(tunes[tuneIndex]);
}

/**
 * Playback options for the ABC player.
 */
export interface PlaybackOptions {
  /** Instrument ID to use (from MuseSampler's instrument list) */
  instrumentId?: number;
  /** Tune index if ABC contains multiple tunes */
  tuneIndex?: number;
  /** Sample rate for audio output */
  sampleRate?: number;
  /** Audio block size */
  blockSize?: number;
  /** Number of audio channels */
  channels?: number;
}

/**
 * Playback controller returned by playAbc.
 * Allows controlling playback after it has started.
 */
export interface PlaybackController {
  /** Stop playback */
  stop(): Promise<void>;
  /** Pause playback */
  pause(): Promise<void>;
  /** Resume playback */
  resume(): Promise<void>;
  /** Seek to position in microseconds */
  seek(positionUs: bigint): Promise<void>;
  /** Get the conversion result */
  getEvents(): ConversionResult;
  /** Wait for playback to complete */
  waitForCompletion(timeoutMs?: number): Promise<void>;
}

/**
 * Interface for the MuseSampler client.
 * This allows mocking in tests and decouples from the native binding.
 */
export interface IMuseSamplerClient {
  start(): Promise<void>;
  loadLibrary(path?: string): Promise<string>;
  getInstruments(): Promise<Array<{ id: number; name: string; category: string }>>;
  createSession(sampleRate?: number, blockSize?: number, channels?: number): Promise<ISession>;
  quit(): Promise<void>;
}

export interface ISession {
  addTrack(instrumentId: number): Promise<ITrack>;
  play(): Promise<void>;
  pause(): Promise<void>;
  stop(): Promise<void>;
  seek(positionUs: bigint): Promise<void>;
  destroy(): Promise<void>;
}

export interface ITrack {
  addNoteEvent(event: NoteEvent): Promise<void>;
  addDynamicsEvent(event: DynamicsEvent): Promise<void>;
  finalize(): Promise<void>;
}

/**
 * Creates a playback function using the provided MuseSampler client.
 *
 * This factory function allows dependency injection of the client,
 * making testing easier and decoupling from the native binding.
 *
 * @param client - The MuseSampler client to use
 * @returns A function that plays ABC text
 */
export function createAbcPlayer(client: IMuseSamplerClient) {
  let isInitialized = false;
  let defaultInstrumentId: number | undefined;

  /**
   * Initialize the player by loading the library.
   */
  async function initialize(libraryPath?: string): Promise<void> {
    if (isInitialized) return;

    await client.start();
    await client.loadLibrary(libraryPath);

    // Get first available instrument as default
    const instruments = await client.getInstruments();
    if (instruments.length > 0) {
      defaultInstrumentId = instruments[0].id;
    }

    isInitialized = true;
  }

  /**
   * Play ABC text.
   *
   * @param abcText - The ABC notation text
   * @param options - Playback options
   * @returns PlaybackController for controlling playback
   */
  async function play(
    abcText: string,
    options: PlaybackOptions = {}
  ): Promise<PlaybackController> {
    if (!isInitialized) {
      await initialize();
    }

    const {
      instrumentId = defaultInstrumentId,
      tuneIndex = 0,
      sampleRate = 44100,
      blockSize = 512,
      channels = 2,
    } = options;

    if (instrumentId === undefined) {
      throw new Error("No instrument ID provided and no instruments available");
    }

    // Parse and convert
    const events = abcToMuseSamplerEvents(abcText, tuneIndex);
    if (!events) {
      throw new Error("Failed to parse ABC text");
    }

    // Create session
    const session = await client.createSession(sampleRate, blockSize, channels);
    const track = await session.addTrack(instrumentId);

    // Add note events
    for (const noteEvent of events.noteEvents) {
      await track.addNoteEvent(noteEvent);
    }

    // Add dynamics events
    for (const dynamicsEvent of events.dynamicsEvents) {
      await track.addDynamicsEvent(dynamicsEvent);
    }

    // Finalize and play
    await track.finalize();
    await session.play();

    // Return controller
    return {
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
        const waitTime = timeoutMs ?? durationMs + 1000; // Add 1 second buffer
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      },
    };
  }

  /**
   * Play a simple scale or sequence of notes.
   * Useful for testing without parsing ABC.
   *
   * @param notes - Array of {pitch, duration_ms} objects
   * @param options - Playback options
   */
  async function playNotes(
    notes: Array<{ pitch: number; duration_ms: number }>,
    options: PlaybackOptions = {}
  ): Promise<PlaybackController> {
    if (!isInitialized) {
      await initialize();
    }

    const {
      instrumentId = defaultInstrumentId,
      sampleRate = 44100,
      blockSize = 512,
      channels = 2,
    } = options;

    if (instrumentId === undefined) {
      throw new Error("No instrument ID provided and no instruments available");
    }

    const events = createSimpleNoteEvents(notes);

    const session = await client.createSession(sampleRate, blockSize, channels);
    const track = await session.addTrack(instrumentId);

    for (const noteEvent of events.noteEvents) {
      await track.addNoteEvent(noteEvent);
    }

    await track.finalize();
    await session.play();

    return {
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
  }

  /**
   * Get available instruments.
   */
  async function getInstruments(): Promise<
    Array<{ id: number; name: string; category: string }>
  > {
    if (!isInitialized) {
      await initialize();
    }
    return client.getInstruments();
  }

  /**
   * Shutdown the player.
   */
  async function shutdown(): Promise<void> {
    if (isInitialized) {
      await client.quit();
      isInitialized = false;
    }
  }

  return {
    initialize,
    play,
    playNotes,
    getInstruments,
    shutdown,
  };
}

/**
 * Type for the ABC player instance.
 */
export type AbcPlayer = ReturnType<typeof createAbcPlayer>;
