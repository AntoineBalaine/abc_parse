/**
 * Tests for ABCJS Tune to MuseSampler event converter
 */

import { expect } from "chai";
import { durationToMicroseconds, createSimpleNoteEvents } from "./converter";
import { NoteArticulation, NoteHead } from "./types";

describe("Converter", () => {
  describe("durationToMicroseconds", () => {
    // Default beat length is 1/8 (eighth note)
    const defaultBeatLength = { numerator: 1, denominator: 8 };

    it("should convert a quarter note at 120 BPM", () => {
      // Quarter note = 1/4 whole note
      // At L:1/8 (eighth note = 1 beat), quarter note = 2 beats
      // At 120 BPM: 2 beats * (60/120) seconds = 1 second = 1,000,000 us
      const duration = { numerator: 1, denominator: 4 };
      const result = durationToMicroseconds(duration, 120, defaultBeatLength);
      expect(result).to.equal(1_000_000n);
    });

    it("should convert an eighth note at 120 BPM", () => {
      // Eighth note = 1/8 whole note = 1 beat at L:1/8
      // At 120 BPM: 1 beat * (60/120) seconds = 0.5 seconds = 500,000 us
      const duration = { numerator: 1, denominator: 8 };
      const result = durationToMicroseconds(duration, 120, defaultBeatLength);
      expect(result).to.equal(500_000n);
    });

    it("should convert a half note at 120 BPM", () => {
      // Half note = 1/2 whole note = 4 beats at L:1/8
      // At 120 BPM: 4 beats * (60/120) seconds = 2 seconds = 2,000,000 us
      const duration = { numerator: 1, denominator: 2 };
      const result = durationToMicroseconds(duration, 120, defaultBeatLength);
      expect(result).to.equal(2_000_000n);
    });

    it("should convert a whole note at 120 BPM", () => {
      // Whole note = 1 whole note = 8 beats at L:1/8
      // At 120 BPM: 8 beats * (60/120) seconds = 4 seconds = 4,000,000 us
      const duration = { numerator: 1, denominator: 1 };
      const result = durationToMicroseconds(duration, 120, defaultBeatLength);
      expect(result).to.equal(4_000_000n);
    });

    it("should handle different tempos", () => {
      // Quarter note at 60 BPM = 2 seconds
      const duration = { numerator: 1, denominator: 4 };
      const result = durationToMicroseconds(duration, 60, defaultBeatLength);
      expect(result).to.equal(2_000_000n);
    });

    it("should handle different beat lengths", () => {
      // Quarter note with L:1/4 (quarter note = 1 beat)
      // At 120 BPM: 1 beat * (60/120) seconds = 0.5 seconds = 500,000 us
      const duration = { numerator: 1, denominator: 4 };
      const beatLength = { numerator: 1, denominator: 4 };
      const result = durationToMicroseconds(duration, 120, beatLength);
      expect(result).to.equal(500_000n);
    });

    it("should handle dotted notes (3/8 duration)", () => {
      // Dotted quarter = 3/8 whole note = 3 beats at L:1/8
      // At 120 BPM: 3 beats * (60/120) seconds = 1.5 seconds = 1,500,000 us
      const duration = { numerator: 3, denominator: 8 };
      const result = durationToMicroseconds(duration, 120, defaultBeatLength);
      expect(result).to.equal(1_500_000n);
    });

    it("should handle sixteenth notes", () => {
      // Sixteenth note = 1/16 whole note = 0.5 beats at L:1/8
      // At 120 BPM: 0.5 beats * (60/120) seconds = 0.25 seconds = 250,000 us
      const duration = { numerator: 1, denominator: 16 };
      const result = durationToMicroseconds(duration, 120, defaultBeatLength);
      expect(result).to.equal(250_000n);
    });
  });

  describe("createSimpleNoteEvents", () => {
    it("should create events from simple note list", () => {
      const notes = [
        { pitch: 60, duration_ms: 500 },
        { pitch: 62, duration_ms: 500 },
        { pitch: 64, duration_ms: 500 },
      ];

      const result = createSimpleNoteEvents(notes, 120);

      expect(result.noteEvents).to.have.length(3);
      expect(result.tempo).to.equal(120);
    });

    it("should set correct positions for sequential notes", () => {
      const notes = [
        { pitch: 60, duration_ms: 500 },
        { pitch: 62, duration_ms: 500 },
        { pitch: 64, duration_ms: 500 },
      ];

      const result = createSimpleNoteEvents(notes);

      expect(result.noteEvents[0].location_us).to.equal(0n);
      expect(result.noteEvents[1].location_us).to.equal(500_000n);
      expect(result.noteEvents[2].location_us).to.equal(1_000_000n);
    });

    it("should set correct durations", () => {
      const notes = [
        { pitch: 60, duration_ms: 500 },
        { pitch: 62, duration_ms: 1000 },
      ];

      const result = createSimpleNoteEvents(notes);

      expect(result.noteEvents[0].duration_us).to.equal(500_000n);
      expect(result.noteEvents[1].duration_us).to.equal(1_000_000n);
    });

    it("should set correct pitches", () => {
      const notes = [
        { pitch: 60, duration_ms: 500 },
        { pitch: 72, duration_ms: 500 },
      ];

      const result = createSimpleNoteEvents(notes);

      expect(result.noteEvents[0].pitch).to.equal(60);
      expect(result.noteEvents[1].pitch).to.equal(72);
    });

    it("should calculate total duration", () => {
      const notes = [
        { pitch: 60, duration_ms: 500 },
        { pitch: 62, duration_ms: 500 },
        { pitch: 64, duration_ms: 1000 },
      ];

      const result = createSimpleNoteEvents(notes);

      expect(result.totalDuration_us).to.equal(2_000_000n);
    });

    it("should use default tempo of 120 when not specified", () => {
      const notes = [{ pitch: 60, duration_ms: 500 }];
      const result = createSimpleNoteEvents(notes);
      expect(result.tempo).to.equal(120);
    });

    it("should set default articulation values", () => {
      const notes = [{ pitch: 60, duration_ms: 500 }];
      const result = createSimpleNoteEvents(notes);

      expect(result.noteEvents[0].articulation).to.equal(NoteArticulation.None);
      expect(result.noteEvents[0].articulation_2).to.equal(0n);
      expect(result.noteEvents[0].notehead).to.equal(NoteHead.Normal);
    });

    it("should set voice to 0", () => {
      const notes = [{ pitch: 60, duration_ms: 500 }];
      const result = createSimpleNoteEvents(notes);
      expect(result.noteEvents[0].voice).to.equal(0);
    });

    it("should set offset_cents to 0", () => {
      const notes = [{ pitch: 60, duration_ms: 500 }];
      const result = createSimpleNoteEvents(notes);
      expect(result.noteEvents[0].offset_cents).to.equal(0);
    });

    it("should return empty arrays when given empty input", () => {
      const result = createSimpleNoteEvents([]);

      expect(result.noteEvents).to.have.length(0);
      expect(result.dynamicsEvents).to.have.length(0);
      expect(result.pedalEvents).to.have.length(0);
      expect(result.syllableEvents).to.have.length(0);
      expect(result.totalDuration_us).to.equal(0n);
    });
  });
});
