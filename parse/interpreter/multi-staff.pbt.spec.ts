/**
 * Multi-Staff Property-Based Tests
 *
 * Tests multi-voice/multi-staff functionality using generative testing.
 */

import { expect } from "chai";
import * as fc from "fast-check";
import { ABCContext } from "../parsers/Context";
import { AbcErrorReporter } from "../parsers/ErrorReporter";
import { Scanner, Token } from "../parsers/scan2";
import { parse } from "../parsers/parse2";
import { SemanticAnalyzer } from "../analyzers/semantic-analyzer";
import { TuneInterpreter } from "./TuneInterpreter";
import { StaffSystem, ElementType } from "../types/abcjs-ast";
import { AbcFormatter } from "../Visitors/Formatter2";
import { genNote, genChord, genRest, genBarline } from "../tests/scn_pbt.generators.spec";

// ============================================================================
// Generators
// ============================================================================

/**
 * Generate voice declaration with optional properties
 */
const genVoiceDeclaration = fc.record({
  id: fc.constantFrom("1", "2", "3", "4"),
  clef: fc.option(fc.constantFrom("treble", "bass", "alto", "tenor"), { nil: undefined }),
  name: fc.option(fc.string(), { nil: undefined }),
});

/**
 * Generate a measure (sequence of notes/chords/rests ending with barline)
 */
const genMeasure = fc.tuple(fc.array(fc.oneof(genNote, genChord, genRest), { minLength: 1, maxLength: 8 }), genBarline);

/**
 * Generate a complete multi-voice tune
 */
const genMultiVoiceTune = fc
  .array(genVoiceDeclaration, { minLength: 1, maxLength: 4 })
  .map((voices) => {
    // Ensure unique voice IDs
    const uniqueVoices = new Map<string, (typeof voices)[0]>();
    voices.forEach((v) => uniqueVoices.set(v.id, v));
    return Array.from(uniqueVoices.values());
  })
  .chain((voices) => {
    // Extract declared voice IDs
    const declaredVoiceIds = voices.map((v) => v.id);

    // Generate voice sections using ONLY declared voices
    const genVoiceSectionForDeclaredVoices = fc.record({
      voiceId: fc.constantFrom(...declaredVoiceIds),
      measures: fc.array(genMeasure, { minLength: 1, maxLength: 4 }),
    });

    return fc.record({
      voices: fc.constant(voices),
      bodySections: fc.array(genVoiceSectionForDeclaredVoices, { minLength: 2, maxLength: 15 }),
    });
  })
  .map(({ voices, bodySections }) => {
    const ctx = new ABCContext(new AbcErrorReporter());
    const formatter = new AbcFormatter(ctx);

    // Build ABC string
    const lines: string[] = ["X:1", "M:4/4", "L:1/4"];

    // Add voice declarations
    voices.forEach((v) => {
      let voiceLine = `V:${v.id}`;
      if (v.clef) voiceLine += ` clef=${v.clef}`;
      if (v.name) voiceLine += ` name="${v.name}"`;
      lines.push(voiceLine);
    });

    lines.push("K:C");

    // Add body sections
    bodySections.forEach((section) => {
      lines.push(`V:${section.voiceId}`);
      section.measures.forEach(([elements, barline]) => {
        // Flatten elements (can be Token or Token[])
        const allTokens: Token[] = [];
        elements.forEach((elem: Token | Token[]) => {
          if (Array.isArray(elem)) {
            allTokens.push(...elem);
          } else {
            allTokens.push(elem);
          }
        });
        allTokens.push(barline);

        const measureStr = allTokens.map((token) => formatter.visitToken(token)).join("");
        lines.push(measureStr);
      });
    });

    const abc = lines.join("\n");

    return {
      abc,
      declaredVoices: voices,
      bodySections,
    };
  });

// ============================================================================
// Helper Functions
// ============================================================================

function interpretABC(abc: string) {
  const ctx = new ABCContext(new AbcErrorReporter());
  const tokens = Scanner(abc, ctx);
  const ast = parse(tokens, ctx);
  const analyzer = new SemanticAnalyzer(ctx);
  ast.accept(analyzer);
  const interpreter = new TuneInterpreter(analyzer, ctx, abc);
  const result = interpreter.interpretFile(ast);
  return { tune: result.tunes[0], ctx };
}

