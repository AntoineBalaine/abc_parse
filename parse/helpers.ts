import { ABCContext } from "./parsers/Context";
import { ParseCtx } from "./parsers/parse2";
import { Token, TT } from "./parsers/scan2";
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
  KV,
  Line_continuation,
  Measurement,
  MultiMeasureRest,
  Music_code,
  music_code,
  Note,
  Pitch,
  Rational,
  Rest,
  Rhythm,
  Symbol,
  Tune_Body,
  Tuplet,
  Voice_overlay,
  YSPACER,
} from "./types/Expr2";
import { Range } from "./types/types";

// Check if an element is a token
export function isToken(element: unknown): element is Token {
  return element instanceof Token;
}

// Check if an element is a note
export function isNote(element: Expr | Token): element is Note {
  return element instanceof Note;
}

// Check if an element is a chord
export function isChord(element: Expr | Token): element is Chord {
  return element instanceof Chord;
}

// Check if an element is a whitespace token
export function isWS(element: Expr | Token): boolean {
  return element instanceof Token && (element.type === TT.WS || element.type === TT.EOL);
}

// Check if an element can be part of a beam
export function isBeamContents(element: Expr | Token): element is Beam_contents {
  return (
    (element instanceof Token && !isWS(element)) ||
    element instanceof YSPACER ||
    element instanceof Annotation ||
    element instanceof Decoration ||
    element instanceof Note ||
    element instanceof Grace_group ||
    element instanceof Chord ||
    element instanceof Symbol
  );
}

// Check if an element breaks a beam
export function isBeamBreaker(element: Expr | Token): boolean {
  if (element instanceof Token) {
    return isWS(element);
  } else {
    return !isBeamContents(element) || element instanceof BarLine;
  }
}

export function followedBy(ctx: ParseCtx, needle: TT[], ignoreTokens: TT[]): boolean {
  let i = ctx.current + 1;
  while (i < ctx.tokens.length) {
    if (ignoreTokens.includes(ctx.tokens[i].type)) {
      i++;
    } else {
      return needle.includes(ctx.tokens[i].type);
    }
  }
  return false;
}

// Check if there's a note following the current element before a beam breaker
export function followedByNote(elements: Array<Expr | Token>, index: number): boolean {
  for (let i = index; i < elements.length; i++) {
    if (!isBeamContents(elements[i]) || isWS(elements[i])) {
      return false;
    } else if (isNote(elements[i]) || isChord(elements[i])) {
      return true;
    }
  }
  return false;
}

// Check if the current element is the start of a beam
export function foundBeam(elements: Array<Expr | Token>, index: number): boolean {
  if ((isNote(elements[index]) || isChord(elements[index])) && index + 1 < elements.length && !isWS(elements[index + 1])) {
    return followedByNote(elements, index + 1);
  }
  return false;
}

export function isMusicCode(expr: Expr | Token): expr is Music_code {
  return expr instanceof Music_code;
}

export const isBeam = (expr: unknown): expr is Beam => {
  return expr instanceof Beam;
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
export const isInfo_line = (expr: unknown): expr is Info_line => {
  return expr instanceof Info_line;
};
export function isYSPACER(expr: Expr | Token): expr is YSPACER {
  return expr instanceof YSPACER;
}
export function isSlurToken(expr: Expr | Token) {
  return expr instanceof Token && expr.type === TT.SLUR;
}
export function isTune_Body(expr: Expr): expr is Tune_Body {
  return expr instanceof Tune_Body;
}
export function isVoice_overlay(expr: unknown): expr is Voice_overlay {
  return expr instanceof Voice_overlay;
}
export function isLine_continuation(expr: unknown): expr is Line_continuation {
  return expr instanceof Line_continuation;
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

export function isMeasurement(expr: unknown): expr is Measurement {
  return expr instanceof Measurement;
}

export function isKV(expr: unknown): expr is KV {
  return expr instanceof KV;
}

export function isRational(expr: unknown): expr is Rational {
  return expr instanceof Rational;
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
  return new Token(token.type, cloneText(token.lexeme), ctx.generateId());
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
    const range = {
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
    expr_range.end.character <= control_range.end.character
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

/**
 * is voice marker
 */
export function isVoiceMarker(node: Expr | Token): node is Info_line | Inline_field {
  return (isInline_field(node) && node.field.lexeme === "V:") || (isInfo_line(node) && node.key.lexeme === "V:");
}

/**
 * Check if expression carries time information (music expression)
 */
export function isMusicExpr(expr: Expr | Token): boolean {
  return isBeam(expr) || isNote(expr) || isRest(expr) || isChord(expr) || isYSPACER(expr) || isMultiMeasureRest(expr);
}
