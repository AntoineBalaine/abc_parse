import {
  isBarLine,
  isBeam,
  isChord,
  isMultiMeasureRest,
  isNote,
  isRest,
  isTuplet,
} from "../../helpers";
import {
  Beam,
  Chord,
  Comment,
  Expr,
  Info_line,
  MultiMeasureRest,
  music_code,
  Note,
  Rest,
  Rhythm,
  Tuplet,
} from "../../types/Expr";
import { Token } from "../../types/token";
import { System, TokenType } from "../../types/types";
import { BarTimeMap, Location, VoiceSplit } from "./fmt_aligner";
import { NodeID, TimeStamp } from "./fmt_timeMapper";

interface BarAlignment {
  startNodes: Map<number, NodeID>; // voiceIdx -> startNodeId
  map: Map<TimeStamp, Array<Location>>;
}

export function mapTimePoints(voiceSplits: VoiceSplit[]): BarAlignment[] {
  // Get formatted voices and their indices
  const formattedVoices = voiceSplits
    .map((split, idx) => ({ split, idx }))
    .filter(({ split }) => split.type === "formatted");

  // Get maximum bar count
  const barCount = Math.max(
    ...formattedVoices.map(
      ({ split }) => split.content.filter((node) => isBarLine(node)).length + 1,
    ),
  );

  const barAlignments: BarAlignment[] = [];

  // For each bar
  for (let barIdx = 0; barIdx < barCount; barIdx++) {
    const barTimePoints = new Map<TimeStamp, Array<Location>>();
    const startNodes = new Map<number, NodeID>();

    // For each formatted voice
    formattedVoices.forEach(({ split, idx: voiceIdx }) => {
      const bars = getBars(split.content);
      const bar = bars[barIdx];
      if (!bar) {
        return; // Skip if voice doesn't have this bar
      }

      // Store start node
      startNodes.set(voiceIdx, bar.startNodeId);

      // Add time points for this voice
      bar.map.forEach((nodeID, timeStamp) => {
        let locations = barTimePoints.get(timeStamp);
        if (!locations) {
          locations = [];
          barTimePoints.set(timeStamp, locations);
        }
        locations.push({
          voiceIdx,
          nodeID,
        });
      });
    });

    barAlignments.push({
      startNodes,
      map: barTimePoints,
    });
  }

  return barAlignments;
}

// Helper to split voice into bars
function getBars(voice: System): BarTimeMap[] {
  const bars: BarTimeMap[] = [];
  let currentBar: System = [];
  let currentStartId: NodeID | undefined;

  for (const node of voice) {
    if (isBarLine(node)) {
      if (currentBar.length > 0) {
        bars.push(processBar(currentBar, currentStartId!));
      }
      currentBar = [node];
      currentStartId = node.id;
    } else {
      if (currentBar.length === 0) {
        currentStartId = node.id;
      }
      currentBar.push(node);
    }
  }

  // Handle last bar
  if (currentBar.length > 0) {
    bars.push(processBar(currentBar, currentStartId!));
  }

  return bars;
}

// Helper to process a bar
function processBar(bar: System, startNodeId: NodeID): BarTimeMap {
  const timeMap = new Map<TimeStamp, NodeID>();
  let currentTime = 0;
  const context: DurationContext = {};

  for (const node of bar) {
    if (isTuplet(node)) {
      // Set tuplet context for following notes
      context.inTuplet = {
        p: parseInt(node.p.lexeme),
        q: node.q ? parseInt(node.q.lexeme) : 2,
      };
      continue;
    }

    if (isTimeEvent(node)) {
      timeMap.set(currentTime, node.id);
      const duration = calculateDuration(node, context);

      // If we hit a full measure rest, stop processing
      if (duration === Infinity) {
        break;
      }

      currentTime += duration;

      // Update broken rhythm context
      if (isNote(node) && node.rhythm?.broken) {
        context.brokenRhythmPending = {
          type: node.rhythm.broken.type as TokenType.GREATER | TokenType.LESS,
        };
      } else {
        context.brokenRhythmPending = undefined;
      }
    }
  }

  return {
    startNodeId,
    map: timeMap,
  };
}

function isTimeEvent(
  node: Expr | Token,
): node is Note | Beam | MultiMeasureRest | Chord {
  return (
    isNote(node) || isBeam(node) || isMultiMeasureRest(node) || isChord(node)
  );
}

interface DurationContext {
  inTuplet?: {
    p: number; // Number of notes in tuplet
    q: number; // Time of q notes
  };
  brokenRhythmPending?: {
    type: TokenType.GREATER | TokenType.LESS;
  };
}

function calculateDuration(
  node: Note | Beam | MultiMeasureRest | Chord,
  context: DurationContext = {},
): number {
  if (isMultiMeasureRest(node)) {
    // Full measure rest - stop measuring
    // It’s expected that MultiMeasureRests in multi-voice scores
    // not carry any lengths (they’re expanded prior to building the timeMap)
    return Infinity;
  }

  if (isBeam(node)) {
    let total = 0;
    // Track broken rhythm state within beam
    const beamContext: DurationContext = { ...context };

    for (const content of node.contents) {
      if (isNote(content)) {
        total += calculateNoteDuration(content, beamContext);
        // Update broken rhythm state for next note
        if (content.rhythm?.broken) {
          beamContext.brokenRhythmPending = {
            type: content.rhythm.broken.type as
              | TokenType.GREATER
              | TokenType.LESS,
          };
        } else {
          beamContext.brokenRhythmPending = undefined;
        }
      }
    }
    return total;
  }

  if (isChord(node)) {
    // Only use chord-level rhythm, ignore individual note rhythms
    return node.rhythm ? calculateRhythmDuration(node.rhythm, context) : 1;
  }

  if (isNote(node)) {
    return calculateNoteDuration(node, context);
  }

  return 0;
}

function calculateNoteDuration(note: Note, context: DurationContext): number {
  let duration = 1;

  if (note.rhythm) {
    duration = calculateRhythmDuration(note.rhythm, context);
  }

  // Apply tuplet modification if in tuplet
  if (context.inTuplet) {
    const { p, q } = context.inTuplet;
    duration = (duration * q) / p;
  }

  // Apply broken rhythm if pending
  if (context.brokenRhythmPending) {
    if (context.brokenRhythmPending.type === TokenType.GREATER) {
      duration *= 0.5; // Second note of C>D
    } else {
      duration *= 1.5; // Second note of C<D
    }
  }

  // If this note starts a broken rhythm, adjust its duration
  if (note.rhythm?.broken) {
    if (note.rhythm.broken.type === TokenType.GREATER) {
      duration *= 1.5; // First note of C>D
    } else {
      duration *= 0.5; // First note of C<D
    }
  }

  return duration;
}

function calculateRhythmDuration(
  rhythm: Rhythm,
  context: DurationContext,
): number {
  let duration = 1;

  if (rhythm.numerator) {
    duration *= parseInt(rhythm.numerator.lexeme);
  }

  if (rhythm.denominator) {
    duration /= parseInt(rhythm.denominator.lexeme);
  } else if (rhythm.separator) {
    // Handle multiple slashes (C//)
    duration /= Math.pow(2, rhythm.separator.lexeme.length);
  }

  return duration;
}
