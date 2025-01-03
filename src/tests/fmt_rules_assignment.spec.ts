import { assert } from "chai";
import { isNote, isBarLine, isToken, isMultiMeasureRest } from "../helpers";
import { ABCContext } from "../parsers/Context";
import { Parser } from "../parsers/Parser";
import { Scanner } from "../parsers/Scanner";
import { System, TokenType } from "../types/types";
import { assignTuneBodyRules, expandMultiMeasureRests, preprocessTune, SpcRul } from "../Visitors/fmt/fmt_rules_assignment";
import { MultiMeasureRest } from "../types/Expr";

function buildTune(input: string) {
  const ctx = new ABCContext();
  const scanner = new Scanner(input, ctx);
  const tokens = scanner.scanTokens();
  const parser = new Parser(tokens, ctx);
  const ast = parser.parse();
  return ast!.tune[0];
}

describe("Rules Assignment", () => {
  let ctx: ABCContext;

  beforeEach(() => {
    ctx = new ABCContext();
  });

  describe("assignTuneBodyRules", () => {
    it("assigns SURROUND_SPC to notes and barlines in single voice", () => {
      let tune = buildTune(`X:1\nC D E|F G A|`);
      tune = preprocessTune(tune, ctx);
      const ruleMap = assignTuneBodyRules(tune, ctx);

      tune.tune_body!.sequence[0].forEach((node) => {
        if (isNote(node) || isBarLine(node)) {
          const rules = ruleMap.get(node);
          assert.isTrue(rules?.includes(SpcRul.SURROUND_SPC));
        }
      });
    });

    it("handles multi-measure rests in multi-voice context", () => {
      let tune = buildTune(`X:1
V:RH clef=treble
V:LH clef=bass
V:RH
Z4|
V:LH
CDEF|GABC|CDEF|GABC|
            `);

      tune = preprocessTune(tune, ctx);
      const ruleMap = assignTuneBodyRules(tune, ctx);

      // Find expanded multi-measure rest
      const firstSystem = tune.tune_body!.sequence[0];
      const rests = firstSystem.filter((node): node is MultiMeasureRest => isMultiMeasureRest(node));

      assert.isAbove(rests.length, 1, "Multi-measure rest should be expanded");
      rests.forEach((rest) => {
        const rules = ruleMap.get(rest);
        assert.isTrue(rules?.includes(SpcRul.SURROUND_SPC));
      });
    });

    it("assigns NO_SPC to parentheses", () => {
      let tune = buildTune(`X:1\n(ABC)|`);

      tune = preprocessTune(tune, ctx);
      const ruleMap = assignTuneBodyRules(tune, ctx);

      tune.tune_body!.sequence[0].forEach((node) => {
        if (isToken(node) && (node.type === TokenType.LEFTPAREN || node.type === TokenType.RIGHT_PAREN)) {
          const rules = ruleMap.get(node);
          assert.isTrue(rules?.includes(SpcRul.NO_SPC));
        }
      });
    });

    it("assigns PRECEDE_SPC to decorations", () => {
      let tune = buildTune(`X:1\n!p!C D E|`);

      tune = preprocessTune(tune, ctx);
      const ruleMap = assignTuneBodyRules(tune, ctx);

      tune.tune_body!.sequence[0].forEach((node) => {
        if (node.constructor.name === "Decoration") {
          const rules = ruleMap.get(node);
          assert.isTrue(rules?.includes(SpcRul.PRECEDE_SPC));
        }
      });
    });

    it("assigns FOLLOW_SPC to inline fields", () => {
      let tune = buildTune(`X:1\n[K:C]C D E|`);

      tune = preprocessTune(tune, ctx);
      const ruleMap = assignTuneBodyRules(tune, ctx);

      tune.tune_body!.sequence[0].forEach((node) => {
        if (node.constructor.name === "Inline_field") {
          const rules = ruleMap.get(node);
          assert.isTrue(rules?.includes(SpcRul.FOLLOW_SPC));
        }
      });
    });

    it("handles beamed notes", () => {
      let tune = buildTune(`X:1\nCDEF GABC|`);

      tune = preprocessTune(tune, ctx);
      const ruleMap = assignTuneBodyRules(tune, ctx);

      tune.tune_body!.sequence[0].forEach((node) => {
        if (node.constructor.name === "Beam") {
          const rules = ruleMap.get(node);
          assert.isTrue(rules?.includes(SpcRul.SURROUND_SPC));
        }
      });
    });

    it("handles grace notes", () => {
      let tune = buildTune(`X:1\n{ag}f2|`);

      tune = preprocessTune(tune, ctx);
      const ruleMap = assignTuneBodyRules(tune, ctx);

      tune.tune_body!.sequence[0].forEach((node) => {
        if (node.constructor.name === "Grace_group") {
          const rules = ruleMap.get(node);
          assert.isTrue(rules?.includes(SpcRul.PRECEDE_SPC));
        }
      });
    });
  });
});

