/**
 * MuseSampler Event Types
 *
 * TypeScript interfaces matching the C structs from MuseScore's
 * src/framework/musesampler/internal/apitypes.h
 *
 * These types represent the input format expected by the MuseSampler library.
 */

/**
 * Articulation flags (ms_NoteArticulation)
 *
 * These are bitflags that can be combined with bitwise OR.
 * From apitypes.h: enum ms_NoteArticulation : uint64_t
 */
export const NoteArticulation = {
  None: 0n,
  Staccato: 1n << 0n,
  Staccatissimo: 1n << 1n,
  Accent: 1n << 2n,
  Tenuto: 1n << 3n,
  Marcato: 1n << 4n,
  Harmonics: 1n << 5n,
  Mute: 1n << 6n,
  Trill: 1n << 7n,
  MordentSemi: 1n << 8n,
  MordentWhole: 1n << 9n,
  MordentInvertedSemi: 1n << 10n,
  MordentInvertedWhole: 1n << 11n,
  TurnSemiWhole: 1n << 12n,
  TurnSemiSemi: 1n << 13n,
  TurnWholeWhole: 1n << 14n,
  TurnWholeSemi: 1n << 15n,
  TurnInvertedSemiWhole: 1n << 16n,
  TurnInvertedSemiSemi: 1n << 17n,
  TurnInvertedWholeWhole: 1n << 18n,
  TurnInvertedWholeSemi: 1n << 19n,
  ArpeggioUp: 1n << 20n,
  ArpeggioDown: 1n << 21n,
  Tremolo1: 1n << 22n,
  Tremolo2: 1n << 23n,
  Tremolo3: 1n << 24n,
  Scoop: 1n << 25n,
  Plop: 1n << 26n,
  Doit: 1n << 27n,
  Fall: 1n << 28n,
  Appoggiatura: 1n << 29n,
  Acciaccatura: 1n << 30n,
  Open: 1n << 31n,
  Martellato: 1n << 32n,
  MartellatoLift: 1n << 33n,
  HandMartellato: 1n << 34n,
  MutedMartellato: 1n << 35n,
  Portamento: 1n << 36n,
  Pizzicato: 1n << 37n,
  MalletBellSuspended: 1n << 38n,
  Glissando: 1n << 39n,
  Pedal: 1n << 40n,
  Slur: 1n << 41n,
  SnapPizzicato: 1n << 42n,
  ColLegno: 1n << 43n,
  SulTasto: 1n << 44n,
  SulPonticello: 1n << 45n,
  LeftHandTapping: 1n << 46n,
  RightHandTapping: 1n << 47n,
  PalmMute: 1n << 48n,
  PinchHarmonic: 1n << 49n,
  BuzzTremolo: 1n << 50n,
  MalletBellOnTable: 1n << 52n,
  MalletLift: 1n << 53n,
  PluckLift: 1n << 54n,
  Gyro: 1n << 55n,
  LaissezVibrer: 1n << 59n,
} as const;

export type NoteArticulationFlags = bigint;

/**
 * Additional articulation flags (ms_NoteArticulation2)
 *
 * From apitypes.h: enum ms_NoteArticulation2 : uint64_t
 */
export const NoteArticulation2 = {
  None: 0n,
  Ring: 1n << 0n,
  ThumbDamp: 1n << 1n,
  BrushDamp: 1n << 2n,
  RingTouch: 1n << 3n,
  Pluck: 1n << 4n,
  SingingBell: 1n << 5n,
  SingingVibrate: 1n << 6n,
  HandbellSwing: 1n << 7n,
  Echo: 1n << 8n,
  FallRough: 1n << 9n,
  PlopRough: 1n << 10n,
  DoitRough: 1n << 11n,
  ScoopRough: 1n << 12n,
} as const;

export type NoteArticulation2Flags = bigint;

/**
 * Notehead styles (ms_NoteHead)
 *
 * From apitypes.h: enum ms_NoteHead : int16_t
 */
export enum NoteHead {
  Normal = 0,
  XNote = 1,
  LargeX = 2,
  OrnateXNote = 3,
  CircleXNote = 4,
  CircleDot = 5,
  Ghost = 6,
  Circle = 7,
  Diamond = 8,
  Triangle = 9,
  TriangleUp = 10,
  TriangleDown = 11,
  TriangleRight = 12,
  TriangleRoundDown = 13,
  FlatTop = 14,
  Square = 15,
  Slash = 16,
  SlashRightFilled = 17,
  SlashLeftFilled = 18,
  Plus = 19,
}