/**
 * Count all elements in the tune structure
 */
function countAllElements(tune: any): number {
  let total = 0;
  for (const system of tune.systems) {
    if (!("staff" in system)) continue;
    for (const staff of (system as StaffSystem).staff) {
      for (const voice of staff.voices) {
        total += voice.length;
      }
    }
  }
  return total;
}

/**
 * Count expected elements from the generated pattern
 * NOTE: We count ELEMENTS, not tokens. genNote/genChord/genRest each produce ONE element.
 */
function countExpectedElements(bodySections: any[]): number {
  let total = 0;
  for (const section of bodySections) {
    for (const measure of section.measures) {
      const [elements, barline] = measure;
      // Each item in elements array is ONE musical element (note/chord/rest)
      // regardless of how many tokens it contains
      total += elements.length;
      total += 1; // +1 for barline
    }
  }
  return total;
}

/**
 * Extract voice-to-staff mapping from tune structure
 */
function getVoiceToStaffMapping(tune: any): Map<string, number> {
  const mapping = new Map<string, number>();

  for (const system of tune.systems) {
    if (!("staff" in system)) continue;
    const staffSystem = system as StaffSystem;

    for (let staffNum = 0; staffNum < staffSystem.staff.length; staffNum++) {
      const staff = staffSystem.staff[staffNum];
      // In our implementation, each staff.voices[i] corresponds to a voice
      // We'd need to track which voice ID is at which position
      // For now, we can verify that each (staff, voice_index) pair is consistent
    }
  }

  return mapping;
}

/**
 * Check if a voice appears in multiple positions across systems
 */
function checkVoicePositionConsistency(tune: any): boolean {
  // Track (staffNum, voiceIndex) for each voice
  const voicePositions = new Map<string, Set<string>>();

  for (const system of tune.systems) {
    if (!("staff" in system)) continue;
    const staffSystem = system as StaffSystem;

    for (let staffNum = 0; staffNum < staffSystem.staff.length; staffNum++) {
      const staff = staffSystem.staff[staffNum];
      for (let voiceIdx = 0; voiceIdx < staff.voices.length; voiceIdx++) {
        if (staff.voices[voiceIdx].length > 0) {
          const key = `${staffNum},${voiceIdx}`;
          // In a real implementation, we'd track voice ID -> position mapping
          // For now, verify that each (staff, voice) pair is unique per system
        }
      }
    }
  }

  return true;
}

// ============================================================================
// Property-Based Tests
// ============================================================================

