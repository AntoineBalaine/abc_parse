import { assert } from "chai";
import { describe, it } from "mocha";
import {
  ParseCtx,
  parseBarline,
  parseChord,
  parseGraceGroup,
  parseRest,
  parseNote,
  parseTuplet,
  parseYSpacer,
  parseSymbol,
  parseAnnotation,
  parseDecoration,
  parsePitch,
  parseRhythm,
  parseRepeatNumbers,
} from "../parsers/parse2";
import { Token, TT } from "../parsers/scan2";
import { ABCContext } from "../parsers/Context";
import { BarLine, Chord, Grace_group, Rest, Note, Pitch, Rhythm, Symbol, YSPACER, Annotation, Decoration, Tuplet } from "../types/Expr2";

// Helper function to create a token with the given type and lexeme
function createToken(type: TT, lexeme: string, line: number = 0, position: number = 0): Token {
  const token = new Token(type, {
    source: "",
    tokens: [],
    start: 0,
    current: lexeme.length,
    line,
    report: () => {},
    push: () => {},
    test: () => false,
  });

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
      const tokens = [createToken(TT.TUPLET, "(3")];
      const ctx = createParseCtx(tokens);

      const result = parseTuplet(ctx);

      assert.isNotNull(result);
      assert.instanceOf(result, Tuplet);
      assert.equal(result?.p.lexeme, "(3");
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
});
