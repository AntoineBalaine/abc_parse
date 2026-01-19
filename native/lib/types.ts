/**
 * TypeScript types for MuseSampler IPC protocol.
 */

/**
 * Instrument information from MuseSampler.
 */
export interface InstrumentInfo {
  id: number;
  name: string;
  category: string;
  pack_name: string;
}

/**
 * Note event to send to MuseSampler.
 */
export interface NoteEvent {
  voice: number; // 0-3
  location_us: bigint; // microseconds from start
  duration_us: bigint; // duration in microseconds
  pitch: number; // MIDI pitch (60 = C4)
  tempo: number; // BPM
  offset_cents: number; // pitch offset (-50 = quarter flat)
  articulation: bigint; // articulation flags
  articulation_2: bigint; // additional flags
  notehead: number; // notehead type
}

/**
 * Dynamics event to send to MuseSampler.
 */
export interface DynamicsEvent {
  location_us: bigint;
  value: number; // 0.0 - 1.0
}

/**
 * IPC command types.
 */
export type CommandType =
  | "load_library"
  | "get_instruments"
  | "create_session"
  | "destroy_session"
  | "add_track"
  | "finalize_track"
  | "clear_track"
  | "add_note_event"
  | "add_dynamics_event"
  | "play"
  | "pause"
  | "seek"
  | "stop"
  | "quit";

/**
 * IPC command structure.
 */
export interface Command {
  cmd: CommandType;
  path?: string;
  session_id?: number;
  track_id?: number;
  instrument_id?: number;
  sample_rate?: number;
  block_size?: number;
  channels?: number;
  position_us?: number;
  event?: NoteEventJson;
  dynamics?: DynamicsEventJson;
}

/**
 * Note event in JSON-serializable format (bigints as numbers).
 */
export interface NoteEventJson {
  voice: number;
  location_us: number;
  duration_us: number;
  pitch: number;
  tempo: number;
  offset_cents: number;
  articulation: number;
  articulation_2: number;
  notehead: number;
}

/**
 * Dynamics event in JSON-serializable format.
 */
export interface DynamicsEventJson {
  location_us: number;
  value: number;
}

/**
 * IPC response structure.
 */
export interface Response {
  ok: boolean;
  error?: string;
  version?: string;
  instruments?: InstrumentInfo[];
  session_id?: number;
  track_id?: number;
  quit?: boolean;
}

/**
 * Convert a NoteEvent to JSON-serializable format.
 */
export function noteEventToJson(event: NoteEvent): NoteEventJson {
  return {
    voice: event.voice,
    location_us: Number(event.location_us),
    duration_us: Number(event.duration_us),
    pitch: event.pitch,
    tempo: event.tempo,
    offset_cents: event.offset_cents,
    articulation: Number(event.articulation),
    articulation_2: Number(event.articulation_2),
    notehead: event.notehead,
  };
}

/**
 * Convert a DynamicsEvent to JSON-serializable format.
 */
export function dynamicsEventToJson(event: DynamicsEvent): DynamicsEventJson {
  return {
    location_us: Number(event.location_us),
    value: event.value,
  };
}
