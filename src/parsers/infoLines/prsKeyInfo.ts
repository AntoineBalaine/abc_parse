import { ParseCtx, parsePitch } from "../parse2";
import { Info_line, InfoLineUnion, Expr } from "../../types/Expr2";
import { Token, TT, Ctx } from "../scan2";
import { pitch } from "../scan_tunebody";
import {
  KeySignature,
  KeyRoot,
  KeyAccidental,
  Mode,
  Accidental,
  AccidentalType,
  NoteLetter,
  ClefProperties,
  ClefType,
  NoteHeadStyle,
  KeyInfo,
} from "../../types/abcjs-ast";
import { ABCContext } from "../Context";

/**
 * Parse a Key (K:) info line expression - RENAMED from original function
 * This only parses the key signature part (root, accidental, mode, explicit accidentals)
 */
function prsKeySignature(ctx: ParseCtx, prnt_arr?: Array<Expr | Token>): KeySignature | null {
  const tokens: Token[] = [];

  // Collect key signature tokens only
  while (!ctx.isAtEnd() && !ctx.check(TT.EOL) && !ctx.check(TT.COMMENT)) {
    if (
      !(ctx.check(TT.KEY_NONE) || ctx.check(TT.KEY_ROOT) || ctx.check(TT.KEY_ACCIDENTAL) || ctx.check(TT.KEY_MODE) || ctx.check(TT.KEY_EXPLICIT_ACC))
    ) {
      break; // Stop at non-key-signature tokens
    }

    tokens.push(ctx.advance());
    prnt_arr?.push(tokens[tokens.length - 1]);
  }

  if (tokens.length === 0) return null;

  return parseKeySignatureData(tokens);
}

/**
 * Parse a complete Key (K:) info line expression
 * Format: `K:[key][accidentals][mode][ clef][ modifiers]`
 */
export function prsKeyInfo(ctx: ParseCtx, prnt_arr?: Array<Expr | Token>): InfoLineUnion | null {
  const keyInfo: KeyInfo = {
    keySignature: {
      root: KeyRoot.C,
      acc: KeyAccidental.None,
      mode: Mode.Major,
      accidentals: [],
    },
  };

  // 1. Parse key signature
  const keySignature = prsKeySignature(ctx, prnt_arr);
  if (keySignature) {
    keyInfo.keySignature = keySignature;
  }

  // 2. Parse clef if present
  const clef = parseClef(ctx, prnt_arr);
  if (clef) {
    keyInfo.clef = clef;
  }

  // 3. Parse modifiers and apply to clef
  parseModifiers(ctx, keyInfo, prnt_arr);

  const parsed: InfoLineUnion = {
    type: "key",
    data: keyInfo,
  };

  return parsed;
}

/**
 * Parse clef expression: [clef=]? [type] [line]? [±8]?
 */
function parseClef(ctx: ParseCtx, prnt_arr?: Array<Expr | Token>): ClefProperties | null {
  if (!(!ctx.isAtEnd() && ctx.check(TT.KEY_K) && ctx.peek().lexeme === "clef")) return null;

  if (prnt_arr) {
    prnt_arr.push(ctx.advance()); // TT.KEY_K
    prnt_arr.push(ctx.advance()); //TT.EQL
  }

  let valueToken: null | Token = null;
  let clefString: null | string = null;
  if (ctx.match(TT.KEY_V)) {
    valueToken = ctx.previous();
    prnt_arr?.push(valueToken);

    clefString = valueToken ? valueToken.lexeme : "treble";

    // Parse optional line number
    if (ctx.check(TT.CLEF_NUM)) {
      const lineToken = ctx.advance();
      prnt_arr?.push(lineToken);
      clefString += lineToken.lexeme;
    }

    // Parse optional octave shift - this modifies the clef type itself
    if (ctx.check(TT.CLEF_OCTAVE)) {
      const octaveToken = ctx.advance();
      prnt_arr?.push(octaveToken);
      clefString += octaveToken.lexeme;
    }
  }

  const clef: ClefProperties = {
    type: clefString ? clefType(clefString) : ClefType.Treble, // Now includes line number and octave shift
    verticalPos: getDefaultVerticalPos(clefString), // Use full clef string for lookup
  };

  return clef;
}

/**
 * Parse key/value modifiers and apply to KeyInfo
 */
