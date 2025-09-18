import { assert } from "chai";
import { describe, it } from "mocha";
import * as fc from "fast-check";
import { ABCContext } from "../parsers/Context";
import { Ctx, TT, Token } from "../parsers/scan2";
import { sharedContext, genCommentToken, genVxDefinition, genVxId, genVxPropKey, genVxPropVal } from "./scn_pbt.generators.spec";
import { scanVoiceInfo } from "../parsers/infoLines/scanVxInfo";

// Helper function to create a Ctx object for testing
function createCtx(source: string): Ctx {
  const abcContext = new ABCContext();
  return new Ctx(source, abcContext);
}

describe("scnvx", () => {
  describe("Basic Voice ID Parsing", () => {
    it("should parse a simple numeric voice ID", () => {
      const ctx = createCtx("1");
      const result = scanVoiceInfo(ctx);
      assert.isTrue(result);
      assert.equal(ctx.tokens[0].type, TT.VX_ID);
      assert.equal(ctx.tokens[0].lexeme, "1");
    });

    it("should parse an alphabetic voice ID", () => {
      const ctx = createCtx("melody");
      const result = scanVoiceInfo(ctx);
      assert.isTrue(result);

      assert.equal(ctx.tokens[0].type, TT.VX_ID);
      assert.equal(ctx.tokens[0].lexeme, "melody");
    });

    it("should parse a mixed alphanumeric voice ID", () => {
      const ctx = createCtx("voice1");
      const result = scanVoiceInfo(ctx);
      assert.isTrue(result);

      assert.equal(ctx.tokens[0].type, TT.VX_ID);
      assert.equal(ctx.tokens[0].lexeme, "voice1");
    });

    it("should parse uppercase voice ID", () => {
      const ctx = createCtx("SOPRANO");
      const result = scanVoiceInfo(ctx);
      assert.isTrue(result);

      assert.equal(ctx.tokens[0].type, TT.VX_ID);
      assert.equal(ctx.tokens[0].lexeme, "SOPRANO");
    });
  });

  describe("Single Property Parsing", () => {
    it("should parse voice ID with name property", () => {
      const ctx = createCtx("1 name=Melody");
      const result = scanVoiceInfo(ctx);
      assert.isTrue(result);

      assert.equal(ctx.tokens[0].type, TT.VX_ID);
      assert.equal(ctx.tokens[0].lexeme, "1");
      assert.equal(ctx.tokens[1].type, TT.VX_K);
      assert.equal(ctx.tokens[1].lexeme, "name");
      assert.equal(ctx.tokens[3].type, TT.VX_V);
      assert.equal(ctx.tokens[3].lexeme, "Melody");
    });

    it("should parse voice ID with clef property", () => {
      const ctx = createCtx("bass clef=bass");
      const result = scanVoiceInfo(ctx);
      assert.isTrue(result);

      assert.equal(ctx.tokens[0].type, TT.VX_ID);
      assert.equal(ctx.tokens[0].lexeme, "bass");
      assert.equal(ctx.tokens[1].type, TT.VX_K);
      assert.equal(ctx.tokens[1].lexeme, "clef");
      assert.equal(ctx.tokens[3].type, TT.VX_V);
      assert.equal(ctx.tokens[3].lexeme, "bass");
    });

    it("should parse voice ID with transpose property", () => {
      const ctx = createCtx("1 transpose=2");
      const result = scanVoiceInfo(ctx);
      assert.isTrue(result);

      assert.equal(ctx.tokens[0].type, TT.VX_ID);
      assert.equal(ctx.tokens[0].lexeme, "1");
      assert.equal(ctx.tokens[1].type, TT.VX_K);
      assert.equal(ctx.tokens[1].lexeme, "transpose");
      assert.equal(ctx.tokens[3].type, TT.VX_V);
      assert.equal(ctx.tokens[3].lexeme, "2");
    });

    it("should parse voice ID with octave property", () => {
      const ctx = createCtx("1 octave=-1");
      const result = scanVoiceInfo(ctx);
      assert.isTrue(result);

      assert.equal(ctx.tokens[0].type, TT.VX_ID);
      assert.equal(ctx.tokens[0].lexeme, "1");
      assert.equal(ctx.tokens[1].type, TT.VX_K);
      assert.equal(ctx.tokens[1].lexeme, "octave");
      assert.equal(ctx.tokens[3].type, TT.VX_V);
      assert.equal(ctx.tokens[3].lexeme, "-1");
    });
  });

  describe("Multiple Properties Parsing", () => {
    it("should parse voice ID with multiple properties", () => {
      const ctx = createCtx("1 name=Melody clef=treble transpose=2");
      const result = scanVoiceInfo(ctx);
      assert.isTrue(result);

      assert.equal(ctx.tokens[0].type, TT.VX_ID);
      assert.equal(ctx.tokens[0].lexeme, "1");
      assert.equal(ctx.tokens[1].type, TT.VX_K);
      assert.equal(ctx.tokens[1].lexeme, "name");
      assert.equal(ctx.tokens[3].type, TT.VX_V);
      assert.equal(ctx.tokens[3].lexeme, "Melody");
      assert.equal(ctx.tokens[4].type, TT.VX_K);
      assert.equal(ctx.tokens[4].lexeme, "clef");
      assert.equal(ctx.tokens[6].type, TT.VX_V);
      assert.equal(ctx.tokens[6].lexeme, "treble");
      assert.equal(ctx.tokens[7].type, TT.VX_K);
      assert.equal(ctx.tokens[7].lexeme, "transpose");
      assert.equal(ctx.tokens[9].type, TT.VX_V);
      assert.equal(ctx.tokens[9].lexeme, "2");
    });

    it("should parse voice ID with all common properties", () => {
      const ctx = createCtx("melody name=Melody clef=treble transpose=2 octave=1 stafflines=5");
      const result = scanVoiceInfo(ctx);
      assert.isTrue(result);

      assert.equal(ctx.tokens[0].type, TT.VX_ID);
      assert.equal(ctx.tokens[0].lexeme, "melody");

      // Check that we have alternating key-value pairs
      for (let i = 1; i < ctx.tokens.length; i += 3) {
        assert.equal(ctx.tokens[i].type, TT.VX_K);
        if (i + 1 < ctx.tokens.length) {
          assert.equal(ctx.tokens[i + 2].type, TT.VX_V);
        }
      }
    });
  });

  describe("String Literal Values", () => {
    it("should parse quoted string values", () => {
      const ctx = createCtx('1 name="My Voice"');
      const result = scanVoiceInfo(ctx);

      assert.equal(ctx.tokens[0].type, TT.VX_ID);
      assert.equal(ctx.tokens[0].lexeme, "1");
      assert.equal(ctx.tokens[1].type, TT.VX_K);
      assert.equal(ctx.tokens[1].lexeme, "name");
      assert.equal(ctx.tokens[3].type, TT.VX_V);
      assert.equal(ctx.tokens[3].lexeme, '"My Voice"');
    });

    it("should parse quoted string with spaces", () => {
      const ctx = createCtx('soprano name="Soprano Voice Part"');
      const result = scanVoiceInfo(ctx);

      assert.equal(ctx.tokens[0].type, TT.VX_ID);
      assert.equal(ctx.tokens[0].lexeme, "soprano");
      assert.equal(ctx.tokens[1].type, TT.VX_K);
      assert.equal(ctx.tokens[1].lexeme, "name");
      assert.equal(ctx.tokens[3].type, TT.VX_V);
      assert.equal(ctx.tokens[3].lexeme, '"Soprano Voice Part"');
    });
  });

  describe("Special Value: perc", () => {
    it("should parse perc as a standalone value (omitted style key)", () => {
      const ctx = createCtx("1 perc");
      const result = scanVoiceInfo(ctx);

      // Based on user clarification, perc should be treated as a value where style key is omitted
      // The exact behavior may depend on implementation details
      assert.isTrue(ctx.tokens.length >= 2);
      assert.equal(ctx.tokens[0].type, TT.VX_ID);
      assert.equal(ctx.tokens[0].lexeme, "1");

      // The perc should appear as a value token
      const percToken = ctx.tokens.find((t) => t.lexeme === "perc");
      assert.isDefined(percToken);
    });

    it("should parse perc with other properties", () => {
      const ctx = createCtx("drums perc name=Drums");
      const result = scanVoiceInfo(ctx);

      assert.isTrue(ctx.tokens.length >= 4);
      assert.equal(ctx.tokens[0].type, TT.VX_ID);
      assert.equal(ctx.tokens[0].lexeme, "drums");

      // Should contain perc and name tokens
      const percToken = ctx.tokens.find((t) => t.lexeme === "perc");
      const nameKey = ctx.tokens.find((t) => t.lexeme === "name" && t.type === TT.VX_K);
      const nameValue = ctx.tokens.find((t) => t.lexeme === "Drums" && t.type === TT.VX_V);

      assert.isDefined(percToken);
      assert.isDefined(nameKey);
      assert.isDefined(nameValue);
    });
  });

  describe("Whitespace Handling", () => {
    it("should handle spaces around equals signs", () => {
      const ctx = createCtx("1 name = Melody");
      const result = scanVoiceInfo(ctx);

      assert.equal(ctx.tokens[0].type, TT.VX_ID);
      assert.equal(ctx.tokens[0].lexeme, "1");
      assert.equal(ctx.tokens[1].type, TT.VX_K);
      assert.equal(ctx.tokens[1].lexeme, "name");
      assert.equal(ctx.tokens[3].type, TT.VX_V);
      assert.equal(ctx.tokens[3].lexeme, "Melody");
    });

    it("should handle multiple spaces between properties", () => {
      const ctx = createCtx("1   name=Melody    clef=treble");
      const result = scanVoiceInfo(ctx);

      assert.equal(ctx.tokens[0].type, TT.VX_ID);
      assert.equal(ctx.tokens[0].lexeme, "1");
      assert.equal(ctx.tokens[1].type, TT.VX_K);
      assert.equal(ctx.tokens[1].lexeme, "name");
      assert.equal(ctx.tokens[3].type, TT.VX_V);
      assert.equal(ctx.tokens[3].lexeme, "Melody");
      assert.equal(ctx.tokens[4].type, TT.VX_K);
      assert.equal(ctx.tokens[4].lexeme, "clef");
      assert.equal(ctx.tokens[6].type, TT.VX_V);
      assert.equal(ctx.tokens[6].lexeme, "treble");
    });

    it("should handle leading whitespace", () => {
      const ctx = createCtx("  1 name=Melody");
      const result = scanVoiceInfo(ctx);

      assert.equal(ctx.tokens[0].type, TT.VX_ID);
      assert.equal(ctx.tokens[0].lexeme, "1");
      assert.equal(ctx.tokens[1].type, TT.VX_K);
      assert.equal(ctx.tokens[1].lexeme, "name");
      assert.equal(ctx.tokens[3].type, TT.VX_V);
      assert.equal(ctx.tokens[3].lexeme, "Melody");
    });
  });

  describe("Property Key Variations", () => {
    it("should parse all standard property keys", () => {
      const properties = [
        "name",
        "clef",
        "transpose",
        "octave",
        "middle",
        "m",
        "stafflines",
        "staffscale",
        "instrument",
        "merge",
        "stems",
        "stem",
        "gchord",
        "space",
        "spc",
        "bracket",
        "brk",
        "brace",
        "brc",
      ];

      properties.forEach((prop) => {
        const ctx = createCtx(`1 ${prop}=value`);
        const result = scanVoiceInfo(ctx);

        assert.equal(ctx.tokens[0].type, TT.VX_ID);
        assert.equal(ctx.tokens[1].type, TT.VX_K);
        assert.equal(ctx.tokens[1].lexeme, prop);
        assert.equal(ctx.tokens[3].type, TT.VX_V);
        assert.equal(ctx.tokens[3].lexeme, "value");
      });
    });

    it("should handle case-sensitive property keys", () => {
      const ctx = createCtx("1 Name=Melody");
      const result = scanVoiceInfo(ctx);

      assert.equal(ctx.tokens[1].type, TT.VX_K);
      assert.equal(ctx.tokens[1].lexeme, "Name"); // Should preserve case
    });
  });

  describe("Numeric Values", () => {
    it("should parse positive integer values", () => {
      const ctx = createCtx("1 transpose=5");
      const result = scanVoiceInfo(ctx);

      assert.equal(ctx.tokens[3].type, TT.VX_V);
      assert.equal(ctx.tokens[3].lexeme, "5");
    });

    it("should parse negative integer values", () => {
      const ctx = createCtx("1 octave=-2");
      const result = scanVoiceInfo(ctx);

      assert.equal(ctx.tokens[3].type, TT.VX_V);
      assert.equal(ctx.tokens[3].lexeme, "-2");
    });

    it("should parse decimal values", () => {
      const ctx = createCtx("1 staffscale=1.5");
      const result = scanVoiceInfo(ctx);

      assert.equal(ctx.tokens[3].type, TT.VX_V);
      assert.equal(ctx.tokens[3].lexeme, "1.5");
    });
  });

  describe("Boolean-like Values", () => {
    it("should parse true/false values", () => {
      const ctx = createCtx("1 merge=true");
      const result = scanVoiceInfo(ctx);

      assert.equal(ctx.tokens[3].type, TT.VX_V);
      assert.equal(ctx.tokens[3].lexeme, "true");
    });

    it("should parse 1/0 values", () => {
      const ctx = createCtx("1 merge=1");
      const result = scanVoiceInfo(ctx);

      assert.equal(ctx.tokens[3].type, TT.VX_V);
      assert.equal(ctx.tokens[3].lexeme, "1");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty input", () => {
      const ctx = createCtx("");
      scanVoiceInfo(ctx);
    });

    it("should handle whitespace-only input", () => {
      const ctx = createCtx("   ");
      scanVoiceInfo(ctx);
    });

    it("should handle voice ID only", () => {
      const ctx = createCtx("melody");
      const result = scanVoiceInfo(ctx);

      assert.equal(ctx.tokens[0].type, TT.VX_ID);
      assert.equal(ctx.tokens[0].lexeme, "melody");
    });
  });

  describe("Complex Real-world Examples", () => {
    it("should parse a typical melody voice definition", () => {
      const ctx = createCtx('1 name="Melody" clef=treble transpose=0 octave=0');
      const result = scanVoiceInfo(ctx);

      assert.equal(ctx.tokens[0].lexeme, "1");
      assert.equal(ctx.tokens[1].lexeme, "name");
      assert.equal(ctx.tokens[3].lexeme, '"Melody"');
      assert.equal(ctx.tokens[4].lexeme, "clef");
      assert.equal(ctx.tokens[6].lexeme, "treble");
      assert.equal(ctx.tokens[7].lexeme, "transpose");
      assert.equal(ctx.tokens[9].lexeme, "0");
      assert.equal(ctx.tokens[10].lexeme, "octave");
      assert.equal(ctx.tokens[12].lexeme, "0");
    });

    it("should parse a bass voice definition", () => {
      const ctx = createCtx('bass name="Bass Line" clef=bass octave=-1 stems=down');
      const result = scanVoiceInfo(ctx);

      assert.equal(ctx.tokens[0].lexeme, "bass");
      assert.equal(ctx.tokens[1].lexeme, "name");
      assert.equal(ctx.tokens[3].lexeme, '"Bass Line"');
      assert.equal(ctx.tokens[4].lexeme, "clef");
      assert.equal(ctx.tokens[6].lexeme, "bass");
      assert.equal(ctx.tokens[7].lexeme, "octave");
      assert.equal(ctx.tokens[9].lexeme, "-1");
      assert.equal(ctx.tokens[10].lexeme, "stems");
      assert.equal(ctx.tokens[12].lexeme, "down");
    });

    it("should parse a percussion voice definition", () => {
      const ctx = createCtx('drums perc name="Drum Kit" stafflines=1');
      const result = scanVoiceInfo(ctx);

      assert.isTrue(ctx.tokens.length >= 5);
      assert.equal(ctx.tokens[0].lexeme, "drums");

      // Should contain perc, name, and stafflines
      const hasPerc = ctx.tokens.some((t) => t.lexeme === "perc");
      const hasName = ctx.tokens.some((t) => t.lexeme === "name");
      const hasStafflines = ctx.tokens.some((t) => t.lexeme === "stafflines");

      assert.isTrue(hasPerc);
      assert.isTrue(hasName);
      assert.isTrue(hasStafflines);
    });
  });
});

