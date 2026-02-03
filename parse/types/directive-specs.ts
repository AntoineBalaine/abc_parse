/**
 * ABC Directive Validation Rules and Semantic Types
 *
 * This file provides:
 * 1. Validation rules for each directive type
 * 2. Tagged union types for semantic analysis results
 * 3. Type-safe semantic data structures
 *
 * Based on analysis of abcjs parser implementation
 */

import { IRational } from "../Visitors/fmt2/rational";

export interface FontSpec {
  face?: string;
  size?: number;
  weight?: "normal" | "bold";
  style?: "normal" | "italic";
  decoration?: "none" | "underline";
  box?: boolean;
}

export interface MeasurementSpec {
  value: number;
  unit?: "pt" | "in" | "cm" | "mm";
}

export interface MidiSpec {
  command: string;
  params: (string | number | IRational)[];
}

export interface PercMapSpec {
  note: string;
  sound: number | string;
  noteHead?: string;
}

export interface AbclsDirectiveData {
  mode: "show" | "hide";
  voiceIds: string[];
}

export interface StaffLayoutSpec {
  voices: string[];
  bracket?: "start" | "continue" | "end";
  brace?: "start" | "continue" | "end";
  connectBarLines?: boolean;
}

/**
 * Parameter Type Specifications
 */
export type ParamType =
  | "identifier" // Simple identifier token
  | "annotation" // Quoted string
  | "number" // Integer or float
  | "measurement" // Number with unit (8.5in, 21cm, 72pt)
  | "rational" // Fraction (3/4, 1/8)
  | "pitch" // ABC note (C, ^F, _B)
  | "font_face" // Font name (can be quoted)
  | "font_modifier" // bold, italic, underline
  | "position_choice" // auto, above, below, hidden
  | "boolean" // 0/1, true/false
  | "midi_command" // MIDI command name
  | "midi_param" // MIDI parameter (varies by command)
  | "staff_layout" // Voice layout with grouping symbols
  | "kv_pair" // Key-value pair (octave=2)
  | "text_block" // Multi-line text content
  | "tab_separated" // Tab-separated values for header/footer
  | "drum_sound" // Drum sound name or MIDI number
  | "postscript_block"; // PostScript code block

export interface ParamSpec {
  type: ParamType;
  optional?: boolean;
  multiple?: boolean; // Can appear multiple times
  choices?: string[]; // Enumerated choices
  min?: number; // Minimum value for numbers
  max?: number; // Maximum value for numbers
}

/**
 * Reusable Parameter Specifications
 */

/**
 * Base font parameters (face, size, modifiers)
 */
const FONT_PARAMS: ParamSpec[] = [
  { type: "font_face", optional: true },
  { type: "number", optional: true },
  { type: "font_modifier", optional: true, multiple: true, choices: ["bold", "italic", "underline"] },
];

// Box parameter for font directives that support it
const BOX_PARAM: ParamSpec = { type: "identifier", optional: true, choices: ["box"] };

/**
 * Position choice parameter
 */
const POSITION_CHOICE_PARAM: ParamSpec = { type: "position_choice", choices: ["auto", "above", "below", "hidden"] };

/**
 * Directive Validation Rules
 */
