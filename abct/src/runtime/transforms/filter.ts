// Filter Transform
// Removes elements from a selection that do not match a predicate

import {
  isNote, isChord, isPitch, isToken, isBeam, isGraceGroup,
  toMidiPitch, Expr, Note, Chord, Pitch, Beam, Grace_group,
  Tune, Tune_Body, Token,
} from "abc-parser";
import { Selection } from "../types";
import { Comparison, ComparisonOp, isIdentifier, isNumberLiteral } from "../../ast";

/**
 * Parsed filter predicate containing the property to check,
 * the comparison operator, and the value to compare against.
 */
export interface FilterPredicate {
  property: string;
  op: ComparisonOp;
  value: number; // MIDI pitch value or numeric value
}

/**
 * Parse a pitch literal string to a MIDI pitch value.
 * Supports scientific notation: C, D, E, F, G, A, B with optional accidentals (#, b)
 * and optional octave number.
 * - Uppercase letters without octave = octave 4 (C = C4 = MIDI 60)
 * - Lowercase letters without octave = octave 5 (c = C5 = MIDI 72)
 * - With octave number: C4, D#5, Gb3, etc.
 */
export function parsePitchLiteral(value: string): number | null {
  // Scientific notation pattern: note letter, optional accidental, octave number
  const scientificMatch = value.match(/^([A-Ga-g])([#b])?(\d+)?$/);
  if (scientificMatch) {
    const [, letter, accidental, octaveStr] = scientificMatch;
    const isLowercase = letter === letter.toLowerCase();
    const normalizedLetter = letter.toUpperCase();

    // Base MIDI values for middle C = 60 (C4)
    const noteValues: Record<string, number> = {
      'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11
    };

    let midiPitch = noteValues[normalizedLetter];
    if (midiPitch === undefined) return null;

    // Apply accidental
    if (accidental === '#') midiPitch += 1;
    else if (accidental === 'b') midiPitch -= 1;

    // Determine octave
    let octave: number;
    if (octaveStr) {
      octave = parseInt(octaveStr, 10);
    } else {
      // Default: uppercase = C4 octave, lowercase = C5 octave
      octave = isLowercase ? 5 : 4;
    }

    // MIDI pitch = 12 * (octave + 1) + note value
    midiPitch = 12 * (octave + 1) + midiPitch;

    return midiPitch;
  }

  return null;
}

/**
 * Parse a filter predicate from a Comparison AST node.
 */
export function parseFilterPredicate(comparison: Comparison): FilterPredicate | null {
  // Left side should be an identifier (property name)
  if (!isIdentifier(comparison.left)) {
    return null;
  }
  const property = comparison.left.name;

  // Right side should be an identifier (pitch literal) or number
  let value: number;
  if (isIdentifier(comparison.right)) {
    // Try to parse as pitch literal
    const pitchValue = parsePitchLiteral(comparison.right.name);
    if (pitchValue === null) {
      return null;
    }
    value = pitchValue;
  } else if (isNumberLiteral(comparison.right)) {
    // Handle fractions (e.g., "1/2"), decimals (e.g., "3.14"), and integers
    const numStr = comparison.right.value;
    if (numStr.includes("/")) {
      const [num, denom] = numStr.split("/").map(Number);
      value = num / denom;
    } else {
      value = Number(numStr);
    }
  } else {
    return null;
  }

  return {
    property,
    op: comparison.op,
    value,
  };
}

/**
 * Evaluate a comparison operation.
 */
function evaluateComparison(left: number, op: ComparisonOp, right: number): boolean {
  switch (op) {
    case '>': return left > right;
    case '<': return left < right;
    case '>=': return left >= right;
    case '<=': return left <= right;
    case '==': return left === right;
    case '!=': return left !== right;
    default: return false;
  }
}

/**
 * Get the value of a property from a note for comparison.
 */
function getNotePropertyValue(note: Note, property: string): number | null {
  switch (property.toLowerCase()) {
    case 'pitch':
      if (isPitch(note.pitch)) {
        return toMidiPitch(note.pitch as Pitch);
      }
      return null;
    default:
      return null;
  }
}

/**
 * Get the value of a property from a chord for comparison.
 */
function getChordPropertyValue(chord: Chord, property: string): number | null {
  switch (property.toLowerCase()) {
    case 'size':
    case 'length':
      // Count notes in the chord
      let noteCount = 0;
      for (const element of chord.contents) {
        if (isNote(element)) {
          noteCount++;
        }
      }
      return noteCount;
    default:
      return null;
  }
}

/**
 * Check if a note matches the filter predicate.
 */
function noteMatchesPredicate(note: Note, predicate: FilterPredicate): boolean {
  const value = getNotePropertyValue(note, predicate.property);
  if (value === null) return true; // If we can't get the property, keep the note
  return evaluateComparison(value, predicate.op, predicate.value);
}

/**
 * Check if a chord matches the filter predicate.
 */
function chordMatchesPredicate(chord: Chord, predicate: FilterPredicate): boolean {
  const value = getChordPropertyValue(chord, predicate.property);
  if (value === null) return true; // If we can't get the property, keep the chord
  return evaluateComparison(value, predicate.op, predicate.value);
}

/**
 * Filter notes within a chord based on a pitch predicate.
 * Mutates the chord in place.
 * Returns true if the chord has notes remaining, false if it became empty.
 */
function filterNotesInChord(chord: Chord, predicate: FilterPredicate): boolean {
  if (predicate.property.toLowerCase() !== 'pitch') {
    return true; // Non-pitch predicates don't filter within chords
  }

  const filteredContents: (Note | Token)[] = [];
  let hasNotes = false;

  for (const element of chord.contents) {
    if (isNote(element)) {
      if (noteMatchesPredicate(element, predicate)) {
        filteredContents.push(element);
        hasNotes = true;
      }
    } else {
      // Keep non-note elements (tokens, etc.)
      filteredContents.push(element as Token);
    }
  }

  chord.contents = filteredContents;
  return hasNotes;
}

/**
 * Apply filter predicate to a selection.
 * This is the main filter function that operates on selections.
 *
 * Semantics:
 * - For notes: removes notes that don't match the predicate
 * - For chords with pitch predicate: filters notes within chords
 * - For chords with size predicate: removes chords that don't match
 */
export function applyFilter(selection: Selection, predicate: FilterPredicate): void {
  const property = predicate.property.toLowerCase();

  // Track chords that become empty after filtering and should be removed
  const emptyChordsToRemove = new Set<Expr>();

  // For pitch predicates on a selection, we need to:
  // 1. Filter standalone notes
  // 2. Filter notes within chords (and track empty chords)
  if (property === 'pitch') {
    for (const node of selection.selected) {
      if (isChord(node)) {
        const hasNotes = filterNotesInChord(node as Chord, predicate);
        if (!hasNotes) {
          emptyChordsToRemove.add(node);
        }
      }
    }

    // For notes in the selection, we need to remove from their parent containers
    // This is done by traversing the AST and removing non-matching notes
    removeNonMatchingNodesFromAst(selection, predicate, emptyChordsToRemove);
  }

  // For size predicates on chords
  if (property === 'size' || property === 'length') {
    removeNonMatchingChordsFromAst(selection, predicate);
  }
}

/**
 * Remove non-matching notes from the AST.
 * This traverses the tune body and removes notes that don't match the predicate.
 * Also removes any empty chords (chords that had all their notes filtered out).
 */
function removeNonMatchingNodesFromAst(
  selection: Selection,
  predicate: FilterPredicate,
  emptyChordsToRemove: Set<Expr>
): void {
  const ast = selection.ast;

  for (const content of ast.contents) {
    if (isToken(content)) continue;

    const tune = content as Tune;
    if (!tune.tune_body) continue;

    removeNodesFromTuneBody(tune.tune_body, selection.selected, predicate, emptyChordsToRemove);
  }
}

/**
 * Remove non-matching notes from a tune body.
 * Also removes empty chords (chords that had all notes filtered out).
 */
function removeNodesFromTuneBody(
  body: Tune_Body,
  selected: Set<Expr>,
  predicate: FilterPredicate,
  emptyChordsToRemove: Set<Expr>
): void {
  for (const system of body.sequence) {
    // Filter in place - we need to modify the array
    let writeIndex = 0;
    for (let i = 0; i < system.length; i++) {
      const element = system[i];

      if (isToken(element)) {
        system[writeIndex++] = element;
        continue;
      }

      if (isNote(element)) {
        // Only filter if the note is in our selection
        if (selected.has(element)) {
          if (noteMatchesPredicate(element, predicate)) {
            system[writeIndex++] = element;
          }
          // else: skip (remove) this note
        } else {
          system[writeIndex++] = element;
        }
        continue;
      }

      if (isChord(element)) {
        // Remove chords that became empty after filtering
        if (emptyChordsToRemove.has(element)) {
          continue; // Skip this chord
        }
        system[writeIndex++] = element;
        continue;
      }

      if (isBeam(element)) {
        filterBeamContents(element as Beam, selected, predicate, emptyChordsToRemove);
        system[writeIndex++] = element;
        continue;
      }

      if (isGraceGroup(element)) {
        filterGraceGroupContents(element as Grace_group, selected, predicate);
        system[writeIndex++] = element;
        continue;
      }

      // Keep other elements
      system[writeIndex++] = element;
    }

    // Truncate the array to remove filtered elements
    system.length = writeIndex;
  }
}

/**
 * Filter notes within a beam based on the predicate.
 * Also removes chords that became empty after filtering.
 */
function filterBeamContents(
  beam: Beam,
  selected: Set<Expr>,
  predicate: FilterPredicate,
  emptyChordsToRemove: Set<Expr>
): void {
  let writeIndex = 0;
  for (let i = 0; i < beam.contents.length; i++) {
    const element = beam.contents[i];

    if (isToken(element)) {
      beam.contents[writeIndex++] = element;
      continue;
    }

    if (isNote(element)) {
      if (selected.has(element)) {
        if (noteMatchesPredicate(element, predicate)) {
          beam.contents[writeIndex++] = element;
        }
      } else {
        beam.contents[writeIndex++] = element;
      }
      continue;
    }

    if (isChord(element)) {
      // Remove chords that became empty after filtering
      if (emptyChordsToRemove.has(element)) {
        continue; // Skip this chord
      }
      beam.contents[writeIndex++] = element;
      continue;
    }

    // Keep other elements
    beam.contents[writeIndex++] = element;
  }

  beam.contents.length = writeIndex;
}

/**
 * Filter notes within a grace group based on the predicate.
 */
function filterGraceGroupContents(
  graceGroup: Grace_group,
  selected: Set<Expr>,
  predicate: FilterPredicate
): void {
  let writeIndex = 0;
  for (let i = 0; i < graceGroup.notes.length; i++) {
    const element = graceGroup.notes[i];

    if (isToken(element)) {
      graceGroup.notes[writeIndex++] = element;
      continue;
    }

    if (isNote(element)) {
      if (selected.has(element)) {
        if (noteMatchesPredicate(element, predicate)) {
          graceGroup.notes[writeIndex++] = element;
        }
      } else {
        graceGroup.notes[writeIndex++] = element;
      }
      continue;
    }

    // Keep other elements
    graceGroup.notes[writeIndex++] = element;
  }

  graceGroup.notes.length = writeIndex;
}

/**
 * Remove non-matching chords from the AST based on size predicate.
 */
function removeNonMatchingChordsFromAst(selection: Selection, predicate: FilterPredicate): void {
  const ast = selection.ast;

  for (const content of ast.contents) {
    if (isToken(content)) continue;

    const tune = content as Tune;
    if (!tune.tune_body) continue;

    removeChordsFromTuneBody(tune.tune_body, selection.selected, predicate);
  }
}

/**
 * Remove non-matching chords from a tune body.
 */
function removeChordsFromTuneBody(
  body: Tune_Body,
  selected: Set<Expr>,
  predicate: FilterPredicate
): void {
  for (const system of body.sequence) {
    let writeIndex = 0;
    for (let i = 0; i < system.length; i++) {
      const element = system[i];

      if (isToken(element)) {
        system[writeIndex++] = element;
        continue;
      }

      if (isChord(element)) {
        if (selected.has(element)) {
          if (chordMatchesPredicate(element as Chord, predicate)) {
            system[writeIndex++] = element;
          }
        } else {
          system[writeIndex++] = element;
        }
        continue;
      }

      if (isBeam(element)) {
        filterChordsInBeam(element as Beam, selected, predicate);
        system[writeIndex++] = element;
        continue;
      }

      // Keep other elements
      system[writeIndex++] = element;
    }

    system.length = writeIndex;
  }
}

/**
 * Filter chords within a beam based on size predicate.
 */
function filterChordsInBeam(beam: Beam, selected: Set<Expr>, predicate: FilterPredicate): void {
  let writeIndex = 0;
  for (let i = 0; i < beam.contents.length; i++) {
    const element = beam.contents[i];

    if (isToken(element)) {
      beam.contents[writeIndex++] = element;
      continue;
    }

    if (isChord(element)) {
      if (selected.has(element)) {
        if (chordMatchesPredicate(element as Chord, predicate)) {
          beam.contents[writeIndex++] = element;
        }
      } else {
        beam.contents[writeIndex++] = element;
      }
      continue;
    }

    // Keep other elements (notes, etc.)
    beam.contents[writeIndex++] = element;
  }

  beam.contents.length = writeIndex;
}

export default applyFilter;
