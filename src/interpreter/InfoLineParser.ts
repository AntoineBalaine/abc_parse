import { Info_line } from "../types/Expr2";
import { Token } from "../parsers/scan2";
import { Rational, createRational } from "../Visitors/fmt2/rational";
import {
  KeySignature,
  Meter,
  MeterFraction,
  ClefProperties,
  TempoProperties,
  KeyRoot,
  KeyAccidental,
  Mode,
  ClefType,
  MeterType,
  Accidental,
  AccidentalType,
  BracketBracePosition,
  AccidentalSymbol,
  ModeInput,
  StemDirection,
  ChordPlacement,
} from "../../abcjs-ast";

export interface VoiceProperties {
  name?: string;
  clef?: ClefProperties;
  transpose?: number;
  octave?: number;
  middle?: string;
  stafflines?: number;
  staffscale?: number;
  perc?: boolean;
  instrument?: number;
  merge?: boolean;
  stems?: StemDirection;
  gchord?: ChordPlacement;
  space?: number;
  bracket?: BracketBracePosition;
  brace?: BracketBracePosition;
}

/**
 * Parse a Key (K:) info line expression
 * Format: K:[key][accidentals][mode][ modifiers]
 * Examples: K:C, K:G major, K:Dm, K:F# dorian, K:C^c_b
 */
