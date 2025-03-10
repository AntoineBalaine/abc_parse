import { ABCContext } from "./parsers/Context";
import {
  Annotation,
  BarLine,
  Beam,
  Beam_contents,
  Chord,
  Comment,
  Decoration,
  ErrorExpr,
  Expr,
  Grace_group,
  Info_line,
  Inline_field,
  MultiMeasureRest,
  Music_code,
  Note,
  Pitch,
  Rest,
  Rhythm,
  Symbol,
  Tune_Body,
  Tuplet,
  Voice_overlay,
  YSPACER,
  music_code,
  tune_body_code,
} from "./types/Expr";
import { Token } from "./types/token";
import { Range, TokenType } from "./types/types";

export function isMusicCode(expr: Expr | Token): expr is Music_code {
  return expr instanceof Music_code;
}

export const isBeam = (expr: unknown): expr is Beam => {
  return expr instanceof Beam;
};
export const isNote = (expr: unknown): expr is Note => {
  return expr instanceof Note;
};
export const isBarLine = (expr: unknown): expr is BarLine => {
  return expr instanceof BarLine;
};
export const isAnnotation = (expr: unknown): expr is Annotation => {
  return expr instanceof Annotation;
};
export const isGraceGroup = (expr: unknown): expr is Grace_group => {
  return expr instanceof Grace_group;
};
export const isInline_field = (expr: unknown): expr is Inline_field => {
  return expr instanceof Inline_field;
};
export const isChord = (expr: unknown): expr is Chord => {
  return expr instanceof Chord;
};
export const isSymbol = (expr: unknown): expr is Symbol => {
  return expr instanceof Symbol;
};
export const isMultiMeasureRest = (expr: unknown): expr is MultiMeasureRest => {
  return expr instanceof MultiMeasureRest;
};
export const isComment = (expr: unknown): expr is Comment => {
  return expr instanceof Comment;
};
export const isPitch = (expr: unknown): expr is Pitch => {
  return expr instanceof Pitch;
};
export const isRhythm = (expr: unknown): expr is Rhythm => {
  return expr instanceof Rhythm;
};
export const isRest = (expr: unknown): expr is Rest => {
  return expr instanceof Rest;
};
export const isToken = (expr: unknown): expr is Token => {
  return expr instanceof Token;
};
export const isInfo_line = (expr: unknown): expr is Info_line => {
  return expr instanceof Info_line;
};
export function isYSPACER(expr: Expr | Token): expr is YSPACER {
  return expr instanceof YSPACER;
}
export function isSlurToken(expr: Expr | Token) {
  return expr instanceof Token && (expr.type === TokenType.LEFTPAREN || expr.type === TokenType.RIGHT_PAREN);
}
export function isTune_Body(expr: Expr): expr is Tune_Body {
  return expr instanceof Tune_Body;
}
export function isVoice_overlay(expr: unknown): expr is Voice_overlay {
  return expr instanceof Voice_overlay;
}
export function isDecoration(expr: unknown): expr is Decoration {
  return expr instanceof Decoration;
}
export function isTuplet(expr: unknown): expr is Tuplet {
  return expr instanceof Tuplet;
}
export function isErrorExpr(expr: unknown): expr is ErrorExpr {
  return expr instanceof ErrorExpr;
}
export const mergeTokens = (tokens: Token[], ctx: ABCContext) => {
  return tokens
    .map((t) => cloneToken(t, ctx))
    .reduce((prev, cur, index) => {
      if (index === 0) {
        return prev;
      }
      prev.lexeme = prev.lexeme + cur.lexeme;
      return prev;
    });
};

export const cloneToken = (token: Token, ctx: ABCContext) => {
  return new Token(token.type, cloneText(token.lexeme), null, token.line, token.position, ctx);
};

export const cloneText = (text: string) => {
  return (" " + text).slice(1);
};

export function stringifyNote(note: Note): string {
  let retStr = "";
  retStr += note.pitch instanceof Rest ? note.pitch.rest.lexeme : stringifyPitch(note.pitch);
  if (note.rhythm) {
    retStr += stringifyRhythm(note.rhythm);
  }
  return retStr;
}

export function stringifyPitch(pitch: Pitch) {
  let retStr = "";
  retStr += pitch.alteration?.lexeme || "";
  retStr += pitch.noteLetter.lexeme || "";
  retStr += pitch.octave?.lexeme || "";
  return retStr;
}

export function stringifyRhythm(rhythm: Rhythm) {
  let retStr = "";
  retStr += rhythm.numerator || "";
  retStr += rhythm.separator || "";
  retStr += rhythm.denominator || "";
  retStr += rhythm.broken || "";
}

export function followedByWS(expr: music_code) {
  if (expr instanceof Token) {
    return /[ \t]$/.test(expr.lexeme);
  } else {
    return false;
  }
}

