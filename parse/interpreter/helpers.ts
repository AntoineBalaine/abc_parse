import { Token } from "../parsers/scan2";
import { AccidentalType, BarType } from "../types/abcjs-ast";

export function determineBarType(barTokens: Token[]): BarType {
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

/**
 * Converts an accidental string from ABC notation to AccidentalType.
 * This is the canonical implementation used by all interpreters and transforms
 * that need to convert accidental lexemes to AccidentalType enum values.
 */
export function convertAccidentalToType(accidental: string): AccidentalType {
  switch (accidental) {
    case "^":
      return AccidentalType.Sharp;
    case "_":
      return AccidentalType.Flat;
    case "=":
      return AccidentalType.Natural;
    case "^^":
      return AccidentalType.DblSharp;
    case "__":
      return AccidentalType.DblFlat;
    default:
      return AccidentalType.Natural;
  }
}
