/**
 * Info Line Analyzer
 *
 * Analyzes ABC info lines (K:, M:, L:, Q:, V:, T:, C:, O:, etc.) and converts them
 * into strongly-typed semantic data structures.
 *
 * This analyzer works on Info_line.value2 expressions (from parseInfoLine2) and outputs
 * InfoLineUnion variants.
 */

import { Info_line, InfoLineUnion, Expr, Pitch, KV, Binary, Rational, Grouping, AbsolutePitch, Annotation } from "../types/Expr2";
import { SemanticAnalyzer } from "./semantic-analyzer";
import {
  KeyInfo,
  KeySignature,
  KeyRoot,
  KeyAccidental,
  Mode,
  Meter,
  MeterType,
  ClefProperties,
  ClefType,
  Accidental,
  AccidentalType,
  NoteLetter,
  NoteHeadStyle,
  TempoProperties,
  StemDirection,
  ChordPlacement,
  BracketBracePosition,
  VoiceProperties,
} from "../types/abcjs-ast";
import { IRational } from "../Visitors/fmt2/rational";
import { Token, TT } from "../parsers/scan2";
import { isToken } from "../helpers";

/**
 * Main info line analyzer - dispatches to specific analyzers based on key
 */
export function analyzeInfoLine(expr: Info_line, analyzer: SemanticAnalyzer): InfoLineUnion | null {
  const key = expr.key?.lexeme.charAt(0);
  if (!key) {
    analyzer.report("Info line missing key", expr);
    return null;
  }

  switch (key) {
    case "K":
      return analyzeKeyInfo(expr, analyzer);
    case "M":
      return analyzeMeterInfo(expr, analyzer);
    case "L":
      return analyzeNoteLenInfo(expr, analyzer);
    case "Q":
      return analyzeTempoInfo(expr, analyzer);
    case "V":
      return analyzeVoiceInfo(expr, analyzer);
    case "T":
      return analyzeTitleInfo(expr, analyzer);
    case "C":
      return analyzeComposerInfo(expr, analyzer);
    case "O":
      return analyzeOriginInfo(expr, analyzer);
    case "X":
      return analyzeReferenceNumberInfo(expr, analyzer);
    case "R":
      return analyzeRhythmInfo(expr, analyzer);
    case "B":
      return analyzeBookInfo(expr, analyzer);
    case "S":
      return analyzeSourceInfo(expr, analyzer);
    case "D":
      return analyzeDiscographyInfo(expr, analyzer);
    case "N":
      return analyzeNotesInfo(expr, analyzer);
    case "Z":
      return analyzeTranscriptionInfo(expr, analyzer);
    case "H":
      return analyzeHistoryInfo(expr, analyzer);
    case "A":
      return analyzeAuthorInfo(expr, analyzer);
    default:
      analyzer.report(`Unknown info line key: ${key}`, expr);
      return null;
  }
}

// ============================================================================
// Key Info Analyzer (K:)
// ============================================================================

/**
 * Analyzes K: (key) info lines
 *
 * Expects expressions from parseInfoLine2:
 * - KV expressions with identifiers for key components and modifiers
 * - Identifiers/tokens for key root, accidental, mode
 *
 * Examples:
 *   K:C       -> Token("C")
 *   K:Am      -> Token("A"), Token("m")
 *   K:G Mix   -> Token("G"), Token("Mix")
 *   K:D clef=bass -> Token("D"), KV(key="clef", value="bass")
 *   K:F# minor transpose=2 -> Token("F#"), Token("minor"), KV(key="transpose", value="2")
 */
