import { expect } from "chai";
import * as fc from "fast-check";
import { ABCContext } from "../parsers/Context";
import { Token, TT } from "../parsers/scan2";
import { Beam, Chord, MultiMeasureRest, Note, Pitch, Rest, Rhythm, System } from "../types/Expr2";
import { calculateDuration, DurationContext, isTimeEvent, processBar } from "../Visitors/fmt2/fmt_timeMap";
import { BarTimeMap, getNodeId } from "../Visitors/fmt2/fmt_timeMapHelpers";
import * as Generators from "./parse2_pbt.generators.spec";

describe("processBar function", () => {
  let ctx: ABCContext;

  beforeEach(() => {
    ctx = new ABCContext();
  });

  // Helper function to calculate expected durations for a sequence of time events
  function calculateExpectedDurations(timeEvents: Array<Note | Beam | MultiMeasureRest | Chord | Rest>): number[] {
    const durations: number[] = [];
    const context: DurationContext = {};

    for (const event of timeEvents) {
      const duration = calculateDuration(event as any, context);

      if (duration === Infinity) {
        break;
      }

      durations.push(duration);

      // Update context for broken rhythms
      if (event instanceof Note && event.rhythm?.broken) {
        context.brokenRhythmPending = {
          token: event.rhythm.broken,
          isGreater: event.rhythm.broken.lexeme.includes(">"),
        };
      } else {
        context.brokenRhythmPending = undefined;
      }
    }

    return durations;
  }

  // Helper function to verify time map
  function verifyTimeMap(
    timeMap: Map<number, number>,
    timeEvents: Array<Note | Beam | MultiMeasureRest | Chord | Rest>,
    expectedDurations: number[]
  ): void {
    // Check that the time map has the correct number of entries
    expect(timeMap.size).to.equal(timeEvents.length, "Time map should have one entry per time event");

    // Check that each time event is in the map at the correct time
    let currentTime = 0;
    for (let i = 0; i < timeEvents.length; i++) {
      const event = timeEvents[i];
      const eventId = getNodeId(event);

      // Check that the event is in the map at the correct time
      expect(timeMap.has(currentTime), `Time map should have an entry at time ${currentTime}`);
      expect(timeMap.get(currentTime)).to.equal(eventId, `Time map should have event ${eventId} at time ${currentTime}`);

      // Update current time for next event
      currentTime += expectedDurations[i];
    }
  }

  describe("basic functionality", () => {
    it("maps simple notes correctly", () => {
      fc.assert(
        fc.property(fc.array(Generators.genNoteExpr, { minLength: 3, maxLength: 5 }), (noteExprs) => {
          const notes = noteExprs.map((n) => n.expr);
          const startNodeId = getNodeId(notes[0]);

          // Process the bar
          const result = processBar(notes, startNodeId);

          // Calculate expected durations
          const expectedDurations = calculateExpectedDurations(notes);

          // Verify the time map
          verifyTimeMap(result.map, notes, expectedDurations);
        })
      );
    });

    it("handles chords correctly", () => {
      fc.assert(
        fc.property(fc.array(Generators.genChordExpr, { minLength: 2, maxLength: 4 }), (chordExprs) => {
          const chords = chordExprs.map((c) => c.expr);
          const startNodeId = getNodeId(chords[0]);

          // Process the bar
          const result = processBar(chords, startNodeId);

          // Calculate expected durations
          const expectedDurations = calculateExpectedDurations(chords);

          // Verify the time map
          verifyTimeMap(result.map, chords, expectedDurations);
        })
      );
    });

    it("handles rests correctly", () => {
      fc.assert(
        fc.property(fc.array(Generators.genRestExpr, { minLength: 2, maxLength: 4 }), (restExprs) => {
          // Filter out multi-measure rests
          const rests = restExprs.map((r) => r.expr).filter((r) => !(r instanceof MultiMeasureRest));

          if (rests.length === 0) {
            // Skip test if we didn't get any regular rests
            return true;
          }

          const startNodeId = getNodeId(rests[0]);

          // Process the bar
          const result = processBar(rests, startNodeId);

          // Calculate expected durations
          const expectedDurations = calculateExpectedDurations(rests);

          // Verify the time map
          verifyTimeMap(result.map, rests, expectedDurations);
          return true;
        })
      );
    });

    it("handles multi-measure rests", () => {
      fc.assert(
        fc.property(Generators.genMultiMeasureRestExpr, (mmRestExpr) => {
          const mmRest = mmRestExpr.expr;
          const startNodeId = getNodeId(mmRest);

          // Process the bar
          const result = processBar([mmRest], startNodeId);

          // Check that the time map has one entry
          expect(result.map.size).to.equal(1, "Time map should have one entry for the multi-measure rest");

          // Check that the multi-measure rest is in the map at time 0
          expect(result.map.has(0), "Time map should have an entry at time 0");
          expect(result.map.get(0)).to.equal(getNodeId(mmRest), "Time map should have the multi-measure rest at time 0");
          return true;
        })
      );
    });
  });

  describe("complex cases", () => {
    it("handles beams correctly", () => {
      fc.assert(
        fc.property(fc.array(Generators.genBeamExpr, { minLength: 1, maxLength: 3 }), (beamExprs) => {
          const beams = beamExprs.map((b) => b.expr);
          const startNodeId = getNodeId(beams[0]);

          // Process the bar
          const result = processBar(beams, startNodeId);

          // Calculate expected durations
          const expectedDurations = calculateExpectedDurations(beams);

          // Verify the time map
          verifyTimeMap(result.map, beams, expectedDurations);
          return true;
        })
      );
    });

    it("handles mixed time events", () => {
      fc.assert(
        fc.property(
          Generators.genNoteExpr,
          Generators.genChordExpr,
          Generators.genRestExpr,
          Generators.genBeamExpr,
          (noteExpr, chordExpr, restExpr, beamExpr) => {
            // Create a mixed array of time events
            const timeEvents = [noteExpr.expr, chordExpr.expr, restExpr.expr, beamExpr.expr];

            const startNodeId = getNodeId(timeEvents[0]);

            // Process the bar
            const result = processBar(timeEvents, startNodeId);

            // Calculate expected durations
            const expectedDurations = calculateExpectedDurations(timeEvents);

            // Verify the time map
            verifyTimeMap(result.map, timeEvents, expectedDurations);
            return true;
          }
        )
      );
    });

    it("ignores non-time events", () => {
      fc.assert(
        fc.property(Generators.genNoteExpr, Generators.genNoteExpr, (noteExpr1, noteExpr2) => {
          const nonTimeEvent = new Token(TT.COMMENT, "% comment");

          // Create a bar with time events and non-time events
          const bar = [noteExpr1.expr, nonTimeEvent, noteExpr2.expr];
          const startNodeId = getNodeId(noteExpr1.expr);

          // Process the bar
          const result = processBar(bar, startNodeId);

          // Calculate expected durations for just the time events
          const timeEvents = [noteExpr1.expr, noteExpr2.expr];
          const expectedDurations = calculateExpectedDurations(timeEvents);

          // Verify the time map
          verifyTimeMap(result.map, timeEvents, expectedDurations);
          return true;
        })
      );
    });
  });

  describe("edge cases", () => {
    it("handles empty bars", () => {
      // Create an empty bar
      const bar: System = [];
      const startNodeId = 0;

      // Process the bar
      const result = processBar(bar, startNodeId);

      // Check that the time map is empty
      expect(result.map.size).to.equal(0, "Time map should be empty for an empty bar");
    });

    it("handles bars with only non-time events", () => {
      // Create a bar with only non-time events
      const bar = [new Token(TT.COMMENT, "% comment"), new Token(TT.WS, " ")];
      const startNodeId = getNodeId(bar[0]);

      // Process the bar
      const result = processBar(bar, startNodeId);

      // Check that the time map is empty
      expect(result.map.size).to.equal(0, "Time map should be empty for a bar with only non-time events");
    });
  });

  describe("broken rhythm handling", () => {
    it("correctly applies broken rhythm context to subsequent notes", () => {
      // Create a note with broken rhythm
      const ctx = new ABCContext();
      const noteLetterToken = new Token(TT.NOTE_LETTER, "C");
      const pitch = new Pitch(ctx.generateId(), { noteLetter: noteLetterToken });
      const brokenToken = new Token(TT.RHY_BRKN, ">");
      const rhythm = new Rhythm(ctx.generateId(), null, undefined, null, brokenToken);
      const noteWithBrokenRhythm = new Note(ctx.generateId(), pitch, rhythm);

      // Create a regular note to follow it
      const noteLetterToken2 = new Token(TT.NOTE_LETTER, "D");
      const pitch2 = new Pitch(ctx.generateId(), { noteLetter: noteLetterToken2 });
      const regularNote = new Note(ctx.generateId(), pitch2);

      // Create a bar with these notes
      const bar = [noteWithBrokenRhythm, regularNote];
      const startNodeId = getNodeId(bar[0]);

      // Process the bar
      const result = processBar(bar, startNodeId);

      // Calculate expected durations manually
      const context: DurationContext = {};
      const duration1 = calculateDuration(noteWithBrokenRhythm, context);

      // The broken rhythm should update the context
      expect(context.brokenRhythmPending).to.exist;
      expect(context.brokenRhythmPending?.isGreater).to.be.true;

      const duration2 = calculateDuration(regularNote, context);

      // Verify the time map
      expect(result.map.size).to.equal(2);
      expect(result.map.has(0)).to.be.true;
      expect(result.map.get(0)).to.equal(getNodeId(noteWithBrokenRhythm));
      expect(result.map.has(duration1)).to.be.true;
      expect(result.map.get(duration1)).to.equal(getNodeId(regularNote));
    });
  });

  describe("chord rhythm handling", () => {
    it("correctly calculates durations for chords with rhythm", () => {
      // Create chords with different rhythms
      const ctx = new ABCContext();

      // Create a chord with rhythm 2
      const noteLetterToken1 = new Token(TT.NOTE_LETTER, "C");
      const pitch1 = new Pitch(ctx.generateId(), { noteLetter: noteLetterToken1 });
      const note1 = new Note(ctx.generateId(), pitch1);

      const noteLetterToken2 = new Token(TT.NOTE_LETTER, "E");
      const pitch2 = new Pitch(ctx.generateId(), { noteLetter: noteLetterToken2 });
      const note2 = new Note(ctx.generateId(), pitch2);

      const numeratorToken = new Token(TT.RHY_NUMER, "2");
      const rhythm = new Rhythm(ctx.generateId(), numeratorToken);
      const chord1 = new Chord(ctx.generateId(), [note1, note2], rhythm);

      // Create a chord with rhythm /
      const noteLetterToken3 = new Token(TT.NOTE_LETTER, "D");
      const pitch3 = new Pitch(ctx.generateId(), { noteLetter: noteLetterToken3 });
      const note3 = new Note(ctx.generateId(), pitch3);

      const noteLetterToken4 = new Token(TT.NOTE_LETTER, "F");
      const pitch4 = new Pitch(ctx.generateId(), { noteLetter: noteLetterToken4 });
      const note4 = new Note(ctx.generateId(), pitch4);

      const separatorToken = new Token(TT.RHY_SEP, "/");
      const rhythm2 = new Rhythm(ctx.generateId(), null, separatorToken);
      const chord2 = new Chord(ctx.generateId(), [note3, note4], rhythm2);

      // Create a bar with these chords
      const chords = [chord1, chord2];
      const startNodeId = getNodeId(chords[0]);

      // Process the bar
      const result = processBar(chords, startNodeId);

      // Calculate expected durations
      const expectedDurations = calculateExpectedDurations(chords);

      // Verify the time map
      verifyTimeMap(result.map, chords, expectedDurations);
    });
  });
});
