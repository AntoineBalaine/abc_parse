import { Comment, Expr, Info_line, Inline_field, music_code } from "../Expr";
import { isBarLine, isInfo_line, isToken, isWS } from '../helpers';
import { Token } from "../token";
import { System, TokenType } from "../types";

export function wrapInSpaces(str: string) {
  return ` ${str} `;
}

export function onlyWSTillEnd(idx: number, arr: Array<Expr | Token>): boolean {
  for (let i = idx + 1; i < arr.length; i++) {
    if (!isWS(arr[i])) {
      return false;
    } else {
      const expr = arr[i];
      if (isToken(expr)) {
        if (expr.type === TokenType.EOF || expr.type === TokenType.EOL || expr.type === TokenType.ANTISLASH_EOL) {
          return true;
        } if (expr.type === TokenType.WHITESPACE) {
          continue;
        } else { return false; };
      }
    }
  }
  return true;
}

/**
 * Transform the flat structure of a system into an array,
 * each entry of which represents a line of the system
 */
export function splitSystemLines(system: System) {
  const lines: Array<Array<Comment | Info_line | music_code>> = [];
  let curLine: Array<Comment | Info_line | music_code> = [];
  system.forEach(expr => {
    curLine.push(expr);
    if (isToken(expr) && expr.type === TokenType.EOL) {
      lines.push(curLine);
      curLine = [];
    }
  });
  if (curLine.length) {
    lines.push(curLine);
  }
  return lines;
}

/**
 * In a voice-system, convert every Info line that represents a voice (`V:1\nabc`)
 * into an inline info (`[V:1]abc`)
 */
export function convertVoiceInfoLinesToInlineInfos(system: System): System {
  /**
   * iterate entries in System
   * if entry is a voice info line
   *  convert to inline info
   *  remove the following EOL token
   */
  const rv: System = [];
  for (let i = 0; i < system.length; i++) {
    const entry = system[i];
    if (isInfo_line(entry) && entry.key.lexeme === "V:") {
      const newInlineinfo = new Inline_field(entry.key, entry.value);
      rv.push(newInlineinfo);
      i++;
    } else {
      rv.push(entry);
    }
  }
  return rv;
}

/**
 * Transform the flat structure of a line into an array of bars
 * structure goes:
 * Lines
 *  Bars
 *   Expr
 */
export function GroupBarsInLines(line: System): Array<Array<Expr | Token>> {
  let bars = [];
  let curBar = [];
  let j = -1;
  while (j < line.length - 1) {
    j++;
    let curExpr = line[j];
    if (isBarLine(curExpr)) {
      curBar.push(curExpr);
      bars.push(curBar);
      curBar = [];
    } else {
      curBar.push(curExpr);
    }
  }
  if (curBar.length) {
    bars.push(curBar);
  }
  return bars;
}

export type Formatter_Bar = {
  str: string;
  bar: Array<Expr | Token>;
};

export type Formatter_LineWithBars = Array<Formatter_Bar>;