export function analyzeKeyInfo(expr: Info_line, analyzer: SemanticAnalyzer): InfoLineUnion | null {
  // Key signature is always in expr.value (the token array)
  // Properties are in expr.value2 (if they exist) or remaining tokens in value
  if (expr.value.length === 0) {
    analyzer.report("Key info line requires a key signature", expr);
    return null;
  }

  const keyInfo: KeyInfo = {
    keySignature: {
      root: KeyRoot.C,
      acc: KeyAccidental.None,
      mode: Mode.Major,
      accidentals: [],
    },
  };

  let valueIndex = 0;

  // 1. Parse key root from first token in value array
  const firstToken = expr.value[valueIndex];
  if (isToken(firstToken)) {
    const keyStr = firstToken.lexeme;

    // Handle "none" special case
    if (keyStr.toLowerCase() === "none") {
      // K:none - no key signature
      return { type: "key", data: keyInfo };
    }

    // Parse using ABC pitch notation: ^f (F#), _b (Bb), =c (C natural)
    // Format: [accidental]note where accidental is ^ (sharp) or _ (flat) or = (natural)
    let keyIndex = 0;
    let acc = KeyAccidental.None;

    // Check for accidental prefix (ABC notation)
    if (keyStr[0] === "^") {
      acc = KeyAccidental.Sharp;
      keyIndex = 1;
    } else if (keyStr[0] === "_") {
      acc = KeyAccidental.Flat;
      keyIndex = 1;
    } else if (keyStr[0] === "=") {
      acc = KeyAccidental.None;
      keyIndex = 1;
    }

    // Parse root note
    if (keyIndex < keyStr.length) {
      const root = parseKeyRoot(keyStr[keyIndex]);
      if (root) {
        keyInfo.keySignature.root = root;
        keyInfo.keySignature.acc = acc;
      }
    }

    valueIndex++;
  }

  // 2. Parse optional mode from second token in value array (if not a KV and value2 doesn't exist)
  if (valueIndex < expr.value.length && !(expr.value2 && expr.value2.length > 0)) {
    const token = expr.value[valueIndex];
    if (isToken(token)) {
      const mode = parseKeyMode(token.lexeme);
      if (mode !== null) {
        keyInfo.keySignature.mode = mode;
        valueIndex++;
      }
    }
  } else if (valueIndex < expr.value.length) {
    // If value2 exists, check if second token is a mode
    const token = expr.value[valueIndex];
    if (isToken(token)) {
      const mode = parseKeyMode(token.lexeme);
      if (mode !== null) {
        keyInfo.keySignature.mode = mode;
        valueIndex++;
      }
    }
  }

  // 3. Parse KV modifiers from value2 (if it exists) or from remaining value tokens
  const propertySource = expr.value2 && expr.value2.length > 0 ? expr.value2 : expr.value.slice(valueIndex);

  for (const item of propertySource) {
    if (item instanceof KV && isToken(item.key)) {
      const keyName = (item.key as Token).lexeme.toLowerCase();

      if (keyName === "clef") {
        const clef = parseClefFromKV(item);
        if (clef) {
          keyInfo.clef = clef;
        }
      } else {
        applyModifier(item, keyInfo);
      }
    }
  }

  return { type: "key", data: keyInfo };
}

function parseKeyRoot(char: string): KeyRoot | null {
  switch (char.toUpperCase()) {
    case "A":
      return KeyRoot.A;
    case "B":
      return KeyRoot.B;
    case "C":
      return KeyRoot.C;
    case "D":
      return KeyRoot.D;
    case "E":
      return KeyRoot.E;
    case "F":
      return KeyRoot.F;
    case "G":
      return KeyRoot.G;
    case "H":
      return KeyRoot.HP; // HP for Highland Pipes
    default:
      return null;
  }
}

function parseKeyAccidental(str: string): KeyAccidental {
  if (str.includes("#")) return KeyAccidental.Sharp;
  if (str.includes("b")) return KeyAccidental.Flat;
  return KeyAccidental.None;
}

function parseKeyMode(str: string): Mode | null {
  const normalized = str.toLowerCase();
  switch (normalized) {
    case "major":
    case "maj":
    case "ionian":
      return Mode.Major;
    case "minor":
    case "min":
    case "m":
    case "aeolian":
    case "aeo":
      return Mode.Minor;
    case "dorian":
    case "dor":
      return Mode.Dorian;
    case "phrygian":
    case "phr":
      return Mode.Phrygian;
    case "lydian":
    case "lyd":
      return Mode.Lydian;
    case "mixolydian":
    case "mix":
      return Mode.Mixolydian;
    case "locrian":
    case "loc":
      return Mode.Locrian;
    default:
      return null;
  }
}

