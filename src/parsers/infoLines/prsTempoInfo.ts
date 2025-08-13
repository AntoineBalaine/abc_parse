import { ParseCtx } from "../parse2";
import { InfoLineUnion, Expr } from "../../types/Expr2";
import { Token, TT } from "../scan2";
import { TempoProperties } from "../../types/abcjs-ast";

/**
 * To be called from prsInfoLine,
 * so the parent array represents the parsed tokens of the info line.
 * It's expected that the header token is already consumed, and that there be no WS tokens in the info line.
 */
export function prsTempoInfo(ctx: ParseCtx, prnt_arr?: Array<Expr | Token>): InfoLineUnion | null {
  const tokens: Token[] = [];

  while (!ctx.isAtEnd() && !ctx.check(TT.EOL) && !ctx.check(TT.COMMENT)) {
    if (
      !(
        ctx.check(TT.TEMPO_TEXT) ||
        ctx.check(TT.TEMPO_BPM) ||
        ctx.check(TT.TEMPO_NOTE_LETTER) ||
        ctx.check(TT.NOTE_LEN_NUM) ||
        ctx.check(TT.NOTE_LEN_DENOM)
      )
    ) {
      return null;
    }

    tokens.push(ctx.advance());
    prnt_arr?.push(tokens[tokens.length - 1]);
  }

  return {
    type: "tempo",
    data: parseTempoData(tokens),
  };
}

function parseTempoData(tokens: Token[]): TempoProperties {
  let preString: string | undefined;
  let postString: string | undefined;
  let bpm: number | undefined;
  let duration: number[] | undefined;

  let foundBpm = false;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    switch (token.type) {
      case TT.TEMPO_TEXT:
        // Remove quotes from string literal
        const text = token.lexeme.replace(/^"|"$/g, "");
        if (!foundBpm && !bpm) {
          preString = text;
        } else {
          postString = text;
        }
        break;

      case TT.TEMPO_BPM:
        bpm = parseInt(token.lexeme);
        foundBpm = true;
        break;

      case TT.TEMPO_NOTE_LETTER:
        // Parse note with octave (e.g., "C4")
        if (!duration) duration = [];
        // For now, just store as a simple duration value
        // This would need more sophisticated parsing for actual note durations
        duration.push(1); // Placeholder
        break;

      case TT.NOTE_LEN_NUM:
      case TT.NOTE_LEN_DENOM:
        // These are part of note duration specifications
        if (!duration) duration = [];
        // This would need more sophisticated parsing to handle fractional durations
        duration.push(parseInt(token.lexeme));
        break;
    }
  }

  return {
    preString,
    postString,
    bpm,
    duration,
  };
}
