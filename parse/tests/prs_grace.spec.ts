import { assert } from "chai";
import { parseGraceGroup } from "../parsers/parse2";
import { TT } from "../parsers/scan2";
import { Grace_group, Note } from "../types/Expr2";
import { createToken, createParseCtx } from "./prs_music_code.spec";

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