function parseClefFromKV(kv: KV): ClefProperties | null {
  if (!isToken(kv.value)) return null;

  const clefString = kv.value.lexeme;
  return getClefInfo(clefString);
}

function applyModifier(kv: KV, keyInfo: KeyInfo): void {
  if (!isToken(kv.key) || !isToken(kv.value)) return;

  const key = (kv.key as Token).lexeme.toLowerCase();
  const value = kv.value.lexeme;

  // Ensure clef exists
  if (!keyInfo.clef) {
    keyInfo.clef = {
      type: ClefType.Treble,
      verticalPos: 0,
    };
  }

  switch (key) {
    case "middle":
    case "m":
      // Would need to parse pitch - skipping for now
      break;
    case "transpose":
      keyInfo.clef.transpose = parseInt(value);
      break;
    case "stafflines":
      keyInfo.clef.stafflines = parseInt(value);
      break;
    case "staffscale":
      keyInfo.clef.staffscale = parseFloat(value);
      break;
    case "style":
      keyInfo.clef.style = noteHeadStyle(value);
      break;
  }
}

function getClefInfo(clefString: string): ClefProperties {
  const clefMap: { [key: string]: ClefProperties } = {
    treble: { type: ClefType.Treble, verticalPos: 0 },
    "treble+8": { type: ClefType.TreblePlus8, verticalPos: 0 },
    "treble-8": { type: ClefType.TrebleMinus8, verticalPos: 0 },
    bass: { type: ClefType.Bass, verticalPos: -12 },
    "bass+8": { type: ClefType.BassPlus8, verticalPos: -12 },
    "bass-8": { type: ClefType.BassMinus8, verticalPos: -12 },
    alto: { type: ClefType.Alto, verticalPos: -6 },
    "alto+8": { type: ClefType.AltoPlus8, verticalPos: -6 },
    "alto-8": { type: ClefType.AltoMinus8, verticalPos: -6 },
    tenor: { type: ClefType.Tenor, verticalPos: -8 },
    "tenor+8": { type: ClefType.TenorPlus8, verticalPos: -8 },
    "tenor-8": { type: ClefType.TenorMinus8, verticalPos: -8 },
    perc: { type: ClefType.Perc, verticalPos: 0 },
    none: { type: ClefType.None, verticalPos: 0 },
  };

  const clefstr = clefString.toLowerCase();
  return clefMap[clefstr] || clefMap.treble;
}

function noteHeadStyle(styleStr: string): NoteHeadStyle {
  /**
   * NOTE: let’s double check that the stylestring
   * corresponds to one of the note head style options contained in the
   * NoteHeadStyle enum.
   */
  const style = styleStr.toLowerCase();
  return (style as NoteHeadStyle) || NoteHeadStyle.Normal;
}

// ============================================================================
// Meter Info Analyzer (M:)
// ============================================================================

/**
 * Analyzes M: (meter/time signature) info lines
 *
 * Expects expressions from parseInfoLine2:
 * - KV with value "C" or "C|" for special meters
 * - Binary expressions for numeric meters: 4/4, 6/8, etc.
 * - Grouping expressions for compound meters: (2+3)/8
 *
 * Examples:
 *   M:C       -> KV(value="C") or Token("C")
 *   M:C|      -> KV(value="C|") or Token("C|")
 *   M:4/4     -> Binary(4, /, 4)
 *   M:6/8     -> Binary(6, /, 8)
 */
