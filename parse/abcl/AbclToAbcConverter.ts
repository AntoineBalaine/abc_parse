/**
 * AbclToAbcConverter - Converts ABCL (linear style) to ABC (deferred style)
 *
 * In linear style, voice markers act as headers for subsequent content lines.
 * Each line of music content under a voice marker represents one "row" of the
 * score that must align with content from other voices.
 *
 * The converter uses a grid-based algorithm:
 * 1. Parse content into voice sections (content under each voice marker)
 * 2. Count lines per voice section
 * 3. Create a grid where each row has one line from each voice
 * 4. Fill missing cells with silenced (X rest) lines
 */

import { isGraceGroup, isTuplet, isVoiceMarker } from "../helpers";
import { ABCContext } from "../parsers/Context";
import { Token, TT } from "../parsers/scan2";
import { extractVoiceId } from "../parsers/voices2";
import { File_structure, Info_line, MultiMeasureRest, Tune, Tune_Body, tune_body_code } from "../types/Expr2";
import { isTimeEvent } from "../Visitors/fmt2/fmt_timeMap";
import { isBarLine } from "../helpers";
import { cloneLine } from "../Visitors/CloneVisitor";

/**
 * A voice section is content under a voice marker until the next voice marker
 */
export interface VoiceSection {
  voiceId: string;
  voiceMarker: Info_line; // The original voice marker
  lines: tune_body_code[][]; // Each inner array is one line of content
}

/**
 * A row in the output grid
 */
export interface GridRow {
  content: Map<string, tune_body_code[]>; // voiceId -> line content
}

/**
 * Silence a music line by removing time events, grace groups, and tuplet markers,
 * and inserting X rests at bar boundaries.
 *
 * Keeps barlines, comments, annotations, and other non-time elements.
 */
export function silenceLine(line: tune_body_code[], ctx: ABCContext): tune_body_code[] {
  const silenced: tune_body_code[] = [];
  let hasTimeContent = false;

  for (const element of line) {
    // Remove time events - these will be replaced by X rests
    if (isTimeEvent(element)) {
      hasTimeContent = true;
      continue;
    }

    // Remove grace groups
    if (isGraceGroup(element)) {
      continue;
    }

    // Remove tuplet markers
    if (isTuplet(element)) {
      continue;
    }

    // Keep barlines
    if (isBarLine(element)) {
      // Before a barline, insert an X rest if we had time content in this bar
      if (hasTimeContent) {
        const xRest = createXRest(ctx);
        silenced.push(xRest);
        hasTimeContent = false;
      }
      silenced.push(element);
      continue;
    }

    // Keep EOL tokens
    if (element instanceof Token && (element.type === TT.EOL || element.type === TT.EOF)) {
      // At end of line, insert an X rest if we had time content
      if (hasTimeContent) {
        const xRest = createXRest(ctx);
        silenced.push(xRest);
        hasTimeContent = false;
      }
      silenced.push(element);
      continue;
    }

    // Keep comments, whitespace, and other elements
    silenced.push(element);
  }

  // If the line ended without EOL/barline and had time content, add X rest
  if (hasTimeContent) {
    const xRest = createXRest(ctx);
    silenced.push(xRest);
  }

  return silenced;
}

/**
 * Create an X (invisible) rest
 */
function createXRest(ctx: ABCContext): MultiMeasureRest {
  const restToken = new Token(TT.REST, "X", ctx.generateId());
  return new MultiMeasureRest(ctx.generateId(), restToken);
}

/**
 * Create a voice marker Info_line for a given voice ID
 */
export function createVoiceMarker(voiceId: string, ctx: ABCContext): Info_line {
  const headerToken = new Token(TT.INF_HDR, "V:", ctx.generateId());
  const valueToken = new Token(TT.INFO_STR, voiceId, ctx.generateId());
  return new Info_line(ctx.generateId(), [headerToken, valueToken]);
}

/**
 * Parse tune body elements into voice sections.
 *
 * Each voice section contains:
 * - The voice ID
 * - The original voice marker
 * - An array of content lines (split at EOL tokens)
 *
 * Returns voice sections in the order they appear, and the list of unique voice IDs.
 */
