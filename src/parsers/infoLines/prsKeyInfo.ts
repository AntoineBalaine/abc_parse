import { ParseCtx } from "../parse2";
import { Info_line, InfoLineUnion, Expr } from "../../types/Expr2";
import { Token, TT } from "../scan2";
import { KeySignature, KeyRoot, KeyAccidental, Mode, Accidental, AccidentalType, NoteLetter } from "../../types/abcjs-ast";

/**
 * To be called from prsInfoLine,
 * so the parent array represents the parsed tokens of the info line.
 * It's expected that the header token is already consumed, and that there be no WS tokens in the info line.
 */
export function prsKeyInfo(ctx: ParseCtx, prnt_arr?: Array<Expr | Token>): InfoLineUnion | null {
  const tokens: Token[] = [];

  // Collect all tokens for this info line
  while (!ctx.isAtEnd() && !ctx.check(TT.EOL) && !ctx.check(TT.COMMENT)) {
    if (
      !(ctx.check(TT.KEY_NONE) || ctx.check(TT.KEY_ROOT) || ctx.check(TT.KEY_ACCIDENTAL) || ctx.check(TT.KEY_MODE) || ctx.check(TT.KEY_EXPLICIT_ACC))
    ) {
      return null;
    }

    tokens.push(ctx.advance());
    prnt_arr?.push(tokens[tokens.length - 1]);
  }

  // Parse the key signature data
  const keyData = parseKeySignatureData(tokens);

  const parsed: InfoLineUnion = {
    type: "key",
    data: keyData,
  };

  return parsed;
}

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
