import { Selection } from "../selection";
import { CSNode, TAGS, createCSNode } from "../csTree/types";
import { ABCContext, Pitch, TT, Token, Note } from "abc-parser";
import { toAst } from "../csTree/toAst";
import { fromAst } from "../csTree/fromAst";
import { findNodesById } from "./types";
import { findChildByTag, findParent, findTieChild, removeChild } from "./treeUtils";

const DIATONIC_LETTERS = "CDEFGAB";

/**
 * Converts an ABC Pitch AST node to a diatonic index (0-6) and octave number.
 * - Uppercase letters (C-B) are octave 4
 * - Lowercase letters (c-b) are octave 5
 * - Each comma lowers the octave by 1
 * - Each apostrophe raises the octave by 1
 */
export function pitchToDiatonic(pitch: Pitch): { index: number; octave: number } {
  const letter = pitch.noteLetter.lexeme;
  const baseIndex = DIATONIC_LETTERS.indexOf(letter.toUpperCase());

  const baseOctave = letter === letter.toLowerCase() ? 5 : 4;

  let octaveOffset = 0;
  if (pitch.octave) {
    for (const char of pitch.octave.lexeme) {
      if (char === "'") octaveOffset++;
      else if (char === ",") octaveOffset--;
    }
  }

  return { index: baseIndex, octave: baseOctave + octaveOffset };
}

/**
 * Converts a diatonic index and octave back to an ABC Pitch AST node.
 */
export function diatonicToPitch(
  index: number,
  octave: number,
  alteration: Token | undefined,
  ctx: ABCContext
): Pitch {
  const normalizedIndex = ((index % 7) + 7) % 7;
  let letter = DIATONIC_LETTERS[normalizedIndex];

  let octaveToken: Token | undefined;

  if (octave >= 5) {
    letter = letter.toLowerCase();
    const octaveOffset = octave - 5;
    if (octaveOffset > 0) {
      octaveToken = new Token(TT.OCTAVE, "'".repeat(octaveOffset), ctx.generateId());
    }
  } else {
    const octaveOffset = 4 - octave;
    if (octaveOffset > 0) {
      octaveToken = new Token(TT.OCTAVE, ",".repeat(octaveOffset), ctx.generateId());
    }
  }

  const noteLetterToken = new Token(TT.NOTE_LETTER, letter, ctx.generateId());

  return new Pitch(ctx.generateId(), {
    alteration: alteration,
    noteLetter: noteLetterToken,
    octave: octaveToken,
  });
}

/**
 * Steps a pitch diatonically by the given number of steps (positive = up, negative = down).
 * The alteration (accidental) is preserved from the original pitch.
 */
export function stepDiatonic(pitch: Pitch, steps: number, ctx: ABCContext): Pitch {
  const { index, octave } = pitchToDiatonic(pitch);

  const newIndex = index + steps;
  const octaveShift = Math.floor(newIndex / 7);
  const normalizedIndex = ((newIndex % 7) + 7) % 7;

  return diatonicToPitch(normalizedIndex, octave + octaveShift, pitch.alteration, ctx);
}

/**
 * Wraps a standalone note in a chord with its harmony note.
 * The rhythm and tie are moved from the note to the chord level.
 */
