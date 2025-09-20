import { Info_line } from "./types/Expr2";
import { KeySignature, Meter, MeterType } from "./types/abcjs-ast";
import { rationalToString } from "./Visitors/fmt2/rational";
import { Token, TT } from "./parsers/scan2";

export function InfoLineFmt(expr: Info_line): string {
  let rv: string;
  if (expr.parsed) {
    const info = expr.parsed;
    switch (info.type) {
      // case "key":
      //   rv = "K:" + KeyInfoFmt(info.data) + trailingComment(expr);
      //   break;
      case "meter":
        rv = "M:" + MeterInfoFmt(info.data) + trailingComment(expr);
        break;
      // case "voice":
      //   rv = VoiceInfoFmt(info.data) + trailingComment(expr);
      //   break;
      case "note_length":
        rv = "L:" + rationalToString(info.data) + trailingComment(expr);
        break;
      default:
        rv = genericFmt(expr);
        break;
    }
  } else {
    rv = genericFmt(expr);
  }
  return rv;
}

/**
 * Hackish, at best…
 */
function trailingComment(expr: Info_line) {
  const lastTok = expr.value[expr.value.length - 1];
  if (lastTok.type === TT.COMMENT) {
    return ` ${lastTok.lexeme}`;
  } else return "";
}

function genericFmt(expr: Info_line) {
  const { key, value } = expr;
  // const formattedVal = value.map((val) => val.lexeme).join(" ");
  let val = "";
  for (let i = 0; i < value.length; i++) {
    let tok = value[i];
    if (tok.type === TT.KEY_K || tok.type === TT.VX_K) {
      let { idx, kv } = KVFmt(i, value);
      i = idx;
      val += kv;
    } else {
      val += (i === 0 ? "" : " ") + value[i].lexeme;
    }
  }
  // return `${key.lexeme}${formattedVal}`;
  return `${key.lexeme}${val}`;
}

function KVFmt(i: number, value: Array<Token>) {
  let val = "";

  val += (i === 0 ? "" : " ") + value[i].lexeme;
  if (i >= value.length - 1) return { idx: i, kv: val };

  const eql_tok = value[i + 1];
  if (eql_tok && eql_tok.type === TT.EQL) {
    i++;
    val += value[i].lexeme;
  }
  const val_tok = value[i + 1];
  if (val_tok && (val_tok.type === TT.KEY_V || val_tok.type === TT.VX_V)) {
    i++;
    val += value[i].lexeme;
  }

  return { idx: i, kv: val };
}

/**
 * Format KeySignature data to ABC key notation
 * Examples: "Cmaj", "Am", "F#Mix", "HP"
 */
export function KeySignatureInfoFmt(keyInfo: KeySignature): string {
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
        return meterInfo.value.map((fraction) => rationalToString(fraction)).join(" ");
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
