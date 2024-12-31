import { isBarLine, isNote, isGraceGroup, isDecoration, isToken } from "../../helpers";
import { Expr, BarLine, Chord, Decoration, Grace_group, MultiMeasureRest, Note, Rhythm, Tuplet } from "../../types/Expr";
import { Token } from "../../types/token";
import { System, TokenType } from "../../types/types";

export interface TimePosition {
  timeValue: number; // Musical time from start of bar
  visualPosition: number; // Character position in output
  elements: {
    expr: Expr | Token;
    width: number;
  }[];
  isZeroTime: boolean;
}

/**
 * Creates TimeMap IRs for each voice:
 *
 * The TimeMapBuilder is meant to iterate through a system or parseTree
 * and build a map of timePositions and visualPositions for each of the elements in the system.
 * Those positions are collected in a {@link TimePosition} interface.
 *
 * The interface carries an `elements` array, which contains a list of nodes.
 * The reason why we’re keeping a list instead of a single node here
 * is because the time position of a note might be accompanied by multiple zero-length elements.
 *
 * ```abc
 * [V:1] C   D/2C/2   E2    {fg}a
 * [V:2] C2          D      E
 * ```
 *
 * ```typescript
 * // Voice 1 TimeMap:
 * Map(0.0) -> TimePosition {
 *     timeValue: 0.0,
 *     visualPosition: 0,
 *     elements: [{ expr: Note(C), width: 1 }]
 * }
 * Map(1.0) -> TimePosition {
 *     timeValue: 1.0,
 *     visualPosition: 2,
 *     elements: [{ expr: Note(D/2), width: 2 }]
 * }
 * // ...etc
 *
 * // Voice 2 TimeMap:
 * Map(0.0) -> TimePosition {
 *     timeValue: 0.0,
 *     visualPosition: 0,
 *     elements: [{ expr: Note(C2), width: 2 }]
 * }
 * Map(2.0) -> TimePosition {
 *     timeValue: 2.0,
 *     visualPosition: 3,
 *     elements: [{ expr: Note(D), width: 1 }]
 * }
 * // ...etc
 * ````
 */
export class TimeMapBuilder {
  private currentTime = 0;
  private currentVisualPos = 0;
  private timePositions = new Map<number, TimePosition>();

  processBar(bar: System) {
    // Reset for new bar
    this.currentTime = 0;
    this.currentVisualPos = 0;

    for (const element of bar) {
      if (isBarLine(element)) {
        this.processBarLine(element);
      } else if (isNote(element)) {
        this.processNote(element);
      } else if (isGraceGroup(element)) {
        this.processGraceGroup(element);
      } else if (isDecoration(element)) {
        this.processDecoration(element);
      }
      // ... other cases
    }

    return this.timePositions;
  }

  private processBarLine(barLine: BarLine) {
    // Barlines are alignment points but don't advance musical time
    const position: TimePosition = {
      timeValue: this.currentTime,
      visualPosition: this.currentVisualPos,
      elements: [
        {
          expr: barLine,
          width: barLine.barline.lexeme.length,
        },
      ],
      isZeroTime: true,
    };

    this.timePositions.set(this.currentTime, position);
    this.currentVisualPos += barLine.barline.lexeme.length;
  }

  private addTimePosition(timeValue: number, element: Expr | Token, width: number, isZeroTime = false) {
    let position = this.timePositions.get(timeValue);

    if (!position) {
      position = {
        timeValue,
        visualPosition: this.currentVisualPos,
        elements: [],
        isZeroTime,
      };
      this.timePositions.set(timeValue, position);
    }

    position.elements.push({
      expr: element,
      width,
    });

    // Update visual position
    this.currentVisualPos += width;
  }

  // Helper to get visual width of an element
  private getVisualWidth(element: Expr | Token): number {
    if (isToken(element)) {
      return element.lexeme.length;
    }
    // Add cases for other expressions
    return 1; // Default width
  }
  private processNote(note: Note) {
    const timeValue = this.currentTime;
    const width = this.getNoteWidth(note);
    const duration = this.getNoteDuration(note);

    // Handle decorations or grace notes attached to the note
    if (note.decorations) {
      for (const decoration of note.decorations) {
        this.processDecoration(decoration);
      }
    }

    this.addTimePosition(timeValue, note, width);
    this.currentTime += duration;
  }

