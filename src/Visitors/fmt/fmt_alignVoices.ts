import { match } from "assert";
import { isToken, isVoiceMarker } from "../../helpers";
import { Expr, Info_line, Inline_field } from "../../types/Expr";
import { Token } from "../../types/token";
import { System, TokenType } from "../../types/types";
import { AbcFormatter } from "../Formatter";

type GroupMarkers =
  | TokenType.EOL
  | TokenType.EOF
  | TokenType.BARLINE
  | TokenType.BARLINE //|
  | TokenType.BAR_COLON // |:
  | TokenType.BAR_DBL // ||
  | TokenType.BAR_DIGIT // |1
  | TokenType.BAR_RIGHTBRKT; // |]

const GROUPMARKERS = [
  new Token(TokenType.EOL, "", null, -1, -1),
  new Token(TokenType.EOF, "", null, -1, -1),
  new Token(TokenType.BARLINE, "|", null, -1, -1),
  new Token(TokenType.BAR_COLON, "|:", null, -1, -1),
  new Token(TokenType.BAR_DBL, "||", null, -1, -1),
  new Token(TokenType.BAR_DIGIT, "|1", null, -1, -1),
  new Token(TokenType.BAR_RIGHTBRKT, "|]", null, -1, -1),
];
export type Voice = {
  voiceType: Expr; // contains the InlineVoice or VoiceInfo_line expression
  system: System;
};
function trimSystem(system: System): System {
  throw new Error("Function not implemented.");
}

export function alignVoices(system: System) {
  let voices = toVoices(system);
  if (voices === null) {
    return system;
  }
  const split_voices = voices.map((voice) =>
    splitSystem(voice.system, ...GROUPMARKERS),
  );
  // voice with largest number of groups
  const groupCount = split_voices.reduce(
    (acc, cur_groups) => Math.max(acc, cur_groups.length),
    0,
  );
  for (let i = 0; i < groupCount; i++) {
    const columns = split_voices.map((groups) => groups[i]); // this assumes equal column count across voices
    alignColumns(columns);
  }
}

/**
 * Split a system into its constituent voices
 * i.e.
 * ```javascript
 * system = "[V:1] abc [V:2] abc"
 * ```
 * becomes
 * ```javascript
 * voices = [ "[V:1] abc", "[V:2] abc"]
 * ```
 * @param system
 * @returns
 */

function toVoices(system: System): Voice[] | null {
  let voices: Voice[] = [];
  let voice: System = [];
  let voiceType: Inline_field | Info_line;

  system = trimSystem(system); // remove leading and trailing `token.WHITESPACE` if any
  let i = -1;
  while (i < system.length) {
    i += 1;
    let node = system[i];
    if (isVoiceMarker(node)) {
      voiceType = node;
      i += 1;
    } else {
      // error case
      return null;
    }

    while (i < system.length && !isVoiceMarker(node)) {
      voice.push(node);
      i += 1;
    }
    voices.push({ voiceType, system });
    voice = [];
  }
  return voices;
}
type music_column = System;

/**
 * Pass an array of columns for voices in a score,
 * e.g. such that if there 3 voices in the score, V1/V2/V3 are aligned
 * ```typescript
 * columns = [ V1.bar1, V2.bar1, V3.bar1 ]
 * alignColumns(columns)
 * ```
 */
function alignColumns(columns: music_column[]) {
  //find longest column, and pad the other ones
  const col_lengths = columns.map((node) => getNodeLen(node));
  const maxLen = col_lengths.reduce((acc, cur) => (cur > acc ? cur : acc), 0);
  for (let i = 0; i < columns.length; i++) {
    const len = col_lengths[i];
    const padding_len = maxLen - len;
    columns[i].push(
      new Token(TokenType.WHITESPACE, " ".repeat(padding_len), null, -1, -1),
    );
  }
}
function getNodeLen(cur: (Expr | Token)[]): number {
  const fmtr = new AbcFormatter();
  fmtr.no_format = true;
  return cur.map((node) => fmtr.stringify(node)).length;
}

function splitSystem(
  system: System,
  ...separators: (Expr | Token)[]
): System[] {
  let columns: System[] = [];
  let column: System = [];
  for (let i = 0; i < system.length; i++) {
    let node = system[i];
    if (separators.some((marker) => matchNode(node, marker))) {
      columns.push(column);
      column = [];
    } else {
      column.push(node);
    }
  }
  return columns;
}

function matchNode(a: Expr | Token, b: Expr | Token): boolean {
  if (isToken(a)) {
    if (isToken(b)) {
      return a.type === b.type;
    } else {
      return false;
    }
  } else {
    // a instanceof Expr
    if (b instanceof Expr) {
      return a.constructor === b.constructor;
    } else {
      return false;
    }
  }
}
