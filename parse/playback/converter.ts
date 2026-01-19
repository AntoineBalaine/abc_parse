/**
 * ABCJS Tune to MuseSampler Event Converter
 *
 * Converts the output of abc_parse's TuneInterpreter (ABCJS Tune format)
 * into MuseSampler events for playback.
 */

import { IRational, rationalToNumber } from "../Visitors/fmt2/rational";
import {
  Tune,
  NoteElement,
  Decorations,
  isNoteElement,
  isMusicLine,
  isTempoElement,
  TempoProperties,
  Pitch as ABCJSPitch,
  StaffSystem,
  Staff,
  VoiceElement,
} from "../types/abcjs-ast";
import {
  NoteEvent,
  DynamicsEvent,
  NoteHead,
  NoteArticulation,
  ConversionResult,
} from "./types";
import { abcPitchToMidi, accidentalToCents } from "./pitch-utils";
import {
  decorationsToArticulation,
  extractDynamics,
  hasFermata,
  DYNAMICS_MAP,
} from "./articulation-map";

/**
 * Default tempo if none specified (BPM).
 */
const DEFAULT_TEMPO = 120;

/**
 * Default beat length as a fraction of a whole note.
 * In ABC, L:1/8 is the default.
 */
const DEFAULT_BEAT_LENGTH: IRational = { numerator: 1, denominator: 8 };

/**
 * Fermata duration multiplier.
 * A fermata typically doubles the note duration.
 */
const FERMATA_MULTIPLIER = 2.0;

/**
 * Converts a duration fraction to microseconds.
 *
 * @param duration - Note duration as a fraction of a whole note
 * @param tempo - Tempo in BPM (beats per minute)
 * @param beatLength - Beat length as a fraction of a whole note
 * @returns Duration in microseconds
 */
export function durationToMicroseconds(
  duration: IRational,
  tempo: number,
  beatLength: IRational
): bigint {
  // Duration in whole notes
  const wholeNotes = rationalToNumber(duration);

  // Beat length in whole notes
  const beatLengthWholeNotes = rationalToNumber(beatLength);

  // Duration in beats
  const beats = wholeNotes / beatLengthWholeNotes;

  // Duration in seconds (beats * 60 / BPM)
  const seconds = (beats * 60) / tempo;

  // Convert to microseconds
  return BigInt(Math.round(seconds * 1_000_000));
}

/**
 * Extracts the tempo (BPM) from a Tune.
 */
function getTempo(tune: Tune): number {
  if (tune.metaText.tempo?.bpm) {
    return tune.metaText.tempo.bpm;
  }
  return DEFAULT_TEMPO;
}

/**
 * Extracts the beat length from a Tune.
 * Falls back to default 1/8 if not specified.
 */
function getBeatLength(tune: Tune): IRational {
  // The Tune interface has getBeatLength() but it returns a number
  // We need the fraction form for accurate calculation
  // For now, use the default
  return DEFAULT_BEAT_LENGTH;
}

/**
 * Converts an ABCJS Pitch to a MuseSampler NoteEvent.
 */
function pitchToNoteEvent(
  pitch: ABCJSPitch,
  location_us: bigint,
  duration_us: bigint,
  tempo: number,
  voice: number,
  decorations: Decorations[]
): NoteEvent {
  return {
    voice: voice % 4, // MuseSampler supports 4 voices per track
    location_us,
    duration_us,
    pitch: abcPitchToMidi(pitch.pitch, pitch.accidental),
    tempo,
    offset_cents: accidentalToCents(pitch.accidental),
    articulation: decorationsToArticulation(decorations),
    articulation_2: 0n,
    notehead: NoteHead.Normal,
  };
}

/**
 * Processes a single voice and extracts note events.
 */
