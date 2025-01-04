import { isBarLine, isBeam, isChord, isMultiMeasureRest, isNote, isRest, isTuplet } from "../../helpers";
import { Beam, Chord, Comment, Expr, Info_line, MultiMeasureRest, music_code, Note, Rest, Rhythm, Tuplet } from "../../types/Expr";
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
  const formattedVoices = voiceSplits.map((split, idx) => ({ split, idx })).filter(({ split }) => split.type === "formatted");

  // Get maximum bar count
  const barCount = Math.max(...formattedVoices.map(({ split }) => split.content.filter((node) => isBarLine(node)).length + 1));

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
      context.tuplet = parseTuplet(node);
      continue;
    }

    if (isTimeEvent(node)) {
      timeMap.set(currentTime, node.id);
      const duration = calculateDuration(node, context);

      if (duration === Infinity) {
        break;
      }

      currentTime += duration;

      // Update tuplet counting if we're in a tuplet
      // and this is a note-carrying event
      if (context.tuplet && (isNote(node) || isChord(node))) {
        context.tuplet.notesRemaining--;
        if (context.tuplet.notesRemaining <= 0) {
          context.tuplet = undefined;
        }
      }

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

function isTimeEvent(node: Expr | Token): node is Note | Beam | MultiMeasureRest | Chord {
  return isNote(node) || isBeam(node) || isMultiMeasureRest(node) || isChord(node);
}

interface DurationContext {
  tuplet?: TupletContext;
  brokenRhythmPending?: {
    type: TokenType.GREATER | TokenType.LESS;
  };
}

function calculateDuration(node: Note | Beam | MultiMeasureRest | Chord, context: DurationContext): number {
  if (isMultiMeasureRest(node)) {
    // assume this Z | X doesn’t carry a rhythm:
    // in multi voice scores, it’s expected that multi-measure rests be expanded
    return Infinity;
  }

  if (isBeam(node)) {
    let total = 0;
    const beamContext: DurationContext = { ...context };

    for (const content of node.contents) {
      if (isNote(content)) {
        total += calculateNoteDuration(content, beamContext);
        if (content.rhythm?.broken) {
          beamContext.brokenRhythmPending = {
            type: content.rhythm.broken.type as TokenType.GREATER | TokenType.LESS,
          };
        } else {
          beamContext.brokenRhythmPending = undefined;
        }
      }
    }
    return total;
  }

  if (isChord(node)) {
    return calculateBaseDuration(node.rhythm, context);
  }

  if (isNote(node)) {
    return calculateNoteDuration(node, context);
  }

  return 0;
}

function calculateNoteDuration(note: Note, context: DurationContext): number {
  const baseDuration = calculateBaseDuration(note.rhythm, context);

  // Apply tuplet modification if in tuplet
  if (context.tuplet) {
    return (baseDuration * context.tuplet.q) / context.tuplet.p;
  }

  return baseDuration;
}

function calculateBaseDuration(rhythm: Rhythm | undefined, context: DurationContext): number {
  let duration = 1;

  if (!rhythm) {
    return duration;
  }

  // Handle basic rhythm
  if (rhythm.numerator) {
    duration *= parseInt(rhythm.numerator.lexeme);
  }

  if (rhythm.denominator) {
    duration /= parseInt(rhythm.denominator.lexeme);
  } else if (rhythm.separator) {
    duration /= Math.pow(2, rhythm.separator.lexeme.length);
  }

  // Handle broken rhythms
  if (context.brokenRhythmPending) {
    duration *= context.brokenRhythmPending.type === TokenType.GREATER ? 0.5 : 1.5;
  }
  if (rhythm.broken) {
    duration *= rhythm.broken.type === TokenType.GREATER ? 1.5 : 0.5;
  }

  return duration;
}
interface TupletContext {
  p: number; // How many notes to put
  q: number; // Into the time of q
  r: number; // Affecting next r notes
  notesRemaining: number;
}

function getTupletDefaults(p: number): [number, number] {
  switch (p) {
    case 2:
      return [3, p]; // q=3, r=p
    case 3:
      return [2, p];
    case 4:
      return [3, p];
    case 6:
      return [2, p];
    case 8:
      return [3, p];
    // 5,7,9 would need time signature info
    default:
      return [2, p]; // Default to q=2, r=p
  }
}

function parseTuplet(tuplet: Tuplet): TupletContext {
  const p = parseInt(tuplet.p.lexeme);

  // If q is specified, use it, otherwise get default
  const q = tuplet.q ? parseInt(tuplet.q.lexeme) : getTupletDefaults(p)[0];

  // If r is specified, use it, otherwise use p
  const r = tuplet.r ? parseInt(tuplet.r.lexeme) : p;

  return {
    p,
    q,
    r,
    notesRemaining: r,
  };
}