describe("expandMultiMeasureRests", () => {
  let ctx: ABCContext;

  beforeEach(() => {
    ctx = new ABCContext();
  });

  it("expands Z4 into four single-measure rests", () => {
    const input = "X:1\nZ4|";
    const system = buildTune(input).tune_body!.sequence[0];
    const expanded = expandMultiMeasureRests(system, ctx);

    // Should be: Z|Z|Z|Z|

    const rests = expanded.filter((node) => isMultiMeasureRest(node));
    const barlines = expanded.filter((node) => isBarLine(node));

    assert.equal(rests.length, 4, "Should have 4 rests");
    assert.equal(barlines.length, 4, "Should have 4 barlines");
  });

  it("expands X4 into four invisible rests", () => {
    const input = "X:1\nX4|";
    const system = buildTune(input).tune_body!.sequence[0];
    const expanded = expandMultiMeasureRests(system, ctx);

    // Should be: X|X|X|X|
    const rests = expanded.filter((node): node is MultiMeasureRest => isMultiMeasureRest(node));
    assert.equal(rests.length, 4, "Should have 4 rests");

    // Verify all rests are invisible (X)
    rests.forEach((rest) => {
      assert.equal(rest.rest.lexeme, "X", "Rest should be invisible");
    });
  });

  it("does not expand single measure rests", () => {
    const input = "X:1\nZ|";
    const system = buildTune(input).tune_body!.sequence[0];
    const expanded = expandMultiMeasureRests(system, ctx);

    assert.deepEqual(expanded, system, "Single measure rest should not be expanded");
  });

  it("preserves other nodes while expanding rests", () => {
    const input = "X:1\nCDE Z3 FGA|";
    const system = buildTune(input).tune_body!.sequence[0];
    const expanded = expandMultiMeasureRests(system, ctx);

    // Find all non-rest, non-barline nodes
    const otherNodes = expanded.filter((node) => !isMultiMeasureRest(node) && !isBarLine(node));

    // Original nodes should be preserved
    assert.isTrue(otherNodes.length >= 2, "Original nodes should be preserved");
  });

  it("handles multiple multi-measure rests", () => {
    const input = "X:1\nZ2 Z2|";
    const system = buildTune(input).tune_body!.sequence[0];
    const expanded = expandMultiMeasureRests(system, ctx);

    // Should be: Z|Z Z|Z|
    const rests = expanded.filter((node) => isMultiMeasureRest(node));
    const barlines = expanded.filter((node) => isBarLine(node));

    assert.equal(rests.length, 4, "Should have 4 total rests");
    assert.equal(barlines.length, 3, "Should have 3 barlines");
  });

  it("preserves line and position information", () => {
    const input = "X:1\nZ4|";
    const system = buildTune(input).tune_body!.sequence[0];
    const expanded = expandMultiMeasureRests(system, ctx);

    const originalRest = system.find((node): node is MultiMeasureRest => isMultiMeasureRest(node))!;
    const expandedRests = expanded.filter((node): node is MultiMeasureRest => isMultiMeasureRest(node));

    expandedRests.forEach((mult_rest) => {
      assert.equal(mult_rest.rest.line, originalRest.rest.line, "Line number should be preserved");
      assert.equal(mult_rest.rest.position, originalRest.rest.position, "Position should be preserved");
    });
  });

  it("does not modify system without multi-measure rests", () => {
    const input = "X:1\nCDEF|GABG|";
    const system = buildTune(input).tune_body!.sequence[0];
    const expanded = expandMultiMeasureRests(system, ctx);

    assert.deepEqual(expanded, system, "System without rests should not be modified");
  });
});
