import { Selection } from "../selection";
import { CSNode, TAGS, isTokenNode, getTokenData } from "../csTree/types";
import { ABCContext, Pitch, Token, TT, toMidiPitch, fromMidiPitch, mergeAccidentals, semitonesToAccidentalType } from "abc-parser";
import {
  findDiatonicSpelling,
  getEnharmonicSpellings,
  chooseBestChromatic,
  resolveMelodyPitch,
  PitchContext,
  noteLetterToMidi,
} from "abc-parser/music-theory/pitchUtils";
import { DocumentSnapshots, ContextSnapshot, encode, getSnapshotAtPosition } from "abc-parser/interpreter/ContextInterpreter";
import { toAst } from "../csTree/toAst";
import { fromAst } from "../csTree/fromAst";
import { findNodesById } from "./types";
import { findChildByTag, getNodeLineAndChar } from "./treeUtils";
import { replace } from "cstree";
import { spellingToPitch, convertMeasureAccidentalsToSemitones, toPitchComponents } from "./pitchHelpers";
import { insertSnapshotSorted } from "./parallel";
import { selectNotesOrChords } from "../selectors/typeSelectors";

const FLAT_SPELLING: { letter: string; accidental: string | null }[] = [
  { letter: "C", accidental: null }, // 0
  { letter: "D", accidental: "_" }, // 1
  { letter: "D", accidental: null }, // 2
  { letter: "E", accidental: "_" }, // 3
  { letter: "E", accidental: null }, // 4
  { letter: "F", accidental: null }, // 5
  { letter: "G", accidental: "_" }, // 6
  { letter: "G", accidental: null }, // 7
  { letter: "A", accidental: "_" }, // 8
  { letter: "A", accidental: null }, // 9
  { letter: "B", accidental: "_" }, // 10
  { letter: "B", accidental: null }, // 11
];

export function fromMidiPitchFlat(midiPitch: number, ctx: ABCContext): Pitch {
  const pitchClass = ((midiPitch % 12) + 12) % 12;
  const { letter, accidental } = FLAT_SPELLING[pitchClass];

  const midiOctave = Math.floor(midiPitch / 12) - 1;

  let noteLetterToken: Token;
  let accidentalToken: Token | undefined;
  let octaveToken: Token | undefined;

  if (midiOctave <= 4) {
    noteLetterToken = new Token(TT.NOTE_LETTER, letter, ctx.generateId());
    if (midiOctave < 4) {
      octaveToken = new Token(TT.OCTAVE, ",".repeat(4 - midiOctave), ctx.generateId());
    }
  } else {
    noteLetterToken = new Token(TT.NOTE_LETTER, letter.toLowerCase(), ctx.generateId());
    if (midiOctave > 5) {
      octaveToken = new Token(TT.OCTAVE, "'".repeat(midiOctave - 5), ctx.generateId());
    }
  }

  if (accidental) {
    accidentalToken = new Token(TT.ACCIDENTAL, accidental, ctx.generateId());
  }

  return new Pitch(ctx.generateId(), {
    alteration: accidentalToken,
    noteLetter: noteLetterToken,
    octave: octaveToken,
  });
}

export function enharmonize(selection: Selection, ctx: ABCContext): Selection {
  for (const cursor of selection.cursors) {
    const nodes = findNodesById(selection.root, cursor);
    for (const csNode of nodes) {
      if (csNode.tag === TAGS.Note) {
        enharmonizePitchChild(csNode, ctx);
      } else if (csNode.tag === TAGS.Chord) {
        let current = csNode.firstChild;
        while (current !== null) {
          if (current.tag === TAGS.Note) {
            enharmonizePitchChild(current, ctx);
          }
          current = current.nextSibling;
        }
      }
    }
  }
  return selection;
}

