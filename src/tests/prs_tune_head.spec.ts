import { assert } from "chai";
import { prsTuneHdr } from "../parsers/parse2";
import { TT } from "../parsers/scan2";
import { Tune_header, Info_line, Comment, Directive } from "../types/Expr2";
import { createToken, createParseCtx } from "./prs_music_code.spec";

describe("prsTuneHdr", () => {
  it("should parse a basic tune header", () => {
    const tokens = [
      createToken(TT.INF_HDR, "X:"),
      createToken(TT.INFO_STR, "1"),
      createToken(TT.EOL, "\n"),
      createToken(TT.INF_HDR, "T:"),
      createToken(TT.INFO_STR, "Test Tune"),
      createToken(TT.EOL, "\n"),
      createToken(TT.INF_HDR, "K:"),
      createToken(TT.SPECIAL_LITERAL, "C"),
      createToken(TT.EOL, "\n"),
      createToken(TT.SCT_BRK, "\n\n"),
    ];
    const ctx = createParseCtx(tokens);

    const result = prsTuneHdr(ctx);

    assert.isNotNull(result);
    assert.instanceOf(result, Tune_header);
    assert.equal(result.info_lines.length, 3);
    assert.equal(result.voices.length, 0);

    // Check that all info lines were parsed correctly
    assert.equal((result.info_lines[0] as Info_line).key.lexeme, "X:");
    assert.equal((result.info_lines[0] as Info_line).value[0].lexeme, "1");
    assert.equal((result.info_lines[1] as Info_line).key.lexeme, "T:");
    assert.equal((result.info_lines[1] as Info_line).value[0].lexeme, "Test Tune");
    assert.equal((result.info_lines[2] as Info_line).key.lexeme, "K:");
    assert.equal((result.info_lines[2] as Info_line).value[0].lexeme, "C");
  });

  it("should detect and collect voice names", () => {
    const tokens = [
      createToken(TT.INF_HDR, "X:"),
      createToken(TT.INFO_STR, "1"),
      createToken(TT.EOL, "\n"),
      createToken(TT.INF_HDR, "T:"),
      createToken(TT.INFO_STR, '"Test Tune"'),
      createToken(TT.EOL, "\n"),
      createToken(TT.INF_HDR, "V:"),
      createToken(TT.IDENTIFIER, "Soprano"),
      createToken(TT.EOL, "\n"),
      createToken(TT.INF_HDR, "K:"),
      createToken(TT.SPECIAL_LITERAL, "C"),
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
      createToken(TT.IDENTIFIER, "Soprano"),
      createToken(TT.EOL, "\n"),
      createToken(TT.INF_HDR, "V:"),
      createToken(TT.IDENTIFIER, "Alto"),
      createToken(TT.EOL, "\n"),
      createToken(TT.INF_HDR, "V:"),
      createToken(TT.IDENTIFIER, "Tenor"),
      createToken(TT.EOL, "\n"),
      createToken(TT.INF_HDR, "K:"),
      createToken(TT.SPECIAL_LITERAL, "C"),
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
      createToken(TT.SPECIAL_LITERAL, "C"),
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
      createToken(TT.SPECIAL_LITERAL, "C"),
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
      createToken(TT.SPECIAL_LITERAL, "C"),
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
      createToken(TT.IDENTIFIER, "Soprano"),
      createToken(TT.EOL, "\n"),
      createToken(TT.INF_HDR, "K:"),
      createToken(TT.SPECIAL_LITERAL, "C"),
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
