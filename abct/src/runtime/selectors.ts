// ABCT Selector Implementations
// Functions that select subsets of nodes from an ABC AST

import {
  isChord,
  isNote,
  isBeam,
  isGraceGroup,
  isBarLine,
  isInfo_line,
  isInline_field,
  isToken,
} from "../../../parse/helpers";
import {
  File_structure,
  Expr,
  Tune,
  Tune_Body,
  Beam,
  Chord,
  Note,
  Grace_group,
  Info_line,
  Inline_field,
  isVoiceInfo,
} from "../../../parse/types/Expr2";
import { Selection } from "./types";

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
