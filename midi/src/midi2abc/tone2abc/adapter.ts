// Adapter: converts the SMF mapper's MNoteSequence (quarter-note-based IRational
// timing) into the NoteSequence format expected by tone2abc (seconds-based
// floating-point timing).

import { rationalToNumber } from "abc-parser/Visitors/fmt/rational";
import { MNoteSequence } from "../types";
import { Note, Tempo, TimeSignature, NoteSequence } from "./types";

// Converts quarter-note time to seconds using the tempo map.
// The tempos array must be sorted by time.
function quartersToSeconds(quarterNotes: number, tempos: { time: number; microsecondsPerQN: number }[]): number {
  let seconds = 0;
  let prevQN = 0;
  let microsecondsPerQN = 500_000; // default: 120 BPM

  for (const tempo of tempos) {
    const tempoQN = tempo.time;
    if (tempoQN >= quarterNotes) break;

    const deltaQN = tempoQN - prevQN;
    seconds += (deltaQN * microsecondsPerQN) / 1_000_000;
    prevQN = tempoQN;
    microsecondsPerQN = tempo.microsecondsPerQN;
  }

  const deltaQN = quarterNotes - prevQN;
  seconds += (deltaQN * microsecondsPerQN) / 1_000_000;
  return seconds;
}

export function toNoteSequence(mns: MNoteSequence): NoteSequence {
  // Pre-convert tempo times to numbers for the time conversion function
  const tempoLookup = mns.tempos.map((t) => ({
    time: rationalToNumber(t.time),
    microsecondsPerQN: t.microsecondsPerQN,
  }));

  const tempos: Tempo[] = tempoLookup.map((t) => ({
    time: quartersToSeconds(t.time, tempoLookup),
    qpm: 60_000_000 / t.microsecondsPerQN,
    timeTo: 0, // filled in by cleanupTempos inside tone2abc
  }));

  const timeSignatures: TimeSignature[] = mns.timeSignatures.map((ts) => ({
    time: quartersToSeconds(rationalToNumber(ts.time), tempoLookup),
    numerator: ts.numerator,
    denominator: ts.denominator,
  }));

  // Compute totalTime from the latest note endTime
  let maxEndQN = 0;
  for (const note of mns.notes) {
    const endQN = rationalToNumber(note.endTime);
    if (endQN > maxEndQN) maxEndQN = endQN;
  }
  const totalTime = quartersToSeconds(maxEndQN, tempoLookup);

  const notes: Note[] = mns.notes.map((n) => ({
    pitch: n.pitch,
    startTime: quartersToSeconds(rationalToNumber(n.startTime), tempoLookup),
    endTime: quartersToSeconds(rationalToNumber(n.endTime), tempoLookup),
    instrument: n.channel,
    program: n.program,
    velocity: n.velocity,
    isDrum: n.channel === 9,
    tie: false,
    splitted: false,
  }));

  return { notes, tempos, timeSignatures, totalTime };
}
