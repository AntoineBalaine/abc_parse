import assert from "assert";
import { describe, it } from "mocha";
import { ABCContext } from "../parsers/Context";
import { AbcErrorReporter } from "../parsers/ErrorReporter";
import { Ctx, TT, info_line, stylesheet_directive } from "../parsers/scan2";
import {
  accidental,
  ampersand,
  annotation,
  barline,
  bcktck_spc,
  chord,
  comment,
  decoration,
  grace_grp,
  inline_field,
  line_continuation,
  note,
  pitch,
  rest,
  rhythm,
  scanTune,
  slur,
  symbol,
  symbol_line,
  tuplet,
  y_spacer,
} from "../parsers/scan_tunebody";

// Helper function to create a Ctx object for testing
export function createCtx(source: string): Ctx {
  return new Ctx(source, new ABCContext());
}

describe("scan2", () => {
  describe("stylesheet_directive", () => {
    it("should parse a stylesheet directive", () => {
      const ctx = createCtx("%%directive");
      const result = stylesheet_directive(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 1);
      assert.equal(ctx.tokens[0].type, TT.STYLESHEET_DIRECTIVE);
    });

    it("should parse a stylesheet directive with newline", () => {
      const ctx = createCtx("%%directive\nNext line");
      const result = stylesheet_directive(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 1);
      assert.equal(ctx.tokens[0].type, TT.STYLESHEET_DIRECTIVE);
    });

    it("should return false for non-stylesheet directive", () => {
      const ctx = createCtx("%comment");
      const result = stylesheet_directive(ctx);
      assert.equal(result, false);
      assert.equal(ctx.tokens.length, 0);
    });
  });

  describe("comment", () => {
    it("should parse a comment", () => {
      const ctx = createCtx("%comment");
      const result = comment(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 1);
      assert.equal(ctx.tokens[0].type, TT.COMMENT);
    });

    it("should parse a comment with newline", () => {
      const ctx = createCtx("%comment\nNext line");
      const result = comment(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 1);
      assert.equal(ctx.tokens[0].type, TT.COMMENT);
    });

    it("should return false for non-comment", () => {
      const ctx = createCtx("not a comment");
      const result = comment(ctx);
      assert.equal(result, false);
      assert.equal(ctx.tokens.length, 0);
    });
  });

  describe("decoration", () => {
    it("shoul fail to parse misplaced decoration", () => {
      const ctx = createCtx("This");
      const result = decoration(ctx);
      assert.equal(result, false);
    });
    it("should parse a single decoration followed by a pitch", () => {
      const ctx = createCtx(".A");
      const result = decoration(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 1);
      assert.equal(ctx.tokens[0].type, TT.DECORATION);
      assert.equal(ctx.tokens[0].lexeme, ".");
      // Verify that the pitch is not included in the match
    });

    it("should parse multiple decoration characters followed by a pitch", () => {
      const ctx = createCtx("~.HA");
      const result = decoration(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 1);
      assert.equal(ctx.tokens[0].type, TT.DECORATION);
      assert.equal(ctx.tokens[0].lexeme, "~.H");
    });

    it("should parse a decoration followed by a rest", () => {
      const ctx = createCtx(".z");
      const result = decoration(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 1);
      assert.equal(ctx.tokens[0].type, TT.DECORATION);
      assert.equal(ctx.tokens[0].lexeme, ".");
    });

    it("should parse multiple decorations followed by a rest", () => {
      const ctx = createCtx("~.z");
      const result = decoration(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 1);
      assert.equal(ctx.tokens[0].type, TT.DECORATION);
      assert.equal(ctx.tokens[0].lexeme, "~.");
    });

    it("should return false for decoration not followed by pitch or rest", () => {
      const ctx = createCtx(".%");
      const result = decoration(ctx);
      assert.equal(result, false);
      assert.equal(ctx.tokens.length, 0);
    });

    it("should return false for standalone decoration", () => {
      const ctx = createCtx(".");
      const result = decoration(ctx);
      assert.equal(result, false);
      assert.equal(ctx.tokens.length, 0);
    });

    it("should work with scanTune for a decoration followed by a pitch", () => {
      const ctx = createCtx("X:1\n.A");
      scanTune(ctx);
      assert.equal(ctx.tokens.length, 5);
      assert.equal(ctx.tokens[3].type, TT.DECORATION);
      assert.equal(ctx.tokens[4].type, TT.NOTE_LETTER);
    });

    it("should work with scanTune for a decoration followed by a rest", () => {
      const ctx = createCtx("X:1\n.z");
      scanTune(ctx);
      assert.equal(ctx.tokens.length, 5);
      assert.equal(ctx.tokens[3].type, TT.DECORATION);
      assert.equal(ctx.tokens[4].type, TT.REST);
    });

    it("should parse R decoration (roll)", () => {
      // R is a single-letter decoration for "roll" ornament
      const ctx = createCtx("RD");
      const result = decoration(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 1);
      assert.equal(ctx.tokens[0].type, TT.DECORATION);
      assert.equal(ctx.tokens[0].lexeme, "R");
    });

    it("should parse R alongside other decorations", () => {
      const ctx = createCtx("~.RHA");
      const result = decoration(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens[0].type, TT.DECORATION);
      assert.equal(ctx.tokens[0].lexeme, "~.RH");
    });
  });

  describe("symbol", () => {
    it("should parse a `+` symbol", () => {
      const ctx = createCtx("+symbol+");
      const result = symbol(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 1);
      assert.equal(ctx.tokens[0].type, TT.SYMBOL);
    });
    it("should parse a symbol", () => {
      const ctx = createCtx("!symbol!");
      const result = symbol(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 1);
      assert.equal(ctx.tokens[0].type, TT.SYMBOL);
    });

    it("should return false for non-symbol", () => {
      const ctx = createCtx("not a symbol");
      const result = symbol(ctx);
      assert.equal(result, false);
      assert.equal(ctx.tokens.length, 0);
    });
  });

  describe("rhythm", () => {
    it("should parse a numerator", () => {
      const ctx = createCtx("20");
      const result = rhythm(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 1);
      assert.equal(ctx.tokens[0].type, TT.RHY_NUMER);
      assert.equal(ctx.tokens[0].lexeme, "20");
    });

    it("should parse a separator", () => {
      const ctx = createCtx("/");
      const result = rhythm(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 1);
      assert.equal(ctx.tokens[0].type, TT.RHY_SEP);
    });

    it("should parse a long separator", () => {
      const ctx = createCtx("///");
      const result = rhythm(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 1);
      assert.equal(ctx.tokens[0].type, TT.RHY_SEP);
      assert.equal(ctx.tokens[0].lexeme.length, 3);
    });

    it("should parse a full rhythm", () => {
      const ctx = createCtx("3/4");

      // Now test parsing the separator and denominator
      const result = rhythm(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 3);
      assert.equal(ctx.tokens[0].type, TT.RHY_NUMER);
      assert.equal(ctx.tokens[1].type, TT.RHY_SEP);
      assert.equal(ctx.tokens[2].type, TT.RHY_DENOM);
    });

    it("should parse broken rhythm", () => {
      const ctx = createCtx(">>");
      const result = rhythm(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 1);
      assert.equal(ctx.tokens[0].type, TT.RHY_BRKN);
    });
    it("should parse broken rhythm between notes", () => {
      const ctx = createCtx("G>>A");
      const result1 = note(ctx);
      const result2 = note(ctx);
      assert.equal(result1, true);
      assert.equal(result2, true);
      assert.equal(ctx.tokens.length, 3);
      assert.equal(ctx.tokens[0].type, TT.NOTE_LETTER);
      assert.equal(ctx.tokens[1].type, TT.RHY_BRKN);
      assert.equal(ctx.tokens[2].type, TT.NOTE_LETTER);
    });
  });

  describe("pitch", () => {
    it("should parse a simple pitch", () => {
      const ctx = createCtx("A");
      const result = pitch(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 1);
      assert.equal(ctx.tokens[0].type, TT.NOTE_LETTER);
    });

    it("should parse a pitch with octave up", () => {
      const ctx = createCtx("A'");
      const result = pitch(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 2);
      assert.equal(ctx.tokens[0].type, TT.NOTE_LETTER);
      assert.equal(ctx.tokens[1].type, TT.OCTAVE);
    });

    it("should parse a pitch with octave down", () => {
      const ctx = createCtx("A,");
      const result = pitch(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 2);
      assert.equal(ctx.tokens[0].type, TT.NOTE_LETTER);
      assert.equal(ctx.tokens[1].type, TT.OCTAVE);
    });

    it("should parse a pitch with accidental", () => {
      const ctx = createCtx("^A");
      const result = pitch(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 2);
      assert.equal(ctx.tokens[0].type, TT.ACCIDENTAL);
      assert.equal(ctx.tokens[1].type, TT.NOTE_LETTER);
    });
  });

  describe("accidental", () => {
    it("should parse a sharp", () => {
      const ctx = createCtx("^");
      const result = accidental(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 1);
      assert.equal(ctx.tokens[0].type, TT.ACCIDENTAL);
      assert.equal(ctx.tokens[0].lexeme, "^");
    });

    it("should parse a double sharp", () => {
      const ctx = createCtx("^^");
      const result = accidental(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 1);
      assert.equal(ctx.tokens[0].type, TT.ACCIDENTAL);
      assert.equal(ctx.tokens[0].lexeme, "^^");
    });

    it("should parse a half sharp", () => {
      const ctx = createCtx("^/");
      const result = accidental(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 1);
      assert.equal(ctx.tokens[0].type, TT.ACCIDENTAL);
      assert.equal(ctx.tokens[0].lexeme, "^/");
    });

    it("should parse a flat", () => {
      const ctx = createCtx("_");
      const result = accidental(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 1);
      assert.equal(ctx.tokens[0].type, TT.ACCIDENTAL);
      assert.equal(ctx.tokens[0].lexeme, "_");
    });

    it("should parse a double flat", () => {
      const ctx = createCtx("__");
      const result = accidental(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 1);
      assert.equal(ctx.tokens[0].type, TT.ACCIDENTAL);
      assert.equal(ctx.tokens[0].lexeme, "__");
    });

    it("should parse a half flat", () => {
      const ctx = createCtx("_/");
      const result = accidental(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 1);
      assert.equal(ctx.tokens[0].type, TT.ACCIDENTAL);
      assert.equal(ctx.tokens[0].lexeme, "_/");
    });

    it("should parse a natural", () => {
      const ctx = createCtx("=");
      const result = accidental(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 1);
      assert.equal(ctx.tokens[0].type, TT.ACCIDENTAL);
      assert.equal(ctx.tokens[0].lexeme, "=");
    });

    it("should return false for non-accidental", () => {
      const ctx = createCtx("A");
      const result = accidental(ctx);
      assert.equal(result, false);
      assert.equal(ctx.tokens.length, 0);
    });

    it("should correctly advance the current position", () => {
      const ctx = createCtx("^A");
      const result = accidental(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 1);
      assert.equal(ctx.tokens[0].type, TT.ACCIDENTAL);
    });

    it("should correctly advance the current position for multi-character accidentals", () => {
      const ctx = createCtx("^^A");
      const result = accidental(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 1);
      assert.equal(ctx.tokens[0].type, TT.ACCIDENTAL);
    });

    it("should work within the context of scanTune for a note with accidental", () => {
      const ctx = createCtx("X:1\n^A");
      scanTune(ctx);
      assert.equal(ctx.tokens.length, 5);
      assert.equal(ctx.tokens[3].type, TT.ACCIDENTAL);
      assert.equal(ctx.tokens[4].type, TT.NOTE_LETTER);
    });
  });

  describe("note", () => {
    it("should parse a simple note", () => {
      const ctx = createCtx("A");
      const result = note(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 1);
      assert.equal(ctx.tokens[0].type, TT.NOTE_LETTER);
    });

    it("should parse two consecutive notes", () => {
      const ctx = createCtx("G2G2");
      const res1 = note(ctx);
      const res2 = note(ctx);
      assert.equal(res1, true);
      assert.equal(res2, true);
      assert.equal(ctx.tokens.length, 4);
      assert.equal(ctx.tokens[0].type, TT.NOTE_LETTER);
      assert.equal(ctx.tokens[0].lexeme, "G");
      assert.equal(ctx.tokens[1].type, TT.RHY_NUMER);
      assert.equal(ctx.tokens[1].lexeme, "2");
      assert.equal(ctx.tokens[2].type, TT.NOTE_LETTER);
      assert.equal(ctx.tokens[2].lexeme, "G");
      assert.equal(ctx.tokens[3].type, TT.RHY_NUMER);
      assert.equal(ctx.tokens[3].lexeme, "2");
    });

    it("should parse a note with accidental", () => {
      const ctx = createCtx("^A");
      const result = note(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 2);
      assert.equal(ctx.tokens[0].type, TT.ACCIDENTAL);
      assert.equal(ctx.tokens[1].type, TT.NOTE_LETTER);
    });

    it("should parse a note with tie", () => {
      const ctx = createCtx("-A-");
      const result = note(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 3);
      assert.equal(ctx.tokens[0].type, TT.TIE);
      assert.equal(ctx.tokens[1].type, TT.NOTE_LETTER);
      assert.equal(ctx.tokens[2].type, TT.TIE);
    });
  });

  describe("rest", () => {
    it("should parse a simple rest", () => {
      const ctx = createCtx("z");
      const result = rest(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 1);
      assert.equal(ctx.tokens[0].type, TT.REST);
    });

    it("should parse a rest with rhythm", () => {
      const ctx = createCtx("z2");
      const result = rest(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 2);
      assert.equal(ctx.tokens[0].type, TT.REST);
      assert.equal(ctx.tokens[1].type, TT.RHY_NUMER);
    });

    it("should parse different rest types", () => {
      const ctx = createCtx("Z");
      const result = rest(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 1);
      assert.equal(ctx.tokens[0].type, TT.REST);
    });

    it("should return false for non-rest", () => {
      const ctx = createCtx("A");
      const result = rest(ctx);
      assert.equal(result, false);
      assert.equal(ctx.tokens.length, 0);
    });
    it("should parse multiple rests in succession", () => {
      const ctx = createCtx("X:1\nzzz");
      scanTune(ctx);
      assert.equal(ctx.tokens.length, 6);
      assert.equal(ctx.tokens[3].type, TT.REST);
      assert.equal(ctx.tokens[4].type, TT.REST);
      assert.equal(ctx.tokens[5].type, TT.REST);
    });
  });

  describe("string", () => {
    it("should parse a simple string", () => {
      const ctx = createCtx('"text"');
      const result = annotation(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 1);
      assert.equal(ctx.tokens[0].type, TT.ANNOTATION);
    });

    it("should parse a string with special characters", () => {
      const ctx = createCtx('"text with spaces and !@#$%^&*()"');
      const result = annotation(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 1);
      assert.equal(ctx.tokens[0].type, TT.ANNOTATION);
    });

    it("should not parse unterminated strings", () => {
      const ctx = createCtx('"unterminated\n');
      const result = annotation(ctx);
      assert.equal(result, false);
    });

    it("should return false for non-string", () => {
      const ctx = createCtx("not a string");
      const result = annotation(ctx);
      assert.equal(result, false);
      assert.equal(ctx.tokens.length, 0);
    });

    it("should parse escaped quotes in annotations", () => {
      // Annotation containing an escaped quote: "D\""
      const ctx = createCtx('"D\\""');
      const result = annotation(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 1);
      assert.equal(ctx.tokens[0].type, TT.ANNOTATION);
      assert.equal(ctx.tokens[0].lexeme, '"D\\""');
    });

    it("should parse multiple escaped characters", () => {
      // Contains escaped quote and escaped backslash
      const ctx = createCtx('"test\\"\\\\"');
      const result = annotation(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens[0].lexeme, '"test\\"\\\\"');
    });
  });

  describe("symbol line", () => {
    it("should parse a simple symbol line", () => {
      const ctx = createCtx("s:hello");
      const result = symbol_line(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 2);
      assert.equal(ctx.tokens[0].type, TT.SY_HDR);
      assert.equal(ctx.tokens[1].type, TT.SY_TXT);
    });
    it("should parse stars as single tokens", () => {
      const ctx = createCtx("s:** * ");
      const result = symbol_line(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 6);
      assert.equal(ctx.tokens[0].type, TT.SY_HDR);
      assert.equal(ctx.tokens[1].type, TT.SY_STAR);
      assert.equal(ctx.tokens[1].lexeme, "*");
      assert.equal(ctx.tokens[2].type, TT.SY_STAR);
      assert.equal(ctx.tokens[2].lexeme, "*");
      assert.equal(ctx.tokens[4].type, TT.SY_STAR);
      assert.equal(ctx.tokens[4].lexeme, "*");
    });
    it("should parse an symbol line with comment", () => {
      const ctx = createCtx("s:Title %comment");
      const result = symbol_line(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens[0].type, TT.SY_HDR);
      assert.equal(ctx.tokens[1].type, TT.SY_TXT);
      assert.equal(ctx.tokens[3].type, TT.COMMENT);
    });

    it("should parse symbol line with stars", () => {
      const ctx = createCtx("s: hello * * ");
      const result = symbol_line(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens[2].type, TT.SY_TXT);
      assert.equal(ctx.tokens[4].type, TT.SY_STAR);
      assert.equal(ctx.tokens[6].type, TT.SY_STAR);
    });

    it("should parse symbol line with stars, text and barlines", () => {
      const ctx = createCtx("s: G * | G");
      const result = symbol_line(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens[2].type, TT.SY_TXT);
      assert.equal(ctx.tokens[4].type, TT.SY_STAR);
      assert.equal(ctx.tokens[6].type, TT.BARLINE);
      assert.equal(ctx.tokens[8].type, TT.SY_TXT);
    });
    it("should parse concatenated tokens in symbol lines", () => {
      const ctx = createCtx("s:t|*|");
      const result = symbol_line(ctx);
      assert.equal(ctx.tokens[1].type, TT.SY_TXT);
      assert.equal(ctx.tokens[2].type, TT.BARLINE);
      assert.equal(ctx.tokens[3].type, TT.SY_STAR);
      assert.equal(ctx.tokens[4].type, TT.BARLINE);
    });
    it("should return false for non-symbol line", () => {
      const ctx = createCtx("Not a symbol line");
      const result = symbol_line(ctx);
      assert.equal(result, false);
      assert.equal(ctx.tokens.length, 0);
    });
  });
  describe("info_line", () => {
    it("should parse a simple info line", () => {
      const ctx = createCtx("T:Title");
      const result = info_line(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 2);
      assert.equal(ctx.tokens[0].type, TT.INF_HDR);
      assert.equal(ctx.tokens[1].type, TT.INFO_STR);
    });

    it("should parse an info line with comment", () => {
      const ctx = createCtx("T:Title %comment");
      const result = info_line(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 3);
      assert.equal(ctx.tokens[0].type, TT.INF_HDR);
      assert.equal(ctx.tokens[1].type, TT.INFO_STR);
      assert.equal(ctx.tokens[2].type, TT.COMMENT);
    });

    it("should return false for non-info line", () => {
      const ctx = createCtx("Not an info line");
      const result = info_line(ctx);
      assert.equal(result, false);
      assert.equal(ctx.tokens.length, 0);
    });
  });

  describe("chord", () => {
    it("should parse a simple chord", () => {
      const ctx = createCtx("[A]");
      const result = chord(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 3);
      assert.equal(ctx.tokens[0].type, TT.CHRD_LEFT_BRKT);
      assert.equal(ctx.tokens[1].type, TT.NOTE_LETTER);
      assert.equal(ctx.tokens[2].type, TT.CHRD_RIGHT_BRKT);
    });

    it("should parse a chord with multiple notes", () => {
      const ctx = createCtx("[ABC]");
      const result = chord(ctx);
      assert.equal(result, true);
      // The exact number of tokens depends on the implementation details
      assert.equal(ctx.tokens[0].type, TT.CHRD_LEFT_BRKT);
      assert.equal(ctx.tokens[ctx.tokens.length - 1].type, TT.CHRD_RIGHT_BRKT);
    });

    it("should parse a chord with string", () => {
      const ctx = createCtx('["text"]');
      const result = chord(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens[0].type, TT.CHRD_LEFT_BRKT);
      // There should be a STRING token in the middle
      assert.equal(ctx.tokens[ctx.tokens.length - 1].type, TT.CHRD_RIGHT_BRKT);
    });

    it("should return false for non-chord", () => {
      const ctx = createCtx("A");
      const result = chord(ctx);
      assert.equal(result, false);
      assert.equal(ctx.tokens.length, 0);
    });
    it("should parse chord with rhythm", () => {
      const ctx = createCtx("[CE^F]4");
      const result = chord(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 7);
      assert.equal(ctx.tokens[0].type, TT.CHRD_LEFT_BRKT);
      assert.equal(ctx.tokens[1].type, TT.NOTE_LETTER);
      assert.equal(ctx.tokens[2].type, TT.NOTE_LETTER);
      assert.equal(ctx.tokens[3].type, TT.ACCIDENTAL);
      assert.equal(ctx.tokens[4].type, TT.NOTE_LETTER);
      assert.equal(ctx.tokens[5].type, TT.CHRD_RIGHT_BRKT);
      assert.equal(ctx.tokens[6].type, TT.RHY_NUMER);
    });

    it("should correctly parse chord with accidental", () => {
      // Arrange
      const input = "[^/a]";
      const ctx = new Ctx(input, new ABCContext());
      const errorReporter = new AbcErrorReporter();
      ctx.errorReporter = errorReporter;

      // Act
      const result = chord(ctx);

      // Assert
      assert.equal(result, true);
      assert.equal(errorReporter.getErrors().length, 0);
      assert.equal(ctx.tokens.length, 4);
      assert.equal(ctx.tokens[0].type, TT.CHRD_LEFT_BRKT);
      assert.equal(ctx.tokens[0].lexeme, "[");
      assert.equal(ctx.tokens[1].type, TT.ACCIDENTAL);
      assert.equal(ctx.tokens[1].lexeme, "^/");
      assert.equal(ctx.tokens[2].type, TT.NOTE_LETTER);
      assert.equal(ctx.tokens[2].lexeme, "a");
      assert.equal(ctx.tokens[3].type, TT.CHRD_RIGHT_BRKT);
      assert.equal(ctx.tokens[3].lexeme, "]");
    });
  });

  describe("grace_grp", () => {
    it("should parse a simple grace group", () => {
      const ctx = createCtx("{A}");
      const result = grace_grp(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 3);
      assert.equal(ctx.tokens[0].type, TT.GRC_GRP_LEFT_BRACE);
      assert.equal(ctx.tokens[1].type, TT.NOTE_LETTER);
      assert.equal(ctx.tokens[2].type, TT.GRC_GRP_RGHT_BRACE);
    });

    it("should parse a grace group with slash", () => {
      const ctx = createCtx("{/A}");
      const result = grace_grp(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 4);
      assert.equal(ctx.tokens[0].type, TT.GRC_GRP_LEFT_BRACE);
      assert.equal(ctx.tokens[1].type, TT.GRC_GRP_SLSH);
      assert.equal(ctx.tokens[2].type, TT.NOTE_LETTER);
      assert.equal(ctx.tokens[3].type, TT.GRC_GRP_RGHT_BRACE);
    });

    it("should parse a grace group with multiple notes", () => {
      const ctx = createCtx("{ABC}");
      const result = grace_grp(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens[0].type, TT.GRC_GRP_LEFT_BRACE);
      assert.equal(ctx.tokens[ctx.tokens.length - 1].type, TT.GRC_GRP_RGHT_BRACE);
    });

    it("should return false for non-grace group", () => {
      const ctx = createCtx("A");
      const result = grace_grp(ctx);
      assert.equal(result, false);
      assert.equal(ctx.tokens.length, 0);
    });

    it("should parse grace notes with rhythm values", () => {
      // Grace notes can have rhythm values like B2, c/, d/
      const ctx = createCtx("{B2c/d/}");
      const result = grace_grp(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens[0].type, TT.GRC_GRP_LEFT_BRACE);
      assert.equal(ctx.tokens[ctx.tokens.length - 1].type, TT.GRC_GRP_RGHT_BRACE);
      // Should have note letters B, c, d with rhythm tokens
      const noteLetters = ctx.tokens.filter((t) => t.type === TT.NOTE_LETTER);
      assert.equal(noteLetters.length, 3);
    });

    it("should parse acciaccatura grace notes with rhythm", () => {
      const ctx = createCtx("{/B2}");
      const result = grace_grp(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens[0].type, TT.GRC_GRP_LEFT_BRACE);
      assert.equal(ctx.tokens[1].type, TT.GRC_GRP_SLSH);
    });
  });

  describe("inline_field", () => {
    it("should parse a simple inline field", () => {
      const ctx = createCtx("[I:text]");
      const result = inline_field(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 4);
      assert.equal(ctx.tokens[0].type, TT.INLN_FLD_LFT_BRKT);
      assert.equal(ctx.tokens[1].type, TT.INF_HDR);
      assert.equal(ctx.tokens[2].type, TT.IDENTIFIER);
      assert.equal(ctx.tokens[3].type, TT.INLN_FLD_RGT_BRKT);
    });

    it("should tokenize inline key change with structured tokens", () => {
      const ctx = createCtx("[K:G]");
      const result = inline_field(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 4);
      assert.equal(ctx.tokens[0].type, TT.INLN_FLD_LFT_BRKT);
      assert.equal(ctx.tokens[1].type, TT.INF_HDR);
      assert.equal(ctx.tokens[2].type, TT.IDENTIFIER);  // G should be IDENTIFIER not INFO_STR
      assert.equal(ctx.tokens[2].lexeme, "G");
      assert.equal(ctx.tokens[3].type, TT.INLN_FLD_RGT_BRKT);
    });

    it("should tokenize inline meter change with structured tokens", () => {
      const ctx = createCtx("[M:3/4]");
      const result = inline_field(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 6);
      assert.equal(ctx.tokens[0].type, TT.INLN_FLD_LFT_BRKT);
      assert.equal(ctx.tokens[1].type, TT.INF_HDR);
      assert.equal(ctx.tokens[2].type, TT.NUMBER);      // 3
      assert.equal(ctx.tokens[2].lexeme, "3");
      assert.equal(ctx.tokens[3].type, TT.SLASH);       // /
      assert.equal(ctx.tokens[4].type, TT.NUMBER);      // 4
      assert.equal(ctx.tokens[4].lexeme, "4");
      assert.equal(ctx.tokens[5].type, TT.INLN_FLD_RGT_BRKT);
    });

    it("should tokenize inline tempo with structured tokens", () => {
      const ctx = createCtx("[Q:1/4=120]");
      const result = inline_field(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 8);
      assert.equal(ctx.tokens[0].type, TT.INLN_FLD_LFT_BRKT);
      assert.equal(ctx.tokens[1].type, TT.INF_HDR);
      assert.equal(ctx.tokens[2].type, TT.NUMBER);      // 1
      assert.equal(ctx.tokens[3].type, TT.SLASH);       // /
      assert.equal(ctx.tokens[4].type, TT.NUMBER);      // 4
      assert.equal(ctx.tokens[5].type, TT.EQL);         // =
      assert.equal(ctx.tokens[6].type, TT.NUMBER);      // 120
      assert.equal(ctx.tokens[7].type, TT.INLN_FLD_RGT_BRKT);
    });

    it("should return false for non-inline field", () => {
      const ctx = createCtx("Not an inline field");
      const result = inline_field(ctx);
      assert.equal(result, false);
      assert.equal(ctx.tokens.length, 0);
    });
  });

  describe("y_spacer", () => {
    it("should parse a simple y-spacer", () => {
      const ctx = createCtx("y");
      const result = y_spacer(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 1);
      assert.equal(ctx.tokens[0].type, TT.Y_SPC);
    });

    it("should parse a y-spacer with rhythm", () => {
      const ctx = createCtx("y2");
      const result = y_spacer(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens[0].type, TT.Y_SPC);
      // The rhythm tokens would be added by the rhythm function
    });

    it("should return false for non-y-spacer", () => {
      const ctx = createCtx("A");
      const result = y_spacer(ctx);
      assert.equal(result, false);
      assert.equal(ctx.tokens.length, 0);
    });
  });

  describe("ampersand", () => {
    it("should parse a simple ampersand", () => {
      const ctx = createCtx("&");
      const result = ampersand(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 1);
      assert.equal(ctx.tokens[0].type, TT.VOICE);
    });

    it("should parse an ampersand with newline", () => {
      const ctx = createCtx("&\n");
      const result = ampersand(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 1);
      assert.equal(ctx.tokens[0].type, TT.VOICE_OVRLAY);
    });

    it("should return false for non-ampersand", () => {
      const ctx = createCtx("A");
      const result = ampersand(ctx);
      assert.equal(result, false);
      assert.equal(ctx.tokens.length, 0);
    });
  });

  describe("line_continuation", () => {
    it("should parse a simple line continuation (backslash + newline)", () => {
      const ctx = createCtx("\\\n");
      const result = line_continuation(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 1);
      assert.equal(ctx.tokens[0].type, TT.LINE_CONT);
      assert.equal(ctx.tokens[0].lexeme, "\\");
    });

    it("should parse line continuation with space", () => {
      const ctx = createCtx("\\ \n");
      const result = line_continuation(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 1);
      assert.equal(ctx.tokens[0].type, TT.LINE_CONT);
      assert.equal(ctx.tokens[0].lexeme, "\\");
    });

    it("should parse line continuation with multiple spaces and tabs", () => {
      const ctx = createCtx("\\  \t \n");
      const result = line_continuation(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 1);
      assert.equal(ctx.tokens[0].type, TT.LINE_CONT);
      assert.equal(ctx.tokens[0].lexeme, "\\");
    });

    it("should parse line continuation with comment", () => {
      const ctx = createCtx("\\%this is a comment\n");
      const result = line_continuation(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 1);
      assert.equal(ctx.tokens[0].type, TT.LINE_CONT);
      assert.equal(ctx.tokens[0].lexeme, "\\");
    });

    it("should parse line continuation with space and comment", () => {
      const ctx = createCtx("\\ %comment here\n");
      const result = line_continuation(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 1);
      assert.equal(ctx.tokens[0].type, TT.LINE_CONT);
      assert.equal(ctx.tokens[0].lexeme, "\\");
    });

    it("should return false for backslash without newline", () => {
      const ctx = createCtx("\\");
      const result = line_continuation(ctx);
      assert.equal(result, false);
      assert.equal(ctx.tokens.length, 0);
    });

    it("should return false for backslash with text but no newline", () => {
      const ctx = createCtx("\\ some text");
      const result = line_continuation(ctx);
      assert.equal(result, false);
      assert.equal(ctx.tokens.length, 0);
    });

    it("should return false for non-backslash", () => {
      const ctx = createCtx("A");
      const result = line_continuation(ctx);
      assert.equal(result, false);
      assert.equal(ctx.tokens.length, 0);
    });
  });

  describe("bcktck_spc", () => {
    it("should parse a backtick", () => {
      const ctx = createCtx("`");
      const result = bcktck_spc(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 1);
      assert.equal(ctx.tokens[0].type, TT.BCKTCK_SPC);
    });

    it("should return false for non-backtick", () => {
      const ctx = createCtx("A");
      const result = bcktck_spc(ctx);
      assert.equal(result, false);
      assert.equal(ctx.tokens.length, 0);
    });
  });

  describe("slur", () => {
    it("should parse an opening parenthesis", () => {
      const ctx = createCtx("(");
      const result = slur(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 1);
      assert.equal(ctx.tokens[0].type, TT.SLUR);
    });

    it("should parse a closing parenthesis", () => {
      const ctx = createCtx(")");
      const result = slur(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 1);
      assert.equal(ctx.tokens[0].type, TT.SLUR);
    });

    it("should return false for non-parenthesis", () => {
      const ctx = createCtx("A");
      const result = slur(ctx);
      assert.equal(result, false);
      assert.equal(ctx.tokens.length, 0);
    });
  });

  describe("tuplet", () => {
    it("should parse a simple tuplet", () => {
      const ctx = createCtx("(3");
      const result = tuplet(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 2);
      assert.equal(ctx.tokens[0].type, TT.TUPLET_LPAREN);
      assert.equal(ctx.tokens[1].type, TT.TUPLET_P);
    });

    it("should parse a tuplet with a larger number", () => {
      const ctx = createCtx("(5");
      const result = tuplet(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 2);
      assert.equal(ctx.tokens[0].type, TT.TUPLET_LPAREN);
      assert.equal(ctx.tokens[1].type, TT.TUPLET_P);
    });

    it("should parse a tuplet with p:q notation", () => {
      const ctx = createCtx("(3:2");
      const result = tuplet(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 4);
      assert.equal(ctx.tokens[0].type, TT.TUPLET_LPAREN);
      assert.equal(ctx.tokens[1].type, TT.TUPLET_P);
      assert.equal(ctx.tokens[2].type, TT.TUPLET_COLON);
      assert.equal(ctx.tokens[3].type, TT.TUPLET_Q);
    });

    it("should parse a tuplet with p:q:r notation", () => {
      const ctx = createCtx("(3:2:3");
      const result = tuplet(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 6);
      assert.equal(ctx.tokens[0].type, TT.TUPLET_LPAREN);
      assert.equal(ctx.tokens[1].type, TT.TUPLET_P);
      assert.equal(ctx.tokens[2].type, TT.TUPLET_COLON);
      assert.equal(ctx.tokens[3].type, TT.TUPLET_Q);
      assert.equal(ctx.tokens[4].type, TT.TUPLET_COLON);
      assert.equal(ctx.tokens[5].type, TT.TUPLET_R);
    });

    it("should parse a tuplet with missing q value", () => {
      const ctx = createCtx("(3:");
      const result = tuplet(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 3);
      assert.equal(ctx.tokens[0].type, TT.TUPLET_LPAREN);
      assert.equal(ctx.tokens[1].type, TT.TUPLET_P);
      assert.equal(ctx.tokens[2].type, TT.TUPLET_COLON);
    });

    it("should parse a tuplet with missing r value", () => {
      const ctx = createCtx("(3:2:");
      const result = tuplet(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 5);
      assert.equal(ctx.tokens[0].type, TT.TUPLET_LPAREN);
      assert.equal(ctx.tokens[1].type, TT.TUPLET_P);
      assert.equal(ctx.tokens[2].type, TT.TUPLET_COLON);
      assert.equal(ctx.tokens[3].type, TT.TUPLET_Q);
      assert.equal(ctx.tokens[4].type, TT.TUPLET_COLON);
    });

    it("should parse a tuplet with both q and r missing", () => {
      const ctx = createCtx("(3::");
      const result = tuplet(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 4);
      assert.equal(ctx.tokens[0].type, TT.TUPLET_LPAREN);
      assert.equal(ctx.tokens[1].type, TT.TUPLET_P);
      assert.equal(ctx.tokens[2].type, TT.TUPLET_COLON);
      assert.equal(ctx.tokens[3].type, TT.TUPLET_COLON);
    });

    it("should parse a complex tuplet example", () => {
      const ctx = createCtx("(5:4:6");
      const result = tuplet(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 6);
      assert.equal(ctx.tokens[0].type, TT.TUPLET_LPAREN);
      assert.equal(ctx.tokens[1].type, TT.TUPLET_P);
      assert.equal(ctx.tokens[2].type, TT.TUPLET_COLON);
      assert.equal(ctx.tokens[3].type, TT.TUPLET_Q);
      assert.equal(ctx.tokens[4].type, TT.TUPLET_COLON);
      assert.equal(ctx.tokens[5].type, TT.TUPLET_R);
    });

    it("should return false for non-tuplet", () => {
      const ctx = createCtx("(A");
      const result = tuplet(ctx);
      assert.equal(result, false);
      assert.equal(ctx.tokens.length, 0);
    });
  });

  describe("barline", () => {
    it("should parse a simple barline", () => {
      const ctx = createCtx("|");
      const result = barline(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 1);
      assert.equal(ctx.tokens[0].type, TT.BARLINE);
    });

    it("should parse a double barline", () => {
      const ctx = createCtx("||");
      const result = barline(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 1);
      assert.equal(ctx.tokens[0].type, TT.BARLINE);
    });

    it("should parse a left repeat barline", () => {
      const ctx = createCtx("[|");
      const result = barline(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 1);
      assert.equal(ctx.tokens[0].type, TT.BARLINE);
    });

    it("should parse a right repeat barline", () => {
      const ctx = createCtx("|]");
      const result = barline(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 1);
      assert.equal(ctx.tokens[0].type, TT.BARLINE);
    });

    it("should return false for non-barline", () => {
      const ctx = createCtx("A");
      const result = barline(ctx);
      assert.equal(result, false);
      assert.equal(ctx.tokens.length, 0);
    });
  });
});
