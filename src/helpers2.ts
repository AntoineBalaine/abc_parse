import { Token, TT } from "./parsers/scan2";
import {
  Annotation,
  BarLine,
  Beam,
  Beam_contents,
  Chord,
  Decoration,
  Expr,
  Grace_group,
  Music_code,
  Note,
  Symbol,
  YSPACER,
  music_code,
} from "./types/Expr2";

// Check if an element is a note
export function isNote(element: music_code): element is Note {
  return element instanceof Note;
}

// Check if an element is a chord
export function isChord(element: music_code): element is Chord {
  return element instanceof Chord;
}

// Check if an element is a whitespace token
export function isWS(element: music_code): boolean {
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

// Check if there's a note following the current element before a beam breaker
export function followedByNote(elements: Array<music_code>, index: number): boolean {
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
export function foundBeam(elements: Array<music_code>, index: number): boolean {
  if ((isNote(elements[index]) || isChord(elements[index])) && index + 1 < elements.length && !isWS(elements[index + 1])) {
    return followedByNote(elements, index + 1);
  }
  return false;
}

// Check if the current element is the end of a beam
export function beamEnd(elements: Array<music_code>, index: number): boolean {
  const current = elements[index];
  const next = index + 1 < elements.length ? elements[index + 1] : null;

  if ((isNote(current) || isChord(current)) && next && isBeamBreaker(next)) {
    return true;
  }
  return isBeamBreaker(current);
}