export function analyzeMeterInfo(expr: Info_line, analyzer: SemanticAnalyzer): InfoLineUnion | null {
  const values = expr.value2 && expr.value2.length > 0 ? expr.value2 : expr.value;

  if (values.length === 0) {
    analyzer.report("Meter info line requires a value", expr);
    return null;
  }

  const firstItem = values[0];

  // Check for KV-wrapped special meters (from new parser)
  if (firstItem instanceof KV && !firstItem.key && isToken(firstItem.value)) {
    const token = firstItem.value as Token;
    const lexeme = token.lexeme;

    // Check for common time (C)
    if (lexeme === "C") {
      return {
        type: "meter",
        data: {
          type: MeterType.CommonTime,
          value: [{ numerator: 4, denominator: 4 }],
        },
      };
    }

    // Check for cut time (C|)
    if (lexeme === "C|") {
      return {
        type: "meter",
        data: {
          type: MeterType.CutTime,
          value: [{ numerator: 2, denominator: 2 }],
        },
      };
    }
  }

  // Check for Binary expression (4/4)
  if (firstItem instanceof Binary) {
    const fractions = parseMeterBinary(firstItem);
    if (fractions.length > 0) {
      return {
        type: "meter",
        data: {
          type: MeterType.Specified,
          value: fractions,
        },
      };
    }
  }

  // Check for Grouping expression ((2+3)/8)
  if (firstItem instanceof Grouping) {
    const fractions = parseMeterGrouping(firstItem);
    if (fractions.length > 0) {
      return {
        type: "meter",
        data: {
          type: MeterType.Specified,
          value: fractions,
        },
      };
    }
  }

  analyzer.report("Invalid meter format", expr);
  return null;
}

function parseMeterBinary(binary: Binary): IRational[] {
  const fractions: IRational[] = [];

  // Handle simple fraction: 4/4
  if (isToken(binary.operator) && (binary.operator as Token).lexeme === "/") {
    const numerator = extractNumber(binary.left);
    const denominator = extractNumber(binary.right);

    if (numerator !== null && denominator !== null) {
      fractions.push({ numerator, denominator });
    }
  }

  return fractions;
}

function parseMeterGrouping(grouping: Grouping): IRational[] {
  const fractions: IRational[] = [];

  // Parse compound meter like (2+3)/8
  // The grouping.expr should be a Binary with the division
  if (grouping.expression instanceof Binary) {
    const division = grouping.expression as Binary;

    if (isToken(division.operator) && (division.operator as Token).lexeme === "/") {
      // Left side should be addition expression or number
      let numeratorSum = 0;

      if (division.left instanceof Binary && isToken((division.left as Binary).operator)) {
        // Parse addition: 2+3
        numeratorSum = sumBinaryAddition(division.left as Binary);
      } else {
        // Single number
        const num = extractNumber(division.left);
        if (num !== null) {
          numeratorSum = num;
        }
      }

      const denominator = extractNumber(division.right);

      if (numeratorSum > 0 && denominator !== null) {
        fractions.push({ numerator: numeratorSum, denominator });
      }
    }
  }

  return fractions;
}

function sumBinaryAddition(binary: Binary): number {
  let sum = 0;

  const leftNum = extractNumber(binary.left);
  if (leftNum !== null) {
    sum += leftNum;
  }

  const rightNum = extractNumber(binary.right);
  if (rightNum !== null) {
    sum += rightNum;
  }

  return sum;
}

function extractNumber(item: Expr | Token): number | null {
  if (isToken(item)) {
    const token = item as Token;
    if (token.type === TT.NUMBER) {
      return parseInt(token.lexeme);
    }
  }
  return null;
}

// ============================================================================
// Note Length Info Analyzer (L:)
// ============================================================================

/**
 * Analyzes L: (default note length) info lines
 *
 * Expects expressions from parseInfoLine2:
 * - Binary expression: 1/4, 1/8, etc.
 * - Rational expression
 *
 * Examples:
 *   L:1/4     -> Binary(1, /, 4)
 *   L:1/8     -> Binary(1, /, 8)
 *   L:1/16    -> Binary(1, /, 16)
 */
