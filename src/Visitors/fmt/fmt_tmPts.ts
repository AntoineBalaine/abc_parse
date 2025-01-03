import { isBarLine, isBeam, isMultiMeasureRest, isNote } from "../../helpers";
import { Comment, Expr, Info_line, music_code } from "../../types/Expr";
import { Token } from "../../types/token";
import { System } from "../../types/types";
import { BarTimeMap, Location, VoiceSplit } from "./fmt_aligner2";
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
      if (!bar) return; // Skip if voice doesn't have this bar

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

// Helper to process a bar (similar to TimeMapper's processBar)
function processBar(bar: System, startNodeId: NodeID): BarTimeMap {
  const timeMap = new Map<TimeStamp, NodeID>();
  let currentTime = 0;

  bar.forEach((node) => {
    if (isTimeEvent(node)) {
      timeMap.set(currentTime, node.id);
      currentTime += calculateDuration(node);
    }
  });

  return {
    startNodeId,
    map: timeMap,
  };
}
function calculateDuration(node: Comment | Info_line | music_code): number {
  throw new Error("Function not implemented.");
}
function isTimeEvent(node: Expr | Token): boolean {
  return isNote(node) || isBeam(node) || isMultiMeasureRest(node);
}