describe("scnvx Property-Based Tests", () => {
  function createRoundTripPredicate(tokens: Token[]): boolean {
    // Convert tokens to string
    const input = tokens.map((t) => t.lexeme).join("");

    // Skip empty inputs
    if (input.trim() === "") return true;

    // Scan the input
    const ctx = createCtx(input);
    const result = scanVoiceInfo(ctx);

    // Filter out whitespace tokens from both original and scanned
    const originalFiltered = tokens.filter((t) => t.type !== TT.WS && t.type !== TT.DISCARD);
    const scannedFiltered = ctx.tokens.filter((t) => t.type !== TT.WS && t.type !== TT.DISCARD);

    // Compare token counts
    if (originalFiltered.length !== scannedFiltered.length) {
      console.log("Token count mismatch:", {
        input,
        originalCount: originalFiltered.length,
        scannedCount: scannedFiltered.length,
        original: originalFiltered.map((t) => `${TT[t.type]}:${t.lexeme}`),
        scanned: scannedFiltered.map((t) => `${TT[t.type]}:${t.lexeme}`),
      });
      return false;
    }

    // Compare token types and lexemes
    for (let i = 0; i < originalFiltered.length; i++) {
      const orig = originalFiltered[i];
      const scanned = scannedFiltered[i];

      if (orig.type !== scanned.type || orig.lexeme !== scanned.lexeme) {
        console.log("Token mismatch at position", i, {
          input,
          original: `${TT[orig.type]}:${orig.lexeme}`,
          scanned: `${TT[scanned.type]}:${scanned.lexeme}`,
        });
        return false;
      }
    }

    return true;
  }

  it("should produce equivalent tokens when rescanning voice definitions", () => {
    fc.assert(fc.property(genVxDefinition, createRoundTripPredicate), {
      verbose: false,
      numRuns: 1000,
    });
  });

  it("should always start with a VX_ID token for valid voice definitions", () => {
    fc.assert(
      fc.property(genVxDefinition, (tokens) => {
        const input = tokens.map((t) => t.lexeme).join("");
        if (input.trim() === "") return true;

        const ctx = createCtx(input);
        const result = scanVoiceInfo(ctx);

        return ctx.tokens.length === 0 || ctx.tokens[0].type === TT.VX_ID;
      }),
      {
        verbose: false,
        numRuns: 1000,
      }
    );
  });

  it("should maintain alternating key-value pattern for properties", () => {
    fc.assert(
      fc.property(genVxDefinition, (tokens) => {
        const input = tokens.map((t) => t.lexeme).join("");
        if (input.trim() === "") return true;

        const ctx = createCtx(input);
        const result = scanVoiceInfo(ctx);

        if (ctx.tokens.length === 0) return true;

        // Skip the voice ID (first token)
        let expectingKey = true;
        for (let i = 1; i < ctx.tokens.length; i++) {
          const token = ctx.tokens[i];

          if (token.type === TT.VX_K) {
            if (!expectingKey) {
              console.log("Expected value but got key:", token.lexeme, "at position", i);
              return false;
            }
            expectingKey = false;
          } else if (token.type === TT.VX_V) {
            // Special case: standalone "perc" can appear without a key
            if (token.lexeme === "perc") {
              expectingKey = true;
            } else if (expectingKey) {
              console.log("Expected key but got value:", token.lexeme, "at position", i);
              return false;
            } else {
              expectingKey = true;
            }
          }
        }

        return true;
      }),
      {
        verbose: false,
        numRuns: 1000,
      }
    );
  });

  it("should handle whitespace variations correctly", () => {
    const genWhitespaceVariations = fc.tuple(genVxId, fc.tuple(genVxPropKey, genVxPropVal)).map(([voiceId, [key, value]]) => {
      // Generate different whitespace patterns
      return fc.sample(
        fc.oneof(
          // Normal spacing
          fc.constant([voiceId, new Token(TT.WS, " ", sharedContext.generateId()), key, new Token(TT.EQL, "=", sharedContext.generateId()), value]),
          // Extra spaces
          fc.constant([voiceId, new Token(TT.WS, "   ", sharedContext.generateId()), key, new Token(TT.EQL, " = ", sharedContext.generateId()), value]),
          // Leading whitespace
          fc.constant([
            new Token(TT.WS, "  ", sharedContext.generateId()),
            voiceId,
            new Token(TT.WS, " ", sharedContext.generateId()),
            key,
            new Token(TT.EQL, "=", sharedContext.generateId()),
            value,
          ])
        ),
        1
      )[0];
    });

    fc.assert(
      fc.property(genWhitespaceVariations, (tokens) => {
        const input = tokens.map((t) => t.lexeme).join("");
        const ctx = createCtx(input);
        const result = scanVoiceInfo(ctx);

        // Should successfully parse and produce expected token types
        const nonWhitespaceTokens = ctx.tokens.filter((t) => t.type !== TT.WS);
        return (
          nonWhitespaceTokens.length >= 3 &&
          nonWhitespaceTokens[0].type === TT.VX_ID &&
          nonWhitespaceTokens[1].type === TT.VX_K &&
          nonWhitespaceTokens[3].type === TT.VX_V
        );
      }),
      {
        verbose: false,
        numRuns: 500,
      }
    );
  });

  it("should never crash on generated voice definitions", () => {
    fc.assert(
      fc.property(genVxDefinition, (tokens) => {
        try {
          const input = tokens.map((t) => t.lexeme).join("");
          const ctx = createCtx(input);
          scanVoiceInfo(ctx);
          return true;
        } catch (e) {
          console.log("Crash on input:", tokens.map((t) => t.lexeme).join(""), e);
          return false;
        }
      }),
      {
        verbose: false,
        numRuns: 1000,
      }
    );
  });

  it("should handle quoted string values correctly", () => {
    const genQuotedStringTest = fc.tuple(
      genVxId,
      fc.constantFrom("name").map((key) => new Token(TT.VX_K, key, sharedContext.generateId())),
      fc
        .string({ minLength: 1, maxLength: 15 })
        .filter((s) => !s.includes('"') && !s.includes("\n"))
        .map((s) => new Token(TT.VX_V, `"${s}"`, sharedContext.generateId()))
    );

    fc.assert(
      fc.property(genQuotedStringTest, ([voiceId, key, quotedValue]) => {
        const input = `${voiceId.lexeme} ${key.lexeme}=${quotedValue.lexeme}`;
        const ctx = createCtx(input);
        const result = scanVoiceInfo(ctx);

        return (
          ctx.tokens.length === 4 &&
          ctx.tokens[0].type === TT.VX_ID &&
          ctx.tokens[1].type === TT.VX_K &&
          ctx.tokens[3].type === TT.VX_V &&
          ctx.tokens[3].lexeme === quotedValue.lexeme
        );
      }),
      {
        verbose: false,
        numRuns: 500,
      }
    );
  });

  it("should handle numeric property values correctly", () => {
    const genNumericTest = fc.tuple(
      genVxId,
      fc.constantFrom("transpose", "octave", "stafflines").map((key) => new Token(TT.VX_K, key, sharedContext.generateId())),
      fc.integer({ min: -12, max: 12 }).map((n) => new Token(TT.VX_V, n.toString(), sharedContext.generateId()))
    );

    fc.assert(
      fc.property(genNumericTest, ([voiceId, key, numValue]) => {
        const input = `${voiceId.lexeme} ${key.lexeme}=${numValue.lexeme}`;
        const ctx = createCtx(input);
        const result = scanVoiceInfo(ctx);

        return (
          ctx.tokens.length === 4 &&
          ctx.tokens[0].type === TT.VX_ID &&
          ctx.tokens[1].type === TT.VX_K &&
          ctx.tokens[3].type === TT.VX_V &&
          ctx.tokens[3].lexeme === numValue.lexeme
        );
      }),
      {
        verbose: false,
        numRuns: 500,
      }
    );
  });

  it("should handle special perc keyword correctly", () => {
    const genPercTest = fc.tuple(
      genVxId,
      fc.constantFrom("perc").map((perc) => new Token(TT.VX_V, perc, sharedContext.generateId()))
    );

    fc.assert(
      fc.property(genPercTest, ([voiceId, percToken]) => {
        const input = `${voiceId.lexeme} ${percToken.lexeme}`;
        const ctx = createCtx(input);
        const result = scanVoiceInfo(ctx);

        return ctx.tokens.length >= 2 && ctx.tokens[0].type === TT.VX_ID && ctx.tokens.some((t) => t.lexeme === "perc");
      }),
      {
        verbose: false,
        numRuns: 200,
      }
    );
  });
});
