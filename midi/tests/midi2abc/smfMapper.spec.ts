import {
  IRational,
  createRational,
  compareRational,
  rationalToNumber,
} from "abc-parser/Visitors/fmt2/rational";
import { expect } from "chai";
import * as fc from "fast-check";
import { SMF, MMTrk, MMidiEvent } from "../../src/midi2abc/jzz-types";
import { smfToNoteSequence } from "../../src/midi2abc/smfMapper";
import { MNoteSequence } from "../../src/midi2abc/types";

// =============================================================================
// Constants
// =============================================================================

const MIDDLE_C = 60;
const DEFAULT_VELOCITY = 80;
const DEFAULT_TEMPO = 500_000; // 120 BPM
const FAST_TEMPO = 250_000; // 240 BPM
const DEFAULT_PPQN = 480;

// =============================================================================
// Mock event factories
// =============================================================================

// Each mock event is a plain object conforming to the MMidiEvent interface.
// The real jzz event is an Array subclass with methods; we only mock the
// subset that collectRawEvents actually calls.

function createNoteOnEvent(
  tick: number,
  channel: number,
  pitch: number,
  velocity: number
): MMidiEvent {
  return {
    tt: tick,
    0: 0x90 | channel,
    1: pitch,
    2: velocity,
    isNoteOn: () => velocity > 0,
    isNoteOff: () => velocity === 0,
    isTempo: () => false,
    isTimeSignature: () => false,
    isEOT: () => false,
    getChannel: () => channel,
    getNote: () => pitch,
    getVelocity: () => velocity,
    getTempo: () => 0,
    getTimeSignature: () => [0, 0],
  };
}

function createNoteOffEvent(
  tick: number,
  channel: number,
  pitch: number
): MMidiEvent {
  return {
    tt: tick,
    0: 0x80 | channel,
    1: pitch,
    2: 0,
    isNoteOn: () => false,
    isNoteOff: () => true,
    isTempo: () => false,
    isTimeSignature: () => false,
    isEOT: () => false,
    getChannel: () => channel,
    getNote: () => pitch,
    getVelocity: () => 0,
    getTempo: () => 0,
    getTimeSignature: () => [0, 0],
  };
}

function createTempoEvent(
  tick: number,
  microsecondsPerQN: number
): MMidiEvent {
  return {
    tt: tick,
    0: 0xff,
    1: 0x51,
    2: 0,
    isNoteOn: () => false,
    isNoteOff: () => false,
    isTempo: () => true,
    isTimeSignature: () => false,
    isEOT: () => false,
    getChannel: () => 0,
    getNote: () => 0,
    getVelocity: () => 0,
    getTempo: () => microsecondsPerQN,
    getTimeSignature: () => [0, 0],
  };
}

function createTimeSigEvent(
  tick: number,
  numerator: number,
  denominator: number
): MMidiEvent {
  return {
    tt: tick,
    0: 0xff,
    1: 0x58,
    2: 0,
    isNoteOn: () => false,
    isNoteOff: () => false,
    isTempo: () => false,
    isTimeSignature: () => true,
    isEOT: () => false,
    getChannel: () => 0,
    getNote: () => 0,
    getVelocity: () => 0,
    getTempo: () => 0,
    getTimeSignature: () => [numerator, denominator],
  };
}

function createProgramChangeEvent(
  tick: number,
  channel: number,
  program: number
): MMidiEvent {
  return {
    tt: tick,
    0: 0xc0 | channel,
    1: program,
    2: 0,
    isNoteOn: () => false,
    isNoteOff: () => false,
    isTempo: () => false,
    isTimeSignature: () => false,
    isEOT: () => false,
    getChannel: () => channel,
    getNote: () => 0,
    getVelocity: () => 0,
    getTempo: () => 0,
    getTimeSignature: () => [0, 0],
  };
}

// =============================================================================
// Mock track and SMF builders
// =============================================================================

class TrackBuilder {
  events: MMidiEvent[] = [];
  parent: SMFBuilder;

  constructor(parent: SMFBuilder) {
    this.parent = parent;
  }

  noteOn(
    tick: number,
    channel: number,
    pitch: number,
    velocity: number
  ): TrackBuilder {
    this.events.push(createNoteOnEvent(tick, channel, pitch, velocity));
    return this;
  }

  noteOff(tick: number, channel: number, pitch: number): TrackBuilder {
    this.events.push(createNoteOffEvent(tick, channel, pitch));
    return this;
  }

  tempo(tick: number, microsecondsPerQN: number): TrackBuilder {
    this.events.push(createTempoEvent(tick, microsecondsPerQN));
    return this;
  }

  timeSignature(
    tick: number,
    numerator: number,
    denominator: number
  ): TrackBuilder {
    this.events.push(createTimeSigEvent(tick, numerator, denominator));
    return this;
  }

  programChange(
    tick: number,
    channel: number,
    program: number
  ): TrackBuilder {
    this.events.push(createProgramChangeEvent(tick, channel, program));
    return this;
  }

  done(): SMFBuilder {
    return this.parent;
  }

  buildTrack(): MMTrk {
    const track: MMTrk = {
      length: this.events.length,
    };
    for (let i = 0; i < this.events.length; i++) {
      track[i] = this.events[i];
    }
    return track;
  }
}

class SMFBuilder {
  _ppqn?: number;
  _fps?: number;
  _ppf?: number;
  tracks: TrackBuilder[] = [];

  static ppqn(ppqn: number): SMFBuilder {
    const b = new SMFBuilder();
    b._ppqn = ppqn;
    return b;
  }

  static smpte(fps: number, ppf: number): SMFBuilder {
    const b = new SMFBuilder();
    b._fps = fps;
    b._ppf = ppf;
    return b;
  }

  addTrack(): TrackBuilder {
    const tb = new TrackBuilder(this);
    this.tracks.push(tb);
    return tb;
  }

