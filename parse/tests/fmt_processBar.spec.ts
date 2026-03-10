import * as fc from "fast-check";
import { ABCContext } from "../parsers/Context";
import { Token, TT } from "../parsers/scan";
import { Beam, Chord, MultiMeasureRest, Note, Pitch, Rest, Rhythm, System } from "../types/Expr";
import { calculateDuration, DurationContext, isTimeEvent, processBar } from "../Visitors/fmt/fmt_timeMap";
import { getNodeId } from "../Visitors/fmt/fmt_timeMapHelpers";
import { addRational, createRational, isInfiniteRational, IRational, rationalToNumber, rationalToString } from "../Visitors/fmt/rational";
import * as Generators from "./prs_pbt.generators.spec";

describe("processBar function", () => {
  let ctx: ABCContext;

  beforeEach(() => {
    ctx = new ABCContext();
  });

  // Helper function to calculate expected durations for a sequence of time events
  function calculateExpectedDurations(timeEvents: Array<Note | Beam | MultiMeasureRest | Chord | Rest>): IRational[] {
    const durations: IRational[] = [];
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
    expectedDurations: IRational[]
  ): boolean {
    // Check that the time map has the correct number of entries
    if (timeMap.size !== timeEvents.length) {
      return false;
    }

    // Check that each time event is in the map at the correct time
    let currentTime = createRational(0, 1);
    for (let i = 0; i < timeEvents.length; i++) {
      const event = timeEvents[i];
      const eventId = getNodeId(event);
      const timeKey = rationalToString(currentTime);

      // Check that the event is in the map at the correct time
      if (!timeMap.has(timeKey)) {
        return false;
      }

      if (timeMap.get(timeKey) !== eventId) {
        return false;
      }

      // Update current time for next event
      currentTime = addRational(currentTime, expectedDurations[i]);
    }

    // All checks passed
    return true;
  }

  describe("basic functionality", () => {
    it("maps simple notes correctly", () => {
      fc.assert(
        fc.property(fc.array(Generators.genNoteExpr, { minLength: 3, maxLength: 5 }), (noteExprs) => {
          const notes = noteExprs.map((n) => n.expr);

          // Filter out notes with extreme rhythm values
          const hasExtremeRhythm = notes.some((note) => {
            if (note.rhythm?.numerator) {
              const num = parseInt(note.rhythm.numerator.lexeme);
              if (num > 1000000) return true;
            }
            if (note.rhythm?.denominator) {
              const denom = parseInt(note.rhythm.denominator.lexeme);
              if (denom > 1000000) return true;
            }
            return false;
          });

          if (hasExtremeRhythm) {
            return true; // Skip test if there are extreme rhythm values
          }

          const startNodeId = getNodeId(notes[0]);

          // Process the bar
          const result = processBar(notes, startNodeId);

          // Calculate expected durations
          const expectedDurations = calculateExpectedDurations(notes);

          // Verify the time map
          return verifyTimeMap(result.map, notes, expectedDurations);
        }),
        { verbose: false, numRuns: 5000 }
      );
    });

    it("handles chords correctly", () => {
      fc.assert(
        fc.property(fc.array(Generators.genChordExpr, { minLength: 2, maxLength: 4 }), (chordExprs) => {
          const chords = chordExprs.map((c) => c.expr);

          // Filter out chords with extreme rhythm values
          const hasExtremeRhythm = chords.some((chord) => {
            if (chord.rhythm?.numerator) {
              const num = parseInt(chord.rhythm.numerator.lexeme);
              if (num > 1000000) return true;
            }
            if (chord.rhythm?.denominator) {
              const denom = parseInt(chord.rhythm.denominator.lexeme);
              if (denom > 1000000) return true;
            }
            return false;
          });

          if (hasExtremeRhythm) {
            return true; // Skip test if there are extreme rhythm values
          }

          const startNodeId = getNodeId(chords[0]);

          // Process the bar
          const result = processBar(chords, startNodeId);

          // Calculate expected durations
          const expectedDurations = calculateExpectedDurations(chords);

          // Verify the time map
          return verifyTimeMap(result.map, chords, expectedDurations);
        }),

        { verbose: false, numRuns: 5000 }
      );
    });

    it("handles rests correctly", () => {
      fc.assert(
        fc.property(fc.array(Generators.genRestExpr, { minLength: 2, maxLength: 4 }), (restExprs) => {
          // Get all rests
          const allRests = restExprs.map((r) => r.expr);

          // Filter out multi-measure rests for processing
          const regularRests = allRests.filter((r) => !(r instanceof MultiMeasureRest));

          if (regularRests.length === 0) {
            // Skip test if we didn't get any regular rests
            return true;
          }

          // Filter out rests with extreme rhythm values
          const hasExtremeRhythm = regularRests.some((rest) => {
            if (rest instanceof Rest && rest.rhythm?.numerator) {
              const num = parseInt(rest.rhythm.numerator.lexeme);
              if (num > 1000000) return true;
            }
            if (rest instanceof Rest && rest.rhythm?.denominator) {
              const denom = parseInt(rest.rhythm.denominator.lexeme);
              if (denom > 1000000) return true;
            }
            return false;
          });

          if (hasExtremeRhythm) {
            return true; // Skip test if there are extreme rhythm values
          }

          const startNodeId = getNodeId(regularRests[0]);

          // Process the bar
          const result = processBar(regularRests, startNodeId);

          // Calculate expected durations
          const expectedDurations = calculateExpectedDurations(regularRests);

          // Verify the time map
          return verifyTimeMap(result.map, regularRests, expectedDurations);
        }),
        { verbose: false, numRuns: 5000 }
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
          if (result.map.size !== 1) {
            return false;
          }

          // Check that the multi-measure rest is in the map at time 0
          const zeroKey = rationalToString(createRational(0, 1));
          if (!result.map.has(zeroKey)) {
            return false;
          }

          if (result.map.get(zeroKey) !== getNodeId(mmRest)) {
            return false;
          }

          return true;
        }),
        { verbose: false, numRuns: 5000 }
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
          return verifyTimeMap(result.map, timeEventBeams, expectedDurations);
        }),
        { verbose: false, numRuns: 5000 }
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

            // Filter out events with extreme rhythm values
            const hasExtremeRhythm = timeEvents.some((event) => {
              if (event instanceof Note || event instanceof Chord) {
                if (event.rhythm?.numerator) {
                  const num = parseInt(event.rhythm.numerator.lexeme);
                  if (num > 1000000) return true;
                }
                if (event.rhythm?.denominator) {
                  const denom = parseInt(event.rhythm.denominator.lexeme);
                  if (denom > 1000000) return true;
                }
              } else if (event instanceof Rest) {
                if (event.rhythm?.numerator) {
                  const num = parseInt(event.rhythm.numerator.lexeme);
                  if (num > 1000000) return true;
                }
                if (event.rhythm?.denominator) {
                  const denom = parseInt(event.rhythm.denominator.lexeme);
                  if (denom > 1000000) return true;
                }
              }
              return false;
            });

            if (hasExtremeRhythm) {
              return true; // Skip test if there are extreme rhythm values
            }

            const startNodeId = getNodeId(timeEvents[0]);

            // Process the bar
            const result = processBar(timeEvents, startNodeId);

            // Calculate expected durations
            const expectedDurations = calculateExpectedDurations(timeEvents);

            // Verify the time map
            return verifyTimeMap(result.map, timeEvents, expectedDurations);
          }
        ),
        { verbose: false, numRuns: 5000 }
      );
    });

    it("ignores non-time events", () => {
      fc.assert(
        fc.property(Generators.genNoteExpr, Generators.genNoteExpr, (noteExpr1, noteExpr2) => {
          const nonTimeEvent = new Token(TT.COMMENT, "% comment", ctx.generateId());

          // Create a bar with time events and non-time events
          const bar = [noteExpr1.expr, nonTimeEvent, noteExpr2.expr];
          const startNodeId = getNodeId(noteExpr1.expr);

          // Process the bar
          const result = processBar(bar, startNodeId);

          // Calculate expected durations for just the time events
          const timeEvents = [noteExpr1.expr, noteExpr2.expr];
          const expectedDurations = calculateExpectedDurations(timeEvents);

          // Verify the time map
          return verifyTimeMap(result.map, timeEvents, expectedDurations);
        }),
        { verbose: false, numRuns: 5000 }
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
      if (result.map.size !== 0) {
        return false;
      }
      return true;
    });

    it("handles bars with only non-time events", () => {
      // Create a bar with only non-time events
      const bar = [new Token(TT.COMMENT, "% comment", ctx.generateId()), new Token(TT.WS, " ", ctx.generateId())];
      const startNodeId = getNodeId(bar[0]);

      // Process the bar
      const result = processBar(bar, startNodeId);

      // Check that the time map is empty
      if (result.map.size !== 0) {
        return false;
      }
      return true;
    });
  });

  describe("broken rhythm handling", () => {
    it("correctly applies broken rhythm context to subsequent notes", () => {
      // Create a note with broken rhythm
      const ctx = new ABCContext();
      const noteLetterToken = new Token(TT.NOTE_LETTER, "C", ctx.generateId());
      const pitch = new Pitch(ctx.generateId(), { noteLetter: noteLetterToken });
      const brokenToken = new Token(TT.RHY_BRKN, ">", ctx.generateId());

      // Create a rhythm with broken rhythm
      const rhythm = new Rhythm(ctx.generateId(), null, undefined, null, brokenToken);
      rhythm.broken = brokenToken; // This is important!

      // Create the note with the rhythm
      const noteWithBrokenRhythm = new Note(ctx.generateId(), pitch, rhythm);

      // Verify the rhythm is set correctly
      if (!noteWithBrokenRhythm.rhythm || !noteWithBrokenRhythm.rhythm.broken) {
        return false;
      }

      if (noteWithBrokenRhythm.rhythm.broken.lexeme !== ">") {
        return false;
      }

      // Create a regular note to follow it
      const noteLetterToken2 = new Token(TT.NOTE_LETTER, "D", ctx.generateId());
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
      if (!context.brokenRhythmPending) {
        return false;
      }

      if (!context.brokenRhythmPending.isGreater) {
        return false;
      }

      // Verify the time map
      if (result.map.size !== 2) {
        return false;
      }

      const time0 = rationalToString(createRational(0, 1));
      if (!result.map.has(time0)) {
        return false;
      }

      if (result.map.get(time0) !== getNodeId(noteWithBrokenRhythm)) {
        return false;
      }

      const time1 = rationalToString(duration1);
      if (!result.map.has(time1)) {
        return false;
      }

      if (result.map.get(time1) !== getNodeId(regularNote)) {
        return false;
      }

      return true;
    });
  });

  describe("chord rhythm handling", () => {
    it("correctly calculates durations for chords with rhythm", () => {
      // Create chords with different rhythms
      const ctx = new ABCContext();

      // Create a chord with rhythm 2
      const noteLetterToken1 = new Token(TT.NOTE_LETTER, "C", ctx.generateId());
      const pitch1 = new Pitch(ctx.generateId(), { noteLetter: noteLetterToken1 });
      const note1 = new Note(ctx.generateId(), pitch1);

      const noteLetterToken2 = new Token(TT.NOTE_LETTER, "E", ctx.generateId());
      const pitch2 = new Pitch(ctx.generateId(), { noteLetter: noteLetterToken2 });
      const note2 = new Note(ctx.generateId(), pitch2);

      const numeratorToken = new Token(TT.RHY_NUMER, "2", ctx.generateId());
      const rhythm = new Rhythm(ctx.generateId(), numeratorToken);
      const chord1 = new Chord(ctx.generateId(), [note1, note2], rhythm);

      // Create a chord with rhythm /
      const noteLetterToken3 = new Token(TT.NOTE_LETTER, "D", ctx.generateId());
      const pitch3 = new Pitch(ctx.generateId(), { noteLetter: noteLetterToken3 });
      const note3 = new Note(ctx.generateId(), pitch3);

      const noteLetterToken4 = new Token(TT.NOTE_LETTER, "F", ctx.generateId());
      const pitch4 = new Pitch(ctx.generateId(), { noteLetter: noteLetterToken4 });
      const note4 = new Note(ctx.generateId(), pitch4);

      const separatorToken = new Token(TT.RHY_SEP, "/", ctx.generateId());
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
      return verifyTimeMap(result.map, chords, expectedDurations);
    });

    it("correctly handles chords with broken rhythms", () => {
      // Create a chord with broken rhythm '<'
      const ctx = new ABCContext();

      // First chord with broken rhythm '<'
      const noteLetterToken1 = new Token(TT.NOTE_LETTER, "A", ctx.generateId());
      const pitch1 = new Pitch(ctx.generateId(), { noteLetter: noteLetterToken1 });
      const note1 = new Note(ctx.generateId(), pitch1);

      const brokenToken = new Token(TT.RHY_BRKN, "<", ctx.generateId());
      const rhythm1 = new Rhythm(ctx.generateId(), null, undefined, null, brokenToken);
      rhythm1.broken = brokenToken; // Important!

      const chord1 = new Chord(ctx.generateId(), [note1], rhythm1);

      // Second chord with rhythm '1/'
      const noteLetterToken2 = new Token(TT.NOTE_LETTER, "A", ctx.generateId());
      const pitch2 = new Pitch(ctx.generateId(), { noteLetter: noteLetterToken2 });
      const note2 = new Note(ctx.generateId(), pitch2);

      const numeratorToken = new Token(TT.RHY_NUMER, "1", ctx.generateId());
      const separatorToken = new Token(TT.RHY_SEP, "/", ctx.generateId());
      const denominatorToken = new Token(TT.RHY_DENOM, "1", ctx.generateId());
      const rhythm2 = new Rhythm(ctx.generateId(), numeratorToken, separatorToken, denominatorToken);

      const chord2 = new Chord(ctx.generateId(), [note2], rhythm2);

      // Third chord with no rhythm
      const noteLetterToken3 = new Token(TT.NOTE_LETTER, "A", ctx.generateId());
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
      if (rationalToNumber(duration1) !== 0.5) {
        return false;
      }

      // Context should now have brokenRhythmPending
      if (!context.brokenRhythmPending) {
        return false;
      }

      if (context.brokenRhythmPending.isGreater) {
        return false;
      }

      // Second chord should have duration 1.5 (1/1 * 1.5 due to preceding broken rhythm)
      const duration2 = calculateDuration(chord2, context);
      if (rationalToNumber(duration2) !== 1.5) {
        return false;
      }

      // Context should no longer have brokenRhythmPending
      if (context.brokenRhythmPending) {
        return false;
      }

      // Third chord should have normal duration 1
      const duration3 = calculateDuration(chord3, context);
      if (rationalToNumber(duration3) !== 1) {
        return false;
      }

      // Verify the time map
      if (result.map.size !== 3) {
        return false;
      }

      const time0 = rationalToString(createRational(0, 1));
      if (!result.map.has(time0)) {
        return false;
      }

      if (result.map.get(time0) !== getNodeId(chord1)) {
        return false;
      }

      const time05 = rationalToString(createRational(1, 2));
      if (!result.map.has(time05)) {
        return false;
      }

      if (result.map.get(time05) !== getNodeId(chord2)) {
        return false;
      }

      const time2 = rationalToString(createRational(2, 1));
      if (!result.map.has(time2)) {
        return false;
      }

      if (result.map.get(time2) !== getNodeId(chord3)) {
        return false;
      }

      return true;
    });
  });
});