function wrapNoteInChord(root: CSNode, noteNode: CSNode, steps: number, ctx: ABCContext): void {
  const pitchResult = findChildByTag(noteNode, TAGS.Pitch);
  if (pitchResult === null) {
    return;
  }

  // Find the parent before we modify anything
  const parentResult = findParent(root, noteNode);
  if (parentResult === null) {
    return;
  }

  // Compute the harmony pitch
  const pitchExpr = toAst(pitchResult.node) as Pitch;
  const harmonyPitchExpr = stepDiatonic(pitchExpr, steps, ctx);

  // Create harmony note (pitch only, no rhythm/tie)
  const harmonyNoteExpr = new Note(ctx.generateId(), harmonyPitchExpr, undefined, undefined);
  const harmonyNoteCSNode = fromAst(harmonyNoteExpr, ctx);

  // Extract rhythm and tie from original note (will move to chord level)
  let rhythmNode: CSNode | null = null;
  let tieNode: CSNode | null = null;

  const rhythmResult = findChildByTag(noteNode, TAGS.Rhythm);
  if (rhythmResult !== null) {
    rhythmNode = rhythmResult.node;
    removeChild(noteNode, rhythmResult.prev, rhythmResult.node);
  }

  const tieResult = findTieChild(noteNode);
  if (tieResult !== null) {
    tieNode = tieResult.node;
    removeChild(noteNode, tieResult.prev, tieResult.node);
  }

  // Create chord CSNode
  const chordCSNode = createCSNode(TAGS.Chord, ctx.generateId(), { type: "empty" });

  // Create bracket tokens
  const leftBracketCSNode = fromAst(new Token(TT.CHRD_LEFT_BRKT, "[", ctx.generateId()), ctx);
  const rightBracketCSNode = fromAst(new Token(TT.CHRD_RIGHT_BRKT, "]", ctx.generateId()), ctx);

  // Save the original note's sibling (the chord will take its place in the tree)
  const originalNextSibling = noteNode.nextSibling;
  noteNode.nextSibling = null;

  // Build chord's child linked list: leftBracket -> note -> harmonyNote -> rightBracket -> rhythm? -> tie?
  chordCSNode.firstChild = leftBracketCSNode;
  leftBracketCSNode.nextSibling = noteNode;
  noteNode.nextSibling = harmonyNoteCSNode;
  harmonyNoteCSNode.nextSibling = rightBracketCSNode;

  let lastChild: CSNode = rightBracketCSNode;
  if (rhythmNode !== null) {
    lastChild.nextSibling = rhythmNode;
    lastChild = rhythmNode;
  }
  if (tieNode !== null) {
    lastChild.nextSibling = tieNode;
    lastChild = tieNode;
  }

  // The chord takes the note's position in the tree
  chordCSNode.nextSibling = originalNextSibling;

  // Update the parent to point to the chord instead of the note
  if (parentResult.prev === null) {
    parentResult.parent.firstChild = chordCSNode;
  } else {
    parentResult.prev.nextSibling = chordCSNode;
  }
}

/**
 * Adds harmony notes inside an existing chord.
 * For each note in the chord, a harmony note is created and inserted
 * immediately after it (to maintain note/harmony pairing order).
 */
function harmonizeChord(chordNode: CSNode, steps: number, ctx: ABCContext): void {
  // Collect all original notes in the chord (to avoid modifying while iterating)
  const notesToHarmonize: CSNode[] = [];
  let current = chordNode.firstChild;
  while (current !== null) {
    if (current.tag === TAGS.Note) {
      notesToHarmonize.push(current);
    }
    current = current.nextSibling;
  }

  // Create harmony notes for each original note
  const harmonyNotes: CSNode[] = [];
  for (const noteNode of notesToHarmonize) {
    const pitchResult = findChildByTag(noteNode, TAGS.Pitch);
    if (pitchResult === null) {
      continue;
    }

    const pitchExpr = toAst(pitchResult.node) as Pitch;
    const harmonyPitchExpr = stepDiatonic(pitchExpr, steps, ctx);

    const harmonyNoteExpr = new Note(ctx.generateId(), harmonyPitchExpr, undefined, undefined);
    harmonyNotes.push(fromAst(harmonyNoteExpr, ctx));
  }

  // Find the last original note in the chord
  let lastOriginalNote: CSNode | null = null;
  current = chordNode.firstChild;
  while (current !== null) {
    if (current.tag === TAGS.Note) {
      lastOriginalNote = current;
    }
    current = current.nextSibling;
  }

  if (lastOriginalNote === null || harmonyNotes.length === 0) {
    return;
  }

  // Insert all harmony notes after the last original note
  // This produces [C E A c] from [C A] with +2 steps (E follows C, c follows A)
  const afterLastNote = lastOriginalNote.nextSibling;
  let lastInserted = lastOriginalNote;
  for (const harmonyNote of harmonyNotes) {
    lastInserted.nextSibling = harmonyNote;
    lastInserted = harmonyNote;
  }
  lastInserted.nextSibling = afterLastNote;
}

/**
 * Harmonizes selected notes by adding a parallel harmony voice at the specified interval.
 *
 * @param selection - The selection containing cursor IDs pointing to Notes or Chords
 * @param steps - The number of diatonic steps to shift (positive = up, negative = down)
 *   - 3rd: ±2 steps
 *   - 4th: ±3 steps
 *   - 5th: ±4 steps
 *   - 6th: ±5 steps
 * @param ctx - The ABC context for generating IDs
 * @returns The modified selection
 */
export function harmonize(selection: Selection, steps: number, ctx: ABCContext): Selection {
  if (steps === 0) {
    return selection;
  }

  for (const cursor of selection.cursors) {
    const nodes = findNodesById(selection.root, cursor);
    for (const csNode of nodes) {
      if (csNode.tag === TAGS.Note) {
        wrapNoteInChord(selection.root, csNode, steps, ctx);
      } else if (csNode.tag === TAGS.Chord) {
        harmonizeChord(csNode, steps, ctx);
      }
    }
  }

  return selection;
}