export const DIRECTIVE_SPECS: Record<string, { params: ParamSpec[] }> = {
  // Font Directives with Box Support
  titlefont: { params: [...FONT_PARAMS, BOX_PARAM] },
  gchordfont: { params: [...FONT_PARAMS, BOX_PARAM] },
  composerfont: { params: [...FONT_PARAMS, BOX_PARAM] },
  subtitlefont: { params: [...FONT_PARAMS, BOX_PARAM] },
  voicefont: { params: [...FONT_PARAMS, BOX_PARAM] },
  partsfont: { params: [...FONT_PARAMS, BOX_PARAM] },
  textfont: { params: [...FONT_PARAMS, BOX_PARAM] },
  annotationfont: { params: [...FONT_PARAMS, BOX_PARAM] },
  historyfont: { params: [...FONT_PARAMS, BOX_PARAM] },
  infofont: { params: [...FONT_PARAMS, BOX_PARAM] },
  measurefont: { params: [...FONT_PARAMS, BOX_PARAM] },
  barlabelfont: { params: [...FONT_PARAMS, BOX_PARAM] },
  barnumberfont: { params: [...FONT_PARAMS, BOX_PARAM] },
  barnumfont: { params: [...FONT_PARAMS, BOX_PARAM] },

  // Font Directives without Box Support
  tempofont: { params: FONT_PARAMS },
  footerfont: { params: FONT_PARAMS },
  headerfont: { params: FONT_PARAMS },
  tripletfont: { params: FONT_PARAMS },
  vocalfont: { params: FONT_PARAMS },
  repeatfont: { params: FONT_PARAMS },
  wordsfont: { params: FONT_PARAMS },
  tablabelfont: { params: FONT_PARAMS },
  tabnumberfont: { params: FONT_PARAMS },
  tabgracefont: { params: FONT_PARAMS },

  // Layout and Formatting Directives (Boolean flags)
  bagpipes: { params: [] },
  flatbeams: { params: [] },
  jazzchords: { params: [] },
  accentAbove: { params: [] },
  germanAlphabet: { params: [] },
  landscape: { params: [] },
  titlecaps: { params: [] },
  titleleft: { params: [] },
  measurebox: { params: [] },
  continueall: { params: [] },

  // Simple Parameter Directives
  papersize: { params: [{ type: "identifier" }] },
  graceslurs: { params: [{ type: "boolean" }] },
  linear: { params: [{ type: "boolean" }] },
  lineThickness: { params: [{ type: "number" }] },
  stretchlast: { params: [{ type: "number", optional: true, min: 0, max: 1 }] },

  // Position Directives
  vocal: { params: [POSITION_CHOICE_PARAM] },
  dynamic: { params: [POSITION_CHOICE_PARAM] },
  gchord: { params: [POSITION_CHOICE_PARAM] },
  ornament: { params: [POSITION_CHOICE_PARAM] },
  volume: { params: [POSITION_CHOICE_PARAM] },

  // Margin and Spacing Directives
  botmargin: { params: [{ type: "measurement" }] },
  botspace: { params: [{ type: "measurement" }] },
  composerspace: { params: [{ type: "measurement" }] },
  indent: { params: [{ type: "measurement" }] },
  leftmargin: { params: [{ type: "measurement" }] },
  linesep: { params: [{ type: "measurement" }] },
  musicspace: { params: [{ type: "measurement" }] },
  partsspace: { params: [{ type: "measurement" }] },
  pageheight: { params: [{ type: "measurement" }] },
  pagewidth: { params: [{ type: "measurement" }] },
  rightmargin: { params: [{ type: "measurement" }] },
  stafftopmargin: { params: [{ type: "measurement" }] },
  staffsep: { params: [{ type: "measurement" }] },
  staffwidth: { params: [{ type: "measurement" }] },
  subtitlespace: { params: [{ type: "measurement" }] },
  sysstaffsep: { params: [{ type: "measurement" }] },
  systemsep: { params: [{ type: "measurement" }] },
  textspace: { params: [{ type: "measurement" }] },
  titlespace: { params: [{ type: "measurement" }] },
  topmargin: { params: [{ type: "measurement" }] },
  topspace: { params: [{ type: "measurement" }] },
  vocalspace: { params: [{ type: "measurement" }] },
  wordsspace: { params: [{ type: "measurement" }] },
  fontboxpadding: { params: [{ type: "number" }] },

  // Voice-Specific Directives
  voicescale: { params: [{ type: "number" }] },
  voicecolor: { params: [{ type: "identifier" }] },

  // Page and Layout Control
  vskip: { params: [{ type: "measurement" }] },
  scale: { params: [{ type: "number" }] },
  sep: {
    params: [
      { type: "measurement", optional: true },
      { type: "measurement", optional: true },
      { type: "measurement", optional: true },
    ],
  },
  barsperstaff: { params: [{ type: "number", min: 1 }] },
  staffnonote: { params: [{ type: "boolean" }] },
  printtempo: { params: [{ type: "boolean" }] },
  partsbox: { params: [{ type: "boolean" }] },
  freegchord: { params: [{ type: "boolean" }] },
  measurenb: { params: [{ type: "number", min: 0 }] },
  barnumbers: { params: [{ type: "number", min: 0 }] },
  setbarnb: { params: [{ type: "number", min: 1 }] },

  // Text and Content Directives
  begintext: { params: [{ type: "text_block" }] },
  endtext: { params: [] },
  text: { params: [{ type: "annotation" }] },
  center: { params: [{ type: "annotation" }] },
  font: { params: [] },
  setfont: {
    params: [
      { type: "identifier" }, // -N format
      ...FONT_PARAMS,
    ],
  },

  // Staff and Score Organization
  staves: { params: [{ type: "staff_layout" }] },
  score: { params: [{ type: "staff_layout" }] },

  // Page Control
  newpage: { params: [{ type: "number", optional: true }] },

  // Metadata Directives
  "abc-copyright": { params: [{ type: "annotation" }] },
  "abc-creator": { params: [{ type: "annotation" }] },
  "abc-edited-by": { params: [{ type: "annotation" }] },
  "abc-version": { params: [{ type: "annotation" }] },
  "abc-charset": { params: [{ type: "annotation" }] },
  header: { params: [{ type: "tab_separated" }] },
  footer: { params: [{ type: "tab_separated" }] },

  // PostScript Directives
  beginps: { params: [] },
  endps: { params: [] },
  deco: { params: [{ type: "identifier" }, { type: "postscript_block", optional: true }] },

  // Percussion Mapping
  percmap: {
    params: [
      { type: "identifier" }, // ABC note
      { type: "drum_sound" }, // MIDI number or drum name
      { type: "identifier", optional: true }, // note head
    ],
  },

  // MIDI Directives
  midi: {
    params: [{ type: "midi_command" }, { type: "midi_param", optional: true, multiple: true }],
  },

  // Miscellaneous Directives
  map: { params: [{ type: "identifier" }] },
  playtempo: { params: [{ type: "identifier" }] },
  auquality: { params: [{ type: "identifier" }] },
  continuous: { params: [{ type: "identifier" }] },
  nobarcheck: { params: [] },

  // ABC Language Server Directives
  abcls: {
    params: [
      { type: "identifier" }, // mode: show | hide
      { type: "identifier", multiple: true }, // voice IDs
    ],
  },
};

