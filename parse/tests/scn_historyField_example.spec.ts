import { assert } from "chai";
import { ABCContext } from "../parsers/Context";
import { Scanner, TT } from "../parsers/scan2";
import { ParseCtx, prsTuneHdr } from "../parsers/parse2";
import { Info_line } from "../types/Expr2";

/**
 * Example-based test for the H: (history) info field with multi-line continuation.
 * Because the H: field spans multiple lines until the next info field is encountered,
 * we need to verify that the scanner correctly collects continuation lines and that
 * the parser correctly separates the H: field from the subsequent M: info line.
 *
 * Source: St Louis Tickle (X:43) from BarFly sample file.
 */

const stLouisTickleHeader = [
  "X:43",
  "T:St Louis Tickle",
  "N:From BarFly sample file.",
  "N:Chords in HTL order.  Multiple ties and slurs between chords.",
  "N:H: field continued over several lines.  Tied rests.",
  "C:I dont know who wrote it",
  "R:Ragtime",
  "H:Piano rag arranged for guitar",
  "I believe it was written for the St Louis World's Fair of ca. 1916.",
  "Guitar arrangement by Happy Traum, but this is transcribed from my own",
  "playing, and since I have played it for many years it may have been a",
  "little 'folk processed'.",
  "M:12/8",
  "Q:300",
  "K:C",
].join("\n");

