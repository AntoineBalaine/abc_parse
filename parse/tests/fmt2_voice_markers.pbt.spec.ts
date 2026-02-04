import { expect } from "chai";
import * as fc from "fast-check";
import { ABCContext } from "../parsers/Context";
import { parse } from "../parsers/parse2";
import { Scanner, TT } from "../parsers/scan2";
import { File_structure, Tune, VoiceMarkerStyle } from "../types/Expr2";
import { AbcFormatter } from "../Visitors/Formatter2";
import { isInfo_line, isInline_field } from "../helpers";

function parseFile(input: string, ctx: ABCContext): File_structure {
  const tokens = Scanner(input, ctx);
  return parse(tokens, ctx);
}

function formatAndReparse(input: string): { original: File_structure; reparsed: File_structure } {
  const ctx = new ABCContext();
  const original = parseFile(input, ctx);
  const formatter = new AbcFormatter(ctx);
  const formatted = formatter.formatFile(original);

  const ctx2 = new ABCContext();
  const reparsed = parseFile(formatted, ctx2);

  return { original, reparsed };
}

/**
 * Extract voice IDs from a tune body.
 */
function extractVoiceIds(tune: Tune): Set<string> {
  const ids = new Set<string>();

  if (!tune.tune_body) return ids;

  for (const system of tune.tune_body.sequence) {
    for (const element of system) {
      if (isInfo_line(element) && element.key.lexeme === "V:") {
        const firstValue = element.value.find((t) => t.type !== TT.WS);
        if (firstValue) {
          ids.add(firstValue.lexeme.trim());
        }
      } else if (isInline_field(element) && element.field.lexeme === "V:") {
        // The text array starts with the field key (e.g., "V:"), so we skip it and whitespace
        const firstText = element.text.find((t) => t.type !== TT.WS && t.lexeme !== "V:");
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
  { minLength: 1, maxLength: 3 }
).map((chars) => chars.join(""));

/**
 * Generate a simple note sequence.
 */
const genNotes = fc.array(
  fc.constantFrom("C", "D", "E", "F", "G", "A", "B"),
  { minLength: 1, maxLength: 4 }
).map((notes) => notes.join("") + "|");

/**
 * Generate a voice marker style directive.
 */
const genVoiceMarkerStyle = fc.constantFrom<VoiceMarkerStyle>("inline", "infoline");

/**
 * Generate a tune with infoline voice markers and a voice-markers directive.
 */
const genTuneWithInfolineVoicesAndDirective = fc.tuple(
  genVoiceId,
  genNotes,
  genVoiceMarkerStyle
).map(([voiceId, notes, style]) => {
  return `X:1
%%abcls-fmt voice-markers=${style}
V:${voiceId}
K:C
V:${voiceId}
${notes}
`;
});

/**
 * Generate a tune with inline voice markers and a voice-markers directive.
 */
const genTuneWithInlineVoicesAndDirective = fc.tuple(
  genVoiceId,
  genNotes,
  genVoiceMarkerStyle
).map(([voiceId, notes, style]) => {
  return `X:1
%%abcls-fmt voice-markers=${style}
V:${voiceId}
K:C
[V:${voiceId}] ${notes}
`;
});

describe("Formatter voice-markers - Property-Based Tests", () => {
  describe("Idempotence", () => {
    it("formatting a tune twice produces the same result (infoline source)", () => {
      fc.assert(
        fc.property(genTuneWithInfolineVoicesAndDirective, (abc) => {
          const ctx1 = new ABCContext();
          const ast1 = parseFile(abc, ctx1);
          const formatter1 = new AbcFormatter(ctx1);
          const formatted1 = formatter1.formatFile(ast1);

          const ctx2 = new ABCContext();
          const ast2 = parseFile(formatted1, ctx2);
          const formatter2 = new AbcFormatter(ctx2);
          const formatted2 = formatter2.formatFile(ast2);

          return formatted1 === formatted2;
        }),
        { numRuns: 50 }
      );
    });

    it("formatting a tune twice produces the same result (inline source)", () => {
      fc.assert(
        fc.property(genTuneWithInlineVoicesAndDirective, (abc) => {
          const ctx1 = new ABCContext();
          const ast1 = parseFile(abc, ctx1);
          const formatter1 = new AbcFormatter(ctx1);
          const formatted1 = formatter1.formatFile(ast1);

          const ctx2 = new ABCContext();
          const ast2 = parseFile(formatted1, ctx2);
          const formatter2 = new AbcFormatter(ctx2);
          const formatted2 = formatter2.formatFile(ast2);

          return formatted1 === formatted2;
        }),
        { numRuns: 50 }
      );
    });
  });

  describe("Voice ID preservation", () => {
    it("voice IDs are preserved through format roundtrip (infoline source)", () => {
      fc.assert(
        fc.property(genTuneWithInfolineVoicesAndDirective, (abc) => {
          const { original, reparsed } = formatAndReparse(abc);

          if (original.contents.length === 0) return true;
          if (reparsed.contents.length === 0) return true;

          const originalTune = original.contents[0] as Tune;
          const reparsedTune = reparsed.contents[0] as Tune;

          const originalIds = extractVoiceIds(originalTune);
          const reparsedIds = extractVoiceIds(reparsedTune);

          // All original IDs should be present after formatting
          for (const id of originalIds) {
            if (!reparsedIds.has(id)) return false;
          }

          return true;
        }),
        { numRuns: 50 }
      );
    });

    it("voice IDs are preserved through format roundtrip (inline source)", () => {
      fc.assert(
        fc.property(genTuneWithInlineVoicesAndDirective, (abc) => {
          const { original, reparsed } = formatAndReparse(abc);

          if (original.contents.length === 0) return true;
          if (reparsed.contents.length === 0) return true;

          const originalTune = original.contents[0] as Tune;
          const reparsedTune = reparsed.contents[0] as Tune;

          const originalIds = extractVoiceIds(originalTune);
          const reparsedIds = extractVoiceIds(reparsedTune);

          // All original IDs should be present after formatting
          for (const id of originalIds) {
            if (!reparsedIds.has(id)) return false;
          }

          return true;
        }),
        { numRuns: 50 }
      );
    });
  });

  describe("Target style consistency", () => {
    it("when voice-markers=inline, output contains no V: info lines in tune body", () => {
      fc.assert(
        fc.property(
          fc.tuple(genVoiceId, genNotes).map(([voiceId, notes]) => {
            return `X:1
%%abcls-fmt voice-markers=inline
V:${voiceId}
K:C
V:${voiceId}
${notes}
`;
          }),
          (abc) => {
            const ctx = new ABCContext();
            const ast = parseFile(abc, ctx);
            const formatter = new AbcFormatter(ctx);
            const formatted = formatter.formatFile(ast);

            // Reparse and check that there are no V: info lines in tune body
            const ctx2 = new ABCContext();
            const reparsed = parseFile(formatted, ctx2);

            if (reparsed.contents.length === 0) return true;

            const tune = reparsed.contents[0] as Tune;
            if (!tune.tune_body) return true;

            for (const system of tune.tune_body.sequence) {
              for (const element of system) {
                if (isInfo_line(element) && element.key.lexeme === "V:") {
                  return false; // Found a V: info line in tune body - should have been inline
                }
              }
            }

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it("when voice-markers=infoline, output contains no [V:] inline fields", () => {
      fc.assert(
        fc.property(
          fc.tuple(genVoiceId, genNotes).map(([voiceId, notes]) => {
            return `X:1
%%abcls-fmt voice-markers=infoline
V:${voiceId}
K:C
[V:${voiceId}] ${notes}
`;
          }),
          (abc) => {
            const ctx = new ABCContext();
            const ast = parseFile(abc, ctx);
            const formatter = new AbcFormatter(ctx);
            const formatted = formatter.formatFile(ast);

            // Reparse and check that there are no [V:] inline fields
            const ctx2 = new ABCContext();
            const reparsed = parseFile(formatted, ctx2);

            if (reparsed.contents.length === 0) return true;

            const tune = reparsed.contents[0] as Tune;
            if (!tune.tune_body) return true;

            for (const system of tune.tune_body.sequence) {
              for (const element of system) {
                if (isInline_field(element) && element.field.lexeme === "V:") {
                  return false; // Found a [V:] inline field - should have been infoline
                }
              }
            }

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
