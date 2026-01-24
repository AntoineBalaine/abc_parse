import { Selection } from "../../abct2/src/selection";
import {
  selectChords, selectNotes, selectNonChordNotes,
  selectChordNotes, selectRests
} from "../../abct2/src/selectors/typeSelectors";
import { selectTune } from "../../abct2/src/selectors/structureSelectors";
import {
  selectTop, selectBottom, selectNthFromTop,
  selectAllButTop, selectAllButBottom
} from "../../abct2/src/selectors/chordSelectors";

type SelectorFn = (sel: Selection, ...args: number[]) => Selection;

const SELECTOR_MAP: Record<string, SelectorFn> = {
  selectChords: (sel) => selectChords(sel),
  selectNotes: (sel) => selectNotes(sel),
  selectNonChordNotes: (sel) => selectNonChordNotes(sel),
  selectChordNotes: (sel) => selectChordNotes(sel),
  selectRests: (sel) => selectRests(sel),
  selectTune: (sel) => selectTune(sel),
  selectTop: (sel) => selectTop(sel),
  selectBottom: (sel) => selectBottom(sel),
  selectNthFromTop: (sel, n) => selectNthFromTop(sel, n),
  selectAllButTop: (sel) => selectAllButTop(sel),
  selectAllButBottom: (sel) => selectAllButBottom(sel),
};

export function lookupSelector(name: string): SelectorFn | null {
  return SELECTOR_MAP[name] ?? null;
}
