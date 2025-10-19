import { assert } from "chai";
import { describe, it } from "mocha";
import { ABCContext } from "../parsers/Context";
import { ParseCtx, prsLyricSection } from "../parsers/parse2";
import { Token, TT } from "../parsers/scan2";
import { Info_line, Lyric_section } from "../types/Expr2";
import { createToken } from "./prs_music_code.spec";

// Helper function to create a token with the given type and lexeme

// Helper function to create a ParseCtx with the given tokens
function createParseCtx(tokens: Token[]): ParseCtx {
  return new ParseCtx(tokens, new ABCContext());
}

describe("prsLyricSection", () => {
  it("should parse a simple lyric line with w:", () => {
    const tokens = [createToken(TT.LY_HDR, "w:"), createToken(TT.LY_TXT, "Hello"), createToken(TT.WS, " "), createToken(TT.LY_TXT, "world")];
    const ctx = createParseCtx(tokens);

    const result = prsLyricSection(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, Lyric_section);
    assert.equal(result!.info_lines.length, 1);

    const infoLine = result!.info_lines[0];
    assert.instanceOf(infoLine, Info_line);
    assert.equal(infoLine.key.type, TT.LY_HDR);
    assert.equal(infoLine.key.lexeme, "w:");
  });

  it("should parse a section lyric line with W:", () => {
    const tokens = [createToken(TT.LY_SECT_HDR, "W:"), createToken(TT.LY_TXT, "Section"), createToken(TT.WS, " "), createToken(TT.LY_TXT, "lyrics")];
    const ctx = createParseCtx(tokens);

    const result = prsLyricSection(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, Lyric_section);
    assert.equal(result!.info_lines.length, 1);

    const infoLine = result!.info_lines[0];
    assert.equal(infoLine.key.type, TT.LY_SECT_HDR);
    assert.equal(infoLine.key.lexeme, "W:");
  });

  it("should parse lyric line with special symbols", () => {
    const tokens = [
      createToken(TT.LY_HDR, "w:"),
      createToken(TT.LY_TXT, "syll"),
      createToken(TT.LY_HYPH, "-"),
      createToken(TT.LY_TXT, "a"),
      createToken(TT.LY_HYPH, "-"),
      createToken(TT.LY_TXT, "ble"),
    ];
    const ctx = createParseCtx(tokens);

    const result = prsLyricSection(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, Lyric_section);
    assert.equal(result!.info_lines.length, 1);

    const infoLine = result!.info_lines[0];
    assert.equal(infoLine.value[0].type, TT.LY_TXT);
    assert.equal(infoLine.value[1].type, TT.LY_HYPH);
    assert.equal(infoLine.value[2].type, TT.LY_TXT);
    assert.equal(infoLine.value[3].type, TT.LY_HYPH);
    assert.equal(infoLine.value[4].type, TT.LY_TXT);
  });

  it("should parse lyric line with underscore extension", () => {
    const tokens = [createToken(TT.LY_HDR, "w:"), createToken(TT.LY_TXT, "time"), createToken(TT.LY_UNDR, "_"), createToken(TT.LY_UNDR, "_")];
    const ctx = createParseCtx(tokens);

    const result = prsLyricSection(ctx);

    assert.isNotNull(result);
    const infoLine = result!.info_lines[0];
    assert.equal(infoLine.value[1].type, TT.LY_UNDR);
    assert.equal(infoLine.value[2].type, TT.LY_UNDR);
  });

  it("should parse lyric line with star (skip note)", () => {
    const tokens = [
      createToken(TT.LY_HDR, "w:"),
      createToken(TT.LY_TXT, "word"),
      createToken(TT.WS, " "),
      createToken(TT.LY_STAR, "*"),
      createToken(TT.WS, " "),
      createToken(TT.LY_TXT, "word"),
    ];
    const ctx = createParseCtx(tokens);

    const result = prsLyricSection(ctx);

    assert.isNotNull(result);
    const infoLine = result!.info_lines[0];
    assert.equal(infoLine.value[2].type, TT.LY_STAR);
  });

  it("should parse lyric line with tilde (word space)", () => {
    const tokens = [
      createToken(TT.LY_HDR, "w:"),
      createToken(TT.LY_TXT, "of"),
      createToken(TT.LY_SPS, "~"),
      createToken(TT.LY_TXT, "the"),
      createToken(TT.LY_SPS, "~"),
      createToken(TT.LY_TXT, "day"),
    ];
    const ctx = createParseCtx(tokens);

    const result = prsLyricSection(ctx);

    assert.isNotNull(result);
    const infoLine = result!.info_lines[0];
    assert.equal(infoLine.value[1].type, TT.LY_SPS);
    assert.equal(infoLine.value[3].type, TT.LY_SPS);
  });

  it("should parse lyric line with barlines", () => {
    const tokens = [
      createToken(TT.LY_HDR, "w:"),
      createToken(TT.LY_TXT, "word"),
      createToken(TT.WS, " "),
      createToken(TT.BARLINE, "|"),
      createToken(TT.WS, " "),
      createToken(TT.LY_TXT, "word"),
    ];
    const ctx = createParseCtx(tokens);

    const result = prsLyricSection(ctx);

    assert.isNotNull(result);
    const infoLine = result!.info_lines[0];
    assert.equal(infoLine.value[2].type, TT.BARLINE);
  });

  it("should parse lyric line with comments", () => {
    const tokens = [createToken(TT.LY_HDR, "w:"), createToken(TT.LY_TXT, "lyrics"), createToken(TT.WS, " "), createToken(TT.COMMENT, "%comment")];
    const ctx = createParseCtx(tokens);

    const result = prsLyricSection(ctx);

    assert.isNotNull(result);
    const infoLine = result!.info_lines[0];
    assert.equal(infoLine.value[2].type, TT.COMMENT);
  });

  it("should parse lyric line with field continuation", () => {
    const tokens = [
      createToken(TT.LY_HDR, "w:"),
      createToken(TT.LY_TXT, "first"),
      createToken(TT.EOL, "\n"),
      createToken(TT.INF_CTND, "+:"),
      createToken(TT.LY_TXT, "second"),
    ];
    const ctx = createParseCtx(tokens);

    const result = prsLyricSection(ctx);

    assert.isNotNull(result);
    assert.equal(result!.info_lines.length, 1);
  });

  it("should return null for non-lyric tokens", () => {
    const tokens = [createToken(TT.INF_HDR, "T:"), createToken(TT.INFO_STR, "Title")];
    const ctx = createParseCtx(tokens);

    const result = prsLyricSection(ctx);

    assert.isNull(result);
  });

  it("should handle empty lyric line", () => {
    const tokens = [createToken(TT.LY_HDR, "w:")];
    const ctx = createParseCtx(tokens);

    const result = prsLyricSection(ctx);

    assert.isNotNull(result);
    const infoLine = result!.info_lines[0];
    assert.equal(infoLine.key.type, TT.LY_HDR);
  });

  it("should handle multiple special characters in sequence", () => {
    const tokens = [
      createToken(TT.LY_HDR, "w:"),
      createToken(TT.LY_TXT, "word"),
      createToken(TT.LY_HYPH, "-"),
      createToken(TT.LY_UNDR, "_"),
      createToken(TT.LY_STAR, "*"),
      createToken(TT.LY_SPS, "~"),
      createToken(TT.BARLINE, "|"),
    ];
    const ctx = createParseCtx(tokens);

    const result = prsLyricSection(ctx);

    assert.isNotNull(result);
    const infoLine = result!.info_lines[0];
    assert.equal(infoLine.value[0].type, TT.LY_TXT);
    assert.equal(infoLine.value[1].type, TT.LY_HYPH);
    assert.equal(infoLine.value[2].type, TT.LY_UNDR);
    assert.equal(infoLine.value[3].type, TT.LY_STAR);
    assert.equal(infoLine.value[4].type, TT.LY_SPS);
    assert.equal(infoLine.value[5].type, TT.BARLINE);
  });

  it("should stop parsing at end of tokens", () => {
    const tokens = [createToken(TT.LY_HDR, "w:"), createToken(TT.LY_TXT, "lyrics")];
    const ctx = createParseCtx(tokens);

    const result = prsLyricSection(ctx);

    assert.isNotNull(result);
    assert.equal(result!.info_lines.length, 1);
    assert.equal(ctx.current, 2); // Should have consumed all tokens
  });
});