export function parseKey(infoLine: Info_line): KeySignature {
  if (infoLine.key.lexeme !== "K") {
    throw new Error(`Expected K: info line, got ${infoLine.key.lexeme}:`);
  }

  if (infoLine.value.length === 0) {
    throw new Error("Empty key signature");
  }

  const keyStr = tokensToString(infoLine.value).trim();

  // Handle special cases
  if (keyStr === "none") {
    return {
      root: KeyRoot.C,
      acc: KeyAccidental.None,
      mode: Mode.Major,
      accidentals: [],
      impliedNaturals: [],
      explicitAccidentals: [],
    };
  }

  const keyMatch = keyStr.match(
    /^([A-G])(#|b)?(?:\s*(major|minor|maj|min|m|ionian|dorian|dor|phrygian|phr|lydian|lyd|mixolydian|mix|aeolian|aeo|locrian|loc))?(.*)$/i
  );

  if (!keyMatch) {
    throw new Error(`Invalid key signature: ${keyStr}`);
  }

  const [, root, accidental = "", modeStr = "", modifiers = ""] = keyMatch;

  const keySignature: KeySignature = {
    root: root as KeyRoot,
    acc: accidental as KeyAccidental,
    mode: parseMode(modeStr),
    accidentals: parseKeyAccidentals(root, accidental),
    impliedNaturals: [],
    explicitAccidentals: parseExplicitAccidentals(modifiers.trim()),
  };

  return keySignature;
}

/**
 * Parse a Meter (M:) info line expression
 * Format: M:numerator/denominator or M:C or M:C| etc.
 * Examples: M:4/4, M:3/4, M:C, M:C|, M:6/8
 */
export function parseMeter(infoLine: Info_line): Meter {
  if (infoLine.key.lexeme !== "M") {
    throw new Error(`Expected M: info line, got ${infoLine.key.lexeme}:`);
  }

  if (infoLine.value.length === 0) {
    throw new Error("Empty meter");
  }

  const meterStr = tokensToString(infoLine.value).trim();

  // Common time signatures
  if (meterStr === "C") {
    return { type: MeterType.CommonTime };
  }
  if (meterStr === "C|") {
    return { type: MeterType.CutTime };
  }

  // Fraction format
  const fractionMatch = meterStr.match(/^(\d+)\/(\d+)$/);
  if (fractionMatch) {
    const [, num, den] = fractionMatch;
    return {
      type: MeterType.Specified,
      value: [{ num: parseInt(num), den: parseInt(den) }],
    };
  }

  // Complex meters (e.g., "2+3/8", "4/4+1/4")
  const complexMatch = meterStr.match(/^(.+)$/);
  if (complexMatch) {
    const fractions = parseComplexMeter(meterStr);
    return {
      type: MeterType.Specified,
      value: fractions,
    };
  }

  throw new Error(`Invalid meter: ${meterStr}`);
}

/**
 * Parse a Note Length (L:) info line expression
 * Format: L:1/denominator
 * Examples: L:1/8, L:1/4, L:1/16
 */
export function parseNoteLength(infoLine: Info_line): Rational {
  if (infoLine.key.lexeme !== "L") {
    throw new Error(`Expected L: info line, got ${infoLine.key.lexeme}:`);
  }

  if (infoLine.value.length === 0) {
    throw new Error("Empty note length");
  }

  const lengthStr = tokensToString(infoLine.value).trim();
  const match = lengthStr.match(/^(\d+)\/(\d+)$/);

  if (!match) {
    throw new Error(`Invalid note length: ${lengthStr}`);
  }

  const [, num, den] = match;
  return createRational(parseInt(num), parseInt(den));
}

/**
 * Parse a Voice (V:) info line expression
 * Format: V:id [name="Name"] [clef=treble] [transpose=0] etc.
 * Examples: V:1, V:T1 name="Tenor 1" clef=treble, V:B clef=bass transpose=-12
 */
export function parseVoice(infoLine: Info_line): {
  id: string;
  properties: VoiceProperties;
} {
  if (infoLine.key.lexeme !== "V") {
    throw new Error(`Expected V: info line, got ${infoLine.key.lexeme}:`);
  }

  if (infoLine.value.length === 0) {
    throw new Error("Empty voice definition");
  }

  const voiceStr = tokensToString(infoLine.value).trim();
  const parts = voiceStr.split(/\s+/);

  const id = parts[0];
  const properties: VoiceProperties = {};

  // Parse voice properties
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    const eqIndex = part.indexOf("=");

    if (eqIndex === -1) continue;

    const key = part.substring(0, eqIndex);
    let value = part.substring(eqIndex + 1);

    // Handle quoted values
    if (value.startsWith('"')) {
      let fullValue = value;
      while (i + 1 < parts.length && !fullValue.endsWith('"')) {
        i++;
        fullValue += " " + parts[i];
      }
      value = fullValue.replace(/"/g, "");
    }

    switch (key) {
      case "name":
        properties.name = value;
        break;
      case "clef":
        properties.clef = parseClef(value);
        break;
      case "transpose":
        properties.transpose = parseInt(value);
        break;
      case "octave":
        properties.octave = parseInt(value);
        break;
      case "middle":
        properties.middle = value;
        break;
      case "stafflines":
        properties.stafflines = parseInt(value);
        break;
      case "staffscale":
        properties.staffscale = parseFloat(value);
        break;
      case "perc":
        properties.perc = value.toLowerCase() === "true" || value === "1";
        break;
      case "instrument":
        properties.instrument = parseInt(value);
        break;
      case "merge":
        properties.merge = value.toLowerCase() === "true" || value === "1";
        break;
      case "stems":
        if (!isStemDirection(value)) {
          throw new Error(`Invalid stem direction: ${value}`);
        }
        properties.stems = value;
        break;
      case "gchord":
        if (!isChordPlacement(value)) {
          throw new Error(`Invalid chord placement: ${value}`);
        }
        properties.gchord = value;
        break;
      case "space":
        properties.space = parseFloat(value);
        break;
      case "bracket":
        if (!isBracketBracePosition(value)) {
          throw new Error(`Invalid bracket position: ${value}`);
        }
        properties.bracket = value;
        break;
      case "brace":
        if (!isBracketBracePosition(value)) {
          throw new Error(`Invalid brace position: ${value}`);
        }
        properties.brace = value;
        break;
    }
  }

  return { id, properties };
}

/**
 * Parse a Tempo (Q:) info line expression
 * Format: Q:[note_length]=[bpm] or Q:"text"[note_length]=[bpm]"more text"
 * Examples: Q:1/4=120, Q:"Allegro" 1/4=120, Q:1/8=60 "ca. 60"
 */
export function parseTempo(infoLine: Info_line): TempoProperties {
  if (infoLine.key.lexeme !== "Q") {
    throw new Error(`Expected Q: info line, got ${infoLine.key.lexeme}:`);
  }

  if (infoLine.value.length === 0) {
    return {};
  }

  const tempoStr = tokensToString(infoLine.value).trim();

  const tempo: TempoProperties = {};

  // Extract quoted strings
  const quotedStringMatch = tempoStr.match(/^"([^"]*)"(.*)$/);
  if (quotedStringMatch) {
    tempo.preString = quotedStringMatch[1];
    const remaining = quotedStringMatch[2].trim();
    return { ...tempo, ...parseTempoCore(remaining) };
  }

  return parseTempoCore(tempoStr);
}

/**
 * Parse a Title (T:) info line expression
 */
export function parseTitle(infoLine: Info_line): string {
  if (infoLine.key.lexeme !== "T") {
    throw new Error(`Expected T: info line, got ${infoLine.key.lexeme}:`);
  }

  return tokensToString(infoLine.value).trim();
}

/**
 * Parse a Composer (C:) info line expression
 */
export function parseComposer(infoLine: Info_line): string {
  if (infoLine.key.lexeme !== "C") {
    throw new Error(`Expected C: info line, got ${infoLine.key.lexeme}:`);
  }

  return tokensToString(infoLine.value).trim();
}

