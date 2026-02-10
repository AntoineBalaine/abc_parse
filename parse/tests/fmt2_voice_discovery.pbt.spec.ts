import { expect } from "chai";
import * as fc from "fast-check";
import { ABCContext } from "../parsers/Context";
import { parse } from "../parsers/parse2";
import { Scanner } from "../parsers/scan2";
import { File_structure, Tune, Tune_Body } from "../types/Expr2";
import { discoverVoicesInTuneBody } from "../Visitors/fmt2/fmt_aligner";

function parseFile(input: string, ctx: ABCContext): File_structure {
  const tokens = Scanner(input, ctx);
  return parse(tokens, ctx);
}

function getTuneBody(input: string, ctx: ABCContext): Tune_Body | null {
  const ast = parseFile(input, ctx);
  const tune = ast.contents[0] as Tune;
  return tune.tune_body ?? null;
}

// Generators

/**
 * Generate a voice ID that won't be confused with ABC notation elements.
 * We use the pattern "V" followed by a number to avoid ambiguity.
 */
const genVoiceId = fc.integer({ min: 1, max: 99 }).map((n) => `V${n}`);

describe("discoverVoicesInTuneBody - Property-based tests", () => {
  describe("all voices declared in tune body are discovered", () => {
    it("discovers all unique voice IDs from V: info lines", () => {
      fc.assert(
        fc.property(
          fc.array(genVoiceId, { minLength: 1, maxLength: 5 }),
          (voiceIds) => {
            // Generate a tune with each voice ID as a V: info line
            const uniqueIds = [...new Set(voiceIds)];
            const input = `X:1\nK:C\n${uniqueIds.map((id) => `V:${id}\nCDEF|`).join("\n")}`;

            const ctx = new ABCContext();
            const tuneBody = getTuneBody(input, ctx);
            const discovered: string[] = [];
            discoverVoicesInTuneBody(discovered, tuneBody!);

            // All unique voice IDs should be discovered
            expect(new Set(discovered)).to.deep.equal(new Set(uniqueIds));
          }
        )
      );
    });

    it("discovers all unique voice IDs from [V:] inline fields", () => {
      fc.assert(
        fc.property(
          fc.array(genVoiceId, { minLength: 1, maxLength: 5 }),
          (voiceIds) => {
            const uniqueIds = [...new Set(voiceIds)];
            const input = `X:1\nK:C\n${uniqueIds.map((id) => `[V:${id}]CDEF|`).join("\n")}`;

            const ctx = new ABCContext();
            const tuneBody = getTuneBody(input, ctx);
            const discovered: string[] = [];
            discoverVoicesInTuneBody(discovered, tuneBody!);

            expect(new Set(discovered)).to.deep.equal(new Set(uniqueIds));
          }
        )
      );
    });
  });

  describe("voice ordering is preserved", () => {
    it("returns voices in order of first appearance", () => {
      fc.assert(
        fc.property(
          fc.array(genVoiceId, { minLength: 2, maxLength: 5 }).filter((ids) => new Set(ids).size === ids.length),
          (uniqueVoiceIds) => {
            // Create tune with voices in specific order
            const input = `X:1\nK:C\n${uniqueVoiceIds.map((id) => `V:${id}\nCDEF|`).join("\n")}`;

            const ctx = new ABCContext();
            const tuneBody = getTuneBody(input, ctx);
            const discovered: string[] = [];
            discoverVoicesInTuneBody(discovered, tuneBody!);

            // Order should match input order
            expect(discovered).to.deep.equal(uniqueVoiceIds);
          }
        )
      );
    });
  });

  describe("no duplicates in result", () => {
    it("each voice ID appears exactly once even when declared multiple times", () => {
      fc.assert(
        fc.property(
          genVoiceId,
          fc.integer({ min: 2, max: 5 }),
          (voiceId, repeatCount) => {
            // Create tune with same voice ID repeated
            const lines = Array(repeatCount).fill(`V:${voiceId}\nCDEF|`).join("\n");
            const input = `X:1\nK:C\n${lines}`;

            const ctx = new ABCContext();
            const tuneBody = getTuneBody(input, ctx);
            const discovered: string[] = [];
            discoverVoicesInTuneBody(discovered, tuneBody!);

            // Should have exactly one entry
            expect(discovered).to.deep.equal([voiceId]);
          }
        )
      );
    });
  });

  describe("header voices are preserved at start of list", () => {
    it("header voices remain at their original positions, body voices appended", () => {
      fc.assert(
        fc.property(
          fc.array(genVoiceId, { minLength: 1, maxLength: 3 }).filter((ids) => new Set(ids).size === ids.length),
          fc.array(genVoiceId, { minLength: 1, maxLength: 3 }).filter((ids) => new Set(ids).size === ids.length),
          (headerVoices, bodyVoices) => {
            // Ensure body voices don't overlap with header voices for this test
            const uniqueBodyVoices = bodyVoices.filter((id) => !headerVoices.includes(id));
            if (uniqueBodyVoices.length === 0) return; // Skip if no unique body voices

            // Create tune with body-only voices
            const input = `X:1\nK:C\n${uniqueBodyVoices.map((id) => `V:${id}\nCDEF|`).join("\n")}`;

            const ctx = new ABCContext();
            const tuneBody = getTuneBody(input, ctx);

            // Start with header voices
            const discovered: string[] = [...headerVoices];
            discoverVoicesInTuneBody(discovered, tuneBody!);

            // Header voices should be at the start, in original order
            expect(discovered.slice(0, headerVoices.length)).to.deep.equal(headerVoices);

            // Body voices should be appended
            const appendedVoices = discovered.slice(headerVoices.length);
            expect(new Set(appendedVoices)).to.deep.equal(new Set(uniqueBodyVoices));
          }
        )
      );
    });
  });
});