  build(): SMF {
    const mockTracks = this.tracks.map((tb) => tb.buildTrack());
    const smf: SMF = {
      length: mockTracks.length,
    };
    for (let i = 0; i < mockTracks.length; i++) {
      smf[i] = mockTracks[i];
    }
    if (this._ppqn !== undefined) {
      smf.ppqn = this._ppqn;
    } else {
      smf.fps = this._fps;
      smf.ppf = this._ppf;
    }
    return smf;
  }
}

// =============================================================================
// Assertion helpers
// =============================================================================

function expectRationalEqual(
  actual: IRational,
  expectedNum: number,
  expectedDen: number
): void {
  const expected = createRational(expectedNum, expectedDen);
  expect(compareRational(actual, expected)).to.equal(
    0,
    `expected ${actual.numerator}/${actual.denominator} to equal ${expected.numerator}/${expected.denominator}`
  );
}

function expectTimeSig(
  ts: { numerator: number; denominator: number },
  expectedNum: number,
  expectedDen: number
): void {
  expect(ts.numerator).to.equal(
    expectedNum,
    `expected numerator ${ts.numerator} to equal ${expectedNum}`
  );
  expect(ts.denominator).to.equal(
    expectedDen,
    `expected denominator ${ts.denominator} to equal ${expectedDen}`
  );
}

function expectNoteCount(result: MNoteSequence, count: number): void {
  expect(result.notes.length).to.equal(count);
}

// =============================================================================
// Example-based tests
// =============================================================================