/**
 * Parse an Origin (O:) info line expression
 */
export function parseOrigin(infoLine: Info_line): string {
  if (infoLine.key.lexeme !== "O") {
    throw new Error(`Expected O: info line, got ${infoLine.key.lexeme}:`);
  }

  return tokensToString(infoLine.value).trim();
}

/**
 * Parse a generic info line into key-value pair
 */
export function parseGeneric(infoLine: Info_line): {
  key: string;
  value: string;
} {
  return {
    key: infoLine.key.lexeme,
    value: tokensToString(infoLine.value).trim(),
  };
}

// Helper functions

function tokensToString(tokens: Token[]): string {
  return tokens.map((token) => token.lexeme).join("");
}

// Type predicate functions
function isStemDirection(value: string): value is StemDirection {
  return (
    value === "up" || value === "down" || value === "auto" || value === "none"
  );
}

function isChordPlacement(value: string): value is ChordPlacement {
  return (
    value === "above" ||
    value === "below" ||
    value === "left" ||
    value === "right" ||
    value === "default"
  );
}

function isBracketBracePosition(value: string): value is BracketBracePosition {
  return value === "start" || value === "end" || value === "continue";
}

function isAccidentalSymbol(value: string): value is AccidentalSymbol {
  return value === "^" || value === "_" || value === "=";
}

function isModeInput(value: string): value is ModeInput {
  const lowerValue = value.toLowerCase();
  return (
    lowerValue === "major" ||
    lowerValue === "maj" ||
    lowerValue === "ionian" ||
    lowerValue === "minor" ||
    lowerValue === "min" ||
    lowerValue === "m" ||
    lowerValue === "aeolian" ||
    lowerValue === "aeo" ||
    lowerValue === "dorian" ||
    lowerValue === "dor" ||
    lowerValue === "phrygian" ||
    lowerValue === "phr" ||
    lowerValue === "lydian" ||
    lowerValue === "lyd" ||
    lowerValue === "mixolydian" ||
    lowerValue === "mix" ||
    lowerValue === "locrian" ||
    lowerValue === "loc"
  );
}

function parseTempoCore(str: string): TempoProperties {
  const tempo: TempoProperties = {};

  // Look for note=bpm pattern
  const match = str.match(/(\d+\/\d+)\s*=\s*(\d+)(.*)$/);
  if (match) {
    const [, noteLength, bpm, suffix] = match;
    const [num, den] = noteLength.split("/").map((n) => parseInt(n));

    tempo.duration = [den / num]; // Convert to duration value
    tempo.bpm = parseInt(bpm);

    // Check for suffix text
    const suffixMatch = suffix.trim().match(/^"([^"]*)"$/);
    if (suffixMatch) {
      tempo.postString = suffixMatch[1];
    }
  }

  return tempo;
}

function parseMode(modeStr: string): Mode {
  if (!modeStr) return Mode.Major;

  if (!isModeInput(modeStr)) {
    throw new Error(`Invalid mode: ${modeStr}`);
  }

  const mode = modeStr.toLowerCase();
  switch (mode) {
    case ModeInput.Major:
    case ModeInput.Maj:
    case ModeInput.Ionian:
      return Mode.Major;
    case ModeInput.Minor:
    case ModeInput.Min:
    case ModeInput.M:
    case ModeInput.Aeolian:
    case ModeInput.Aeo:
      return Mode.Minor;
    case ModeInput.Dorian:
    case ModeInput.Dor:
      return Mode.Dorian;
    case ModeInput.Phrygian:
    case ModeInput.Phr:
      return Mode.Phrygian;
    case ModeInput.Lydian:
    case ModeInput.Lyd:
      return Mode.Lydian;
    case ModeInput.Mixolydian:
    case ModeInput.Mix:
      return Mode.Mixolydian;
    case ModeInput.Locrian:
    case ModeInput.Loc:
      return Mode.Locrian;
    default:
      return Mode.Major;
  }
}

