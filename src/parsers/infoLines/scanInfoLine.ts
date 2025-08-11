import { advance, collectInvalidInfoLn, Ctx, isAtEnd, precededBy, TT } from "../scan2";
import { comment, pEOL, pInfoLine } from "../scan_tunebody";
import { scanKeyInfo } from "./scanKeyInfo";
import { scanMeterInfo } from "./scanMeterInfo";
import { scanNoteLenInfo } from "./scanNoteLenInfo";
import { scanTempoInfo } from "./scanTempoInfo";
import { scanVoiceInfo } from "./scanVxInfo";

// function scanInfoLine(ctx: Ctx):boolean {
//   // if scanComposer(ctx) return;
//   // if scanGeneric(ctx) return;

//   if scanKey(ctx) return;
//   if scanMeter(ctx) return;
//   if scanNoteLength(ctx) return;
//   if scanOrigin(ctx) return;
//   if scanTempo(ctx) return;
//   if scanTitle(ctx) return;
//   if scnvx(ctx) return;
//   else
//     return false
// }

export function info_line(ctx: Ctx): boolean {
  if (!(ctx.test(pInfoLine) && precededBy(ctx, new Set([TT.EOL, TT.SCT_BRK]), new Set([TT.WS])))) return false;

  const match = new RegExp(`^${pInfoLine.source}`).exec(ctx.source.substring(ctx.current));
  if (!match) return false;
  ctx.current += match[0].length;
  ctx.push(TT.INF_HDR);
  switch (ctx.tokens[ctx.tokens.length - 1].lexeme.charAt(0)) {
    case "V":
      scanVoiceInfo(ctx);
      break;
    case "K":
      scanKeyInfo(ctx);
      break;
    case "M":
      scanMeterInfo(ctx);
      break;
    case "L":
      scanNoteLenInfo(ctx);
      break;
    case "Q":
      scanTempoInfo(ctx);
      break;
    default:
      collectInvalidInfoLn(ctx, `Unknown info line type: ${ctx.tokens[ctx.tokens.length - 1].lexeme}`);
  }

  comment(ctx);

  while (!isAtEnd(ctx) && !ctx.test(pEOL)) {}

  return true;
}