function enharmonizePitchChild(noteNode: CSNode, ctx: ABCContext): void {
  const pitchCSNode = findChildByTag(noteNode, TAGS.Pitch);
  if (pitchCSNode === null) return;

  // Walk the Pitch's children to find the Alteration token (TT.ACCIDENTAL)
  let alterationToken: CSNode | null = null;
  let current = pitchCSNode.firstChild;
  while (current !== null) {
    if (isTokenNode(current) && getTokenData(current).tokenType === TT.ACCIDENTAL) {
      alterationToken = current;
      break;
    }
    current = current.nextSibling;
  }

  if (alterationToken === null) return;

  const lexeme = getTokenData(alterationToken).lexeme;
  if (lexeme === "=") return;

  const pitchExpr = toAst(pitchCSNode) as Pitch;
  const midiPitch = toMidiPitch(pitchExpr);

  // Guard: skip if MIDI pitch is out of valid range
  if (midiPitch < 0 || midiPitch > 127) return;

  let newPitchExpr: Pitch | null = null;
  if (lexeme.startsWith("^")) {
    newPitchExpr = fromMidiPitchFlat(midiPitch, ctx);
  } else if (lexeme.startsWith("_")) {
    newPitchExpr = fromMidiPitch(midiPitch, ctx);
  }

  if (newPitchExpr === null) return;

  const newPitchCSNode = fromAst(newPitchExpr, ctx);
  replace(pitchCSNode, newPitchCSNode);
}

/**
 * Re-spells notes according to the current key signature and measure accidentals.
 *
 * This transform:
 * - Corrects misspelled notes (e.g., _G -> F in G major)
 * - Removes redundant accidentals (e.g., ^F -> F in G major)
 * - Chooses optimal spellings for chromatic notes based on key direction
 *
 * The MIDI pitch is always preserved - only the spelling changes.
 *
 * @param selection The selection containing Note node IDs
 * @param snapshots DocumentSnapshots from ContextInterpreter (with snapshotAccidentals: true)
 * @param ctx ABCContext for generating node IDs
 * @returns The modified selection
 */
export function enharmonizeToKey(selection: Selection, snapshots: DocumentSnapshots, ctx: ABCContext): Selection {
  const notesOrChords = selectNotesOrChords(selection);

  for (const cursor of notesOrChords.cursors) {
    const nodes = findNodesById(notesOrChords.root, cursor);

    for (const node of nodes) {
      if (node.tag === TAGS.Note) {
        enharmonizeNoteToKey(node, null, snapshots, ctx);
      } else if (node.tag === TAGS.Chord) {
        const { line, char } = getNodeLineAndChar(node);
        const chordPos = encode(line, char);

        let current = node.firstChild;
        while (current !== null) {
          if (current.tag === TAGS.Note) {
            enharmonizeNoteToKey(current, chordPos, snapshots, ctx);
          }
          current = current.nextSibling;
        }
      }
    }
  }

  return selection;
}

function enharmonizeNoteToKey(noteNode: CSNode, chordPos: number | null, snapshots: DocumentSnapshots, ctx: ABCContext): void {
  // Extract pitch components (letter, octave, accidental)
  const pitchComponents = toPitchComponents(noteNode);
  if (pitchComponents === null) return;

  const { letter, octave, explicitAccidental } = pitchComponents;

  // Find the Pitch child for replacement operations
  const pitchCSNode = findChildByTag(noteNode, TAGS.Pitch);
  if (pitchCSNode === null) return;

  // Get context snapshot BEFORE this position to avoid including the note's own accidental.
  // Because the interpreter adds measure accidentals to snapshots at the note's position,
  // we need to look up pos - 1 to get the context before this note.
  // For notes inside a chord, we use the chord's position (passed by caller) so all notes
  // in the chord share the same context (the one from before the chord started).
  let lookupPos: number;
  if (chordPos !== null) {
    lookupPos = chordPos;
  } else {
    const { line, char } = getNodeLineAndChar(noteNode);
    lookupPos = encode(line, char);
  }
  const snapshot = getSnapshotAtPosition(snapshots, lookupPos - 1);

  // Build PitchContext for resolveMelodyPitch
  const pitchContext: PitchContext = {
    key: snapshot.key,
    measureAccidentals: snapshot.measureAccidentals,
    transpose: snapshot.transpose ?? 0,
  };

  // Resolve the actual sounding MIDI pitch considering key, measure accidentals, and transpose
  const midi = resolveMelodyPitch(letter, octave, explicitAccidental, pitchContext);

  // Derive the effective alteration from the resolved MIDI pitch
  const baseMidi = noteLetterToMidi(letter, octave);
  const alteration = midi - pitchContext.transpose - baseMidi;

  // Build merged accidentals (key + measure)
  const measureAccidentalsSemitones = convertMeasureAccidentalsToSemitones(snapshot.measureAccidentals);
  const merged = mergeAccidentals(snapshot.key, measureAccidentalsSemitones);

  const targetPitchClass = ((midi % 12) + 12) % 12;
  const referenceSpelling = findDiatonicSpelling(merged, targetPitchClass);

  const voicedNote = { letter, midi, alteration };

  if (referenceSpelling !== null) {
    // Diatonic case
    respellDiatonic(pitchCSNode, voicedNote, referenceSpelling, ctx);
  } else {
    // Chromatic case
    respellChromatic(noteNode, pitchCSNode, voicedNote, snapshot, snapshots, merged, ctx);
  }
}

