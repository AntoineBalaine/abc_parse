/**
 * TypeScript definitions for ABCJS Abstract Syntax Tree (AST)
 * Based on analysis of ABCJS codebase
 */

// ============================================================================
// Basic Types
// ============================================================================

export enum ClefType {
  Treble = "treble",
  Bass = "bass",
  Alto = "alto",
  Tenor = "tenor",
  Perc = "perc",
  None = "none",
  TreblePlus8 = "treble+8",
  TrebleMinus8 = "treble-8",
  BassPlus8 = "bass+8",
  BassMinus8 = "bass-8",
  AltoPlus8 = "alto+8",
  AltoMinus8 = "alto-8",
  TenorPlus8 = "tenor+8",
  TenorMinus8 = "tenor-8",
}

export enum AccidentalType {
  Flat = "flat",
  Natural = "natural",
  Sharp = "sharp",
  DblSharp = "dblsharp",
  DblFlat = "dblflat",
  QuarterFlat = "quarterflat",
  QuarterSharp = "quartersharp",
}

export enum NoteLetter {
  A = "A",
  B = "B",
  C = "C",
  D = "D",
  E = "E",
  F = "F",
  G = "G",
  LowerA = "a",
  LowerB = "b",
  LowerC = "c",
  LowerD = "d",
  LowerE = "e",
  LowerF = "f",
  LowerG = "g",
}

export enum KeyRoot {
  A = "A",
  B = "B",
  C = "C",
  D = "D",
  E = "E",
  F = "F",
  G = "G",
  HP = "HP",
}

export enum KeyAccidental {
  None = "",
  Sharp = "#",
  Flat = "b",
}

export enum MeterType {
  CommonTime = "common_time",
  CutTime = "cut_time",
  Specified = "specified",
  TempusPerfectum = "tempus_perfectum",
  TempusImperfectum = "tempus_imperfectum",
  TempusPerfectumProlatio = "tempus_perfectum_prolatio",
  TempusImperfectumProlatio = "tempus_imperfectum_prolatio",
}

export enum BarType {
  BarThin = "bar_thin",
  BarThickThin = "bar_thick_thin",
  BarThinThick = "bar_thin_thick",
  BarThinThin = "bar_thin_thin",
  BarLeftRepeat = "bar_left_repeat",
  BarRightRepeat = "bar_right_repeat",
  BarDblRepeat = "bar_dbl_repeat",
  BarInvisible = "bar_invisible",
}

export enum RestType {
  Normal = "normal",
  Invisible = "invisible",
  Spacer = "spacer",
}

export enum ChordPlacement {
  Above = "above",
  Below = "below",
  Left = "left",
  Right = "right",
  Default = "default",
}

export enum StemDirection {
  Up = "up",
  Down = "down",
  Auto = "auto",
  None = "none",
}

export enum BracketBracePosition {
  Start = "start",
  End = "end",
  Continue = "continue",
}

export enum AccidentalSymbol {
  Sharp = "^",
  Flat = "_",
  Natural = "=",
}

export enum Mode {
  Major = "",
  Minor = "m",
  Dorian = "Dor",
  Mixolydian = "Mix",
  Locrian = "Loc",
  Phrygian = "Phr",
  Lydian = "Lyd",
}

export enum ModeInput {
  Major = "major",
  Maj = "maj",
  Ionian = "ionian",
  Minor = "minor",
  Min = "min",
  M = "m",
  Aeolian = "aeolian",
  Aeo = "aeo",
  Dorian = "dorian",
  Dor = "dor",
  Phrygian = "phrygian",
  Phr = "phr",
  Lydian = "lydian",
  Lyd = "lyd",
  Mixolydian = "mixolydian",
  Mix = "mix",
  Locrian = "locrian",
  Loc = "loc",
}

export enum NoteHeadStyle {
  Normal = "normal",
  Harmonic = "harmonic",
  Rhythm = "rhythm",
  X = "x",
  Triangle = "triangle",
}

