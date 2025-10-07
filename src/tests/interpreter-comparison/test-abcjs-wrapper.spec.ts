/**
 * test-abcjs-wrapper.spec.ts
 *
 * Tests for the abcjs wrapper to verify it loads and parses correctly
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { parseWithAbcjs } from "./abcjs-wrapper";

describe.only("abcjs Wrapper", () => {
  describe("Basic Parsing", () => {
    it("should load abcjs modules without error", () => {
      // Just importing should work if modules load correctly
      expect(parseWithAbcjs).to.be.a("function");
    });

    it("should parse a minimal tune", () => {
      const input = `X:1
T:Test
K:C
CDEF|`;

      const tunes = parseWithAbcjs(input);

      expect(tunes).to.be.an("array");
      expect(tunes).to.have.length(1);
    });

    it("should parse metaText fields", () => {
      const input = `X:1
T:Test Title
C:Test Composer
O:Test Origin
K:C
CDEF|`;

      const tunes = parseWithAbcjs(input);

      expect(tunes).to.have.length(1);
      const tune = tunes[0];

      expect(tune.metaText).to.exist;
      expect(tune.metaText.title).to.exist;
    });

    it("should parse lines array", () => {
      const input = `X:1
T:Test
K:C
CDEF|GABc|`;

      const tunes = parseWithAbcjs(input);

      expect(tunes).to.have.length(1);
      const tune = tunes[0];

      expect(tune.lines).to.be.an("array");
      expect(tune.lineNum).to.be.greaterThan(0);
    });

    it("should verify duration types (float vs rational)", () => {
      const input = `X:1
T:Duration Test
M:4/4
L:1/8
K:C
C2 D E/2F/2 G4|`;

      const tunes = parseWithAbcjs(input);

      expect(tunes).to.have.length(1);
      const tune = tunes[0];

      // Navigate to first voice element
      if (tune.lines[0]?.staff?.[0]?.voices?.[0]?.[0]) {
        const firstElement = tune.lines[0].staff[0].voices[0][0];
        if (firstElement.duration !== undefined) {
          expect(typeof firstElement.duration).to.equal("number");
        }
      }
    });

    it("should parse meter structure", () => {
      const input = `X:1
T:Meter Test
M:6/8
K:C
CDEF|`;

      const tunes = parseWithAbcjs(input);

      expect(tunes).to.have.length(1);
      const tune = tunes[0];

      if (tune.lines[0]?.staff?.[0]?.meter) {
        const meter = tune.lines[0].staff[0].meter;
        if (meter.value && meter.value[0]) {
          expect(typeof meter.value[0].num).to.equal("string");
          expect(typeof meter.value[0].den).to.equal("string");
        }
      }
    });

    it("should handle multiple tunes", () => {
      const input = `X:1
T:First
K:C
CDEF|

X:2
T:Second
K:G
GABc|`;

      const tunes = parseWithAbcjs(input);

      expect(tunes).to.have.length(2);
      expect(tunes[0].metaText.title).to.exist;
      expect(tunes[1].metaText.title).to.exist;
    });

    it("should parse file header directives", () => {
      const input = `%%abc-version 2.1
%%abc-creator Test
L:1/8

X:1
T:Test
K:C
CDEF|`;

      const tunes = parseWithAbcjs(input);

      expect(tunes).to.have.length(1);
      const tune = tunes[0];

      expect(tune.version).to.exist;
      expect(tune.formatting).to.exist;
    });
  });

  describe("Error Handling", () => {
    it("should throw error for invalid ABC", () => {
      const input = "This is not valid ABC notation";

      expect(() => parseWithAbcjs(input)).to.throw();
    });
  });
});
