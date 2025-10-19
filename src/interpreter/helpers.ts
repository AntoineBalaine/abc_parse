import {
  Visitor,
  Tune,
  Tune_header,
  Tune_Body,
  Info_line,
  File_structure,
  File_header,
  Comment,
  Directive,
  Music_code,
  Note,
  Rest,
  Chord,
  BarLine,
  Grace_group,
  Decoration,
  Symbol,
  Beam,
  Tuplet,
  Annotation,
  Inline_field,
  MultiMeasureRest,
  YSPACER,
  Voice_overlay,
  Macro_decl,
  Macro_invocation,
  User_symbol_decl,
  User_symbol_invocation,
  Lyric_line,
  Lyric_section,
  Pitch,
  Rhythm,
  ErrorExpr,
  KV,
  AbsolutePitch,
  Binary,
  Grouping,
  Measurement,
  Rational,
} from "../types/Expr2";
import { Token } from "../parsers/scan2";
import { ABCContext } from "../parsers/Context";
import {
  Tune as ABCJSTune,
  MusicLine,
  Staff,
  VoiceElement,
  NoteElement,
  BarElement,
  MediaType,
  MeterType,
  RestType,
  BarType,
  ElementType,
} from "../types/abcjs-ast";
import {
  InterpreterContext,
  createInterpreterContext,
  setDefaultKey,
  setDefaultMeter,
  setCurrentVoice,
  addVoice,
  getCurrentVoice,
  nextMeasure,
} from "./InterpreterContext";
import { createRational, IRational } from "../Visitors/fmt2/rational";

// Process info lines

// Helper methods
function calculateNoteDuration(rhythm: Rhythm | undefined, ctx: InterpreterContext): IRational {
  if (!rhythm) {
    // Use default note length
    return ctx.defaultNoteLength;
  }

  // TODO: Calculate duration from rhythm
  return ctx.defaultNoteLength;
}

function determineBarType(barTokens: Token[]): BarType {
  const barString = barTokens.map((t) => t.lexeme).join("");

  // Map ABC bar notations to ABCJS bar types
  switch (barString) {
    case "|":
      return BarType.BarThin;
    case "||":
      return BarType.BarThinThin;
    case "|:":
      return BarType.BarLeftRepeat;
    case ":|":
      return BarType.BarRightRepeat;
    case "::":
      return BarType.BarDblRepeat;
    default:
      return BarType.BarThin;
  }
}

function getBasePitch(noteLetter: string): number {
  const pitches: { [key: string]: number } = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11,
    c: 12,
    d: 14,
    e: 16,
    f: 17,
    g: 19,
    a: 21,
    b: 23,
  };
  return pitches[noteLetter] || 0;
}

function getOctaveOffset(octave: string): number {
  // Handle octave indicators like ', ,, etc.
  if (octave.includes(",")) {
    return -12 * octave.length;
  } else if (octave.includes("'")) {
    return 12 * octave.length;
  }
  return 0;
}

function calculateVerticalPos(noteLetter: string, octave?: string): number {
  // Simplified vertical position calculation
  const basePos = getBasePitch(noteLetter);
  const octaveOffset = octave ? getOctaveOffset(octave) : 0;
  return Math.floor((basePos + octaveOffset) / 2);
}

function convertAccidental(accidental: string): string {
  switch (accidental) {
    case "^":
      return "sharp";
    case "_":
      return "flat";
    case "=":
      return "natural";
    case "^^":
      return "dblsharp";
    case "__":
      return "dblflat";
    default:
      return "natural";
  }
}