export enum Decorations {
  Trill = "trill",
  LowerMordent = "lowermordent",
  UpperMordent = "uppermordent",
  Mordent = "mordent",
  Pralltriller = "pralltriller",
  Accent = "accent",
  Fermata = "fermata",
  InvertedFermata = "invertedfermata",
  Tenuto = "tenuto",
  Staccato = "staccato",
  Upbow = "upbow",
  Downbow = "downbow",
  Open = "open",
  Thumb = "thumb",
  Snap = "snap",
  Turn = "turn",
  Roll = "roll",
  IrishRoll = "irishroll",
  Breath = "breath",
  ShortPhrase = "shortphrase",
  MediumPhrase = "mediumphrase",
  LongPhrase = "longphrase",
  Segno = "segno",
  Coda = "coda",
  DS = "D.S.",
  DC = "D.C.",
  Fine = "fine",
  CrescendoStart = "crescendo(",
  CrescendoEnd = "crescendo)",
  DiminuendoStart = "diminuendo(",
  DiminuendoEnd = "diminuendo)",
  P = "p",
  PP = "pp",
  F = "f",
  FF = "ff",
  MF = "mf",
  MP = "mp",
  PPP = "ppp",
  PPPP = "pppp",
  FFF = "fff",
  FFFF = "ffff",
  SFZ = "sfz",
  Slide = "slide",
  Wedge = "wedge",
  Plus = "+",
  Zero = "0",
  One = "1",
  Two = "2",
  Three = "3",
  Four = "4",
  Five = "5",
  RepeatBar = "repeatbar",
  RepeatBar2 = "repeatbar2",
  Trem1 = "trem1",
  Trem2 = "trem2",
  Trem3 = "trem3",
  Trem4 = "trem4",
  Slash = "/",
  DoubleSlash = "//",
  TripleSlash = "///",
  QuadSlash = "////",
  TurnX = "turnx",
  InvertedTurn = "invertedturn",
  InvertedTurnX = "invertedturnx",
  Arpeggio = "arpeggio",
  TrillStart = "trill(",
  TrillEnd = "trill)",
  XStem = "xstem",
  Mark = "mark",
  Marcato = "marcato",
  UMarcato = "umarcato",
  DCAlCoda = "D.C.alcoda",
  DCAlFine = "D.C.alfine",
  DSAlCoda = "D.S.alcoda",
  DSAlFine = "D.S.alfine",
  Editorial = "editorial",
  Courtesy = "courtesy",
}

export enum ElementType {
  Note = "note",
  Bar = "bar",
  Clef = "clef",
  Key = "key",
  Meter = "meter",
  Tempo = "tempo",
  Part = "part",
  Scale = "scale",
  Stem = "stem",
  Style = "style",
  Color = "color",
  Transpose = "transpose",
  Overlay = "overlay",
}

// ============================================================================
// Core Structures
// ============================================================================

export interface CharRange {
  startChar: number;
  endChar: number;
}

export interface MeterFraction {
  num: number;
  den?: number;
}

export enum FontWeight {
  Normal = "normal",
  Bold = "bold",
}

export enum FontStyle {
  Normal = "normal",
  Italic = "italic",
}

export enum FontDecoration {
  None = "none",
  Underline = "underline",
}

export interface Font {
  face: string;
  size: number;
  weight: FontWeight;
  style: FontStyle;
  decoration: FontDecoration;
}

// ============================================================================
// Musical Properties
// ============================================================================

export interface ClefProperties {
  type: ClefType;
  verticalPos: number;
  clefPos?: number;
  transpose?: number;
  stafflines?: number;
  staffscale?: number;
}

export interface Accidental {
  acc: AccidentalType;
  note: NoteLetter;
  verticalPos: number;
}

export interface KeySignature {
  root: KeyRoot;
  acc: KeyAccidental;
  mode: Mode;
  accidentals: Accidental[];
  impliedNaturals?: Accidental[];
  explicitAccidentals?: Accidental[];
}

export interface Meter {
  type: MeterType;
  value?: MeterFraction[];
  beat_division?: MeterFraction[];
}

export interface TempoProperties {
  duration?: number[];
  bpm?: number;
  preString?: string;
  postString?: string;
  suppress?: boolean;
  suppressBpm?: boolean;
}

export interface RestProperties {
  type: RestType;
}

export interface ChordProperties {
  name: string;
  chord: {
    root: string;
    type: string;
  };
  position?: ChordPlacement;
  rel_position?: {
    x: number;
    y: number;
  };
}