/**
 * MIDI Command Specifications
 */
export const MIDI_COMMAND_SPECS: Record<string, { params: ParamSpec[] }> = {
  // No parameters
  nobarlines: { params: [] },
  barlines: { params: [] },
  beataccents: { params: [] },
  nobeataccents: { params: [] },
  droneon: { params: [] },
  droneoff: { params: [] },
  drumon: { params: [] },
  drumoff: { params: [] },
  fermatafixed: { params: [] },
  fermataproportional: { params: [] },
  gchordon: { params: [] },
  gchordoff: { params: [] },
  controlcombo: { params: [] },
  temperamentnormal: { params: [] },
  noportamento: { params: [] },

  // One string parameter
  gchord: { params: [{ type: "identifier" }] },
  ptstress: { params: [{ type: "identifier" }] },
  beatstring: { params: [{ type: "identifier" }] },

  // One integer parameter
  bassvol: { params: [{ type: "number" }] },
  chordvol: { params: [{ type: "number" }] },
  c: { params: [{ type: "number" }] },
  channel: { params: [{ type: "number" }] },
  beatmod: { params: [{ type: "number" }] },
  deltaloudness: { params: [{ type: "number" }] },
  drumbars: { params: [{ type: "number" }] },
  gracedivider: { params: [{ type: "number" }] },
  makechordchannels: { params: [{ type: "number" }] },
  randomchordattack: { params: [{ type: "number" }] },
  chordattack: { params: [{ type: "number" }] },
  stressmodel: { params: [{ type: "number" }] },
  transpose: { params: [{ type: "number" }] },
  rtranspose: { params: [{ type: "number" }] },
  vol: { params: [{ type: "number" }] },
  volinc: { params: [{ type: "number" }] },
  gchordbars: { params: [{ type: "number" }] },

  // One integer, one optional integer
  program: {
    params: [{ type: "number" }, { type: "number", optional: true }],
  },

  // Two integers
  ratio: { params: [{ type: "number" }, { type: "number" }] },
  snt: { params: [{ type: "number" }, { type: "number" }] },
  bendvelocity: { params: [{ type: "number" }, { type: "number" }] },
  pitchbend: { params: [{ type: "number" }, { type: "number" }] },
  control: { params: [{ type: "number" }, { type: "number" }] },
  temperamentlinear: { params: [{ type: "number" }, { type: "number" }] },

  // Four integers
  beat: {
    params: [{ type: "number" }, { type: "number" }, { type: "number" }, { type: "number" }],
  },

  // Five integers
  drone: {
    params: [{ type: "number" }, { type: "number" }, { type: "number" }, { type: "number" }, { type: "number" }],
  },

  // String and integer
  portamento: { params: [{ type: "identifier" }, { type: "number" }] },

  // Fraction
  expand: { params: [{ type: "rational" }] },
  grace: { params: [{ type: "rational" }] },
  trim: { params: [{ type: "rational" }] },

  // String and variable integers
  drum: {
    params: [{ type: "identifier" }, { type: "number", multiple: true }],
  },
  chordname: {
    params: [{ type: "identifier" }, { type: "number", multiple: true }],
  },

  // Integer and optional string (with octave= syntax)
  bassprog: {
    params: [
      { type: "number" },
      { type: "kv_pair", optional: true }, // octave=N
    ],
  },
  chordprog: {
    params: [
      { type: "number" },
      { type: "kv_pair", optional: true }, // octave=N
    ],
  },

  // Special drummap case
  drummap: {
    params: [
      { type: "identifier" }, // ABC note
      { type: "drum_sound" }, // MIDI number or drum name
    ],
  },
};

