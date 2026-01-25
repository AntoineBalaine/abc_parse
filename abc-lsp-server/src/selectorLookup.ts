import { Selection } from "../../abct2/src/selection";
import {
  selectChords, selectNotes, selectNonChordNotes,
  selectChordNotes, selectRests, selectRhythm, selectRhythmParent
} from "../../abct2/src/selectors/typeSelectors";
import { selectTune } from "../../abct2/src/selectors/structureSelectors";
import {
  selectTop, selectBottom, selectNthFromTop,
  selectAllButTop, selectAllButBottom
} from "../../abct2/src/selectors/chordSelectors";
import {
  selectInsideChord, selectAroundChord,
  selectInsideGraceGroup, selectAroundGraceGroup,
  selectInsideInlineField, selectAroundInlineField,
  selectInsideGrouping, selectAroundGrouping
} from "../../abct2/src/selectors/delimiterSelectors";
import { selectVoice } from "../../abct2/src/selectors/voiceSelector";

type SelectorFn = (sel: Selection, ...args: (number | string)[]) => Selection;

const SELECTOR_MAP: Record<string, SelectorFn> = {
  selectChords: (sel) => selectChords(sel),
  selectNotes: (sel) => selectNotes(sel),
  selectNonChordNotes: (sel) => selectNonChordNotes(sel),
  selectChordNotes: (sel) => selectChordNotes(sel),
  selectRests: (sel) => selectRests(sel),
  selectRhythm: (sel) => selectRhythm(sel),
  selectRhythmParent: (sel) => selectRhythmParent(sel),
  selectTune: (sel) => selectTune(sel),
  selectTop: (sel) => selectTop(sel),
  selectBottom: (sel) => selectBottom(sel),
  selectNthFromTop: (sel, n) => selectNthFromTop(sel, n as number),
  selectAllButTop: (sel) => selectAllButTop(sel),
  selectAllButBottom: (sel) => selectAllButBottom(sel),
  // Delimiter selectors (inside/around patterns)
  selectInsideChord: (sel) => selectInsideChord(sel),
  selectAroundChord: (sel) => selectAroundChord(sel),
  selectInsideGraceGroup: (sel) => selectInsideGraceGroup(sel),
  selectAroundGraceGroup: (sel) => selectAroundGraceGroup(sel),
  selectInsideInlineField: (sel) => selectInsideInlineField(sel),
  selectAroundInlineField: (sel) => selectAroundInlineField(sel),
  selectInsideGrouping: (sel) => selectInsideGrouping(sel),
  selectAroundGrouping: (sel) => selectAroundGrouping(sel),
  // Voice selector (takes voice ID string)
  selectVoice: (sel, voiceId) => selectVoice(sel, voiceId as string),
};

export function lookupSelector(name: string): SelectorFn | null {
  return SELECTOR_MAP[name] ?? null;
}

export function getAvailableSelectors(): string[] {
  return Object.keys(SELECTOR_MAP);
}