export function parseVoiceSections(elements: tune_body_code[]): { sections: VoiceSection[]; voiceIds: string[] } {
  const sections: VoiceSection[] = [];
  const voiceIds: string[] = [];
  let currentSection: VoiceSection | null = null;
  let currentLine: tune_body_code[] = [];

  for (const element of elements) {
    if (isVoiceMarker(element)) {
      // Save current line to current section before starting new section
      if (currentSection && currentLine.length > 0) {
        currentSection.lines.push(currentLine);
        currentLine = [];
      }

      // Save current section
      if (currentSection) {
        sections.push(currentSection);
      }

      const voiceId = extractVoiceId(element);
      if (!voiceIds.includes(voiceId)) {
        voiceIds.push(voiceId);
      }

      currentSection = {
        voiceId,
        voiceMarker: element as Info_line,
        lines: [],
      };
    } else if (element instanceof Token && element.type === TT.EOL) {
      // End of line - save current line to current section
      if (currentSection) {
        // Include EOL in the line
        currentLine.push(element);
        if (currentLine.length > 1 || !(currentLine[0] instanceof Token && currentLine[0].type === TT.EOL)) {
          // Only add non-empty lines (more than just EOL)
          currentSection.lines.push(currentLine);
        }
        currentLine = [];
      }
    } else if (currentSection) {
      // Add element to current line
      currentLine.push(element);
    }
    // Elements before first voice marker are ignored for conversion
  }

  // Save final line and section
  if (currentSection) {
    if (currentLine.length > 0) {
      currentSection.lines.push(currentLine);
    }
    sections.push(currentSection);
  }

  return { sections, voiceIds };
}

/**
 * Build a grid from voice sections.
 *
 * The grid aligns content across voices:
 * - Each row represents one "line" of the score
 * - Each cell in a row contains content for one voice
 * - Missing cells (voice has no content for this row) get filled with silenced lines
 *
 * Voice sections are grouped: a new group starts when we see a voice ID that has
 * a lower index than the previous voice ID (indicating the start of a new "system"
 * in linear style).
 */
export function buildGrid(sections: VoiceSection[], voiceIds: string[], ctx: ABCContext): GridRow[] {
  if (sections.length === 0) {
    return [];
  }

  // Group sections into "systems" - a new system starts when voice index decreases
  const voiceSystems: VoiceSection[][] = [];
  let currentSystem: VoiceSection[] = [];
  let lastVoiceIndex = -1;

  for (const section of sections) {
    const voiceIndex = voiceIds.indexOf(section.voiceId);

    if (voiceIndex <= lastVoiceIndex && currentSystem.length > 0) {
      // New system starts - voice index went backwards
      voiceSystems.push(currentSystem);
      currentSystem = [];
    }

    currentSystem.push(section);
    lastVoiceIndex = voiceIndex;
  }

  // Save final system
  if (currentSystem.length > 0) {
    voiceSystems.push(currentSystem);
  }

  // Build grid rows from each system
  const rows: GridRow[] = [];

  for (const system of voiceSystems) {
    // Find the maximum number of lines in this system
    let maxLines = 0;
    for (const section of system) {
      maxLines = Math.max(maxLines, section.lines.length);
    }

    // Build a map of voiceId -> lines for this system
    const voiceLines = new Map<string, tune_body_code[][]>();
    for (const section of system) {
      voiceLines.set(section.voiceId, section.lines);
    }

    // Create rows for this system
    for (let lineIdx = 0; lineIdx < maxLines; lineIdx++) {
      const row: GridRow = { content: new Map() };

      for (const voiceId of voiceIds) {
        const lines = voiceLines.get(voiceId);
        if (lines && lineIdx < lines.length) {
          // Voice has content for this row
          row.content.set(voiceId, lines[lineIdx]);
        } else {
          // Voice has no content - use silenced line
          // If voice has any content in this system, clone and silence it
          // Otherwise create a simple X rest
          if (lines && lines.length > 0) {
            const template = lines[0];
            const cloned = cloneLine(template, ctx);
            row.content.set(voiceId, silenceLine(cloned, ctx));
          } else {
            row.content.set(voiceId, [createXRest(ctx)]);
          }
        }
      }

      rows.push(row);
    }
  }

  return rows;
}

/**
 * Convert a grid to deferred-style tune body elements.
 *
 * For each row, output each voice's content prefixed with its voice marker.
 */