export enum LyricDivider {
  Space = " ",
  Hyphen = "-",
  Underscore = "_",
}

export interface LyricProperties {
  syllable: string;
  divider: LyricDivider;
}

export enum SlurStyle {
  Dotted = "dotted",
}

export interface SlurProperties {
  label?: number;
  style?: SlurStyle;
}

// ============================================================================
// Pitch and Note Properties
// ============================================================================

export interface Pitch {
  pitch: number; // Vertical position (0 = middle C)
  name: string; // Note name with accidentals (e.g., "^F", "_B")
  verticalPos: number; // Staff position relative to clef
  accidental?: AccidentalType;
  highestVert?: number; // For chord spacing
  startTie?: object;
  endTie?: object;
  startSlur?: SlurProperties[];
  endSlur?: number[];
}

export interface GraceNote {
  pitch: number;
  name: string;
  duration: number;
  verticalPos: number;
  accidental?: AccidentalType;
  startSlur?: number;
  endSlur?: number[];
}

export interface MidiPitch {
  instrument: number;
  pitch: number;
  duration: number;
  volume: number;
  cents?: number;
  start: number;
  gap: number;
}

export interface MidiGracePitch {
  instrument: number;
  pitch: number;
  volume: number;
  cents?: number;
  durationInMeasures: number;
}

// ============================================================================
// Element Types
// ============================================================================

export interface BaseElement extends CharRange {
  el_type: ElementType;
}

export interface NoteElement extends BaseElement {
  el_type: ElementType.Note;
  duration: Rational;
  pitches?: Pitch[];
  rest?: RestProperties;
  gracenotes?: GraceNote[];
  chord?: ChordProperties[];
  lyric?: LyricProperties[];
  decoration?: Decorations[];
  startBeam?: boolean;
  endBeam?: boolean;
  startTriplet?: number;
  endTriplet?: boolean;
  tripletMultiplier?: number;
  startTie?: object;
  endTie?: object;
  startSlur?: number;
  endSlur?: number;
  dottedSlur?: boolean;
  midiPitches?: MidiPitch[];
  midiGraceNotePitches?: MidiGracePitch[];
}

export interface BarElement extends BaseElement {
  el_type: ElementType.Bar;
  type: BarType;
  startEnding?: string;
  endEnding?: boolean;
  barNumber?: number;
}

export interface ClefElement extends BaseElement {
  el_type: ElementType.Clef;
  type: ClefType;
  verticalPos: number;
  clefPos?: number;
  transpose?: number;
  stafflines?: number;
  staffscale?: number;
}

export interface KeyElement extends BaseElement {
  el_type: ElementType.Key;
  root: KeyRoot;
  acc: KeyAccidental;
  mode: Mode;
  accidentals: Accidental[];
  impliedNaturals?: Accidental[];
  explicitAccidentals?: Accidental[];
}

export interface MeterElement extends BaseElement {
  el_type: ElementType.Meter;
  type: MeterType;
  value?: MeterFraction[];
  beat_division?: MeterFraction[];
}

export interface TempoElement extends BaseElement {
  el_type: ElementType.Tempo;
  duration?: number[];
  bpm?: number;
  preString?: string;
  postString?: string;
  suppress?: boolean;
  suppressBpm?: boolean;
}

export interface PartElement extends BaseElement {
  el_type: ElementType.Part;
  title: string;
}

export interface ScaleElement extends BaseElement {
  el_type: ElementType.Scale;
  size: number;
}

export interface StemElement extends BaseElement {
  el_type: ElementType.Stem;
  direction: StemDirection;
}

export interface StyleElement extends BaseElement {
  el_type: ElementType.Style;
  head: NoteHeadStyle;
}

export interface ColorElement extends BaseElement {
  el_type: ElementType.Color;
  color: string;
}

export interface TransposeElement extends BaseElement {
  el_type: ElementType.Transpose;
  transpose: number;
}

export interface OverlayElement extends BaseElement {
  el_type: ElementType.Overlay;
}

export type VoiceElement =
  | NoteElement
  | BarElement
  | ClefElement
  | KeyElement
  | MeterElement
  | TempoElement
  | PartElement
  | ScaleElement
  | StemElement
  | StyleElement
  | ColorElement
  | TransposeElement
  | OverlayElement;

