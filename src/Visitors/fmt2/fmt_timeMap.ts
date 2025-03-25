import { isChord, isNote } from "../../helpers2";
import { Token, TT } from "../../parsers/scan2";
import { Rest, Beam, Chord, Expr, MultiMeasureRest, Note, Rhythm, System, Tuplet, tune_body_code } from "../../types/Expr2";
import {
  BarAlignment,
  BarTimeMap,
  Location,
  NodeID,
  TimeStamp,
  VoiceSplit,
  getNodeId,
  isBarLine,
  isBeam,
  isMultiMeasureRest,
  isToken,
} from "./fmt_timeMapHelpers";
import { Rational, createRational, addRational, multiplyRational, divideRational, isInfiniteRational, rationalToString } from "./rational";

export function mapTimePoints(voiceSplits: VoiceSplit[]): BarAlignment[] {
  // Get formatted voices and their indices
  const formattedVoices = voiceSplits.map((split, idx) => ({ split, idx })).filter(({ split }) => split.type === "formatted");

  // Get maximum bar count
  const barCount = Math.max(...formattedVoices.map(({ split }) => split.content.filter((node) => isBarLine(node)).length + 1));

  const barAlignments: BarAlignment[] = [];

  // For each bar
  for (let barIdx = 0; barIdx < barCount; barIdx++) {
    const barTimePoints = new Map<string, Array<Location>>();
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
      bar.map.forEach((nodeID: NodeID, timeKey: string) => {
        let locations = barTimePoints.get(timeKey);
        if (!locations) {
          locations = [];
          barTimePoints.set(timeKey, locations);
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
      currentStartId = getNodeId(node);
    } else {
      if (currentBar.length === 0) {
        currentStartId = getNodeId(node);
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

// Helper function to check if an element is a tuplet
function isTuplet(element: Expr | Token): element is Tuplet {
  return element instanceof Tuplet;
}

// Helper to process a bar
export function processBar(bar: System, startNodeId: NodeID): BarTimeMap {
  const timeMap = new Map<string, NodeID>();
  let currentTime: Rational = createRational(0, 1); // Start at 0/1
  const context: DurationContext = {};

  for (let i = 0; i < bar.length; i++) {
    const node = bar[i];

    if (isTuplet(node)) {
      context.tuplet = parseTuplet(node);
      continue;
    }

    if (!isTimeEvent(node)) continue;

    // Store the node at the current time point using string key
    const timeKey = rationalToString(currentTime);
    timeMap.set(timeKey, getNodeId(node));

    // Calculate duration as a rational number
    const duration = calculateDuration(node, context);

    if (isInfiniteRational(duration)) {
      break;
    }

    // Add the duration to current time
    currentTime = addRational(currentTime, duration);

    // Update tuplet counting if we're in a tuplet
    // and this is a note-carrying event
    if (context.tuplet && (isNote(node) || isChord(node))) {
      context.tuplet.notesRemaining--;
      if (context.tuplet.notesRemaining <= 0) {
        context.tuplet = undefined;
      }
    }

    // Update broken rhythm context
    if ((isNote(node) || isChord(node) || node instanceof Rest) && node.rhythm?.broken) {
      context.brokenRhythmPending = {
        token: node.rhythm.broken,
        isGreater: node.rhythm.broken.lexeme.includes(">"),
      };
    } else {
      context.brokenRhythmPending = undefined;
    }
  }

  return {
    startNodeId,
    map: timeMap,
  };
}

export function isTimeEvent(node: Expr | Token): node is Note | Beam | MultiMeasureRest | Chord | Rest {
  if (isNote(node) || isMultiMeasureRest(node) || isChord(node) || node instanceof Rest) {
    return true;
  }

  if (isBeam(node)) {
    // A beam is a time event if it contains at least one time event
    return node.contents.some((content) => isTimeEvent(content));
  }

  return false;
}

export interface DurationContext {
  tuplet?: TupletContext;
  brokenRhythmPending?: {
    token: Token;
    isGreater: boolean;
  };
}

// Helper function to check if an element has a broken rhythm
function hasBrokenRhythm(element: any): boolean {
  return !!element.rhythm?.broken;
}

// Helper function to update broken rhythm context
function updateBrokenRhythmContext(element: any, context: DurationContext): void {
  if (hasBrokenRhythm(element) && element.rhythm?.broken?.lexeme) {
    context.brokenRhythmPending = {
      token: element.rhythm.broken,
      isGreater: element.rhythm.broken.lexeme.includes(">"),
    };
  } else {
    context.brokenRhythmPending = undefined;
  }
}

export function calculateDuration(node: Note | Beam | MultiMeasureRest | Chord | Rest, context: DurationContext): Rational {
  if (isMultiMeasureRest(node)) {
    // Return "infinity" as a rational
    return createRational(1, 0); // Represents infinity
  }

  if (isBeam(node)) {
    let total = createRational(0, 1);
    const beamContext: DurationContext = { ...context };

    for (const content of node.contents) {
      // Only process time events
      if (isTimeEvent(content)) {
        // Recursively calculate duration for this content
        const contentDuration = calculateDuration(content, beamContext);
        total = addRational(total, contentDuration);

        // Update broken rhythm context
        updateBrokenRhythmContext(content, beamContext);
      }
    }
    return total;
  }

  let result: Rational;

  if (isChord(node)) {
    result = calculateBaseDuration(node.rhythm, context);
  } else if (isNote(node)) {
    result = calculateNoteDuration(node, context);
  } else if (node instanceof Rest) {
    result = calculateBaseDuration(node.rhythm, context);
  } else {
    result = createRational(0, 1); // Zero duration
  }

  // Update broken rhythm context
  if ((isNote(node) || isChord(node) || node instanceof Rest) && node.rhythm?.broken) {
    context.brokenRhythmPending = {
      token: node.rhythm.broken,
      isGreater: node.rhythm.broken.lexeme.includes(">"),
    };
  } else if (!(isBeam(node) || isMultiMeasureRest(node))) {
    // Only clear the context if this is not a beam or multi-measure rest
    context.brokenRhythmPending = undefined;
  }

  return result;
}

export function calculateNoteDuration(note: Note, context: DurationContext): Rational {
  const baseDuration = calculateBaseDuration(note.rhythm, context);

  // Apply tuplet modification if in tuplet
  if (context.tuplet) {
    return multiplyRational(baseDuration, createRational(context.tuplet.q, context.tuplet.p));
  }

  return baseDuration;
}

export function calculateBaseDuration(rhythm: Rhythm | undefined, context: DurationContext): Rational {
  let duration = createRational(1, 1); // Default to 1/1

  if (!rhythm) {
    return duration;
  }

  // Handle basic rhythm
  if (rhythm.numerator) {
    duration = multiplyRational(duration, createRational(parseInt(rhythm.numerator.lexeme), 1));
  }

  if (rhythm.denominator) {
    duration = divideRational(duration, createRational(parseInt(rhythm.denominator.lexeme), 1));
  } else if (rhythm.separator) {
    duration = divideRational(duration, createRational(Math.pow(2, rhythm.separator.lexeme.length), 1));
  }

  // Handle broken rhythms
  if (context.brokenRhythmPending) {
    duration = multiplyRational(duration, createRational(context.brokenRhythmPending.isGreater ? 1 : 3, context.brokenRhythmPending.isGreater ? 2 : 2));
  }

  if (rhythm.broken) {
    const isGreater = rhythm.broken.lexeme.includes(">");
    duration = multiplyRational(duration, createRational(isGreater ? 3 : 1, isGreater ? 2 : 2));
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

export function parseTuplet(tuplet: Tuplet): TupletContext {
  const p = parseInt(tuplet.p.lexeme);

  // If q is specified, use it, otherwise get default
  const q_num = tuplet.q ? tuplet.q.lexeme : undefined;
  const q = q_num ? parseInt(q_num) : getTupletDefaults(p)[0];

  // If r is specified, use it, otherwise use p
  const r_num = tuplet.r ? tuplet.r.lexeme : undefined;
  const r = r_num ? parseInt(r_num) : p;

  return {
    p,
    q,
    r,
    notesRemaining: r,
  };
}
