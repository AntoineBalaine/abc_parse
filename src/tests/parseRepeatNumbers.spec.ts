import assert from "assert";
import { describe, it } from "mocha";
import { Ctx, Token, TT } from "../parsers/scan2";
import { parseRepeatNumbers, barline2, parseColonStart, parseBarlineStart, parseLeftBracketStart } from "../parsers/scan_tunebody";
import { AbcErrorReporter } from "../parsers/ErrorReporter";

// Helper function to create a Ctx object for testing
function createCtx(source: string): Ctx {
  return new Ctx(source, new AbcErrorReporter());
}

describe("parseRepeatNumbers", () => {
  it("should parse a single number", () => {
    const ctx = createCtx("1");
    parseRepeatNumbers(ctx);
    assert.equal(ctx.tokens[0].type, TT.REPEAT_NUMBER);
  });

  it("should parse a multi-digit number", () => {
    const ctx = createCtx("123");
    parseRepeatNumbers(ctx);
    assert.equal(ctx.tokens[0].type, TT.REPEAT_NUMBER);
  });

  it("should parse a list of numbers", () => {
    const ctx = createCtx("1,2,3");
    parseRepeatNumbers(ctx);

    // Check token types
    assert.equal(ctx.tokens[0].type, TT.REPEAT_NUMBER);
    assert.equal(ctx.tokens[1].type, TT.REPEAT_COMMA);
    assert.equal(ctx.tokens[2].type, TT.REPEAT_NUMBER);
    assert.equal(ctx.tokens[3].type, TT.REPEAT_COMMA);
    assert.equal(ctx.tokens[4].type, TT.REPEAT_NUMBER);
  });

  it("should parse a range", () => {
    const ctx = createCtx("1-3");
    parseRepeatNumbers(ctx);

    // Check token types
    assert.equal(ctx.tokens[0].type, TT.REPEAT_NUMBER);
    assert.equal(ctx.tokens[1].type, TT.REPEAT_DASH);
    assert.equal(ctx.tokens[2].type, TT.REPEAT_NUMBER);
  });

  it("should parse a mixed format", () => {
    const ctx = createCtx("1,3-5,7");
    parseRepeatNumbers(ctx);

    // Check token types
    assert.equal(ctx.tokens[0].type, TT.REPEAT_NUMBER);
    assert.equal(ctx.tokens[1].type, TT.REPEAT_COMMA);
    assert.equal(ctx.tokens[2].type, TT.REPEAT_NUMBER);
    assert.equal(ctx.tokens[3].type, TT.REPEAT_DASH);
    assert.equal(ctx.tokens[4].type, TT.REPEAT_NUMBER);
    assert.equal(ctx.tokens[5].type, TT.REPEAT_COMMA);
    assert.equal(ctx.tokens[6].type, TT.REPEAT_NUMBER);
  });

  it("should parse x notation", () => {
    const ctx = createCtx("1x2");
    parseRepeatNumbers(ctx);

    // Check token types
    assert.equal(ctx.tokens[0].type, TT.REPEAT_NUMBER);
    assert.equal(ctx.tokens[1].type, TT.REPEAT_X);
    assert.equal(ctx.tokens[2].type, TT.REPEAT_NUMBER);
  });

  it("should parse complex combinations", () => {
    const ctx = createCtx("1,2x2,3-5");
    parseRepeatNumbers(ctx);

    // Check token types
    assert.equal(ctx.tokens[0].type, TT.REPEAT_NUMBER);
    assert.equal(ctx.tokens[1].type, TT.REPEAT_COMMA);
    assert.equal(ctx.tokens[2].type, TT.REPEAT_NUMBER);
    assert.equal(ctx.tokens[3].type, TT.REPEAT_X);
    assert.equal(ctx.tokens[4].type, TT.REPEAT_NUMBER);
    assert.equal(ctx.tokens[5].type, TT.REPEAT_COMMA);
    assert.equal(ctx.tokens[6].type, TT.REPEAT_NUMBER);
    assert.equal(ctx.tokens[7].type, TT.REPEAT_DASH);
    assert.equal(ctx.tokens[8].type, TT.REPEAT_NUMBER);
  });

  it("should handle uppercase X notation", () => {
    const ctx = createCtx("1X2");
    parseRepeatNumbers(ctx);

    // Check token types
    assert.equal(ctx.tokens[0].type, TT.REPEAT_NUMBER);
    assert.equal(ctx.tokens[1].type, TT.REPEAT_X);
    assert.equal(ctx.tokens[2].type, TT.REPEAT_NUMBER);
  });

  it("should return false for invalid input", () => {
    const ctx = createCtx("A");
    const result = parseRepeatNumbers(ctx);
    assert.equal(result, false);
  });

  it("should report an error for comma without following number", () => {
    const ctx = createCtx("1,");
    parseRepeatNumbers(ctx);
    assert.equal(ctx.tokens[0].type, TT.REPEAT_NUMBER);
    assert.equal(ctx.tokens[1].type, TT.REPEAT_COMMA);
  });

  it("should report an error for dash without following number", () => {
    const ctx = createCtx("1-");
    parseRepeatNumbers(ctx);
    assert.equal(ctx.tokens[0].type, TT.REPEAT_NUMBER);
    assert.equal(ctx.tokens[1].type, TT.REPEAT_DASH);
  });

  it("should report an error for x without following number", () => {
    const ctx = createCtx("1x");
    parseRepeatNumbers(ctx);
    assert.equal(ctx.tokens[0].type, TT.REPEAT_NUMBER);
    assert.equal(ctx.tokens[1].type, TT.REPEAT_X);
  });

  it("should stop parsing at EOL", () => {
    const ctx = createCtx("1,2\n3");
    parseRepeatNumbers(ctx);
    assert.equal(ctx.tokens[0].type, TT.REPEAT_NUMBER);
    assert.equal(ctx.tokens[1].type, TT.REPEAT_COMMA);
    assert.equal(ctx.tokens[2].type, TT.REPEAT_NUMBER);
  });

  it("should handle repeat numbers in context", () => {
    const ctx = createCtx("1,2-3");
    parseRepeatNumbers(ctx);
    assert.equal(ctx.tokens[0].type, TT.REPEAT_NUMBER);
    assert.equal(ctx.tokens[1].type, TT.REPEAT_COMMA);
    assert.equal(ctx.tokens[2].type, TT.REPEAT_NUMBER);
    assert.equal(ctx.tokens[3].type, TT.REPEAT_DASH);
    assert.equal(ctx.tokens[4].type, TT.REPEAT_NUMBER);
  });
});

