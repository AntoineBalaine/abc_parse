/**
 * ABCx Parser Tests
 *
 * Tests for the ABCx chord sheet notation parser.
 * Only tests ABCx-specific functionality (ChordSymbol parsing).
 * Generic parsing features (barlines, info lines, etc.) are tested
 * in the main ABC parser tests since ABCx reuses those functions.
 */

import { expect } from "chai";
import { ABCContext } from "../parsers/Context";
import { ScannerAbcx } from "../parsers/scan_abcx_tunebody";
import { parseAbcx } from "../parsers/parse_abcx";
import { ChordSymbol, BarLine, Tune, File_structure } from "../types/Expr2";

describe("ABCx Parser", () => {
  function parse(source: string): File_structure {
    const ctx = new ABCContext();
    const tokens = ScannerAbcx(source, ctx);
    return parseAbcx(tokens, ctx);
  }

  describe("ChordSymbol Expression", () => {
    it("should parse a tune with chord symbols", () => {
      const source = `X:1
T:Test
K:C
C Am | G |`;
      const ast = parse(source);

      expect(ast).to.be.instanceOf(File_structure);
      expect(ast.contents.length).to.equal(1);

      const tune = ast.contents[0] as Tune;
      expect(tune).to.be.instanceOf(Tune);
      expect(tune.tune_body).to.not.be.null;

      // Check that we have chord symbols in the body
      const system = tune.tune_body!.sequence[0];
      const chordSymbols = system.filter((e) => e instanceof ChordSymbol);
      expect(chordSymbols.length).to.equal(3);
    });

    it("should parse chord symbols with correct lexemes", () => {
      const source = `X:1
K:C
Cmaj7 Am7 | Dm7 G7 |`;
      const ast = parse(source);

      const tune = ast.contents[0] as Tune;
      const system = tune.tune_body!.sequence[0];
      const chordSymbols = system.filter((e) => e instanceof ChordSymbol) as ChordSymbol[];

      const chordNames = chordSymbols.map((c) => c.token.lexeme);
      expect(chordNames).to.include("Cmaj7");
      expect(chordNames).to.include("Am7");
      expect(chordNames).to.include("Dm7");
      expect(chordNames).to.include("G7");
    });

    it("should parse complex chord symbols", () => {
      const source = `X:1
K:C
Bbmaj7#11 F#m7b5 | Eb/G Ab13 |`;
      const ast = parse(source);

      const tune = ast.contents[0] as Tune;
      const system = tune.tune_body!.sequence[0];
      const chordSymbols = system.filter((e) => e instanceof ChordSymbol) as ChordSymbol[];

      expect(chordSymbols.length).to.equal(4);
      const chordNames = chordSymbols.map((c) => c.token.lexeme);
      expect(chordNames).to.include("Bbmaj7#11");
      expect(chordNames).to.include("F#m7b5");
      expect(chordNames).to.include("Eb/G");
      expect(chordNames).to.include("Ab13");
    });

    it("should distinguish between chord symbols and barlines", () => {
      const source = `X:1
K:C
C | G7 | Am F |`;
      const ast = parse(source);

      const tune = ast.contents[0] as Tune;
      const system = tune.tune_body!.sequence[0];

      const chordSymbols = system.filter((e) => e instanceof ChordSymbol);
      const barlines = system.filter((e) => e instanceof BarLine);

      // 4 chords: C, G7, Am, F
      expect(chordSymbols.length).to.equal(4);
      // 3 barlines
      expect(barlines.length).to.equal(3);
    });
  });

  // Note: Tune header parsing is already tested in the main ABC parser tests
  // since ABCx reuses the same parsing functions. No need to duplicate those tests here.
});
