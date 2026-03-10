import { IRational } from "abc-parser/Visitors/fmt/rational";

export interface MNote {
  pitch: number; // MIDI pitch 0-127
  startTime: IRational; // in quarter notes
  endTime: IRational; // in quarter notes
  channel: number; // MIDI channel 0-15
  program: number; // MIDI program 0-127
  velocity: number; // MIDI velocity 0-127
}

export interface MTempo {
  time: IRational; // in quarter notes
  microsecondsPerQN: number; // exact integer from the MIDI file
}

export interface MTimeSignature {
  time: IRational; // in quarter notes
  numerator: number; // e.g. 6 in 6/8
  denominator: number; // e.g. 8 in 6/8 (not reduced -- 6/8 != 3/4)
}

export interface MNoteSequence {
  notes: MNote[];
  tempos: MTempo[];
  timeSignatures: MTimeSignature[];
}
