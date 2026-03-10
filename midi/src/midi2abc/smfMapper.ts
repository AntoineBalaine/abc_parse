// SMF Mapper: converts a parsed SMF object into an MNoteSequence.
// See private/designs/smf-mapper-design.md for the full design document.

import { IRational, createRational } from "abc-parser/Visitors/fmt2/rational";
import { SMF, MMidiEvent } from "./jzz-types";
import { MNote, MTempo, MTimeSignature, MNoteSequence } from "./types";

// =============================================================================
// Internal types
// =============================================================================

interface MRawTempo {
  tick: number;
  microsecondsPerQN: number;
}

interface MRawTimeSig {
  tick: number;
  numerator: number;
  denominator: number;
}

interface MRawProgramChange {
  tick: number;
  channel: number;
  program: number;
}

interface MRawNoteEvent {
  tick: number;
  channel: number;
  pitch: number;
  velocity: number;
  isOn: boolean;
}

interface MActiveNote {
  tick: number;
  velocity: number;
}

// a converter maps a tick position to a quarter-note position
type MTickConverter = (tick: number) => IRational;

// =============================================================================
// Entry point
// =============================================================================

export function smfToNoteSequence(smf: SMF): MNoteSequence {
  const tempoEvents: MRawTempo[] = [];
  const timeSigEvents: MRawTimeSig[] = [];
  const programChanges: MRawProgramChange[] = [];
  const noteEvents: MRawNoteEvent[] = [];

  // Pass 1: collect raw events from all tracks, tracking the highest tick seen
  const maxTick = collectRawEvents(smf, tempoEvents, timeSigEvents, programChanges, noteEvents);

  // apply defaults for missing meta events
  if (tempoEvents.length === 0) {
    tempoEvents.push({ tick: 0, microsecondsPerQN: 500_000 });
  }
  if (timeSigEvents.length === 0) {
    timeSigEvents.push({ tick: 0, numerator: 4, denominator: 4 });
  }

  // Pass 2: deduplicate, convert, pair, and assemble
  return buildNoteSequence(smf, tempoEvents, timeSigEvents, programChanges, noteEvents, maxTick);
}

// =============================================================================
// Pass 1: collect raw events
// =============================================================================

function collectRawEvents(
  smf: SMF,
  tempoEvents: MRawTempo[],
  timeSigEvents: MRawTimeSig[],
  programChanges: MRawProgramChange[],
  noteEvents: MRawNoteEvent[]
): number {
  let maxTick = 0;
  for (let i = 0; i < smf.length; i++) {
    const track = smf[i];

    for (let j = 0; j < track.length; j++) {
      const event = track[j];

      const tick = event.tt;
      if (tick > maxTick) maxTick = tick;

      if (event.isTempo()) {
        tempoEvents.push({ tick, microsecondsPerQN: event.getTempo() });
      } else if (event.isTimeSignature()) {
        const [num, denom] = event.getTimeSignature();
        timeSigEvents.push({ tick, numerator: num, denominator: denom });
      } else if (isProgramChange(event)) {
        programChanges.push({
          tick,
          channel: event[0] & 0x0f,
          program: event[1],
        });
      } else if (event.isNoteOn()) {
        noteEvents.push({
          tick,
          channel: event.getChannel(),
          pitch: event.getNote(),
          velocity: event.getVelocity(),
          isOn: true,
        });
      } else if (event.isNoteOff()) {
        noteEvents.push({
          tick,
          channel: event.getChannel(),
          pitch: event.getNote(),
          velocity: 0,
          isOn: false,
        });
      }
    }
  }
  return maxTick;
}

function isProgramChange(event: MMidiEvent): boolean {
  const status = event[0];
  return status >= 0xc0 && status <= 0xcf;
}

// =============================================================================
// Pass 2: build the NoteSequence
// =============================================================================

