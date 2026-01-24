// ABCT Selector Implementations
// Functions that select subsets of nodes from an ABC AST

import {
  isChord, isNote, isBeam, isGraceGroup, isBarLine, isInfo_line, isInline_field, isToken,
  File_structure, Expr, Tune, Tune_Body, Beam, Chord, Note, Grace_group,
  Info_line, Inline_field, isVoiceInfo, Pitch, Token,
} from "abc-parser";
import { Selection } from "./types";
import { getNoteMidiPitch } from "./utils/pitch";

/**
 * Location information for filtering by line/column.
 */
export interface LocationFilter {
  line: number;
  col?: number;
  end?: {
    type: "singleline" | "multiline";
    endCol?: number;
    endLine?: number;
  };
}

/**
 * Select all Chord nodes from an ABC AST.
 * Chords are notated as [CEG] in ABC - multiple notes played simultaneously.
 */
export function selectChords(ast: File_structure): Selection {
  const selected = new Set<Expr>();

  for (const content of ast.contents) {
    if (isToken(content)) continue;
    collectChordsFromTune(content, selected);
  }

  return { ast, selected };
}

/**
 * Select all Note nodes from an ABC AST.
 * This includes notes inside beams, grace groups, and chords.
 */
export function selectNotes(ast: File_structure): Selection {
  const selected = new Set<Expr>();

  for (const content of ast.contents) {
    if (isToken(content)) continue;
    collectNotesFromTune(content, selected);
  }

  return { ast, selected };
}

/**
 * Select all nodes belonging to a specific voice.
 * Voice is determined by V: info line or inline field declarations.
 *
 * @param ast - The ABC AST
 * @param voiceName - The voice identifier (e.g., "melody", "1", "soprano")
 */
export function selectVoice(ast: File_structure, voiceName: string): Selection {
  const selected = new Set<Expr>();

  for (const content of ast.contents) {
    if (isToken(content)) continue;
    collectVoiceNodes(content, voiceName, selected);
  }

  return { ast, selected };
}

/**
 * Select all nodes within a measure range (1-indexed).
 * Measures are delimited by bar lines.
 *
 * @param ast - The ABC AST
 * @param start - Start measure number (inclusive, 1-indexed)
 * @param end - End measure number (inclusive, 1-indexed)
 */
export function selectMeasures(
  ast: File_structure,
  start: number,
  end: number
): Selection {
  // Validate parameters
  if (!Number.isInteger(start) || start < 1) {
    throw new Error(`Invalid start measure: ${start}. Must be a positive integer.`);
  }
  if (!Number.isInteger(end) || end < 1) {
    throw new Error(`Invalid end measure: ${end}. Must be a positive integer.`);
  }
  if (start > end) {
    throw new Error(`Invalid measure range: start (${start}) must be <= end (${end}).`);
  }

  const selected = new Set<Expr>();

  for (const content of ast.contents) {
    if (isToken(content)) continue;
    collectMeasureNodes(content, start, end, selected);
  }

  return { ast, selected };
}

// ============================================================================
// Helper functions for collecting nodes
// ============================================================================

function collectChordsFromTune(tune: Tune, selected: Set<Expr>): void {
  if (!tune.tune_body) return;
  collectChordsFromBody(tune.tune_body, selected);
}

function collectChordsFromBody(body: Tune_Body, selected: Set<Expr>): void {
  for (const system of body.sequence) {
    for (const element of system) {
      if (isToken(element)) continue;

      if (isChord(element)) {
        selected.add(element);
      } else if (isBeam(element)) {
        collectChordsFromBeam(element, selected);
      } else if (isGraceGroup(element)) {
        // Grace groups typically don't contain chords, but check anyway
        collectChordsFromGraceGroup(element, selected);
      }
    }
  }
}

function collectChordsFromBeam(beam: Beam, selected: Set<Expr>): void {
  for (const element of beam.contents) {
    if (isToken(element)) continue;

    if (isChord(element)) {
      selected.add(element);
    } else if (isGraceGroup(element)) {
      collectChordsFromGraceGroup(element, selected);
    }
  }
}

