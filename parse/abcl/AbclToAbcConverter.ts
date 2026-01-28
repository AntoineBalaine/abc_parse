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
import { File_structure, Info_line, MultiMeasureRest, System, Tune, Tune_Body, tune_body_code } from "../types/Expr2";
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
 * Collect all voice IDs from tune body elements.
 */
export function getAllVoiceIds(system: System): string[] {
  const voiceIds: string[] = [];

  for (const element of system) {
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
 * Get all unique voices across all systems in a tune body.
 * Kept for backwards compatibility with tests.
 */
export function getAllVoices(tuneBody: Tune_Body): string[] {
  const allVoices: string[] = [];

  for (const system of tuneBody.sequence) {
    const systemVoices = getAllVoiceIds(system);
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
 * Prepend a voice marker to a line of music content.
 * Returns a new array with the voice marker and EOL at the beginning.
 */
export function insertVoicePrefix(line: tune_body_code[], voiceId: string, ctx: ABCContext): tune_body_code[] {
  const voiceMarker = createVoiceMarker(voiceId, ctx);
  const eol = new Token(TT.EOL, "\n", ctx.generateId());
  return [voiceMarker, eol, ...line];
}

/**
 * Convert a linear-parsed Tune to deferred style.
 *
 * The algorithm iterates over each system from the linear parser:
 * 1. Get all voices present across the entire tune
 * 2. For each system, find which voices are present
 * 3. For each missing voice, create a silenced line and append it to the system
 */
export function convertTuneToDeferred(tune: Tune, ctx: ABCContext): Tune {
  const tune_body = tune.tune_body;
  if (!tune_body) {
    return tune;
  }

  // Get all voices across all systems
  const allVoices = getAllVoices(tune_body);

  // If there is only one voice or no voices, no conversion is needed
  if (allVoices.length <= 1) {
    return tune;
  }

  // Process each system
  const newSystems: System[] = [];

  for (const system of tune_body.sequence) {
    // Get voices present in this system
    const presentVoices = getAllVoiceIds(system);

    // Find missing voices
    const missingVoices = allVoices.filter((v) => !presentVoices.includes(v));

    // Start with a deep clone of the original system elements
    const newSystem: System = cloneLine(system, ctx);

    // For each missing voice, create and append a silenced line
    for (const missingVoice of missingVoices) {
      // Find a music line template from this system
      const originalLine = findMusicLine(system);

      // Clone and silence it
      const copiedLine = cloneLine(originalLine, ctx);
      const silencedLine = silenceLine(copiedLine, ctx);

      // Insert voice prefix and append to system
      const completeLine = insertVoicePrefix(silencedLine, missingVoice, ctx);
      newSystem.push(...completeLine);

      // Ensure line ends with EOL
      const lastElement = newSystem[newSystem.length - 1];
      if (!(lastElement instanceof Token && lastElement.type === TT.EOL)) {
        newSystem.push(new Token(TT.EOL, "\n", ctx.generateId()));
      }
    }

    newSystems.push(newSystem);
  }

  const newTuneBody = new Tune_Body(ctx.generateId(), newSystems);
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
