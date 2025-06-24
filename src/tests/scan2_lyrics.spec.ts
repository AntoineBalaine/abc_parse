import assert from "assert";
import { describe, it } from "mocha";
import { TT } from "../parsers/scan2";
import { field_continuation, lyric_line } from "../parsers/scan_tunebody";
import { createCtx } from "./scan2_tuneBodyTokens.spec";

describe("Lyric Line Scanning", () => {
  describe("lyric_line", () => {
    it("should parse a simple lyric line", () => {
      const ctx = createCtx("w:lyrics");
      const result = lyric_line(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 2);
      assert.equal(ctx.tokens[0].type, TT.LY_HDR);
      assert.equal(ctx.tokens[1].type, TT.LY_TXT);
    });

    it("should parse a section lyric line", () => {
      const ctx = createCtx("W:lyrics for section");
      const result = lyric_line(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens[0].type, TT.LY_SECT_HDR);
    });

    it("should parse a lyric line with special symbols", () => {
      const ctx = createCtx("w:syll-a-ble");
      const result = lyric_line(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 6);
      assert.equal(ctx.tokens[0].type, TT.LY_HDR);
      assert.equal(ctx.tokens[1].type, TT.LY_TXT);
      assert.equal(ctx.tokens[2].type, TT.LY_HYPH);
      assert.equal(ctx.tokens[3].type, TT.LY_TXT);
      assert.equal(ctx.tokens[4].type, TT.LY_HYPH);
      assert.equal(ctx.tokens[5].type, TT.LY_TXT);
    });

    it("should parse a lyric line with underscore", () => {
      const ctx = createCtx("w:time__");
      const result = lyric_line(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 4);
      assert.equal(ctx.tokens[0].type, TT.LY_HDR);
      assert.equal(ctx.tokens[1].type, TT.LY_TXT);
      assert.equal(ctx.tokens[2].type, TT.LY_UNDR);
      assert.equal(ctx.tokens[3].type, TT.LY_UNDR);
    });

    it("should parse a lyric line with asterisk", () => {
      const ctx = createCtx("w:word * word");
      const result = lyric_line(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens[0].type, TT.LY_HDR);
      assert.equal(ctx.tokens[1].type, TT.LY_TXT);
      assert.equal(ctx.tokens[3].type, TT.LY_STAR);
      assert.equal(ctx.tokens[5].type, TT.LY_TXT);
    });

    it("should parse a lyric line with tilde", () => {
      const ctx = createCtx("w:of~the~day");
      const result = lyric_line(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 6);
      assert.equal(ctx.tokens[0].type, TT.LY_HDR);
      assert.equal(ctx.tokens[1].type, TT.LY_TXT);
      assert.equal(ctx.tokens[2].type, TT.LY_SPS);
      assert.equal(ctx.tokens[3].type, TT.LY_TXT);
      assert.equal(ctx.tokens[4].type, TT.LY_SPS);
      assert.equal(ctx.tokens[5].type, TT.LY_TXT);
    });

    it("should parse a lyric line with escaped hyphen", () => {
      const ctx = createCtx("w:multi\\-syllable");
      const result = lyric_line(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 4);
      assert.equal(ctx.tokens[0].type, TT.LY_HDR);
      assert.equal(ctx.tokens[1].type, TT.LY_TXT);
      assert.equal(ctx.tokens[2].type, TT.LY_HYPH);
      assert.equal(ctx.tokens[3].type, TT.LY_TXT);
    });

    it("should parse a lyric line with bar advancement", () => {
      const ctx = createCtx("w:word | word");
      const result = lyric_line(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens[0].type, TT.LY_HDR);
      assert.equal(ctx.tokens[1].type, TT.LY_TXT);
      assert.equal(ctx.tokens[3].type, TT.BARLINE);
      assert.equal(ctx.tokens[5].type, TT.LY_TXT);
    });

    it("should parse a lyric line with complex barlines", () => {
      const ctx = createCtx("w:word || word");
      const result = lyric_line(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens[0].type, TT.LY_HDR);
      assert.equal(ctx.tokens[1].type, TT.LY_TXT);
      assert.equal(ctx.tokens[3].type, TT.BARLINE);
      assert.equal(ctx.tokens[5].type, TT.LY_TXT);
    });

    it("should parse a lyric line with comment", () => {
      const ctx = createCtx("w:lyrics %comment");
      const result = lyric_line(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens[0].type, TT.LY_HDR);
      assert.equal(ctx.tokens[1].type, TT.LY_TXT);
      assert.equal(ctx.tokens[3].type, TT.COMMENT);
    });

    it("should handle multiple special characters in sequence", () => {
      const ctx = createCtx("w:word-_*~\\-|");
      const result = lyric_line(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens[0].type, TT.LY_HDR);
      assert.equal(ctx.tokens[1].type, TT.LY_TXT);
      assert.equal(ctx.tokens[2].type, TT.LY_HYPH);
      assert.equal(ctx.tokens[3].type, TT.LY_UNDR);
      assert.equal(ctx.tokens[4].type, TT.LY_STAR);
      assert.equal(ctx.tokens[5].type, TT.LY_SPS);
      assert.equal(ctx.tokens[6].type, TT.LY_HYPH);
      assert.equal(ctx.tokens[7].type, TT.BARLINE);
    });
  });

  describe("field_continuation", () => {
    it("should parse a field continuation", () => {
      const ctx = createCtx("\n+: continued");
      const result = field_continuation(ctx);
      assert.equal(result, true);
      assert.equal(ctx.tokens.length, 1);
      assert.equal(ctx.tokens[0].type, TT.INF_CTND);
    });

    it("should return false for non-field continuation", () => {
      const ctx = createCtx("+: not a continuation");
      const result = field_continuation(ctx);
      assert.equal(result, false);
      assert.equal(ctx.tokens.length, 0);
    });
  });
});