export const FontDirectiveNames = Object.keys(DIRECTIVE_SPECS).filter((key) => key.endsWith("font"));

/**
 * Tagged Union Types for Semantic Data
 */

/**
 * Extract the type field from the discriminated union
 */
export type DirectiveType = DirectiveSemanticData["type"];

export type DirectiveSemanticData =
  // Font directives
  | { type: "titlefont"; data: FontSpec }
  | { type: "gchordfont"; data: FontSpec }
  | { type: "composerfont"; data: FontSpec }
  | { type: "subtitlefont"; data: FontSpec }
  | { type: "tempofont"; data: FontSpec }
  | { type: "footerfont"; data: FontSpec }
  | { type: "headerfont"; data: FontSpec }
  | { type: "voicefont"; data: FontSpec }
  | { type: "partsfont"; data: FontSpec }
  | { type: "tripletfont"; data: FontSpec }
  | { type: "vocalfont"; data: FontSpec }
  | { type: "textfont"; data: FontSpec }
  | { type: "annotationfont"; data: FontSpec }
  | { type: "historyfont"; data: FontSpec }
  | { type: "infofont"; data: FontSpec }
  | { type: "measurefont"; data: FontSpec }
  | { type: "repeatfont"; data: FontSpec }
  | { type: "wordsfont"; data: FontSpec }
  | { type: "tablabelfont"; data: FontSpec }
  | { type: "tabnumberfont"; data: FontSpec }
  | { type: "tabgracefont"; data: FontSpec }
  | { type: "barlabelfont"; data: FontSpec }
  | { type: "barnumberfont"; data: FontSpec }
  | { type: "barnumfont"; data: FontSpec }

  // Boolean directives
  | { type: "bagpipes"; data: true }
  | { type: "flatbeams"; data: true }
  | { type: "jazzchords"; data: true }
  | { type: "accentAbove"; data: true }
  | { type: "germanAlphabet"; data: true }
  | { type: "landscape"; data: true }
  | { type: "titlecaps"; data: true }
  | { type: "titleleft"; data: true }
  | { type: "measurebox"; data: true }
  | { type: "continueall"; data: true }
  | { type: "endtext"; data: true }
  | { type: "beginps"; data: true }
  | { type: "endps"; data: true }
  | { type: "font"; data: true }
  | { type: "nobarcheck"; data: true }

  // String directives
  | { type: "papersize"; data: string }
  | { type: "text"; data: string }
  | { type: "center"; data: string }
  | { type: "begintext"; data: string }
  | { type: "abc-copyright"; data: string }
  | { type: "abc-creator"; data: string }
  | { type: "abc-edited-by"; data: string }
  | { type: "abc-version"; data: string }
  | { type: "abc-charset"; data: string }
  | { type: "map"; data: string }
  | { type: "playtempo"; data: string }
  | { type: "auquality"; data: string }
  | { type: "continuous"; data: string }

  // Number directives
  | { type: "lineThickness"; data: number }
  | { type: "stretchlast"; data: number }
  | { type: "voicescale"; data: number }
  | { type: "scale"; data: number }
  | { type: "barsperstaff"; data: number }
  | { type: "measurenb"; data: number }
  | { type: "barnumbers"; data: number }
  | { type: "setbarnb"; data: number }
  | { type: "newpage"; data: number | null }
  | { type: "fontboxpadding"; data: number }

  // Boolean value directives
  | { type: "graceslurs"; data: boolean }
  | { type: "linear"; data: boolean }
  | { type: "staffnonote"; data: boolean }
  | { type: "printtempo"; data: boolean }
  | { type: "partsbox"; data: boolean }
  | { type: "freegchord"; data: boolean }

  // Position directives
  | { type: "vocal"; data: "auto" | "above" | "below" | "hidden" }
  | { type: "dynamic"; data: "auto" | "above" | "below" | "hidden" }
  | { type: "gchord"; data: "auto" | "above" | "below" | "hidden" }
  | { type: "ornament"; data: "auto" | "above" | "below" | "hidden" }
  | { type: "volume"; data: "auto" | "above" | "below" | "hidden" }

  // Measurement directives
  | { type: "botmargin"; data: MeasurementSpec }
  | { type: "botspace"; data: MeasurementSpec }
  | { type: "composerspace"; data: MeasurementSpec }
  | { type: "indent"; data: MeasurementSpec }
  | { type: "leftmargin"; data: MeasurementSpec }
  | { type: "linesep"; data: MeasurementSpec }
  | { type: "musicspace"; data: MeasurementSpec }
  | { type: "partsspace"; data: MeasurementSpec }
  | { type: "pageheight"; data: MeasurementSpec }
  | { type: "pagewidth"; data: MeasurementSpec }
  | { type: "rightmargin"; data: MeasurementSpec }
  | { type: "stafftopmargin"; data: MeasurementSpec }
  | { type: "staffsep"; data: MeasurementSpec }
  | { type: "staffwidth"; data: MeasurementSpec }
  | { type: "subtitlespace"; data: MeasurementSpec }
  | { type: "sysstaffsep"; data: MeasurementSpec }
  | { type: "systemsep"; data: MeasurementSpec }
  | { type: "textspace"; data: MeasurementSpec }
  | { type: "titlespace"; data: MeasurementSpec }
  | { type: "topmargin"; data: MeasurementSpec }
  | { type: "topspace"; data: MeasurementSpec }
  | { type: "vocalspace"; data: MeasurementSpec }
  | { type: "wordsspace"; data: MeasurementSpec }
  | { type: "vskip"; data: MeasurementSpec }

  // Complex directives
  | { type: "voicecolor"; data: string }
  | { type: "sep"; data: { above?: number; below?: number; length?: number } }
  | { type: "setfont"; data: { number: number; font: FontSpec } }
  | { type: "staves"; data: StaffLayoutSpec[] }
  | { type: "score"; data: StaffLayoutSpec[] }
  | { type: "header"; data: { left: string; center: string; right: string } }
  | { type: "footer"; data: { left: string; center: string; right: string } }
  | { type: "midi"; data: MidiSpec }
  | { type: "percmap"; data: PercMapSpec }
  | { type: "deco"; data: { name: string; definition?: string } }
  | { type: "abcls"; data: AbclsDirectiveData };

