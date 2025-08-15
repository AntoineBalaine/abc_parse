import { ParseCtx } from "../parse2";
import { InfoLineUnion, Expr } from "../../types/Expr2";
import { Token, TT } from "../scan2";

/**
 * To be called from prsInfoLine,
 * so the parent array represents the parsed tokens of the info line.
 * It's expected that the header token is already consumed, and that there be no WS tokens in the info line.
 */
export function prsVxInfo(ctx: ParseCtx, prnt_arr?: Array<Expr | Token>): InfoLineUnion | null {
  const tokens: Token[] = [];

  while (!ctx.isAtEnd() && !ctx.check(TT.EOL) && !ctx.check(TT.COMMENT)) {
    if (!(ctx.check(TT.VX_ID) || ctx.check(TT.VX_K) || ctx.check(TT.VX_V))) {
      return null;
    }

    tokens.push(ctx.advance());
    prnt_arr?.push(tokens[tokens.length - 1]);
  }

  return {
    type: "voice",
    data: parseVoiceData(tokens),
  };
}

function parseVoiceData(tokens: Token[]): { id: string; properties: { [key: string]: string } } {
  let id = "";
  const properties: { [key: string]: string } = {};

  let i = 0;

  // First token should be the voice ID
  if (i < tokens.length && tokens[i].type === TT.VX_ID) {
    id = tokens[i].lexeme;
    i++;
  }

  // Parse key-value pairs
  while (i < tokens.length) {
    if (tokens[i].type === TT.VX_K && i + 1 < tokens.length && tokens[i + 1].type === TT.VX_V) {
      const key = tokens[i].lexeme;
      const value = tokens[i + 1].lexeme;

      // Remove quotes from value if present
      const cleanValue = value.replace(/^"|"$/g, "");
      properties[key] = cleanValue;

      i += 2;
    } else {
      i++;
    }
  }

  return {
    id,
    properties,
  };
}
