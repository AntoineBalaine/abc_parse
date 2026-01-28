/**
 * AbclToAbcConverter - Converts ABCL (linear style) to ABC (deferred style)
 *
 * In linear style, voice markers act as headers for subsequent content lines.
 * The converter uses parseVoicesLinear to get a map-based structure where each
 * system is represented as Map<voiceId, sequence | null>, then fills null entries
 * with silenced content and flattens to deferred style.
 */

import { isGraceGroup, isTuplet, isVoiceMarker } from "../helpers";
import { ABCContext } from "../parsers/Context";
import { Token, TT } from "../parsers/scan2";
import { extractVoiceId, LinearVoiceCtx, parseVoices, VoiceSequenceMap } from "../parsers/voices2";
import { File_structure, Info_line, MultiMeasureRest, System, Tune, Tune_Body, tune_body_code } from "../types/Expr2";
import { isTimeEvent } from "../Visitors/fmt2/fmt_timeMap";
import { isBarLine } from "../helpers";
import { cloneLine } from "../Visitors/CloneVisitor";

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
export function getAllVoices(tuneBody: Tune_Body, vxls: string[]): string[] {
  const allVoices: string[] = vxls;

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
 * Fill null voice entries in a system map with silenced content.
 *
 * For each voice that has a null sequence, we clone a non-null sequence from
 * the same system, silence it, and prepend a voice marker.
 */
function fillNullVoices(systemMap: VoiceSequenceMap, allVoices: string[], ctx: ABCContext): void {
  // Find a template sequence (any non-null sequence)
  let templateSeq: tune_body_code[] | null = null;
  for (const seq of systemMap.values()) {
    if (seq !== null) {
      templateSeq = seq;
      break;
    }
  }

  // Fill null entries
  for (const [vxId, seq] of systemMap.entries()) {
    if (seq === null) {
      const cloned = cloneLine(templateSeq!, ctx);
      // Remove the voice marker from the cloned template before silencing
      const withoutVoiceMarker = cloned.filter((el) => !isVoiceMarker(el));
      const silenced = silenceLine(withoutVoiceMarker, ctx);
      const completeLine = insertVoicePrefix(silenced, vxId, ctx);
      systemMap.set(vxId, completeLine);
    }
  }
}

/**
 * Flatten a system map into a single array of elements in voice discovery order.
 * Ensures each voice sequence starts with a voice marker (for implicit continuations
 * that don't have one).
 */
function flattenSystemMap(systemMap: VoiceSequenceMap, allVoices: string[], ctx: ABCContext): tune_body_code[] {
  const result: tune_body_code[] = [];

  for (const vxId of allVoices) {
    const seq = systemMap.get(vxId);
    if (seq && seq.length > 0) {
      // Ensure sequence starts with a voice marker (for implicit continuations)
      const finalSeq = !isVoiceMarker(seq[0]) ? insertVoicePrefix(seq, vxId, ctx) : seq;

      result.push(...finalSeq);
      // Ensure sequence ends with EOL
      const lastElement = finalSeq[finalSeq.length - 1];
      if (!(lastElement instanceof Token && lastElement.type === TT.EOL)) {
        result.push(new Token(TT.EOL, "\n", ctx.generateId()));
      }
    }
  }

  return result;
}

/**
 * Convert a linear-parsed Tune to deferred style.
 *
 * The algorithm:
 * 1. Extract elements from the single system (linear mode returns all elements as one system)
 * 2. Call parseVoices with LinearVoiceCtx to get map-based structure
 * 3. For each system, fill null entries with silenced content
 * 4. Flatten the maps to produce deferred-style systems
 */
export function convertTuneToDeferred(tune: Tune, ctx: ABCContext): Tune {
  const tune_body = tune.tune_body;
  if (!tune_body || tune_body.sequence.length === 0) {
    return tune;
  }

  // In linear mode, the parser returns a single system with all elements
  const allElements = tune_body.sequence[0];
  const vxls = getAllVoices(tune_body, tune.tune_header.voices);
  // Parse into map-based structure using LinearVoiceCtx
  const linearCtx = new LinearVoiceCtx(allElements, vxls);
  parseVoices(linearCtx);

  // If no systems (no voice markers found), return as-is
  if (linearCtx.systems.length === 0) {
    return tune;
  }

  // Get the complete voice list from the context
  const allVoices = linearCtx.voices;

  // If only one voice, no conversion needed
  if (allVoices.length <= 1) {
    return tune;
  }

  // Process each system: fill null entries and flatten
  const processedSystems: System[] = [];

  for (const systemMap of linearCtx.systems) {
    fillNullVoices(systemMap, allVoices, ctx);
    const flatSystem = flattenSystemMap(systemMap, allVoices, ctx);
    processedSystems.push(flatSystem);
  }

  // Prepend prefix to the first system
  if (linearCtx.prefix.length > 0 && processedSystems.length > 0) {
    processedSystems[0] = [...linearCtx.prefix, ...processedSystems[0]];
  }

  const newTuneBody = new Tune_Body(ctx.generateId(), processedSystems);
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
