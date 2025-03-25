import { expect } from "chai";
import * as fc from "fast-check";
import { ABCContext } from "../parsers/Context";
import { Token, TT } from "../parsers/scan2";
import { Beam, Chord, MultiMeasureRest, Note, Pitch, Rest, Rhythm, System } from "../types/Expr2";
import { calculateDuration, DurationContext, isTimeEvent, processBar } from "../Visitors/fmt2/fmt_timeMap";
import { BarTimeMap, getNodeId } from "../Visitors/fmt2/fmt_timeMapHelpers";
import * as Generators from "./parse2_pbt.generators.spec";
import { Rational, createRational, addRational, rationalToString, rationalToNumber, isInfiniteRational, equalRational } from "../Visitors/fmt2/rational";

describe("processBar function", () => {
  let ctx: ABCContext;

  beforeEach(() => {
    ctx = new ABCContext();
  });

  // Helper function to calculate expected durations for a sequence of time events
  function calculateExpectedDurations(timeEvents: Array<Note | Beam | MultiMeasureRest | Chord | Rest>): Rational[] {
    const durations: Rational[] = [];
    const context: DurationContext = {};

    for (const event of timeEvents) {
      const duration = calculateDuration(event, context);

      if (isInfiniteRational(duration)) {
        break;
      }

      durations.push(duration);

      // Update context for broken rhythms
      if ((event instanceof Note || event instanceof Chord || event instanceof Rest) && event.rhythm?.broken) {
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
    timeMap: Map<string, number>,
    timeEvents: Array<Note | Beam | MultiMeasureRest | Chord | Rest>,
    expectedDurations: Rational[]
  ): void {
    try {
      // Check that the time map has the correct number of entries
      expect(timeMap.size).to.equal(timeEvents.length, `expected ${timeEvents.length}, got ${timeMap.size}`);

      // Check that each time event is in the map at the correct time
      let currentTime = createRational(0, 1);
      for (let i = 0; i < timeEvents.length; i++) {
        const event = timeEvents[i];
        const eventId = getNodeId(event);
        const timeKey = rationalToString(currentTime);

        // Check that the event is in the map at the correct time
        expect(timeMap.has(timeKey), `Time map should have an entry at time ${timeKey}`);
        expect(timeMap.get(timeKey)).to.equal(eventId, `Time map should have event ${eventId} at time ${timeKey}`);

        // Update current time for next event
        currentTime = addRational(currentTime, expectedDurations[i]);
      }
    } catch (error) {
      // Print debug information only if there's an error
      console.log("===================================");
      console.log("ERROR DETECTED - Debug information:");
      console.log(
        "Expected time events:",
        timeEvents.map((e) => e.constructor.name)
      );
      console.log(`expected ${timeEvents.length}, got ${timeMap.size}`);
      console.log("Expected durations:", expectedDurations);
      console.log("Actual time map entries:", Array.from(timeMap.entries()));
      const result = processBar(timeEvents, timeEvents[0].id);

      // Re-throw the error
      throw error;
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
        }),

        { verbose: true, numRuns: 2000 }
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
          const zeroKey = rationalToString(createRational(0, 1));
          expect(result.map.has(zeroKey), "Time map should have an entry at time 0");
          expect(result.map.get(zeroKey)).to.equal(getNodeId(mmRest), "Time map should have the multi-measure rest at time 0");
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

          // Filter out beams that don't contain any time events
          const timeEventBeams = beams.filter((beam) => {
            return beam.contents.some((content) => isTimeEvent(content));
          });

          if (timeEventBeams.length === 0) {
            // Skip test if there are no time event beams
            return true;
          }

          // Calculate expected durations
          const expectedDurations = calculateExpectedDurations(timeEventBeams);

          // Verify the time map
          verifyTimeMap(result.map, timeEventBeams, expectedDurations);
          return true;
        })
      );
    });

    it("handles mixed time events", () => {
      fc.assert(
        fc.property(
          Generators.genNoteExpr,
          Generators.genChordExpr,
          Generators.genRegularRestExpr, // Use regular rests, not multi-measure rests
          Generators.genBeamExpr,
          (noteExpr, chordExpr, restExpr, beamExpr) => {
            // Create a mixed array of time events
            const allEvents = [noteExpr.expr, chordExpr.expr, restExpr.expr, beamExpr.expr];

            // Filter out beams that don't contain any time events and multi-measure rests
            const timeEvents = allEvents.filter((event) => {
              if (event instanceof Beam) {
                return event.contents.some((content) => isTimeEvent(content) && !(content instanceof MultiMeasureRest));
              }
              return isTimeEvent(event) && !(event instanceof MultiMeasureRest);
            });

            if (timeEvents.length === 0) {
              // Skip test if there are no time events
              return true;
            }

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

      // Create a rhythm with broken rhythm
      const rhythm = new Rhythm(ctx.generateId(), null, undefined, null, brokenToken);
      rhythm.broken = brokenToken; // This is important!

      // Create the note with the rhythm
      const noteWithBrokenRhythm = new Note(ctx.generateId(), pitch, rhythm);

      // Manually verify the rhythm is set correctly
      expect(noteWithBrokenRhythm.rhythm).to.exist;
      expect(noteWithBrokenRhythm.rhythm!.broken).to.exist;
      expect(noteWithBrokenRhythm.rhythm!.broken!.lexeme).to.equal(">");

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

      const time0 = rationalToString(createRational(0, 1));
      expect(result.map.has(time0)).to.be.true;
      expect(result.map.get(time0)).to.equal(getNodeId(noteWithBrokenRhythm));

      const time1 = rationalToString(duration1);
      expect(result.map.has(time1)).to.be.true;
      expect(result.map.get(time1)).to.equal(getNodeId(regularNote));
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

    it("correctly handles chords with broken rhythms", () => {
      // Create a chord with broken rhythm '<'
      const ctx = new ABCContext();

      // First chord with broken rhythm '<'
      const noteLetterToken1 = new Token(TT.NOTE_LETTER, "A");
      const pitch1 = new Pitch(ctx.generateId(), { noteLetter: noteLetterToken1 });
      const note1 = new Note(ctx.generateId(), pitch1);

      const brokenToken = new Token(TT.RHY_BRKN, "<");
      const rhythm1 = new Rhythm(ctx.generateId(), null, undefined, null, brokenToken);
      rhythm1.broken = brokenToken; // Important!

      const chord1 = new Chord(ctx.generateId(), [note1], rhythm1);

      // Second chord with rhythm '1/'
      const noteLetterToken2 = new Token(TT.NOTE_LETTER, "A");
      const pitch2 = new Pitch(ctx.generateId(), { noteLetter: noteLetterToken2 });
      const note2 = new Note(ctx.generateId(), pitch2);

      const numeratorToken = new Token(TT.RHY_NUMER, "1");
      const separatorToken = new Token(TT.RHY_SEP, "/");
      const denominatorToken = new Token(TT.RHY_DENOM, "1");
      const rhythm2 = new Rhythm(ctx.generateId(), numeratorToken, separatorToken, denominatorToken);

      const chord2 = new Chord(ctx.generateId(), [note2], rhythm2);

      // Third chord with no rhythm
      const noteLetterToken3 = new Token(TT.NOTE_LETTER, "A");
      const pitch3 = new Pitch(ctx.generateId(), { noteLetter: noteLetterToken3 });
      const note3 = new Note(ctx.generateId(), pitch3);

      const chord3 = new Chord(ctx.generateId(), [note3]);

      // Create a bar with these chords
      const chords = [chord1, chord2, chord3];
      const startNodeId = getNodeId(chords[0]);

      // Process the bar
      const result = processBar(chords, startNodeId);

      // Calculate expected durations manually
      const context: DurationContext = {};

      // First chord should have duration 0.5 (due to broken rhythm '<')
      const duration1 = calculateDuration(chord1, context);
      expect(rationalToNumber(duration1)).to.equal(0.5);

      // Context should now have brokenRhythmPending
      expect(context.brokenRhythmPending).to.exist;
      expect(context.brokenRhythmPending?.isGreater).to.be.false;

      // Second chord should have duration 1.5 (1/1 * 1.5 due to preceding broken rhythm)
      const duration2 = calculateDuration(chord2, context);
      expect(rationalToNumber(duration2)).to.equal(1.5);

      // Context should no longer have brokenRhythmPending
      expect(context.brokenRhythmPending).to.be.undefined;

      // Third chord should have normal duration 1
      const duration3 = calculateDuration(chord3, context);
      expect(rationalToNumber(duration3)).to.equal(1);

      // Verify the time map
      expect(result.map.size).to.equal(3);

      const time0 = rationalToString(createRational(0, 1));
      expect(result.map.has(time0)).to.be.true;
      expect(result.map.get(time0)).to.equal(getNodeId(chord1));

      const time05 = rationalToString(createRational(1, 2));
      expect(result.map.has(time05)).to.be.true;
      expect(result.map.get(time05)).to.equal(getNodeId(chord2));

      const time2 = rationalToString(createRational(2, 1));
      expect(result.map.has(time2)).to.be.true;
      expect(result.map.get(time2)).to.equal(getNodeId(chord3));
    });
  });
});