function processVoice(
  voice: VoiceElement[],
  voiceIndex: number,
  startPosition_us: bigint,
  tempo: number,
  beatLength: IRational,
  noteEvents: NoteEvent[],
  dynamicsEvents: DynamicsEvent[]
): bigint {
  let position_us = startPosition_us;
  let currentDynamics: number | undefined;

  for (const element of voice) {
    if (isNoteElement(element)) {
      // Calculate duration
      let duration_us = durationToMicroseconds(element.duration, tempo, beatLength);

      // Apply fermata multiplier if present
      if (element.decoration && hasFermata(element.decoration)) {
        duration_us = BigInt(Math.round(Number(duration_us) * FERMATA_MULTIPLIER));
      }

      // Check for dynamics changes
      if (element.decoration) {
        const newDynamics = extractDynamics(element.decoration);
        if (newDynamics !== undefined && newDynamics !== currentDynamics) {
          currentDynamics = newDynamics;
          dynamicsEvents.push({
            location_us: position_us,
            value: newDynamics,
          });
        }
      }

      // Process pitches (notes and chords)
      if (element.pitches && element.pitches.length > 0) {
        const decorations = element.decoration ?? [];

        for (const pitch of element.pitches) {
          noteEvents.push(
            pitchToNoteEvent(
              pitch,
              position_us,
              duration_us,
              tempo,
              voiceIndex,
              decorations
            )
          );
        }
      }
      // Rests don't produce note events but still advance time

      // Advance position
      position_us += duration_us;
    } else if (isTempoElement(element)) {
      // Tempo changes mid-piece
      // For now, we don't handle mid-piece tempo changes
      // This would require recalculating durations for subsequent notes
    }
  }

  return position_us;
}

/**
 * Converts an ABCJS Tune to MuseSampler events.
 *
 * @param tune - The ABCJS Tune object from TuneInterpreter
 * @returns ConversionResult containing all events and metadata
 */
export function convertTuneToMuseSamplerEvents(tune: Tune): ConversionResult {
  const noteEvents: NoteEvent[] = [];
  const dynamicsEvents: DynamicsEvent[] = [];

  const tempo = getTempo(tune);
  const beatLength = getBeatLength(tune);

  let maxPosition_us = 0n;

  // Track voice positions across systems
  // In ABC, voices continue across system breaks
  const voicePositions: Map<number, bigint> = new Map();

  for (const system of tune.systems) {
    if (!isMusicLine(system)) {
      continue;
    }

    // Process each staff in the system
    for (let staffIndex = 0; staffIndex < system.staff.length; staffIndex++) {
      const staff = system.staff[staffIndex];

      // Process each voice in the staff
      for (let voiceIndex = 0; voiceIndex < staff.voices.length; voiceIndex++) {
        const voice = staff.voices[voiceIndex];

        // Calculate a unique voice ID across all staves
        const globalVoiceId = staffIndex * 10 + voiceIndex;

        // Get current position for this voice (or start at 0)
        const startPosition = voicePositions.get(globalVoiceId) ?? 0n;

        // Process the voice
        const endPosition = processVoice(
          voice,
          voiceIndex,
          startPosition,
          tempo,
          beatLength,
          noteEvents,
          dynamicsEvents
        );

        // Update voice position
        voicePositions.set(globalVoiceId, endPosition);

        // Track maximum position
        if (endPosition > maxPosition_us) {
          maxPosition_us = endPosition;
        }
      }
    }
  }

  // Sort events by time
  noteEvents.sort((a, b) => {
    const timeDiff = a.location_us - b.location_us;
    if (timeDiff !== 0n) return timeDiff < 0n ? -1 : 1;
    // Secondary sort by pitch for consistent ordering
    return a.pitch - b.pitch;
  });

  dynamicsEvents.sort((a, b) => {
    const timeDiff = a.location_us - b.location_us;
    if (timeDiff !== 0n) return timeDiff < 0n ? -1 : 1;
    return 0;
  });

  return {
    noteEvents,
    dynamicsEvents,
    pedalEvents: [],
    syllableEvents: [],
    totalDuration_us: maxPosition_us,
    tempo,
  };
}

/**
 * Creates a simple test conversion from a minimal note list.
 * Useful for testing the native binding without a full ABC parse.
 *
 * @param notes - Array of {pitch, duration_ms} objects
 * @param tempo - Tempo in BPM
 * @returns ConversionResult
 */
export function createSimpleNoteEvents(
  notes: Array<{ pitch: number; duration_ms: number }>,
  tempo: number = 120
): ConversionResult {
  const noteEvents: NoteEvent[] = [];
  let position_us = 0n;

  for (const note of notes) {
    const duration_us = BigInt(note.duration_ms * 1000);

    noteEvents.push({
      voice: 0,
      location_us: position_us,
      duration_us,
      pitch: note.pitch,
      tempo,
      offset_cents: 0,
      articulation: NoteArticulation.None,
      articulation_2: 0n,
      notehead: NoteHead.Normal,
    });

    position_us += duration_us;
  }

  return {
    noteEvents,
    dynamicsEvents: [],
    pedalEvents: [],
    syllableEvents: [],
    totalDuration_us: position_us,
    tempo,
  };
}