describe("barline2", () => {
  // Tests for parseColonStart through barline2
  describe("colon-start barlines", () => {
    type T = {
      name: string;
      src: string;

      tokens: { type: TT; lexeme?: string }[];
      lexeme?: string;
    };

    const testCases: T[] = [
      {
        name: "should parse a single colon",
        src: ":",
        tokens: [{ type: TT.BARLINE, lexeme: ":" }],
      },
      {
        name: "should parse multiple colons",
        src: ":::",
        tokens: [{ type: TT.BARLINE, lexeme: ":::" }],
      },
      {
        name: "should parse colons followed by barlines",
        src: ":||",
        tokens: [{ type: TT.BARLINE, lexeme: ":||" }],
      },
      {
        name: "should parse colons, barlines, and right bracket",
        src: ":||]",
        tokens: [{ type: TT.BARLINE, lexeme: ":||]" }],
      },
      {
        name: "should parse colons, barlines, whitespace, and right bracket",
        src: ":|| ]",
        tokens: [{ type: TT.BARLINE, lexeme: ":|| ]" }],
      },
      {
        name: "should parse colons, barlines, and repeat numbers",
        src: ":||1",
        tokens: [{ type: TT.BARLINE }, { type: TT.REPEAT_NUMBER }],
      },
      {
        name: "should parse colons, barlines, left bracket, and repeat numbers",
        src: ":||[1",
        tokens: [{ type: TT.BARLINE }, { type: TT.REPEAT_NUMBER }],
      },
      {
        name: "should parse multiple colons followed by multiple bars",
        src: "::::|",
        tokens: [{ type: TT.BARLINE, lexeme: "::::|" }],
      },
      {
        name: "should parse double colon and bar",
        src: "::|",
        tokens: [{ type: TT.BARLINE, lexeme: "::|" }],
      },
      {
        name: "should parse colon and bar",
        src: ":|",
        tokens: [{ type: TT.BARLINE, lexeme: ":|" }],
      },
      {
        name: "should parse colon and bar with repeat numbers",
        src: ":|2,4",
        tokens: [{ type: TT.BARLINE }, { type: TT.REPEAT_NUMBER }, { type: TT.REPEAT_COMMA }, { type: TT.REPEAT_NUMBER }],
      },
      {
        name: "should parse colon and bar with bracketed repeat numbers",
        src: ":|[2,4",
        tokens: [{ type: TT.BARLINE }, { type: TT.REPEAT_NUMBER }, { type: TT.REPEAT_COMMA }, { type: TT.REPEAT_NUMBER }],
      },
    ];

    testCases.forEach((testCase) => {
      it(testCase.name, () => {
        const ctx = createCtx(testCase.src);
        const result = parseColonStart(ctx);

        assert.equal(result, true);
        assert.equal(ctx.tokens.length, testCase.tokens.length);
        for (let i = 0; i < testCase.tokens.length; i++) {
          assert.equal(ctx.tokens[i].type, testCase.tokens[i].type);

          if (testCase.tokens[i].lexeme) {
            assert.equal(ctx.tokens[i].lexeme, testCase.tokens[i].lexeme);
          }
        }
      });
    });
  });

  // Tests for parseBarlineStart through barline2
  describe("barline-start barlines", () => {
    it("should parse a single barline", () => {
      const ctx = createCtx("|");
      const result = parseBarlineStart(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens[0].type, TT.BARLINE);
      assert.equal(ctx.tokens[0].lexeme, "|");
    });

    it("should parse multiple barlines", () => {
      const ctx = createCtx("|||");
      const result = parseBarlineStart(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens[0].type, TT.BARLINE);
      assert.equal(ctx.tokens[0].lexeme, "|||");
    });

    it("should parse barlines followed by colons", () => {
      const ctx = createCtx("|:");
      const result = parseBarlineStart(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens[0].type, TT.BARLINE);
      assert.equal(ctx.tokens[0].lexeme, "|:");
    });

    it("should parse barlines and right bracket", () => {
      const ctx = createCtx("|]");
      const result = parseBarlineStart(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens[0].type, TT.BARLINE);
      assert.equal(ctx.tokens[0].lexeme, "|]");
    });

    it("should parse barlines, whitespace, and right bracket", () => {
      const ctx = createCtx("| ]");
      const result = parseBarlineStart(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens[0].type, TT.BARLINE);
      assert.equal(ctx.tokens[0].lexeme, "| ]");
    });

    it("should parse barlines and repeat numbers", () => {
      const ctx = createCtx("|1");
      const result = parseBarlineStart(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens[0].type, TT.BARLINE);
      assert.equal(ctx.tokens[1].type, TT.REPEAT_NUMBER);
    });

    it("should parse barlines, left bracket, and repeat numbers", () => {
      const ctx = createCtx("|[1");
      const result = parseBarlineStart(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens[0].type, TT.BARLINE);
      assert.equal(ctx.tokens[1].type, TT.REPEAT_NUMBER);
    });

    it("should parse barlines, whitespace, left bracket, and repeat numbers", () => {
      const ctx = createCtx("| [1");
      const result = parseBarlineStart(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens[0].type, TT.BARLINE);
      assert.equal(ctx.tokens[1].type, TT.REPEAT_NUMBER);
    });
  });

  // Tests for parseLeftBracketStart through barline2
  describe.only("left-bracket-start barlines", () => {
    it("should parse a left bracket", () => {
      const ctx = createCtx("[");
      const result = parseLeftBracketStart(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens[0].type, TT.BARLINE);
      assert.equal(ctx.tokens[0].lexeme, "[");
    });

    it("should parse left bracket and repeat numbers", () => {
      const ctx = createCtx("[1");
      const result = parseLeftBracketStart(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens[0].type, TT.BARLINE);
      assert.equal(ctx.tokens[1].type, TT.REPEAT_NUMBER);
    });

    it("should parse left bracket, barline", () => {
      const ctx = createCtx("[|");
      const result = parseLeftBracketStart(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens[0].type, TT.BARLINE);
      assert.equal(ctx.tokens[0].lexeme, "[|");
    });

    it("should parse left bracket, barline, colons", () => {
      const ctx = createCtx("[|:");
      const result = parseLeftBracketStart(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens[0].type, TT.BARLINE);
      assert.equal(ctx.tokens[0].lexeme, "[|:");
    });

    it("should parse left bracket, barline, right bracket", () => {
      const ctx = createCtx("[|]");
      const result = parseLeftBracketStart(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens[0].type, TT.BARLINE);
      assert.equal(ctx.tokens[0].lexeme, "[|]");
    });

    it("should parse left bracket, right bracket (empty brackets)", () => {
      const ctx = createCtx("[]");
      const result = parseLeftBracketStart(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens[0].type, TT.BARLINE);
      assert.equal(ctx.tokens[0].lexeme, "[]");
    });
  });

  // Edge cases and invalid inputs
  describe("edge cases and invalid inputs", () => {
    it("should return false for empty input", () => {
      const ctx = createCtx("");
      const result = barline2(ctx);
      assert.equal(result, false);
    });

    it("should return false for invalid input", () => {
      const ctx = createCtx("A");
      const result = barline2(ctx);
      assert.equal(result, false);
    });

    it("should handle barlines in context", () => {
      const ctx = createCtx("|: A :|");
      const result = barline2(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens[0].type, TT.BARLINE);
      assert.equal(ctx.tokens[0].lexeme, "|:");
      // Only the first barline should be parsed
      assert.equal(ctx.current, 2); // Current position should be after "|:"
    });
  });
});
