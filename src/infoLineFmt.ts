import { Info_line, AbsolutePitch, KV, Binary, Grouping } from "./types/Expr2";
import { KeySignature, Meter, MeterType } from "./types/abcjs-ast";
import { rationalToString } from "./Visitors/fmt2/rational";
import { Token, TT } from "./parsers/scan2";
import { ABCContext } from "./parsers/Context";
import { isToken } from "./helpers";

export function InfoLineFmt(expr: Info_line, ctx?: ABCContext): string {
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
        rv = genericFmt(expr, ctx);
        break;
    }
  } else {
    rv = genericFmt(expr, ctx);
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
    // if (tok.type === TT.KEY_K || tok.type === TT.VX_K) {
    //   let { idx, kv } = KVFmt(i, value);
    //   i = idx;
    //   val += kv;
    // } else
    if (tok.type === TT.WS) {
      continue;
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

  enum ExpectState {
    EQL,
    VALUE,
  }
  let expect: ExpectState = ExpectState.EQL;
  while (i < value.length - 1) {
    i++;
    if (expect === ExpectState.EQL && value[i].type === TT.EQL) {
      val += value[i].lexeme;
      expect = ExpectState.VALUE;
      continue;
    }
    // if (expect === ExpectState.VALUE && (value[i].type === TT.KEY_V || value[i].type === TT.VX_V)) {
    //   val += value[i].lexeme;
    //   break;
    // }
    if (value[i].type === TT.WS) continue;
    else break;
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