export function isBeamContents(e: unknown): e is Beam_contents {
  return (
    (isToken(e) && !isWS(e)) ||
    e instanceof YSPACER ||
    e instanceof Annotation ||
    e instanceof Decoration ||
    e instanceof Note ||
    e instanceof Grace_group ||
    e instanceof Chord ||
    e instanceof Symbol
  );
}

/**
 * Iterate music_code from given index.
 * if any of the expressions is a note, return true.
 * if any of the expressions is a beam breaker, return false.
 */
export function followedByNote(music_code: Array<Expr | Token>, index: number) {
  for (let i = index; i < music_code.length; i++) {
    if (!isBeamContents(music_code[i]) || isWS(music_code[i])) {
      return false;
    } else if (isNote(music_code[i]) || isChord(music_code[i])) {
      return true;
    }
  }
  return false;
}

/**
 * checks whether e is WHITESPACE, EOL, EOF, or ANTISLASH_EOL
 * @param e
 * @returns
 */
export function isWS(e: unknown) {
  return (
    e instanceof Token && (e.type === TokenType.WHITESPACE || e.type === TokenType.EOL || e.type === TokenType.EOF || e.type === TokenType.ANTISLASH_EOL)
  );
}

/**
 * if cur expr is a note not immediately followed by WS or beam break,
 * find whether there is another note before a beam breaker or before end of array.
 *
 * Beam breakers are barlines, inline fields, and nth repeats.
 */
export function foundBeam(music_code: Array<Expr | Token>, index: number) {
  /**
   * iterate the array from the given index.
   * if any of the expressions is a note, return true.
   * if any of the expressions is a beam breaker, return false.
   */
  if ((isNote(music_code[index]) || isChord(music_code[index])) && !isWS(music_code[index + 1])) {
    return followedByNote(music_code, index + 1);
  } else {
    return false;
  }
}

function precededByNoteBeforBeamBreaker(prev: Array<Expr | Token>) {
  let i = prev.length;
  while (i > 0) {
    i--;
    const last = prev[i];
    if (isBeamBreaker(last)) {
      return false;
    } else if (isNote(last) || isChord(last)) {
      return true;
    }
  }
  return false;
}

