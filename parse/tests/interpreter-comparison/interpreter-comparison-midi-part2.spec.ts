/**
 * interpreter-comparison-midi-part2.spec.ts
 *
 * Comparison tests for MIDI directive Part 2 (multi-parameter commands).
 * These tests compare our parser's interpreter output with abcjs output
 * to ensure compatibility with the reference implementation.
 */

import { expect } from "chai";
import { describe, it } from "mocha";
import { parseWithAbcjs } from "./abcjs-wrapper";
import { parseWithYourParser } from "./test-helpers";

describe("Interpreter Comparison - MIDI Part 2 Directives", () => {
  describe("Two-integer-parameter MIDI commands", () => {
    it("should handle %%midi ratio 3 4", () => {
      const abcString = `X:1
T:MIDI Ratio Test
%%midi ratio 3 4
K:C
C D E F|G A B c|`;

      const abcjsResult = parseWithAbcjs(abcString);
      const ourResult = parseWithYourParser(abcString);

      expect(ourResult.tunes.length).to.equal(abcjsResult.length);
      expect(abcjsResult.length).to.be.greaterThan(0);

      const abcjsTune = abcjsResult[0];
      expect(abcjsTune.formatting?.midi).to.exist;
      expect(abcjsTune.formatting.midi.ratio).to.deep.equal([3, 4]);
    });

    it("should handle %%midi control 7 100", () => {
      const abcString = `X:1
T:MIDI Control Test
%%midi control 7 100
K:C
C D E F|`;

      const abcjsResult = parseWithAbcjs(abcString);
      expect(abcjsResult.length).to.be.greaterThan(0);
      expect(abcjsResult[0].formatting?.midi?.control).to.deep.equal([7, 100]);
    });

    it("should handle %%midi pitchbend 64 64", () => {
      const abcString = `X:1
T:MIDI Pitchbend Test
%%midi pitchbend 64 64
K:C
C D E F|`;

      const abcjsResult = parseWithAbcjs(abcString);
      expect(abcjsResult.length).to.be.greaterThan(0);
      expect(abcjsResult[0].formatting?.midi?.pitchbend).to.deep.equal([64, 64]);
    });

    it("should handle %%midi bendvelocity 50 100", () => {
      const abcString = `X:1
T:MIDI Bend Velocity Test
%%midi bendvelocity 50 100
K:C
C D E F|`;

      const abcjsResult = parseWithAbcjs(abcString);
      expect(abcjsResult.length).to.be.greaterThan(0);
      expect(abcjsResult[0].formatting?.midi?.bendvelocity).to.deep.equal([50, 100]);
    });

    it("should handle %%midi temperamentlinear 0 100", () => {
      const abcString = `X:1
T:MIDI Temperament Linear Test
%%midi temperamentlinear 0 100
K:C
C D E F|`;

      const abcjsResult = parseWithAbcjs(abcString);
      expect(abcjsResult.length).to.be.greaterThan(0);
      expect(abcjsResult[0].formatting?.midi?.temperamentlinear).to.deep.equal([0, 100]);
    });

    it("should handle %%midi snt 1 2", () => {
      const abcString = `X:1
T:MIDI SNT Test
%%midi snt 1 2
K:C
C D E F|`;

      const abcjsResult = parseWithAbcjs(abcString);
      expect(abcjsResult.length).to.be.greaterThan(0);
      expect(abcjsResult[0].formatting?.midi?.snt).to.deep.equal([1, 2]);
    });
  });

  describe("Four-integer-parameter MIDI commands", () => {
    it("should handle %%midi beat 4 1 2 3", () => {
      const abcString = `X:1
T:MIDI Beat Test 1
%%midi beat 4 1 2 3
K:C
C D E F|G A B c|`;

      const abcjsResult = parseWithAbcjs(abcString);
      const ourResult = parseWithYourParser(abcString);

      expect(ourResult.tunes.length).to.equal(abcjsResult.length);
      expect(abcjsResult.length).to.be.greaterThan(0);

      const abcjsTune = abcjsResult[0];
      expect(abcjsTune.formatting?.midi).to.exist;
      expect(abcjsTune.formatting.midi.beat).to.deep.equal([4, 1, 2, 3]);
    });

    it("should handle %%midi beat 3 2 1 1", () => {
      const abcString = `X:1
T:MIDI Beat Test 2
%%midi beat 3 2 1 1
K:C
C D E|F G A|`;

      const abcjsResult = parseWithAbcjs(abcString);
      expect(abcjsResult.length).to.be.greaterThan(0);
      expect(abcjsResult[0].formatting?.midi?.beat).to.deep.equal([3, 2, 1, 1]);
    });
  });

  describe("Five-integer-parameter MIDI commands", () => {
    it("should handle %%midi drone 70 80 50 50 50", () => {
      const abcString = `X:1
T:MIDI Drone Test
%%midi drone 70 80 50 50 50
K:C
C D E F|G A B c|`;

      const abcjsResult = parseWithAbcjs(abcString);
      const ourResult = parseWithYourParser(abcString);

      expect(ourResult.tunes.length).to.equal(abcjsResult.length);
      expect(abcjsResult.length).to.be.greaterThan(0);

      const abcjsTune = abcjsResult[0];
      expect(abcjsTune.formatting?.midi).to.exist;
      expect(abcjsTune.formatting.midi.drone).to.deep.equal([70, 80, 50, 50, 50]);
    });
  });

  describe("String + integer parameter MIDI commands", () => {
    it("should handle %%midi portamento on 20", () => {
      const abcString = `X:1
T:MIDI Portamento On Test
%%midi portamento on 20
K:C
C D E F|`;

      const abcjsResult = parseWithAbcjs(abcString);
      const ourResult = parseWithYourParser(abcString);

      expect(ourResult.tunes.length).to.equal(abcjsResult.length);
      expect(abcjsResult.length).to.be.greaterThan(0);

      const abcjsTune = abcjsResult[0];
      expect(abcjsTune.formatting?.midi).to.exist;
      expect(abcjsTune.formatting.midi.portamento).to.deep.equal(["on", 20]);
    });

    it("should handle %%midi portamento off 0", () => {
      const abcString = `X:1
T:MIDI Portamento Off Test
%%midi portamento off 0
K:C
C D E F|`;

      const abcjsResult = parseWithAbcjs(abcString);
      expect(abcjsResult.length).to.be.greaterThan(0);
      expect(abcjsResult[0].formatting?.midi?.portamento).to.deep.equal(["off", 0]);
    });
  });

  describe("Integer + optional integer parameter MIDI commands", () => {
    it("should handle %%midi program 25", () => {
      const abcString = `X:1
T:MIDI Program Test 1
%%midi program 25
K:C
C D E F|`;

      const abcjsResult = parseWithAbcjs(abcString);
      const ourResult = parseWithYourParser(abcString);

      expect(ourResult.tunes.length).to.equal(abcjsResult.length);
      expect(abcjsResult.length).to.be.greaterThan(0);

      const abcjsTune = abcjsResult[0];
      expect(abcjsTune.formatting?.midi).to.exist;
      expect(abcjsTune.formatting.midi.program).to.deep.equal([25]);
    });

    it("should handle %%midi program 25 1", () => {
      const abcString = `X:1
T:MIDI Program Test 2
%%midi program 25 1
K:C
C D E F|`;

      const abcjsResult = parseWithAbcjs(abcString);
      expect(abcjsResult.length).to.be.greaterThan(0);
      expect(abcjsResult[0].formatting?.midi?.program).to.deep.equal([25, 1]);
    });
  });

  describe("Multiple Part 2 MIDI commands in one tune", () => {
    it("should handle multiple multi-parameter MIDI directives", () => {
      const abcString = `X:1
T:Multiple Part 2 MIDI Commands
%%midi ratio 3 4
%%midi beat 4 1 2 3
%%midi drone 70 80 50 50 50
%%midi portamento on 20
%%midi program 25
K:C
C D E F|G A B c|`;

      const abcjsResult = parseWithAbcjs(abcString);
      const ourResult = parseWithYourParser(abcString);

      expect(ourResult.tunes.length).to.equal(abcjsResult.length);
      expect(abcjsResult.length).to.be.greaterThan(0);

      const abcjsTune = abcjsResult[0];
      expect(abcjsTune.formatting?.midi).to.exist;
      expect(abcjsTune.formatting.midi.ratio).to.deep.equal([3, 4]);
      expect(abcjsTune.formatting.midi.beat).to.deep.equal([4, 1, 2, 3]);
      expect(abcjsTune.formatting.midi.drone).to.deep.equal([70, 80, 50, 50, 50]);
      expect(abcjsTune.formatting.midi.portamento).to.deep.equal(["on", 20]);
      expect(abcjsTune.formatting.midi.program).to.deep.equal([25]);
    });
  });

  describe("Mixed Part 1 and Part 2 MIDI commands", () => {
    it("should handle both simple and multi-parameter MIDI commands together", () => {
      const abcString = `X:1
T:Mixed MIDI Commands
%%midi nobarlines
%%midi vol 100
%%midi ratio 3 4
%%midi control 7 100
%%midi beat 4 1 2 3
%%midi transpose -2
%%midi program 25 1
K:C
C D E F|G A B c|`;

      const abcjsResult = parseWithAbcjs(abcString);
      const ourResult = parseWithYourParser(abcString);

      expect(ourResult.tunes.length).to.equal(abcjsResult.length);
      expect(abcjsResult.length).to.be.greaterThan(0);

      const abcjsTune = abcjsResult[0];
      expect(abcjsTune.formatting?.midi).to.exist;

      // Part 1 commands
      expect(abcjsTune.formatting.midi.nobarlines).to.deep.equal([]);
      expect(abcjsTune.formatting.midi.vol).to.deep.equal([100]);
      expect(abcjsTune.formatting.midi.transpose).to.deep.equal([-2]);

      // Part 2 commands
      expect(abcjsTune.formatting.midi.ratio).to.deep.equal([3, 4]);
      expect(abcjsTune.formatting.midi.control).to.deep.equal([7, 100]);
      expect(abcjsTune.formatting.midi.beat).to.deep.equal([4, 1, 2, 3]);
      expect(abcjsTune.formatting.midi.program).to.deep.equal([25, 1]);
    });
  });
});
