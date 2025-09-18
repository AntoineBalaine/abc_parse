import { ParseCtx } from "../parse2";
import { InfoLineUnion, Expr } from "../../types/Expr2";
import { Token, TT } from "../scan2";
import { Rational } from "../../Visitors/fmt2/rational";

/**
 *  Parse a Note Length (L:) info line expression
 *
 * Format: `L:1/denominator`
 *
 * Examples: `L:1/8`, `L:1/4`, `L:1/16`
 *
 * To be called from prsInfoLine,
 * so the parent array represents the parsed tokens of the info line.
 * It's expected that the header token is already consumed, and that there be no WS tokens in the info line.
 */
export function prsNoteLenInfo(ctx: ParseCtx, prnt_arr?: Array<Expr | Token>): InfoLineUnion | null {
  const tokens: Token[] = [];

  while (!ctx.isAtEnd() && !ctx.check(TT.EOL) && !ctx.check(TT.COMMENT)) {
    if (!(ctx.check(TT.NOTE_LEN_NUM) || ctx.check(TT.NOTE_LEN_DENOM) || ctx.check(TT.METER_SEPARATOR))) {
      return null;
    }

    tokens.push(ctx.advance());
    prnt_arr?.push(tokens[tokens.length - 1]);
  }

  return {
    type: "note_length",
    data: parseNoteLengthData(tokens),
  };
}

function parseNoteLengthData(tokens: Token[]): Rational {
  let numerator = 1; // Default numerator
  let denominator = 1; // Default denominator

  for (const token of tokens) {
    switch (token.type) {
      case TT.NOTE_LEN_NUM:
        numerator = parseInt(token.lexeme);
        break;
      case TT.NOTE_LEN_DENOM:
        denominator = parseInt(token.lexeme);
        break;
    }
  }

  return { numerator, denominator };
}
