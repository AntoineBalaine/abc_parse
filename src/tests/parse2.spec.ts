import { assert } from "chai";
import { describe, it } from "mocha";
import { ABCContext } from "../parsers/Context";
import {
  parseAnnotation,
  parseBarline,
  parseChord,
  ParseCtx,
  parseDecoration,
  parseGraceGroup,
  parseMusicCode,
  parseNote,
  parsePitch,
  parseRepeatNumbers,
  parseRest,
  parseRhythm,
  parseSymbol,
  parseTuplet,
  parseYSpacer,
  prcssBms,
  prsBody,
  prsTuneHdr,
} from "../parsers/parse2";
import { Token, TT } from "../parsers/scan2";
import {
  Annotation,
  BarLine,
  Beam,
  Chord,
  Comment,
  Decoration,
  Directive,
  Grace_group,
  Info_line,
  MultiMeasureRest,
  Note,
  Pitch,
  Rest,
  Rhythm,
  Symbol,
  Tune_Body,
  Tune_header,
  Tuplet,
  YSPACER,
} from "../types/Expr2";

// Helper function to create a token with the given type and lexeme
export function createToken(type: TT, lexeme: string, line: number = 0, position: number = 0): Token {
  const ctx = new ABCContext();
  const token = new Token(
    type,
    {
      source: "",
      tokens: [],
      start: 0,
      current: lexeme.length,
      line,
      report: () => { },
      push: () => { },
      test: () => false,
      abcContext: ctx,
    },
    ctx.generateId()
  );

  // Override the lexeme property
  Object.defineProperty(token, "lexeme", {
    value: lexeme,
    writable: false,
  });

  // Override the position property
  Object.defineProperty(token, "position", {
    value: position,
    writable: false,
  });

  return token;
}

// Helper function to create a ParseCtx with the given tokens
function createParseCtx(tokens: Token[]): ParseCtx {
  return new ParseCtx(tokens, new ABCContext());
}

