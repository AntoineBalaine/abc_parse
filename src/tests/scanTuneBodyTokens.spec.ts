import assert from "assert";
import { describe, it } from "mocha";
import { Ctx, Token, TT, advance, stylesheet_directive, info_line } from "../parsers/scan2";
import {
  comment,
  decoration,
  symbol,
  rhythm,
  pitch,
  accidental,
  note,
  rest,
  chord,
  grace_grp,
  inline_field,
  annotation,
  y_spacer,
  tuplet,
  barline,
  ampersand,
  bcktck_spc,
  slur,
  scanTune,
} from "../parsers/scan_tunebody";
import { AbcErrorReporter } from "../parsers/ErrorReporter";

// Helper function to create a Ctx object for testing
export function createCtx(source: string): Ctx {
  return new Ctx(source, new AbcErrorReporter());
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
    it("should parse a single decoration followed by a pitch", () => {
      const ctx = createCtx(".A");
      const result = decoration(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 1);
      assert.equal(ctx.tokens[0].type, TT.DECORATION);
      assert.equal(ctx.tokens[0].lexeme, ".");
      // Verify that the pitch is not included in the match
      assert.equal(ctx.current, 1); // Only the '.' should be consumed
    });

    it("should parse multiple decoration characters followed by a pitch", () => {
      const ctx = createCtx("~.HA");
      const result = decoration(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 1);
      assert.equal(ctx.tokens[0].type, TT.DECORATION);
      assert.equal(ctx.tokens[0].lexeme, "~.H");
      // Verify that the pitch is not included in the match
      assert.equal(ctx.current, 3); // Only '~.H' should be consumed
    });

    it("should parse a decoration followed by a rest", () => {
      const ctx = createCtx(".z");
      const result = decoration(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 1);
      assert.equal(ctx.tokens[0].type, TT.DECORATION);
      assert.equal(ctx.tokens[0].lexeme, ".");
      // Verify that the rest is not included in the match
      assert.equal(ctx.current, 1); // Only the '.' should be consumed
    });

    it("should parse multiple decorations followed by a rest", () => {
      const ctx = createCtx("~.z");
      const result = decoration(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 1);
      assert.equal(ctx.tokens[0].type, TT.DECORATION);
      assert.equal(ctx.tokens[0].lexeme, "~.");
      // Verify that the rest is not included in the match
      assert.equal(ctx.current, 2); // Only '~.' should be consumed
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
      const ctx = createCtx(".A");
      scanTune(ctx);
      assert.equal(ctx.tokens.length, 2);
      assert.equal(ctx.tokens[0].type, TT.DECORATION);
      assert.equal(ctx.tokens[1].type, TT.NOTE_LETTER);
    });

    it("should work with scanTune for a decoration followed by a rest", () => {
      const ctx = createCtx(".z");
      scanTune(ctx);
      assert.equal(ctx.tokens.length, 2);
      assert.equal(ctx.tokens[0].type, TT.DECORATION);
      assert.equal(ctx.tokens[1].type, TT.REST);
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
      assert.equal(ctx.current, 1); // Should have advanced by 1 character
      assert.equal(ctx.tokens.length, 1);
      assert.equal(ctx.tokens[0].type, TT.ACCIDENTAL);
    });

    it("should correctly advance the current position for multi-character accidentals", () => {
      const ctx = createCtx("^^A");
      const result = accidental(ctx);
      assert.equal(result, true);
      assert.equal(ctx.current, 2); // Should have advanced by 2 characters
      assert.equal(ctx.tokens.length, 1);
      assert.equal(ctx.tokens[0].type, TT.ACCIDENTAL);
    });

    it("should work within the context of scanTune for a note with accidental", () => {
      const ctx = createCtx("^A");
      scanTune(ctx);
      assert.equal(ctx.tokens.length, 2);
      assert.equal(ctx.tokens[0].type, TT.ACCIDENTAL);
      assert.equal(ctx.tokens[1].type, TT.NOTE_LETTER);
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
      const ctx = createCtx("zzz");
      scanTune(ctx);
      assert.equal(ctx.tokens.length, 3);
      assert.equal(ctx.tokens[0].type, TT.REST);
      assert.equal(ctx.tokens[1].type, TT.REST);
      assert.equal(ctx.tokens[2].type, TT.REST);
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
  });

  describe("inline_field", () => {
    it("should parse a simple inline field", () => {
      const ctx = createCtx("[I:text]");
      const result = inline_field(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 4);
      assert.equal(ctx.tokens[0].type, TT.INLN_FLD_LFT_BRKT);
      assert.equal(ctx.tokens[1].type, TT.INF_HDR);
      assert.equal(ctx.tokens[2].type, TT.INF_TXT);
      assert.equal(ctx.tokens[3].type, TT.INLN_FLD_RGT_BRKT);
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
      assert.equal(ctx.tokens.length, 1);
      assert.equal(ctx.tokens[0].type, TT.TUPLET);
    });

    it("should parse a tuplet with a larger number", () => {
      const ctx = createCtx("(5");
      const result = tuplet(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 1);
      assert.equal(ctx.tokens[0].type, TT.TUPLET);
    });

    it("should parse a tuplet with p:q notation", () => {
      const ctx = createCtx("(3:2");
      const result = tuplet(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 1);
      assert.equal(ctx.tokens[0].type, TT.TUPLET);
      // Verify the token lexeme contains the full tuplet notation
      assert.equal(ctx.tokens[0].lexeme, "(3:2");
    });

    it("should parse a tuplet with p:q:r notation", () => {
      const ctx = createCtx("(3:2:3");
      const result = tuplet(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 1);
      assert.equal(ctx.tokens[0].type, TT.TUPLET);
      // Verify the token lexeme contains the full tuplet notation
      assert.equal(ctx.tokens[0].lexeme, "(3:2:3");
    });

    it("should parse a tuplet with missing q value", () => {
      const ctx = createCtx("(3:");
      const result = tuplet(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 1);
      assert.equal(ctx.tokens[0].type, TT.TUPLET);
      // Verify the token lexeme contains the tuplet notation
      assert.equal(ctx.tokens[0].lexeme, "(3:");
    });

    it("should parse a tuplet with missing r value", () => {
      const ctx = createCtx("(3:2:");
      const result = tuplet(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 1);
      assert.equal(ctx.tokens[0].type, TT.TUPLET);
      // Verify the token lexeme contains the tuplet notation
      assert.equal(ctx.tokens[0].lexeme, "(3:2:");
    });

    it("should parse a tuplet with both q and r missing", () => {
      const ctx = createCtx("(3::");
      const result = tuplet(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 1);
      assert.equal(ctx.tokens[0].type, TT.TUPLET);
      // Verify the token lexeme contains the tuplet notation
      assert.equal(ctx.tokens[0].lexeme, "(3::");
    });

    it("should parse a complex tuplet example", () => {
      const ctx = createCtx("(5:4:6");
      const result = tuplet(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 1);
      assert.equal(ctx.tokens[0].type, TT.TUPLET);
      // Verify the token lexeme contains the full tuplet notation
      assert.equal(ctx.tokens[0].lexeme, "(5:4:6");
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