export function analyzeNoteLenInfo(expr: Info_line, analyzer: SemanticAnalyzer): InfoLineUnion | null {
  const values = expr.value2 && expr.value2.length > 0 ? expr.value2 : expr.value;

  if (values.length === 0) {
    analyzer.report("Note length info line requires a value", expr);
    return null;
  }

  const firstItem = values[0];

  // Check for Rational expression
  if (firstItem instanceof Rational) {
    const rational = firstItem as Rational;
    const numerator = parseInt(rational.numerator.lexeme);
    const denominator = parseInt(rational.denominator.lexeme);

    return {
      type: "note_length",
      data: { numerator, denominator },
    };
  }

  // Check for Binary expression (1/4)
  if (firstItem instanceof Binary) {
    const binary = firstItem as Binary;
    if (isToken(binary.operator) && (binary.operator as Token).lexeme === "/") {
      const numerator = extractNumber(binary.left);
      const denominator = extractNumber(binary.right);

      if (numerator !== null && denominator !== null) {
        return {
          type: "note_length",
          data: { numerator, denominator },
        };
      }
    }
  }

  analyzer.report("Invalid note length format", expr);
  return null;
}

// ============================================================================
// Tempo Info Analyzer (Q:)
// ============================================================================

/**
 * Analyzes Q: (tempo) info lines
 *
 * Expects expressions from parseInfoLine2:
 * - Optional Annotation (preString)
 * - KV expression with Binary/AbsolutePitch key and Number value
 * - Optional Annotation (postString)
 *
 * Examples:
 *   Q:120           -> KV(value=120)
 *   Q:1/4=120       -> KV(key=Binary(1,/,4), value=120)
 *   Q:"Allegro"     -> Annotation("Allegro")
 */
export function analyzeTempoInfo(expr: Info_line, analyzer: SemanticAnalyzer): InfoLineUnion | null {
  const values = expr.value2 && expr.value2.length > 0 ? expr.value2 : expr.value;

  if (values.length === 0) {
    analyzer.report("Tempo info line requires a value", expr);
    return null;
  }

  const tempoData: TempoProperties = {};
  let index = 0;

  // 1. Optional preString (Annotation)
  if (index < values.length && values[index] instanceof Annotation) {
    const annotation = values[index] as Annotation;
    tempoData.preString = annotation.text.lexeme;
    index++;
  }

  // 2. Main tempo specification (KV or just a number)
  if (index < values.length) {
    const item = values[index];

    if (item instanceof KV) {
      const kv = item as KV;

      // Parse BPM from value
      if (isToken(kv.value)) {
        const bpm = parseInt((kv.value as Token).lexeme);
        if (!isNaN(bpm)) {
          tempoData.bpm = bpm;
        }
      }

      // Parse duration from key (if present)
      if (kv.key) {
        tempoData.duration = parseTempoDuration(kv.key);
      }

      index++;
    } else if (isToken(item)) {
      // Just a number = BPM
      const bpm = parseInt((item as Token).lexeme);
      if (!isNaN(bpm)) {
        tempoData.bpm = bpm;
      }
      index++;
    }
  }

  // 3. Optional postString (Annotation)
  if (index < values.length && values[index] instanceof Annotation) {
    const annotation = values[index] as Annotation;
    tempoData.postString = annotation.text.lexeme;
    index++;
  }

  return {
    type: "tempo",
    data: tempoData,
  };
}

function parseTempoDuration(key: Token | Expr): number[] | undefined {
  // Parse duration from Binary expression (1/4) or AbsolutePitch
  if (key instanceof Binary) {
    const numerator = extractNumber(key.left);
    const denominator = extractNumber(key.right);
    if (numerator !== null && denominator !== null) {
      // Return as duration array (simplified)
      return [numerator, denominator];
    }
  }

  return undefined;
}

// ============================================================================
// Voice Info Analyzer (V:)
// ============================================================================

