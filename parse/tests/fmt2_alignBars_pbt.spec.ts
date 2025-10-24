import { expect } from "chai";
import * as fc from "fast-check";
import { cloneDeep } from "lodash";
import { isChord, isNote } from "../helpers";
import { ABCContext } from "../parsers/Context";
import { Token, TT } from "../parsers/scan2";
import { Note, Pitch, Rest, Rhythm } from "../types/Expr2";
import { alignBars } from "../Visitors/fmt2/fmt_aligner";
import { isTimeEvent, processBar } from "../Visitors/fmt2/fmt_timeMap";
import { BarAlignment, BarTimeMap, getNodeId, isBeam, Location, NodeID, VoiceSplit } from "../Visitors/fmt2/fmt_timeMapHelpers";
import { AbcFormatter } from "../Visitors/Formatter2";
import * as Generators from "./prs_pbt.generators.spec";

type Clone = {
  voiceSplits: VoiceSplit[];
  barAlignment: BarAlignment;
  ctx: ABCContext;
};

describe("alignBars function - Property-Based Tests", () => {
  let ctx: ABCContext;
  let stringifyVisitor: AbcFormatter;

  beforeEach(() => {
    ctx = new ABCContext();
    stringifyVisitor = new AbcFormatter(ctx);
  });

  /**
   * Creates a BarAlignment object from multiple BarTimeMap objects
   * Similar to mapTimePoints in fmt_timeMap.ts
   */
  function createBarAlignmentFromTimeMaps(timeMaps: Array<{ map: BarTimeMap; voiceIdx: number }>): BarAlignment {
    const startNodes = new Map<number, NodeID>();
    const timePointMap = new Map<string, Array<Location>>();

    // Set start nodes
    timeMaps.forEach(({ map, voiceIdx }) => {
      startNodes.set(voiceIdx, map.startNodeId);
    });

    // Combine time points from all voices
    timeMaps.forEach(({ map, voiceIdx }) => {
      map.map.forEach((nodeId, timeKey) => {
        if (!timePointMap.has(timeKey)) {
          timePointMap.set(timeKey, []);
        }
        timePointMap.get(timeKey)!.push({
          voiceIdx,
          nodeID: nodeId,
        });
      });
    });

    // Filter out time points that don't span multiple voices
    // We only need to align nodes that appear in multiple voices
    const keysToDelete: string[] = [];

    // Collect keys to delete
    for (const [timeKey, locations] of timePointMap.entries()) {
      if (locations.length < 2) {
        keysToDelete.push(timeKey);
      }
    }

    // Now safely delete the keys
    for (let i = 0; i < keysToDelete.length; i++) {
      timePointMap.delete(keysToDelete[i]);
    }

    return {
      startNodes,
      map: timePointMap,
    };
  }

  /**
   * Verifies that nodes at the same time points are aligned
   */
  function verifyAlignment(
    alignedVoiceSplits: VoiceSplit[],
    barAlignment: BarAlignment,
    stringifyVisitor: AbcFormatter,
    orig_str: string,
    clone?: Clone
  ): boolean {
    // Get time points that appear in multiple voices
    const timeKeys = Array.from(barAlignment.map.entries())
      .filter(([_, locations]) => locations.length > 1)
      .map(([timeKey, _]) => timeKey);

    // Check each time point
    for (const timeKey of timeKeys) {
      const locations = barAlignment.map.get(timeKey)!;

      const loc_str = locations.map((loc) => {
        const { voiceIdx, nodeID } = loc;
        const voice = alignedVoiceSplits[voiceIdx].content;
        const startNodeId = barAlignment.startNodes.get(voiceIdx)!;
        const startIdx = voice.findIndex((node) => getNodeId(node) === startNodeId);
        const nodeIdx = voice.findIndex((node) => getNodeId(node) === nodeID);
        const segment = voice.slice(startIdx, nodeIdx);
        const str = segment.map((node) => stringifyVisitor.stringify(node)).join("");
        return {
          ...loc,
          str,
        };
      });

      const hasEqual = loc_str.reduce((acc: number | null, loc) => {
        if (acc === null) return null;
        if (acc === -1) return loc.str.length;
        if (acc !== loc.str.length) {
          console.log("==== ERR ====");
          console.log("OR:");
          console.log(orig_str);
          console.log("NU:");
          console.log(alignedVoiceSplits.map((v) => v.content.map((e) => stringifyVisitor.stringify(e)).join("")).join("\n"));
          if (clone) {
            alignBars(clone.voiceSplits, clone.barAlignment, stringifyVisitor, ctx);
          }

          return null;
        }
        return acc;
      }, -1);

      if (hasEqual === null) return false;
    }

    return true;
  }

  /**
   * Helper function to log debug information
   */
  function logDebugInfo(message: string, voiceSplits?: VoiceSplit[], barAlignment?: BarAlignment): void {
    console.log("===================================");
    console.log("ERROR DETECTED - Debug information:");
    console.log(message);

    if (voiceSplits) {
      console.log(
        "Voice splits:",
        voiceSplits.map((vs) => ({
          type: vs.type,
          contentLength: vs.content.length,
        }))
      );
    }

    if (barAlignment) {
      console.log("Start nodes:", Array.from(barAlignment.startNodes.entries()));
      console.log("Time points:", Array.from(barAlignment.map.entries()));
    }
  }

  describe("basic alignment", () => {
    // Add a simple, controlled test case first
    it("aligns simple notes at the same time points", () => {
      // Create two simple voices with notes
      const ctx = new ABCContext();

      // Create first voice with two notes
      const noteA1 = new Note(
        ctx.generateId(),
        new Pitch(ctx.generateId(), { noteLetter: new Token(TT.NOTE_LETTER, "C", ctx.generateId()) }),
        undefined
      );

      const noteA2 = new Note(
        ctx.generateId(),
        new Pitch(ctx.generateId(), { noteLetter: new Token(TT.NOTE_LETTER, "D", ctx.generateId()) }),
        undefined
      );

      // Create second voice with two notes
      const noteB1 = new Note(
        ctx.generateId(),
        new Pitch(ctx.generateId(), { noteLetter: new Token(TT.NOTE_LETTER, "E", ctx.generateId()) }),
        undefined
      );

      const noteB2 = new Note(
        ctx.generateId(),
        new Pitch(ctx.generateId(), { noteLetter: new Token(TT.NOTE_LETTER, "F", ctx.generateId()) }),
        undefined
      );

      const voice1 = [noteA1, noteA2];
      const voice2 = [noteB1, noteB2];

      // Process each voice to create time maps
      const barTimeMap1 = processBar(voice1, getNodeId(voice1[0]));
      const barTimeMap2 = processBar(voice2, getNodeId(voice2[0]));

      // Create voice splits
      const voiceSplits: VoiceSplit[] = [
        { type: "formatted", content: voice1 },
        { type: "formatted", content: voice2 },
      ];

      // Create bar alignment
      const barAlignment = createBarAlignmentFromTimeMaps([
        { map: barTimeMap1, voiceIdx: 0 },
        { map: barTimeMap2, voiceIdx: 1 },
      ]);

      const orig_str = voiceSplits.map((v) => v.content.map((e) => stringifyVisitor.stringify(e)).join("")).join("\n");

      // Apply alignBars
      const alignedVoiceSplits = alignBars(voiceSplits, barAlignment, stringifyVisitor, ctx);

      // Verify alignment
      const result = verifyAlignment(alignedVoiceSplits, barAlignment, stringifyVisitor, orig_str);

      expect(result).to.be.true;
    });

    it("aligns nodes at the same time points across voices", () => {
      fc.assert(
        fc.property(
          // Generate 2-3 arrays of time events (reducing complexity)
          fc.array(
            fc.array(
              fc.oneof(
                { arbitrary: Generators.genNoteExpr, weight: 10 },
                { arbitrary: Generators.genRegularRestExpr, weight: 5 },
                { arbitrary: Generators.genChordExpr, weight: 5 }
                // Removed chord expressions to simplify test
              ),
              { minLength: 2, maxLength: 4 }
            ),
            { minLength: 2, maxLength: 3 }
          ),
          (voiceArrays) => {
            // 1. Extract expressions from generators
            const voices = voiceArrays.map((voice) => voice.map((item) => item.expr));

            // 2. Process each voice to create time maps
            const barTimeMaps = voices.map((voice, idx) => {
              const startNodeId = getNodeId(voice[0]);
              return {
                map: processBar(voice, startNodeId),
                voiceIdx: idx,
              };
            });

            // 3. Create voice splits
            const voiceSplits: VoiceSplit[] = voices.map((voice) => ({
              type: "formatted",
              content: voice,
            }));

            // 4. Create bar alignment from time maps
            const barAlignment = createBarAlignmentFromTimeMaps(barTimeMaps);

            // Skip test if there are no common time points
            const multiVoiceTimePoints = Array.from(barAlignment.map.entries())
              .filter(([_, locations]) => locations.length > 1)
              .map(([timeKey, _]) => timeKey);

            if (multiVoiceTimePoints.length === 0) {
              return true;
            }

            const orig_str = voiceSplits.map((v) => v.content.map((e) => stringifyVisitor.stringify(e)).join("")).join("\n");
            const clone: Clone = {
              voiceSplits: cloneDeep(voiceSplits),
              barAlignment: cloneDeep(barAlignment),
              ctx,
            };
            // 5. Apply alignBars
            const alignedVoiceSplits = alignBars(voiceSplits, barAlignment, stringifyVisitor, ctx);

            // 6. Verify alignment
            const result = verifyAlignment(alignedVoiceSplits, barAlignment, stringifyVisitor, orig_str, clone);

            if (!result) {
              logDebugInfo("Alignment verification failed", voiceSplits, barAlignment);
            }

            return result;
          }
        ),
        { numRuns: 5000, verbose: false }
      );
    });
  });

  describe("complex cases", () => {
    // Add a simple, controlled test case for alignment within a bar
    it("aligns notes at the same time points within a bar", () => {
      // Create a context
      const ctx = new ABCContext();

      // Create notes with specific rhythms to ensure multiple time points
      // Voice 1: C D - two quarter notes
      const noteA1 = new Note(
        ctx.generateId(),
        new Pitch(ctx.generateId(), { noteLetter: new Token(TT.NOTE_LETTER, "C", ctx.generateId()) }),
        new Rhythm(ctx.generateId(), new Token(TT.RHY_NUMER, "1", ctx.generateId()), undefined, undefined, undefined)
      );

      const noteA2 = new Note(
        ctx.generateId(),
        new Pitch(ctx.generateId(), { noteLetter: new Token(TT.NOTE_LETTER, "D", ctx.generateId()) }),
        new Rhythm(ctx.generateId(), new Token(TT.RHY_NUMER, "1", ctx.generateId()), undefined, undefined, undefined)
      );

      // Voice 2: E F - two quarter notes
      const noteB1 = new Note(
        ctx.generateId(),
        new Pitch(ctx.generateId(), { noteLetter: new Token(TT.NOTE_LETTER, "E", ctx.generateId()) }),
        new Rhythm(ctx.generateId(), new Token(TT.RHY_NUMER, "1", ctx.generateId()), undefined, undefined, undefined)
      );

      const noteB2 = new Note(
        ctx.generateId(),
        new Pitch(ctx.generateId(), { noteLetter: new Token(TT.NOTE_LETTER, "F", ctx.generateId()) }),
        new Rhythm(ctx.generateId(), new Token(TT.RHY_NUMER, "1", ctx.generateId()), undefined, undefined, undefined)
      );

      // Add a whitespace token between notes to test padding insertion
      const ws1 = new Token(TT.WS, " ", ctx.generateId());
      const ws2 = new Token(TT.WS, " ", ctx.generateId());

      const voice1 = [noteA1, ws1, noteA2];
      const voice2 = [noteB1, ws2, noteB2];

      // Process each voice to create time maps
      const barTimeMap1 = processBar(voice1, getNodeId(voice1[0]));
      const barTimeMap2 = processBar(voice2, getNodeId(voice2[0]));

      // Create voice splits
      const voiceSplits: VoiceSplit[] = [
        { type: "formatted", content: voice1 },
        { type: "formatted", content: voice2 },
      ];

      // Create bar alignment
      const barAlignment = createBarAlignmentFromTimeMaps([
        { map: barTimeMap1, voiceIdx: 0 },
        { map: barTimeMap2, voiceIdx: 1 },
      ]);

      const orig_str = voiceSplits.map((v) => v.content.map((e) => stringifyVisitor.stringify(e)).join("")).join("\n");
      const alignedVoiceSplits = alignBars(voiceSplits, barAlignment, stringifyVisitor, ctx);
      const result = verifyAlignment(alignedVoiceSplits, barAlignment, stringifyVisitor, orig_str);

      expect(result).to.be.true;
    });

    // Note: Grace groups are not time events themselves.
    // It's the following note or chord that determines the alignment.

    it("aligns complex system with broken rhythms and ties", () => {
      // Create a context
      const ctx = new ABCContext();

      // Voice 1: z>A-z (rest with broken rhythm, note with tie, rest)
      const restV1_1 = new Rest(
        ctx.generateId(),
        new Token(TT.REST, "z", ctx.generateId()),
        new Rhythm(ctx.generateId(), null, undefined, null, new Token(TT.RHY_BRKN, ">", ctx.generateId()))
      );

      const noteV1_2 = new Note(
        ctx.generateId(),
        new Pitch(ctx.generateId(), { noteLetter: new Token(TT.NOTE_LETTER, "A", ctx.generateId()) }),
        undefined,
        new Token(TT.TIE, "-", ctx.generateId())
      );

      const restV1_3 = new Rest(ctx.generateId(), new Token(TT.REST, "z", ctx.generateId()), undefined);

      // Voice 2: zA (rest, note)
      const restV2_1 = new Rest(ctx.generateId(), new Token(TT.REST, "z", ctx.generateId()), undefined);

      const noteV2_2 = new Note(
        ctx.generateId(),
        new Pitch(ctx.generateId(), { noteLetter: new Token(TT.NOTE_LETTER, "A", ctx.generateId()) }),
        undefined
      );

      // Voice 3: a>zz (note with broken rhythm, two rests)
      const noteV3_1 = new Note(
        ctx.generateId(),
        new Pitch(ctx.generateId(), { noteLetter: new Token(TT.NOTE_LETTER, "a", ctx.generateId()) }),
        new Rhythm(ctx.generateId(), null, undefined, null, new Token(TT.RHY_BRKN, ">", ctx.generateId()))
      );

      const restV3_2 = new Rest(ctx.generateId(), new Token(TT.REST, "z", ctx.generateId()), undefined);

      const restV3_3 = new Rest(ctx.generateId(), new Token(TT.REST, "z", ctx.generateId()), undefined);

      const voice1 = [restV1_1, noteV1_2, restV1_3];
      const voice2 = [restV2_1, noteV2_2];
      const voice3 = [noteV3_1, restV3_2, restV3_3];

      // Process each voice to create time maps
      const barTimeMap1 = processBar(voice1, getNodeId(voice1[0]));
      const barTimeMap2 = processBar(voice2, getNodeId(voice2[0]));
      const barTimeMap3 = processBar(voice3, getNodeId(voice3[0]));

      // Create voice splits
      const voiceSplits: VoiceSplit[] = [
        { type: "formatted", content: voice1 },
        { type: "formatted", content: voice2 },
        { type: "formatted", content: voice3 },
      ];

      // Create bar alignment
      const barAlignment = createBarAlignmentFromTimeMaps([
        { map: barTimeMap1, voiceIdx: 0 },
        { map: barTimeMap2, voiceIdx: 1 },
        { map: barTimeMap3, voiceIdx: 2 },
      ]);

      const orig_str = voiceSplits.map((v) => v.content.map((e) => stringifyVisitor.stringify(e)).join("")).join("\n");
      const alignedVoiceSplits = alignBars(voiceSplits, barAlignment, stringifyVisitor, ctx);
      const result = verifyAlignment(alignedVoiceSplits, barAlignment, stringifyVisitor, orig_str);

      expect(result).to.be.true;
    });

    it("aligns complex musical expressions with grace notes, decorations, and more", () => {
      fc.assert(
        fc.property(
          // Generate 2-3 arrays of complex musical expressions
          fc.array(
            fc.array(
              fc.oneof(
                // Include time events (notes, chords, rests) as they determine alignment
                { arbitrary: Generators.genNoteExpr, weight: 10 },
                { arbitrary: Generators.genRegularRestExpr, weight: 5 },
                { arbitrary: Generators.genChordExpr, weight: 5 },

                // Include grace notes (which attach to the following note)
                { arbitrary: Generators.genGraceGroupExpr, weight: 3 },

                // Include decorations
                { arbitrary: Generators.genDecorationExpr, weight: 3 },

                // Include beams (groups of notes)
                { arbitrary: Generators.genBeamExpr, weight: 3 },

                // Include annotations
                { arbitrary: Generators.genAnnotationExpr, weight: 2 },

                // Include symbols
                { arbitrary: Generators.genSymbolExpr, weight: 2 }
              ),
              { minLength: 2, maxLength: 6 }
            ),
            { minLength: 2, maxLength: 3 }
          ),
          (voiceArrays) => {
            // 1. Extract expressions from generators
            const voices = voiceArrays.map((voice) => {
              // Filter out non-time events at the beginning of each voice
              // to ensure we have a valid start node for time mapping
              const firstTimeEventIndex = voice.findIndex(
                (item) => isNote(item.expr) || isChord(item.expr) || item.expr instanceof Rest || isBeam(item.expr)
              );

              if (firstTimeEventIndex === -1) {
                // If no time events, generate a simple note to ensure we have a time event
                const noteExpr = fc.sample(Generators.genNoteExpr, 1)[0];
                // Push the note expression into the voice array
                const result = voice.map((item) => item.expr);
                result.push(noteExpr.expr);
                return result;
              }

              // Ensure we have at least one time event in each voice
              return voice.map((item) => item.expr);
            });

            // 2. Process each voice to create time maps
            const barTimeMaps = voices
              .map((voice, idx) => {
                // Find the first time event to use as start node
                const firstTimeEventIndex = voice.findIndex((node) => isNote(node) || isChord(node) || node instanceof Rest || isBeam(node));

                if (firstTimeEventIndex === -1) {
                  // This shouldn't happen due to our filtering above, but just in case
                  return null;
                }

                const startNodeId = getNodeId(voice[firstTimeEventIndex]);
                return {
                  map: processBar(voice, startNodeId),
                  voiceIdx: idx,
                };
              })
              .filter((map) => map !== null) as Array<{ map: BarTimeMap; voiceIdx: number }>;

            // Skip test if we don't have at least 2 valid voices with time maps
            if (barTimeMaps.length < 2) {
              return true;
            }

            // 3. Create voice splits
            const voiceSplits: VoiceSplit[] = voices.map((voice) => ({
              type: "formatted",
              content: voice,
            }));

            // 4. Create bar alignment from time maps
            const barAlignment = createBarAlignmentFromTimeMaps(barTimeMaps);

            // Skip test if there are no common time points
            const multiVoiceTimePoints = Array.from(barAlignment.map.entries())
              .filter(([_, locations]) => locations.length > 1)
              .map(([timeKey, _]) => timeKey);

            if (multiVoiceTimePoints.length === 0) {
              return true;
            }

            const orig_str = voiceSplits.map((v) => v.content.map((e) => stringifyVisitor.stringify(e)).join("")).join("\n");
            const clone: Clone = {
              voiceSplits: cloneDeep(voiceSplits),
              barAlignment: cloneDeep(barAlignment),
              ctx,
            };

            // 5. Apply alignBars
            const alignedVoiceSplits = alignBars(voiceSplits, barAlignment, stringifyVisitor, ctx);

            // 6. Verify alignment
            const result = verifyAlignment(alignedVoiceSplits, barAlignment, stringifyVisitor, orig_str, clone);

            if (!result) {
              logDebugInfo("Complex alignment verification failed", voiceSplits, barAlignment);
            }

            return result;
          }
        ),
        { numRuns: 1000, verbose: true }
      );
    });

    it("aligns complex musical expressions with mixed elements in a single bar", () => {
      fc.assert(
        fc.property(
          // Generate a sequence of mixed musical expressions for each voice
          fc.array(
            fc.array(
              fc.oneof(
                // Base time events
                { arbitrary: Generators.genNoteExpr, weight: 10 },
                { arbitrary: Generators.genRegularRestExpr, weight: 5 },
                { arbitrary: Generators.genChordExpr, weight: 5 },

                // Create complex combinations
                fc.tuple(Generators.genGraceGroupExpr, Generators.genNoteExpr).map(([grace, note]) => {
                  // Combine grace group with a note
                  return {
                    tokens: [...grace.tokens, ...note.tokens],
                    expr: note.expr, // The note is the time event
                  };
                }),

                fc.tuple(Generators.genDecorationExpr, Generators.genNoteExpr).map(([deco, note]) => {
                  // Combine decoration with a note
                  return {
                    tokens: [...deco.tokens, ...note.tokens],
                    expr: note.expr, // The note is the time event
                  };
                }),

                fc.tuple(Generators.genAnnotationExpr, Generators.genChordExpr).map(([anno, chord]) => {
                  // Combine annotation with a chord
                  return {
                    tokens: [...anno.tokens, ...chord.tokens],
                    expr: chord.expr, // The chord is the time event
                  };
                }),

                fc.tuple(Generators.genSymbolExpr, Generators.genNoteExpr).map(([symbol, note]) => {
                  // Combine symbol with a note
                  return {
                    tokens: [...symbol.tokens, ...note.tokens],
                    expr: note.expr, // The note is the time event
                  };
                })
              ),
              { minLength: 2, maxLength: 5 }
            ),
            { minLength: 2, maxLength: 3 }
          ),
          (voiceArrays) => {
            // 1. Extract expressions from generators
            const voices = voiceArrays.map((voice) => voice.map((item) => item.expr));

            // 2. Process each voice to create time maps
            const barTimeMaps = voices
              .map((voice, idx) => {
                // Find the first time event to use as start node
                const firstTimeEventIndex = voice.findIndex((node) => isTimeEvent(node));

                if (firstTimeEventIndex === -1) {
                  // If no time events, skip this voice
                  return null;
                }

                const startNodeId = getNodeId(voice[firstTimeEventIndex]);
                return {
                  map: processBar(voice, startNodeId),
                  voiceIdx: idx,
                };
              })
              .filter((map) => map !== null) as Array<{ map: BarTimeMap; voiceIdx: number }>;

            // Skip test if we don't have at least 2 valid voices with time maps
            if (barTimeMaps.length < 2) {
              return true;
            }

            // 3. Create voice splits
            const voiceSplits: VoiceSplit[] = voices.map((voice) => ({
              type: "formatted",
              content: voice,
            }));

            // 4. Create bar alignment from time maps
            const barAlignment = createBarAlignmentFromTimeMaps(barTimeMaps);

            // Skip test if there are no common time points
            const multiVoiceTimePoints = Array.from(barAlignment.map.entries())
              .filter(([_, locations]) => locations.length > 1)
              .map(([timeKey, _]) => timeKey);

            if (multiVoiceTimePoints.length === 0) {
              return true;
            }

            const orig_str = voiceSplits.map((v) => v.content.map((e) => stringifyVisitor.stringify(e)).join("")).join("\n");
            const clone: Clone = {
              voiceSplits: cloneDeep(voiceSplits),
              barAlignment: cloneDeep(barAlignment),
              ctx,
            };

            // 5. Apply alignBars
            const alignedVoiceSplits = alignBars(voiceSplits, barAlignment, stringifyVisitor, ctx);

            // 6. Verify alignment
            const result = verifyAlignment(alignedVoiceSplits, barAlignment, stringifyVisitor, orig_str, clone);

            if (!result) {
              logDebugInfo("Mixed elements alignment verification failed", voiceSplits, barAlignment);
            }

            return result;
          }
        ),
        { numRuns: 1000, verbose: true }
      );
    });
  });

  describe("edge cases", () => {
    // Note: Single voice case is handled earlier in the formatting pipeline

    it("handles empty voices", () => {
      // Create empty voice splits
      const voiceSplits: VoiceSplit[] = [
        { type: "formatted", content: [] },
        { type: "formatted", content: [] },
      ];

      // Create an empty bar alignment
      const barAlignment: BarAlignment = {
        startNodes: new Map(),
        map: new Map(),
      };

      // Apply alignBars
      const alignedVoiceSplits = alignBars(voiceSplits, barAlignment, stringifyVisitor, ctx);

      // Verify that the result is still empty
      expect(alignedVoiceSplits[0].content).to.have.lengthOf(0);
      expect(alignedVoiceSplits[1].content).to.have.lengthOf(0);
    });

    it("handles voices with no common time points", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.oneof(
              { arbitrary: Generators.genNoteExpr, weight: 10 },
              { arbitrary: Generators.genChordExpr, weight: 5 },
              { arbitrary: Generators.genRegularRestExpr, weight: 5 }
            ),
            { minLength: 2, maxLength: 5 }
          ),
          fc.array(
            fc.oneof(
              { arbitrary: Generators.genNoteExpr, weight: 10 },
              { arbitrary: Generators.genChordExpr, weight: 5 },
              { arbitrary: Generators.genRegularRestExpr, weight: 5 }
            ),
            { minLength: 2, maxLength: 5 }
          ),
          (exprArray1, exprArray2) => {
            // Create two voices
            const voice1 = exprArray1.map((expr) => expr.expr);
            const voice2 = exprArray2.map((expr) => expr.expr);

            // Process each voice to create time maps
            const barTimeMap1 = processBar(voice1, getNodeId(voice1[0]));
            const barTimeMap2 = processBar(voice2, getNodeId(voice2[0]));

            // Create voice splits
            const voiceSplits: VoiceSplit[] = [
              { type: "formatted", content: voice1 },
              { type: "formatted", content: voice2 },
            ];

            // Create bar alignment
            const barAlignment = createBarAlignmentFromTimeMaps([
              { map: barTimeMap1, voiceIdx: 0 },
              { map: barTimeMap2, voiceIdx: 1 },
            ]);

            // Manually remove any common time points to ensure no alignment
            const timePoints = Array.from(barAlignment.map.keys());
            for (const timePoint of timePoints) {
              const locations = barAlignment.map.get(timePoint)!;
              if (locations.length > 1) {
                // Keep only the first location
                barAlignment.map.set(timePoint, [locations[0]]);
              }
            }

            // Apply alignBars
            const alignedVoiceSplits = alignBars(voiceSplits, barAlignment, stringifyVisitor, ctx);

            // Since there are no common time points, the voices should be unchanged
            // (except for possible whitespace tokens, which don't affect the music)
            const originalStr1 = voice1.map((node) => stringifyVisitor.stringify(node)).join("");
            const alignedStr1 = alignedVoiceSplits[0].content
              .filter((node) => !(node instanceof Token && node.type === TT.WS))
              .map((node) => stringifyVisitor.stringify(node))
              .join("");

            const originalStr2 = voice2.map((node) => stringifyVisitor.stringify(node)).join("");
            const alignedStr2 = alignedVoiceSplits[1].content
              .filter((node) => !(node instanceof Token && node.type === TT.WS))
              .map((node) => stringifyVisitor.stringify(node))
              .join("");

            return originalStr1 === alignedStr1 && originalStr2 === alignedStr2;
          }
        ),
        { numRuns: 100, verbose: true }
      );
    });
  });
});