describe("H: field multi-line continuation (St Louis Tickle example)", () => {
  describe("Scanner output", () => {
    it("should tokenize the H: field with its continuation lines as INF_HDR + INFO_STR + FREE_TXT", () => {
      const ctx = new ABCContext();
      const tokens = Scanner(stLouisTickleHeader, ctx);

      // Find the H: header token
      const hIndex = tokens.findIndex(
        (t) => t.type === TT.INF_HDR && t.lexeme === "H:"
      );
      assert.isAbove(hIndex, -1, "H: token should be present");

      assert.equal(tokens[hIndex].type, TT.INF_HDR);
      assert.equal(tokens[hIndex].lexeme, "H:");

      // The first-line content follows as INFO_STR
      assert.equal(tokens[hIndex + 1].type, TT.INFO_STR);
      assert.equal(tokens[hIndex + 1].lexeme, "Piano rag arranged for guitar");

      // The continuation lines are collected into a single FREE_TXT token
      assert.equal(tokens[hIndex + 2].type, TT.FREE_TXT);
      assert.include(
        tokens[hIndex + 2].lexeme,
        "I believe it was written for the St Louis World's Fair of ca. 1916."
      );
      assert.include(
        tokens[hIndex + 2].lexeme,
        "Guitar arrangement by Happy Traum"
      );
      assert.include(
        tokens[hIndex + 2].lexeme,
        "little 'folk processed'."
      );
    });

    it("should tokenize M:12/8 as a separate info line after the H: continuation", () => {
      const ctx = new ABCContext();
      const tokens = Scanner(stLouisTickleHeader, ctx);

      // Find the M: header token
      const mIndex = tokens.findIndex(
        (t) => t.type === TT.INF_HDR && t.lexeme === "M:"
      );
      assert.isAbove(mIndex, -1, "M: token should be present");

      assert.equal(tokens[mIndex].type, TT.INF_HDR);
      assert.equal(tokens[mIndex].lexeme, "M:");

      // M:12/8 should be tokenized as NUMBER SLASH NUMBER
      assert.equal(tokens[mIndex + 1].type, TT.NUMBER);
      assert.equal(tokens[mIndex + 1].lexeme, "12");
      assert.equal(tokens[mIndex + 2].type, TT.SLASH);
      assert.equal(tokens[mIndex + 2].lexeme, "/");
      assert.equal(tokens[mIndex + 3].type, TT.NUMBER);
      assert.equal(tokens[mIndex + 3].lexeme, "8");
    });

    it("should assign correct line numbers to tokens after the H: continuation", () => {
      const ctx = new ABCContext();
      const tokens = Scanner(stLouisTickleHeader, ctx);

      // The H: field starts at line 7 (0-indexed), and its continuation spans 4 more lines.
      // So M:12/8 should be at line 12.
      const mIndex = tokens.findIndex(
        (t) => t.type === TT.INF_HDR && t.lexeme === "M:"
      );
      assert.equal(tokens[mIndex].line, 12, "M: should be on line 12 (0-indexed)");

      const qIndex = tokens.findIndex(
        (t) => t.type === TT.INF_HDR && t.lexeme === "Q:"
      );
      assert.equal(tokens[qIndex].line, 13, "Q: should be on line 13 (0-indexed)");

      const kIndex = tokens.findIndex(
        (t) => t.type === TT.INF_HDR && t.lexeme === "K:"
      );
      assert.equal(tokens[kIndex].line, 14, "K: should be on line 14 (0-indexed)");
    });

    it("should not include M:12/8 content inside the H: continuation token", () => {
      const ctx = new ABCContext();
      const tokens = Scanner(stLouisTickleHeader, ctx);

      const hIndex = tokens.findIndex(
        (t) => t.type === TT.INF_HDR && t.lexeme === "H:"
      );
      const freeTxt = tokens[hIndex + 2];
      assert.equal(freeTxt.type, TT.FREE_TXT);
      assert.notInclude(freeTxt.lexeme, "M:12/8");
      assert.notInclude(freeTxt.lexeme, "12/8");
    });
  });

  describe("Parser output", () => {
    it("should parse the H: field as a distinct Info_line in the tune header", () => {
      const ctx = new ABCContext();
      const tokens = Scanner(stLouisTickleHeader, ctx);
      const parseCtx = new ParseCtx(tokens, ctx);

      const header = prsTuneHdr(parseCtx);
      assert.isNotNull(header);

      const infoLines = header.info_lines.filter(
        (expr) => expr instanceof Info_line
      ) as Info_line[];

      const hLine = infoLines.find((il) => il.key.lexeme === "H:");
      assert.isDefined(hLine, "H: info line should be present in the parsed header");

      // The value tokens should contain the first-line content and the continuation
      const valueTypes = hLine!.value.map((t) => t.type);
      assert.include(valueTypes, TT.INFO_STR);
      assert.include(valueTypes, TT.FREE_TXT);
    });

    it("should parse M:12/8 as a separate Info_line following the H: field", () => {
      const ctx = new ABCContext();
      const tokens = Scanner(stLouisTickleHeader, ctx);
      const parseCtx = new ParseCtx(tokens, ctx);

      const header = prsTuneHdr(parseCtx);
      assert.isNotNull(header);

      const infoLines = header.info_lines.filter(
        (expr) => expr instanceof Info_line
      ) as Info_line[];

      const mLine = infoLines.find((il) => il.key.lexeme === "M:");
      assert.isDefined(mLine, "M: info line should be present in the parsed header");

      // The M: line should have parsed meter values (12/8)
      const mValueLexemes = mLine!.value.map((t) => t.lexeme);
      assert.include(mValueLexemes, "12");
      assert.include(mValueLexemes, "/");
      assert.include(mValueLexemes, "8");
    });

    it("should parse all expected info lines in the correct order", () => {
      const ctx = new ABCContext();
      const tokens = Scanner(stLouisTickleHeader, ctx);
      const parseCtx = new ParseCtx(tokens, ctx);

      const header = prsTuneHdr(parseCtx);
      assert.isNotNull(header);

      const infoLines = header.info_lines.filter(
        (expr) => expr instanceof Info_line
      ) as Info_line[];

      const keys = infoLines.map((il) => il.key.lexeme);
      assert.deepEqual(keys, [
        "X:", "T:", "N:", "N:", "N:", "C:", "R:", "H:", "M:", "Q:", "K:"
      ]);
    });
  });
});