export function gridToTuneBody(grid: GridRow[], voiceIds: string[], ctx: ABCContext): tune_body_code[] {
  const elements: tune_body_code[] = [];

  for (const row of grid) {
    for (const voiceId of voiceIds) {
      // Add voice marker
      const voiceMarker = createVoiceMarker(voiceId, ctx);
      elements.push(voiceMarker);

      // Add EOL after voice marker
      elements.push(new Token(TT.EOL, "\n", ctx.generateId()));

      // Add content
      const content = row.content.get(voiceId);
      if (content) {
        elements.push(...content);
      }

      // Ensure line ends with EOL
      const lastElement = elements[elements.length - 1];
      if (!(lastElement instanceof Token && lastElement.type === TT.EOL)) {
        elements.push(new Token(TT.EOL, "\n", ctx.generateId()));
      }
    }
  }

  return elements;
}

/**
 * Collect all voice IDs from tune body elements.
 */
export function getAllVoiceIds(elements: tune_body_code[]): string[] {
  const voiceIds: string[] = [];

  for (const element of elements) {
    if (isVoiceMarker(element)) {
      const voiceId = extractVoiceId(element);
      if (!voiceIds.includes(voiceId)) {
        voiceIds.push(voiceId);
      }
    }
  }

  return voiceIds;
}

/**
 * Get the voice IDs present in a system.
 * Kept for backwards compatibility with tests.
 */
export function getSystemVoices(system: tune_body_code[]): string[] {
  return getAllVoiceIds(system);
}

/**
 * Get all unique voices across all systems in a tune body.
 * Kept for backwards compatibility with tests.
 */
export function getAllVoices(tuneBody: Tune_Body): string[] {
  const allVoices: string[] = [];

  for (const system of tuneBody.sequence) {
    const systemVoices = getSystemVoices(system);
    for (const voice of systemVoices) {
      if (!allVoices.includes(voice)) {
        allVoices.push(voice);
      }
    }
  }

  return allVoices;
}

/**
 * Find the first line in a system that contains music content.
 * Returns elements from the first voice marker to the next voice marker or end.
 * Kept for backwards compatibility with tests.
 */
export function findMusicLine(system: tune_body_code[]): tune_body_code[] {
  let inVoice = false;
  const line: tune_body_code[] = [];

  for (const element of system) {
    if (isVoiceMarker(element)) {
      if (inVoice) {
        // We found the next voice marker, stop collecting
        break;
      }
      // Start collecting from the first voice marker
      inVoice = true;
      continue; // Do not include the voice marker itself in the template
    }

    if (inVoice) {
      line.push(element);
    }
  }

  return line;
}

/**
 * Convert a linear-parsed Tune to deferred style.
 *
 * The algorithm:
 * 1. Parse tune body into voice sections
 * 2. Build a grid aligning content across voices
 * 3. Convert grid to deferred-style tune body
 */
export function convertTuneToDeferred(tune: Tune, ctx: ABCContext): Tune {
  if (!tune.tune_body) {
    return tune;
  }

  // Flatten all systems into a single array of elements
  const allElements: tune_body_code[] = [];
  for (const system of tune.tune_body.sequence) {
    allElements.push(...system);
  }

  // Parse into voice sections
  const { sections, voiceIds } = parseVoiceSections(allElements);

  // If there is only one voice or no voices, no conversion is needed
  if (voiceIds.length <= 1) {
    return tune;
  }

  // Build the grid
  const grid = buildGrid(sections, voiceIds, ctx);

  // Convert grid to tune body elements
  const convertedElements = gridToTuneBody(grid, voiceIds, ctx);

  // Wrap in a single system (the whole converted content is one system)
  const newTuneBody = new Tune_Body(ctx.generateId(), [convertedElements]);

  return new Tune(ctx.generateId(), tune.tune_header, newTuneBody);
}

/**
 * Convert a linear-parsed File_structure to deferred style
 */
export function convertFileToDeferred(fileStructure: File_structure, ctx: ABCContext): File_structure {
  const convertedContents: Array<Tune | Token> = [];

  for (const content of fileStructure.contents) {
    if (content instanceof Tune) {
      convertedContents.push(convertTuneToDeferred(content, ctx));
    } else {
      convertedContents.push(content);
    }
  }

  return new File_structure(ctx.generateId(), fileStructure.file_header, convertedContents);
}