  private processGraceGroup(graceGroup: Grace_group) {
    // Grace notes are zero-time elements
    const width = this.getGraceGroupWidth(graceGroup);

    this.addTimePosition(
      this.currentTime,
      graceGroup,
      width,
      true // isZeroTime
    );
  }

  private processDecoration(decoration: Decoration) {
    // Decorations are zero-time elements
    const width = this.getDecorationWidth(decoration);

    this.addTimePosition(
      this.currentTime,
      decoration,
      width,
      true // isZeroTime
    );
  }

  private processTuplet(tuplet: Tuplet) {
    // Get tuplet ratio (e.g., 3:2 for triplets)
    const [num, denom] = this.getTupletRatio(tuplet);
    const normalDuration = denom;
    const tupletDuration = num;

    // Each note in tuplet gets equal portion of total duration
    const noteDuration = normalDuration / tupletDuration;

    for (const note of tuplet.notes) {
      this.addTimePosition(this.currentTime, note, this.getNoteWidth(note));
      this.currentTime += noteDuration;
    }
  }

  private processChord(chord: Chord) {
    const width = this.getChordWidth(chord);
    const duration = this.getChordDuration(chord);

    this.addTimePosition(this.currentTime, chord, width);
    this.currentTime += duration;
  }

  private processMultiMeasureRest(rest: MultiMeasureRest) {
    const width = this.getMultiMeasureRestWidth(rest);
    const duration = this.getMultiMeasureRestDuration(rest);

    this.addTimePosition(this.currentTime, rest, width);
    this.currentTime += duration;
  }

  // Helper methods for calculating widths and durations
  private getNoteWidth(note: Note): number {
    let width = 1; // Base width for note letter

    if (note.pitch.alteration) width += 1;
    if (note.pitch.octave) width += 1;
    if (note.rhythm) width += this.getRhythmWidth(note.rhythm);
    if (note.tie) width += 1;

    return width;
  }

  private getGraceGroupWidth(graceGroup: Grace_group): number {
    return graceGroup.notes.reduce(
      (width, note) => width + this.getNoteWidth(note),
      2 // +2 for braces
    );
  }

  private getDecorationWidth(decoration: Decoration): number {
    return decoration.decoration.lexeme.length;
  }

  private getChordWidth(chord: Chord): number {
    // [CEG] = 5 chars (brackets + notes)
    return chord.contents.reduce(
      (width, note) => width + this.getNoteWidth(note),
      2 // +2 for brackets
    );
  }

  private getRhythmWidth(rhythm: Rhythm): number {
    let width = 0;
    if (rhythm.numerator) width += rhythm.numerator.lexeme.length;
    if (rhythm.separator) width += rhythm.separator.lexeme.length;
    if (rhythm.denominator) width += rhythm.denominator.lexeme.length;
    if (rhythm.broken) width += rhythm.broken.lexeme.length;
    return width;
  }

  private getNoteDuration(note: Note): number {
    let duration = 1; // Base duration

    if (note.rhythm) {
      duration = this.calculateRhythmDuration(note.rhythm);
    }

    return duration;
  }

  private getChordDuration(chord: Chord): number {
    // Chord duration is determined by its rhythm marking
    return chord.rhythm ? this.calculateRhythmDuration(chord.rhythm) : 1;
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
      // Handle broken rhythms (> or <)
      duration = rhythm.broken.type === TokenType.GREATER ? duration * 1.5 : duration * 0.5;
    }

    return duration;
  }

  private getTupletRatio(tuplet: Tuplet): [number, number] {
    // Default to triplet (3:2) if not specified
    const num = tuplet.p ? parseInt(tuplet.p.lexeme) : 3;
    const denom = tuplet.q ? parseInt(tuplet.q.lexeme) : 2;
    return [num, denom];
  }

  private getMultiMeasureRestWidth(rest: MultiMeasureRest): number {
    return rest.length ? rest.rest.lexeme.length + rest.length.lexeme.length : rest.rest.lexeme.length;
  }

  private getMultiMeasureRestDuration(rest: MultiMeasureRest): number {
    return rest.length
      ? parseInt(rest.length.lexeme) * 4 // Assuming 4 beats per measure
      : 4; // Default to one measure
  }
}
