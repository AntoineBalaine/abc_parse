import { assert } from "chai";
import { describe, it } from "mocha";
import { ABCContext } from "../parsers/Context";
import { ParseCtx, prsLyricSection } from "../parsers/parse2";
import { Token, TT } from "../parsers/scan2";
import { Info_line, Lyric_section } from "../types/Expr2";
import { createToken } from "./prs_music_code.spec";
import { prsInfoLine } from "../parsers/parse2";
import { isKeyInfo, isMeterInfo, isVoiceInfo, isTempoInfo, isNoteLengthInfo } from "../types/Expr2";
import fc from "fast-check";
import { genKeySignature, genNoteLenSignature, genTempoLine, genVxDefinition, sharedContext } from "./scn_pbt.generators.spec";
import { genMeterDefinition } from "./scanMeterInfo.spec";

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

describe("Info Line Parser Integration Tests", () => {
  // Import the new parser and type predicates

  describe("Basic Integration Tests", () => {
    it("should parse key info line with parsed data", () => {
      const tokens = [createToken(TT.INF_HDR, "K:"), createToken(TT.KEY_ROOT, "C"), createToken(TT.KEY_MODE, "major")];

      const ctx = createParseCtx(tokens);
      const result = prsInfoLine(ctx);

      assert.instanceOf(result, Info_line);
      assert.isDefined(result!.parsed);
      assert.isTrue(isKeyInfo(result!.parsed!));
      if (isKeyInfo(result!.parsed!)) {
        assert.equal(result!.parsed.data.keySignature.root, "C");
        assert.equal(result!.parsed.data.keySignature.mode, "");
      }
    });

    it("should parse meter info line with parsed data", () => {
      const tokens = [
        createToken(TT.INF_HDR, "M:"),
        createToken(TT.METER_NUMBER, "4"),
        createToken(TT.METER_SEPARATOR, "/"),
        createToken(TT.METER_NUMBER, "4"),
      ];

      const ctx = createParseCtx(tokens);
      const result = prsInfoLine(ctx);

      assert.instanceOf(result, Info_line);
      assert.isDefined(result!.parsed);
      assert.isTrue(isMeterInfo(result!.parsed!));
      if (isMeterInfo(result!.parsed!)) {
        assert.equal(result!.parsed.data.type, "specified");
        assert.isDefined(result!.parsed.data.value);
        assert.equal(result!.parsed.data.value![0].num, 4);
        assert.equal(result!.parsed.data.value![0].den, 4);
      }
    });

    it("should parse note length info line with parsed data", () => {
      const tokens = [createToken(TT.INF_HDR, "L:"), createToken(TT.NOTE_LEN_NUM, "1"), createToken(TT.NOTE_LEN_DENOM, "8")];

      const ctx = createParseCtx(tokens);
      const result = prsInfoLine(ctx);

      assert.instanceOf(result, Info_line);
      assert.isDefined(result!.parsed);
      assert.isTrue(isNoteLengthInfo(result!.parsed!));
      if (isNoteLengthInfo(result!.parsed!)) {
        assert.equal(result!.parsed.data.numerator, 1);
        assert.equal(result!.parsed.data.denominator, 8);
      }
    });

    it("should parse tempo info line with parsed data", () => {
      const tokens = [createToken(TT.INF_HDR, "Q:"), createToken(TT.TEMPO_TEXT, '"Allegro"'), createToken(TT.TEMPO_BPM, "120")];

      const ctx = createParseCtx(tokens);
      const result = prsInfoLine(ctx);

      assert.instanceOf(result, Info_line);
      assert.isDefined(result!.parsed);
      assert.isTrue(isTempoInfo(result!.parsed!));
      if (isTempoInfo(result!.parsed!)) {
        assert.equal(result!.parsed.data.preString, "Allegro");
        assert.equal(result!.parsed.data.bpm, 120);
      }
    });

    it("should parse voice info line with parsed data", () => {
      const tokens = [createToken(TT.INF_HDR, "V:"), createToken(TT.VX_ID, "1"), createToken(TT.VX_K, "name"), createToken(TT.VX_V, '"Soprano"')];

      const ctx = createParseCtx(tokens);
      const result = prsInfoLine(ctx);

      assert.instanceOf(result, Info_line);
      assert.isDefined(result!.parsed);
      assert.isTrue(isVoiceInfo(result!.parsed!));
      if (isVoiceInfo(result!.parsed!)) {
        assert.equal(result!.parsed.data.id, "1");
        assert.equal(result!.parsed.data.properties.name, "Soprano");
      }
    });

    it("should handle unknown info line types without parsed data", () => {
      const tokens = [createToken(TT.INF_HDR, "T:"), createToken(TT.INFO_STR, "My Title")];

      const ctx = createParseCtx(tokens);
      const result = prsInfoLine(ctx);

      assert.instanceOf(result, Info_line);
      assert.isUndefined(result!.parsed);
      assert.equal(result!.key.lexeme, "T:");
      assert.equal(result!.value[0].lexeme, "My Title");
    });

    it("should handle common time meter", () => {
      const tokens = [createToken(TT.INF_HDR, "M:"), createToken(TT.METER_C, "C")];

      const ctx = createParseCtx(tokens);
      const result = prsInfoLine(ctx);

      assert.instanceOf(result, Info_line);
      assert.isDefined(result!.parsed);
      assert.isTrue(isMeterInfo(result!.parsed!));
      if (isMeterInfo(result!.parsed!)) {
        assert.equal(result!.parsed.data.type, "common_time");
      }
    });

    it("should handle cut time meter", () => {
      const tokens = [createToken(TT.INF_HDR, "M:"), createToken(TT.METER_C_BAR, "C|")];

      const ctx = createParseCtx(tokens);
      const result = prsInfoLine(ctx);

      assert.instanceOf(result, Info_line);
      assert.isDefined(result!.parsed);
      assert.isTrue(isMeterInfo(result!.parsed!));
      if (isMeterInfo(result!.parsed!)) {
        assert.equal(result!.parsed.data.type, "cut_time");
      }
    });
  });

  describe("Property-Based Integration Tests", () => {
    // Create info line generators by adding headers to existing scanner generators
    const genKeyInfoLine = genKeySignature.map((keyTokens: Token[]) => [
      new Token(TT.INF_HDR, "K:", sharedContext.generateId()),
      ...keyTokens.filter((t) => t.type !== TT.WS && t.type !== TT.DISCARD),
    ]);

    const genMeterInfoLine = genMeterDefinition.map((meterTokens: Token[]) => [
      new Token(TT.INF_HDR, "M:", sharedContext.generateId()),
      ...meterTokens.filter((t) => t.type !== TT.WS && t.type !== TT.DISCARD),
    ]);

    const genNoteLenInfoLine = genNoteLenSignature.map((noteLenTokens: Token[]) => [
      new Token(TT.INF_HDR, "L:", sharedContext.generateId()),
      ...noteLenTokens.filter((t) => t.type !== TT.WS && t.type !== TT.DISCARD),
    ]);

    const genTempoInfoLine = genTempoLine.map((tempoTokens: Token[]) => [
      new Token(TT.INF_HDR, "Q:", sharedContext.generateId()),
      ...tempoTokens.filter((t) => t.type !== TT.WS && t.type !== TT.DISCARD),
    ]);

    const genVoiceInfoLine = genVxDefinition.map((voiceTokens: Token[]) => [
      new Token(TT.INF_HDR, "V:", sharedContext.generateId()),
      ...voiceTokens.filter((t) => t.type !== TT.WS && t.type !== TT.DISCARD),
    ]);

    // Combined info line generator
    const genInfoLine = fc.oneof(genKeyInfoLine, genMeterInfoLine, genNoteLenInfoLine, genTempoInfoLine, genVoiceInfoLine);

    function createIntegrationPredicate(tokens: Token[]): boolean {
      tokens = tokens.filter((t) => t.type !== TT.WS); // Remove whitespace tokens
      const ctx = createParseCtx(tokens);
      const result = prsInfoLine(ctx);

      if (!result) {
        console.log(
          "Parser returned null for tokens:",
          tokens.map((t) => `${TT[t.type]}:${t.lexeme}`)
        );
        return false;
      }

      // Verify basic structure
      if (!(result instanceof Info_line)) {
        console.log("Result is not an Info_line instance");
        return false;
      }

      // Verify that specialized parsers were called for known types
      const headerType = tokens[0].lexeme.charAt(0);
      const shouldHaveParsedData = ["K", "M", "L", "Q", "V"].includes(headerType);

      if (shouldHaveParsedData && !result.parsed) {
        console.log(`Expected parsed data for ${headerType}: info line but got none`);
        return false;
      }

      if (result.parsed) {
        // Verify the parsed data type matches the header
        const expectedType = {
          K: "key",
          M: "meter",
          L: "note_length",
          Q: "tempo",
          V: "voice",
        }[headerType];

        if (result.parsed.type !== expectedType) {
          console.log(`Expected parsed type ${expectedType} but got ${result.parsed.type}`);
          return false;
        }

        // Basic validation of parsed data structure
        if (!result.parsed.data) {
          console.log("Parsed data is missing");
          return false;
        }
      }

      return true;
    }

    it("should successfully parse all generated info line types", () => {
      fc.assert(fc.property(genInfoLine, createIntegrationPredicate), {
        verbose: false,
        numRuns: 500,
      });
    });

    it("should handle key signatures correctly", () => {
      fc.assert(
        fc.property(genKeyInfoLine, (tokens: Token[]) => {
          // Don’t include WS tokens in parse step.
          tokens = tokens.filter((t) => t.type !== TT.WS);
          const ctx = createParseCtx(tokens);
          const result = prsInfoLine(ctx);

          if (!result || !result.parsed || !isKeyInfo(result.parsed)) {
            prsInfoLine(createParseCtx(tokens));
            return false;
          }

          const keyData = result.parsed.data;

          const rv =
            typeof keyData.keySignature.root === "string" &&
            typeof keyData.keySignature.acc === "string" &&
            typeof keyData.keySignature.mode === "string" &&
            Array.isArray(keyData.keySignature.accidentals);
          // Basic validation of key signature structure
          return rv;
        }),
        {
          verbose: false,
          numRuns: 200,
        }
      );
    });

    it("should handle meters correctly", () => {
      fc.assert(
        fc.property(genMeterInfoLine, (tokens: Token[]) => {
          const ctx = createParseCtx(tokens);
          const result = prsInfoLine(ctx);

          if (!result || !result.parsed || !isMeterInfo(result.parsed)) {
            return false;
          }

          const meterData = result.parsed.data;

          // Basic validation of meter structure
          return typeof meterData.type === "string" && ["common_time", "cut_time", "specified"].includes(meterData.type);
        }),
        {
          verbose: false,
          numRuns: 200,
        }
      );
    });

    it("should handle note lengths correctly", () => {
      fc.assert(
        fc.property(genNoteLenInfoLine, (tokens: Token[]) => {
          const ctx = createParseCtx(tokens);
          const result = prsInfoLine(ctx);

          if (!result || !result.parsed || !isNoteLengthInfo(result.parsed)) {
            return false;
          }

          const noteLenData = result.parsed.data;

          // Basic validation of note length structure
          return (
            typeof noteLenData.numerator === "number" &&
            typeof noteLenData.denominator === "number" &&
            noteLenData.numerator > 0 &&
            noteLenData.denominator > 0
          );
        }),
        {
          verbose: false,
          numRuns: 200,
        }
      );
    });

    it("should handle tempos correctly", () => {
      fc.assert(
        fc.property(genTempoInfoLine, (tokens: Token[]) => {
          const ctx = createParseCtx(tokens);
          const result = prsInfoLine(ctx);

          if (!result || !result.parsed || !isTempoInfo(result.parsed)) {
            return false;
          }

          const tempoData = result.parsed.data;

          // Basic validation of tempo structure
          return (
            (tempoData.preString === undefined || typeof tempoData.preString === "string") &&
            (tempoData.postString === undefined || typeof tempoData.postString === "string") &&
            (tempoData.bpm === undefined || typeof tempoData.bpm === "number") &&
            (tempoData.duration === undefined || Array.isArray(tempoData.duration))
          );
        }),
        {
          verbose: false,
          numRuns: 200,
        }
      );
    });

    it("should handle voices correctly", () => {
      fc.assert(
        fc.property(genVoiceInfoLine, (tokens: Token[]) => {
          const ctx = createParseCtx(tokens);
          const result = prsInfoLine(ctx);

          if (!result || !result.parsed || !isVoiceInfo(result.parsed)) {
            return false;
          }

          const voiceData = result.parsed.data;

          // Basic validation of voice structure
          return typeof voiceData.id === "string" && typeof voiceData.properties === "object" && voiceData.properties !== null;
        }),
        {
          verbose: false,
          numRuns: 200,
        }
      );
    });

    it("should never crash on generated info lines", () => {
      fc.assert(
        fc.property(genInfoLine, (tokens: Token[]) => {
          try {
            const ctx = createParseCtx(tokens);
            prsInfoLine(ctx);
            return true;
          } catch (e) {
            console.log(
              "Crash on input:",
              tokens.map((t) => `${TT[t.type]}:${t.lexeme}`),
              e
            );
            return false;
          }
        }),
        {
          verbose: false,
          numRuns: 500,
        }
      );
    });
  });
});