function parseModifiers(ctx: ParseCtx, keyInfo: KeyInfo, prnt_arr?: Array<Expr | Token>): void {
  while (!ctx.isAtEnd() && !ctx.check(TT.EOL) && !ctx.check(TT.COMMENT)) {
    if (!ctx.check(TT.VX_K)) break;

    const keyToken = ctx.advance();
    prnt_arr?.push(keyToken);

    if (!ctx.check(TT.EQL)) {
      ctx.report("Expected '=' after modifier key");
      break;
    }

    const eqlToken = ctx.advance();
    prnt_arr?.push(eqlToken);

    if (!ctx.check(TT.VX_V)) {
      ctx.report("Expected value after '='");
      break;
    }

    const valueToken = ctx.advance();
    prnt_arr?.push(valueToken);

    applyModifier(keyToken.lexeme, valueToken.lexeme, keyInfo);
  }
}

/**
 * Apply a parsed modifier to the KeyInfo
 */
function applyModifier(key: string, value: string, keyInfo: KeyInfo): void {
  // Ensure clef exists
  if (!keyInfo.clef) {
    keyInfo.clef = {
      type: ClefType.Treble,
      verticalPos: 0,
    };
  }

  switch (key.toLowerCase()) {
    case "middle":
    case "m":
      keyInfo.clef.verticalPos = parseMiddlePitch(value);
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

// Helper functions (existing ones remain the same)
function parseKeySignatureData(tokens: Token[]): KeySignature {
  // Filter out whitespace and header tokens
  const contentTokens = tokens.filter((t) => t.type !== TT.WS && t.type !== TT.INF_HDR);

  let keyData: KeySignature = {
    root: KeyRoot.C, // Default for "none"
    acc: KeyAccidental.None,
    mode: Mode.Major,
    accidentals: [],
  };

  outer: for (const token of contentTokens) {
    switch (token.type) {
      case TT.KEY_NONE:
        break outer;
      case TT.KEY_ROOT:
        keyData.root = mapKeyRoot(token.lexeme);
        break;
      case TT.KEY_ACCIDENTAL:
        keyData.acc = mapKeyAccidental(token.lexeme);
        break;
      case TT.KEY_MODE:
        keyData.mode = mapKeyMode(token.lexeme);
        break;
      case TT.KEY_EXPLICIT_ACC:
        keyData.accidentals.push(parseExplicitAccidental(token.lexeme));
        break;
      default:
        // Ignore other token types
        break;
    }
  }

  return keyData;
}

function mapKeyRoot(lexeme: string): KeyRoot {
  switch (lexeme.toUpperCase()) {
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
    default:
      throw new Error(`Invalid key root: ${lexeme}`);
  }
}

function mapKeyAccidental(lexeme: string): KeyAccidental {
  switch (lexeme) {
    case "#":
      return KeyAccidental.Sharp;
    case "b":
      return KeyAccidental.Flat;
    default:
      return KeyAccidental.None;
  }
}

function mapKeyMode(lexeme: string): Mode {
  const normalized = lexeme.toLowerCase();
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
      return Mode.Major; // Default fallback
  }
}

function parseExplicitAccidental(lexeme: string): Accidental {
  if (lexeme.length < 2) {
    throw new Error(`Invalid explicit accidental: ${lexeme}`);
  }

  const accSymbol = lexeme[0];
  const noteLetter = lexeme[1];

  // Map accidental type
  let acc: AccidentalType;
  switch (accSymbol) {
    case "^":
      acc = AccidentalType.Sharp;
      break;
    case "_":
      acc = AccidentalType.Flat;
      break;
    case "=":
      acc = AccidentalType.Natural;
      break;
    default:
      throw new Error(`Invalid accidental symbol: ${accSymbol}`);
  }

  // Cast note letter directly as enum
  const note = noteLetter as NoteLetter;

  return {
    acc,
    note,
    verticalPos: 0, // This would need to be calculated based on clef context
  };
}

function clefType(clefString: string): ClefType {
  // Map the full clef string (including line numbers and octave shifts) to ClefType
  const clefInfo = getClefInfo(clefString);
  return clefInfo.type;
}

function getDefaultVerticalPos(clefString: string | null): number {
  // Get vertical position from ABCJS clefLines equivalent
  const clefInfo = getClefInfo(clefString ?? "treble");
  return clefInfo.mid;
}

// ABCJS clefLines equivalent - maps clef strings to their properties
function getClefInfo(clefString: string): { type: ClefType; mid: number; pitch?: number } {
  const clefMap = {
    treble: { type: ClefType.Treble, mid: 0, pitch: 4 },
    "treble+8": { type: ClefType.TreblePlus8, mid: 0, pitch: 4 },
    "treble-8": { type: ClefType.TrebleMinus8, mid: 0, pitch: 4 },
    treble1: { type: ClefType.Treble, mid: 2, pitch: 2 },
    treble2: { type: ClefType.Treble, mid: 0, pitch: 4 },
    treble3: { type: ClefType.Treble, mid: -2, pitch: 6 },
    treble4: { type: ClefType.Treble, mid: -4, pitch: 8 },
    treble5: { type: ClefType.Treble, mid: -6, pitch: 10 },
    bass: { type: ClefType.Bass, mid: -12, pitch: 8 },
    "bass+8": { type: ClefType.BassPlus8, mid: -12, pitch: 8 },
    "bass-8": { type: ClefType.BassMinus8, mid: -12, pitch: 8 },
    bass1: { type: ClefType.Bass, mid: -6, pitch: 2 },
    bass2: { type: ClefType.Bass, mid: -8, pitch: 4 },
    bass3: { type: ClefType.Bass, mid: -10, pitch: 6 },
    bass4: { type: ClefType.Bass, mid: -12, pitch: 8 },
    bass5: { type: ClefType.Bass, mid: -14, pitch: 10 },
    alto: { type: ClefType.Alto, mid: -6, pitch: 6 },
    "alto+8": { type: ClefType.AltoPlus8, mid: -6, pitch: 6 },
    "alto-8": { type: ClefType.AltoMinus8, mid: -6, pitch: 6 },
    alto1: { type: ClefType.Alto, mid: -2, pitch: 2 },
    alto2: { type: ClefType.Alto, mid: -4, pitch: 4 },
    alto3: { type: ClefType.Alto, mid: -6, pitch: 6 },
    alto4: { type: ClefType.Alto, mid: -8, pitch: 8 },
    alto5: { type: ClefType.Alto, mid: -10, pitch: 10 },
    tenor: { type: ClefType.Tenor, mid: -8, pitch: 8 },
    "tenor+8": { type: ClefType.TenorPlus8, mid: -8, pitch: 8 },
    "tenor-8": { type: ClefType.TenorMinus8, mid: -8, pitch: 8 },
    tenor1: { type: ClefType.Tenor, mid: -2, pitch: 2 },
    tenor2: { type: ClefType.Tenor, mid: -4, pitch: 4 },
    tenor3: { type: ClefType.Tenor, mid: -6, pitch: 6 },
    tenor4: { type: ClefType.Tenor, mid: -8, pitch: 8 },
    tenor5: { type: ClefType.Tenor, mid: -10, pitch: 10 },
    perc: { type: ClefType.Perc, mid: 0, pitch: 6 },
    none: { type: ClefType.None, mid: 0 },
  };

  const clefstr = clefString.toLowerCase();
  if (clefstr in clefMap) {
    return clefMap[clefstr as keyof typeof clefMap];
  }

  // Default fallback
  return clefMap.treble;
}

function noteHeadStyle(styleStr: string): NoteHeadStyle {
  const style = styleStr.toLowerCase();
  if (style in NoteHeadStyle) {
    return style as NoteHeadStyle;
  } else {
    return NoteHeadStyle.Normal;
  }
}

/**
 * Parse a pitch string (like "C", "^F", "c'") and return its vertical position
 * This reuses the existing pitch scanning and parsing infrastructure
 */
function parseMiddlePitch(pitchStr: string): number {
  const abcContext = new ABCContext();
  // Create a scanning context for the pitch string
  const scanCtx = new Ctx(pitchStr, abcContext);

  // Use pitch() scanner to tokenize the pitch
  if (!pitch(scanCtx)) {
    return 0; // fallback if pitch parsing fails
  }

  // Create a parsing context from the tokens
  const parseCtx = new ParseCtx(scanCtx.tokens, abcContext);

  // Use parsePitch() to get the pitch object
  const pitchObj = parsePitch(parseCtx);

  if (!pitchObj) {
    return 0; // fallback
  }

  // Calculate vertical position from pitch components
  // This replicates the ABCJS pitches mapping logic
  const pitches: { [key: string]: number } = {
    A: 5,
    B: 6,
    C: 0,
    D: 1,
    E: 2,
    F: 3,
    G: 4, // Upper case = lower octave
    a: 12,
    b: 13,
    c: 7,
    d: 8,
    e: 9,
    f: 10,
    g: 11, // Lower case = higher octave
  };

  // Get base position from note letter
  let position = pitches[pitchObj.noteLetter.lexeme] || 6;

  // Apply octave adjustments
  if (pitchObj.octave) {
    const octaveStr = pitchObj.octave.lexeme;
    for (let i = 0; i < octaveStr.length; i++) {
      if (octaveStr[i] === ",") {
        position -= 7; // Each comma lowers by one octave
      } else if (octaveStr[i] === "'") {
        position += 7; // Each apostrophe raises by one octave
      }
    }
  }

  // Convert from "middle line position" to "first ledger line below staff"
  return position - 6;
}
