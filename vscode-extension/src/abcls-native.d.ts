/**
 * Type declarations for abcls-native.
 *
 * Because abcls-native requires building a native C++ binary and is not part
 * of the production build, we provide this stub so that TypeScript can compile
 * the vscode-extension without the native package being present.
 */
declare module "abcls-native" {
  export function setMscorePath(path: string): void;
  export function getMscorePathConfig(): string;

  export interface InstrumentInfo {
    id: number;
    name: string;
    category: string;
    pack_name: string;
  }

  export interface NoteEvent {
    voice: number;
    location_us: bigint;
    duration_us: bigint;
    pitch: number;
    tempo: number;
    offset_cents: number;
    articulation: bigint;
    articulation_2: bigint;
    notehead: number;
  }

  export interface DynamicsEvent {
    location_us: bigint;
    value: number;
  }

  export class Track {
    addNoteEvent(event: NoteEvent): Promise<void>;
    addDynamicsEvent(event: DynamicsEvent): Promise<void>;
    finalize(): Promise<void>;
    clear(): Promise<void>;
  }

  export class Session {
    addTrack(instrumentId: number): Promise<Track>;
    play(): Promise<void>;
    pause(): Promise<void>;
    stop(): Promise<void>;
    seek(positionUs: bigint): Promise<void>;
    destroy(): Promise<void>;
  }

  export class MuseSamplerClient {
    start(): Promise<void>;
    loadLibrary(libraryPath?: string): Promise<string>;
    getInstruments(): Promise<InstrumentInfo[]>;
    createSession(sampleRate?: number, blockSize?: number, channels?: number): Promise<Session>;
    quit(): Promise<void>;
    isConnected(): boolean;
    getVersion(): string | null;
  }
}