/**
 * Note event (ms_NoteEvent_5)
 *
 * From apitypes.h:
 * typedef struct ms_NoteEvent_5 {
 *     int _voice;
 *     long long _location_us;
 *     long long _duration_us;
 *     int _pitch;
 *     double _tempo;
 *     int _offset_cents;
 *     ms_NoteArticulation _articulation;
 *     ms_NoteArticulation2 _articulation_2;
 *     ms_NoteHead _notehead;
 * } ms_NoteEvent_5;
 */
export interface NoteEvent {
  voice: number;                        // 0-3
  location_us: bigint;                  // microseconds from start
  duration_us: bigint;                  // duration in microseconds
  pitch: number;                        // MIDI pitch (60 = C4)
  tempo: number;                        // BPM
  offset_cents: number;                 // microtonal adjustment (-50 = quarter flat)
  articulation: NoteArticulationFlags;  // bitflags from NoteArticulation
  articulation_2: NoteArticulation2Flags; // bitflags from NoteArticulation2
  notehead: NoteHead;                   // notehead style
}

/**
 * Dynamics event (ms_DynamicsEvent_2)
 *
 * From apitypes.h:
 * typedef struct ms_DynamicsEvent_2 {
 *     long long _location_us;
 *     double _value;
 * } ms_DynamicsEvent_2;
 */
export interface DynamicsEvent {
  location_us: bigint;  // microseconds from start
  value: number;        // 0.0 - 1.0
}

/**
 * Pedal event (ms_PedalEvent_2)
 *
 * From apitypes.h:
 * typedef struct ms_PedalEvent_2 {
 *     long long _location_us;
 *     double _value;
 * } ms_PedalEvent_2;
 */
export interface PedalEvent {
  location_us: bigint;  // microseconds from start
  value: number;        // 0.0 - 1.0
}

/**
 * Pitch bend info (ms_PitchBendInfo)
 *
 * From apitypes.h:
 * typedef struct ms_PitchBendInfo {
 *     int64_t event_id;
 *     long long _start_us;
 *     long long _duration_us;
 *     int _offset_cents;
 *     ms_PitchBendType _type;
 * } ms_PitchBendInfo;
 */
export enum PitchBendType {
  Linear = 0,
  Bezier = 1,
}

export interface PitchBendInfo {
  event_id: bigint;
  start_us: bigint;      // offset from the start of the note, not absolute time
  duration_us: bigint;
  offset_cents: number;
  type: PitchBendType;
}

/**
 * Vibrato info (ms_VibratoInfo)
 *
 * From apitypes.h:
 * typedef struct ms_VibratoInfo {
 *     int64_t event_id;
 *     long long _start_us;
 *     long long _duration_us;
 *     int _depth_cents;
 * } ms_VibratoInfo;
 */
export interface VibratoInfo {
  event_id: bigint;
  start_us: bigint;
  duration_us: bigint;
  depth_cents: number;
}

/**
 * Text articulation event (ms_TextArticulationEvent)
 *
 * From apitypes.h:
 * typedef struct ms_TextArticulationEvent {
 *     long long _start_us;
 *     const char* _articulation;
 * } ms_TextArticulationEvent;
 */
export interface TextArticulationEvent {
  start_us: bigint;
  articulation: string;  // articulation name
}

/**
 * Syllable event for vocal playback (ms_SyllableEvent2)
 *
 * From apitypes.h:
 * typedef struct ms_SyllableEvent2 {
 *     const char* _text;
 *     long long _position_us;
 *     bool _hyphened_to_next;
 * } ms_SyllableEvent2;
 */
export interface SyllableEvent {
  text: string;
  position_us: bigint;
  hyphened_to_next: boolean;
}

/**
 * Output buffer structure (ms_OutputBuffer)
 *
 * From apitypes.h:
 * typedef struct ms_OutputBuffer {
 *     float** _channels;
 *     int _num_data_pts;
 *     int _num_channels;
 * } ms_OutputBuffer;
 *
 * This is used internally by the native binding, not directly in TypeScript.
 */
export interface OutputBuffer {
  channels: Float32Array[];
  num_data_pts: number;
  num_channels: number;
}

/**
 * Instrument info returned from the library
 */
export interface InstrumentInfo {
  id: number;
  name: string;
  category: string;
  musicXmlSound: string;
  mpeSound: string;
}

/**
 * Result of converting an ABCJS Tune to MuseSampler events
 */
export interface ConversionResult {
  noteEvents: NoteEvent[];
  dynamicsEvents: DynamicsEvent[];
  pedalEvents: PedalEvent[];
  syllableEvents: SyllableEvent[];
  totalDuration_us: bigint;
  tempo: number;
}