function collectChordsFromGraceGroup(
  graceGroup: Grace_group,
  selected: Set<Expr>
): void {
  // Grace groups contain notes, not typically chords, but walk anyway
  for (const element of graceGroup.notes) {
    if (isToken(element)) continue;
    // Note: Grace_group.notes contains Note | Token, not Chord
    // So this is essentially a no-op for chords
  }
}

function collectNotesFromTune(tune: Tune, selected: Set<Expr>): void {
  if (!tune.tune_body) return;
  collectNotesFromBody(tune.tune_body, selected);
}

function collectNotesFromBody(body: Tune_Body, selected: Set<Expr>): void {
  for (const system of body.sequence) {
    for (const element of system) {
      if (isToken(element)) continue;

      if (isNote(element)) {
        selected.add(element);
      } else if (isChord(element)) {
        collectNotesFromChord(element, selected);
      } else if (isBeam(element)) {
        collectNotesFromBeam(element, selected);
      } else if (isGraceGroup(element)) {
        collectNotesFromGraceGroup(element, selected);
      }
    }
  }
}

function collectNotesFromChord(chord: Chord, selected: Set<Expr>): void {
  for (const element of chord.contents) {
    if (isNote(element)) {
      selected.add(element);
    }
  }
}

function collectNotesFromBeam(beam: Beam, selected: Set<Expr>): void {
  for (const element of beam.contents) {
    if (isToken(element)) continue;

    if (isNote(element)) {
      selected.add(element);
    } else if (isChord(element)) {
      collectNotesFromChord(element, selected);
    } else if (isGraceGroup(element)) {
      collectNotesFromGraceGroup(element, selected);
    }
  }
}

function collectNotesFromGraceGroup(
  graceGroup: Grace_group,
  selected: Set<Expr>
): void {
  for (const element of graceGroup.notes) {
    if (isNote(element)) {
      selected.add(element);
    }
  }
}

function collectVoiceNodes(
  tune: Tune,
  voiceName: string,
  selected: Set<Expr>
): void {
  if (!tune.tune_body) return;

  // Track current voice as we walk through the tune body
  let currentVoice: string | null = null;

  // Check if this is a single-voice tune (no V: declarations)
  // In that case, if voiceName matches "1" or default, select everything
  const hasVoiceDeclarations = tuneHasVoiceDeclarations(tune);

  if (!hasVoiceDeclarations) {
    // Single voice tune - select all if voiceName is "1" or empty
    if (voiceName === "1" || voiceName === "") {
      collectAllMusicFromBody(tune.tune_body, selected);
    }
    return;
  }

  for (const system of tune.tune_body.sequence) {
    for (const element of system) {
      if (isToken(element)) continue;

      // Check for voice change markers
      if (isInfo_line(element) || isInline_field(element)) {
        const voiceId = getVoiceId(element);
        if (voiceId !== null) {
          currentVoice = voiceId;
        }
        continue;
      }

      // If we're in the target voice, collect music elements
      if (currentVoice === voiceName) {
        if (isNote(element) || isChord(element)) {
          selected.add(element);
        } else if (isBeam(element)) {
          collectAllFromBeam(element, selected);
        } else if (isGraceGroup(element)) {
          collectAllFromGraceGroup(element, selected);
        }
      }
    }
  }
}

function tuneHasVoiceDeclarations(tune: Tune): boolean {
  // Check header for voice declarations
  for (const line of tune.tune_header.info_lines) {
    if (isInfo_line(line) && line.key.lexeme === "V:") {
      return true;
    }
  }

  // Check body for inline voice changes
  if (tune.tune_body) {
    for (const system of tune.tune_body.sequence) {
      for (const element of system) {
        if (
          (isInfo_line(element) && element.key.lexeme === "V:") ||
          (isInline_field(element) && element.field.lexeme === "V:")
        ) {
          return true;
        }
      }
    }
  }

  return false;
}

function getVoiceId(element: Info_line | Inline_field): string | null {
  if (isInfo_line(element)) {
    if (element.key.lexeme !== "V:") return null;
    // Parse voice ID from the value tokens
    if (element.parsed && isVoiceInfo(element.parsed)) {
      return element.parsed.data.id;
    }
    // Fallback: use first value token as voice ID
    if (element.value.length > 0) {
      return element.value[0].lexeme.trim();
    }
  } else if (isInline_field(element)) {
    if (element.field.lexeme !== "V:") return null;
    // Inline field text contains the voice ID
    if (element.text.length > 0) {
      return element.text[0].lexeme.trim();
    }
  }
  return null;
}