/**
 * Analyzes V: (voice) info lines
 *
 * Expects expressions from parseInfoLine2:
 * - Token for voice ID
 * - Optional KV expressions for properties
 *
 * Examples:
 *   V:1           -> Token("1")
 *   V:T1 clef=treble -> Token("T1"), KV(key="clef", value="treble")
 *   V:B name="Bass" transpose=-12 -> Token("B"), KV("name"="Bass"), KV("transpose"="-12")
 */
export function analyzeVoiceInfo(expr: Info_line, analyzer: SemanticAnalyzer): InfoLineUnion | null {
  // Voice ID is always in expr.value (the token array)
  if (expr.value.length === 0) {
    analyzer.report("Voice info line requires a voice ID", expr);
    return null;
  }

  let voiceId = "";
  const properties: VoiceProperties = {};

  // 1. Parse voice ID from first token in value array
  const firstToken = expr.value[0];
  if (isToken(firstToken)) {
    voiceId = firstToken.lexeme;
  }

  // 2. Parse KV properties from value2 (if it exists) or from value
  const propertySource = expr.value2 && expr.value2.length > 0 ? expr.value2 : expr.value.slice(1);

  for (const item of propertySource) {
    if (item instanceof KV && isToken(item.key) && isToken(item.value)) {
      const key = (item.key as Token).lexeme.toLowerCase();
      const value = (item.value as Token).lexeme;
      applyVoiceProperty(properties, key, value, analyzer, expr);
    }
  }

  return {
    type: "voice",
    data: { id: voiceId, properties },
  };
}

/**
 * Apply a voice property key-value pair to the VoiceProperties object
 */
function applyVoiceProperty(properties: VoiceProperties, key: string, value: string, analyzer: SemanticAnalyzer, expr: Info_line): void {
  switch (key) {
    case "name":
      properties.name = value;
      break;

    case "clef":
      properties.clef = getClefInfo(value);
      break;

    case "transpose":
      const transposeValue = parseInt(value);
      if (!isNaN(transposeValue)) {
        properties.transpose = transposeValue;
      }
      break;

    case "octave":
      const octaveValue = parseInt(value);
      if (!isNaN(octaveValue)) {
        properties.octave = octaveValue;
      }
      break;

    case "middle":
    case "m":
      properties.middle = value;
      break;

    case "stafflines":
      const stafflinesValue = parseInt(value);
      if (!isNaN(stafflinesValue)) {
        properties.stafflines = stafflinesValue;
      }
      break;

    case "staffscale":
      const staffscaleValue = parseFloat(value);
      if (!isNaN(staffscaleValue)) {
        properties.staffscale = staffscaleValue;
      }
      break;

    case "perc":
      properties.perc = value.toLowerCase() === "true" || value === "1";
      break;

    case "instrument":
      const instrumentValue = parseInt(value);
      if (!isNaN(instrumentValue)) {
        properties.instrument = instrumentValue;
      }
      break;

    case "merge":
      properties.merge = value.toLowerCase() === "true" || value === "1";
      break;

    case "stems":
    case "stem":
      if (isStemDirection(value)) {
        properties.stems = value as StemDirection;
      }
      break;

    case "gchord":
      if (isChordPlacement(value)) {
        properties.gchord = value as ChordPlacement;
      }
      break;

    case "space":
    case "spc":
      const spaceValue = parseFloat(value);
      if (!isNaN(spaceValue)) {
        properties.space = spaceValue;
      }
      break;

    case "bracket":
    case "brk":
      if (isBracketBracePosition(value)) {
        properties.bracket = value as BracketBracePosition;
      }
      break;

    case "brace":
    case "brc":
      if (isBracketBracePosition(value)) {
        properties.brace = value as BracketBracePosition;
      }
      break;

    default:
      analyzer.report(`Unknown voice property: ${key}`, expr);
      break;
  }
}

function isStemDirection(value: string): boolean {
  return value === "up" || value === "down" || value === "auto" || value === "none";
}

function isChordPlacement(value: string): boolean {
  return value === "above" || value === "below" || value === "left" || value === "right" || value === "default";
}

function isBracketBracePosition(value: string): boolean {
  return value === "start" || value === "end" || value === "continue";
}

