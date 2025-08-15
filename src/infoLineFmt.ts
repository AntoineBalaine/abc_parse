import { Info_line } from "./types/Expr2";
import { KeySignature, Meter, MeterType } from "./types/abcjs-ast";
import { rationalToString } from "./Visitors/fmt2/rational";

export function InfoLineFmt(expr: Info_line): string {
  if (expr.parsed) {
    const info = expr.parsed;
    switch (info.type) {
      case "key":
        return "K:" + KeyInfoFmt(info.data);
      case "meter":
        return "M:" + MeterInfoFmt(info.data);
      case "voice":
        return VoiceInfoFmt(info.data);
      case "note_length":
        return "L:" + rationalToString(info.data);
      default:
        break;
    }
  }
  const { key, value } = expr;
  const formattedVal = value.map((val) => val.lexeme).join("");
  return `${key.lexeme}${formattedVal}`;
}

/**
 * Format KeySignature data to ABC key notation
 * Examples: "Cmaj", "Am", "F#Mix", "HP"
 */
export function KeyInfoFmt(keyInfo: KeySignature): string {
  let result = "";

  // Handle Highland Pipes special case
  if (keyInfo.root === "HP") {
    return "HP";
  }

  // Add root note
  result += keyInfo.root;

  // Add accidental if present
  if (keyInfo.acc) {
    result += keyInfo.acc;
  }

  // Add mode if not major (empty string means major)
  if (!!keyInfo.mode) {
    result += keyInfo.mode;
  }

  return result;
}

/**
 * Format Meter data to ABC meter notation
 * Examples: "4/4", "C", "C|", "6/8", "2/4"
 */
export function MeterInfoFmt(meterInfo: Meter): string {
  switch (meterInfo.type) {
    case MeterType.CommonTime:
      return "C";

    case MeterType.CutTime:
      return "C|";

    case MeterType.TempusPerfectum:
      return "O";

    case MeterType.TempusImperfectum:
      return "C";

    case MeterType.TempusPerfectumProlatio:
      return "O.";

    case MeterType.TempusImperfectumProlatio:
      return "C.";

    case MeterType.Specified:
      if (meterInfo.value && meterInfo.value.length > 0) {
        return meterInfo.value.map((fraction) => rationalToString({ numerator: fraction.num, denominator: fraction.den ?? 1 })).join(" ");
      } else {
        return "";
      }
    default:
      return "";
  }
}

/**
 * Format Voice data to ABC voice notation
 * Examples: "V:1", "V:soprano clef=treble", "V:T1 name=\"Tenor\""
 */
export function VoiceInfoFmt(voiceInfo: { id: string; properties: { [key: string]: string } }): string {
  let result = `V:${voiceInfo.id}`;

  const props: Array<string> = [];

  for (const [key, value] of Object.entries(voiceInfo.properties)) {
    if (value.includes(" ")) {
      props.push(`${key}="${value}"`);
    } else {
      props.push(`${key}=${value}`);
    }
  }

  if (props.length > 0) {
    result += " " + props.join(" ");
  }

  return result;
}
