/**
 * AbclToAbcConverter - Converts ABCL (linear style) to ABC (deferred style)
 *
 * In linear style, voice changes within the file represent actual system breaks.
 * The converter inserts silenced lines (with X rests) for voices missing from each system,
 * allowing ABCJS to render the score correctly in deferred style.
 */

import { isGraceGroup, isTuplet, isVoiceMarker } from "../helpers";
import { ABCContext } from "../parsers/Context";
import { Token, TT } from "../parsers/scan2";
import { stringifyVoice } from "../parsers/voices2";
import {
  File_structure,
  Info_line,
  MultiMeasureRest,
  System,
  Tune,
  Tune_Body,
  tune_body_code,
} from "../types/Expr2";
import { isTimeEvent } from "../Visitors/fmt2/fmt_timeMap";
import { isBarLine } from "../helpers";

/**
 * Get the voice IDs present in a system
 */
export function getSystemVoices(system: System): string[] {
  const voices: string[] = [];

  for (const element of system) {
    if (isVoiceMarker(element)) {
      const voice = stringifyVoice(element);
      if (!voices.includes(voice)) {
        voices.push(voice);
      }
    }
  }

  return voices;
}

/**
 * Find the first line in a system that contains music content.
 * Returns elements from the first voice marker to the next voice marker or end.
 */
export function findMusicLine(system: System): tune_body_code[] {
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
 * Copy a line's elements for silencing.
 * Creates new Token instances but passes expressions by reference.
 *
 * Note: This is intentionally a shallow copy for expressions because
 * silenceLine() removes most expression types (time events, grace groups,
 * tuplet markers). Only tokens (barlines, EOL, whitespace) and preserved
 * expressions (comments, annotations) remain, and these are not mutated
 * by the silencing process.
 */
export function copyMusicLine(line: tune_body_code[], ctx: ABCContext): tune_body_code[] {
  const copied: tune_body_code[] = [];

  for (const element of line) {
    if (element instanceof Token) {
      // Create a new token with the same properties
      const newToken = new Token(element.type, element.lexeme, ctx.generateId());
      copied.push(newToken);
    } else {
      // Expressions are passed by reference - this is safe because
      // silenceLine filters out most expressions (time events, grace groups,
      // tuplets) and does not mutate the preserved ones
      copied.push(element);
    }
  }

  return copied;
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
 * Insert a voice prefix to a line of music content
 */
export function insertVoicePrefix(
  line: tune_body_code[],
  voiceId: string,
  ctx: ABCContext
): tune_body_code[] {
  const voiceMarker = createVoiceMarker(voiceId, ctx);
  return [voiceMarker, ...line];
}

/**
 * Get all unique voices across all systems in a tune body
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
 * Convert a linear-parsed Tune to deferred style by inserting silenced lines
 * for missing voices in each system.
 */
export function convertTuneToDeferred(tune: Tune, ctx: ABCContext): Tune {
  if (!tune.tune_body) {
    return tune;
  }

  const allVoices = getAllVoices(tune.tune_body);

  // If there is only one voice or no voices, no conversion is needed
  if (allVoices.length <= 1) {
    return tune;
  }

  const convertedSystems: System[] = [];

  for (const system of tune.tune_body.sequence) {
    const presentVoices = getSystemVoices(system);
    const missingVoices = allVoices.filter((v) => !presentVoices.includes(v));

    if (missingVoices.length === 0) {
      // All voices present, keep system as-is
      convertedSystems.push(system);
      continue;
    }

    // Find a music line template from this system
    const templateLine = findMusicLine(system);

    // Create silenced lines for missing voices
    const silencedLines: tune_body_code[] = [];

    for (const missingVoice of missingVoices) {
      const copiedLine = copyMusicLine(templateLine, ctx);
      const silenced = silenceLine(copiedLine, ctx);
      const withPrefix = insertVoicePrefix(silenced, missingVoice, ctx);

      // Add EOL token at the end if not present
      const lastElement = withPrefix[withPrefix.length - 1];
      if (!(lastElement instanceof Token && lastElement.type === TT.EOL)) {
        withPrefix.push(new Token(TT.EOL, "\n", ctx.generateId()));
      }

      silencedLines.push(...withPrefix);
    }

    // Append silenced lines to the system
    const expandedSystem: System = [...system, ...silencedLines];
    convertedSystems.push(expandedSystem);
  }

  // Create new Tune_Body with converted systems
  const newTuneBody = new Tune_Body(ctx.generateId(), convertedSystems);

  // Create new Tune with the converted body
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
