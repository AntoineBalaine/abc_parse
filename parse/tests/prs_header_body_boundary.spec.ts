import { expect } from "chai";
import { parse } from "../parsers/parse2";
import { Scanner } from "../parsers/scan2";
import { ABCContext } from "../parsers/Context";
import { AbcErrorReporter } from "../parsers/ErrorReporter";
import { Tune, Info_line } from "../types/Expr2";

/**
 * Tests for parser header/body boundary detection.
 *
 * Bug 8: When a tune has no K: line and begins with a V: line followed by music,
 * the parser incorrectly places the V: line in the Tune_header instead of the
 * Tune_Body. This causes downstream consumers (like the voice selector) to miss
 * the first voice marker because they only walk the Tune_Body.
 */
describe("Parser header/body boundary", function () {
  function parseAbc(abc: string): { tune: Tune; headerInfoLineKeys: string[]; bodyInfoLineKeys: string[] } {
    const ctx = new ABCContext(new AbcErrorReporter());
    const tokens = Scanner(abc, ctx);
    const ast = parse(tokens, ctx);

    const tune = ast.contents.find((c): c is Tune => c instanceof Tune);
    expect(tune).to.not.be.undefined;

    const header = tune!.tune_header;
    const body = tune!.tune_body;

    const headerInfoLineKeys = header.info_lines
      .filter((il): il is Info_line => il instanceof Info_line)
      .map(il => il.key.lexeme.trim());

    const bodyInfoLineKeys: string[] = [];
    if (body) {
      for (const system of body.sequence) {
        for (const element of system) {
          if (element instanceof Info_line) {
            bodyInfoLineKeys.push(element.key.lexeme.trim());
          }
        }
      }
    }

    return { tune: tune!, headerInfoLineKeys, bodyInfoLineKeys };
  }

  describe("V: followed by K: (correct behavior)", function () {
    it("V: should be in header when followed by K:", function () {
      const abc = "X:1\nT:Test\nV:0\nK:C\nCDEF|";
      const { headerInfoLineKeys, bodyInfoLineKeys } = parseAbc(abc);

      expect(headerInfoLineKeys).to.include("V:");
      expect(headerInfoLineKeys).to.include("K:");
    });

    it("multiple V: lines followed by K: should all be in header", function () {
      const abc = "X:1\nT:Test\nV:0\nV:1\nK:C\nCDEF|";
      const { tune, headerInfoLineKeys } = parseAbc(abc);

      expect(headerInfoLineKeys.filter(k => k === "V:")).to.have.length(2);
      expect(tune.tune_header.voices).to.include("0");
      expect(tune.tune_header.voices).to.include("1");
    });
  });

  describe("V: followed by music without K: (bug 8)", function () {
    it("V: should be in body (not header) when followed by music without K:", function () {
      const abc = "X:1\nT:Test\nV:0\nCDEF|";
      const { tune, headerInfoLineKeys, bodyInfoLineKeys } = parseAbc(abc);

      // BUG: Currently the V: ends up in the header, but it should be in the body
      // because it's followed by music, not by K:

      // This assertion documents the EXPECTED (correct) behavior:
      expect(headerInfoLineKeys).to.not.include("V:",
        "V: followed by music should NOT be in header");
      expect(bodyInfoLineKeys).to.include("V:",
        "V: followed by music should be in body");
      expect(tune.tune_header.voices).to.be.empty;
    });

    it("first V: should be in body, subsequent V: lines should also be in body", function () {
      const abc = "X:1\nT:Test\nV:0\nCDEF|\nV:1\nGABc|";
      const { tune, headerInfoLineKeys, bodyInfoLineKeys } = parseAbc(abc);

      // Both V: lines should be in the body since there's no K: line
      expect(headerInfoLineKeys).to.not.include("V:");
      expect(bodyInfoLineKeys.filter(k => k === "V:")).to.have.length(2);
      expect(tune.tune_header.voices).to.be.empty;
    });

    it("voices array should be empty when V: is in body", function () {
      const abc = "X:1\nT:Test\nV:0\nCDEF|";
      const { tune } = parseAbc(abc);

      // The header's voices array should be empty because the V: is a voice switch
      // in the body, not a voice declaration in the header
      expect(tune.tune_header.voices).to.be.empty;
    });

    it("V: followed by comment then music should stay in header", function () {
      const abc = "X:1\nT:Test\nV:0\n%comment\nCDEF|";
      const { tune, headerInfoLineKeys, bodyInfoLineKeys } = parseAbc(abc);

      // Comment is header-valid, so V: stays in header
      expect(headerInfoLineKeys).to.include("V:");
      expect(bodyInfoLineKeys).to.not.include("V:");
      expect(tune.tune_header.voices).to.include("0");
    });

    it("V: followed by directive then music should stay in header", function () {
      const abc = "X:1\nT:Test\nV:0\n%%scale 0.8\nCDEF|";
      const { tune, headerInfoLineKeys, bodyInfoLineKeys } = parseAbc(abc);

      // Directive is header-valid, so V: stays in header
      expect(headerInfoLineKeys).to.include("V:");
      expect(bodyInfoLineKeys).to.not.include("V:");
      expect(tune.tune_header.voices).to.include("0");
    });

    it("two V: lines, second followed by music: first stays in header, second goes to body", function () {
      const abc = "X:1\nT:Test\nV:0\nV:1\nCDEF|";
      const { tune, headerInfoLineKeys, bodyInfoLineKeys } = parseAbc(abc);

      // First V: is followed by another V: (INF_HDR is header-valid), so it stays in header
      // Second V: is followed by music, so it goes to body
      expect(headerInfoLineKeys.filter(k => k === "V:")).to.have.length(1);
      expect(bodyInfoLineKeys.filter(k => k === "V:")).to.have.length(1);
      expect(tune.tune_header.voices).to.include("0");
      expect(tune.tune_header.voices).to.not.include("1");
    });
  });
});