function parseKeyAccidentals(root: string, accidental: string): Accidental[] {
  const accidentals: Accidental[] = [];

  // Standard key signature accidentals based on circle of fifths
  const keyAccidentals: { [key: string]: string[] } = {
    C: [],
    G: ["F#"],
    D: ["F#", "C#"],
    A: ["F#", "C#", "G#"],
    E: ["F#", "C#", "G#", "D#"],
    B: ["F#", "C#", "G#", "D#", "A#"],
    "F#": ["F#", "C#", "G#", "D#", "A#", "E#"],
    "C#": ["F#", "C#", "G#", "D#", "A#", "E#", "B#"],
    F: ["Bb"],
    Bb: ["Bb", "Eb"],
    Eb: ["Bb", "Eb", "Ab"],
    Ab: ["Bb", "Eb", "Ab", "Db"],
    Db: ["Bb", "Eb", "Ab", "Db", "Gb"],
    Gb: ["Bb", "Eb", "Ab", "Db", "Gb", "Cb"],
    Cb: ["Bb", "Eb", "Ab", "Db", "Gb", "Cb", "Fb"],
  };

  const keyWithAccidental = root + accidental;
  const notes = keyAccidentals[keyWithAccidental] || keyAccidentals[root] || [];

  notes.forEach((note) => {
    const isSharp = note.includes("#");
    const isFlat = note.includes("b");
    const noteLetter = note.replace(/[#b]/g, "");

    accidentals.push({
      note: noteLetter as any,
      acc: isSharp
        ? AccidentalType.Sharp
        : isFlat
          ? AccidentalType.Flat
          : AccidentalType.Natural,
      verticalPos: getNoteVerticalPos(noteLetter),
    });
  });

  return accidentals;
}

function parseExplicitAccidentals(modifiers: string): Accidental[] {
  const accidentals: Accidental[] = [];

  // Parse explicit accidentals like ^c_b=f
  const accidentalMatches = modifiers.match(/[\^_=][A-Ga-g]/g) || [];

  accidentalMatches.forEach((match) => {
    const accType = match[0];
    const noteLetter = match[1];

    if (!isAccidentalSymbol(accType)) {
      throw new Error(`Invalid accidental symbol: ${accType}`);
    }

    let accidentalType: AccidentalType;
    switch (accType) {
      case AccidentalSymbol.Sharp:
        accidentalType = AccidentalType.Sharp;
        break;
      case AccidentalSymbol.Flat:
        accidentalType = AccidentalType.Flat;
        break;
      case AccidentalSymbol.Natural:
        accidentalType = AccidentalType.Natural;
        break;
      default:
        return;
    }

    accidentals.push({
      note: noteLetter.toUpperCase() as any,
      acc: accidentalType,
      verticalPos: getNoteVerticalPos(noteLetter.toUpperCase()),
    });
  });

  return accidentals;
}

function parseClef(clefStr: string): ClefProperties {
  const clefMatch = clefStr.match(
    /^(treble|bass|alto|tenor|perc|none)([+-]\d+)?$/i,
  );

  if (!clefMatch) {
    throw new Error(`Invalid clef: ${clefStr}`);
  }

  const [, type, octaveModifier] = clefMatch;
  let clefType = type.toLowerCase() as ClefType;
  let transpose = 0;

  if (octaveModifier) {
    const octaveChange = parseInt(octaveModifier);
    if (octaveChange > 0) {
      clefType = (type.toLowerCase() + "+" + octaveChange) as ClefType;
    } else if (octaveChange < 0) {
      clefType = (type.toLowerCase() + octaveChange) as ClefType;
    }
    transpose = octaveChange * 12; // Semitones
  }

  return {
    type: clefType,
    verticalPos: getClefVerticalPos(clefType),
    clefPos: 0,
    transpose,
  };
}

function parseComplexMeter(meterStr: string): MeterFraction[] {
  const fractions: MeterFraction[] = [];

  // Split by + and parse each fraction
  const parts = meterStr.split("+");

  parts.forEach((part) => {
    const match = part.trim().match(/^(\d+)\/(\d+)$/);
    if (match) {
      const [, num, den] = match;
      fractions.push({ num: parseInt(num), den: parseInt(den) });
    }
  });

  return fractions;
}

function getNoteVerticalPos(note: string): number {
  const positions: { [key: string]: number } = {
    C: 0,
    D: 1,
    E: 2,
    F: 3,
    G: 4,
    A: 5,
    B: 6,
  };
  return positions[note.toUpperCase()] || 0;
}

function getClefVerticalPos(clef: ClefType): number {
  // Standard vertical positions for different clefs
  switch (clef) {
    case "treble":
      return 6;
    case "bass":
      return 2;
    case "alto":
      return 4;
    case "tenor":
      return 4;
    default:
      return 4;
  }
}

/**
```typescript
function parseInfoLine(infoLine: InfoLine) {
  if parseComposer(infoLine) return;
  if parseGeneric(infoLine) return;
  if parseKey(infoLine) return;
  if parseMeter(infoLine) return;
  if parseNoteLength(infoLine) return;
  if parseOrigin(infoLine) return;
  if parseTempo(infoLine) return;
  if parseTitle(infoLine) return;
  if parseVoice(infoLine) return;
  else 
    return false
}
```
*/
