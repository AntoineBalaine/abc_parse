import { Selection } from "../selection";
import { CSNode, TAGS, isTokenNode, getTokenData } from "../csTree/types";
import {
  ABCContext,
  Pitch,
  Token,
  TT,
  resolveMelodyPitch,
  accidentalTypeToSemitones,
  semitonesToAccidentalString,
  semitonesToAccidentalType,
  spellPitch,
  mergeAccidentals,
  computeOctaveFromPitch,
  Spelling,
} from "abc-parser";
import { AccidentalType } from "abc-parser/types/abcjs-ast";
import { DocumentSnapshots, ContextSnapshot, getSnapshotAtPosition, encode } from "abc-parser/interpreter/ContextInterpreter";
import { toAst } from "../csTree/toAst";
import { fromAst } from "../csTree/fromAst";
import { findNodesById } from "./types";
import { findChildByTag, replaceChild, getNodeLineAndChar } from "./treeUtils";
import { insertSnapshotSorted } from "./parallel";

/**
 * Transposes selected notes by the specified number of semitones.
 *
 * This transform uses context-aware note spelling, taking into account:
 * - The key signature at each note's position
 * - Measure accidentals that have been established
 * - The direction of transposition for chromatic notes
 *
 * For octave transpositions (multiples of 12 semitones), the original
 * spelling is preserved exactly, only adjusting the octave markers.
 *
 * @param selection The selection containing Note or Chord node IDs
 * @param semitones The number of semitones to transpose (positive = up, negative = down)
 * @param ctx ABCContext for generating node IDs
 * @param snapshots DocumentSnapshots for context-aware spelling
 * @returns The modified selection
 */
export function transpose(selection: Selection, semitones: number, ctx: ABCContext, snapshots: DocumentSnapshots): Selection {
  if (semitones === 0) return selection;

  for (const cursor of selection.cursors) {
    const nodes = findNodesById(selection.root, cursor);
    for (const csNode of nodes) {
      if (csNode.tag === TAGS.Note) {
        transposePitchChild(csNode, semitones, ctx, snapshots);
      } else if (csNode.tag === TAGS.Chord) {
        let current = csNode.firstChild;
        while (current !== null) {
          if (current.tag === TAGS.Note) {
            transposePitchChild(current, semitones, ctx, snapshots);
          }
          current = current.nextSibling;
        }
      }
    }
  }
  return selection;
}

/**
 * Transposes a pitch child node within a note using context-aware spelling.
 */
function transposePitchChild(noteNode: CSNode, semitones: number, ctx: ABCContext, snapshots: DocumentSnapshots): void {
  const pitchResult = findChildByTag(noteNode, TAGS.Pitch);
  if (pitchResult === null) return;

  const pitchCSNode = pitchResult.node;
  const pitchExpr = toAst(pitchCSNode) as Pitch;

  // Extract pitch components
  const letter = pitchExpr.noteLetter.lexeme.toUpperCase();
  const octave = computeOctaveFromPitch(pitchExpr);
  const explicitAcc = pitchExpr.alteration ? pitchExpr.alteration.lexeme : null;

  const { line, char } = getNodeLineAndChar(noteNode);
  const pos = encode(line, char);
  const snapshot = getSnapshotAtPosition(snapshots, pos - 1);

  transposePitchWithContext(noteNode, pitchResult, pitchExpr, letter, octave, explicitAcc, semitones, snapshot, snapshots, ctx);
}

/**
 * Transposes a pitch using context-aware spelling.
 */
function transposePitchWithContext(
  noteNode: CSNode,
  pitchResult: { node: CSNode; prev: CSNode | null },
  pitchExpr: Pitch,
  letter: string,
  octave: number,
  explicitAcc: string | null,
  semitones: number,
  snapshot: ContextSnapshot,
  snapshots: DocumentSnapshots,
  ctx: ABCContext
): void {
  // Resolve original MIDI considering context
  const pitchContext = { key: snapshot.key, measureAccidentals: snapshot.measureAccidentals, transpose: 0 };
  const originalMidi = resolveMelodyPitch(letter, octave, explicitAcc, pitchContext);
  const targetMidi = originalMidi + semitones;

  // Validate MIDI range
  if (targetMidi < 0 || targetMidi > 127) return;

  // Special case: octave transposition preserves spelling exactly
  if (semitones % 12 === 0) {
    const octaveChange = semitones / 12;
    const newOctave = octave + octaveChange;
    const newPitchExpr = octaviate(pitchExpr, newOctave, ctx);
    const newPitchCSNode = fromAst(newPitchExpr, ctx);
    replaceChild(noteNode, pitchResult.prev, pitchResult.node, newPitchCSNode);
    return;
  }

  // Convert measure accidentals and merge with key signature
  const measureAccidentalsSemitones = convertMeasureAccidentalsToSemitones(snapshot.measureAccidentals);
  const noteSpellings = mergeAccidentals(snapshot.key, measureAccidentalsSemitones);

  // Get the correct spelling for the target pitch
  const spelling = spellPitch(targetMidi, noteSpellings, semitones);

  // Check if we need to write an explicit accidental
  const contextAlteration = noteSpellings[spelling.letter];
  const needsExplicitAccidental = spelling.alteration !== contextAlteration;

  // Build new Pitch AST and replace in tree
  const newPitchExpr = spellingToPitch(spelling, targetMidi, needsExplicitAccidental, ctx);
  const newPitchCSNode = fromAst(newPitchExpr, ctx);
  replaceChild(noteNode, pitchResult.prev, pitchResult.node, newPitchCSNode);

  // If we wrote an explicit accidental, insert a snapshot at the correct sorted position
  // so subsequent notes see the updated measure accidentals
  if (needsExplicitAccidental) {
    const originalPos = encode(getNodeLineAndChar(noteNode).line, getNodeLineAndChar(noteNode).char);
    const newMeasureAccidentals = new Map(snapshot.measureAccidentals ?? []);
    newMeasureAccidentals.set(spelling.letter, semitonesToAccidentalType(spelling.alteration));
    insertSnapshotSorted(snapshots, originalPos, {
      ...snapshot,
      measureAccidentals: newMeasureAccidentals,
    });
  }
}

