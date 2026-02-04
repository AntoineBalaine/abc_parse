import { expect } from "chai";
import * as fc from "fast-check";
import { ABCContext } from "../parsers/Context";
import { Scanner, TT } from "../parsers/scan2";
import { parse } from "../parsers/parse2";
import { Tune, Tune_Body, Info_line, Inline_field } from "../types/Expr2";
import { AbcFormatter } from "./Formatter2";
import { VoiceMarkerStyleVisitor } from "./VoiceMarkerStyleVisitor";
import { isInfo_line, isInline_field } from "../helpers";

/**
 * Helper to parse ABC input and extract the tune body.
 */
function parseTuneBody(input: string): { tuneBody: Tune_Body; ctx: ABCContext } | null {
  try {
    const ctx = new ABCContext();
    const tokens = Scanner(input, ctx);
    const ast = parse(tokens, ctx);
    if (ast.contents.length === 0) return null;
    const tune = ast.contents[0] as Tune;
    if (!tune.tune_body) return null;
    return { tuneBody: tune.tune_body, ctx };
  } catch {
    return null;
  }
}

/**
 * Count voice markers in a tune body (both Info_line V: and Inline_field V:).
 */
function countVoiceMarkers(tuneBody: Tune_Body): number {
  let count = 0;
  for (const system of tuneBody.sequence) {
    for (const element of system) {
      if (isInfo_line(element) && element.key.lexeme === "V:") {
        count++;
      } else if (isInline_field(element) && element.field.lexeme === "V:") {
        count++;
      }
    }
  }
  return count;
}

/**
 * Extract voice IDs from a tune body.
 */
function extractVoiceIds(tuneBody: Tune_Body): Set<string> {
  const ids = new Set<string>();
  for (const system of tuneBody.sequence) {
    for (const element of system) {
      if (isInfo_line(element) && element.key.lexeme === "V:") {
        // Extract the first non-WS token after V: as the ID
        const firstValue = element.value.find((t) => t.type !== TT.WS);
        if (firstValue) {
          ids.add(firstValue.lexeme.trim());
        }
      } else if (isInline_field(element) && element.field.lexeme === "V:") {
        const firstText = element.text.find((t) => t.type !== TT.WS);
        if (firstText) {
          ids.add(firstText.lexeme.trim());
        }
      }
    }
  }
  return ids;
}

// Generators

/**
 * Generate a voice ID (simple alphanumeric).
 */
const genVoiceId = fc.array(
  fc.constantFrom(..."123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".split("")),
  { minLength: 1, maxLength: 5 }
).map((chars) => chars.join(""));

/**
 * Generate a simple note sequence.
 */
const genNotes = fc.array(
  fc.constantFrom("C", "D", "E", "F", "G", "A", "B"),
  { minLength: 1, maxLength: 8 }
).map((notes) => notes.join("") + "|");

/**
 * Generate a tune with infoline voice markers.
 */
const genTuneWithInfolineVoices = fc.tuple(
  fc.array(genVoiceId, { minLength: 1, maxLength: 3 }),
  fc.array(genNotes, { minLength: 1, maxLength: 4 })
).map(([voiceIds, notesList]) => {
  const uniqueVoices = [...new Set(voiceIds)];
  const voiceDecls = uniqueVoices.map((v: string) => `V:${v}`).join("\n");

  // Create body with voice markers
  const bodyLines: string[] = [];
  for (let i = 0; i < notesList.length; i++) {
    const voiceId = uniqueVoices[i % uniqueVoices.length];
    bodyLines.push(`V:${voiceId}`);
    bodyLines.push(notesList[i]);
  }

  return `X:1\n${voiceDecls}\nK:C\n${bodyLines.join("\n")}\n`;
});

/**
 * Generate a tune with inline voice markers.
 */
const genTuneWithInlineVoices = fc.tuple(
  fc.array(genVoiceId, { minLength: 1, maxLength: 3 }),
  fc.array(genNotes, { minLength: 1, maxLength: 4 })
).map(([voiceIds, notesList]) => {
  const uniqueVoices = [...new Set(voiceIds)];
  const voiceDecls = uniqueVoices.map((v: string) => `V:${v}`).join("\n");

  // Create body with inline voice markers
  const bodyLines: string[] = [];
  for (let i = 0; i < notesList.length; i++) {
    const voiceId = uniqueVoices[i % uniqueVoices.length];
    bodyLines.push(`[V:${voiceId}] ${notesList[i]}`);
  }

  return `X:1\n${voiceDecls}\nK:C\n${bodyLines.join("\n")}\n`;
});

