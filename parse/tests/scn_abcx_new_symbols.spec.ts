import { expect } from "chai";
import { ScannerAbcx } from "../parsers/scan_abcx_tunebody";
import { ABCContext } from "../parsers/Context";
import { TT } from "../parsers/scan2";
import { AbcErrorReporter } from "../parsers/ErrorReporter";

describe("ABCx Scanner - New Chord Quality Symbols", () => {
  it("should scan chord with minus for minor (C-7)", () => {
    const ctx = new ABCContext(new AbcErrorReporter());
    const tokens = ScannerAbcx("X:1\nK:C\nC-7 |", ctx);
    const chordTokens = tokens.filter(t => t.type === TT.CHORD_SYMBOL);
    expect(chordTokens.length).to.equal(1);
    expect(chordTokens[0].lexeme).to.equal("C-7");
  });

  it("should scan chord with degree symbol for diminished (D°7)", () => {
    const ctx = new ABCContext(new AbcErrorReporter());
    const tokens = ScannerAbcx("X:1\nK:C\nD°7 |", ctx);
    const chordTokens = tokens.filter(t => t.type === TT.CHORD_SYMBOL);
    expect(chordTokens.length).to.equal(1);
    expect(chordTokens[0].lexeme).to.equal("D°7");
  });

  it("should scan chord with lowercase slashed o for half-diminished (Eø7)", () => {
    const ctx = new ABCContext(new AbcErrorReporter());
    const tokens = ScannerAbcx("X:1\nK:C\nEø7 |", ctx);
    const chordTokens = tokens.filter(t => t.type === TT.CHORD_SYMBOL);
    expect(chordTokens.length).to.equal(1);
    expect(chordTokens[0].lexeme).to.equal("Eø7");
  });

  it("should scan chord with uppercase slashed O for half-diminished (FØ7)", () => {
    const ctx = new ABCContext(new AbcErrorReporter());
    const tokens = ScannerAbcx("X:1\nK:C\nFØ7 |", ctx);
    const chordTokens = tokens.filter(t => t.type === TT.CHORD_SYMBOL);
    expect(chordTokens.length).to.equal(1);
    expect(chordTokens[0].lexeme).to.equal("FØ7");
  });

  it("should scan all new chord quality symbols together", () => {
    const ctx = new ABCContext(new AbcErrorReporter());
    const testChords = ["C-7", "D°7", "Eø7", "FØ7", "G-", "A°", "Bø"];
    const source = "X:1\nK:C\n" + testChords.join(" | ") + " |";
    const tokens = ScannerAbcx(source, ctx);
    const chordTokens = tokens.filter(t => t.type === TT.CHORD_SYMBOL);
    expect(chordTokens.length).to.equal(testChords.length);
    chordTokens.forEach((token, i) => {
      expect(token.lexeme).to.equal(testChords[i]);
    });
  });
});