function respellDiatonic(
  pitchCSNode: CSNode,
  voicedNote: { letter: "C" | "D" | "E" | "F" | "G" | "A" | "B"; midi: number; alteration: number },
  referenceSpelling: { letter: "C" | "D" | "E" | "F" | "G" | "A" | "B"; alteration: number },
  ctx: ABCContext
): void {
  const needsRespell = voicedNote.letter !== referenceSpelling.letter || voicedNote.alteration !== referenceSpelling.alteration;

  const hasRedundantAccidental = !needsRespell && hasAccidentalNode(pitchCSNode);

  if (needsRespell || hasRedundantAccidental) {
    // Re-spell to reference spelling without explicit accidental
    const newPitch = spellingToPitch(referenceSpelling, voicedNote.midi, false, ctx);
    const newPitchCS = fromAst(newPitch, ctx);
    replace(pitchCSNode, newPitchCS);
  }
}

/**
 * Re-spells a chromatic note according to the key's direction preference.
 *
 * NOTE: This function intentionally mutates the snapshots parameter when it writes
 * an explicit accidental. This is necessary so that subsequent notes in the same
 * measure see the updated accidental context and are re-spelled correctly.
 */
function respellChromatic(
  noteNode: CSNode,
  pitchCSNode: CSNode,
  voicedNote: { letter: string; midi: number; alteration: number },
  snapshot: ContextSnapshot,
  snapshots: DocumentSnapshots,
  merged: Record<"C" | "D" | "E" | "F" | "G" | "A" | "B", number>,
  ctx: ABCContext
): void {
  const targetPitchClass = ((voicedNote.midi % 12) + 12) % 12;
  const options = getEnharmonicSpellings(targetPitchClass);
  const best = chooseBestChromatic(options, snapshot.key, merged);

  const needsRespell = voicedNote.letter !== best.letter || voicedNote.alteration !== best.alteration;

  if (!needsRespell) return;

  const needsExplicit = (merged[best.letter] ?? 0) !== best.alteration;
  const newPitch = spellingToPitch(best, voicedNote.midi, needsExplicit, ctx);
  const newPitchCS = fromAst(newPitch, ctx);
  replace(pitchCSNode, newPitchCS);

  // Update snapshots so subsequent notes see this accidental
  if (needsExplicit) {
    const { line, char } = getNodeLineAndChar(noteNode);
    const pos = encode(line, char);
    const newMeasureAccidentals = new Map(snapshot.measureAccidentals ?? []);
    newMeasureAccidentals.set(best.letter, semitonesToAccidentalType(best.alteration));
    insertSnapshotSorted(snapshots, pos, {
      ...snapshot,
      measureAccidentals: newMeasureAccidentals,
    });
  }
}

/**
 * Checks if a Pitch CSNode has an ACCIDENTAL token child.
 */
function hasAccidentalNode(pitchNode: CSNode): boolean {
  let current = pitchNode.firstChild;
  while (current !== null) {
    if (isTokenNode(current) && getTokenData(current).tokenType === TT.ACCIDENTAL) {
      return true;
    }
    current = current.nextSibling;
  }
  return false;
}
