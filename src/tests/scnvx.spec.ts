import { assert } from "chai";
import { describe, it } from "mocha";
import { ABCContext } from "../parsers/Context";
import { Ctx, TT } from "../parsers/scan2";
import { scnvx } from "../interpreter/vxPrs";

// Helper function to create a Ctx object for testing
function createCtx(source: string): Ctx {
  const abcContext = new ABCContext();
  return new Ctx(source, abcContext);
}

describe.only("scnvx", () => {
  describe("Basic Voice ID Parsing", () => {
    it("should parse a simple numeric voice ID", () => {
      const ctx = createCtx("1");
      const result = scnvx(ctx);

      assert.equal(result.length, 1);
      assert.equal(result[0].type, TT.VX_ID);
      assert.equal(result[0].lexeme, "1");
    });

    it("should parse an alphabetic voice ID", () => {
      const ctx = createCtx("melody");
      const result = scnvx(ctx);

      assert.equal(result.length, 1);
      assert.equal(result[0].type, TT.VX_ID);
      assert.equal(result[0].lexeme, "melody");
    });

    it("should parse a mixed alphanumeric voice ID", () => {
      const ctx = createCtx("voice1");
      const result = scnvx(ctx);

      assert.equal(result.length, 1);
      assert.equal(result[0].type, TT.VX_ID);
      assert.equal(result[0].lexeme, "voice1");
    });

    it("should parse uppercase voice ID", () => {
      const ctx = createCtx("SOPRANO");
      const result = scnvx(ctx);

      assert.equal(result.length, 1);
      assert.equal(result[0].type, TT.VX_ID);
      assert.equal(result[0].lexeme, "SOPRANO");
    });
  });

  describe("Single Property Parsing", () => {
    it("should parse voice ID with name property", () => {
      const ctx = createCtx("1 name=Melody");
      const result = scnvx(ctx);

      assert.equal(result.length, 3);
      assert.equal(result[0].type, TT.VX_ID);
      assert.equal(result[0].lexeme, "1");
      assert.equal(result[1].type, TT.VX_K);
      assert.equal(result[1].lexeme, "name");
      assert.equal(result[2].type, TT.VX_V);
      assert.equal(result[2].lexeme, "Melody");
    });

    it("should parse voice ID with clef property", () => {
      const ctx = createCtx("bass clef=bass");
      const result = scnvx(ctx);

      assert.equal(result.length, 3);
      assert.equal(result[0].type, TT.VX_ID);
      assert.equal(result[0].lexeme, "bass");
      assert.equal(result[1].type, TT.VX_K);
      assert.equal(result[1].lexeme, "clef");
      assert.equal(result[2].type, TT.VX_V);
      assert.equal(result[2].lexeme, "bass");
    });

    it("should parse voice ID with transpose property", () => {
      const ctx = createCtx("1 transpose=2");
      const result = scnvx(ctx);

      assert.equal(result.length, 3);
      assert.equal(result[0].type, TT.VX_ID);
      assert.equal(result[0].lexeme, "1");
      assert.equal(result[1].type, TT.VX_K);
      assert.equal(result[1].lexeme, "transpose");
      assert.equal(result[2].type, TT.VX_V);
      assert.equal(result[2].lexeme, "2");
    });

    it("should parse voice ID with octave property", () => {
      const ctx = createCtx("1 octave=-1");
      const result = scnvx(ctx);

      assert.equal(result.length, 3);
      assert.equal(result[0].type, TT.VX_ID);
      assert.equal(result[0].lexeme, "1");
      assert.equal(result[1].type, TT.VX_K);
      assert.equal(result[1].lexeme, "octave");
      assert.equal(result[2].type, TT.VX_V);
      assert.equal(result[2].lexeme, "-1");
    });
  });

  describe("Multiple Properties Parsing", () => {
    it("should parse voice ID with multiple properties", () => {
      const ctx = createCtx("1 name=Melody clef=treble transpose=2");
      const result = scnvx(ctx);

      assert.equal(result.length, 7);
      assert.equal(result[0].type, TT.VX_ID);
      assert.equal(result[0].lexeme, "1");
      assert.equal(result[1].type, TT.VX_K);
      assert.equal(result[1].lexeme, "name");
      assert.equal(result[2].type, TT.VX_V);
      assert.equal(result[2].lexeme, "Melody");
      assert.equal(result[3].type, TT.VX_K);
      assert.equal(result[3].lexeme, "clef");
      assert.equal(result[4].type, TT.VX_V);
      assert.equal(result[4].lexeme, "treble");
      assert.equal(result[5].type, TT.VX_K);
      assert.equal(result[5].lexeme, "transpose");
      assert.equal(result[6].type, TT.VX_V);
      assert.equal(result[6].lexeme, "2");
    });

    it("should parse voice ID with all common properties", () => {
      const ctx = createCtx("melody name=Melody clef=treble transpose=2 octave=1 stafflines=5");
      const result = scnvx(ctx);

      assert.equal(result.length, 11);
      assert.equal(result[0].type, TT.VX_ID);
      assert.equal(result[0].lexeme, "melody");

      // Check that we have alternating key-value pairs
      for (let i = 1; i < result.length; i += 2) {
        assert.equal(result[i].type, TT.VX_K);
        if (i + 1 < result.length) {
          assert.equal(result[i + 1].type, TT.VX_V);
        }
      }
    });
  });

  describe("String Literal Values", () => {
    it("should parse quoted string values", () => {
      const ctx = createCtx('1 name="My Voice"');
      const result = scnvx(ctx);

      assert.equal(result.length, 3);
      assert.equal(result[0].type, TT.VX_ID);
      assert.equal(result[0].lexeme, "1");
      assert.equal(result[1].type, TT.VX_K);
      assert.equal(result[1].lexeme, "name");
      assert.equal(result[2].type, TT.VX_V);
      assert.equal(result[2].lexeme, '"My Voice"');
    });

    it("should parse quoted string with spaces", () => {
      const ctx = createCtx('soprano name="Soprano Voice Part"');
      const result = scnvx(ctx);

      assert.equal(result.length, 3);
      assert.equal(result[0].type, TT.VX_ID);
      assert.equal(result[0].lexeme, "soprano");
      assert.equal(result[1].type, TT.VX_K);
      assert.equal(result[1].lexeme, "name");
      assert.equal(result[2].type, TT.VX_V);
      assert.equal(result[2].lexeme, '"Soprano Voice Part"');
    });
  });

  describe("Special Value: perc", () => {
    it("should parse perc as a standalone value (omitted style key)", () => {
      const ctx = createCtx("1 perc");
      const result = scnvx(ctx);

      // Based on user clarification, perc should be treated as a value where style key is omitted
      // The exact behavior may depend on implementation details
      assert.isTrue(result.length >= 2);
      assert.equal(result[0].type, TT.VX_ID);
      assert.equal(result[0].lexeme, "1");

      // The perc should appear as a value token
      const percToken = result.find((t) => t.lexeme === "perc");
      assert.isDefined(percToken);
    });

    it("should parse perc with other properties", () => {
      const ctx = createCtx("drums perc name=Drums");
      const result = scnvx(ctx);

      assert.isTrue(result.length >= 4);
      assert.equal(result[0].type, TT.VX_ID);
      assert.equal(result[0].lexeme, "drums");

      // Should contain perc and name tokens
      const percToken = result.find((t) => t.lexeme === "perc");
      const nameKey = result.find((t) => t.lexeme === "name" && t.type === TT.VX_K);
      const nameValue = result.find((t) => t.lexeme === "Drums" && t.type === TT.VX_V);

      assert.isDefined(percToken);
      assert.isDefined(nameKey);
      assert.isDefined(nameValue);
    });
  });

  describe("Whitespace Handling", () => {
    it("should handle spaces around equals signs", () => {
      const ctx = createCtx("1 name = Melody");
      const result = scnvx(ctx);

      assert.equal(result.length, 3);
      assert.equal(result[0].type, TT.VX_ID);
      assert.equal(result[0].lexeme, "1");
      assert.equal(result[1].type, TT.VX_K);
      assert.equal(result[1].lexeme, "name");
      assert.equal(result[2].type, TT.VX_V);
      assert.equal(result[2].lexeme, "Melody");
    });

    it("should handle multiple spaces between properties", () => {
      const ctx = createCtx("1   name=Melody    clef=treble");
      const result = scnvx(ctx);

      assert.equal(result.length, 5);
      assert.equal(result[0].type, TT.VX_ID);
      assert.equal(result[0].lexeme, "1");
      assert.equal(result[1].type, TT.VX_K);
      assert.equal(result[1].lexeme, "name");
      assert.equal(result[2].type, TT.VX_V);
      assert.equal(result[2].lexeme, "Melody");
      assert.equal(result[3].type, TT.VX_K);
      assert.equal(result[3].lexeme, "clef");
      assert.equal(result[4].type, TT.VX_V);
      assert.equal(result[4].lexeme, "treble");
    });

    it("should handle leading whitespace", () => {
      const ctx = createCtx("  1 name=Melody");
      const result = scnvx(ctx);

      assert.equal(result.length, 3);
      assert.equal(result[0].type, TT.VX_ID);
      assert.equal(result[0].lexeme, "1");
      assert.equal(result[1].type, TT.VX_K);
      assert.equal(result[1].lexeme, "name");
      assert.equal(result[2].type, TT.VX_V);
      assert.equal(result[2].lexeme, "Melody");
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
        const result = scnvx(ctx);

        assert.equal(result.length, 3, `Failed for property: ${prop}`);
        assert.equal(result[0].type, TT.VX_ID);
        assert.equal(result[1].type, TT.VX_K);
        assert.equal(result[1].lexeme, prop);
        assert.equal(result[2].type, TT.VX_V);
        assert.equal(result[2].lexeme, "value");
      });
    });

    it("should handle case-sensitive property keys", () => {
      const ctx = createCtx("1 Name=Melody");
      const result = scnvx(ctx);

      assert.equal(result.length, 3);
      assert.equal(result[1].type, TT.VX_K);
      assert.equal(result[1].lexeme, "Name"); // Should preserve case
    });
  });

  describe("Numeric Values", () => {
    it("should parse positive integer values", () => {
      const ctx = createCtx("1 transpose=5");
      const result = scnvx(ctx);

      assert.equal(result.length, 3);
      assert.equal(result[2].type, TT.VX_V);
      assert.equal(result[2].lexeme, "5");
    });

    it("should parse negative integer values", () => {
      const ctx = createCtx("1 octave=-2");
      const result = scnvx(ctx);

      assert.equal(result.length, 3);
      assert.equal(result[2].type, TT.VX_V);
      assert.equal(result[2].lexeme, "-2");
    });

    it("should parse decimal values", () => {
      const ctx = createCtx("1 staffscale=1.5");
      const result = scnvx(ctx);

      assert.equal(result.length, 3);
      assert.equal(result[2].type, TT.VX_V);
      assert.equal(result[2].lexeme, "1.5");
    });
  });

  describe("Boolean-like Values", () => {
    it("should parse true/false values", () => {
      const ctx = createCtx("1 merge=true");
      const result = scnvx(ctx);

      assert.equal(result.length, 3);
      assert.equal(result[2].type, TT.VX_V);
      assert.equal(result[2].lexeme, "true");
    });

    it("should parse 1/0 values", () => {
      const ctx = createCtx("1 merge=1");
      const result = scnvx(ctx);

      assert.equal(result.length, 3);
      assert.equal(result[2].type, TT.VX_V);
      assert.equal(result[2].lexeme, "1");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty input", () => {
      const ctx = createCtx("");
      const result = scnvx(ctx);

      assert.isArray(result);
      assert.equal(result.length, 0);
    });

    it("should handle whitespace-only input", () => {
      const ctx = createCtx("   ");
      const result = scnvx(ctx);

      assert.isArray(result);
      // Should not produce any meaningful tokens
    });

    it("should handle voice ID only", () => {
      const ctx = createCtx("melody");
      const result = scnvx(ctx);

      assert.equal(result.length, 1);
      assert.equal(result[0].type, TT.VX_ID);
      assert.equal(result[0].lexeme, "melody");
    });
  });

  describe("Complex Real-world Examples", () => {
    it("should parse a typical melody voice definition", () => {
      const ctx = createCtx('1 name="Melody" clef=treble transpose=0 octave=0');
      const result = scnvx(ctx);

      assert.equal(result.length, 9);
      assert.equal(result[0].lexeme, "1");
      assert.equal(result[1].lexeme, "name");
      assert.equal(result[2].lexeme, '"Melody"');
      assert.equal(result[3].lexeme, "clef");
      assert.equal(result[4].lexeme, "treble");
      assert.equal(result[5].lexeme, "transpose");
      assert.equal(result[6].lexeme, "0");
      assert.equal(result[7].lexeme, "octave");
      assert.equal(result[8].lexeme, "0");
    });

    it("should parse a bass voice definition", () => {
      const ctx = createCtx('bass name="Bass Line" clef=bass octave=-1 stems=down');
      const result = scnvx(ctx);

      assert.equal(result.length, 9);
      assert.equal(result[0].lexeme, "bass");
      assert.equal(result[1].lexeme, "name");
      assert.equal(result[2].lexeme, '"Bass Line"');
      assert.equal(result[3].lexeme, "clef");
      assert.equal(result[4].lexeme, "bass");
      assert.equal(result[5].lexeme, "octave");
      assert.equal(result[6].lexeme, "-1");
      assert.equal(result[7].lexeme, "stems");
      assert.equal(result[8].lexeme, "down");
    });

    it("should parse a percussion voice definition", () => {
      const ctx = createCtx('drums perc name="Drum Kit" stafflines=1');
      const result = scnvx(ctx);

      assert.isTrue(result.length >= 5);
      assert.equal(result[0].lexeme, "drums");

      // Should contain perc, name, and stafflines
      const hasPerc = result.some((t) => t.lexeme === "perc");
      const hasName = result.some((t) => t.lexeme === "name");
      const hasStafflines = result.some((t) => t.lexeme === "stafflines");

      assert.isTrue(hasPerc);
      assert.isTrue(hasName);
      assert.isTrue(hasStafflines);
    });
  });
});