describe("parse2.ts", () => {
  describe("parseBarline", () => {
    it("should parse a simple barline", () => {
      const tokens = [createToken(TT.BARLINE, "|")];
      const ctx = createParseCtx(tokens);

      const result = parseBarline(ctx);

      assert.isNotNull(result);
      assert.instanceOf(result, BarLine);
      assert.equal(result?.barline[0].lexeme, "|");
      assert.isUndefined(result?.repeatNumbers);
    });

    it("should parse a double barline", () => {
      const tokens = [createToken(TT.BARLINE, "||")];
      const ctx = createParseCtx(tokens);

      const result = parseBarline(ctx);

      assert.isNotNull(result);
      assert.instanceOf(result, BarLine);
      assert.equal(result?.barline[0].lexeme, "||");
      assert.isUndefined(result?.repeatNumbers);
    });

    it("should parse a repeat start barline", () => {
      const tokens = [createToken(TT.BARLINE, "|:")];
      const ctx = createParseCtx(tokens);

      const result = parseBarline(ctx);

      assert.isNotNull(result);
      assert.instanceOf(result, BarLine);
      assert.equal(result?.barline[0].lexeme, "|:");
      assert.isUndefined(result?.repeatNumbers);
    });

    it("should parse a repeat end barline", () => {
      const tokens = [createToken(TT.BARLINE, ":|")];
      const ctx = createParseCtx(tokens);

      const result = parseBarline(ctx);

      assert.isNotNull(result);
      assert.instanceOf(result, BarLine);
      assert.equal(result?.barline[0].lexeme, ":|");
      assert.isUndefined(result?.repeatNumbers);
    });

    it("should parse a barline with repeat numbers", () => {
      const tokens = [createToken(TT.BARLINE, "|"), createToken(TT.REPEAT_NUMBER, "1")];
      const ctx = createParseCtx(tokens);

      const result = parseBarline(ctx);

      assert.isNotNull(result);
      assert.instanceOf(result, BarLine);
      assert.equal(result?.barline[0].lexeme, "|");
      assert.isDefined(result?.repeatNumbers);
      assert.equal(result?.repeatNumbers?.[0].lexeme, "1");
    });

    it("should parse a barline with multiple repeat numbers", () => {
      const tokens = [
        createToken(TT.BARLINE, "|"),
        createToken(TT.REPEAT_NUMBER, "1"),
        createToken(TT.REPEAT_COMMA, ","),
        createToken(TT.REPEAT_NUMBER, "2"),
      ];
      const ctx = createParseCtx(tokens);

      const result = parseBarline(ctx);

      assert.isNotNull(result);
      assert.instanceOf(result, BarLine);
      assert.equal(result?.barline[0].lexeme, "|");
      assert.isDefined(result?.repeatNumbers);
      assert.equal(result?.repeatNumbers?.length, 3);
      assert.equal(result?.repeatNumbers?.[0].lexeme, "1");
      assert.equal(result?.repeatNumbers?.[1].lexeme, ",");
      assert.equal(result?.repeatNumbers?.[2].lexeme, "2");
    });

    it("should return null for non-barline tokens", () => {
      const tokens = [createToken(TT.NOTE_LETTER, "C")];
      const ctx = createParseCtx(tokens);

      const result = parseBarline(ctx);

      assert.isNull(result);
      assert.equal(ctx.current, 0); // Should not advance the current position
    });
  });

  describe("parseNote", () => {
    it("should parse a simple note", () => {
      const tokens = [createToken(TT.NOTE_LETTER, "C")];
      const ctx = createParseCtx(tokens);

      const result = parseNote(ctx);

      assert.isNotNull(result);
      assert.instanceOf(result, Note);
      assert.instanceOf(result?.pitch, Pitch);
      assert.equal((result?.pitch as Pitch).noteLetter.lexeme, "C");
      assert.isUndefined(result?.rhythm);
      assert.isUndefined(result?.tie);
    });

    it("should parse a note with an accidental", () => {
      const tokens = [createToken(TT.ACCIDENTAL, "^"), createToken(TT.NOTE_LETTER, "C")];
      const ctx = createParseCtx(tokens);

      const result = parseNote(ctx);

      assert.isNotNull(result);
      assert.instanceOf(result, Note);
      assert.instanceOf(result?.pitch, Pitch);
      assert.equal((result?.pitch as Pitch).noteLetter.lexeme, "C");
      assert.equal((result?.pitch as Pitch).alteration?.lexeme, "^");
      assert.isUndefined(result?.rhythm);
      assert.isUndefined(result?.tie);
    });

    it("should parse a note with an octave", () => {
      const tokens = [createToken(TT.NOTE_LETTER, "C"), createToken(TT.OCTAVE, "'")];
      const ctx = createParseCtx(tokens);

      const result = parseNote(ctx);

      assert.isNotNull(result);
      assert.instanceOf(result, Note);
      assert.instanceOf(result?.pitch, Pitch);
      assert.equal((result?.pitch as Pitch).noteLetter.lexeme, "C");
      assert.equal((result?.pitch as Pitch).octave?.lexeme, "'");
      assert.isUndefined(result?.rhythm);
      assert.isUndefined(result?.tie);
    });

    it("should parse a note with a rhythm", () => {
      const tokens = [createToken(TT.NOTE_LETTER, "C"), createToken(TT.RHY_NUMER, "2")];
      const ctx = createParseCtx(tokens);

      const result = parseNote(ctx);

      assert.isNotNull(result);
      assert.instanceOf(result, Note);
      assert.instanceOf(result?.pitch, Pitch);
      assert.equal((result?.pitch as Pitch).noteLetter.lexeme, "C");
      assert.instanceOf(result?.rhythm, Rhythm);
      assert.equal(result?.rhythm?.numerator?.lexeme, "2");
      assert.isUndefined(result?.tie);
    });

    it("should parse a note with a tie", () => {
      const tokens = [createToken(TT.NOTE_LETTER, "C"), createToken(TT.TIE, "-")];
      const ctx = createParseCtx(tokens);

      const result = parseNote(ctx);

      assert.isNotNull(result);
      assert.instanceOf(result, Note);
      assert.instanceOf(result?.pitch, Pitch);
      assert.equal((result?.pitch as Pitch).noteLetter.lexeme, "C");
      assert.isUndefined(result?.rhythm);
      assert.isDefined(result?.tie);
      assert.equal(result?.tie?.lexeme, "-");
    });

    it("should parse a note with a tie at the start", () => {
      const tokens = [createToken(TT.TIE, "-"), createToken(TT.NOTE_LETTER, "C")];
      const ctx = createParseCtx(tokens);

      const result = parseNote(ctx);

      assert.isNotNull(result);
      assert.instanceOf(result, Note);
      assert.instanceOf(result?.pitch, Pitch);
      assert.equal((result?.pitch as Pitch).noteLetter.lexeme, "C");
      assert.isUndefined(result?.rhythm);
      assert.isDefined(result?.tie);
      assert.equal(result?.tie?.lexeme, "-");
    });

    it("should parse a complex note with accidental, octave, rhythm, and tie", () => {
      const tokens = [
        createToken(TT.ACCIDENTAL, "^"),
        createToken(TT.NOTE_LETTER, "C"),
        createToken(TT.OCTAVE, "'"),
        createToken(TT.RHY_NUMER, "2"),
        createToken(TT.TIE, "-"),
      ];
      const ctx = createParseCtx(tokens);

      const result = parseNote(ctx);

      assert.isNotNull(result);
      assert.instanceOf(result, Note);
      assert.instanceOf(result?.pitch, Pitch);
      assert.equal((result?.pitch as Pitch).noteLetter.lexeme, "C");
      assert.equal((result?.pitch as Pitch).alteration?.lexeme, "^");
      assert.equal((result?.pitch as Pitch).octave?.lexeme, "'");
      assert.instanceOf(result?.rhythm, Rhythm);
      assert.equal(result?.rhythm?.numerator?.lexeme, "2");
      assert.isDefined(result?.tie);
      assert.equal(result?.tie?.lexeme, "-");
    });

    it("should return null for non-note tokens", () => {
      const tokens = [createToken(TT.BARLINE, "|")];
      const ctx = createParseCtx(tokens);

      const result = parseNote(ctx);

      assert.isNull(result);
      assert.equal(ctx.current, 0); // Should not advance the current position
    });

    it("should rewind if a tie is found but no pitch follows", () => {
      const tokens = [createToken(TT.TIE, "-"), createToken(TT.BARLINE, "|")];
      const ctx = createParseCtx(tokens);

      const result = parseNote(ctx);

      assert.isNull(result);
      assert.equal(ctx.current, 0); // Should rewind to the start
    });
  });

  describe("parseRest", () => {
    it("should parse a simple rest", () => {
      const tokens = [createToken(TT.REST, "z")];
      const ctx = createParseCtx(tokens);

      const result = parseRest(ctx);

      assert.isNotNull(result);
      assert.instanceOf(result, Rest);
      assert.equal(result?.rest.lexeme, "z");
    });

    it("should parse a rest with rhythm", () => {
      const tokens = [createToken(TT.REST, "z"), createToken(TT.RHY_NUMER, "2")];
      const ctx = createParseCtx(tokens);

      const result = parseRest(ctx);

      assert.isNotNull(result);
      assert.instanceOf(result, Rest);
      assert.equal(result?.rest.lexeme, "z");
      assert.instanceOf(result?.rhythm, Rhythm);
      assert.equal(result?.rhythm?.numerator?.lexeme, "2");
    });

    it("should parse a multi-measure rest (uppercase Z)", () => {
      const tokens = [createToken(TT.REST, "Z"), createToken(TT.RHY_NUMER, "4")];
      const ctx = createParseCtx(tokens);

      const result = parseRest(ctx);

      assert.isNotNull(result);
      assert.instanceOf(result, MultiMeasureRest);
      assert.equal(result?.rest.lexeme, "Z");
      assert.isDefined(result?.length);
      assert.equal(result?.length?.lexeme, "4");
    });

    it("should parse an invisible multi-measure rest (uppercase X)", () => {
      const tokens = [createToken(TT.REST, "X"), createToken(TT.RHY_NUMER, "4")];
      const ctx = createParseCtx(tokens);

      const result = parseRest(ctx);

      assert.isNotNull(result);
      assert.instanceOf(result, MultiMeasureRest);
      assert.equal(result?.rest.lexeme, "X");
      assert.isDefined(result?.length);
      assert.equal(result?.length?.lexeme, "4");
    });

    it("should parse a multi-measure rest without length", () => {
      const tokens = [createToken(TT.REST, "Z")];
      const ctx = createParseCtx(tokens);

      const result = parseRest(ctx);

      assert.isNotNull(result);
      assert.instanceOf(result, MultiMeasureRest);
      assert.equal(result?.rest.lexeme, "Z");
      assert.isUndefined(result?.length);
    });

    it("should parse a multi-measure rest with length", () => {
      const tokens = [createToken(TT.REST, "Z"), createToken(TT.RHY_NUMER, "2")];
      const ctx = createParseCtx(tokens);

      const result = parseRest(ctx);

      assert.isNotNull(result);
      assert.instanceOf(result, MultiMeasureRest);
      assert.equal(result?.rest.lexeme, "Z");
      assert.isDefined(result?.length);
      assert.equal(result?.length.lexeme, "2");
    });

    it("should report an error for multi-measure rest with complex rhythm", () => {
      const tokens = [createToken(TT.REST, "Z"), createToken(TT.RHY_NUMER, "3"), createToken(TT.RHY_SEP, "/"), createToken(TT.RHY_DENOM, "2")];
      const ctx = createParseCtx(tokens);

      const result = parseRest(ctx);

      assert.isNotNull(result);
      assert.instanceOf(result, MultiMeasureRest);
      assert.equal(result?.rest.lexeme, "Z");
      assert.isDefined(result?.length);
      assert.equal(result?.length?.lexeme, "3");
    });

    it("should return null for non-rest tokens", () => {
      const tokens = [createToken(TT.NOTE_LETTER, "C")];
      const ctx = createParseCtx(tokens);

      const result = parseRest(ctx);

      assert.isNull(result);
      assert.equal(ctx.current, 0); // Should not advance the current position
    });
  });

  describe("parseChord", () => {
    it("should parse a simple chord with one note", () => {
      const tokens = [createToken(TT.CHRD_LEFT_BRKT, "["), createToken(TT.NOTE_LETTER, "C"), createToken(TT.CHRD_RIGHT_BRKT, "]")];
      const ctx = createParseCtx(tokens);

      const result = parseChord(ctx);

      assert.isNotNull(result);
      assert.instanceOf(result, Chord);
      assert.equal(result?.contents.length, 1);
      assert.instanceOf(result?.contents[0], Note);
      assert.isUndefined(result?.rhythm);
      assert.isUndefined(result?.tie);
    });

    it("should parse a chord with multiple notes", () => {
      const tokens = [
        createToken(TT.CHRD_LEFT_BRKT, "["),
        createToken(TT.NOTE_LETTER, "C"),
        createToken(TT.NOTE_LETTER, "E"),
        createToken(TT.NOTE_LETTER, "G"),
        createToken(TT.CHRD_RIGHT_BRKT, "]"),
      ];
      const ctx = createParseCtx(tokens);

      const result = parseChord(ctx);

      assert.isNotNull(result);
      assert.instanceOf(result, Chord);
      assert.equal(result?.contents.length, 3);
      assert.instanceOf(result?.contents[0], Note);
      assert.instanceOf(result?.contents[1], Note);
      assert.instanceOf(result?.contents[2], Note);
      assert.isUndefined(result?.rhythm);
      assert.isUndefined(result?.tie);
    });

    it("should parse a chord with an annotation", () => {
      const tokens = [
        createToken(TT.CHRD_LEFT_BRKT, "["),
        createToken(TT.ANNOTATION, '"C"'),
        createToken(TT.NOTE_LETTER, "C"),
        createToken(TT.CHRD_RIGHT_BRKT, "]"),
      ];
      const ctx = createParseCtx(tokens);

      const result = parseChord(ctx);

      assert.isNotNull(result);
      assert.instanceOf(result, Chord);
      assert.equal(result?.contents.length, 2);
      assert.instanceOf(result?.contents[0], Annotation);
      assert.instanceOf(result?.contents[1], Note);
      assert.isUndefined(result?.rhythm);
      assert.isUndefined(result?.tie);
    });

    it("should parse a chord with a rhythm", () => {
      const tokens = [
        createToken(TT.CHRD_LEFT_BRKT, "["),
        createToken(TT.NOTE_LETTER, "C"),
        createToken(TT.CHRD_RIGHT_BRKT, "]"),
        createToken(TT.RHY_NUMER, "2"),
      ];
      const ctx = createParseCtx(tokens);

      const result = parseChord(ctx);

      assert.isNotNull(result);
      assert.instanceOf(result, Chord);
      assert.equal(result?.contents.length, 1);
      assert.instanceOf(result?.contents[0], Note);
      assert.instanceOf(result?.rhythm, Rhythm);
      assert.equal(result?.rhythm?.numerator?.lexeme, "2");
      assert.isUndefined(result?.tie);
    });

    it("should parse a chord with a tie", () => {
      const tokens = [
        createToken(TT.CHRD_LEFT_BRKT, "["),
        createToken(TT.NOTE_LETTER, "C"),
        createToken(TT.CHRD_RIGHT_BRKT, "]"),
        createToken(TT.TIE, "-"),
      ];
      const ctx = createParseCtx(tokens);

      const result = parseChord(ctx);

      assert.isNotNull(result);
      assert.instanceOf(result, Chord);
      assert.equal(result?.contents.length, 1);
      assert.instanceOf(result?.contents[0], Note);
      assert.isUndefined(result?.rhythm);
      assert.isDefined(result?.tie);
      assert.equal(result?.tie?.lexeme, "-");
    });

    it("should parse a complex chord with multiple notes, rhythm, and tie", () => {
      const tokens = [
        createToken(TT.CHRD_LEFT_BRKT, "["),
        createToken(TT.NOTE_LETTER, "C"),
        createToken(TT.NOTE_LETTER, "E"),
        createToken(TT.NOTE_LETTER, "G"),
        createToken(TT.CHRD_RIGHT_BRKT, "]"),
        createToken(TT.RHY_NUMER, "2"),
        createToken(TT.TIE, "-"),
      ];
      const ctx = createParseCtx(tokens);

      const result = parseChord(ctx);

      assert.isNotNull(result);
      assert.instanceOf(result, Chord);
      assert.equal(result?.contents.length, 3);
      assert.instanceOf(result?.contents[0], Note);
      assert.instanceOf(result?.contents[1], Note);
      assert.instanceOf(result?.contents[2], Note);
      assert.instanceOf(result?.rhythm, Rhythm);
      assert.equal(result?.rhythm?.numerator?.lexeme, "2");
      assert.isDefined(result?.tie);
      assert.equal(result?.tie?.lexeme, "-");
    });

    it("should return null for non-chord tokens", () => {
      const tokens = [createToken(TT.NOTE_LETTER, "C")];
      const ctx = createParseCtx(tokens);

      const result = parseChord(ctx);

      assert.isNull(result);
      assert.equal(ctx.current, 0); // Should not advance the current position
    });

    it("should handle unterminated chords", () => {
      const tokens = [createToken(TT.CHRD_LEFT_BRKT, "["), createToken(TT.NOTE_LETTER, "C")];
      const ctx = createParseCtx(tokens);

      const result = parseChord(ctx);

      assert.isNotNull(result);
      assert.instanceOf(result, Chord);
      assert.equal(result?.contents.length, 1);
      assert.instanceOf(result?.contents[0], Note);
      assert.isUndefined(result?.rhythm);
      assert.isUndefined(result?.tie);
    });

    it("should parse a chord with accidental [^aa]", () => {
      // Create tokens for [^aa]
      const tokens = [
        createToken(TT.CHRD_LEFT_BRKT, "["),
        createToken(TT.ACCIDENTAL, "^"),
        createToken(TT.NOTE_LETTER, "a"),
        createToken(TT.NOTE_LETTER, "a"),
        createToken(TT.CHRD_RIGHT_BRKT, "]"),
        createToken(TT.EOL, "\n"),
      ];
      const ctx = createParseCtx(tokens);

      const result = parseChord(ctx);

      // Verify the result
      assert.isNotNull(result);
      assert.instanceOf(result, Chord);
      assert.equal(result?.contents.length, 2);

      // First note should have an accidental
      assert.instanceOf(result?.contents[0], Note);
      assert.instanceOf((result?.contents[0] as Note).pitch, Pitch);
      assert.equal(((result?.contents[0] as Note).pitch as Pitch).noteLetter.lexeme, "a");
      assert.equal(((result?.contents[0] as Note).pitch as Pitch).alteration?.lexeme, "^");

      // Second note should not have an accidental
      assert.instanceOf(result?.contents[1], Note);
      assert.instanceOf((result?.contents[1] as Note).pitch, Pitch);
      assert.equal(((result?.contents[1] as Note).pitch as Pitch).noteLetter.lexeme, "a");
      assert.isUndefined(((result?.contents[1] as Note).pitch as Pitch).alteration);
    });
  });

  describe("parseGraceGroup", () => {
    it("should parse a simple grace group with one note", () => {
      const tokens = [createToken(TT.GRC_GRP_LEFT_BRACE, "{"), createToken(TT.NOTE_LETTER, "g"), createToken(TT.GRC_GRP_RGHT_BRACE, "}")];
      const ctx = createParseCtx(tokens);

      const result = parseGraceGroup(ctx);

      assert.isNotNull(result);
      assert.instanceOf(result, Grace_group);
      assert.equal(result?.notes.length, 1);
      assert.instanceOf(result?.notes[0], Note);
      assert.isFalse(result?.isAccacciatura);
    });

    it("should parse a grace group with multiple notes", () => {
      const tokens = [
        createToken(TT.GRC_GRP_LEFT_BRACE, "{"),
        createToken(TT.NOTE_LETTER, "g"),
        createToken(TT.NOTE_LETTER, "a"),
        createToken(TT.NOTE_LETTER, "b"),
        createToken(TT.GRC_GRP_RGHT_BRACE, "}"),
      ];
      const ctx = createParseCtx(tokens);

      const result = parseGraceGroup(ctx);

      assert.isNotNull(result);
      assert.instanceOf(result, Grace_group);
      assert.equal(result?.notes.length, 3);
      assert.instanceOf(result?.notes[0], Note);
      assert.instanceOf(result?.notes[1], Note);
      assert.instanceOf(result?.notes[2], Note);
      assert.isFalse(result?.isAccacciatura);
    });

    it("should parse an accacciatura", () => {
      const tokens = [
        createToken(TT.GRC_GRP_LEFT_BRACE, "{"),
        createToken(TT.GRC_GRP_SLSH, "/"),
        createToken(TT.NOTE_LETTER, "g"),
        createToken(TT.GRC_GRP_RGHT_BRACE, "}"),
      ];
      const ctx = createParseCtx(tokens);

      const result = parseGraceGroup(ctx);

      assert.isNotNull(result);
      assert.instanceOf(result, Grace_group);
      assert.equal(result?.notes.length, 1);
      assert.instanceOf(result?.notes[0], Note);
      assert.isTrue(result?.isAccacciatura);
    });

    it("should handle whitespace in grace groups", () => {
      const tokens = [
        createToken(TT.GRC_GRP_LEFT_BRACE, "{"),
        createToken(TT.NOTE_LETTER, "g"),
        createToken(TT.WS, " "),
        createToken(TT.NOTE_LETTER, "a"),
        createToken(TT.GRC_GRP_RGHT_BRACE, "}"),
      ];
      const ctx = createParseCtx(tokens);

      const result = parseGraceGroup(ctx);

      assert.isNotNull(result);
      assert.instanceOf(result, Grace_group);
      assert.equal(result?.notes.length, 2);
      assert.instanceOf(result?.notes[0], Note);
      assert.instanceOf(result?.notes[1], Note);
      assert.isFalse(result?.isAccacciatura);
    });

    it("should handle unterminated grace groups", () => {
      const tokens = [createToken(TT.GRC_GRP_LEFT_BRACE, "{"), createToken(TT.NOTE_LETTER, "g")];
      const ctx = createParseCtx(tokens);

      const result = parseGraceGroup(ctx);

      assert.isNotNull(result);
      assert.instanceOf(result, Grace_group);
      assert.equal(result?.notes.length, 1);
      assert.instanceOf(result?.notes[0], Note);
      assert.isFalse(result?.isAccacciatura);
    });

    it("should return null for non-grace-group tokens", () => {
      const tokens = [createToken(TT.NOTE_LETTER, "C")];
      const ctx = createParseCtx(tokens);

      const result = parseGraceGroup(ctx);

      assert.isNull(result);
      assert.equal(ctx.current, 0); // Should not advance the current position
    });
  });

  describe("parseTuplet", () => {
    it("should parse a simple tuplet", () => {
      const tokens = [createToken(TT.TUPLET_LPAREN, "("), createToken(TT.TUPLET_P, "3")];
      const ctx = createParseCtx(tokens);

      const result = parseTuplet(ctx);

      assert.isNotNull(result);
      assert.instanceOf(result, Tuplet);
      assert.equal(result?.p.lexeme, "3");
      assert.isUndefined(result?.q);
      assert.isUndefined(result?.r);
    });

    it("should return null for non-tuplet tokens", () => {
      const tokens = [createToken(TT.NOTE_LETTER, "C")];
      const ctx = createParseCtx(tokens);

      const result = parseTuplet(ctx);

      assert.isNull(result);
      assert.equal(ctx.current, 0); // Should not advance the current position
    });
  });

  describe("parseYSpacer", () => {
    it("should parse a simple Y spacer", () => {
      const tokens = [createToken(TT.Y_SPC, "y")];
      const ctx = createParseCtx(tokens);

      const result = parseYSpacer(ctx);

      assert.isNotNull(result);
      assert.instanceOf(result, YSPACER);
      assert.equal(result?.ySpacer.lexeme, "y");
      assert.isUndefined(result?.rhythm);
    });

    it("should parse a Y spacer with rhythm", () => {
      const tokens = [createToken(TT.Y_SPC, "y"), createToken(TT.RHY_NUMER, "2")];
      const ctx = createParseCtx(tokens);

      const result = parseYSpacer(ctx);

      assert.isNotNull(result);
      assert.instanceOf(result, YSPACER);
      assert.equal(result?.ySpacer.lexeme, "y");
      assert.instanceOf(result?.rhythm, Rhythm);
      assert.equal(result?.rhythm?.numerator?.lexeme, "2");
    });

    it("should return null for non-Y-spacer tokens", () => {
      const tokens = [createToken(TT.NOTE_LETTER, "C")];
      const ctx = createParseCtx(tokens);

      const result = parseYSpacer(ctx);

      assert.isNull(result);
      assert.equal(ctx.current, 0); // Should not advance the current position
    });
  });

  describe("parseSymbol", () => {
    it("should parse a symbol", () => {
      const tokens = [createToken(TT.SYMBOL, "!fff!")];
      const ctx = createParseCtx(tokens);

      const result = parseSymbol(ctx);

      assert.isNotNull(result);
      assert.instanceOf(result, Symbol);
      assert.equal(result?.symbol.lexeme, "!fff!");
    });

    it("should return null for non-symbol tokens", () => {
      const tokens = [createToken(TT.NOTE_LETTER, "C")];
      const ctx = createParseCtx(tokens);

      const result = parseSymbol(ctx);

      assert.isNull(result);
      assert.equal(ctx.current, 0); // Should not advance the current position
    });
  });

  describe("parseAnnotation", () => {
    it("should parse an annotation", () => {
      const tokens = [createToken(TT.ANNOTATION, '"C"')];
      const ctx = createParseCtx(tokens);

      const result = parseAnnotation(ctx);

      assert.isNotNull(result);
      assert.instanceOf(result, Annotation);
      assert.equal(result?.text.lexeme, '"C"');
    });

    it("should return null for non-annotation tokens", () => {
      const tokens = [createToken(TT.NOTE_LETTER, "C")];
      const ctx = createParseCtx(tokens);

      const result = parseAnnotation(ctx);

      assert.isNull(result);
      assert.equal(ctx.current, 0); // Should not advance the current position
    });
  });

  describe("parseDecoration", () => {
    it("should parse a decoration", () => {
      const tokens = [createToken(TT.DECORATION, ".")];
      const ctx = createParseCtx(tokens);

      const result = parseDecoration(ctx);

      assert.isNotNull(result);
      assert.instanceOf(result, Decoration);
      assert.equal(result?.decoration.lexeme, ".");
    });

    it("should return null for non-decoration tokens", () => {
      const tokens = [createToken(TT.NOTE_LETTER, "C")];
      const ctx = createParseCtx(tokens);

      const result = parseDecoration(ctx);

      assert.isNull(result);
      assert.equal(ctx.current, 0); // Should not advance the current position
    });
  });

  describe("parsePitch", () => {
    it("should parse a simple pitch", () => {
      const tokens = [createToken(TT.NOTE_LETTER, "C")];
      const ctx = createParseCtx(tokens);

      const result = parsePitch(ctx);

      assert.isNotNull(result);
      assert.instanceOf(result, Pitch);
      assert.equal(result?.noteLetter.lexeme, "C");
      assert.isUndefined(result?.alteration);
      assert.isUndefined(result?.octave);
    });

    it("should parse a pitch with an accidental", () => {
      const tokens = [createToken(TT.ACCIDENTAL, "^"), createToken(TT.NOTE_LETTER, "C")];
      const ctx = createParseCtx(tokens);

      const result = parsePitch(ctx);

      assert.isNotNull(result);
      assert.instanceOf(result, Pitch);
      assert.equal(result?.noteLetter.lexeme, "C");
      assert.equal(result?.alteration?.lexeme, "^");
      assert.isUndefined(result?.octave);
    });

    it("should parse a pitch with an octave", () => {
      const tokens = [createToken(TT.NOTE_LETTER, "C"), createToken(TT.OCTAVE, "'")];
      const ctx = createParseCtx(tokens);

      const result = parsePitch(ctx);

      assert.isNotNull(result);
      assert.instanceOf(result, Pitch);
      assert.equal(result?.noteLetter.lexeme, "C");
      assert.isUndefined(result?.alteration);
      assert.equal(result?.octave?.lexeme, "'");
    });

    it("should parse a pitch with an accidental and octave", () => {
      const tokens = [createToken(TT.ACCIDENTAL, "^"), createToken(TT.NOTE_LETTER, "C"), createToken(TT.OCTAVE, "'")];
      const ctx = createParseCtx(tokens);

      const result = parsePitch(ctx);

      assert.isNotNull(result);
      assert.instanceOf(result, Pitch);
      assert.equal(result?.noteLetter.lexeme, "C");
      assert.equal(result?.alteration?.lexeme, "^");
      assert.equal(result?.octave?.lexeme, "'");
    });

    it("should return null for non-note tokens", () => {
      const tokens = [createToken(TT.BARLINE, "|")];
      const ctx = createParseCtx(tokens);

      const result = parsePitch(ctx);

      assert.isNull(result);
      assert.equal(ctx.current, 0); // Should not advance the current position
    });

    it("should rewind if an accidental is found but no note letter follows", () => {
      const tokens = [createToken(TT.ACCIDENTAL, "^"), createToken(TT.BARLINE, "|")];
      const ctx = createParseCtx(tokens);

      const result = parsePitch(ctx);

      assert.isNull(result);
      assert.equal(ctx.current, 0); // Should rewind to the start
    });
  });

  describe("parseRhythm", () => {
    it("should parse a numerator only", () => {
      const tokens = [createToken(TT.RHY_NUMER, "2")];
      const ctx = createParseCtx(tokens);

      const result = parseRhythm(ctx);

      assert.isDefined(result);
      assert.instanceOf(result, Rhythm);
      assert.equal(result?.numerator?.lexeme, "2");
      assert.isUndefined(result?.separator);
      assert.isNull(result?.denominator);
      assert.isNull(result?.broken);
    });

    it("should parse a separator only", () => {
      const tokens = [createToken(TT.RHY_SEP, "/")];
      const ctx = createParseCtx(tokens);

      const result = parseRhythm(ctx);

      assert.isDefined(result);
      assert.instanceOf(result, Rhythm);
      assert.isNull(result?.numerator);
      assert.equal(result?.separator?.lexeme, "/");
      assert.isNull(result?.denominator);
      assert.isNull(result?.broken);
    });

    it("should parse a separator and denominator", () => {
      const tokens = [createToken(TT.RHY_SEP, "/"), createToken(TT.RHY_DENOM, "2")];
      const ctx = createParseCtx(tokens);

      const result = parseRhythm(ctx);

      assert.isDefined(result);
      assert.instanceOf(result, Rhythm);
      assert.isNull(result?.numerator);
      assert.equal(result?.separator?.lexeme, "/");
      assert.equal(result?.denominator?.lexeme, "2");
      assert.isNull(result?.broken);
    });

    it("should parse a numerator, separator, and denominator", () => {
      const tokens = [createToken(TT.RHY_NUMER, "3"), createToken(TT.RHY_SEP, "/"), createToken(TT.RHY_DENOM, "2")];
      const ctx = createParseCtx(tokens);

      const result = parseRhythm(ctx);

      assert.isDefined(result);
      assert.instanceOf(result, Rhythm);
      assert.equal(result?.numerator?.lexeme, "3");
      assert.equal(result?.separator?.lexeme, "/");
      assert.equal(result?.denominator?.lexeme, "2");
      assert.isNull(result?.broken);
    });

    it("should parse a broken rhythm (>)", () => {
      const tokens = [createToken(TT.RHY_BRKN, ">")];
      const ctx = createParseCtx(tokens);

      const result = parseRhythm(ctx);

      assert.isDefined(result);
      assert.instanceOf(result, Rhythm);
      assert.isNull(result?.numerator);
      assert.isUndefined(result?.separator);
      assert.isNull(result?.denominator);
      assert.equal(result?.broken?.lexeme, ">");
    });

    it("should parse a broken rhythm (<)", () => {
      const tokens = [createToken(TT.RHY_BRKN, "<")];
      const ctx = createParseCtx(tokens);

      const result = parseRhythm(ctx);

      assert.isDefined(result);
      assert.instanceOf(result, Rhythm);
      assert.isNull(result?.numerator);
      assert.isUndefined(result?.separator);
      assert.isNull(result?.denominator);
      assert.equal(result?.broken?.lexeme, "<");
    });

    it("should parse a double broken rhythm (>>)", () => {
      const tokens = [createToken(TT.RHY_BRKN, ">>")];
      const ctx = createParseCtx(tokens);

      const result = parseRhythm(ctx);

      assert.isDefined(result);
      assert.instanceOf(result, Rhythm);
      assert.isNull(result?.numerator);
      assert.isUndefined(result?.separator);
      assert.isNull(result?.denominator);
      assert.equal(result?.broken?.lexeme, ">>");
    });

    it("should parse a numerator with broken rhythm", () => {
      const tokens = [createToken(TT.RHY_NUMER, "2"), createToken(TT.RHY_BRKN, ">")];
      const ctx = createParseCtx(tokens);

      const result = parseRhythm(ctx);

      assert.isDefined(result);
      assert.instanceOf(result, Rhythm);
      assert.equal(result?.numerator?.lexeme, "2");
      assert.isUndefined(result?.separator);
      assert.isNull(result?.denominator);
      assert.equal(result?.broken?.lexeme, ">");
    });

    it("should parse a complex rhythm with all components", () => {
      const tokens = [createToken(TT.RHY_NUMER, "3"), createToken(TT.RHY_SEP, "/"), createToken(TT.RHY_DENOM, "2"), createToken(TT.RHY_BRKN, ">")];
      const ctx = createParseCtx(tokens);

      const result = parseRhythm(ctx);

      assert.isDefined(result);
      assert.instanceOf(result, Rhythm);
      assert.equal(result?.numerator?.lexeme, "3");
      assert.equal(result?.separator?.lexeme, "/");
      assert.equal(result?.denominator?.lexeme, "2");
      assert.equal(result?.broken?.lexeme, ">");
    });

    it("should return undefined when no rhythm components are present", () => {
      const tokens = [createToken(TT.NOTE_LETTER, "C")];
      const ctx = createParseCtx(tokens);

      const result = parseRhythm(ctx);

      assert.isUndefined(result);
      assert.equal(ctx.current, 0); // Should not advance the current position
    });
  });

  describe("parseRepeatNumbers", () => {
    it("should parse a single repeat number", () => {
      const tokens = [createToken(TT.REPEAT_NUMBER, "1")];
      const ctx = createParseCtx(tokens);

      const result = parseRepeatNumbers(ctx);

      assert.isArray(result);
      assert.equal(result.length, 1);
      assert.equal(result[0].type, TT.REPEAT_NUMBER);
      assert.equal(result[0].lexeme, "1");
    });

    it("should parse multiple repeat numbers with commas", () => {
      const tokens = [createToken(TT.REPEAT_NUMBER, "1"), createToken(TT.REPEAT_COMMA, ","), createToken(TT.REPEAT_NUMBER, "2")];
      const ctx = createParseCtx(tokens);

      const result = parseRepeatNumbers(ctx);

      assert.isArray(result);
      assert.equal(result.length, 3);
      assert.equal(result[0].type, TT.REPEAT_NUMBER);
      assert.equal(result[0].lexeme, "1");
      assert.equal(result[1].type, TT.REPEAT_COMMA);
      assert.equal(result[1].lexeme, ",");
      assert.equal(result[2].type, TT.REPEAT_NUMBER);
      assert.equal(result[2].lexeme, "2");
    });

    it("should parse a number range with dash", () => {
      const tokens = [createToken(TT.REPEAT_NUMBER, "1"), createToken(TT.REPEAT_DASH, "-"), createToken(TT.REPEAT_NUMBER, "3")];
      const ctx = createParseCtx(tokens);

      const result = parseRepeatNumbers(ctx);

      assert.isArray(result);
      assert.equal(result.length, 3);
      assert.equal(result[0].type, TT.REPEAT_NUMBER);
      assert.equal(result[0].lexeme, "1");
      assert.equal(result[1].type, TT.REPEAT_DASH);
      assert.equal(result[1].lexeme, "-");
      assert.equal(result[2].type, TT.REPEAT_NUMBER);
      assert.equal(result[2].lexeme, "3");
    });

    it("should parse x notation", () => {
      const tokens = [createToken(TT.REPEAT_NUMBER, "1"), createToken(TT.REPEAT_X, "x"), createToken(TT.REPEAT_NUMBER, "2")];
      const ctx = createParseCtx(tokens);

      const result = parseRepeatNumbers(ctx);

      assert.isArray(result);
      assert.equal(result.length, 3);
      assert.equal(result[0].type, TT.REPEAT_NUMBER);
      assert.equal(result[0].lexeme, "1");
      assert.equal(result[1].type, TT.REPEAT_X);
      assert.equal(result[1].lexeme, "x");
      assert.equal(result[2].type, TT.REPEAT_NUMBER);
      assert.equal(result[2].lexeme, "2");
    });

    it("should parse complex combinations of repeat numbers", () => {
      const tokens = [
        createToken(TT.REPEAT_NUMBER, "1"),
        createToken(TT.REPEAT_COMMA, ","),
        createToken(TT.REPEAT_NUMBER, "2"),
        createToken(TT.REPEAT_DASH, "-"),
        createToken(TT.REPEAT_NUMBER, "4"),
        createToken(TT.REPEAT_COMMA, ","),
        createToken(TT.REPEAT_NUMBER, "5"),
        createToken(TT.REPEAT_X, "x"),
        createToken(TT.REPEAT_NUMBER, "2"),
      ];
      const ctx = createParseCtx(tokens);

      const result = parseRepeatNumbers(ctx);

      assert.isArray(result);
      assert.equal(result.length, 9);

      // Check first part: "1,"
      assert.equal(result[0].type, TT.REPEAT_NUMBER);
      assert.equal(result[0].lexeme, "1");
      assert.equal(result[1].type, TT.REPEAT_COMMA);
      assert.equal(result[1].lexeme, ",");

      // Check second part: "2-4,"
      assert.equal(result[2].type, TT.REPEAT_NUMBER);
      assert.equal(result[2].lexeme, "2");
      assert.equal(result[3].type, TT.REPEAT_DASH);
      assert.equal(result[3].lexeme, "-");
      assert.equal(result[4].type, TT.REPEAT_NUMBER);
      assert.equal(result[4].lexeme, "4");
      assert.equal(result[5].type, TT.REPEAT_COMMA);
      assert.equal(result[5].lexeme, ",");

      // Check third part: "5x2"
      assert.equal(result[6].type, TT.REPEAT_NUMBER);
      assert.equal(result[6].lexeme, "5");
      assert.equal(result[7].type, TT.REPEAT_X);
      assert.equal(result[7].lexeme, "x");
      assert.equal(result[8].type, TT.REPEAT_NUMBER);
      assert.equal(result[8].lexeme, "2");
    });

    it("should stop parsing at non-repeat tokens", () => {
      const tokens = [
        createToken(TT.REPEAT_NUMBER, "1"),
        createToken(TT.REPEAT_COMMA, ","),
        createToken(TT.REPEAT_NUMBER, "2"),
        createToken(TT.NOTE_LETTER, "C"),
      ];
      const ctx = createParseCtx(tokens);

      const result = parseRepeatNumbers(ctx);

      assert.isArray(result);
      assert.equal(result.length, 3);
      assert.equal(ctx.current, 3); // Should stop at the NOTE_LETTER token
    });

    it("should return an empty array if no repeat numbers are present", () => {
      const tokens = [createToken(TT.NOTE_LETTER, "C")];
      const ctx = createParseCtx(tokens);

      const result = parseRepeatNumbers(ctx);

      assert.isArray(result);
      assert.equal(result.length, 0);
      assert.equal(ctx.current, 0); // Should not advance the current position
    });
  });

  describe("parseMusicCode", () => {
    it("should parse a single barline", () => {
      const tokens = [createToken(TT.BARLINE, "|")];
      const ctx = createParseCtx(tokens);

      const result = parseMusicCode(ctx);

      assert.isNotNull(result);
      assert.isArray(result);
      assert.equal(result.length, 1);
      assert.instanceOf(result[0], BarLine);
      assert.equal(ctx.current, 1); // Should advance past the barline
    });

    it("should parse a single note", () => {
      const tokens = [createToken(TT.NOTE_LETTER, "C")];
      const ctx = createParseCtx(tokens);

      const result = parseMusicCode(ctx);

      assert.isNotNull(result);
      assert.isArray(result);
      assert.equal(result.length, 1);
      assert.instanceOf(result[0], Note);
      assert.equal(ctx.current, 1); // Should advance past the note
    });

    it("should parse a sequence of different music elements", () => {
      const tokens = [createToken(TT.BARLINE, "|"), createToken(TT.NOTE_LETTER, "C"), createToken(TT.REST, "z"), createToken(TT.ANNOTATION, '"C"')];
      const ctx = createParseCtx(tokens);

      const result = parseMusicCode(ctx);

      assert.isNotNull(result);
      assert.isArray(result);
      assert.equal(result.length, 4);
      assert.instanceOf(result[0], BarLine);
      assert.instanceOf(result[1], Note);
      assert.instanceOf(result[2], Rest);
      assert.instanceOf(result[3], Annotation);
      assert.equal(ctx.current, 4); // Should advance past all tokens
    });

    it("should stop parsing at EOL", () => {
      const tokens = [createToken(TT.BARLINE, "|"), createToken(TT.NOTE_LETTER, "C"), createToken(TT.EOL, "\n"), createToken(TT.NOTE_LETTER, "D")];
      const ctx = createParseCtx(tokens);

      const result = parseMusicCode(ctx);

      assert.isNotNull(result);
      assert.isArray(result);
      assert.equal(result.length, 2);
      assert.instanceOf(result[0], BarLine);
      assert.instanceOf(result[1], Note);
      assert.equal(ctx.current, 2); // Should stop at EOL
    });

    it("should stop parsing at COMMENT", () => {
      const tokens = [
        createToken(TT.BARLINE, "|"),
        createToken(TT.NOTE_LETTER, "C"),
        createToken(TT.COMMENT, "%comment"),
        createToken(TT.NOTE_LETTER, "D"),
      ];
      const ctx = createParseCtx(tokens);

      const result = parseMusicCode(ctx);

      assert.isNotNull(result);
      assert.isArray(result);
      assert.equal(result.length, 2);
      assert.instanceOf(result[0], BarLine);
      assert.instanceOf(result[1], Note);
      assert.equal(ctx.current, 2); // Should stop at COMMENT
    });

    it("should stop parsing at INF_HDR", () => {
      const tokens = [createToken(TT.BARLINE, "|"), createToken(TT.NOTE_LETTER, "C"), createToken(TT.INF_HDR, "K:"), createToken(TT.NOTE_LETTER, "D")];
      const ctx = createParseCtx(tokens);

      const result = parseMusicCode(ctx);

      assert.isNotNull(result);
      assert.isArray(result);
      assert.equal(result.length, 2);
      assert.instanceOf(result[0], BarLine);
      assert.instanceOf(result[1], Note);
      assert.equal(ctx.current, 2); // Should stop at INF_HDR
    });

    it("should stop parsing at SCT_BRK", () => {
      const tokens = [createToken(TT.BARLINE, "|"), createToken(TT.NOTE_LETTER, "C"), createToken(TT.SCT_BRK, "\n\n"), createToken(TT.NOTE_LETTER, "D")];
      const ctx = createParseCtx(tokens);

      const result = parseMusicCode(ctx);

      assert.isNotNull(result);
      assert.isArray(result);
      assert.equal(result.length, 2);
      assert.instanceOf(result[0], BarLine);
      assert.instanceOf(result[1], Note);
      assert.equal(ctx.current, 2); // Should stop at SCT_BRK
    });

    it("should parse a complex musical phrase", () => {
      const tokens = [
        createToken(TT.BARLINE, "|"),
        createToken(TT.ANNOTATION, '"C"'),
        createToken(TT.NOTE_LETTER, "C"),
        createToken(TT.NOTE_LETTER, "E"),
        createToken(TT.NOTE_LETTER, "G"),
        createToken(TT.BARLINE, "|"),
        createToken(TT.CHRD_LEFT_BRKT, "["),
        createToken(TT.NOTE_LETTER, "F"),
        createToken(TT.NOTE_LETTER, "A"),
        createToken(TT.NOTE_LETTER, "C"),
        createToken(TT.CHRD_RIGHT_BRKT, "]"),
        createToken(TT.RHY_NUMER, "2"),
        createToken(TT.REST, "z"),
        createToken(TT.BARLINE, "|"),
      ];
      const ctx = createParseCtx(tokens);

      const result = parseMusicCode(ctx);

      assert.isNotNull(result);
      assert.isArray(result);
      assert.equal(result.length, 9);
      assert.instanceOf(result[0], BarLine);
      assert.instanceOf(result[1], Annotation);
      assert.instanceOf(result[2], Note);
      assert.instanceOf(result[3], Note);
      assert.instanceOf(result[4], Note);
      assert.instanceOf(result[5], BarLine);
      assert.instanceOf(result[6], Chord);
      assert.instanceOf(result[7], Rest);
      assert.instanceOf(result[8], BarLine);
    });

    it("should parse all types of music elements", () => {
      const tokens = [
        createToken(TT.BARLINE, "|"),
        createToken(TT.CHRD_LEFT_BRKT, "["),
        createToken(TT.NOTE_LETTER, "C"),
        createToken(TT.CHRD_RIGHT_BRKT, "]"),
        createToken(TT.GRC_GRP_LEFT_BRACE, "{"),
        createToken(TT.NOTE_LETTER, "g"),
        createToken(TT.GRC_GRP_RGHT_BRACE, "}"),
        createToken(TT.REST, "z"),
        createToken(TT.NOTE_LETTER, "C"),
        createToken(TT.TUPLET_LPAREN, "("),
        createToken(TT.TUPLET_P, "3"),
        createToken(TT.Y_SPC, "y"),
        createToken(TT.SYMBOL, "!fff!"),
        createToken(TT.ANNOTATION, '"C"'),
        createToken(TT.DECORATION, "."),
      ];
      const ctx = createParseCtx(tokens);

      const result = parseMusicCode(ctx);

      assert.isNotNull(result);
      assert.isArray(result);
      assert.equal(result.length, 10);
      assert.instanceOf(result[0], BarLine);
      assert.instanceOf(result[1], Chord);
      assert.instanceOf(result[2], Grace_group);
      assert.instanceOf(result[3], Rest);
      assert.instanceOf(result[4], Note);
      assert.instanceOf(result[5], Tuplet);
      assert.instanceOf(result[6], YSPACER);
      assert.instanceOf(result[7], Symbol);
      assert.instanceOf(result[8], Annotation);
      assert.instanceOf(result[9], Decoration);
    });

    it("should handle empty token list", () => {
      const tokens: Token[] = [];
      const ctx = createParseCtx(tokens);
      const result = parseMusicCode(ctx);
      assert.isNull(result);
    });

    it("should handle unexpected tokens", () => {
      // Using a token type that doesn't correspond to any music element
      const tokens = [createToken(TT.EOF, "")];
      const ctx = createParseCtx(tokens);
      const result = parseMusicCode(ctx);
      assert.isNull(result);
    });

    it("should use the provided array to store elements if given", () => {
      const tokens = [createToken(TT.NOTE_LETTER, "C")];
      const ctx = createParseCtx(tokens);
      const elements: Array<any> = [];

      const result = parseMusicCode(ctx, elements);

      assert.isNotNull(result);
      assert.equal(elements.length, 1);
      assert.instanceOf(elements[0], Note);
    });
  });

  describe("prsTuneHdr", () => {
    it("should parse a basic tune header", () => {
      const tokens = [
        createToken(TT.INF_HDR, "X:"),
        createToken(TT.INFO_STR, "1"),
        createToken(TT.EOL, "\n"),
        createToken(TT.INF_HDR, "T:"),
        createToken(TT.INFO_STR, "Test Tune"),
        createToken(TT.EOL, "\n"),
        createToken(TT.INF_HDR, "M:"),
        createToken(TT.INFO_STR, "4/4"),
        createToken(TT.EOL, "\n"),
        createToken(TT.INF_HDR, "K:"),
        createToken(TT.INFO_STR, "C"),
        createToken(TT.EOL, "\n"),
        createToken(TT.SCT_BRK, "\n\n"),
      ];
      const ctx = createParseCtx(tokens);

      const result = prsTuneHdr(ctx);

      assert.isNotNull(result);
      assert.instanceOf(result, Tune_header);
      assert.equal(result.info_lines.length, 4);
      assert.equal(result.voices.length, 0);

      // Check that all info lines were parsed correctly
      assert.equal((result.info_lines[0] as Info_line).key.lexeme, "X:");
      assert.equal((result.info_lines[0] as Info_line).value[0].lexeme, "1");
      assert.equal((result.info_lines[1] as Info_line).key.lexeme, "T:");
      assert.equal((result.info_lines[1] as Info_line).value[0].lexeme, "Test Tune");
      assert.equal((result.info_lines[2] as Info_line).key.lexeme, "M:");
      assert.equal((result.info_lines[2] as Info_line).value[0].lexeme, "4/4");
      assert.equal((result.info_lines[3] as Info_line).key.lexeme, "K:");
      assert.equal((result.info_lines[3] as Info_line).value[0].lexeme, "C");
    });

    it("should detect and collect voice names", () => {
      const tokens = [
        createToken(TT.INF_HDR, "X:"),
        createToken(TT.INFO_STR, "1"),
        createToken(TT.EOL, "\n"),
        createToken(TT.INF_HDR, "T:"),
        createToken(TT.INFO_STR, "Test Tune"),
        createToken(TT.EOL, "\n"),
        createToken(TT.INF_HDR, "V:"),
        createToken(TT.INFO_STR, "Soprano"),
        createToken(TT.EOL, "\n"),
        createToken(TT.INF_HDR, "K:"),
        createToken(TT.INFO_STR, "C"),
        createToken(TT.EOL, "\n"),
        createToken(TT.SCT_BRK, "\n\n"),
      ];
      const ctx = createParseCtx(tokens);

      const result = prsTuneHdr(ctx);

      assert.isNotNull(result);
      assert.instanceOf(result, Tune_header);
      assert.equal(result.info_lines.length, 4);
      assert.equal(result.voices.length, 1);
      assert.equal(result.voices[0], "Soprano");
    });

    it("should handle multiple voice definitions", () => {
      const tokens = [
        createToken(TT.INF_HDR, "X:"),
        createToken(TT.INFO_STR, "1"),
        createToken(TT.EOL, "\n"),
        createToken(TT.INF_HDR, "V:"),
        createToken(TT.INFO_STR, "Soprano"),
        createToken(TT.EOL, "\n"),
        createToken(TT.INF_HDR, "V:"),
        createToken(TT.INFO_STR, "Alto"),
        createToken(TT.EOL, "\n"),
        createToken(TT.INF_HDR, "V:"),
        createToken(TT.INFO_STR, "Tenor"),
        createToken(TT.EOL, "\n"),
        createToken(TT.INF_HDR, "K:"),
        createToken(TT.INFO_STR, "C"),
        createToken(TT.EOL, "\n"),
        createToken(TT.SCT_BRK, "\n\n"),
      ];
      const ctx = createParseCtx(tokens);

      const result = prsTuneHdr(ctx);

      assert.isNotNull(result);
      assert.instanceOf(result, Tune_header);
      assert.equal(result.info_lines.length, 5);
      assert.equal(result.voices.length, 3);
      assert.equal(result.voices[0], "Soprano");
      assert.equal(result.voices[1], "Alto");
      assert.equal(result.voices[2], "Tenor");
    });

    it("should handle comments in the header", () => {
      const tokens = [
        createToken(TT.INF_HDR, "X:"),
        createToken(TT.INFO_STR, "1"),
        createToken(TT.EOL, "\n"),
        createToken(TT.COMMENT, "% This is a comment"),
        createToken(TT.EOL, "\n"),
        createToken(TT.INF_HDR, "T:"),
        createToken(TT.INFO_STR, "Test Tune"),
        createToken(TT.EOL, "\n"),
        createToken(TT.INF_HDR, "K:"),
        createToken(TT.INFO_STR, "C"),
        createToken(TT.EOL, "\n"),
        createToken(TT.SCT_BRK, "\n\n"),
      ];
      const ctx = createParseCtx(tokens);

      const result = prsTuneHdr(ctx);

      assert.isNotNull(result);
      assert.instanceOf(result, Tune_header);
      assert.equal(result.info_lines.length, 4); // 3 info lines + 1 comment
      assert.instanceOf(result.info_lines[0], Info_line);
      assert.instanceOf(result.info_lines[1], Comment);
      assert.equal((result.info_lines[1] as Comment).token.lexeme, "% This is a comment");
    });

    it("should handle directives in the header", () => {
      const tokens = [
        createToken(TT.INF_HDR, "X:"),
        createToken(TT.INFO_STR, "1"),
        createToken(TT.EOL, "\n"),
        createToken(TT.STYLESHEET_DIRECTIVE, "%%pagewidth 21cm"),
        createToken(TT.EOL, "\n"),
        createToken(TT.INF_HDR, "T:"),
        createToken(TT.INFO_STR, "Test Tune"),
        createToken(TT.EOL, "\n"),
        createToken(TT.INF_HDR, "K:"),
        createToken(TT.INFO_STR, "C"),
        createToken(TT.EOL, "\n"),
        createToken(TT.SCT_BRK, "\n\n"),
      ];
      const ctx = createParseCtx(tokens);

      const result = prsTuneHdr(ctx);

      assert.isNotNull(result);
      assert.instanceOf(result, Tune_header);
      assert.equal(result.info_lines.length, 4); // 3 info lines + 1 directive
      assert.instanceOf(result.info_lines[0], Info_line);
      assert.instanceOf(result.info_lines[1], Directive);
      assert.equal((result.info_lines[1] as Directive).token.lexeme, "%%pagewidth 21cm");
    });

    it("should handle a minimal header with just X:", () => {
      const tokens = [createToken(TT.INF_HDR, "X:"), createToken(TT.INFO_STR, "1"), createToken(TT.EOL, "\n"), createToken(TT.SCT_BRK, "\n\n")];
      const ctx = createParseCtx(tokens);

      const result = prsTuneHdr(ctx);

      assert.isNotNull(result);
      assert.instanceOf(result, Tune_header);
      assert.equal(result.info_lines.length, 1);
      assert.equal(result.voices.length, 0);
      assert.equal((result.info_lines[0] as Info_line).key.lexeme, "X:");
      assert.equal((result.info_lines[0] as Info_line).value[0].lexeme, "1");
    });

    it("should stop parsing at the end of the header section", () => {
      const tokens = [
        createToken(TT.INF_HDR, "X:"),
        createToken(TT.INFO_STR, "1"),
        createToken(TT.EOL, "\n"),
        createToken(TT.INF_HDR, "K:"),
        createToken(TT.INFO_STR, "C"),
        createToken(TT.EOL, "\n"),
        createToken(TT.SCT_BRK, "\n\n"),
        createToken(TT.NOTE_LETTER, "C"), // Music content after header
      ];
      const ctx = createParseCtx(tokens);

      const result = prsTuneHdr(ctx);

      assert.isNotNull(result);
      assert.instanceOf(result, Tune_header);
      assert.equal(result.info_lines.length, 2);
    });

    it("should handle voice info with additional parameters", () => {
      const tokens = [
        createToken(TT.INF_HDR, "X:"),
        createToken(TT.INFO_STR, "1"),
        createToken(TT.EOL, "\n"),
        createToken(TT.INF_HDR, "V:"),
        createToken(TT.INFO_STR, 'Soprano clef=treble name="Soprano"'),
        createToken(TT.EOL, "\n"),
        createToken(TT.INF_HDR, "K:"),
        createToken(TT.INFO_STR, "C"),
        createToken(TT.EOL, "\n"),
        createToken(TT.SCT_BRK, "\n\n"),
      ];
      const ctx = createParseCtx(tokens);

      const result = prsTuneHdr(ctx);

      assert.isNotNull(result);
      assert.instanceOf(result, Tune_header);
      assert.equal(result.info_lines.length, 3);
      assert.equal(result.voices.length, 1);
      assert.equal(result.voices[0], "Soprano");
    });
  });

  describe("Round Trip Tests", () => {
    it("should correctly round-trip chord expression [^aa]", () => {
      const abcContext = new ABCContext();

      // Create tokens for [^aa]
      const tokens = [
        createToken(TT.CHRD_LEFT_BRKT, "["),
        createToken(TT.ACCIDENTAL, "^"),
        createToken(TT.NOTE_LETTER, "a"),
        createToken(TT.NOTE_LETTER, "a"),
        createToken(TT.CHRD_RIGHT_BRKT, "]"),
        createToken(TT.EOL, "\n"),
      ];

      // Parse the tokens using prsBody
      const tuneBody = prsBody(new ParseCtx(tokens, abcContext));

      // Verify the result
      assert.isNotNull(tuneBody);
      assert.instanceOf(tuneBody, Tune_Body);
      assert.isArray(tuneBody.sequence);
      assert.isTrue(tuneBody.sequence.length > 0);

      // Get the first expression from the tune body
      const parsedExpr = tuneBody.sequence[0][0];
      assert.instanceOf(parsedExpr, Chord);

      const chord = parsedExpr as Chord;
      assert.equal(chord.contents.length, 2);

      // First note should have an accidental
      assert.instanceOf(chord.contents[0], Note);
      assert.instanceOf((chord.contents[0] as Note).pitch, Pitch);
      assert.equal(((chord.contents[0] as Note).pitch as Pitch).noteLetter.lexeme, "a");
      assert.equal(((chord.contents[0] as Note).pitch as Pitch).alteration?.lexeme, "^");

      // Second note should not have an accidental
      assert.instanceOf(chord.contents[1], Note);
      assert.instanceOf((chord.contents[1] as Note).pitch, Pitch);
      assert.equal(((chord.contents[1] as Note).pitch as Pitch).noteLetter.lexeme, "a");
      assert.isUndefined(((chord.contents[1] as Note).pitch as Pitch).alteration);
    });

    // This test case is based on a failing case from property-based testing
    it("should correctly round-trip chord expression [A_a]", () => {
      const abcContext = new ABCContext();

      // Create tokens for [A_a]
      const tokens = [
        createToken(TT.CHRD_LEFT_BRKT, "["),
        createToken(TT.NOTE_LETTER, "A"),
        createToken(TT.ACCIDENTAL, "_"),
        createToken(TT.NOTE_LETTER, "a"),
        createToken(TT.CHRD_RIGHT_BRKT, "]"),
        createToken(TT.EOL, "\n"),
      ];

      // Parse the tokens using prsBody
      const tuneBody = prsBody(new ParseCtx(tokens, abcContext));

      // Verify the result
      assert.isNotNull(tuneBody);
      assert.instanceOf(tuneBody, Tune_Body);
      assert.isArray(tuneBody.sequence);
      assert.isTrue(tuneBody.sequence.length > 0);

      // Get the first expression from the tune body
      const parsedExpr = tuneBody.sequence[0][0];
      assert.instanceOf(parsedExpr, Chord);

      const chord = parsedExpr as Chord;
      assert.equal(chord.contents.length, 2);

      // First note should be 'A' without an accidental
      assert.instanceOf(chord.contents[0], Note);
      assert.instanceOf((chord.contents[0] as Note).pitch, Pitch);
      assert.equal(((chord.contents[0] as Note).pitch as Pitch).noteLetter.lexeme, "A");
      assert.isUndefined(((chord.contents[0] as Note).pitch as Pitch).alteration);

      // Second note should be 'a' with a flat accidental
      assert.instanceOf(chord.contents[1], Note);
      assert.instanceOf((chord.contents[1] as Note).pitch, Pitch);
      assert.equal(((chord.contents[1] as Note).pitch as Pitch).noteLetter.lexeme, "a");
      assert.equal(((chord.contents[1] as Note).pitch as Pitch).alteration?.lexeme, "_");
    });
  });

  describe("prcssBms", () => {
    it("should group consecutive notes into a beam", () => {
      const abcContext = new ABCContext();
      const tokens = [createToken(TT.NOTE_LETTER, "C"), createToken(TT.NOTE_LETTER, "D"), createToken(TT.NOTE_LETTER, "E")];

      // Create notes from tokens
      const notes = tokens
        .map((token) => {
          const ctx = createParseCtx([token]);
          return parseNote(ctx);
        })
        .filter((e): e is Note => e !== null);

      // Process beams
      const result = prcssBms(notes, abcContext);

      // Verify result
      assert.equal(result.length, 1);
      assert.instanceOf(result[0], Beam);
      assert.equal((result[0] as Beam).contents.length, 3);
    });

    it("should not beam notes separated by whitespace", () => {
      const abcContext = new ABCContext();
      const note1 = new Note(abcContext.generateId(), new Pitch(abcContext.generateId(), { noteLetter: createToken(TT.NOTE_LETTER, "C") }));
      const ws = createToken(TT.WS, " ");
      const note2 = new Note(abcContext.generateId(), new Pitch(abcContext.generateId(), { noteLetter: createToken(TT.NOTE_LETTER, "D") }));

      const elements = [note1, ws, note2];

      // Process beams
      const result = prcssBms(elements, abcContext);

      // Verify result
      assert.equal(result.length, 3);
      assert.instanceOf(result[0], Note);
      assert.equal(result[1], ws);
      assert.instanceOf(result[2], Note);
    });

    it("should not beam notes separated by barlines", () => {
      const abcContext = new ABCContext();
      const note1 = new Note(abcContext.generateId(), new Pitch(abcContext.generateId(), { noteLetter: createToken(TT.NOTE_LETTER, "C") }));
      const barline = new BarLine(abcContext.generateId(), [createToken(TT.BARLINE, "|")]);
      const note2 = new Note(abcContext.generateId(), new Pitch(abcContext.generateId(), { noteLetter: createToken(TT.NOTE_LETTER, "D") }));

      const elements = [note1, barline, note2];

      // Process beams
      const result = prcssBms(elements, abcContext);

      // Verify result
      assert.equal(result.length, 3);
      assert.instanceOf(result[0], Note);
      assert.instanceOf(result[1], BarLine);
      assert.instanceOf(result[2], Note);
    });

    it("should include chords in beams", () => {
      const abcContext = new ABCContext();

      // Create a note
      const note = new Note(abcContext.generateId(), new Pitch(abcContext.generateId(), { noteLetter: createToken(TT.NOTE_LETTER, "C") }));

      // Create a chord
      const chordNote1 = new Note(abcContext.generateId(), new Pitch(abcContext.generateId(), { noteLetter: createToken(TT.NOTE_LETTER, "E") }));
      const chordNote2 = new Note(abcContext.generateId(), new Pitch(abcContext.generateId(), { noteLetter: createToken(TT.NOTE_LETTER, "G") }));
      const chord = new Chord(abcContext.generateId(), [chordNote1, chordNote2]);

      const elements = [note, chord];

      // Process beams
      const result = prcssBms(elements, abcContext);

      // Verify result
      assert.equal(result.length, 1);
      assert.instanceOf(result[0], Beam);
      assert.equal((result[0] as Beam).contents.length, 2);
      assert.instanceOf((result[0] as Beam).contents[0], Note);
      assert.instanceOf((result[0] as Beam).contents[1], Chord);
    });

    it("should handle complex music with multiple beams", () => {
      const abcContext = new ABCContext();

      // Create notes and other elements
      const note1 = new Note(abcContext.generateId(), new Pitch(abcContext.generateId(), { noteLetter: createToken(TT.NOTE_LETTER, "C") }));
      const note2 = new Note(abcContext.generateId(), new Pitch(abcContext.generateId(), { noteLetter: createToken(TT.NOTE_LETTER, "D") }));
      const barline = new BarLine(abcContext.generateId(), [createToken(TT.BARLINE, "|")]);
      const note3 = new Note(abcContext.generateId(), new Pitch(abcContext.generateId(), { noteLetter: createToken(TT.NOTE_LETTER, "E") }));
      const note4 = new Note(abcContext.generateId(), new Pitch(abcContext.generateId(), { noteLetter: createToken(TT.NOTE_LETTER, "F") }));

      const elements = [note1, note2, barline, note3, note4];

      // Process beams
      const result = prcssBms(elements, abcContext);

      // Verify result
      assert.equal(result.length, 3);
      assert.instanceOf(result[0], Beam);
      assert.equal((result[0] as Beam).contents.length, 2);
      assert.instanceOf(result[1], BarLine);
      assert.instanceOf(result[2], Beam);
      assert.equal((result[2] as Beam).contents.length, 2);
    });
  });
});
