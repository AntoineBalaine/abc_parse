import { ABCContext, Pitch, Rhythm, Token, Note } from "abc-parser";
import {
  accidentalTypeToSemitones,
  findPreviousChordInVoice,
  findNextChordInVoice,
  chordToVoicedNotes,
  shiftChordDiatonic,
  shiftChordChromatic,
  resolveMelodyPitch,
  computeOctaveFromPitch,
  mergeAccidentals,
  semitonesToAccidentalType,
} from "abc-parser";
import { ChordPosition } from "abc-parser/interpreter/ChordPositionCollector";
import { DocumentSnapshots, ContextSnapshot, getSnapshotAtPosition, encode } from "abc-parser/interpreter/ContextInterpreter";
import { AccidentalType } from "abc-parser/types/abcjs-ast";
import { cloneExpr, cloneToken } from "abc-parser/Visitors/CloneVisitor";
import { replace, getParent } from "cstree";
import { fromAst } from "../csTree/fromAst";
import { toAst } from "../csTree/toAst";
import { CSNode, TAGS } from "../csTree/types";
import { Selection } from "../selection";
import { pitchToDiatonic, toChordAst, HarmonizeSnapshot } from "./harmonize";
import { findChildByTag, findTieChild, getNodeLineAndChar } from "./treeUtils";
import { findNodesById } from "./types";

export type ParallelDirection = "prev" | "next";
export type ParallelMode = "diatonic" | "chromatic";

/**
 * Extracts the Pitch AST from a Note CSNode.
 */
export function getPitch(noteNode: CSNode): Pitch | null {
  const pitchNode = findChildByTag(noteNode, TAGS.Pitch);
  if (pitchNode === null) return null;
  return toAst(pitchNode) as Pitch;
}

/**
 * Extracts the Rhythm AST from a Note CSNode.
 */
export function getRhythm(noteNode: CSNode): Rhythm | null {
  const rhythmNode = findChildByTag(noteNode, TAGS.Rhythm);
  if (rhythmNode === null) return null;
  return toAst(rhythmNode) as Rhythm;
}

/**
 * Extracts the Tie token from a Note CSNode.
 */
export function getTie(noteNode: CSNode): Token | null {
  const tieNode = findTieChild(noteNode);
  if (tieNode === null) return null;
  return toAst(tieNode) as Token;
}

/**
 * Calculates the diatonic offset (number of diatonic steps) from refPitch to targetPitch.
 * Positive values mean targetPitch is higher than refPitch.
 */
export function calcDiatonicOffset(targetPitch: Pitch, refPitch: Pitch): number {
  const target = pitchToDiatonic(targetPitch);
  const ref = pitchToDiatonic(refPitch);
  return target.octave * 7 + target.index - (ref.octave * 7 + ref.index);
}

/**
 * Converts ContextSnapshot's measureAccidentals (Map<string, AccidentalType>)
 * to the semitone-based Map<string, number> that HarmonizeSnapshot expects.
 */
export function convertMeasureAccidentals(
  measureAccidentals: Map<"C" | "D" | "E" | "F" | "G" | "A" | "B", AccidentalType>
): Map<"C" | "D" | "E" | "F" | "G" | "A" | "B", number> {
  const result = new Map<"C" | "D" | "E" | "F" | "G" | "A" | "B", number>();
  for (const [letter, accType] of measureAccidentals) {
    result.set(letter, accidentalTypeToSemitones(accType));
  }
  return result;
}

/**
 * Inserts a snapshot at the correct sorted position in the snapshots array.
 * Because the array is sorted by pos, we use binary search to find the insertion point.
 */
export function insertSnapshotSorted(snapshots: DocumentSnapshots, pos: number, snapshot: ContextSnapshot): void {
  let lo = 0;
  let hi = snapshots.length;

  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (snapshots[mid].pos < pos) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }

  snapshots.splice(lo, 0, { pos, snapshot });
}

/**
 * Traverses the tree from the given node, calling the callback for each Note found.
 * Because we skip Chord nodes entirely (we do not descend into them), only standalone
 * notes are processed.
 * We save nextSibling before the callback to handle tree modifications safely.
 */
export function traverseNotes(node: CSNode, callback: (note: CSNode) => void): void {
  if (node.tag === TAGS.Chord) {
    return; // Skip chords entirely
  }

  if (node.tag === TAGS.Note) {
    callback(node);
    return;
  }

  // Recurse into container children
  let current = node.firstChild;
  while (current !== null) {
    const next = current.nextSibling; // Save before callback modifies tree
    traverseNotes(current, callback);
    current = next;
  }
}

/**
 * Creates parallel chords from notes using diatonic shifts.
 *
 * For each selected note, we find a reference chord (previous or next in the same voice),
 * calculate the diatonic offset from the reference chord's top note to the target note,
 * then shift all reference chord pitches by that offset to create a new chord.
 *
 * The target note's rhythm and tie are preserved on the new chord.
 *
 * @param selection The selection containing Note node IDs
 * @param direction Whether to look for the reference chord before ("prev") or after ("next") the note
 * @param ctx ABCContext for generating node IDs
 * @param snapshots DocumentSnapshots for voice context lookup
 * @param chordPositions ChordPosition array with includeAstChord enabled
 * @returns The modified selection
 */