function buildNoteSequence(
  smf: SMF,
  tempoEvents: MRawTempo[],
  timeSigEvents: MRawTimeSig[],
  programChanges: MRawProgramChange[],
  noteEvents: MRawNoteEvent[],
  maxTick: number
): MNoteSequence {
  // deduplicate meta events by tick (last one wins)
  const dedupedTempos = deduplicateByTick(tempoEvents);
  const dedupedTimeSigs = deduplicateByTick(timeSigEvents);

  // choose the tick-to-quarter-note converter based on the SMF's timing mode
  let converter: MTickConverter;
  if (smf.ppqn !== undefined) {
    converter = ppqnConverter(smf.ppqn);
  } else {
    if (smf.fps === undefined || smf.ppf === undefined) {
      throw new Error("SMPTE SMF must have both fps and ppf defined");
    }
    converter = smpteConverter(smf.fps, smf.ppf, dedupedTempos);
  }

  // convert tempo events
  const tempos: MTempo[] = dedupedTempos.map((entry) => ({
    time: converter(entry.tick),
    microsecondsPerQN: entry.microsecondsPerQN,
  }));

  // convert time signature events
  const timeSignatures: MTimeSignature[] = dedupedTimeSigs.map((entry) => ({
    time: converter(entry.tick),
    numerator: entry.numerator,
    denominator: entry.denominator,
  }));

  // pair note-on/off events into Note objects
  const notes = pairNotes(noteEvents, converter, programChanges, maxTick);

  return { notes, tempos, timeSignatures };
}

// =============================================================================
// Deduplication
// =============================================================================

// When multiple events share the same tick, only the last one is kept.
// Because we iterate tracks in index order during Pass 1, "last" means
// the entry from the highest-indexed track. In practice, duplicates at
// the same tick are expected to be identical across tracks.
function deduplicateByTick<T extends { tick: number }>(events: T[]): T[] {
  events.sort((a, b) => a.tick - b.tick);

  const result: T[] = [];
  for (const event of events) {
    if (result.length > 0 && result[result.length - 1].tick === event.tick) {
      result[result.length - 1] = event;
    } else {
      result.push(event);
    }
  }
  return result;
}

// =============================================================================
// Tick-to-quarter-note converters
// =============================================================================

// PPQN converter: each tick is 1/ppqn of a quarter note.
function ppqnConverter(ppqn: number): MTickConverter {
  return (tick: number): IRational => createRational(tick, ppqn);
}

// SMPTE converter: ticks represent real time, so we need the tempo map
// to convert to quarter notes.
// All intermediate arithmetic uses BigInt to avoid overflow on long files.
// The tempoEvents array must already be sorted and deduplicated.
function smpteConverter(fps: number, ppf: number, tempoEvents: MRawTempo[]): MTickConverter {
  const ticksPerSecond = BigInt(fps * ppf);
  const million = BigInt(1_000_000);

  return (targetTick: number): IRational => {
    let num = 0n;
    let den = 1n;
    let prevTick = 0;
    // The accumulation for each region [prevTick, entry.tick) uses the tempo
    // that was active before that entry, so we must read microsecondsPerQN
    // before updating it to entry.microsecondsPerQN at the bottom of the loop.
    let microsecondsPerQN = 500_000;

    for (const entry of tempoEvents) {
      if (entry.tick >= targetTick) {
        break;
      }

      const deltaTicks = BigInt(entry.tick - prevTick);
      const regionMicros = BigInt(microsecondsPerQN);

      // accumulate: num/den += deltaTicks * 1_000_000 / (ticksPerSecond * regionMicros)
      const regionDen = ticksPerSecond * regionMicros;
      num = num * regionDen + deltaTicks * million * den;
      den = den * regionDen;

      // reduce to keep the numbers from growing unboundedly
      const g = bigIntGCD(num, den);
      num = num / g;
      den = den / g;

      prevTick = entry.tick;
      microsecondsPerQN = entry.microsecondsPerQN;
    }

    // accumulate the remaining ticks from prevTick to targetTick
    const deltaTicks = BigInt(targetTick - prevTick);
    const regionMicros = BigInt(microsecondsPerQN);
    const regionDen = ticksPerSecond * regionMicros;
    num = num * regionDen + deltaTicks * million * den;
    den = den * regionDen;
    const g = bigIntGCD(num, den);
    num = num / g;
    den = den / g;

    // safety check: the reduced values must fit in JavaScript's safe integer range
    if (num > BigInt(Number.MAX_SAFE_INTEGER) || den > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error("SMPTE conversion overflow: reduced fraction exceeds Number.MAX_SAFE_INTEGER");
    }

    return createRational(Number(num), Number(den));
  };
}

