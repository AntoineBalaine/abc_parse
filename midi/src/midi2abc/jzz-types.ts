// Structural interfaces for the subset of the jzz-midi-smf API that the
// SMF mapper uses. Because jzz-midi-smf ships no TypeScript type definitions
// (and no @types package exists), we define our own interfaces here. The real
// jzz library uses classes (SMF extends Array, MTrk extends Array), but our
// code only needs duck-typed access to specific properties and methods, so
// these interfaces also let tests supply plain mock objects without needing
// the real jzz dependency.

export interface MMidiEvent {
  tt: number; // absolute tick position
  [index: number]: number; // status and data bytes
  isNoteOn(): boolean;
  isNoteOff(): boolean;
  isTempo(): boolean;
  isTimeSignature(): boolean;
  isEOT(): boolean;
  getChannel(): number;
  getNote(): number;
  getVelocity(): number;
  getTempo(): number;
  getTimeSignature(): [number, number];
}

export interface MMTrk {
  length: number;
  [index: number]: MMidiEvent;
}

export interface SMF {
  length: number;
  [index: number]: MMTrk;
  ppqn?: number;
  fps?: number;
  ppf?: number;
}
