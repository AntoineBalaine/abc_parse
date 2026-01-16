/**
 * ABCx Scanner Tests
 *
 * Tests for the ABCx chord sheet notation scanner.
 */

import { expect } from "chai";
import { ABCContext } from "../parsers/Context";
import { ScannerAbcx } from "../parsers/scan_abcx_tunebody";
import { TT } from "../parsers/scan2";

describe("ABCx Scanner", () => {
  function scan(source: string) {
    const ctx = new ABCContext();
    return ScannerAbcx(source, ctx);
  }

  // Helper to wrap content in a valid ABCx tune
  function abcxTune(body: string): string {
    return `X:1\nK:C\n${body}`;
  }

  describe("Chord Symbols", () => {
    it("should scan a simple chord symbol", () => {
      const tokens = scan(abcxTune("C |"));
      const chordTokens = tokens.filter((t) => t.type === TT.CHORD_SYMBOL);
      expect(chordTokens.length).to.equal(1);
      expect(chordTokens[0].lexeme).to.equal("C");
    });

    it("should scan a minor chord", () => {
      const tokens = scan(abcxTune("Am |"));
      const chordTokens = tokens.filter((t) => t.type === TT.CHORD_SYMBOL);
      expect(chordTokens.length).to.equal(1);
      expect(chordTokens[0].lexeme).to.equal("Am");
    });

    it("should scan a seventh chord", () => {
      const tokens = scan(abcxTune("G7 |"));
      const chordTokens = tokens.filter((t) => t.type === TT.CHORD_SYMBOL);
      expect(chordTokens.length).to.equal(1);
      expect(chordTokens[0].lexeme).to.equal("G7");
    });

    it("should scan a chord with accidental", () => {
      const tokens = scan(abcxTune("Bb |"));
      const chordTokens = tokens.filter((t) => t.type === TT.CHORD_SYMBOL);
      expect(chordTokens.length).to.equal(1);
      expect(chordTokens[0].lexeme).to.equal("Bb");
    });

    it("should scan a chord with slash bass", () => {
      const tokens = scan(abcxTune("C/G |"));
      const chordTokens = tokens.filter((t) => t.type === TT.CHORD_SYMBOL);
      expect(chordTokens.length).to.equal(1);
      expect(chordTokens[0].lexeme).to.equal("C/G");
    });

    it("should scan a complex chord", () => {
      const tokens = scan(abcxTune("Cmaj7 |"));
      const chordTokens = tokens.filter((t) => t.type === TT.CHORD_SYMBOL);
      expect(chordTokens.length).to.equal(1);
      expect(chordTokens[0].lexeme).to.equal("Cmaj7");
    });

    it("should scan multiple chords with barlines", () => {
      const tokens = scan(abcxTune("C | Am | G | F |"));
      const chordTokens = tokens.filter((t) => t.type === TT.CHORD_SYMBOL);
      expect(chordTokens.length).to.equal(4);
      expect(chordTokens.map((t) => t.lexeme)).to.deep.equal(["C", "Am", "G", "F"]);
    });
  });

  describe("Barlines", () => {
    it("should scan simple barlines", () => {
      const tokens = scan(abcxTune("C | G |"));
      const barlines = tokens.filter((t) => t.type === TT.BARLINE);
      expect(barlines.length).to.equal(2);
    });

    it("should scan repeat barlines", () => {
      const tokens = scan(abcxTune("C |: G :|"));
      const barlines = tokens.filter((t) => t.type === TT.BARLINE);
      expect(barlines.length).to.equal(2);
    });
  });

  describe("Full ABCx Tune", () => {
    it("should scan a complete ABCx tune", () => {
      const source = `X:1
T:Test Song
K:C
C Am | G F | C |`;
      const tokens = scan(source);

      // Should have info headers
      const infHeaders = tokens.filter((t) => t.type === TT.INF_HDR);
      expect(infHeaders.length).to.be.greaterThan(0);

      // Should have chord symbols
      const chords = tokens.filter((t) => t.type === TT.CHORD_SYMBOL);
      expect(chords.length).to.equal(5);

      // Should have barlines
      const barlines = tokens.filter((t) => t.type === TT.BARLINE);
      expect(barlines.length).to.equal(3);
    });
  });
});
