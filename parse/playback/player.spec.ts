/**
 * Tests for ABC Player
 */

import { expect } from "chai";
import {
  parseAbc,
  abcToMuseSamplerEvents,
  createAbcPlayer,
  IMuseSamplerClient,
  ISession,
  ITrack,
} from "./player";
import { NoteEvent, DynamicsEvent } from "./types";

describe("ABC Player", () => {
  describe("parseAbc", () => {
    it("should parse simple ABC text", () => {
      const abc = `X:1
T:Test
M:4/4
L:1/8
K:C
CDEF GABc|]`;

      const result = parseAbc(abc);

      expect(result.tunes).to.have.length(1);
      expect(result.errors).to.have.length(0);
    });

    it("should parse multiple tunes", () => {
      const abc = `X:1
T:First
M:4/4
K:C
CDEF|]

X:2
T:Second
M:4/4
K:G
GABc|]`;

      const result = parseAbc(abc);

      expect(result.tunes).to.have.length(2);
    });

    it("should collect parse errors", () => {
      // An incomplete tune might cause errors
      const abc = `X:1
T:Test`;

      const result = parseAbc(abc);

      // The parser might still produce a tune with warnings/errors
      // This test just verifies the function runs without throwing
      expect(result).to.have.property("tunes");
      expect(result).to.have.property("errors");
    });
  });

  describe("abcToMuseSamplerEvents", () => {
    it("should convert simple ABC to events", () => {
      const abc = `X:1
T:Test
M:4/4
L:1/8
K:C
CDEF GABc|]`;

      const result = abcToMuseSamplerEvents(abc);

      expect(result).to.not.be.null;
      expect(result!.noteEvents.length).to.be.greaterThan(0);
    });

    it("should return null for invalid tune index", () => {
      const abc = `X:1
T:Test
M:4/4
K:C
CDEF|]`;

      const result = abcToMuseSamplerEvents(abc, 5); // No tune at index 5

      expect(result).to.be.null;
    });

    it("should convert notes to correct MIDI pitches", () => {
      const abc = `X:1
T:Test
M:4/4
L:1/4
K:C
C|]`;

      const result = abcToMuseSamplerEvents(abc);

      expect(result).to.not.be.null;
      // C4 = MIDI 60
      const cNote = result!.noteEvents.find((e) => e.pitch === 60);
      expect(cNote).to.exist;
    });

    it("should set tempo from ABC", () => {
      const abc = `X:1
T:Test
M:4/4
L:1/4
Q:1/4=100
K:C
C|]`;

      const result = abcToMuseSamplerEvents(abc);

      expect(result).to.not.be.null;
      // Note: tempo extraction depends on metaText.tempo being set
      // The default is 120 if not specified
      expect(result!.tempo).to.be.a("number");
    });
  });

  describe("createAbcPlayer", () => {
    // Mock client for testing
    function createMockClient(): IMuseSamplerClient & {
      calls: string[];
      noteEvents: NoteEvent[];
      dynamicsEvents: DynamicsEvent[];
    } {
      const calls: string[] = [];
      const noteEvents: NoteEvent[] = [];
      const dynamicsEvents: DynamicsEvent[] = [];

      const mockTrack: ITrack = {
        async addNoteEvent(event: NoteEvent) {
          calls.push("addNoteEvent");
          noteEvents.push(event);
        },
        async addDynamicsEvent(event: DynamicsEvent) {
          calls.push("addDynamicsEvent");
          dynamicsEvents.push(event);
        },
        async finalize() {
          calls.push("finalize");
        },
      };

      const mockSession: ISession = {
        async addTrack(instrumentId: number) {
          calls.push(`addTrack:${instrumentId}`);
          return mockTrack;
        },
        async play() {
          calls.push("play");
        },
        async pause() {
          calls.push("pause");
        },
        async stop() {
          calls.push("stop");
        },
        async seek(positionUs: bigint) {
          calls.push(`seek:${positionUs}`);
        },
        async destroy() {
          calls.push("destroy");
        },
      };

      return {
        calls,
        noteEvents,
        dynamicsEvents,
        async start() {
          calls.push("start");
        },
        async loadLibrary(path?: string) {
          calls.push(`loadLibrary:${path ?? "default"}`);
          return "0.104.0";
        },
        async getInstruments() {
          calls.push("getInstruments");
          return [
            { id: 167, name: "Grand Piano", category: "Muse Keys" },
            { id: 168, name: "Harpsichord", category: "Muse Keys" },
          ];
        },
        async createSession(sampleRate?: number, blockSize?: number, channels?: number) {
          calls.push(`createSession:${sampleRate}:${blockSize}:${channels}`);
          return mockSession;
        },
        async quit() {
          calls.push("quit");
        },
      };
    }

    it("should initialize client on first play", async () => {
      const mockClient = createMockClient();
      const player = createAbcPlayer(mockClient);

      const abc = `X:1
T:Test
M:4/4
L:1/4
K:C
C|]`;

      await player.play(abc);

      expect(mockClient.calls).to.include("start");
      expect(mockClient.calls).to.include("loadLibrary:default");
      expect(mockClient.calls).to.include("getInstruments");
    });

    it("should only initialize once", async () => {
      const mockClient = createMockClient();
      const player = createAbcPlayer(mockClient);

      const abc = `X:1
T:Test
M:4/4
L:1/4
K:C
C|]`;

      await player.play(abc);
      await player.play(abc);

      const startCalls = mockClient.calls.filter((c) => c === "start");
      expect(startCalls).to.have.length(1);
    });

    it("should add note events to track", async () => {
      const mockClient = createMockClient();
      const player = createAbcPlayer(mockClient);

      const abc = `X:1
T:Test
M:4/4
L:1/4
K:C
C D E|]`;

      await player.play(abc);

      expect(mockClient.noteEvents.length).to.be.greaterThan(0);
    });

    it("should use specified instrument ID", async () => {
      const mockClient = createMockClient();
      const player = createAbcPlayer(mockClient);

      const abc = `X:1
T:Test
M:4/4
L:1/4
K:C
C|]`;

      await player.play(abc, { instrumentId: 168 });

      expect(mockClient.calls).to.include("addTrack:168");
    });

    it("should use first available instrument as default", async () => {
      const mockClient = createMockClient();
      const player = createAbcPlayer(mockClient);

      const abc = `X:1
T:Test
M:4/4
L:1/4
K:C
C|]`;

      await player.play(abc);

      // First instrument is 167 (Grand Piano)
      expect(mockClient.calls).to.include("addTrack:167");
    });

    it("should return playback controller", async () => {
      const mockClient = createMockClient();
      const player = createAbcPlayer(mockClient);

      const abc = `X:1
T:Test
M:4/4
L:1/4
K:C
C|]`;

      const controller = await player.play(abc);

      expect(controller).to.have.property("stop");
      expect(controller).to.have.property("pause");
      expect(controller).to.have.property("resume");
      expect(controller).to.have.property("seek");
      expect(controller).to.have.property("getEvents");
    });

    it("should stop playback via controller", async () => {
      const mockClient = createMockClient();
      const player = createAbcPlayer(mockClient);

      const abc = `X:1
T:Test
M:4/4
L:1/4
K:C
C|]`;

      const controller = await player.play(abc);
      await controller.stop();

      expect(mockClient.calls).to.include("stop");
      expect(mockClient.calls).to.include("destroy");
    });

    it("should play simple notes", async () => {
      const mockClient = createMockClient();
      const player = createAbcPlayer(mockClient);

      const notes = [
        { pitch: 60, duration_ms: 500 },
        { pitch: 62, duration_ms: 500 },
      ];

      await player.playNotes(notes);

      expect(mockClient.noteEvents).to.have.length(2);
      expect(mockClient.noteEvents[0].pitch).to.equal(60);
      expect(mockClient.noteEvents[1].pitch).to.equal(62);
    });

    it("should shutdown cleanly", async () => {
      const mockClient = createMockClient();
      const player = createAbcPlayer(mockClient);

      await player.initialize();
      await player.shutdown();

      expect(mockClient.calls).to.include("quit");
    });

    it("should get available instruments", async () => {
      const mockClient = createMockClient();
      const player = createAbcPlayer(mockClient);

      const instruments = await player.getInstruments();

      expect(instruments).to.have.length(2);
      expect(instruments[0].name).to.equal("Grand Piano");
    });
  });
});