// ============================================================================
// Title Info Analyzer (T:)
// ============================================================================

/**
 * Analyzes T: (title) info lines
 *
 * Just concatenates all tokens into a string
 */
export function analyzeTitleInfo(expr: Info_line, analyzer: SemanticAnalyzer): InfoLineUnion | null {
  const values = expr.value2 && expr.value2.length > 0 ? expr.value2 : expr.value;

  const titleParts: string[] = [];

  for (const item of values) {
    if (isToken(item)) {
      titleParts.push(item.lexeme);
    }
  }

  return {
    type: "title",
    data: titleParts.join(" "),
  };
}

// ============================================================================
// Composer Info Analyzer (C:)
// ============================================================================

/**
 * Analyzes C: (composer) info lines
 *
 * Just concatenates all tokens into a string
 */
export function analyzeComposerInfo(expr: Info_line, analyzer: SemanticAnalyzer): InfoLineUnion | null {
  const values = expr.value2 && expr.value2.length > 0 ? expr.value2 : expr.value;

  const composerParts: string[] = [];

  for (const item of values) {
    if (isToken(item)) {
      composerParts.push((item as Token).lexeme);
    }
  }

  return {
    type: "composer",
    data: composerParts.join(" "),
  };
}

// ============================================================================
// Origin Info Analyzer (O:)
// ============================================================================

/**
 * Analyzes O: (origin) info lines
 *
 * Just concatenates all tokens into a string
 */
export function analyzeOriginInfo(expr: Info_line, analyzer: SemanticAnalyzer): InfoLineUnion | null {
  const values = expr.value2 && expr.value2.length > 0 ? expr.value2 : expr.value;

  const originParts: string[] = [];

  for (const item of values) {
    if (isToken(item)) {
      originParts.push((item as Token).lexeme);
    }
  }

  return {
    type: "origin",
    data: originParts.join(" "),
  };
}

// ============================================================================
// Reference Number Info Analyzer (X:)
// ============================================================================

/**
 * Analyzes X: (reference number) info lines
 *
 * Extracts the numeric reference number
 */
export function analyzeReferenceNumberInfo(expr: Info_line, analyzer: SemanticAnalyzer): InfoLineUnion | null {
  const values = expr.value2 && expr.value2.length > 0 ? expr.value2 : expr.value;

  if (values.length === 0) {
    analyzer.report("Reference number (X:) requires a number", expr);
    return null;
  }

  const firstToken = values[0];
  if (!isToken(firstToken)) {
    analyzer.report("Reference number (X:) expects a number", expr);
    return null;
  }

  const num = parseInt(firstToken.lexeme, 10);
  if (isNaN(num)) {
    analyzer.report(`Invalid reference number: ${firstToken.lexeme}`, expr);
    return null;
  }

  return {
    type: "reference_number",
    data: num,
  };
}

// ============================================================================
// Rhythm Info Analyzer (R:)
// ============================================================================

/**
 * Analyzes R: (rhythm) info lines
 *
 * Just concatenates all tokens into a string
 */
export function analyzeRhythmInfo(expr: Info_line, analyzer: SemanticAnalyzer): InfoLineUnion | null {
  const values = expr.value2 && expr.value2.length > 0 ? expr.value2 : expr.value;

  const rhythmParts: string[] = [];

  for (const item of values) {
    if (isToken(item)) {
      rhythmParts.push((item as Token).lexeme);
    }
  }

  return {
    type: "rhythm",
    data: rhythmParts.join(" "),
  };
}

// ============================================================================
// Book Info Analyzer (B:)
// ============================================================================

/**
 * Analyzes B: (book) info lines
 *
 * Just concatenates all tokens into a string
 */
export function analyzeBookInfo(expr: Info_line, analyzer: SemanticAnalyzer): InfoLineUnion | null {
  const values = expr.value2 && expr.value2.length > 0 ? expr.value2 : expr.value;

  const bookParts: string[] = [];

  for (const item of values) {
    if (isToken(item)) {
      bookParts.push((item as Token).lexeme);
    }
  }

  return {
    type: "book",
    data: bookParts.join(" "),
  };
}

