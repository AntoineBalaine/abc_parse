import { assert } from "chai";
import { describe, it } from "mocha";
import { ABCContext } from "../parsers/Context";
import {
  ParseCtx,
  parseMusicCode,
} from "../parsers/parse2";
import { Token, TT } from "../parsers/scan2";
import {
  Annotation,
  BarLine,
  Chord,
  Decoration,
  Grace_group,
  Note,
  Rest,
  Symbol,
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
export function createParseCtx(tokens: Token[]): ParseCtx {
  return new ParseCtx(tokens, new ABCContext());
}

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




