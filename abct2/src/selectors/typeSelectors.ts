import { isChord, isNote, isRest } from "../csTree/types";
import { Selection } from "../selection";
import { fanOutByPredicate } from "./fanOut";

export function selectChords(input: Selection): Selection {
  return fanOutByPredicate(input, isChord, "all");
}

export function selectNotes(input: Selection): Selection {
  return fanOutByPredicate(input, isNote, "all");
}

export function selectNonChordNotes(input: Selection): Selection {
  return fanOutByPredicate(input, isNote, "skipChordChildren");
}

export function selectChordNotes(input: Selection): Selection {
  return fanOutByPredicate(input, isNote, "onlyChordNotes");
}

export function selectRests(input: Selection): Selection {
  return fanOutByPredicate(input, isRest, "all");
}
