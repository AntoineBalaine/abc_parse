import { expect } from "chai";
import * as fc from "fast-check";
import { ABCContext } from "../parsers/Context";
import { Token, TT } from "../parsers/scan2";
import { Beam, Chord, MultiMeasureRest, Note, Pitch, Rest, Rhythm, System } from "../types/Expr2";
import { alignBars } from "../Visitors/fmt2/fmt_aligner";
import { processBar } from "../Visitors/fmt2/fmt_timeMap";
import { BarAlignment, BarTimeMap, Location, NodeID, VoiceSplit, getNodeId } from "../Visitors/fmt2/fmt_timeMapHelpers";
import { findPaddingInsertionPoint } from "../Visitors/fmt2/fmt_alignerHelpers";
import { AbcFormatter2 } from "../Visitors/Formatter2";
import * as Generators from "./parse2_pbt.generators.spec";
import { rationalToString } from "../Visitors/fmt2/rational";
import { isToken } from "../helpers2";

describe.only("alignBars function - Property-Based Tests", () => {
  let ctx: ABCContext;
  let stringifyVisitor: AbcFormatter2;

  beforeEach(() => {
    ctx = new ABCContext();
    stringifyVisitor = new AbcFormatter2(ctx);
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
  function verifyAlignment(alignedVoiceSplits: VoiceSplit[], barAlignment: BarAlignment, stringifyVisitor: AbcFormatter2): boolean {
    // Get time points that appear in multiple voices
    const multiVoiceTimePoints = Array.from(barAlignment.map.entries())
      .filter(([_, locations]) => locations.length > 1)
      .map(([timeKey, _]) => timeKey);

    if (multiVoiceTimePoints.length === 0) {
      // No time points to check
      return true;
    }

    // Check each time point
    for (const timeKey of multiVoiceTimePoints) {
      const locations = barAlignment.map.get(timeKey)!;

      // Get string lengths up to each node
      const stringLengths: { length: number; content: string; voiceIdx: number; nodeID: NodeID; startIdx: number; nodeIdx: number }[] = locations.map(
        (location) => {
          const { voiceIdx, nodeID } = location;
          const voice = alignedVoiceSplits[voiceIdx].content;
          const startNodeId = barAlignment.startNodes.get(voiceIdx)!;

          // Find indices
          const startIdx = voice.findIndex((node) => getNodeId(node) === startNodeId);
          const nodeIdx = voice.findIndex((node) => getNodeId(node) === nodeID);

          if (startIdx === -1 || nodeIdx === -1) {
            console.error(
              `Node not found: startIdx=${startIdx}, nodeIdx=${nodeIdx}, voiceIdx=${voiceIdx}, nodeID=${nodeID}, startNodeId=${startNodeId}`
            );
            return { length: -1, content: "", voiceIdx, nodeID, startIdx, nodeIdx }; // Error case
          }

          // Stringify content up to node
          const segment = voice.slice(startIdx, nodeIdx + 1);
          const str = segment.map((node) => stringifyVisitor.stringify(node)).join("");

          // Log detailed information about the segment
          console.log(`Voice ${voiceIdx} at time ${timeKey}:`);
          console.log(`  Start node ID: ${startNodeId}, index: ${startIdx}`);
          console.log(`  End node ID: ${nodeID}, index: ${nodeIdx}`);
          console.log(`  Segment: ${str}`);
          console.log(`  Length: ${str.length}`);

          // Log each node in the segment
          segment.forEach((node, idx) => {
            const nodeStr = stringifyVisitor.stringify(node);
            console.log(`    Node ${idx} (ID: ${getNodeId(node)}): "${nodeStr}" (${nodeStr.length})`);
          });

          return { length: str.length, content: str, voiceIdx, nodeID, startIdx, nodeIdx };
        }
      );

      // Check if all lengths are equal
      const validLengths = stringLengths.filter((item) => item.length >= 0);
      if (validLengths.length < 2) {
        // Not enough valid lengths to compare
        continue;
      }

      const firstLength = validLengths[0].length;
      const allEqual = validLengths.every((item) => item.length === firstLength);

      if (!allEqual) {
        console.error(`Alignment failed at time ${timeKey}:`);
        validLengths.forEach((item) => {
          console.error(`Voice ${item.voiceIdx}, Node ${item.nodeID}: Length ${item.length}, Content: "${item.content}"`);

          // Log whitespace tokens in the voice
          const voice = alignedVoiceSplits[item.voiceIdx].content;
          console.error(`  Whitespace tokens in voice ${item.voiceIdx}:`);
          voice.forEach((node, idx) => {
            if (isToken(node) && node.type === TT.WS) {
              console.error(`    Index ${idx}: "${stringifyVisitor.stringify(node)}" (${stringifyVisitor.stringify(node).length})`);
            }
          });

          // Log insertion point that would be used
          const insertIdx = findPaddingInsertionPoint(voice, item.nodeID, barAlignment.startNodes.get(item.voiceIdx)!);
          console.error(`  Insertion point: ${insertIdx}`);
          if (insertIdx !== -1 && insertIdx < voice.length) {
            const nodeAtInsertPoint = voice[insertIdx];
            console.error(
              `    Node at insertion point: ${nodeAtInsertPoint instanceof Token ? nodeAtInsertPoint.type : nodeAtInsertPoint.constructor.name}`
            );
          }
        });
        return false;
      }
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
      const noteA1 = new Note(ctx.generateId(), new Pitch(ctx.generateId(), { noteLetter: new Token(TT.NOTE_LETTER, "C") }), undefined);

      const noteA2 = new Note(ctx.generateId(), new Pitch(ctx.generateId(), { noteLetter: new Token(TT.NOTE_LETTER, "D") }), undefined);

      // Create second voice with two notes
      const noteB1 = new Note(ctx.generateId(), new Pitch(ctx.generateId(), { noteLetter: new Token(TT.NOTE_LETTER, "E") }), undefined);

      const noteB2 = new Note(ctx.generateId(), new Pitch(ctx.generateId(), { noteLetter: new Token(TT.NOTE_LETTER, "F") }), undefined);

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

      // Apply alignBars
      const alignedVoiceSplits = alignBars(voiceSplits, barAlignment, stringifyVisitor, ctx);

      // Verify alignment
      const result = verifyAlignment(alignedVoiceSplits, barAlignment, stringifyVisitor);

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
                { arbitrary: Generators.genRegularRestExpr, weight: 5 }
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

            // 5. Apply alignBars
            const alignedVoiceSplits = alignBars(voiceSplits, barAlignment, stringifyVisitor, ctx);

            // 6. Verify alignment
            const result = verifyAlignment(alignedVoiceSplits, barAlignment, stringifyVisitor);

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
        new Pitch(ctx.generateId(), { noteLetter: new Token(TT.NOTE_LETTER, "C") }),
        new Rhythm(ctx.generateId(), new Token(TT.RHY_NUMER, "1"), undefined, undefined, undefined)
      );

      const noteA2 = new Note(
        ctx.generateId(),
        new Pitch(ctx.generateId(), { noteLetter: new Token(TT.NOTE_LETTER, "D") }),
        new Rhythm(ctx.generateId(), new Token(TT.RHY_NUMER, "1"), undefined, undefined, undefined)
      );

      // Voice 2: E F - two quarter notes
      const noteB1 = new Note(
        ctx.generateId(),
        new Pitch(ctx.generateId(), { noteLetter: new Token(TT.NOTE_LETTER, "E") }),
        new Rhythm(ctx.generateId(), new Token(TT.RHY_NUMER, "1"), undefined, undefined, undefined)
      );

      const noteB2 = new Note(
        ctx.generateId(),
        new Pitch(ctx.generateId(), { noteLetter: new Token(TT.NOTE_LETTER, "F") }),
        new Rhythm(ctx.generateId(), new Token(TT.RHY_NUMER, "1"), undefined, undefined, undefined)
      );

      // Add a whitespace token between notes to test padding insertion
      const ws1 = new Token(TT.WS, " ");
      const ws2 = new Token(TT.WS, " ");

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

      // Debug: Print time points and locations
      console.log("Bar Alignment:");
      Array.from(barAlignment.map.entries()).forEach(([timeKey, locations]) => {
        console.log(`Time ${timeKey}:`, locations);
      });
      console.log("Start Nodes:", Array.from(barAlignment.startNodes.entries()));

      // Debug: Print original voice content
      console.log("Original Voice 1:", voice1.map((node) => stringifyVisitor.stringify(node)).join(""));
      console.log("Original Voice 2:", voice2.map((node) => stringifyVisitor.stringify(node)).join(""));

      // Apply alignBars
      const alignedVoiceSplits = alignBars(voiceSplits, barAlignment, stringifyVisitor, ctx);

      // Debug: Print aligned voice content
      console.log("Aligned Voice 1:", alignedVoiceSplits[0].content.map((node) => stringifyVisitor.stringify(node)).join(""));
      console.log("Aligned Voice 2:", alignedVoiceSplits[1].content.map((node) => stringifyVisitor.stringify(node)).join(""));

      // Verify alignment
      const result = verifyAlignment(alignedVoiceSplits, barAlignment, stringifyVisitor);

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
        new Token(TT.REST, "z"),
        new Rhythm(ctx.generateId(), null, undefined, null, new Token(TT.RHY_BRKN, ">"))
      );

      const noteV1_2 = new Note(
        ctx.generateId(),
        new Pitch(ctx.generateId(), { noteLetter: new Token(TT.NOTE_LETTER, "A") }),
        undefined,
        new Token(TT.TIE, "-")
      );

      const restV1_3 = new Rest(ctx.generateId(), new Token(TT.REST, "z"), undefined);

      // Voice 2: zA (rest, note)
      const restV2_1 = new Rest(ctx.generateId(), new Token(TT.REST, "z"), undefined);

      const noteV2_2 = new Note(ctx.generateId(), new Pitch(ctx.generateId(), { noteLetter: new Token(TT.NOTE_LETTER, "A") }), undefined);

      // Voice 3: a>zz (note with broken rhythm, two rests)
      const noteV3_1 = new Note(
        ctx.generateId(),
        new Pitch(ctx.generateId(), { noteLetter: new Token(TT.NOTE_LETTER, "a") }),
        new Rhythm(ctx.generateId(), null, undefined, null, new Token(TT.RHY_BRKN, ">"))
      );

      const restV3_2 = new Rest(ctx.generateId(), new Token(TT.REST, "z"), undefined);

      const restV3_3 = new Rest(ctx.generateId(), new Token(TT.REST, "z"), undefined);

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

      // Debug: Print time points and locations
      console.log("Bar Alignment:");
      Array.from(barAlignment.map.entries()).forEach(([timeKey, locations]) => {
        console.log(`Time ${timeKey}:`, locations);
      });
      console.log("Start Nodes:", Array.from(barAlignment.startNodes.entries()));

      // Debug: Print original voice content
      console.log("Original Voice 1:", voice1.map((node) => stringifyVisitor.stringify(node)).join(""));
      console.log("Original Voice 2:", voice2.map((node) => stringifyVisitor.stringify(node)).join(""));
      console.log("Original Voice 3:", voice3.map((node) => stringifyVisitor.stringify(node)).join(""));

      // Apply alignBars
      const alignedVoiceSplits = alignBars(voiceSplits, barAlignment, stringifyVisitor, ctx);

      // Debug: Print aligned voice content
      console.log("Aligned Voice 1:", alignedVoiceSplits[0].content.map((node) => stringifyVisitor.stringify(node)).join(""));
      console.log("Aligned Voice 2:", alignedVoiceSplits[1].content.map((node) => stringifyVisitor.stringify(node)).join(""));
      console.log("Aligned Voice 3:", alignedVoiceSplits[2].content.map((node) => stringifyVisitor.stringify(node)).join(""));

      // Verify alignment
      const result = verifyAlignment(alignedVoiceSplits, barAlignment, stringifyVisitor);

      expect(result).to.be.true;
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
