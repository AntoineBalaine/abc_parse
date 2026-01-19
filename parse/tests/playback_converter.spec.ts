import { expect } from "chai";
import { createRational } from "../Visitors/fmt2/rational";
import {
  durationToMicroseconds,
  createSimpleNoteEvents,
  convertTuneToMuseSamplerEvents,
} from "../playback/converter";
import { NoteArticulation } from "../playback/types";

describe("playback/converter", () => {
  describe("durationToMicroseconds", () => {
    // At 120 BPM with beat length 1/8:
    // - One eighth note (1/8) = 1 beat = 0.5 seconds = 500,000 microseconds
    // - One quarter note (1/4) = 2 beats = 1 second = 1,000,000 microseconds
    // - One whole note (1/1) = 8 beats = 4 seconds = 4,000,000 microseconds

    it("should convert an eighth note at 120 BPM to 500,000 microseconds", () => {
      const duration = createRational(1, 8);
      const beatLength = createRational(1, 8);
      const result = durationToMicroseconds(duration, 120, beatLength);
      expect(result).to.equal(500000n);
    });

    it("should convert a quarter note at 120 BPM to 1,000,000 microseconds", () => {
      const duration = createRational(1, 4);
      const beatLength = createRational(1, 8);
      const result = durationToMicroseconds(duration, 120, beatLength);
      expect(result).to.equal(1000000n);
    });

    it("should convert a half note at 120 BPM to 2,000,000 microseconds", () => {
      const duration = createRational(1, 2);
      const beatLength = createRational(1, 8);
      const result = durationToMicroseconds(duration, 120, beatLength);
      expect(result).to.equal(2000000n);
    });

    it("should convert a whole note at 120 BPM to 4,000,000 microseconds", () => {
      const duration = createRational(1, 1);
      const beatLength = createRational(1, 8);
      const result = durationToMicroseconds(duration, 120, beatLength);
      expect(result).to.equal(4000000n);
    });

    it("should handle different tempos", () => {
      // At 60 BPM, one beat = 1 second
      // So one eighth note = 1 beat = 1,000,000 microseconds
      const duration = createRational(1, 8);
      const beatLength = createRational(1, 8);
      const result = durationToMicroseconds(duration, 60, beatLength);
      expect(result).to.equal(1000000n);
    });

    it("should handle different beat lengths", () => {
      // With L:1/4, one quarter note = 1 beat
      // At 120 BPM, one beat = 0.5 seconds = 500,000 microseconds
      const duration = createRational(1, 4);
      const beatLength = createRational(1, 4);
      const result = durationToMicroseconds(duration, 120, beatLength);
      expect(result).to.equal(500000n);
    });

    it("should handle dotted notes (3/16 = 1/8 + 1/16)", () => {
      // A dotted eighth note is 3/16
      // At 120 BPM with L:1/8, that's 1.5 beats = 0.75 seconds = 750,000 microseconds
      const duration = createRational(3, 16);
      const beatLength = createRational(1, 8);
      const result = durationToMicroseconds(duration, 120, beatLength);
      expect(result).to.equal(750000n);
    });
  });

  describe("createSimpleNoteEvents", () => {
    it("should create note events from a simple note list", () => {
      const notes = [
        { pitch: 60, duration_ms: 500 },  // C4, 500ms
        { pitch: 62, duration_ms: 500 },  // D4, 500ms
        { pitch: 64, duration_ms: 500 },  // E4, 500ms
      ];

      const result = createSimpleNoteEvents(notes, 120);

      expect(result.noteEvents).to.have.lengthOf(3);
      expect(result.tempo).to.equal(120);

      // Check first note
      expect(result.noteEvents[0].pitch).to.equal(60);
      expect(result.noteEvents[0].location_us).to.equal(0n);
      expect(result.noteEvents[0].duration_us).to.equal(500000n);

      // Check second note
      expect(result.noteEvents[1].pitch).to.equal(62);
      expect(result.noteEvents[1].location_us).to.equal(500000n);
      expect(result.noteEvents[1].duration_us).to.equal(500000n);

      // Check third note
      expect(result.noteEvents[2].pitch).to.equal(64);
      expect(result.noteEvents[2].location_us).to.equal(1000000n);
      expect(result.noteEvents[2].duration_us).to.equal(500000n);

      // Check total duration
      expect(result.totalDuration_us).to.equal(1500000n);
    });

    it("should set articulation to None for simple notes", () => {
      const notes = [{ pitch: 60, duration_ms: 500 }];
      const result = createSimpleNoteEvents(notes);

      expect(result.noteEvents[0].articulation).to.equal(NoteArticulation.None);
    });

    it("should set voice to 0 for all notes", () => {
      const notes = [
        { pitch: 60, duration_ms: 500 },
        { pitch: 62, duration_ms: 500 },
      ];
      const result = createSimpleNoteEvents(notes);

      expect(result.noteEvents[0].voice).to.equal(0);
      expect(result.noteEvents[1].voice).to.equal(0);
    });

    it("should use default tempo of 120 if not specified", () => {
      const notes = [{ pitch: 60, duration_ms: 500 }];
      const result = createSimpleNoteEvents(notes);

      expect(result.tempo).to.equal(120);
      expect(result.noteEvents[0].tempo).to.equal(120);
    });
  });

  describe("convertTuneToMuseSamplerEvents", () => {
    // These tests require a full Tune object, which is complex to mock.
    // For now, we test with a minimal mock that satisfies the interface.

    it("should return empty events for a tune with no music", () => {
      const mockTune = createMockTune([]);
      const result = convertTuneToMuseSamplerEvents(mockTune);

      expect(result.noteEvents).to.be.an("array").that.is.empty;
      expect(result.dynamicsEvents).to.be.an("array").that.is.empty;
      expect(result.totalDuration_us).to.equal(0n);
    });

    it("should extract tempo from tune metadata", () => {
      const mockTune = createMockTune([]);
      mockTune.metaText.tempo = { bpm: 90 };

      const result = convertTuneToMuseSamplerEvents(mockTune);

      expect(result.tempo).to.equal(90);
    });

    it("should use default tempo when not specified", () => {
      const mockTune = createMockTune([]);

      const result = convertTuneToMuseSamplerEvents(mockTune);

      expect(result.tempo).to.equal(120);
    });
  });
});

/**
 * Creates a minimal mock Tune object for testing.
 */
function createMockTune(systems: any[]): any {
  return {
    version: "1.0",
    media: "screen",
    metaText: {},
    metaTextInfo: {},
    formatting: {},
    systems,
    staffNum: 0,
    voiceNum: 0,
    lineNum: 0,
    getBeatLength: () => 0.125,
    getPickupLength: () => 0,
    getBarLength: () => 1,
    getTotalTime: () => 0,
    getTotalBeats: () => 0,
    millisecondsPerMeasure: () => 2000,
    getBeatsPerMeasure: () => 4,
    getMeter: () => ({ type: "specified", value: [{ numerator: 4, denominator: 4 }] }),
    getMeterFraction: () => ({ numerator: 4, denominator: 4 }),
    getKeySignature: () => ({ root: "C", acc: "", mode: "", accidentals: [] }),
    getElementFromChar: () => null,
    getBpm: () => 120,
    setTiming: () => [],
    setUpAudio: () => {},
    deline: () => {},
    findSelectableElement: () => null,
    getSelectableArray: () => [],
  };
}
