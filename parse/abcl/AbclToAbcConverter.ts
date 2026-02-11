/**
 * AbclToAbcConverter - Converts ABCL (linear style) to ABC (deferred style)
 *
 * In linear style, voice markers act as headers for subsequent content lines.
 * The parser now provides correct system boundaries. This converter iterates
 * over each system, groups elements by voice into a map-based structure,
 * fills null entries with silenced content, and flattens to deferred style.
 */

import { isGraceGroup, isInfo_line, isTuplet, isVoiceMarker, isWS } from "../helpers";
import { ABCContext } from "../parsers/Context";
import { Token, TT } from "../parsers/scan2";
import { extractVoiceId, VoiceSequenceMap } from "../parsers/voices2";
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
      const withoutVoiceMarker: tune_body_code[] = [];
      for (let i = 0; i < cloned.length; i++) {
        let el = cloned[i];
        if (isVoiceMarker(el)) {
          if (isInfo_line(el)) {
            i++; // skip EOL
          }
          continue;
        }
        withoutVoiceMarker.push(el);
      }

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
 * Convert a system (flat array of elements) to a voice sequence map.
 *
 * This function groups elements by voice, returning a map where each voice ID
 * maps to its sequence of elements. Elements before the first voice marker are
 * returned as the prefix (unless continuationVoice is specified, in which case
 * they are assigned to that voice).
 *
 * @param system - A single system (flat array of tune_body_code)
 * @param allVoices - All known voice IDs across the tune (may be mutated if new voices are discovered)
 * @param continuationVoice - Optional voice ID for elements before the first voice marker
 *                           (used when a system starts with implicit voice continuation)
 * @returns Object with map (voice ID to elements), prefix (elements before first voice marker
 *          when no continuationVoice), and lastVoice (the last voice seen in this system)
 */
function systemToVoiceMap(
  system: System,
  allVoices: string[],
  continuationVoice: string = ""
): { map: VoiceSequenceMap; prefix: tune_body_code[]; lastVoice: string } {
  const map: VoiceSequenceMap = new Map<string, tune_body_code[] | null>();
  const prefix: tune_body_code[] = [];
  let currentVoice = continuationVoice;
  let currentSequence: tune_body_code[] = [];

  // Initialize map with null for all known voices
  for (const voice of allVoices) {
    map.set(voice, null);
  }

  for (const element of system) {
    if (isVoiceMarker(element)) {
      // Save current sequence if we were in a voice and have content
      if (currentVoice !== "" && currentSequence.length > 0) {
        const existing = map.get(currentVoice);
        if (existing) {
          existing.push(...currentSequence);
        } else {
          map.set(currentVoice, currentSequence);
        }
      }

      currentVoice = extractVoiceId(element);
      currentSequence = [element];

      // Handle dynamically discovered voice
      if (!map.has(currentVoice)) {
        map.set(currentVoice, null);
        allVoices.push(currentVoice);
      }

      continue;
    }

    if (currentVoice === "") {
      // Content before first voice marker (and no continuation voice)
      prefix.push(element);
    } else {
      currentSequence.push(element);
    }
  }

  // Save final voice sequence
  if (currentVoice !== "" && currentSequence.length > 0) {
    const existing = map.get(currentVoice);
    if (existing) {
      existing.push(...currentSequence);
    } else {
      map.set(currentVoice, currentSequence);
    }
  }

  return { map, prefix, lastVoice: currentVoice };
}

/**
 * Convert a linear-parsed Tune to deferred style.
 *
 * The algorithm:
 * 1. Get all unique voices across the tune body
 * 2. For each system (boundaries already correct from parser):
 *    a. Convert system to voice map (grouping only), passing continuation voice
 *       from the previous system for implicit voice continuation
 *    b. Fill null voice entries with silenced content
 *    c. Flatten to deferred style
 * 3. Prepend prefix from first system to the output
 */
export function convertTuneToDeferred(tune: Tune, ctx: ABCContext): Tune {
  const tune_body = tune.tune_body;
  if (!tune_body || tune_body.sequence.length === 0) {
    return tune;
  }

  const allVoices = getAllVoices(tune_body, tune.tune_header.voices);

  // If only one voice, no conversion needed
  if (allVoices.length <= 1) {
    return tune;
  }

  const processedSystems: System[] = [];
  let globalPrefix: tune_body_code[] = [];
  let continuationVoice = "";

  for (let i = 0; i < tune_body.sequence.length; i++) {
    const system = tune_body.sequence[i];

    // Convert system to voice map (grouping only, boundaries already correct)
    // Pass continuationVoice so implicit voice continuations are properly assigned
    const { map: systemMap, prefix, lastVoice } = systemToVoiceMap(system, allVoices, continuationVoice);

    // Update continuation voice for next system
    continuationVoice = lastVoice;

    // Collect prefix from first system only
    if (i === 0 && prefix.length > 0) {
      globalPrefix = prefix;
    }

    // Skip systems where all voices have null content (no voice content found)
    const hasVoiceContent = Array.from(systemMap.values()).some(seq => seq !== null);
    if (!hasVoiceContent) {
      continue;
    }

    // Fill null voices with silenced content
    fillNullVoices(systemMap, allVoices, ctx);

    // Flatten to deferred style
    const flatSystem = flattenSystemMap(systemMap, allVoices, ctx);
    processedSystems.push(flatSystem);
  }

  // If no systems were processed, return as-is
  if (processedSystems.length === 0) {
    return tune;
  }

  // Prepend global prefix to the first system
  if (globalPrefix.length > 0) {
    processedSystems[0] = [...globalPrefix, ...processedSystems[0]];
  }

  const newTuneBody = new Tune_Body(ctx.generateId(), processedSystems, allVoices);
  return new Tune(ctx.generateId(), tune.tune_header, newTuneBody, tune.linear, tune.formatterConfig);
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

  return new File_structure(ctx.generateId(), fileStructure.file_header, convertedContents, fileStructure.linear, fileStructure.formatterConfig);
}
