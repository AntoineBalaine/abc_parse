import * as fc from "fast-check";
import { assert } from "chai";
import { Token, TT } from "../parsers/scan2";
import { Info_line } from "../types/Expr2";
import { InfoLineFmt } from "../infoLineFmt";
import { genVxKV, genVxDefinition, genKeyInfoLine, genVxPropKey, genVxPropVal, sharedContext } from "./scn_pbt.generators.spec";

describe("InfoLineFmt", () => {
  describe("genericFmt function", () => {
    describe("key-value pair formatting", () => {
      it("should format simple key=value pairs without spaces around =", () => {
        fc.assert(
          fc.property(genVxKV, (kvTokens) => {
            // Create an info line with V: header and the key-value tokens
            const tokens = [new Token(TT.INF_HDR, "V:", sharedContext.generateId()), ...kvTokens];
            const infoLine = new Info_line(1, tokens);

            const result = InfoLineFmt(infoLine);

            // The result should contain key=value without spaces around =
            // Find the = sign and verify no spaces around it
            const eqlIndex = result.indexOf("=");
            if (eqlIndex > 0) {
              assert.notEqual(result[eqlIndex - 1], " ", "Should not have space before =");
              assert.notEqual(result[eqlIndex + 1], " ", "Should not have space after =");
            }
          })
        );
      });

      it("should handle multiple key=value pairs correctly", () => {
        fc.assert(
          fc.property(fc.array(genVxKV, { minLength: 1, maxLength: 3 }), (kvPairs) => {
            // Flatten the key-value pairs and add whitespace between them
            const tokens = [new Token(TT.INF_HDR, "V:", sharedContext.generateId())];
            const voiceId = new Token(TT.VX_ID, "1", sharedContext.generateId());
            tokens.push(voiceId);

            for (let i = 0; i < kvPairs.length; i++) {
              tokens.push(new Token(TT.WS, " ", sharedContext.generateId()));
              tokens.push(...kvPairs[i]);
            }

            const infoLine = new Info_line(1, tokens);
            const result = InfoLineFmt(infoLine);

            // Count the number of = signs in the result
            const eqlCount = (result.match(/=/g) || []).length;
            assert.equal(eqlCount, kvPairs.length, "Should have correct number of key=value pairs");

            // Verify no spaces around any = signs
            for (let i = 0; i < result.length; i++) {
              if (result[i] === "=") {
                if (i > 0) assert.notEqual(result[i - 1], " ", `Should not have space before = at position ${i}`);
                if (i < result.length - 1) assert.notEqual(result[i + 1], " ", `Should not have space after = at position ${i}`);
              }
            }
          })
        );
      });

      it("should handle voice definitions with mixed content", () => {
        fc.assert(
          fc.property(genVxDefinition, (voiceTokens) => {
            const tokens = [new Token(TT.INF_HDR, "V:", sharedContext.generateId()), ...voiceTokens];
            const infoLine = new Info_line(1, tokens);

            const result = InfoLineFmt(infoLine);

            // Should start with V:
            assert.isTrue(result.startsWith("V:"), "Should start with V:");

            // All = signs should have no spaces around them
            for (let i = 0; i < result.length; i++) {
              if (result[i] === "=") {
                if (i > 0) assert.notEqual(result[i - 1], " ", `Should not have space before = at position ${i}`);
                if (i < result.length - 1) assert.notEqual(result[i + 1], " ", `Should not have space after = at position ${i}`);
              }
            }
          })
        );
      });
    });

    describe("round-trip formatting tests", () => {
      it("should preserve key=value structure in voice info lines", () => {
        fc.assert(
          fc.property(genVxPropKey, genVxPropVal, (keyToken, valueToken) => {
            // Create a simple voice line: V:1 key=value
            const tokens = [
              new Token(TT.INF_HDR, "V:", sharedContext.generateId()),
              new Token(TT.VX_ID, "1", sharedContext.generateId()),
              new Token(TT.WS, " ", sharedContext.generateId()),
              keyToken,
              new Token(TT.EQL, "=", sharedContext.generateId()),
              valueToken,
            ];

            const infoLine = new Info_line(1, tokens);
            const result = InfoLineFmt(infoLine);

            // Should contain the key and value
            assert.isTrue(result.includes(keyToken.lexeme), `Should contain key: ${keyToken.lexeme}`);
            assert.isTrue(result.includes(valueToken.lexeme), `Should contain value: ${valueToken.lexeme}`);

            // Should have key=value pattern (no spaces around =)
            const expectedPattern = keyToken.lexeme + "=" + valueToken.lexeme;
            assert.isTrue(result.includes(expectedPattern), `Should contain pattern: ${expectedPattern}`);
          })
        );
      });

      it("should handle edge cases with whitespace", () => {
        // Test case with extra whitespace around key=value
        const tokens = [
          new Token(TT.INF_HDR, "V:", sharedContext.generateId()),
          new Token(TT.VX_ID, "1", sharedContext.generateId()),
          new Token(TT.WS, "  ", sharedContext.generateId()), // extra whitespace
          new Token(TT.VX_K, "name", sharedContext.generateId()),
          new Token(TT.WS, " ", sharedContext.generateId()), // whitespace before =
          new Token(TT.EQL, "=", sharedContext.generateId()),
          new Token(TT.WS, " ", sharedContext.generateId()), // whitespace after =
          new Token(TT.VX_V, '"Soprano"', sharedContext.generateId()),
        ];

        const infoLine = new Info_line(1, tokens);
        const result = InfoLineFmt(infoLine);

        // Should contain name="Soprano" without spaces around =
        assert.isTrue(result.includes('name="Soprano"'), 'Should format as name="Soprano"');
        assert.isFalse(result.includes("name ="), "Should not have space before =");
        assert.isFalse(result.includes('= "Soprano"'), "Should not have space after =");
      });

      it("should handle incomplete key-value pairs gracefully", () => {
        // Test case with key but no value
        const tokens = [
          new Token(TT.INF_HDR, "V:", sharedContext.generateId()),
          new Token(TT.VX_ID, "1", sharedContext.generateId()),
          new Token(TT.WS, " ", sharedContext.generateId()),
          new Token(TT.VX_K, "name", sharedContext.generateId()),
          // No EQL or VX_V token
        ];

        const infoLine = new Info_line(1, tokens);
        const result = InfoLineFmt(infoLine);

        // Should contain the key but not create a malformed key=value
        assert.isTrue(result.includes("name"), "Should contain the key");
        assert.isFalse(result.includes("name="), "Should not create incomplete key=value");
      });

      it("should handle key with equals but no value", () => {
        // Test case with key= but no value
        const tokens = [
          new Token(TT.INF_HDR, "V:", sharedContext.generateId()),
          new Token(TT.VX_ID, "1", sharedContext.generateId()),
          new Token(TT.WS, " ", sharedContext.generateId()),
          new Token(TT.VX_K, "clef", sharedContext.generateId()),
          new Token(TT.EQL, "=", sharedContext.generateId()),
          // No VX_V token
        ];

        const infoLine = new Info_line(1, tokens);
        const result = InfoLineFmt(infoLine);

        // Should handle gracefully - exact behavior depends on implementation
        // but should not crash
        assert.isString(result, "Should return a string");
        assert.isTrue(result.startsWith("V:"), "Should start with V:");
      });
    });

    describe("specific ABC info line scenarios", () => {
      it("should format common voice properties correctly", () => {
        const testCases = [
          {
            name: "voice with clef",
            tokens: [
              new Token(TT.INF_HDR, "V:", sharedContext.generateId()),
              new Token(TT.VX_ID, "1", sharedContext.generateId()),
              new Token(TT.WS, " ", sharedContext.generateId()),
              new Token(TT.VX_K, "clef", sharedContext.generateId()),
              new Token(TT.EQL, "=", sharedContext.generateId()),
              new Token(TT.VX_V, "treble", sharedContext.generateId()),
            ],
            expected: "V:1 clef=treble",
          },
          {
            name: "voice with quoted name",
            tokens: [
              new Token(TT.INF_HDR, "V:", sharedContext.generateId()),
              new Token(TT.VX_ID, "soprano", sharedContext.generateId()),
              new Token(TT.WS, " ", sharedContext.generateId()),
              new Token(TT.VX_K, "name", sharedContext.generateId()),
              new Token(TT.EQL, "=", sharedContext.generateId()),
              new Token(TT.VX_V, '"Soprano Voice"', sharedContext.generateId()),
            ],
            expected: 'V:soprano name="Soprano Voice"',
          },
          {
            name: "voice with multiple properties",
            tokens: [
              new Token(TT.INF_HDR, "V:", sharedContext.generateId()),
              new Token(TT.VX_ID, "1", sharedContext.generateId()),
              new Token(TT.WS, " ", sharedContext.generateId()),
              new Token(TT.VX_K, "clef", sharedContext.generateId()),
              new Token(TT.EQL, "=", sharedContext.generateId()),
              new Token(TT.VX_V, "bass", sharedContext.generateId()),
              new Token(TT.WS, " ", sharedContext.generateId()),
              new Token(TT.VX_K, "transpose", sharedContext.generateId()),
              new Token(TT.EQL, "=", sharedContext.generateId()),
              new Token(TT.VX_V, "-12", sharedContext.generateId()),
            ],
            expected: "V:1 clef=bass transpose=-12",
          },
        ];

        testCases.forEach(({ name, tokens, expected }) => {
          const infoLine = new Info_line(1, tokens);
          const result = InfoLineFmt(infoLine);
          assert.equal(result, expected, `Failed for ${name}`);
        });
      });

      it("should handle key info lines with clef properties", () => {
        // Test K: info line with clef=treble
        const tokens = [
          new Token(TT.INF_HDR, "K:", sharedContext.generateId()),
          new Token(TT.KEY_ROOT, "C", sharedContext.generateId()),
          new Token(TT.WS, " ", sharedContext.generateId()),
          new Token(TT.KEY_K, "clef", sharedContext.generateId()),
          new Token(TT.EQL, "=", sharedContext.generateId()),
          new Token(TT.KEY_V, "bass", sharedContext.generateId()),
        ];

        const infoLine = new Info_line(1, tokens);
        const result = InfoLineFmt(infoLine);

        assert.equal(result, "K:C clef=bass", "Should format key info with clef property");
      });
    });
  });

  describe("InfoLineFmt integration", () => {
    it("should use genericFmt for unparsed info lines", () => {
      const tokens = [
        new Token(TT.INF_HDR, "V:", sharedContext.generateId()),
        new Token(TT.VX_ID, "1", sharedContext.generateId()),
        new Token(TT.WS, " ", sharedContext.generateId()),
        new Token(TT.VX_K, "name", sharedContext.generateId()),
        new Token(TT.EQL, "=", sharedContext.generateId()),
        new Token(TT.VX_V, "test", sharedContext.generateId()),
      ];

      // Create info line without parsed data
      const infoLine = new Info_line(1, tokens);
      const result = InfoLineFmt(infoLine);

      assert.equal(result, "V:1 name=test", "Should use genericFmt for unparsed lines");
    });

    it("should handle comments at the end of info lines", () => {
      const tokens = [
        new Token(TT.INF_HDR, "V:", sharedContext.generateId()),
        new Token(TT.VX_ID, "1", sharedContext.generateId()),
        new Token(TT.WS, " ", sharedContext.generateId()),
        new Token(TT.VX_K, "clef", sharedContext.generateId()),
        new Token(TT.EQL, "=", sharedContext.generateId()),
        new Token(TT.VX_V, "treble", sharedContext.generateId()),
        new Token(TT.COMMENT, "% treble clef", sharedContext.generateId()),
      ];

      const infoLine = new Info_line(1, tokens);
      const result = InfoLineFmt(infoLine);

      assert.equal(result, "V:1 clef=treble % treble clef", "Should preserve trailing comments");
    });
  });
});