export function parallelDiatonic(
  selection: Selection,
  direction: ParallelDirection,
  ctx: ABCContext,
  snapshots: DocumentSnapshots,
  chordPositions: ChordPosition[]
): Selection {
  // Early return if no snapshots are available
  if (snapshots.length === 0) return selection;

  for (const cursor of selection.cursors) {
    const nodes = findNodesById(selection.root, cursor);

    for (const node of nodes) {
      traverseNotes(node, (noteNode) => {
        // Get position and voice context
        const { line, char } = getNodeLineAndChar(noteNode);
        const pos = encode(line, char);

        // Use pos directly; getSnapshotAtPosition finds the most recent snapshot at or before pos
        const snapshot = getSnapshotAtPosition(snapshots, pos);

        // Find reference chord
        let refChordPos: ChordPosition | null;
        if (direction === "prev") {
          refChordPos = findPreviousChordInVoice(chordPositions, snapshot.voiceId, pos);
        } else {
          refChordPos = findNextChordInVoice(chordPositions, snapshot.voiceId, pos);
        }

        if (refChordPos === null || refChordPos.astChord === undefined) {
          return; // No reference chord found, silent failure
        }

        // Get target pitch, rhythm, and tie
        const targetPitch = getPitch(noteNode);
        if (targetPitch === null) return;

        const targetRhythm = getRhythm(noteNode);
        const targetTie = getTie(noteNode);

        // Convert reference chord to VoicedNote[] via harmonization module
        const measureAcc = snapshot.measureAccidentals ?? new Map();
        const voicedRefNotes = chordToVoicedNotes(refChordPos.astChord, snapshot.key, measureAcc);
        if (voicedRefNotes.length === 0) return;

        // Find the highest MIDI pitch note (the "lead" note)
        const topVoiced = voicedRefNotes.reduce((a, b) => (a.midi > b.midi ? a : b));

        // Find the corresponding Note in refChord to get the Pitch AST
        const refNotes = refChordPos.astChord.contents.filter((e) => e instanceof Note) as Note[];
        const refNote = refNotes.find((n) => {
          const letter = n.pitch.noteLetter.lexeme.toUpperCase();
          return letter === topVoiced.spelling.letter.toUpperCase();
        });
        if (!refNote) return;

        const refPitch = refNote.pitch;

        // Calculate diatonic offset
        const offset = calcDiatonicOffset(targetPitch, refPitch);

        // Shift using harmonization module, returns VoicedNote[]
        const shiftedNotes = shiftChordDiatonic(voicedRefNotes, offset, snapshot.key);

        // Build HarmonizeSnapshot for existing toChordAst
        const harmonizeSnapshot: HarmonizeSnapshot = {
          key: snapshot.key,
          currentChord: null,
          measureAccidentals: convertMeasureAccidentals(measureAcc),
        };

        // Use existing toChordAst to convert VoicedNote[] -> Chord AST
        const { chordAst } = toChordAst(shiftedNotes, harmonizeSnapshot, ctx);

        // Apply rhythm and tie to the chord
        chordAst.rhythm = targetRhythm ? cloneExpr(targetRhythm, ctx) : undefined;
        chordAst.tie = targetTie ? cloneToken(targetTie, ctx) : undefined;

        // Convert to CSTree
        const newChordCS = fromAst(chordAst, ctx);

        // Replace target note with new chord and update cursor
        const parent = getParent(noteNode);
        if (parent) {
          replace(noteNode, newChordCS);
          cursor.delete(noteNode.id);
          cursor.add(newChordCS.id);
        }
      });
    }
  }

  return selection;
}

/**
 * Creates parallel chords from notes using chromatic shifts.
 *
 * For each selected note, we find a reference chord (previous or next in the same voice),
 * calculate the chromatic (semitone) offset from the reference chord's top MIDI pitch
 * to the target note's MIDI pitch, then shift all reference chord MIDI pitches by that
 * offset and spell them according to the current context.
 *
 * The target note's rhythm and tie are preserved on the new chord.
 * New accidentals are inserted into the snapshots array for subsequent notes.
 *
 * @param selection The selection containing Note node IDs
 * @param direction Whether to look for the reference chord before ("prev") or after ("next") the note
 * @param ctx ABCContext for generating node IDs
 * @param snapshots DocumentSnapshots for voice context lookup (mutated to insert new accidentals)
 * @param chordPositions ChordPosition array
 * @returns The modified selection
 */