export function isInvalidBacktick(prev: Array<Expr | Token>, follow: Array<Token>): boolean {
  if (!precededByNoteBeforBeamBreaker(prev)) {
    return false;
  } else {
    let i = prev.length;
    while (i < follow.length) {
      const last = follow[i];
      if (isBeamBreaker(last)) {
        return false;
      } else if (isNoteToken(last)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * beam's end is when we find a beam breaker or end of array.
 */
export function beamEnd(music_code: Array<Expr | Token>, index: number) {
  const cur = music_code[index];
  const next = music_code[index + 1];
  if ((isNote(cur) || isChord(cur)) && isBeamBreaker(cur)) {
    return true;
  } else {
    return isBeamBreaker(cur);
  }
}

export function isRhythmInRange(range: Range, expr: Rhythm): boolean {
  const { numerator, separator, denominator, broken } = expr;
  const arr = [numerator, separator, denominator, broken].filter((e): e is Token => !!e);
  if (arr.some((e) => isTokenInRange(range, e))) {
    return true;
  } else {
    return false;
  }
}

export function isTokenInRange(range: Range, expr: Token): boolean {
  return range.start.line <= expr.line && range.end.line >= expr.line && range.start.character <= expr.position && range.end.character >= expr.position;
}

export function isDecorationToken(token: Token) {
  const type = token.type;
  const lexeme = token.lexeme;
  return type === TokenType.DOT || type === TokenType.TILDE || (type === TokenType.LETTER && /[RHJLMOPSTuv]/.test(lexeme));
}

export function isNoteToken(token: Token) {
  return (
    token.type === TokenType.FLAT ||
    token.type === TokenType.FLAT_DBL ||
    token.type === TokenType.NATURAL ||
    token.type === TokenType.NOTE_LETTER ||
    token.type === TokenType.SHARP ||
    token.type === TokenType.SHARP_DBL
  );
}

function isBeamBreaker(cur: Token | Expr): boolean {
  if (isToken(cur)) {
    return isWS(cur);
  } else {
    return !isBeamContents(cur) || isBarLine(cur);
  }
}

export function getPitchRange(e: Pitch | Rest): Range {
  if (isRest(e)) {
    return {
      start: {
        line: e.rest.line,
        character: e.rest.position,
      },
      end: {
        line: e.rest.line,
        character: e.rest.position + e.rest.lexeme.length,
      },
    };
  } else {
    let range = {
      start: {
        line: e.noteLetter.line,
        character: e.noteLetter.position,
      },
      end: {
        line: e.noteLetter.line,
        character: e.noteLetter.position + e.noteLetter.lexeme.length,
      },
    };
    if (e.alteration) {
      range.start.line = e.alteration.line;
      range.start.character = e.alteration.position;
    }
    if (e.octave) {
      range.end.line = e.octave.line;
      range.end.character = e.octave.position + e.octave.lexeme.length;
    }
    return range;
  }
}

export function exprIsInRange(control_range: Range, expr_range: Range): boolean {
  return (
    expr_range.start.line >= control_range.start.line &&
    expr_range.end.line <= control_range.end.line &&
    expr_range.start.character >= control_range.start.character &&
    expr_range.end.character <= control_range.end.character + 1
  );
}
export function getTokenRange(token: Token): Range {
  return {
    start: {
      line: token.line,
      character: token.position,
    },
    end: {
      line: token.line,
      character: token.position + token.lexeme.length,
    },
  };
}

export const reduceRanges = (acc: Range, cur: Range, index: number, arr: Range[]): Range => {
  if (index === 0) {
    return cur;
  }
  return {
    start: {
      line: Math.min(acc.start.line, cur.start.line),
      character: Math.min(acc.start.character, cur.start.character),
    },
    end: {
      line: Math.max(acc.end.line, cur.end.line),
      character: Math.max(acc.end.character, cur.end.character),
    },
  };
};

export const isEmptyRhythm = (rhythm: Rhythm): boolean => {
  const { numerator, separator, denominator, broken } = rhythm;
  return !numerator && !separator && !denominator && !broken;
};

export function hasRestAttributes(token: Token) {
  return token.type === TokenType.LETTER && (token.lexeme === "z" || token.lexeme === "x");
}
export const isRhythmToken = (pkd: Token) => {
  return pkd.type === TokenType.SLASH || pkd.type === TokenType.NUMBER || pkd.type === TokenType.GREATER || pkd.type === TokenType.LESS;
};

export const isMultiMesureRestToken = (pkd: Token) => {
  return pkd.type === TokenType.LETTER && (pkd.lexeme === "Z" || pkd.lexeme === "X");
};
export const isRestToken = (pkd: Token) => {
  return hasRestAttributes(pkd);
};

/**
 * is voice marker
 */
export function isVoiceMarker(node: Expr | Token): node is Info_line | Inline_field {
  return (isInline_field(node) && node.field.lexeme === "V:") || (isInfo_line(node) && node.key.lexeme === "V:");
}

/**
 * Check if a tuplet marker is followed by valid music content (notes, rests, chords)
 * Allows for decorations, grace notes, annotations etc. before the music content
 * @param tokens Array of tokens to check
 * @param startIndex Current position (at tuplet marker)
 * @returns boolean indicating if valid music content was found
 */
export function foundMusic(tokens: Token[], startIndex: number): boolean {
  let i = startIndex;

  while (i < tokens.length) {
    const token = tokens[i];

    // Skip whitespace
    if (token.type === TokenType.WHITESPACE) {
      i++;
      continue;
    }

    // Handle grace notes group
    if (token.type === TokenType.LEFT_BRACE) {
      i++;
      // Find matching right brace
      let braceCount = 1;
      while (i < tokens.length && braceCount > 0) {
        if (tokens[i].type === TokenType.LEFT_BRACE) braceCount++;
        if (tokens[i].type === TokenType.RIGHT_BRACE) braceCount--;
        i++;
      }
      if (braceCount > 0) return false; // Unclosed grace group
      continue;
    }

    // Handle annotations (already come as complete STRING tokens)
    if (token.type === TokenType.STRING) {
      i++;
      continue;
    }

    if (token.type === TokenType.COLON && (tokens[i + 1].type === TokenType.COLON || tokens[i + 1].type === TokenType.NUMBER)) {
      i += 2;
      continue;
    }
    // Handle tuplet syntax
    if (token.type === TokenType.NUMBER) {
      i++;
      continue;
    }

    // Handle decorations (including symbols)
    if (token.type === TokenType.DOT || token.type === TokenType.TILDE || token.type === TokenType.SYMBOL || isDecorationToken(token)) {
      i++;
      continue;
    }

    if (token.type === TokenType.LEFTPAREN_NUMBER) {
      return foundMusic(tokens, i + 1);
    }

    // Handle nested grouping
    if (token.type === TokenType.RIGHT_PAREN || token.type === TokenType.LEFTPAREN) {
      i++;
      // Find matching right paren
      continue;
    }

    // Found valid music content
    if (
      // Note
      isNoteToken(token) ||
      // Rest
      isRestToken(token) ||
      // Start of chord
      (token.type === TokenType.LEFTBRKT && (i + 1 >= tokens.length || tokens[i + 1].type !== TokenType.LETTER_COLON))
    ) {
      return true;
    }

    // Invalid token found
    return false;
  }

  // Reached end without finding music
  return false;
}
