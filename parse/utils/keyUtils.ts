import { KeyRoot, KeyAccidental } from "../types/abcjs-ast";

/**
 * Parse a note letter (A-G, case insensitive) to KeyRoot.
 * Also handles "H" for Highland Pipes (KeyRoot.HP) for backward compatibility
 * with info-line-analyzer.ts.
 * Returns null if the character is not a valid note letter.
 *
 * Note: Both "H" and "h" map to KeyRoot.HP (not KeyRoot.Hp) because we
 * normalize to uppercase before matching. The KeyRoot.Hp variant is not
 * used by this function.
 */
export function parseKeyRoot(char: string): KeyRoot | null {
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
      return KeyRoot.HP;
    default:
      return null;
  }
}

/**
 * Parse an accidental character (#, b) to KeyAccidental.
 * Returns KeyAccidental.None for any other input.
 *
 * Note: This uses strict equality (===) and expects a single character.
 */
export function parseKeyAccidental(char: string): KeyAccidental {
  if (char === "#") return KeyAccidental.Sharp;
  if (char === "b") return KeyAccidental.Flat;
  return KeyAccidental.None;
}