// ============================================================================
// Drum Sound Names (MIDI notes 35-81)
// ============================================================================

export const DRUM_SOUND_NAMES = [
  "acoustic-bass-drum",
  "bass-drum-1",
  "side-stick",
  "acoustic-snare",
  "hand-clap",
  "electric-snare",
  "low-floor-tom",
  "closed-hi-hat",
  "high-floor-tom",
  "pedal-hi-hat",
  "low-tom",
  "open-hi-hat",
  "low-mid-tom",
  "hi-mid-tom",
  "crash-cymbal-1",
  "high-tom",
  "ride-cymbal-1",
  "chinese-cymbal",
  "ride-bell",
  "tambourine",
  "splash-cymbal",
  "cowbell",
  "crash-cymbal-2",
  "vibraslap",
  "ride-cymbal-2",
  "hi-bongo",
  "low-bongo",
  "mute-hi-conga",
  "open-hi-conga",
  "low-conga",
  "high-timbale",
  "low-timbale",
  "high-agogo",
  "low-agogo",
  "cabasa",
  "maracas",
  "short-whistle",
  "long-whistle",
  "short-guiro",
  "long-guiro",
  "claves",
  "hi-wood-block",
  "low-wood-block",
  "mute-cuica",
  "open-cuica",
  "mute-triangle",
  "open-triangle",
] as const;