// Euclidean GCD on BigInt values.
function bigIntGCD(a: bigint, b: bigint): bigint {
  if (a < 0n) a = -a;
  if (b < 0n) b = -b;
  while (b !== 0n) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}

// =============================================================================
// Note pairing
// =============================================================================

function pairNotes(noteEvents: MRawNoteEvent[], converter: MTickConverter, programChanges: MRawProgramChange[], maxTick: number): MNote[] {
  // sort by tick; at equal ticks, note-offs come before note-ons
  noteEvents.sort((a, b) => {
    if (a.tick !== b.tick) return a.tick - b.tick;
    return (a.isOn ? 1 : 0) - (b.isOn ? 1 : 0);
  });

  // sort program changes by tick for lookup
  programChanges.sort((a, b) => a.tick - b.tick);

  const active = new Map<string, MActiveNote>();
  const notes: MNote[] = [];

  for (const event of noteEvents) {
    const key = `${event.channel}-${event.pitch}`;
    const existing = active.get(key);

    if (existing !== undefined) {
      // close the previous note at this tick, whether we got a note-off
      // or a new note-on on the same pitch (which truncates the previous one)
      const note = buildNote(converter, programChanges, existing, event.tick, event.channel, event.pitch);
      if (note !== undefined) notes.push(note);
      active.delete(key);
    }

    if (event.isOn) {
      active.set(key, { tick: event.tick, velocity: event.velocity });
    }
    // a note-off with no preceding note-on is silently ignored
  }

  // close any remaining active notes at maxTick
  for (const [key, entry] of active) {
    const [channel, pitch] = parseKey(key);
    const note = buildNote(converter, programChanges, entry, maxTick, channel, pitch);
    if (note !== undefined) notes.push(note);
  }

  return notes;
}

// Builds an MNote from an active entry and its end tick.
// Returns undefined for zero-duration notes (note-on and note-off at the same tick).
function buildNote(
  converter: MTickConverter,
  programChanges: MRawProgramChange[],
  activeEntry: MActiveNote,
  endTick: number,
  channel: number,
  pitch: number
): MNote | undefined {
  if (activeEntry.tick === endTick) return undefined;

  const program = lookupProgram(programChanges, channel, activeEntry.tick);
  return {
    pitch,
    startTime: converter(activeEntry.tick),
    endTime: converter(endTick),
    channel,
    program,
    velocity: activeEntry.velocity,
  };
}

// Parses a "channel-pitch" key back into its two components.
function parseKey(key: string): [number, number] {
  const parts = key.split("-");
  return [Number(parts[0]), Number(parts[1])];
}

// =============================================================================
// Program change lookup
// =============================================================================

// Returns the active program for a given channel at a given tick.
// The programChanges array must be sorted by tick.
// We reverse iterate so that the first match for this channel at or before
// noteTick is the correct one, and we can return immediately.
function lookupProgram(programChanges: MRawProgramChange[], channel: number, noteTick: number): number {
  for (let i = programChanges.length - 1; i >= 0; i--) {
    const pc = programChanges[i];
    if (pc.tick <= noteTick && pc.channel === channel) return pc.program;
  }
  return 0; // default: acoustic grand piano (GM)
}
