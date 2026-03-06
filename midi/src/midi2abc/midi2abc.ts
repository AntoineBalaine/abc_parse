import JZZ from "jzz";
// @ts-expect-error no type definitions for jzz-midi-smf
import jzzMidiSmf from "jzz-midi-smf";
import { smfToNoteSequence } from "./smfMapper";
import { toNoteSequence } from "./tone2abc";
import { tone2abc } from "./tone2abc/tone2abc";
import { ConversionOptions } from "./tone2abc/types";

let jzzInitialized = false;

function ensureJzzInit(): void {
  if (!jzzInitialized) {
    jzzMidiSmf(JZZ);
    jzzInitialized = true;
  }
}

export function midi2abc(midiBytes: Uint8Array, options?: ConversionOptions): string {
  ensureJzzInit();
  // @ts-expect-error JZZ.MIDI.SMF is added by jzz-midi-smf but not in jzz's type defs
  const smf = new JZZ.MIDI.SMF(midiBytes);
  const mNoteSequence = smfToNoteSequence(smf);
  const noteSequence = toNoteSequence(mNoteSequence);
  return tone2abc(noteSequence, options);
}
