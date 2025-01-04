import { isBarLine, isBeam, isComment, isInfo_line, isInline_field, isMultiMeasureRest, isNote } from "../../helpers";
import { Beam, Expr, MultiMeasureRest, Note, Rhythm } from "../../types/Expr";
import { Token } from "../../types/token";
import { System, TokenType } from "../../types/types";

export type NodeID = number;
export type TimeStamp = number;

interface VoiceSplit {
  type: "formatted" | "noformat";
  content: System;
}

interface BarTimeMap {
  startNodeId: NodeID;
  map: Map<TimeStamp, NodeID>;
}

export class TimeMapper {
  mapVoices(system: System): VoiceSplit[] {
    const splits = this.splitSystem(system);
    return splits.map((split) => {
      if (this.isFormattableLine(split)) {
        return {
          type: "formatted",
          content: split,
          // content: this.mapFormattedVoice(split),
        };
      } else {
        return {
          type: "noformat",
          content: split,
        };
      }
    });
  }

  private splitSystem(system: System): System[] {
    const splits: System[] = [];
    let currentSplit: System = [];

    for (const node of system) {
      if (this.isVoiceMarker(node) || this.isInfoLine(node)) {
        if (currentSplit.length > 0) {
          splits.push(currentSplit);
          currentSplit = [];
        }
      }
      currentSplit.push(node);
    }

    if (currentSplit.length > 0) {
      splits.push(currentSplit);
    }

    return splits;
  }

  private mapFormattedVoice(voice: System): System {
    const bars: BarTimeMap[] = [];
    let currentBar: System = [];
    let currentStartId: NodeID | undefined;

    for (const node of voice) {
      if (isBarLine(node)) {
        if (currentBar.length > 0) {
          bars.push(this.processBar(currentBar, currentStartId!));
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
      bars.push(this.processBar(currentBar, currentStartId!));
    }

    return voice; // Return original voice with bar mappings
  }

  private processBar(bar: System, startNodeId: NodeID): BarTimeMap {
    const timeMap = new Map<TimeStamp, NodeID>();
    let currentTime = 0;

    bar.forEach((node) => {
      if (this.isTimeEvent(node)) {
        timeMap.set(currentTime, node.id);
        currentTime += this.calculateDuration(node);
      }
    });

    return {
      startNodeId,
      map: timeMap,
    };
  }

  private isFormattableLine(line: System): boolean {
    // Check if line contains music content that needs formatting
    return line.some((node) => isNote(node) || isBeam(node) || isBarLine(node));
  }

  private isTimeEvent(node: Expr | Token): boolean {
    return isNote(node) || isBeam(node) || isMultiMeasureRest(node);
  }

  private calculateDuration(node: Expr | Token): number {
    if (isBeam(node)) {
      return this.calculateBeamDuration(node);
    }
    if (isNote(node)) {
      return this.calculateNoteDuration(node);
    }
    if (isMultiMeasureRest(node)) {
      return this.calculateMultiMeasureRestDuration(node);
    }
    return 0;
  }

  private calculateBeamDuration(beam: Beam): number {
    return beam.contents.reduce((total, node) => {
      if (isNote(node)) {
        return total + this.calculateNoteDuration(node);
      }
      return total;
    }, 0);
  }

  private calculateNoteDuration(note: Note): number {
    let duration = 1; // Base duration

    if (note.rhythm) {
      duration = this.calculateRhythmDuration(note.rhythm);
    }

    return duration;
  }

  private calculateRhythmDuration(rhythm: Rhythm): number {
    let duration = 1;

    if (rhythm.numerator) {
      duration *= parseInt(rhythm.numerator.lexeme);
    }
    if (rhythm.denominator) {
      duration /= parseInt(rhythm.denominator.lexeme);
    }
    if (rhythm.broken) {
      duration = rhythm.broken.type === TokenType.GREATER ? duration * 1.5 : duration * 0.5;
    }

    return duration;
  }

  private calculateMultiMeasureRestDuration(rest: MultiMeasureRest): number {
    return rest.length
      ? parseInt(rest.length.lexeme) * 4 // Assuming 4 beats per measure
      : 4;
  }

  private isVoiceMarker(node: Expr | Token): boolean {
    return (isInline_field(node) && node.field.lexeme === "V:") || (isInfo_line(node) && node.key.lexeme === "V:");
  }

  private isInfoLine(node: Expr | Token): boolean {
    return isInfo_line(node) || isComment(node);
  }
}
