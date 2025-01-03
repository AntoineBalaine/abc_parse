import { ABCContext } from "../../../parsers/Context";
import { Token } from "../../../types/token";
import { System, TokenType } from "../../../types/types";
type TimePosition = any;
interface AlignedSystem {
  voices: {
    voice: System; // Original voice content
    timeMap: Map<number, TimePosition>; // From TimeMapBuilder
  }[];
}

/**
 * The SystemAligner works with TimePositions from multiple voices. Here's the conceptual flow:
 *
 * Example usage:
 * ```abc
 * [V:1] C   D   E2    {fg}a
 * [V:2] C2      D     E
 * ```
 *
 * Would become:
 * ```typescript
 * // Output from TimeMapBuilder
 * timeMap1 = {
 *     0.0: { elements: [C], width: 1 },
 *     1.0: { elements: [D], width: 1 },
 *     2.0: { elements: [E2], width: 2 },
 *     4.0: { elements: [{fg}, a], width: 4 }
 * }
 *
 * timeMap2 = {
 *     0.0: { elements: [C2], width: 2 },
 *     2.0: { elements: [D], width: 1 },
 *     4.0: { elements: [E], width: 1 }
 * }
 *
 * // Output from SystemAligner
 * // Padding added to achieve:
 * [V:1] C    D    E2    {fg}a
 * [V:2] C2        D     E
 */
class SystemAligner {
  ctx: ABCContext;
  constructor(ctx: ABCContext) {
    this.ctx = ctx;
  }
  align(voices: AlignedSystem) {
    // 1. Find all unique time positions across voices
    const timePoints = this.collectTimePoints(voices);

    // 2. For each time point, find max width needed
    for (const time of timePoints) {
      const positions = this.getPositionsAtTime(time, voices);
      const maxWidth = this.calculateMaxWidth(positions);

      // 3. Calculate padding needed for each voice at this time
      for (const voice of voices.voices) {
        const voicePosition = voice.timeMap.get(time);
        if (voicePosition) {
          const padding = maxWidth - this.getVisualWidth(voicePosition);
          this.addPadding(voicePosition, padding);
        }
      }
    }

    // 4. Generate aligned output
    return this.generateAlignedOutput(voices);
  }

  private collectTimePoints(voices: AlignedSystem): Set<number> {
    const timePoints = new Set<number>();
    for (const voice of voices.voices) {
      for (const time of voice.timeMap.keys()) {
        timePoints.add(time);
      }
    }
    return timePoints;
  }

  private getPositionsAtTime(
    time: number,
    voices: AlignedSystem,
  ): TimePosition[] {
    const positions: TimePosition[] = [];
    for (const voice of voices.voices) {
      const pos = voice.timeMap.get(time);
      if (pos) {
        positions.push(pos);
      }
    }
    return positions;
  }

  private calculateMaxWidth(positions: TimePosition[]): number {
    return Math.max(...positions.map((pos) => this.getVisualWidth(pos)));
  }

  private getVisualWidth(position: TimePosition): number {
    return position.elements.reduce(
      (total: any, el: any) => total + el.width,
      0,
    );
  }

  private addPadding(position: TimePosition, padding: number) {
    // Add padding token to position's elements
    if (padding > 0) {
      position.elements.push({
        expr: new Token(
          TokenType.WHITESPACE,
          " ".repeat(padding),
          null,
          -1,
          -1,
          this.ctx,
        ),
        width: padding,
      });
    }
  }

  private generateAlignedOutput(voices: AlignedSystem): System[] {
    // Convert TimePositions back to System format
    return voices.voices.map((voice) => {
      const alignedVoice: System = [];
      for (const position of voice.timeMap.values()) {
        for (const element of position.elements) {
          alignedVoice.push(element.expr as Token);
        }
      }
      return alignedVoice;
    });
  }
}
