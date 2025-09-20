import { ParseCtx } from "../parse2";
import { InfoLineUnion, Expr } from "../../types/Expr2";
import { Token, TT } from "../scan2";
import { Meter, MeterType } from "../../types/abcjs-ast";
import { Rational, createRational } from "../../Visitors/fmt2/rational";

/**
 *  Parse a Meter (M:) info line expression
 *
 * Format: `M:numerator/denominator` or `M:C` or `M:C|` etc.
 *
 * Examples: `M:4/4`, `M:3/4`, `M:C`, `M:C|`, `M:6/8`
 *
 * To be called from prsInfoLine,
 * so the parent array represents the parsed tokens of the info line.
 * It's expected that the header token is already consumed, and that there be no WS tokens in the info line.
 */
export function prsMeterInfo(ctx: ParseCtx, prnt_arr?: Array<Expr | Token>): InfoLineUnion | null {
  const tokens: Token[] = [];

  while (!ctx.isAtEnd() && !ctx.check(TT.EOL) && !ctx.check(TT.COMMENT)) {
    if (
      !(
        ctx.check(TT.METER_C) ||
        ctx.check(TT.METER_C_BAR) ||
        ctx.check(TT.METER_NUMBER) ||
        ctx.check(TT.METER_SEPARATOR) ||
        ctx.check(TT.METER_LPAREN) ||
        ctx.check(TT.METER_RPAREN) ||
        ctx.check(TT.METER_PLUS)
      )
    ) {
      return null;
    }

    tokens.push(ctx.advance());
    prnt_arr?.push(tokens[tokens.length - 1]);
  }

  return {
    type: "meter",
    data: parseMeterData(tokens),
  };
}

function parseMeterData(tokens: Token[]): Meter {
  // Check for special cases first
  const cToken = tokens.find((t) => t.type === TT.METER_C);
  const cBarToken = tokens.find((t) => t.type === TT.METER_C_BAR);

  if (cBarToken) {
    return {
      type: MeterType.CutTime,
    };
  }

  if (cToken) {
    return {
      type: MeterType.CommonTime,
    };
  }

  // Parse complex meter expression
  const meterFractions = parseMeterExpression(tokens);

  return {
    type: MeterType.Specified,
    value: meterFractions,
  };
}

// TODO: rewrite this awful thing.
function parseMeterExpression(tokens: Token[]): Rational[] {
  const fractions: Rational[] = [];
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];

    if (token.type === TT.METER_LPAREN) {
      // Parse compound meter like (2+3+2)/8
      i++; // skip opening paren
      let numeratorSum = 0;

      while (i < tokens.length && tokens[i].type !== TT.METER_RPAREN) {
        if (tokens[i].type === TT.METER_NUMBER) {
          numeratorSum += parseInt(tokens[i].lexeme);
        }
        // Skip plus signs
        i++;
      }

      i++; // skip closing paren

      // Look for separator and denominator
      if (i < tokens.length && tokens[i].type === TT.METER_SEPARATOR) {
        i++; // skip separator
        if (i < tokens.length && tokens[i].type === TT.METER_NUMBER) {
          const denominator = parseInt(tokens[i].lexeme);
          fractions.push(createRational(numeratorSum, denominator));
          i++;
        }
      }
    } else if (token.type === TT.METER_NUMBER) {
      // Simple fraction like 4/4 or just 4
      const numerator = parseInt(token.lexeme);
      i++;

      // Look for separator and denominator
      if (i < tokens.length && tokens[i].type === TT.METER_SEPARATOR) {
        i++; // skip separator
        if (i < tokens.length && tokens[i].type === TT.METER_NUMBER) {
          const denominator = parseInt(tokens[i].lexeme);
          fractions.push(createRational(numerator, denominator));
          i++;
        }
      } else {
        // Just a numerator without denominator
        fractions.push(createRational(numerator, 1));
      }
    } else {
      i++;
    }
  }

  return fractions;
}
