import { SemanticAnalyzer } from "../../analyzers/semantic-analyzer";
import { ContextInterpreter, TuneSnapshots } from "../../interpreter/ContextInterpreter";
import { ABCContext } from "../../parsers/Context";
import { Token, TT } from "../../parsers/scan2";
import { extractVoiceId } from "../../parsers/voices2";
import { Info_line, Inline_field, Music_code, Tune, Tune_Body, tune_body_code } from "../../types/Expr2";
import { AbcFormatter } from "../Formatter2";
import { aligner, scanAlignPoints } from "./fmt_aligner3";
import { createLocationMapper } from "./fmt_alignerHelpers";
import { BarAlignment, findFmtblLines, getNodeId, VoiceSplit } from "./fmt_timeMapHelpers";
import { ZeroLengthNoteDetector } from "./fmt_zeroLengthDetector";

/**
 * collect the time points for each bar, create a map of locations. Locations means: VoiceIndex and NodeID.
 *
 * `TimeMapper() => VoicesArray<BarArray<TimeMap<TimeStamp, NodeID>>>`
 *
 * `mapTimePoints() => BarArray<TimeMap<TimeStamp, Array<{ VoiceIdx, NodeID }>> >`
 */

/**
 * Extracts voice ID from an element. Because Inline_field elements
 * can be nested inside Music_code.contents, we traverse into Music_code.
 * Returns the first voice ID found, or null if none.
 */
function extractVoiceIdFromElement(element: tune_body_code): string | null {
  if (element instanceof Info_line || element instanceof Inline_field) {
    const voiceId = extractVoiceId(element);
    // extractVoiceId returns empty string for invalid voice IDs
    if (voiceId === "") return null;
    return voiceId;
  } else if (element instanceof Music_code) {
    for (const child of element.contents) {
      if (child instanceof Inline_field) {
        const voiceId = extractVoiceId(child);
        if (voiceId === "") continue;
        return voiceId;
      }
    }
  }
  return null;
}

/**
 * Traverses the tune body to discover all voice IDs declared via V: info lines
 * or [V:] inline fields. Appends newly discovered voice IDs to the provided
 * voices array (mutates in place). Returns the same array for convenience.
 *
 * Because Inline_field elements can appear inside Music_code.contents, we use
 * extractVoiceIdFromElement for traversal.
 */
export function discoverVoicesInTuneBody(voices: string[], tuneBody: Tune_Body): string[] {
  const seen = new Set<string>(voices);

  for (const system of tuneBody.sequence) {
    for (const element of system) {
      const voiceId = extractVoiceIdFromElement(element);
      if (voiceId !== null && !seen.has(voiceId)) {
        seen.add(voiceId);
        voices.push(voiceId);
      }
    }
  }

  return voices;
}

/**
 * Checks if the tune body contains zero-length notes and returns TuneSnapshots if so.
 * This is used to determine the correct note length for alignment purposes.
 */
export function getSnapshotsIfZeroLength(tune: Tune, ctx: ABCContext): TuneSnapshots | null {
  if (!tune.tune_body) return null;
  if (!tune.tune_body.accept(new ZeroLengthNoteDetector())) return null;

  const analyzer = new SemanticAnalyzer(ctx);
  tune.accept(analyzer);
  const interpreter = new ContextInterpreter();
  const result = interpreter.interpret(tune, analyzer.data, ctx);
  return result.get(tune.id) ?? null;
}

/**
 * Add alignment padding to multi-voice tunes.
 * Does nothing if tune is single-voice.
 */
export function alignTune(tune: Tune, stringifyVisitor: AbcFormatter, tuneSnapshots?: TuneSnapshots): Tune {
  if (tune.tune_body && tune.tune_header.voices.length > 1) {
    tune.tune_body.sequence = tune.tune_body.sequence.map((system) => {
      // Split system into voices/noformat lines
      const voiceSplits: Array<VoiceSplit> = findFmtblLines(system);

      // Skip if no formattable content
      if (!voiceSplits.some((split) => split.type === "formatted")) {
        return system;
      }

      const gCtx = scanAlignPoints(voiceSplits, tuneSnapshots);
      const alignedVoiceSplits = aligner(gCtx, voiceSplits, stringifyVisitor);
      const alignedSystem = alignedVoiceSplits.flatMap((split) => split.content);

      return alignedSystem;
    });
  }
  return tune;
}

/**
 * At each time stamp, compare where there are nodes in each voice which land at that time stamp.
 * Then, compare the lengths of the stringified segments up to those nodes in each voice.
 * and insert some padding to make the strings the same length.
 * The padding is inserted at the first whitespace token before the node in the voice.
 * Lastly, compare the whole bars' lengths and add padding to the end of the shorter bars.
 */
export function alignBars(voiceSplits: VoiceSplit[], barTimeMap: BarAlignment, stringifyVisitor: AbcFormatter, ctx: ABCContext): VoiceSplit[] {
  // Get sorted timestamps - convert string keys to rational numbers for sorting
  const timeStamps = Array.from(barTimeMap.map.keys()).sort((a, b) => {
    // Parse the rational numbers from the string keys
    const [aNumerator, aDenominator] = a.split("/").map(Number);
    const [bNumerator, bDenominator] = b.split("/").map(Number);

    // Compare the rational numbers
    if (aDenominator === 0 && bDenominator === 0) {
      return 0; // Both are infinity
    }
    if (aDenominator === 0) return 1; // a is infinity
    if (bDenominator === 0) return -1; // b is infinity

    // Regular comparison: a/b ⋛ c/d ⟺ ad ⋛ bc
    return aNumerator * bDenominator - bNumerator * aDenominator;
  });

  // Process each time point
  for (let tmStmpIdx = 0; tmStmpIdx < timeStamps.length; tmStmpIdx++) {
    const locations = barTimeMap.map.get(timeStamps[tmStmpIdx])!;

    // new map with locations, start node and stringified content between startNode and current node
    const locsWithStrings = locations.map(createLocationMapper(voiceSplits, barTimeMap, stringifyVisitor));

    // Find maximum length
    const maxLen = Math.max(...locsWithStrings.map((l) => l.str.length));

    // Add padding where needed
    for (let idx = 0; idx < locsWithStrings.length; idx++) {
      const location = locsWithStrings[idx];
      if (location.str.length < maxLen) {
        // print the location.str using ansi code yellow
        const paddingLen = maxLen - location.str.length;

        // Find insertion point
        // const insertIdx = findPaddingInsertionPoint(voiceSplits[location.voiceIdx].content, location.nodeID, location.startNode);
        const insertIdx = voiceSplits[location.voiceIdx].content.findIndex((node) => getNodeId(node) === location.nodeID);

        // Insert padding
        if (insertIdx !== -1) {
          const padding = new Token(TT.WS, " ".repeat(paddingLen), ctx.generateId());
          voiceSplits[location.voiceIdx].content.splice(insertIdx, 0, padding);

          const startNodeIdx = voiceSplits[location.voiceIdx].content.findIndex((node) => getNodeId(node) === location.startNode);
          if (insertIdx < startNodeIdx) {
            barTimeMap.startNodes.set(location.voiceIdx, getNodeId(padding));
          }
        }
      }
    }
  }

  return voiceSplits;
}