function collectAllMusicFromBody(body: Tune_Body, selected: Set<Expr>): void {
  for (const system of body.sequence) {
    for (const element of system) {
      if (isToken(element)) continue;

      if (isNote(element) || isChord(element)) {
        selected.add(element);
      } else if (isBeam(element)) {
        collectAllFromBeam(element, selected);
      } else if (isGraceGroup(element)) {
        collectAllFromGraceGroup(element, selected);
      }
    }
  }
}

function collectAllFromBeam(beam: Beam, selected: Set<Expr>): void {
  for (const element of beam.contents) {
    if (isToken(element)) continue;

    if (isNote(element) || isChord(element)) {
      selected.add(element);
    } else if (isGraceGroup(element)) {
      collectAllFromGraceGroup(element, selected);
    }
  }
}

function collectAllFromGraceGroup(
  graceGroup: Grace_group,
  selected: Set<Expr>
): void {
  for (const element of graceGroup.notes) {
    if (isNote(element)) {
      selected.add(element);
    }
  }
}

function collectMeasureNodes(
  tune: Tune,
  start: number,
  end: number,
  selected: Set<Expr>
): void {
  if (!tune.tune_body) return;

  // Track current measure number (1-indexed)
  // The music before the first barline is measure 1
  let currentMeasure = 1;

  for (const system of tune.tune_body.sequence) {
    for (const element of system) {
      if (isToken(element)) continue;

      // Check for bar line (advances measure counter)
      if (isBarLine(element)) {
        currentMeasure++;
        continue;
      }

      // If we're in the target measure range, collect music elements
      if (currentMeasure >= start && currentMeasure <= end) {
        if (isNote(element) || isChord(element)) {
          selected.add(element);
        } else if (isBeam(element)) {
          collectAllFromBeam(element, selected);
        } else if (isGraceGroup(element)) {
          collectAllFromGraceGroup(element, selected);
        }
      }
    }
  }
}

// ============================================================================
// Scoped selector functions - operate on an existing Selection
// Used for nested updates like @chords |= (@notes |= ...)
// ============================================================================

/**
 * Select notes from within an existing selection's nodes.
 * Used for nested updates like @chords |= (@notes |= ...).
 */
export function selectNotesFromSelection(selection: Selection): Selection {
  const selected = new Set<Expr>();

  for (const node of selection.selected) {
    if (isNote(node)) {
      // Node is already a note
      selected.add(node);
    } else if (isChord(node)) {
      // Collect notes from within the chord
      collectNotesFromChord(node, selected);
    } else if (isBeam(node)) {
      // Collect notes from within the beam
      collectNotesFromBeam(node, selected);
    } else if (isGraceGroup(node)) {
      // Collect notes from within the grace group
      collectNotesFromGraceGroup(node, selected);
    }
  }

  return { ast: selection.ast, selected };
}

/**
 * Select chords from within an existing selection's nodes.
 * Used for nested updates.
 */
export function selectChordsFromSelection(selection: Selection): Selection {
  const selected = new Set<Expr>();

  for (const node of selection.selected) {
    if (isChord(node)) {
      // Node is already a chord
      selected.add(node);
    } else if (isBeam(node)) {
      // Collect chords from within the beam
      collectChordsFromBeam(node, selected);
    }
  }

  return { ast: selection.ast, selected };
}

// ============================================================================
// Bass selector functions - select the lowest note from chords
// ============================================================================

/**
 * Select the bass note (lowest-pitched note) from each chord in an ABC AST.
 * Single notes are skipped - this selector only operates on chords.
 *
 * @param ast - The ABC AST
 */
export function selectBass(ast: File_structure): Selection {
  const selected = new Set<Expr>();

  for (const content of ast.contents) {
    if (isToken(content)) continue;
    collectBassNotesFromTune(content, selected);
  }

  return { ast, selected };
}