// ============================================================================
// Staff and Voice Structure
// ============================================================================

export interface Staff {
  clef: ClefProperties;
  key: KeySignature;
  meter?: Meter;
  workingClef: ClefProperties;
  voices: VoiceElement[][];
  title?: string[];
  bracket?: object;
  brace?: object;
  connectBarLines?: boolean;
  barNumber?: number;
  spacing_below_offset?: number;
  stafflines?: number;
  staffscale?: number;
}

// ============================================================================
// Line Types
// ============================================================================

export interface MusicLine {
  staff: Staff[];
  vskip?: number;
}

export interface TextFieldProperties extends CharRange {
  text: string;
  font?: Font;
  center?: boolean;
}

export interface SubtitleLine {
  subtitle: TextFieldProperties;
}

export interface TextLine {
  text: TextFieldProperties[];
}

export interface SeparatorLine extends CharRange {
  separator: {
    spaceAbove: number;
    spaceBelow: number;
    lineLength: number;
  };
}

export interface NewPageLine {
  newpage: number;
}

export type Line = MusicLine | SubtitleLine | TextLine | SeparatorLine | NewPageLine;

// ============================================================================
// Main Tune Structure
// ============================================================================

export interface MetaText {
  title?: string | TextFieldProperties[];
  composer?: string | TextFieldProperties[];
  author?: string | TextFieldProperties[];
  rhythm?: string;
  origin?: string;
  book?: string;
  source?: string;
  discography?: string;
  notes?: string;
  transcription?: string;
  history?: string;
  "abc-copyright"?: string;
  "abc-creator"?: string;
  "abc-edited-by"?: string;
  footer?: string;
  header?: string;
  tempo?: TempoProperties;
  partOrder?: string;
  unalignedWords?: string;
}

export enum MediaType {
  Screen = "screen",
  Print = "print",
}

export interface Tune {
  version: string;
  media: MediaType;
  metaText: MetaText;
  metaTextInfo: { [key: string]: CharRange };
  formatting: { [key: string]: any };
  lines: Line[];
  staffNum: number;
  voiceNum: number;
  lineNum: number;
  visualTranspose?: number;

  // Methods
  getBeatLength(): number;
  getPickupLength(): number;
  getBarLength(): number;
  getTotalTime(): number;
  getTotalBeats(): number;
  millisecondsPerMeasure(bpmOverride?: number): number;
  getBeatsPerMeasure(): number;
  getMeter(): Meter;
  getMeterFraction(): MeterFraction;
  getKeySignature(): KeySignature;
  getElementFromChar(char: number): VoiceElement | null;
  getBpm(tempo?: TempoProperties): number;
  setTiming(bpm?: number, measuresOfDelay?: number): any[];
  setUpAudio(options?: any): any;
  deline(options?: any): any;
  findSelectableElement(target: any): any;
  getSelectableArray(): any[];
}

// ============================================================================
// Parser Output Type
// ============================================================================

export interface ParseResult {
  tune: Tune;
  warnings?: string[];
}

// ============================================================================
// Utility Types
// ============================================================================

export type MusicElement = VoiceElement;
export type Voice = VoiceElement[];
export type StaffArray = Staff[];
export type LineArray = Line[];

// ============================================================================
// Type Guards
// ============================================================================

export function isNoteElement(element: VoiceElement): element is NoteElement {
  return element.el_type === ElementType.Note;
}

export function isBarElement(element: VoiceElement): element is BarElement {
  return element.el_type === ElementType.Bar;
}

export function isClefElement(element: VoiceElement): element is ClefElement {
  return element.el_type === ElementType.Clef;
}

export function isKeyElement(element: VoiceElement): element is KeyElement {
  return element.el_type === ElementType.Key;
}

export function isMeterElement(element: VoiceElement): element is MeterElement {
  return element.el_type === ElementType.Meter;
}

export function isTempoElement(element: VoiceElement): element is TempoElement {
  return element.el_type === ElementType.Tempo;
}

export function isMusicLine(line: Line): line is MusicLine {
  return "staff" in line;
}

export function isTextLine(line: Line): line is TextLine {
  return "text" in line;
}

export function isSubtitleLine(line: Line): line is SubtitleLine {
  return "subtitle" in line;
}