export function parallelChromatic(
  selection: Selection,
  direction: ParallelDirection,
  ctx: ABCContext,
  snapshots: DocumentSnapshots,
  chordPositions: ChordPosition[]
): Selection {
  // Early return if no snapshots are available
  if (snapshots.length === 0) return selection;

  for (const cursor of selection.cursors) {
    const nodes = findNodesById(selection.root, cursor);

    for (const node of nodes) {
      traverseNotes(node, (noteNode) => {
        // Get position and snapshot
        // Use pos - 1 to get the snapshot BEFORE this note, not the one created
        // when this note was visited. This ensures we see the measure accidentals
        // as they were before this note was processed.
        const { line, char } = getNodeLineAndChar(noteNode);
        const pos = encode(line, char);
        const snapshot = getSnapshotAtPosition(snapshots, pos - 1);

        // Find reference chord
        let refChordPos: ChordPosition | null;
        if (direction === "prev") {
          refChordPos = findPreviousChordInVoice(chordPositions, snapshot.voiceId, pos);
        } else {
          refChordPos = findNextChordInVoice(chordPositions, snapshot.voiceId, pos);
        }

        if (refChordPos === null) return;

        // Early return if reference chord has no pitches
        const refMidis = refChordPos.midiPitches;
        if (refMidis.length === 0) return;

        // Get target pitch, rhythm, and tie
        const targetPitch = getPitch(noteNode);
        if (targetPitch === null) return;

        const targetRhythm = getRhythm(noteNode);
        const targetTie = getTie(noteNode);

        // Calculate target MIDI pitch
        const measureAcc = snapshot.measureAccidentals ?? new Map();
        const targetMidi = resolveMelodyPitch(
          targetPitch.noteLetter.lexeme.toUpperCase(),
          computeOctaveFromPitch(targetPitch),
          targetPitch.alteration?.lexeme ?? null,
          {
            key: snapshot.key,
            measureAccidentals: measureAcc,
            transpose: 0,
          }
        );

        // Reference lead is the highest MIDI pitch (already sorted, so last element)
        const refLeadMidi = refMidis[refMidis.length - 1];
        const chromaticShift = targetMidi - refLeadMidi;

        // Build note spellings from current context
        const measureAccidentalsSemitones = convertMeasureAccidentals(measureAcc);
        const noteSpellings = mergeAccidentals(snapshot.key, measureAccidentalsSemitones);

        // Shift chord chromatically using harmonization module
        const { notes: shiftedNotes, newAccidentals } = shiftChordChromatic(refMidis, chromaticShift, noteSpellings);

        if (shiftedNotes.length === 0) return;

        // Build HarmonizeSnapshot for existing toChordAst
        const harmonizeSnapshot: HarmonizeSnapshot = {
          key: snapshot.key,
          currentChord: null,
          measureAccidentals: convertMeasureAccidentals(measureAcc),
        };

        // Use existing toChordAst to convert VoicedNote[] -> Chord AST
        const { chordAst } = toChordAst(shiftedNotes, harmonizeSnapshot, ctx);

        // Apply rhythm and tie to the chord
        chordAst.rhythm = targetRhythm ? cloneExpr(targetRhythm, ctx) : undefined;
        chordAst.tie = targetTie ? cloneToken(targetTie, ctx) : undefined;

        // Convert to CSTree
        const newChordCS = fromAst(chordAst, ctx);

        // Replace target note and update cursor
        const parent = getParent(noteNode);
        if (parent) {
          replace(noteNode, newChordCS);
          cursor.delete(noteNode.id);
          cursor.add(newChordCS.id);
        }

        // Insert snapshot at correct sorted position with updated accidentals
        if (newAccidentals.length > 0) {
          const newMeasureAccidentals = new Map(measureAcc);
          for (const spelling of newAccidentals) {
            newMeasureAccidentals.set(spelling.letter, semitonesToAccidentalType(spelling.alteration));
          }

          insertSnapshotSorted(snapshots, pos, {
            ...snapshot,
            measureAccidentals: newMeasureAccidentals,
          });
        }
      });
    }
  }

  return selection;
}

/**
 * Creates parallel chords from notes by referencing a nearby chord.
 *
 * This is the unified entry point that dispatches to either diatonic or chromatic mode.
 *
 * @param selection The selection containing Note node IDs
 * @param direction Whether to look for the reference chord before ("prev") or after ("next") the note
 * @param mode Whether to use diatonic (scale degree) or chromatic (semitone) shifts
 * @param ctx ABCContext for generating node IDs
 * @param snapshots DocumentSnapshots for voice context lookup
 * @param chordPositions ChordPosition array (with includeAstChord enabled for diatonic mode)
 * @returns The modified selection
 */
export function parallelVoicing(
  selection: Selection,
  direction: ParallelDirection,
  mode: ParallelMode,
  ctx: ABCContext,
  snapshots: DocumentSnapshots,
  chordPositions: ChordPosition[]
): Selection {
  if (mode === "diatonic") {
    return parallelDiatonic(selection, direction, ctx, snapshots, chordPositions);
  } else {
    return parallelChromatic(selection, direction, ctx, snapshots, chordPositions);
  }
}