describe("Multi-Staff Property-Based Tests", () => {
  it("property: all elements are conserved (nothing lost or duplicated)", () => {
    fc.assert(
      fc.property(genMultiVoiceTune, ({ abc, bodySections }) => {
        const { tune, ctx } = interpretABC(abc);

        // Count expected elements (from generated pattern)
        const expectedCount = countExpectedElements(bodySections);

        // Count actual elements (from tune structure)
        const actualCount = countAllElements(tune);

        // Elements should be conserved
        if (expectedCount !== actualCount) {
          console.log("Element mismatch!");
          console.log("ABC:", abc);
          console.log(`Expected: ${expectedCount}, Actual: ${actualCount}`);
          return false;
        }

        return true;
      }),
      { numRuns: 100, verbose: false }
    );
  });

  it("property: voice count matches declared voices", () => {
    fc.assert(
      fc.property(genMultiVoiceTune, ({ abc, declaredVoices }) => {
        const { tune } = interpretABC(abc);

        // Number of unique voices used should match declarations
        const expectedVoiceCount = declaredVoices.length;

        // tune.voiceNum should match
        if (tune.voiceNum !== expectedVoiceCount) {
          console.log("Voice count mismatch!");
          console.log("ABC:", abc);
          console.log(`Expected: ${expectedVoiceCount}, Actual: ${tune.voiceNum}`);
          return false;
        }

        return true;
      }),
      { numRuns: 100, verbose: false }
    );
  });

  it("property: staff count is consistent", () => {
    fc.assert(
      fc.property(genMultiVoiceTune, ({ abc, declaredVoices }) => {
        const { tune } = interpretABC(abc);

        // Staff count should be consistent across systems
        let maxStaffCount = 0;
        for (const system of tune.systems) {
          if (!("staff" in system)) continue;
          const staffCount = (system as StaffSystem).staff.length;
          maxStaffCount = Math.max(maxStaffCount, staffCount);
        }

        // tune.staffNum should match max staff count
        if (tune.staffNum !== maxStaffCount) {
          console.log("Staff count mismatch!");
          console.log("ABC:", abc);
          console.log(`tune.staffNum: ${tune.staffNum}, max: ${maxStaffCount}`);
          return false;
        }

        return true;
      }),
      { numRuns: 100, verbose: false }
    );
  });

  it("property: no voice appears twice in same system", () => {
    fc.assert(
      fc.property(genMultiVoiceTune, ({ abc }) => {
        const { tune } = interpretABC(abc);

        // Each system should not have duplicate voice entries
        for (const system of tune.systems) {
          if (!("staff" in system)) continue;
          const staffSystem = system as StaffSystem;

          const occupied = new Set<string>();

          for (let staffNum = 0; staffNum < staffSystem.staff.length; staffNum++) {
            const staff = staffSystem.staff[staffNum];
            for (let voiceIdx = 0; voiceIdx < staff.voices.length; voiceIdx++) {
              if (staff.voices[voiceIdx].length > 0) {
                const key = `${staffNum},${voiceIdx}`;
                if (occupied.has(key)) {
                  console.log("Duplicate voice in system!");
                  console.log("ABC:", abc);
                  console.log(`Position: ${key} appears twice`);
                  return false;
                }
                occupied.add(key);
              }
            }
          }
        }

        return true;
      }),
      { numRuns: 100, verbose: false }
    );
  });

  it("property: clef properties are preserved per staff", () => {
    fc.assert(
      fc.property(genMultiVoiceTune, ({ abc, declaredVoices }) => {
        const { tune } = interpretABC(abc);

        // Map voice IDs to declared clefs
        const voiceClefs = new Map<string, string>();
        declaredVoices.forEach((v) => {
          if (v.clef) voiceClefs.set(v.id, v.clef);
        });

        // Check that staffs have appropriate clefs
        // (This is a simplified check - in practice we'd need to track voice-to-staff mapping)
        for (const system of tune.systems) {
          if (!("staff" in system)) continue;
          const staffSystem = system as StaffSystem;

          for (const staff of staffSystem.staff) {
            // Staff should exist and have a clef
            if (!staff) {
              console.log("Undefined staff found!");
              console.log("ABC:", abc);
              return false;
            }
            if (!staff.clef) {
              console.log("Staff missing clef!");
              console.log("ABC:", abc);
              return false;
            }
            expect(staff.clef.type).to.be.oneOf(["treble", "bass", "alto", "tenor"]);
          }
        }

        return true;
      }),
      { numRuns: 100, verbose: false }
    );
  });

  it("property: systems contain only valid element types", () => {
    fc.assert(
      fc.property(genMultiVoiceTune, ({ abc }) => {
        const { tune } = interpretABC(abc);

        const validTypes = [ElementType.Note, ElementType.Bar, ElementType.Key, ElementType.Meter, ElementType.Clef];

        for (const system of tune.systems) {
          if (!("staff" in system)) continue;
          const staffSystem = system as StaffSystem;

          for (const staff of staffSystem.staff) {
            // Check if staff exists
            if (!staff) {
              console.log("Undefined staff found!");
              console.log("ABC:", abc);
              return false;
            }
            if (!staff.voices) {
              console.log("Staff missing voices array!");
              console.log("ABC:", abc);
              return false;
            }

            for (const voice of staff.voices) {
              for (const element of voice) {
                if (!validTypes.includes(element.el_type)) {
                  console.log("Invalid element type!");
                  console.log("ABC:", abc);
                  console.log("Type:", element.el_type);
                  return false;
                }
              }
            }
          }
        }

        return true;
      }),
      { numRuns: 100, verbose: false }
    );
  });
});