export type DrumSoundName = (typeof DRUM_SOUND_NAMES)[number];

export function isValidDirective(name: string): name is DirectiveType {
  return name in DIRECTIVE_SPECS;
}

export function isValidMidiCommand(command: string): boolean {
  return command in MIDI_COMMAND_SPECS;
}

export function isValidDrumSound(sound: string): boolean {
  if (!isNaN(Number(sound))) {
    const num = Number(sound);
    return num >= 35 && num <= 81;
  }
  return DRUM_SOUND_NAMES.includes(sound as DrumSoundName);
}

export function getDirectiveSpec(name: string): { params: ParamSpec[] } | undefined {
  return DIRECTIVE_SPECS[name];
}

export function getMidiCommandSpec(command: string): { params: ParamSpec[] } | undefined {
  return MIDI_COMMAND_SPECS[command];
}

// export function isFontDirective(data: DirectiveSemanticData): data is { type: string; data: FontSpec } {
//   return data.type.endsWith("font");
// }

// export function isMeasurementDirective(data: DirectiveSemanticData): data is { type: string; data: MeasurementSpec } {
//   const measurementTypes = [
//     "botmargin",
//     "botspace",
//     "composerspace",
//     "indent",
//     "leftmargin",
//     "linesep",
//     "musicspace",
//     "partsspace",
//     "pageheight",
//     "pagewidth",
//     "rightmargin",
//     "stafftopmargin",
//     "staffsep",
//     "staffwidth",
//     "subtitlespace",
//     "sysstaffsep",
//     "systemsep",
//     "textspace",
//     "titlespace",
//     "topmargin",
//     "topspace",
//     "vocalspace",
//     "wordsspace",
//     "vskip",
//   ];
//   return measurementTypes.includes(data.type);
// }

// export function isMidiDirective(data: DirectiveSemanticData): data is { type: "midi"; data: MidiSpec } {
//   return data.type === "midi";
// }

// export function isBooleanDirective(data: DirectiveSemanticData): data is { type: string; data: boolean | true } {
//   const booleanTypes = [
//     "bagpipes",
//     "flatbeams",
//     "jazzchords",
//     "accentAbove",
//     "germanAlphabet",
//     "landscape",
//     "titlecaps",
//     "titleleft",
//     "measurebox",
//     "continueall",
//     "begintext",
//     "endtext",
//     "beginps",
//     "endps",
//     "font",
//     "nobarcheck",
//     "graceslurs",
//     "staffnonote",
//     "printtempo",
//     "partsbox",
//     "freegchord",
//   ];
//   return booleanTypes.includes(data.type);
// }