/**
 * Select the bass note (lowest-pitched note) from chords within an existing selection.
 * Used for nested contexts like @chords |= (@bass | transpose -12).
 *
 * Single notes in the selection are skipped - this selector only operates on chords.
 *
 * @param selection - The existing selection
 */
export function selectBassFromSelection(selection: Selection): Selection {
  const selected = new Set<Expr>();

  for (const node of selection.selected) {
    if (isChord(node)) {
      const bassNote = findBassNote(node);
      if (bassNote) {
        selected.add(bassNote);
      }
    }
    // Single notes are skipped (per spec)
  }

  return { ast: selection.ast, selected };
}

/**
 * Collect bass notes from all chords in a tune.
 */
function collectBassNotesFromTune(tune: Tune, selected: Set<Expr>): void {
  if (!tune.tune_body) return;
  collectBassNotesFromBody(tune.tune_body, selected);
}

/**
 * Collect bass notes from all chords in a tune body.
 */
function collectBassNotesFromBody(body: Tune_Body, selected: Set<Expr>): void {
  for (const system of body.sequence) {
    for (const element of system) {
      if (isToken(element)) continue;

      if (isChord(element)) {
        const bassNote = findBassNote(element);
        if (bassNote) {
          selected.add(bassNote);
        }
      } else if (isBeam(element)) {
        collectBassNotesFromBeam(element, selected);
      }
      // Single notes are skipped (per spec)
    }
  }
}

/**
 * Collect bass notes from chords within a beam.
 */
function collectBassNotesFromBeam(beam: Beam, selected: Set<Expr>): void {
  for (const element of beam.contents) {
    if (isToken(element)) continue;

    if (isChord(element)) {
      const bassNote = findBassNote(element);
      if (bassNote) {
        selected.add(bassNote);
      }
    }
    // Single notes are skipped (per spec)
  }
}

/**
 * Find the bass note (lowest-pitched note) in a chord.
 * Returns null if the chord has no notes.
 */
function findBassNote(chord: Chord): Note | null {
  const notes: Note[] = [];

  for (const element of chord.contents) {
    if (isNote(element)) {
      notes.push(element);
    }
  }

  if (notes.length === 0) {
    return null;
  }

  // Find the lowest note by MIDI pitch
  let lowestNote = notes[0];
  let lowestPitch = getNoteMidiPitch(lowestNote);

  for (let i = 1; i < notes.length; i++) {
    const note = notes[i];
    const pitch = getNoteMidiPitch(note);
    if (pitch < lowestPitch) {
      lowestPitch = pitch;
      lowestNote = note;
    }
  }

  return lowestNote;
}

// ============================================================================
// Location-based Selectors
// ============================================================================

/**
 * Get the starting token from an AST node.
 * Returns the first token that provides line/position information.
 */
function getStartToken(node: Expr): Token | null {
  if (isNote(node)) {
    // Note's first token is in its pitch
    return getTokenFromPitch(node.pitch);
  }
  if (isChord(node)) {
    // Chord's first note provides the location (brackets are implicit)
    for (const element of node.contents) {
      if (isNote(element)) {
        return getTokenFromPitch(element.pitch);
      }
      if (isToken(element)) {
        return element;
      }
    }
  }
  if (isBeam(node)) {
    // First element in beam
    for (const element of node.contents) {
      if (isNote(element)) {
        return getTokenFromPitch(element.pitch);
      }
      if (isChord(element)) {
        const token = getStartToken(element);
        if (token) return token;
      }
      if (isToken(element)) {
        return element;
      }
    }
  }
  if (isGraceGroup(node)) {
    // First note in grace group
    for (const element of node.notes) {
      if (isNote(element)) {
        return getTokenFromPitch(element.pitch);
      }
      if (isToken(element)) {
        return element;
      }
    }
  }
  if (isBarLine(node)) {
    return node.barline[0] || null;
  }
  if (isInfo_line(node)) {
    return node.key;
  }
  if (isInline_field(node)) {
    return node.field;
  }
  return null;
}

/**
 * Get the token from a Pitch node.
 */
function getTokenFromPitch(pitch: Pitch): Token {
  // The noteLetter is always present
  return pitch.noteLetter;
}

/**
 * Check if a node's location falls within the specified filter.
 */