/**
 * Converts ContextSnapshot.measureAccidentals (AccidentalType) to semitones.
 */
function convertMeasureAccidentalsToSemitones(measureAccidentals: Map<string, AccidentalType> | undefined): Map<string, number> | null {
  if (!measureAccidentals) return null;
  const result = new Map<string, number>();
  for (const [letter, accType] of measureAccidentals) {
    result.set(letter, accidentalTypeToSemitones(accType));
  }
  return result;
}

/**
 * Creates a new Pitch AST node preserving the original letter and accidental,
 * only adjusting the octave. Used for octave transpositions.
 *
 * @param pitchExpr The original Pitch AST node
 * @param newOctave The target octave number
 * @param ctx ABCContext for generating node IDs
 * @returns A new Pitch AST node with the adjusted octave
 */
function octaviate(pitchExpr: Pitch, newOctave: number, ctx: ABCContext): Pitch {
  const originalLetter = pitchExpr.noteLetter.lexeme;

  // Determine new letter case and octave markers based on newOctave
  let letterStr: string;
  let octaveStr: string;

  if (newOctave <= 4) {
    letterStr = originalLetter.toUpperCase();
    octaveStr = ",".repeat(4 - newOctave);
  } else {
    letterStr = originalLetter.toLowerCase();
    octaveStr = "'".repeat(newOctave - 5);
  }

  const letterToken = new Token(TT.NOTE_LETTER, letterStr, ctx.generateId());
  const octaveToken = octaveStr !== "" ? new Token(TT.OCTAVE, octaveStr, ctx.generateId()) : undefined;

  // Copy accidental token if present (preserve the original accidental exactly)
  let accidentalToken: Token | undefined;
  if (pitchExpr.alteration) {
    accidentalToken = new Token(TT.ACCIDENTAL, pitchExpr.alteration.lexeme, ctx.generateId());
  }

  return new Pitch(ctx.generateId(), {
    alteration: accidentalToken,
    noteLetter: letterToken,
    octave: octaveToken,
  });
}

/**
 * Builds a Pitch AST node from a spelling and target MIDI pitch.
 *
 * @param spelling The spelling (letter and alteration)
 * @param targetMidi The target MIDI pitch (used to determine octave)
 * @param needsExplicitAccidental Whether to include an explicit accidental token
 * @param ctx ABCContext for generating node IDs
 * @returns A new Pitch AST node
 */
function spellingToPitch(spelling: Spelling, targetMidi: number, needsExplicitAccidental: boolean, ctx: ABCContext): Pitch {
  const octave = Math.floor(targetMidi / 12) - 1;

  // Create accidental token only if needed
  let accidentalToken: Token | undefined;
  if (needsExplicitAccidental) {
    accidentalToken = new Token(TT.ACCIDENTAL, semitonesToAccidentalString(spelling.alteration), ctx.generateId());
  }

  // Create note letter (case determines base octave in ABC notation)
  let letterStr: string;
  let octaveStr: string;

  if (octave <= 4) {
    letterStr = spelling.letter.toUpperCase();
    octaveStr = ",".repeat(4 - octave);
  } else {
    letterStr = spelling.letter.toLowerCase();
    octaveStr = "'".repeat(octave - 5);
  }

  const letterToken = new Token(TT.NOTE_LETTER, letterStr, ctx.generateId());
  const octaveToken = octaveStr !== "" ? new Token(TT.OCTAVE, octaveStr, ctx.generateId()) : undefined;

  return new Pitch(ctx.generateId(), {
    alteration: accidentalToken,
    noteLetter: letterToken,
    octave: octaveToken,
  });
}
