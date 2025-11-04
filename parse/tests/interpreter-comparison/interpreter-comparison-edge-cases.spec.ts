/**
 * interpreter-comparison-edge-cases.spec.ts
 *
 * Example-based tests for edge cases discovered through property-based testing.
 * These tests compare our parser's interpreter output with abcjs output.
 */

import { expect } from "chai";
import { describe, it } from "mocha";
import { parseWithAbcjs } from "./abcjs-wrapper";
import { parseWithYourParser } from "./test-helpers";

describe("Interpreter Comparison - Edge Cases from PBT", () => {
  describe("First failure: clef with note", () => {
    it("should handle clef=bass with note correctly", () => {
      const abcString = "X:1\nK:clef=bass\na|";

      console.log("\n=== Debugging:", abcString.replace(/\n/g, "\\n"));

      const abcjsResult = parseWithAbcjs(abcString);
      const ourResult = parseWithYourParser(abcString);

      console.log("\nabcjs result:", JSON.stringify(abcjsResult, null, 2));
      console.log("\nOur result:", JSON.stringify(ourResult.tunes, null, 2));

      if (abcjsResult.length === 0 || ourResult.tunes.length === 0) {
        console.log("One parser produced no tunes");
        return;
      }

      const abcjsTune = abcjsResult[0];
      const ourTune = ourResult.tunes[0];

      if (!abcjsTune.lines || abcjsTune.lines.length === 0) {
        console.log("abcjs has no lines");
        return;
      }

      if (!ourTune.systems || ourTune.systems.length === 0) {
        console.log("Our parser has no lines");
        return;
      }

      const abcjsLine = abcjsTune.lines[0];
      const ourLine = ourTune.systems[0];

      console.log("\nabcjs line:", JSON.stringify(abcjsLine, null, 2));
      console.log("\nOur line:", JSON.stringify(ourLine, null, 2));

      if (!("staff" in abcjsLine) || !("staff" in ourLine)) {
        console.log("Not a music line");
        return;
      }

      const abcjsVoice = abcjsLine.staff[0].voices[0];
      const ourVoice = ourLine.staff[0].voices[0];

      console.log("\nabcjs voice length:", abcjsVoice.length);
      console.log("Our voice length:", ourVoice.length);

      console.log("\nabcjs voice elements:");
      abcjsVoice.forEach((el: any, i: number) => {
        console.log(`  [${i}]:`, el.el_type, el);
      });

      console.log("\nOur voice elements:");
      ourVoice.forEach((el: any, i: number) => {
        console.log(`  [${i}]:`, el.el_type, el);
      });

      expect(ourVoice.length).to.equal(abcjsVoice.length);
    });
  });

  describe("Second failure: rest with custom meter/length", () => {
    it("should handle broken rhythm with rest (no barline between)", () => {
      const abcString = "X:1\nL:2/2\nK:^a\na<zA|";

      console.log("\n=== Debugging:", abcString.replace(/\n/g, "\\n"));

      const abcjsResult = parseWithAbcjs(abcString);
      const ourResult = parseWithYourParser(abcString);

      console.log("\nabcjs result:", JSON.stringify(abcjsResult, null, 2));
      console.log("\nOur result:", JSON.stringify(ourResult.tunes, null, 2));

      if (abcjsResult.length === 0 || ourResult.tunes.length === 0) {
        console.log("One parser produced no tunes");
        return;
      }

      const abcjsTune = abcjsResult[0];
      const ourTune = ourResult.tunes[0];

      if (!abcjsTune.lines || abcjsTune.lines.length === 0) {
        console.log("abcjs has no lines");
        return;
      }

      if (!ourTune.systems || ourTune.systems.length === 0) {
        console.log("Our parser has no lines");
        return;
      }

      const abcjsLine = abcjsTune.lines[0];
      const ourLine = ourTune.systems[0];

      console.log("\nabcjs line:", JSON.stringify(abcjsLine, null, 2));
      console.log("\nOur line:", JSON.stringify(ourLine, null, 2));

      if (!("staff" in abcjsLine) || !("staff" in ourLine)) {
        console.log("Not a music line");
        return;
      }

      const abcjsVoice = abcjsLine.staff[0].voices[0];
      const ourVoice = ourLine.staff[0].voices[0];

      console.log("\nabcjs voice length:", abcjsVoice.length);
      console.log("Our voice length:", ourVoice.length);

      console.log("\nabcjs voice elements:");
      abcjsVoice.forEach((el: any, i: number) => {
        console.log(`  [${i}]:`, el.el_type, el);
      });

      console.log("\nOur voice elements:");
      ourVoice.forEach((el: any, i: number) => {
        console.log(`  [${i}]:`, el.el_type, el);
      });

      expect(ourVoice.length).to.equal(abcjsVoice.length);
    });
  });
});