describe("smfToNoteSequence", () => {
  // ---------------------------------------------------------------------------
  // Tick-to-quarter-note conversion
  // ---------------------------------------------------------------------------

  describe("PPQN tick conversion", () => {
    it("tick 240 with ppqn 480 produces 1/2", () => {
      const smf = SMFBuilder.ppqn(480)
        .addTrack()
        .noteOn(0, 0, MIDDLE_C, DEFAULT_VELOCITY)
        .noteOff(240, 0, MIDDLE_C)
        .done()
        .build();
      const result = smfToNoteSequence(smf);
      expectRationalEqual(result.notes[0].startTime, 0, 1);
      expectRationalEqual(result.notes[0].endTime, 1, 2);
    });

    it("tick 160 with ppqn 480 produces 1/3 (triplet)", () => {
      const smf = SMFBuilder.ppqn(480)
        .addTrack()
        .noteOn(0, 0, MIDDLE_C, DEFAULT_VELOCITY)
        .noteOff(160, 0, MIDDLE_C)
        .done()
        .build();
      const result = smfToNoteSequence(smf);
      expectRationalEqual(result.notes[0].endTime, 1, 3);
    });

    it("ppqn=1: every tick is a whole quarter note", () => {
      const smf = SMFBuilder.ppqn(1)
        .addTrack()
        .noteOn(0, 0, MIDDLE_C, DEFAULT_VELOCITY)
        .noteOff(5, 0, MIDDLE_C)
        .done()
        .build();
      const result = smfToNoteSequence(smf);
      expectRationalEqual(result.notes[0].endTime, 5, 1);
    });
  });

  describe("SMPTE tick conversion", () => {
    it("fps=25, ppf=40, 120 BPM, tick 1000 produces 2/1", () => {
      const smf = SMFBuilder.smpte(25, 40)
        .addTrack()
        .tempo(0, DEFAULT_TEMPO)
        .noteOn(0, 0, MIDDLE_C, DEFAULT_VELOCITY)
        .noteOff(1000, 0, MIDDLE_C)
        .done()
        .build();
      const result = smfToNoteSequence(smf);
      expectRationalEqual(result.notes[0].endTime, 2, 1);
    });

    it("tempo change mid-file: 120 BPM for 1000 ticks, then 60 BPM", () => {
      // fps=25, ppf=40 => 1000 ticks/second
      // First 1000 ticks at 120 BPM (500000 us/qn) => 2 quarter notes
      // Next 1000 ticks at 60 BPM (1000000 us/qn) => 1 quarter note
      // Total at tick 2000 => 3 quarter notes
      const smf = SMFBuilder.smpte(25, 40)
        .addTrack()
        .tempo(0, DEFAULT_TEMPO)
        .tempo(1000, 1_000_000)
        .noteOn(0, 0, MIDDLE_C, DEFAULT_VELOCITY)
        .noteOff(2000, 0, MIDDLE_C)
        .done()
        .build();
      const result = smfToNoteSequence(smf);
      expectRationalEqual(result.notes[0].endTime, 3, 1);
    });

    it("no tempo events: defaults to 120 BPM", () => {
      const smf = SMFBuilder.smpte(25, 40)
        .addTrack()
        .noteOn(0, 0, MIDDLE_C, DEFAULT_VELOCITY)
        .noteOff(1000, 0, MIDDLE_C)
        .done()
        .build();
      const result = smfToNoteSequence(smf);
      // 1000 ticks / 1000 tps = 1 second, at 120 BPM = 2 quarter notes
      expectRationalEqual(result.notes[0].endTime, 2, 1);
    });
  });

  // ---------------------------------------------------------------------------
  // Note pairing
  // ---------------------------------------------------------------------------

  describe("note pairing", () => {
    it("single note-on/off pair produces one note", () => {
      const smf = SMFBuilder.ppqn(DEFAULT_PPQN)
        .addTrack()
        .noteOn(0, 0, MIDDLE_C, DEFAULT_VELOCITY)
        .noteOff(480, 0, MIDDLE_C)
        .done()
        .build();
      const result = smfToNoteSequence(smf);
      expectNoteCount(result, 1);
      expectRationalEqual(result.notes[0].startTime, 0, 1);
      expectRationalEqual(result.notes[0].endTime, 1, 1);
      expect(result.notes[0].pitch).to.equal(MIDDLE_C);
      expect(result.notes[0].velocity).to.equal(DEFAULT_VELOCITY);
    });

    it("two notes on different pitches overlapping in time", () => {
      const smf = SMFBuilder.ppqn(DEFAULT_PPQN)
        .addTrack()
        .noteOn(0, 0, 60, DEFAULT_VELOCITY)
        .noteOn(240, 0, 64, DEFAULT_VELOCITY)
        .noteOff(480, 0, 60)
        .noteOff(720, 0, 64)
        .done()
        .build();
      const result = smfToNoteSequence(smf);
      expectNoteCount(result, 2);
    });

    it("overlapping notes on same pitch: first is truncated at second's start", () => {
      const smf = SMFBuilder.ppqn(DEFAULT_PPQN)
        .addTrack()
        .noteOn(0, 0, MIDDLE_C, DEFAULT_VELOCITY)
        .noteOn(240, 0, MIDDLE_C, DEFAULT_VELOCITY)
        .noteOff(480, 0, MIDDLE_C)
        .done()
        .build();
      const result = smfToNoteSequence(smf);
      expectNoteCount(result, 2);
      // first note truncated at tick 240
      expectRationalEqual(result.notes[0].endTime, 1, 2);
      // second note ends at tick 480
      expectRationalEqual(result.notes[1].endTime, 1, 1);
    });

    it("note-off and note-on at the same tick: clean boundary", () => {
      const smf = SMFBuilder.ppqn(DEFAULT_PPQN)
        .addTrack()
        .noteOn(0, 0, MIDDLE_C, DEFAULT_VELOCITY)
        .noteOff(480, 0, MIDDLE_C)
        .noteOn(480, 0, MIDDLE_C, DEFAULT_VELOCITY)
        .noteOff(960, 0, MIDDLE_C)
        .done()
        .build();
      const result = smfToNoteSequence(smf);
      expectNoteCount(result, 2);
      expectRationalEqual(result.notes[0].endTime, 1, 1);
      expectRationalEqual(result.notes[1].startTime, 1, 1);
    });

    it("velocity-0 note-on is treated as note-off", () => {
      const smf = SMFBuilder.ppqn(DEFAULT_PPQN)
        .addTrack()
        .noteOn(0, 0, MIDDLE_C, DEFAULT_VELOCITY)
        .noteOn(480, 0, MIDDLE_C, 0) // velocity 0 = note-off
        .done()
        .build();
      const result = smfToNoteSequence(smf);
      expectNoteCount(result, 1);
      expectRationalEqual(result.notes[0].endTime, 1, 1);
    });

    it("orphan velocity-0 note-on at tick 0: silently ignored", () => {
      const smf = SMFBuilder.ppqn(DEFAULT_PPQN)
        .addTrack()
        .noteOn(0, 0, MIDDLE_C, 0) // orphan note-off, no preceding note-on
        .noteOn(480, 0, MIDDLE_C, DEFAULT_VELOCITY)
        .noteOff(960, 0, MIDDLE_C)
        .done()
        .build();
      const result = smfToNoteSequence(smf);
      expectNoteCount(result, 1);
      expectRationalEqual(result.notes[0].startTime, 1, 1);
    });

    it("unterminated notes are closed at maxTick", () => {
      const smf = SMFBuilder.ppqn(DEFAULT_PPQN)
        .addTrack()
        .noteOn(0, 0, MIDDLE_C, DEFAULT_VELOCITY)
        // no note-off; a tempo event at tick 960 sets maxTick
        .tempo(960, DEFAULT_TEMPO)
        .done()
        .build();
      const result = smfToNoteSequence(smf);
      expectNoteCount(result, 1);
      expectRationalEqual(result.notes[0].endTime, 2, 1);
    });

    it("zero-duration notes are discarded", () => {
      const smf = SMFBuilder.ppqn(DEFAULT_PPQN)
        .addTrack()
        .noteOn(480, 0, MIDDLE_C, DEFAULT_VELOCITY)
        .noteOff(480, 0, MIDDLE_C) // same tick
        .done()
        .build();
      const result = smfToNoteSequence(smf);
      expectNoteCount(result, 0);
    });
  });

  // ---------------------------------------------------------------------------
  // Program change lookup
  // ---------------------------------------------------------------------------

  describe("program lookup", () => {
    it("no program changes: notes get program 0", () => {
      const smf = SMFBuilder.ppqn(DEFAULT_PPQN)
        .addTrack()
        .noteOn(0, 0, MIDDLE_C, DEFAULT_VELOCITY)
        .noteOff(480, 0, MIDDLE_C)
        .done()
        .build();
      const result = smfToNoteSequence(smf);
      expect(result.notes[0].program).to.equal(0);
    });

    it("program change before note: note gets the new program", () => {
      const smf = SMFBuilder.ppqn(DEFAULT_PPQN)
        .addTrack()
        .programChange(0, 0, 42)
        .noteOn(480, 0, MIDDLE_C, DEFAULT_VELOCITY)
        .noteOff(960, 0, MIDDLE_C)
        .done()
        .build();
      const result = smfToNoteSequence(smf);
      expect(result.notes[0].program).to.equal(42);
    });

    it("program change at same tick as note-on: applies to that note", () => {
      const smf = SMFBuilder.ppqn(DEFAULT_PPQN)
        .addTrack()
        .programChange(480, 0, 42)
        .noteOn(480, 0, MIDDLE_C, DEFAULT_VELOCITY)
        .noteOff(960, 0, MIDDLE_C)
        .done()
        .build();
      const result = smfToNoteSequence(smf);
      expect(result.notes[0].program).to.equal(42);
    });

    it("two program changes on the same channel: most recent wins", () => {
      const smf = SMFBuilder.ppqn(DEFAULT_PPQN)
        .addTrack()
        .programChange(0, 0, 10)
        .noteOn(100, 0, MIDDLE_C, DEFAULT_VELOCITY)
        .noteOff(200, 0, MIDDLE_C)
        .programChange(300, 0, 42)
        .noteOn(400, 0, MIDDLE_C, DEFAULT_VELOCITY)
        .noteOff(480, 0, MIDDLE_C)
        .done()
        .build();
      const result = smfToNoteSequence(smf);
      expect(result.notes[0].program).to.equal(10);
      expect(result.notes[1].program).to.equal(42);
    });

    it("program changes are channel-specific", () => {
      const smf = SMFBuilder.ppqn(DEFAULT_PPQN)
        .addTrack()
        .programChange(0, 0, 10)
        .programChange(0, 1, 42)
        .noteOn(100, 0, MIDDLE_C, DEFAULT_VELOCITY)
        .noteOff(200, 0, MIDDLE_C)
        .noteOn(100, 1, MIDDLE_C, DEFAULT_VELOCITY)
        .noteOff(200, 1, MIDDLE_C)
        .done()
        .build();
      const result = smfToNoteSequence(smf);
      const ch0Note = result.notes.find((n) => n.channel === 0)!;
      const ch1Note = result.notes.find((n) => n.channel === 1)!;
      expect(ch0Note.program).to.equal(10);
      expect(ch1Note.program).to.equal(42);
    });
  });

  // ---------------------------------------------------------------------------
  // Time signatures and tempos
  // ---------------------------------------------------------------------------

  describe("time signatures and tempos", () => {
    it("no tempo events: default 120 BPM", () => {
      const smf = SMFBuilder.ppqn(DEFAULT_PPQN)
        .addTrack()
        .noteOn(0, 0, MIDDLE_C, DEFAULT_VELOCITY)
        .noteOff(480, 0, MIDDLE_C)
        .done()
        .build();
      const result = smfToNoteSequence(smf);
      expect(result.tempos.length).to.equal(1);
      expect(result.tempos[0].microsecondsPerQN).to.equal(DEFAULT_TEMPO);
      expectRationalEqual(result.tempos[0].time, 0, 1);
    });

    it("no time signature events: default 4/4", () => {
      const smf = SMFBuilder.ppqn(DEFAULT_PPQN)
        .addTrack()
        .noteOn(0, 0, MIDDLE_C, DEFAULT_VELOCITY)
        .noteOff(480, 0, MIDDLE_C)
        .done()
        .build();
      const result = smfToNoteSequence(smf);
      expect(result.timeSignatures.length).to.equal(1);
      expectTimeSig(result.timeSignatures[0], 4, 4);
      expectRationalEqual(result.timeSignatures[0].time, 0, 1);
    });

    it("two tempo events at the same tick: last one wins", () => {
      const smf = SMFBuilder.ppqn(DEFAULT_PPQN)
        .addTrack()
        .tempo(0, DEFAULT_TEMPO)
        .tempo(0, FAST_TEMPO)
        .noteOn(0, 0, MIDDLE_C, DEFAULT_VELOCITY)
        .noteOff(480, 0, MIDDLE_C)
        .done()
        .build();
      const result = smfToNoteSequence(smf);
      expect(result.tempos.length).to.equal(1);
      expect(result.tempos[0].microsecondsPerQN).to.equal(FAST_TEMPO);
    });

    it("two time signature events at the same tick: last one wins", () => {
      const smf = SMFBuilder.ppqn(DEFAULT_PPQN)
        .addTrack()
        .timeSignature(0, 4, 4)
        .timeSignature(0, 3, 4)
        .noteOn(0, 0, MIDDLE_C, DEFAULT_VELOCITY)
        .noteOff(480, 0, MIDDLE_C)
        .done()
        .build();
      const result = smfToNoteSequence(smf);
      expect(result.timeSignatures.length).to.equal(1);
      expectTimeSig(result.timeSignatures[0], 3, 4);
    });

    it("6/8 time signature is preserved correctly", () => {
      const smf = SMFBuilder.ppqn(DEFAULT_PPQN)
        .addTrack()
        .timeSignature(0, 6, 8)
        .noteOn(0, 0, MIDDLE_C, DEFAULT_VELOCITY)
        .noteOff(480, 0, MIDDLE_C)
        .done()
        .build();
      const result = smfToNoteSequence(smf);
      expectTimeSig(result.timeSignatures[0], 6, 8);
    });
  });

  // ---------------------------------------------------------------------------
  // Full integration
  // ---------------------------------------------------------------------------

  describe("full integration", () => {
    it("empty SMF: default tempo, default time sig, zero notes", () => {
      const smf = SMFBuilder.ppqn(DEFAULT_PPQN)
        .addTrack() // empty track
        .done()
        .build();
      const result = smfToNoteSequence(smf);
      expectNoteCount(result, 0);
      expect(result.tempos.length).to.equal(1);
      expect(result.tempos[0].microsecondsPerQN).to.equal(DEFAULT_TEMPO);
      expect(result.timeSignatures.length).to.equal(1);
      expectTimeSig(result.timeSignatures[0], 4, 4);
    });

    it("minimal file: one note, one tempo, one time sig", () => {
      const smf = SMFBuilder.ppqn(DEFAULT_PPQN)
        .addTrack()
        .tempo(0, DEFAULT_TEMPO)
        .timeSignature(0, 3, 4)
        .noteOn(0, 0, MIDDLE_C, DEFAULT_VELOCITY)
        .noteOff(480, 0, MIDDLE_C)
        .done()
        .build();
      const result = smfToNoteSequence(smf);
      expectNoteCount(result, 1);
      expect(result.tempos[0].microsecondsPerQN).to.equal(DEFAULT_TEMPO);
      expectTimeSig(result.timeSignatures[0], 3, 4);
      expectRationalEqual(result.notes[0].startTime, 0, 1);
      expectRationalEqual(result.notes[0].endTime, 1, 1);
    });

    it("multi-track format 1: notes on different channels", () => {
      const smf = SMFBuilder.ppqn(DEFAULT_PPQN);
      smf
        .addTrack() // conductor track
        .tempo(0, DEFAULT_TEMPO)
        .timeSignature(0, 4, 4);
      smf
        .addTrack() // channel 0
        .noteOn(0, 0, 60, DEFAULT_VELOCITY)
        .noteOff(480, 0, 60);
      smf
        .addTrack() // channel 1
        .noteOn(0, 1, 64, DEFAULT_VELOCITY)
        .noteOff(480, 1, 64);
      const result = smfToNoteSequence(smf.build());
      expectNoteCount(result, 2);
      const ch0 = result.notes.find((n) => n.channel === 0)!;
      const ch1 = result.notes.find((n) => n.channel === 1)!;
      expect(ch0.pitch).to.equal(60);
      expect(ch1.pitch).to.equal(64);
    });

    it("SMPTE file with tempo change: quarter-note positions are exact", () => {
      const smf = SMFBuilder.smpte(25, 40);
      smf
        .addTrack()
        .tempo(0, DEFAULT_TEMPO) // 120 BPM
        .tempo(1000, 1_000_000) // 60 BPM at tick 1000
        .noteOn(0, 0, MIDDLE_C, DEFAULT_VELOCITY)
        .noteOff(500, 0, MIDDLE_C) // note ends at tick 500 (in first tempo region)
        .noteOn(1500, 0, 64, DEFAULT_VELOCITY)
        .noteOff(2000, 0, 64); // note in second tempo region
      const result = smfToNoteSequence(smf.build());
      // tick 500 at 120 BPM: 500/1000 seconds = 0.5s => 1 quarter note
      expectRationalEqual(result.notes[0].endTime, 1, 1);
      // tick 1500: 2 qn (first region) + 500/1000 * 1000000/1000000 = 2 + 0.5 = 2.5 qn
      const note2 = result.notes.find((n) => n.pitch === 64)!;
      expectRationalEqual(note2.startTime, 5, 2);
    });

    it("format 0: single track with mixed event types", () => {
      const smf = SMFBuilder.ppqn(DEFAULT_PPQN)
        .addTrack()
        .tempo(0, DEFAULT_TEMPO)
        .timeSignature(0, 4, 4)
        .programChange(0, 0, 25)
        .noteOn(0, 0, MIDDLE_C, DEFAULT_VELOCITY)
        .noteOff(480, 0, MIDDLE_C)
        .noteOn(480, 0, 64, DEFAULT_VELOCITY)
        .noteOff(960, 0, 64)
        .done()
        .build();
      const result = smfToNoteSequence(smf);
      expectNoteCount(result, 2);
      expect(result.notes[0].program).to.equal(25);
      expect(result.notes[1].program).to.equal(25);
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe("edge cases", () => {
    it("orphan note-off with no preceding note-on: silently ignored", () => {
      const smf = SMFBuilder.ppqn(DEFAULT_PPQN)
        .addTrack()
        .noteOff(0, 0, MIDDLE_C)
        .noteOn(480, 0, MIDDLE_C, DEFAULT_VELOCITY)
        .noteOff(960, 0, MIDDLE_C)
        .done()
        .build();
      const result = smfToNoteSequence(smf);
      expectNoteCount(result, 1);
    });

    it("multiple unterminated notes on different pitches", () => {
      const smf = SMFBuilder.ppqn(DEFAULT_PPQN)
        .addTrack()
        .noteOn(0, 0, 60, DEFAULT_VELOCITY)
        .noteOn(0, 0, 64, DEFAULT_VELOCITY)
        .noteOn(0, 0, 67, DEFAULT_VELOCITY)
        // no note-offs; maxTick comes from the note-ons at tick 0,
        // so all notes get closed at tick 0 and are zero-duration => discarded
        .done()
        .build();
      const result = smfToNoteSequence(smf);
      // all three notes start and end at tick 0 => zero-duration => discarded
      expectNoteCount(result, 0);
    });

    it("multiple unterminated notes closed at maxTick from a later event", () => {
      const smf = SMFBuilder.ppqn(DEFAULT_PPQN)
        .addTrack()
        .noteOn(0, 0, 60, DEFAULT_VELOCITY)
        .noteOn(0, 0, 64, DEFAULT_VELOCITY)
        .tempo(960, DEFAULT_TEMPO) // sets maxTick to 960
        .done()
        .build();
      const result = smfToNoteSequence(smf);
      expectNoteCount(result, 2);
      for (const note of result.notes) {
        expectRationalEqual(note.endTime, 2, 1);
      }
    });

    it("dedup: tempo events from different tracks at the same tick", () => {
      const smf = SMFBuilder.ppqn(DEFAULT_PPQN);
      smf.addTrack().tempo(0, DEFAULT_TEMPO);
      smf
        .addTrack()
        .tempo(0, FAST_TEMPO) // same tick, higher-indexed track wins
        .noteOn(0, 0, MIDDLE_C, DEFAULT_VELOCITY)
        .noteOff(480, 0, MIDDLE_C);
      const result = smfToNoteSequence(smf.build());
      expect(result.tempos.length).to.equal(1);
      expect(result.tempos[0].microsecondsPerQN).to.equal(FAST_TEMPO);
    });

    it("program change after all notes: does not affect any note", () => {
      const smf = SMFBuilder.ppqn(DEFAULT_PPQN)
        .addTrack()
        .noteOn(0, 0, MIDDLE_C, DEFAULT_VELOCITY)
        .noteOff(480, 0, MIDDLE_C)
        .programChange(960, 0, 42)
        .done()
        .build();
      const result = smfToNoteSequence(smf);
      expect(result.notes[0].program).to.equal(0);
    });

    it("notes across multiple channels with separate programs", () => {
      const smf = SMFBuilder.ppqn(DEFAULT_PPQN)
        .addTrack()
        .programChange(0, 0, 0) // piano on ch 0
        .programChange(0, 9, 0) // drums on ch 9
        .noteOn(0, 0, MIDDLE_C, DEFAULT_VELOCITY)
        .noteOff(480, 0, MIDDLE_C)
        .noteOn(0, 9, 36, DEFAULT_VELOCITY) // bass drum
        .noteOff(480, 9, 36)
        .done()
        .build();
      const result = smfToNoteSequence(smf);
      expectNoteCount(result, 2);
      const ch0 = result.notes.find((n) => n.channel === 0)!;
      const ch9 = result.notes.find((n) => n.channel === 9)!;
      expect(ch0.channel).to.equal(0);
      expect(ch9.channel).to.equal(9);
    });

    it("very high ppqn value", () => {
      const smf = SMFBuilder.ppqn(15360) // common high-res PPQN
        .addTrack()
        .noteOn(0, 0, MIDDLE_C, DEFAULT_VELOCITY)
        .noteOff(15360, 0, MIDDLE_C)
        .done()
        .build();
      const result = smfToNoteSequence(smf);
      expectRationalEqual(result.notes[0].endTime, 1, 1);
    });

    it("rapid repeated notes on the same pitch", () => {
      const smf = SMFBuilder.ppqn(DEFAULT_PPQN);
      const track = smf.addTrack();
      for (let i = 0; i < 10; i++) {
        const start = i * 48;
        const end = start + 24;
        track.noteOn(start, 0, MIDDLE_C, DEFAULT_VELOCITY);
        track.noteOff(end, 0, MIDDLE_C);
      }
      const result = smfToNoteSequence(smf.build());
      expectNoteCount(result, 10);
    });
  });
});

// =============================================================================
// Generators (for property-based tests)
// =============================================================================

const genPpqn = fc.integer({ min: 1, max: 960 });
const genChannel = fc.integer({ min: 0, max: 15 });
const genPitch = fc.integer({ min: 0, max: 127 });
const genVelocity = fc.integer({ min: 1, max: 127 });
const genTempo = fc.integer({ min: 1, max: 16_777_215 });
const genProgram = fc.integer({ min: 0, max: 127 });

// MIDI stores the denominator as a power of 2; jzz decodes it for us,
// so we generate the decoded value directly.
const genTimeSigDenominator = fc.constantFrom(1, 2, 4, 8, 16, 32, 64);

// Generates a non-overlapping sequence of note-on/off pairs on a single
// channel and pitch, with strictly increasing ticks.
// Returns an array of {onTick, offTick} pairs and the channel/pitch used.
const genNonOverlappingNotes = fc
  .record({
    channel: genChannel,
    pitch: genPitch,
    pairs: fc.array(
      fc.record({
        gap: fc.integer({ min: 0, max: 1000 }),
        duration: fc.integer({ min: 1, max: 1000 }),
      }),
      { minLength: 1, maxLength: 20 }
    ),
  })
  .map(({ channel, pitch, pairs }) => {
    let tick = 0;
    const notes: Array<{ onTick: number; offTick: number }> = [];
    for (const { gap, duration } of pairs) {
      const onTick = tick + gap;
      const offTick = onTick + duration;
      notes.push({ onTick, offTick });
      tick = offTick;
    }
    return { channel, pitch, notes };
  });

// Generates a complete valid PPQN SMF with a single track containing
// non-overlapping notes, optional tempo events, and optional program changes.
const genValidPpqnSMF = fc
  .record({
    ppqn: genPpqn,
    noteSeq: genNonOverlappingNotes,
    tempoCount: fc.integer({ min: 0, max: 5 }),
    programCount: fc.integer({ min: 0, max: 3 }),
  })
  .chain(({ ppqn, noteSeq, tempoCount, programCount }) => {
    const maxTick =
      noteSeq.notes.length > 0
        ? noteSeq.notes[noteSeq.notes.length - 1].offTick
        : 0;

    return fc.record({
      ppqn: fc.constant(ppqn),
      noteSeq: fc.constant(noteSeq),
      tempos: fc.array(
        fc.record({
          tick: fc.integer({ min: 0, max: Math.max(maxTick, 1) }),
          microsecondsPerQN: genTempo,
        }),
        { minLength: tempoCount, maxLength: tempoCount }
      ),
      programs: fc.array(
        fc.record({
          tick: fc.integer({ min: 0, max: Math.max(maxTick, 1) }),
          program: genProgram,
        }),
        { minLength: programCount, maxLength: programCount }
      ),
    });
  });

// Generates an SMPTE SMF with valid fps/ppf and tempo events.
const genFps = fc.constantFrom(24, 25, 29, 30);
// ppf >= 4 avoids pathological cases where very few ticks per second
// combined with many closely-spaced tempo changes overflow BigInt.
const genPpf = fc.integer({ min: 4, max: 100 });

// For SMPTE tests we constrain the tempo to realistic, round values.
// Because the SMPTE converter accumulates exact fractions, coprime
// microsecondsPerQN values (e.g. 100001, 100002) cause the denominator to
// grow beyond MAX_SAFE_INTEGER even after GCD reduction. Real MIDI files
// use standard tempo values that are multiples of 1000, so we generate
// multiples of 1000 in the 20-600 BPM range.
const genRealisticTempo = fc
  .integer({ min: 100, max: 3000 })
  .map((n) => n * 1000);

const genValidSmpteSMF = fc.record({
  fps: genFps,
  ppf: genPpf,
  noteSeq: genNonOverlappingNotes,
  // At most 2 tempo changes, because each coprime microsecondsPerQN
  // multiplies into the denominator, and with 5+ changes the accumulated
  // fraction overflows even after GCD reduction.
  tempos: fc.array(
    fc.record({
      tick: fc.integer({ min: 0, max: 10000 }),
      microsecondsPerQN: genRealisticTempo,
    }),
    { minLength: 0, maxLength: 2 }
  ),
});

// Edge-case generators

// Generates overlapping notes: two note-ons on the same channel+pitch
// without an intervening note-off.
const genOverlappingNotes = fc
  .record({
    channel: genChannel,
    pitch: genPitch,
    firstOnTick: fc.integer({ min: 0, max: 1000 }),
    secondOnTick: fc.integer({ min: 1, max: 2000 }),
    offTick: fc.integer({ min: 1, max: 3000 }),
  })
  .filter(
    ({ firstOnTick, secondOnTick, offTick }) =>
      firstOnTick < secondOnTick && secondOnTick < offTick
  );

// Generates orphan note-offs (note-off with no preceding note-on).
const genOrphanNoteOff = fc.record({
  channel: genChannel,
  pitch: genPitch,
  tick: fc.integer({ min: 0, max: 1000 }),
});

// Generates zero-duration notes (note-on and note-off at the same tick).
const genZeroDurationNote = fc.record({
  channel: genChannel,
  pitch: genPitch,
  tick: fc.integer({ min: 0, max: 1000 }),
  velocity: genVelocity,
});

// Generates duplicate tempo events at the same tick.
const genDuplicateTempos = fc
  .record({
    tick: fc.integer({ min: 0, max: 1000 }),
    tempo1: genTempo,
    tempo2: genTempo,
  })
  .filter(({ tempo1, tempo2 }) => tempo1 !== tempo2);

// Generates a sequence of notes where the last one is unterminated (no note-off).
const genUnterminatedNote = fc.record({
  channel: genChannel,
  pitch: genPitch,
  onTick: fc.integer({ min: 0, max: 1000 }),
  velocity: genVelocity,
  maxTickOffset: fc.integer({ min: 1, max: 1000 }),
});

// =============================================================================
// Helper: build a mock SMF from a generator output
// =============================================================================

interface GenPpqnSMF {
  ppqn: number;
  noteSeq: {
    channel: number;
    pitch: number;
    notes: Array<{ onTick: number; offTick: number }>;
  };
  tempos: Array<{ tick: number; microsecondsPerQN: number }>;
  programs: Array<{ tick: number; program: number }>;
}

interface GenSmpteSMF {
  fps: number;
  ppf: number;
  noteSeq: {
    channel: number;
    pitch: number;
    notes: Array<{ onTick: number; offTick: number }>;
  };
  tempos: Array<{ tick: number; microsecondsPerQN: number }>;
}

function buildPpqnSMFFromGen(gen: GenPpqnSMF): SMF {
  const builder = SMFBuilder.ppqn(gen.ppqn);
  const track = builder.addTrack();
  for (const t of gen.tempos) {
    track.tempo(t.tick, t.microsecondsPerQN);
  }
  for (const p of gen.programs) {
    track.programChange(p.tick, gen.noteSeq.channel, p.program);
  }
  for (const n of gen.noteSeq.notes) {
    track.noteOn(
      n.onTick,
      gen.noteSeq.channel,
      gen.noteSeq.pitch,
      DEFAULT_VELOCITY
    );
    track.noteOff(n.offTick, gen.noteSeq.channel, gen.noteSeq.pitch);
  }
  return builder.build();
}

function buildSmpteSMFFromGen(gen: GenSmpteSMF): SMF {
  const builder = SMFBuilder.smpte(gen.fps, gen.ppf);
  const track = builder.addTrack();
  for (const t of gen.tempos) {
    track.tempo(t.tick, t.microsecondsPerQN);
  }
  for (const n of gen.noteSeq.notes) {
    track.noteOn(
      n.onTick,
      gen.noteSeq.channel,
      gen.noteSeq.pitch,
      DEFAULT_VELOCITY
    );
    track.noteOff(n.offTick, gen.noteSeq.channel, gen.noteSeq.pitch);
  }
  return builder.build();
}

// =============================================================================
// Property-based tests
// =============================================================================

describe("smfToNoteSequence properties", () => {
  // ---------------------------------------------------------------------------
  // PPQN converter properties
  // ---------------------------------------------------------------------------

  describe("PPQN converter", () => {
    it("property: produces non-negative rationals for any valid tick and ppqn", () => {
      fc.assert(
        fc.property(
          genPpqn,
          fc.integer({ min: 0, max: 100000 }),
          (ppqn, tick) => {
            const smf = SMFBuilder.ppqn(ppqn)
              .addTrack()
              .noteOn(0, 0, MIDDLE_C, DEFAULT_VELOCITY)
              .noteOff(tick, 0, MIDDLE_C)
              .done()
              .build();
            const result = smfToNoteSequence(smf);
            if (tick === 0) return result.notes.length === 0; // zero-duration discarded
            const note = result.notes[0];
            return rationalToNumber(note.endTime) >= 0;
          }
        )
      );
    });

    it("property: endTime denominator divides ppqn", () => {
      fc.assert(
        fc.property(
          genPpqn,
          fc.integer({ min: 1, max: 100000 }),
          (ppqn, tick) => {
            const smf = SMFBuilder.ppqn(ppqn)
              .addTrack()
              .noteOn(0, 0, MIDDLE_C, DEFAULT_VELOCITY)
              .noteOff(tick, 0, MIDDLE_C)
              .done()
              .build();
            const result = smfToNoteSequence(smf);
            const note = result.notes[0];
            // createRational(tick, ppqn) reduces by GCD, so the resulting
            // denominator must divide ppqn.
            return ppqn % note.endTime.denominator === 0;
          }
        )
      );
    });
  });

  // ---------------------------------------------------------------------------
  // SMPTE converter properties
  // ---------------------------------------------------------------------------

  describe("SMPTE converter", () => {
    it("property: tick 0 always produces 0/1", () => {
      fc.assert(
        fc.property(
          genFps,
          genPpf,
          fc.array(
            fc.record({
              tick: fc.integer({ min: 1, max: 10000 }),
              microsecondsPerQN: genRealisticTempo,
            }),
            { maxLength: 3 }
          ),
          (fps, ppf, tempos) => {
            const builder = SMFBuilder.smpte(fps, ppf);
            const track = builder.addTrack();
            for (const t of tempos) {
              track.tempo(t.tick, t.microsecondsPerQN);
            }
            track.noteOn(0, 0, MIDDLE_C, DEFAULT_VELOCITY);
            track.noteOff(1, 0, MIDDLE_C); // need a non-zero tick for a valid note
            const result = smfToNoteSequence(builder.build());
            const note = result.notes[0];
            return (
              note.startTime.numerator === 0 &&
              note.startTime.denominator === 1
            );
          }
        )
      );
    });

    it("property: non-negative result for any non-negative tick", () => {
      fc.assert(
        fc.property(genValidSmpteSMF, (gen) => {
          const smf = buildSmpteSMFFromGen(gen);
          const result = smfToNoteSequence(smf);
          return result.notes.every(
            (n) =>
              rationalToNumber(n.startTime) >= 0 &&
              rationalToNumber(n.endTime) >= 0
          );
        })
      );
    });

    it("property: monotonically non-decreasing (later ticks produce >= quarter-note values)", () => {
      fc.assert(
        fc.property(genValidSmpteSMF, (gen) => {
          if (gen.noteSeq.notes.length < 2) return true;
          const smf = buildSmpteSMFFromGen(gen);
          const result = smfToNoteSequence(smf);
          // because all notes share the same channel+pitch and are non-overlapping,
          // the notes array should have increasing start times.
          for (let i = 1; i < result.notes.length; i++) {
            if (
              compareRational(
                result.notes[i].startTime,
                result.notes[i - 1].startTime
              ) < 0
            ) {
              return false;
            }
          }
          return true;
        })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Note pairing properties
  // ---------------------------------------------------------------------------

  describe("note pairing", () => {
    it("property: output count equals input pair count for non-overlapping notes", () => {
      fc.assert(
        fc.property(genValidPpqnSMF, (gen) => {
          const smf = buildPpqnSMFFromGen(gen);
          const result = smfToNoteSequence(smf);
          return result.notes.length === gen.noteSeq.notes.length;
        })
      );
    });

    it("property: every note has startTime < endTime", () => {
      fc.assert(
        fc.property(genValidPpqnSMF, (gen) => {
          const smf = buildPpqnSMFFromGen(gen);
          const result = smfToNoteSequence(smf);
          return result.notes.every(
            (n) => compareRational(n.startTime, n.endTime) < 0
          );
        })
      );
    });

    it("property: deterministic (same input produces equal output)", () => {
      fc.assert(
        fc.property(genValidPpqnSMF, (gen) => {
          const smf1 = buildPpqnSMFFromGen(gen);
          const smf2 = buildPpqnSMFFromGen(gen);
          const r1 = smfToNoteSequence(smf1);
          const r2 = smfToNoteSequence(smf2);
          if (r1.notes.length !== r2.notes.length) return false;
          for (let i = 0; i < r1.notes.length; i++) {
            if (
              compareRational(r1.notes[i].startTime, r2.notes[i].startTime) !==
              0
            )
              return false;
            if (
              compareRational(r1.notes[i].endTime, r2.notes[i].endTime) !== 0
            )
              return false;
          }
          return true;
        })
      );
    });

    it("property: every tempo and time signature time is non-negative", () => {
      fc.assert(
        fc.property(genValidPpqnSMF, (gen) => {
          const smf = buildPpqnSMFFromGen(gen);
          const result = smfToNoteSequence(smf);
          const temposOk = result.tempos.every(
            (t) => rationalToNumber(t.time) >= 0
          );
          const tsOk = result.timeSignatures.every(
            (ts) => rationalToNumber(ts.time) >= 0
          );
          return temposOk && tsOk;
        })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Edge-case properties
  // ---------------------------------------------------------------------------

  describe("edge-case properties", () => {
    it("property: overlapping notes on same pitch produce exactly 2 notes", () => {
      fc.assert(
        fc.property(genOverlappingNotes, genPpqn, (gen, ppqn) => {
          const smf = SMFBuilder.ppqn(ppqn)
            .addTrack()
            .noteOn(gen.firstOnTick, gen.channel, gen.pitch, DEFAULT_VELOCITY)
            .noteOn(gen.secondOnTick, gen.channel, gen.pitch, DEFAULT_VELOCITY)
            .noteOff(gen.offTick, gen.channel, gen.pitch)
            .done()
            .build();
          const result = smfToNoteSequence(smf);
          return result.notes.length === 2;
        })
      );
    });

    it("property: orphan note-offs produce no notes", () => {
      fc.assert(
        fc.property(genOrphanNoteOff, genPpqn, (gen, ppqn) => {
          const smf = SMFBuilder.ppqn(ppqn)
            .addTrack()
            .noteOff(gen.tick, gen.channel, gen.pitch)
            .done()
            .build();
          const result = smfToNoteSequence(smf);
          return result.notes.length === 0;
        })
      );
    });

    it("property: zero-duration notes are discarded", () => {
      fc.assert(
        fc.property(genZeroDurationNote, genPpqn, (gen, ppqn) => {
          const smf = SMFBuilder.ppqn(ppqn)
            .addTrack()
            .noteOn(gen.tick, gen.channel, gen.pitch, gen.velocity)
            .noteOff(gen.tick, gen.channel, gen.pitch)
            .done()
            .build();
          const result = smfToNoteSequence(smf);
          return result.notes.length === 0;
        })
      );
    });

    it("property: duplicate tempos at same tick are deduplicated to one", () => {
      fc.assert(
        fc.property(genDuplicateTempos, genPpqn, (gen, ppqn) => {
          const smf = SMFBuilder.ppqn(ppqn)
            .addTrack()
            .tempo(gen.tick, gen.tempo1)
            .tempo(gen.tick, gen.tempo2)
            .noteOn(0, 0, MIDDLE_C, DEFAULT_VELOCITY)
            .noteOff(480, 0, MIDDLE_C)
            .done()
            .build();
          const result = smfToNoteSequence(smf);
          // only one tempo at gen.tick after dedup (plus possible default at tick 0)
          const temposAtTick = result.tempos.filter(
            (t) =>
              rationalToNumber(t.time) ===
              rationalToNumber(createRational(gen.tick, ppqn))
          );
          return temposAtTick.length <= 1;
        })
      );
    });

    it("property: unterminated notes are closed with positive duration", () => {
      fc.assert(
        fc.property(genUnterminatedNote, genPpqn, (gen, ppqn) => {
          const maxTick = gen.onTick + gen.maxTickOffset;
          const smf = SMFBuilder.ppqn(ppqn)
            .addTrack()
            .noteOn(gen.onTick, gen.channel, gen.pitch, gen.velocity)
            .tempo(maxTick, DEFAULT_TEMPO) // ensures maxTick > onTick
            .done()
            .build();
          const result = smfToNoteSequence(smf);
          if (result.notes.length !== 1) return false;
          return (
            compareRational(result.notes[0].startTime, result.notes[0].endTime) <
            0
          );
        })
      );
    });
  });
});