describe("VoiceMarkerStyleVisitor - Property-Based Tests", () => {
  describe("Voice count preservation", () => {
    it("converting infoline to inline preserves voice marker count", () => {
      fc.assert(
        fc.property(genTuneWithInfolineVoices, (abc) => {
          const parsed = parseTuneBody(abc);
          if (!parsed) return true; // Skip unparseable inputs

          const { tuneBody, ctx } = parsed;
          const originalCount = countVoiceMarkers(tuneBody);

          const visitor = new VoiceMarkerStyleVisitor(ctx, "inline");
          const transformed = visitor.transformTuneBody(tuneBody);
          const transformedCount = countVoiceMarkers(transformed);

          return originalCount === transformedCount;
        }),
        { numRuns: 50 }
      );
    });

    it("converting inline to infoline preserves voice marker count", () => {
      fc.assert(
        fc.property(genTuneWithInlineVoices, (abc) => {
          const parsed = parseTuneBody(abc);
          if (!parsed) return true; // Skip unparseable inputs

          const { tuneBody, ctx } = parsed;
          const originalCount = countVoiceMarkers(tuneBody);

          const visitor = new VoiceMarkerStyleVisitor(ctx, "infoline");
          const transformed = visitor.transformTuneBody(tuneBody);
          const transformedCount = countVoiceMarkers(transformed);

          return originalCount === transformedCount;
        }),
        { numRuns: 50 }
      );
    });
  });

  describe("Voice ID preservation", () => {
    it("converting infoline to inline preserves voice IDs", () => {
      fc.assert(
        fc.property(genTuneWithInfolineVoices, (abc) => {
          const parsed = parseTuneBody(abc);
          if (!parsed) return true;

          const { tuneBody, ctx } = parsed;
          const originalIds = extractVoiceIds(tuneBody);

          const visitor = new VoiceMarkerStyleVisitor(ctx, "inline");
          const transformed = visitor.transformTuneBody(tuneBody);
          const transformedIds = extractVoiceIds(transformed);

          // Check that all original IDs are still present
          for (const id of originalIds) {
            if (!transformedIds.has(id)) return false;
          }
          return true;
        }),
        { numRuns: 50 }
      );
    });

    it("converting inline to infoline preserves voice IDs", () => {
      fc.assert(
        fc.property(genTuneWithInlineVoices, (abc) => {
          const parsed = parseTuneBody(abc);
          if (!parsed) return true;

          const { tuneBody, ctx } = parsed;
          const originalIds = extractVoiceIds(tuneBody);

          const visitor = new VoiceMarkerStyleVisitor(ctx, "infoline");
          const transformed = visitor.transformTuneBody(tuneBody);
          const transformedIds = extractVoiceIds(transformed);

          // Check that all original IDs are still present
          for (const id of originalIds) {
            if (!transformedIds.has(id)) return false;
          }
          return true;
        }),
        { numRuns: 50 }
      );
    });
  });

  describe("Roundtrip conservation", () => {
    it("infoline -> inline -> infoline preserves voice IDs", () => {
      fc.assert(
        fc.property(genTuneWithInfolineVoices, (abc) => {
          const parsed = parseTuneBody(abc);
          if (!parsed) return true;

          const { tuneBody, ctx } = parsed;
          const originalIds = extractVoiceIds(tuneBody);

          // Convert to inline
          const toInline = new VoiceMarkerStyleVisitor(ctx, "inline");
          const inlined = toInline.transformTuneBody(tuneBody);

          // Convert back to infoline
          const toInfoline = new VoiceMarkerStyleVisitor(ctx, "infoline");
          const backToInfoline = toInfoline.transformTuneBody(inlined);

          const finalIds = extractVoiceIds(backToInfoline);

          // Check that all original IDs are still present
          for (const id of originalIds) {
            if (!finalIds.has(id)) return false;
          }
          return true;
        }),
        { numRuns: 50 }
      );
    });

    it("inline -> infoline -> inline preserves voice IDs", () => {
      fc.assert(
        fc.property(genTuneWithInlineVoices, (abc) => {
          const parsed = parseTuneBody(abc);
          if (!parsed) return true;

          const { tuneBody, ctx } = parsed;
          const originalIds = extractVoiceIds(tuneBody);

          // Convert to infoline
          const toInfoline = new VoiceMarkerStyleVisitor(ctx, "infoline");
          const infolined = toInfoline.transformTuneBody(tuneBody);

          // Convert back to inline
          const toInline = new VoiceMarkerStyleVisitor(ctx, "inline");
          const backToInline = toInline.transformTuneBody(infolined);

          const finalIds = extractVoiceIds(backToInline);

          // Check that all original IDs are still present
          for (const id of originalIds) {
            if (!finalIds.has(id)) return false;
          }
          return true;
        }),
        { numRuns: 50 }
      );
    });
  });

  describe("Transformation result type", () => {
    it("infoline -> inline produces only inline voice markers", () => {
      fc.assert(
        fc.property(genTuneWithInfolineVoices, (abc) => {
          const parsed = parseTuneBody(abc);
          if (!parsed) return true;

          const { tuneBody, ctx } = parsed;
          const visitor = new VoiceMarkerStyleVisitor(ctx, "inline");
          const transformed = visitor.transformTuneBody(tuneBody);

          // Check that there are no V: info lines, only V: inline fields
          for (const system of transformed.sequence) {
            for (const element of system) {
              if (isInfo_line(element) && element.key.lexeme === "V:") {
                return false; // Found an info line V: marker - should be inline
              }
            }
          }
          return true;
        }),
        { numRuns: 50 }
      );
    });

    it("inline -> infoline produces only infoline voice markers", () => {
      fc.assert(
        fc.property(genTuneWithInlineVoices, (abc) => {
          const parsed = parseTuneBody(abc);
          if (!parsed) return true;

          const { tuneBody, ctx } = parsed;
          const visitor = new VoiceMarkerStyleVisitor(ctx, "infoline");
          const transformed = visitor.transformTuneBody(tuneBody);

          // Check that there are no V: inline fields, only V: info lines
          for (const system of transformed.sequence) {
            for (const element of system) {
              if (isInline_field(element) && element.field.lexeme === "V:") {
                return false; // Found an inline V: marker - should be infoline
              }
            }
          }
          return true;
        }),
        { numRuns: 50 }
      );
    });
  });
});