// ============================================================================
// Source Info Analyzer (S:)
// ============================================================================

/**
 * Analyzes S: (source) info lines
 *
 * Just concatenates all tokens into a string
 */
export function analyzeSourceInfo(expr: Info_line, analyzer: SemanticAnalyzer): InfoLineUnion | null {
  const values = expr.value2 && expr.value2.length > 0 ? expr.value2 : expr.value;

  const sourceParts: string[] = [];

  for (const item of values) {
    if (isToken(item)) {
      sourceParts.push((item as Token).lexeme);
    }
  }

  return {
    type: "source",
    data: sourceParts.join(" "),
  };
}

// ============================================================================
// Discography Info Analyzer (D:)
// ============================================================================

/**
 * Analyzes D: (discography) info lines
 *
 * Just concatenates all tokens into a string
 */
export function analyzeDiscographyInfo(expr: Info_line, analyzer: SemanticAnalyzer): InfoLineUnion | null {
  const values = expr.value2 && expr.value2.length > 0 ? expr.value2 : expr.value;

  const discographyParts: string[] = [];

  for (const item of values) {
    if (isToken(item)) {
      discographyParts.push((item as Token).lexeme);
    }
  }

  return {
    type: "discography",
    data: discographyParts.join(" "),
  };
}

// ============================================================================
// Notes Info Analyzer (N:)
// ============================================================================

/**
 * Analyzes N: (notes) info lines
 *
 * Just concatenates all tokens into a string
 */
export function analyzeNotesInfo(expr: Info_line, analyzer: SemanticAnalyzer): InfoLineUnion | null {
  const values = expr.value2 && expr.value2.length > 0 ? expr.value2 : expr.value;

  const notesParts: string[] = [];

  for (const item of values) {
    if (isToken(item)) {
      notesParts.push((item as Token).lexeme);
    }
  }

  return {
    type: "notes",
    data: notesParts.join(" "),
  };
}

// ============================================================================
// Transcription Info Analyzer (Z:)
// ============================================================================

/**
 * Analyzes Z: (transcription) info lines
 *
 * Just concatenates all tokens into a string
 */
export function analyzeTranscriptionInfo(expr: Info_line, analyzer: SemanticAnalyzer): InfoLineUnion | null {
  const values = expr.value2 && expr.value2.length > 0 ? expr.value2 : expr.value;

  const transcriptionParts: string[] = [];

  for (const item of values) {
    if (isToken(item)) {
      transcriptionParts.push((item as Token).lexeme);
    }
  }

  return {
    type: "transcription",
    data: transcriptionParts.join(" "),
  };
}

// ============================================================================
// History Info Analyzer (H:)
// ============================================================================

/**
 * Analyzes H: (history) info lines
 *
 * Just concatenates all tokens into a string
 */
export function analyzeHistoryInfo(expr: Info_line, analyzer: SemanticAnalyzer): InfoLineUnion | null {
  const values = expr.value2 && expr.value2.length > 0 ? expr.value2 : expr.value;

  const historyParts: string[] = [];

  for (const item of values) {
    if (isToken(item)) {
      historyParts.push((item as Token).lexeme);
    }
  }

  return {
    type: "history",
    data: historyParts.join(" "),
  };
}

// ============================================================================
// Author Info Analyzer (A:)
// ============================================================================

/**
 * Analyzes A: (author) info lines
 *
 * Just concatenates all tokens into a string
 */
export function analyzeAuthorInfo(expr: Info_line, analyzer: SemanticAnalyzer): InfoLineUnion | null {
  const values = expr.value2 && expr.value2.length > 0 ? expr.value2 : expr.value;

  const authorParts: string[] = [];

  for (const item of values) {
    if (isToken(item)) {
      authorParts.push((item as Token).lexeme);
    }
  }

  return {
    type: "author",
    data: authorParts.join(" "),
  };
}
