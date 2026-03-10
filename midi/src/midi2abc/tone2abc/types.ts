// Types for the tone2abc converter.
// These describe the NoteSequence format expected by the original midi2abc.js
// (by marmooo, https://github.com/nicerapp/nicern/), which uses seconds-based
// timing and instrument-based voice grouping.

export interface Note {
  pitch: number; // MIDI pitch 0-127
  startTime: number; // seconds
  endTime: number; // seconds
  instrument: number; // voice grouping index (mapped from MIDI channel)
  program: number; // MIDI program 0-127
  velocity: number; // MIDI velocity 0-127
  isDrum: boolean; // true if MIDI channel 10
  tie: boolean; // mutated during processing
  splitted: boolean; // mutated during processing
}

export interface Tempo {
  time: number; // seconds
  qpm: number; // quarter notes per minute
  timeTo: number; // end time of this tempo region (seconds)
}

export interface TimeSignature {
  time: number; // seconds
  numerator: number;
  denominator: number;
}

export interface NoteSequence {
  notes: Note[];
  tempos: Tempo[];
  timeSignatures: TimeSignature[];
  totalTime: number; // seconds
}

export interface ConversionOptions {
  title?: string;
  composer?: string;
}

export class KeyLength {
  numerator: number;
  denominator: number;
  factor: number;
  error: number;

  constructor(numerator: number, denominator: number, factor: number, error: number) {
    this.numerator = numerator;
    this.denominator = denominator;
    this.factor = factor;
    this.error = error;
  }
}

// Mutable state carried through the conversion. Replaces the global variables
// (tupletNum, tupletCount, section, sectionEnd) from the original code.
export interface ConversionContext {
  tupletNum: number;
  tupletCount: number;
  section: number;
  sectionEnd: number;
}
