import { assert } from "chai";
import { describe, it } from "mocha";
import { prsLyricLine } from "../parsers/parse2";
import { TT } from "../parsers/scan2";
import { Lyric_line } from "../types/Expr2";
import { createToken, createParseCtx } from "./prs_music_code.spec";

describe("prsLyricLine", () => {
  it("should parse a simple lyric line with w:", () => {
    const tokens = [
      createToken(TT.LY_HDR, "w:"),
      createToken(TT.LY_TXT, "Hello"),
      createToken(TT.WS, " "),
      createToken(TT.LY_TXT, "world")
    ];
    const ctx = createParseCtx(tokens);

    const result = prsLyricLine(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, Lyric_line);
    assert.equal(result!.header.type, TT.LY_HDR);
    assert.equal(result!.header.lexeme, "w:");
    assert.equal(result!.contents.length, 3);
    assert.equal(result!.contents[0].type, TT.LY_TXT);
    assert.equal(result!.contents[0].lexeme, "Hello");
    assert.equal(ctx.current, 4); // Should have consumed all tokens
  });

  it("should parse a section lyric line with W:", () => {
    const tokens = [
      createToken(TT.LY_SECT_HDR, "W:"),
      createToken(TT.LY_TXT, "Section"),
      createToken(TT.WS, " "),
      createToken(TT.LY_TXT, "lyrics")
    ];
    const ctx = createParseCtx(tokens);

    const result = prsLyricLine(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, Lyric_line);
    assert.equal(result!.header.type, TT.LY_SECT_HDR);
    assert.equal(result!.header.lexeme, "W:");
    assert.equal(result!.contents.length, 3);
  });

  it("should parse lyric line with special symbols", () => {
    const tokens = [
      createToken(TT.LY_HDR, "w:"),
      createToken(TT.LY_TXT, "syll"),
      createToken(TT.LY_HYPH, "-"),
      createToken(TT.LY_TXT, "a"),
      createToken(TT.LY_HYPH, "-"),
      createToken(TT.LY_TXT, "ble")
    ];
    const ctx = createParseCtx(tokens);

    const result = prsLyricLine(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, Lyric_line);
    assert.equal(result!.contents.length, 5);
    assert.equal(result!.contents[0].type, TT.LY_TXT);
    assert.equal(result!.contents[1].type, TT.LY_HYPH);
    assert.equal(result!.contents[2].type, TT.LY_TXT);
    assert.equal(result!.contents[3].type, TT.LY_HYPH);
    assert.equal(result!.contents[4].type, TT.LY_TXT);
  });

  it("should parse lyric line with underscore extension", () => {
    const tokens = [
      createToken(TT.LY_HDR, "w:"),
      createToken(TT.LY_TXT, "time"),
      createToken(TT.LY_UNDR, "_"),
      createToken(TT.LY_UNDR, "_")
    ];
    const ctx = createParseCtx(tokens);

    const result = prsLyricLine(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, Lyric_line);
    assert.equal(result!.contents.length, 3);
    assert.equal(result!.contents[0].type, TT.LY_TXT);
    assert.equal(result!.contents[1].type, TT.LY_UNDR);
    assert.equal(result!.contents[2].type, TT.LY_UNDR);
  });

  it("should parse lyric line with star (skip note)", () => {
    const tokens = [
      createToken(TT.LY_HDR, "w:"),
      createToken(TT.LY_TXT, "word"),
      createToken(TT.WS, " "),
      createToken(TT.LY_STAR, "*"),
      createToken(TT.WS, " "),
      createToken(TT.LY_TXT, "word")
    ];
    const ctx = createParseCtx(tokens);

    const result = prsLyricLine(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, Lyric_line);
    assert.equal(result!.contents.length, 5);
    assert.equal(result!.contents[2].type, TT.LY_STAR);
  });

  it("should parse lyric line with tilde (word space)", () => {
    const tokens = [
      createToken(TT.LY_HDR, "w:"),
      createToken(TT.LY_TXT, "of"),
      createToken(TT.LY_SPS, "~"),
      createToken(TT.LY_TXT, "the"),
      createToken(TT.LY_SPS, "~"),
      createToken(TT.LY_TXT, "day")
    ];
    const ctx = createParseCtx(tokens);

    const result = prsLyricLine(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, Lyric_line);
    assert.equal(result!.contents.length, 5);
    assert.equal(result!.contents[1].type, TT.LY_SPS);
    assert.equal(result!.contents[3].type, TT.LY_SPS);
  });

  it("should parse lyric line with barlines", () => {
    const tokens = [
      createToken(TT.LY_HDR, "w:"),
      createToken(TT.LY_TXT, "word"),
      createToken(TT.WS, " "),
      createToken(TT.BARLINE, "|"),
      createToken(TT.WS, " "),
      createToken(TT.LY_TXT, "word")
    ];
    const ctx = createParseCtx(tokens);

    const result = prsLyricLine(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, Lyric_line);
    assert.equal(result!.contents.length, 5);
    assert.equal(result!.contents[2].type, TT.BARLINE);
  });

  it("should parse lyric line with comments", () => {
    const tokens = [
      createToken(TT.LY_HDR, "w:"),
      createToken(TT.LY_TXT, "lyrics"),
      createToken(TT.WS, " "),
      createToken(TT.COMMENT, "%comment")
    ];
    const ctx = createParseCtx(tokens);

    const result = prsLyricLine(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, Lyric_line);
    assert.equal(result!.contents.length, 3);
    assert.equal(result!.contents[2].type, TT.COMMENT);
  });

  it("should return null for non-lyric tokens", () => {
    const tokens = [createToken(TT.INF_HDR, "T:"), createToken(TT.INFO_STR, "Title")];
    const ctx = createParseCtx(tokens);

    const result = prsLyricLine(ctx);

    assert.isNull(result);
    assert.equal(ctx.current, 0); // Should not advance the current position
  });

  it("should handle empty lyric line", () => {
    const tokens = [createToken(TT.LY_HDR, "w:")];
    const ctx = createParseCtx(tokens);

    const result = prsLyricLine(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, Lyric_line);
    assert.equal(result!.header.type, TT.LY_HDR);
    assert.equal(result!.contents.length, 0);
  });

  it("should handle multiple special characters in sequence", () => {
    const tokens = [
      createToken(TT.LY_HDR, "w:"),
      createToken(TT.LY_TXT, "word"),
      createToken(TT.LY_HYPH, "-"),
      createToken(TT.LY_UNDR, "_"),
      createToken(TT.LY_STAR, "*"),
      createToken(TT.LY_SPS, "~"),
      createToken(TT.BARLINE, "|")
    ];
    const ctx = createParseCtx(tokens);

    const result = prsLyricLine(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, Lyric_line);
    assert.equal(result!.contents.length, 6);
    assert.equal(result!.contents[0].type, TT.LY_TXT);
    assert.equal(result!.contents[1].type, TT.LY_HYPH);
    assert.equal(result!.contents[2].type, TT.LY_UNDR);
    assert.equal(result!.contents[3].type, TT.LY_STAR);
    assert.equal(result!.contents[4].type, TT.LY_SPS);
    assert.equal(result!.contents[5].type, TT.BARLINE);
  });

  it("should stop parsing at non-lyric token", () => {
    const tokens = [
      createToken(TT.LY_HDR, "w:"),
      createToken(TT.LY_TXT, "lyrics"),
      createToken(TT.NOTE_LETTER, "C") // Non-lyric token
    ];
    const ctx = createParseCtx(tokens);

    const result = prsLyricLine(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, Lyric_line);
    assert.equal(result!.contents.length, 1);
    assert.equal(ctx.current, 2); // Should stop before the note
  });
});