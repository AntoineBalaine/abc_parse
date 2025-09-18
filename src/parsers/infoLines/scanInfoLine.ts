import { advance, Ctx, isAtEnd, precededBy, TT } from "../scan2";
import { comment, pEOL, pInfoLine } from "../scan_tunebody";
import { infoHeader } from "./infoLnHelper";
import { scanKeyInfo } from "./scanKeyInfo";
import { scanMeterInfo } from "./scanMeterInfo";
import { scanNoteLenInfo } from "./scanNoteLenInfo";
import { scanTempoInfo } from "./scanTempoInfo";
import { scanVoiceInfo } from "./scanVxInfo";

export function scanInfoLine(ctx: Ctx): boolean {
  if (!infoHeader(ctx)) return false;

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
      while (!isAtEnd(ctx) && !ctx.test(pEOL) && !ctx.test("%")) {
        advance(ctx);
      }
      if (ctx.current !== ctx.start) {
        ctx.push(TT.INFO_STR);
      }
  }

  comment(ctx);

  return true;
}