function isInLocationRange(node: Expr, filter: LocationFilter): boolean {
  const token = getStartToken(node);
  if (!token) {
    // If we can't determine location, exclude the node from location-based selection
    return false;
  }

  const nodeLine = token.line;
  const nodeCol = token.position;

  // Case 1: Just a line number (no column specified)
  if (filter.col === undefined) {
    return nodeLine === filter.line;
  }

  // Case 2: Line and column, no end range
  if (!filter.end) {
    // Match exact position
    return nodeLine === filter.line && nodeCol === filter.col;
  }

  // Case 3: Single-line range (:line:col-endCol)
  if (filter.end.type === "singleline" && filter.end.endCol !== undefined) {
    if (nodeLine !== filter.line) return false;
    return nodeCol >= filter.col && nodeCol <= filter.end.endCol;
  }

  // Case 4: Multi-line range (:line:col-endLine:endCol)
  if (filter.end.type === "multiline" && filter.end.endLine !== undefined && filter.end.endCol !== undefined) {
    // Before start?
    if (nodeLine < filter.line) return false;
    if (nodeLine === filter.line && nodeCol < filter.col) return false;
    // After end?
    if (nodeLine > filter.end.endLine) return false;
    if (nodeLine === filter.end.endLine && nodeCol > filter.end.endCol) return false;
    return true;
  }

  return false;
}

/**
 * Select all music nodes from an ABC AST that fall within the specified location.
 */
export function selectByLocation(ast: File_structure, filter: LocationFilter): Selection {
  const selected = new Set<Expr>();

  for (const content of ast.contents) {
    if (isToken(content)) continue;
    collectNodesByLocation(content, filter, selected);
  }

  return { ast, selected };
}

/**
 * Filter an existing selection by location.
 */
export function selectByLocationFromSelection(selection: Selection, filter: LocationFilter): Selection {
  const selected = new Set<Expr>();

  for (const node of selection.selected) {
    if (isInLocationRange(node, filter)) {
      selected.add(node);
    }
  }

  return { ast: selection.ast, selected };
}

/**
 * Collect nodes from a Tune that match the location filter.
 */
function collectNodesByLocation(tune: Tune, filter: LocationFilter, selected: Set<Expr>): void {
  if (!tune.tune_body) return;

  // tune_body.sequence is Array<System>, where System is Array<tune_body_code>
  for (const system of tune.tune_body.sequence) {
    for (const element of system) {
      // tune_body_code elements are either Expr subtypes or Token
      // Cast is safe because we handle both cases in the function
      collectNodesFromBodyElementByLocation(element as Expr | Token, filter, selected);
    }
  }
}

/**
 * Collect matching nodes from a tune body element.
 * The element can be a tune_body_code (Comment | Info_line | Lyric_line | music_code | ErrorExpr)
 * where music_code includes Token, Note, Chord, Beam, etc.
 */
function collectNodesFromBodyElementByLocation(
  element: Expr | Token,
  filter: LocationFilter,
  selected: Set<Expr>
): void {
  // Skip raw tokens - they don't have musical content we want to select
  if (isToken(element)) return;

  if (isNote(element)) {
    if (isInLocationRange(element, filter)) {
      selected.add(element);
    }
  } else if (isChord(element)) {
    if (isInLocationRange(element, filter)) {
      selected.add(element);
    }
  } else if (isBeam(element)) {
    // Check each element in the beam
    for (const beamElement of element.contents) {
      if (isNote(beamElement) && isInLocationRange(beamElement, filter)) {
        selected.add(beamElement);
      } else if (isChord(beamElement) && isInLocationRange(beamElement, filter)) {
        selected.add(beamElement);
      }
    }
  } else if (isGraceGroup(element)) {
    // Check each note in the grace group
    for (const graceElement of element.notes) {
      if (isNote(graceElement) && isInLocationRange(graceElement, filter)) {
        selected.add(graceElement);
      }
    }
  } else if (isBarLine(element)) {
    if (isInLocationRange(element, filter)) {
      selected.add(element);
    }
  } else if (isInfo_line(element)) {
    if (isInLocationRange(element, filter)) {
      selected.add(element);
    }
  } else if (isInline_field(element)) {
    if (isInLocationRange(element, filter)) {
      selected.add(element);
    }
  }
}
