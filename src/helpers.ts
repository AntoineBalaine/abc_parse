import { BarLine, Beam_contents, Inline_field, Note, Nth_repeat, Rest, music_code, type Pitch, type Rhythm } from './Expr';
import Token from './token';

export const mergeTokens = (tokens: Token[]) => {
  return tokens
    .map((t) => cloneToken(t))
    .reduce((prev, cur, index) => {
      if (index === 0) {
        return prev;
      }
      prev.lexeme = prev.lexeme + cur.lexeme;
      return prev;
    });
};

export const cloneToken = (token: Token) => {
  return new Token(token.type, token.lexeme, null, token.line, token.position);
};

export function stringifyNote(note: Note): string {
  let retStr = '';
  retStr += note.pitch instanceof Rest ? note.pitch.rest.lexeme : stringifyPitch(note.pitch);
  if (note.rhythm) {
    retStr += stringifyRhythm(note.rhythm);
  }
  return retStr;
}

export function stringifyPitch(pitch: Pitch) {
  let retStr = '';
  retStr += pitch.alteration?.lexeme || '';
  retStr += pitch.noteLetter.lexeme || '';
  retStr += pitch.octave?.lexeme || '';
  return retStr;
}

export function stringifyRhythm(rhythm: Rhythm) {
  let retStr = '';
  retStr += rhythm.numerator || '';
  retStr += rhythm.separator || '';
  retStr += rhythm.denominator || '';
  retStr += rhythm.broken || '';
}

export function endsInWS(note: Note) {
  if (/[ \t]$/.test(stringifyNote(note).slice(-1))) {
    return true;
  } else {
    return false;
  }
}

export function followedByWS(expr: music_code) {
  if (expr instanceof Token) {
    return /[ \t]$/.test(expr.lexeme);
  } else { return false; }
}

export function isBeamContents(e: music_code): e is Beam_contents {
  return !(e instanceof BarLine || e instanceof Inline_field || e instanceof Nth_repeat);
}

/**
 * Iterate music_code from given index.
 * if any of the expressions is a note, return true.
 * if any of the expressions is a beam breaker, return false.
 */
export function followedByNote(music_code: Array<music_code>, index: number) {
  for (let i = index; i < music_code.length; i++) {
    if (isBeamContents(music_code[i])) {
      return false;
    } else if (music_code[i] instanceof Note) {
      return true;
    }
  }
  return false;
}
