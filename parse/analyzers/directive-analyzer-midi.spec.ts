import { expect } from "chai";
import { ABCContext } from "../parsers/Context";
import { AbcErrorReporter } from "../parsers/ErrorReporter";
import { Token, TT } from "../parsers/scan2";
import { Directive, Rational, KV } from "../types/Expr2";
import { SemanticAnalyzer } from "./semantic-analyzer";

describe("Directive Analyzer - MIDI Part 1 (Simple Commands)", () => {
  let analyzer: SemanticAnalyzer;
  let context: ABCContext;

  beforeEach(() => {
    const errorReporter = new AbcErrorReporter();
    context = new ABCContext(errorReporter);
    analyzer = new SemanticAnalyzer(context);
  });

  describe("No-parameter MIDI commands", () => {
    const noParamCommands = [
      "nobarlines",
      "barlines",
      "beataccents",
      "nobeataccents",
      "droneon",
      "droneoff",
      "drumon",
      "drumoff",
      "fermatafixed",
      "fermataproportional",
      "gchordon",
      "gchordoff",
      "controlcombo",
      "temperamentnormal",
      "noportamento",
    ];

    noParamCommands.forEach((cmd) => {
      it(`should parse %%midi ${cmd}`, () => {
        const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
          new Token(TT.IDENTIFIER, cmd, context.generateId()),
        ]);

        const result = analyzer.visitDirectiveExpr(directive);

        expect(result).to.not.be.null;
        expect(result!.type).to.equal("midi");
        expect(result!.data).to.deep.equal({
          command: cmd,
          params: [],
        });
      });
    });

    it("should warn when no-parameter command receives extra parameters", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "nobarlines", context.generateId()),
        new Token(TT.NUMBER, "5", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      // Because the reference implementation warns but continues,
      // we still return a result but report the error
      expect(result).to.not.be.null;
      expect(result!.data).to.deep.equal({
        command: "nobarlines",
        params: [],
      });
    });
  });

  describe("Single-string-parameter MIDI commands", () => {
    it("should parse %%midi gchord fBbm7", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "gchord", context.generateId()),
        new Token(TT.IDENTIFIER, "fBbm7", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.type).to.equal("midi");
      expect(result!.data).to.deep.equal({
        command: "gchord",
        params: ["fBbm7"],
      });
    });

    it("should parse %%midi ptstress 0.5", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "ptstress", context.generateId()),
        new Token(TT.NUMBER, "0.5", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.data).to.deep.equal({
        command: "ptstress",
        params: ["0.5"],
      });
    });

    it("should parse %%midi beatstring fpp", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "beatstring", context.generateId()),
        new Token(TT.IDENTIFIER, "fpp", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.data).to.deep.equal({
        command: "beatstring",
        params: ["fpp"],
      });
    });

    it("should report error when string command is missing parameter", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "gchord", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.be.null;
    });
  });

  describe("Single-integer-parameter MIDI commands", () => {
    const integerCommands = [
      { cmd: "bassvol", value: 64 },
      { cmd: "chordvol", value: 80 },
      { cmd: "c", value: 10 },
      { cmd: "channel", value: 5 },
      { cmd: "beatmod", value: 4 },
      { cmd: "deltaloudness", value: 10 },
      { cmd: "drumbars", value: 2 },
      { cmd: "gracedivider", value: 3 },
      { cmd: "makechordchannels", value: 4 },
      { cmd: "randomchordattack", value: 10 },
      { cmd: "chordattack", value: 20 },
      { cmd: "stressmodel", value: 1 },
      { cmd: "transpose", value: -2 },
      { cmd: "rtranspose", value: 5 },
      { cmd: "vol", value: 100 },
      { cmd: "volinc", value: 10 },
      { cmd: "gchordbars", value: 1 },
    ];

    integerCommands.forEach(({ cmd, value }) => {
      it(`should parse %%midi ${cmd} ${value}`, () => {
        const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
          new Token(TT.IDENTIFIER, cmd, context.generateId()),
          new Token(TT.NUMBER, value.toString(), context.generateId()),
        ]);

        const result = analyzer.visitDirectiveExpr(directive);

        expect(result).to.not.be.null;
        expect(result!.type).to.equal("midi");
        expect(result!.data).to.deep.equal({
          command: cmd,
          params: [value],
        });
      });
    });

    it("should handle negative integers for transpose", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "transpose", context.generateId()),
        new Token(TT.NUMBER, "-2", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.data).to.deep.equal({
        command: "transpose",
        params: [-2],
      });
    });

    it("should report error when integer command is missing parameter", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "vol", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.be.null;
    });

    it("should report error when integer command receives non-integer parameter", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "vol", context.generateId()),
        new Token(TT.IDENTIFIER, "abc", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.be.null;
    });

    it("should report error when integer command receives too many parameters", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "vol", context.generateId()),
        new Token(TT.NUMBER, "100", context.generateId()),
        new Token(TT.NUMBER, "50", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.be.null;
    });
  });

  describe("MIDI command case insensitivity", () => {
    it("should accept uppercase command names", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "NOBARLINES", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.type).to.equal("midi");
      expect((result!.data as any).command).to.equal("nobarlines");
    });

    it("should accept mixed-case command names", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "NoBarLines", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.type).to.equal("midi");
      expect((result!.data as any).command).to.equal("nobarlines");
    });
  });

  describe("Error cases", () => {
    it("should report error when no command is provided", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), []);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.be.null;
    });

    it("should report error for unknown MIDI command", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "unknowncommand", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.be.null;
    });

    it("should report error when command is not an identifier", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.NUMBER, "123", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.be.null;
    });
  });
});

describe("Directive Analyzer - MIDI Part 2 (Multi-Parameter Commands)", () => {
  let analyzer: SemanticAnalyzer;
  let context: ABCContext;

  beforeEach(() => {
    const errorReporter = new AbcErrorReporter();
    context = new ABCContext(errorReporter);
    analyzer = new SemanticAnalyzer(context);
  });

  describe("Two-integer-parameter MIDI commands", () => {
    const twoIntCommands = [
      { cmd: "ratio", values: [3, 4] },
      { cmd: "snt", values: [1, 2] },
      { cmd: "bendvelocity", values: [50, 100] },
      { cmd: "pitchbend", values: [64, 64] },
      { cmd: "control", values: [7, 100] },
      { cmd: "temperamentlinear", values: [0, 100] },
    ];

    twoIntCommands.forEach(({ cmd, values }) => {
      it(`should parse %%midi ${cmd} ${values[0]} ${values[1]}`, () => {
        const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
          new Token(TT.IDENTIFIER, cmd, context.generateId()),
          new Token(TT.NUMBER, values[0].toString(), context.generateId()),
          new Token(TT.NUMBER, values[1].toString(), context.generateId()),
        ]);

        const result = analyzer.visitDirectiveExpr(directive);

        expect(result).to.not.be.null;
        expect(result!.type).to.equal("midi");
        expect(result!.data).to.deep.equal({
          command: cmd,
          params: values,
        });
      });
    });

    it("should report error when two-integer command is missing second parameter", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "ratio", context.generateId()),
        new Token(TT.NUMBER, "3", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.be.null;
    });

    it("should report error when two-integer command has too many parameters", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "ratio", context.generateId()),
        new Token(TT.NUMBER, "3", context.generateId()),
        new Token(TT.NUMBER, "4", context.generateId()),
        new Token(TT.NUMBER, "5", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.be.null;
    });

    it("should report error when first parameter is not a number", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "ratio", context.generateId()),
        new Token(TT.IDENTIFIER, "abc", context.generateId()),
        new Token(TT.NUMBER, "4", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.be.null;
    });

    it("should report error when second parameter is not a number", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "ratio", context.generateId()),
        new Token(TT.NUMBER, "3", context.generateId()),
        new Token(TT.IDENTIFIER, "abc", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.be.null;
    });
  });

  describe("Four-integer-parameter MIDI commands", () => {
    it("should parse %%midi beat 4 1 2 3", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "beat", context.generateId()),
        new Token(TT.NUMBER, "4", context.generateId()),
        new Token(TT.NUMBER, "1", context.generateId()),
        new Token(TT.NUMBER, "2", context.generateId()),
        new Token(TT.NUMBER, "3", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.type).to.equal("midi");
      expect(result!.data).to.deep.equal({
        command: "beat",
        params: [4, 1, 2, 3],
      });
    });

    it("should parse %%midi beat 3 2 1 1", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "beat", context.generateId()),
        new Token(TT.NUMBER, "3", context.generateId()),
        new Token(TT.NUMBER, "2", context.generateId()),
        new Token(TT.NUMBER, "1", context.generateId()),
        new Token(TT.NUMBER, "1", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.data).to.deep.equal({
        command: "beat",
        params: [3, 2, 1, 1],
      });
    });

    it("should report error when beat command has too few parameters", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "beat", context.generateId()),
        new Token(TT.NUMBER, "4", context.generateId()),
        new Token(TT.NUMBER, "1", context.generateId()),
        new Token(TT.NUMBER, "2", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.be.null;
    });

    it("should report error when beat command has too many parameters", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "beat", context.generateId()),
        new Token(TT.NUMBER, "4", context.generateId()),
        new Token(TT.NUMBER, "1", context.generateId()),
        new Token(TT.NUMBER, "2", context.generateId()),
        new Token(TT.NUMBER, "3", context.generateId()),
        new Token(TT.NUMBER, "4", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.be.null;
    });

    it("should report error when one of the parameters is not a number", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "beat", context.generateId()),
        new Token(TT.NUMBER, "4", context.generateId()),
        new Token(TT.IDENTIFIER, "abc", context.generateId()),
        new Token(TT.NUMBER, "2", context.generateId()),
        new Token(TT.NUMBER, "3", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.be.null;
    });
  });

  describe("Five-integer-parameter MIDI commands", () => {
    it("should parse %%midi drone 70 80 50 50 50", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "drone", context.generateId()),
        new Token(TT.NUMBER, "70", context.generateId()),
        new Token(TT.NUMBER, "80", context.generateId()),
        new Token(TT.NUMBER, "50", context.generateId()),
        new Token(TT.NUMBER, "50", context.generateId()),
        new Token(TT.NUMBER, "50", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.type).to.equal("midi");
      expect(result!.data).to.deep.equal({
        command: "drone",
        params: [70, 80, 50, 50, 50],
      });
    });

    it("should report error when drone command has too few parameters", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "drone", context.generateId()),
        new Token(TT.NUMBER, "1", context.generateId()),
        new Token(TT.NUMBER, "2", context.generateId()),
        new Token(TT.NUMBER, "3", context.generateId()),
        new Token(TT.NUMBER, "4", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.be.null;
    });

    it("should report error when one of the parameters is not a number", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "drone", context.generateId()),
        new Token(TT.NUMBER, "70", context.generateId()),
        new Token(TT.NUMBER, "80", context.generateId()),
        new Token(TT.IDENTIFIER, "abc", context.generateId()),
        new Token(TT.NUMBER, "50", context.generateId()),
        new Token(TT.NUMBER, "50", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.be.null;
    });
  });

  describe("String + integer parameter MIDI commands", () => {
    it("should parse %%midi portamento on 20", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "portamento", context.generateId()),
        new Token(TT.IDENTIFIER, "on", context.generateId()),
        new Token(TT.NUMBER, "20", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.type).to.equal("midi");
      expect(result!.data).to.deep.equal({
        command: "portamento",
        params: ["on", 20],
      });
    });

    it("should parse %%midi portamento off 0", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "portamento", context.generateId()),
        new Token(TT.IDENTIFIER, "off", context.generateId()),
        new Token(TT.NUMBER, "0", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.data).to.deep.equal({
        command: "portamento",
        params: ["off", 0],
      });
    });

    it("should report error when portamento is missing integer parameter", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "portamento", context.generateId()),
        new Token(TT.IDENTIFIER, "on", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.be.null;
    });

    it("should report error when portamento has wrong parameter order", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "portamento", context.generateId()),
        new Token(TT.NUMBER, "20", context.generateId()),
        new Token(TT.IDENTIFIER, "on", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.be.null;
    });

    it("should report error when portamento first parameter is not 'on' or 'off'", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "portamento", context.generateId()),
        new Token(TT.IDENTIFIER, "enabled", context.generateId()),
        new Token(TT.NUMBER, "20", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.be.null;
    });
  });

  describe("Integer + optional integer parameter MIDI commands", () => {
    it("should parse %%midi program 25", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "program", context.generateId()),
        new Token(TT.NUMBER, "25", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.type).to.equal("midi");
      expect(result!.data).to.deep.equal({
        command: "program",
        params: [25],
      });
    });

    it("should parse %%midi program 25 1", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "program", context.generateId()),
        new Token(TT.NUMBER, "25", context.generateId()),
        new Token(TT.NUMBER, "1", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.data).to.deep.equal({
        command: "program",
        params: [25, 1],
      });
    });

    it("should report error when program is missing required parameter", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "program", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.be.null;
    });

    it("should report error when program has too many parameters", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "program", context.generateId()),
        new Token(TT.NUMBER, "25", context.generateId()),
        new Token(TT.NUMBER, "1", context.generateId()),
        new Token(TT.NUMBER, "2", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.be.null;
    });

    it("should report error when program parameter is not a number", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "program", context.generateId()),
        new Token(TT.IDENTIFIER, "abc", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.be.null;
    });
  });
});

describe("Directive Analyzer - MIDI Part 3 (Fraction Parameters)", () => {
  let analyzer: SemanticAnalyzer;
  let context: ABCContext;

  beforeEach(() => {
    const errorReporter = new AbcErrorReporter();
    context = new ABCContext(errorReporter);
    analyzer = new SemanticAnalyzer(context);
  });

  describe("Fraction-parameter MIDI commands", () => {
    it("should parse %%midi expand 3/4", () => {
      const rational = new Rational(
        context.generateId(),
        new Token(TT.NUMBER, "3", context.generateId()),
        new Token(TT.SLASH, "/", context.generateId()),
        new Token(TT.NUMBER, "4", context.generateId())
      );

      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "expand", context.generateId()),
        rational,
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.type).to.equal("midi");
      expect(result!.data).to.deep.equal({
        command: "expand",
        params: [{ numerator: 3, denominator: 4 }],
      });
    });

    it("should parse %%midi expand 1/2", () => {
      const rational = new Rational(
        context.generateId(),
        new Token(TT.NUMBER, "1", context.generateId()),
        new Token(TT.SLASH, "/", context.generateId()),
        new Token(TT.NUMBER, "2", context.generateId())
      );

      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "expand", context.generateId()),
        rational,
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.data).to.deep.equal({
        command: "expand",
        params: [{ numerator: 1, denominator: 2 }],
      });
    });

    it("should parse %%midi grace 1/8", () => {
      const rational = new Rational(
        context.generateId(),
        new Token(TT.NUMBER, "1", context.generateId()),
        new Token(TT.SLASH, "/", context.generateId()),
        new Token(TT.NUMBER, "8", context.generateId())
      );

      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "grace", context.generateId()),
        rational,
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.type).to.equal("midi");
      expect(result!.data).to.deep.equal({
        command: "grace",
        params: [{ numerator: 1, denominator: 8 }],
      });
    });

    it("should parse %%midi grace 1/16", () => {
      const rational = new Rational(
        context.generateId(),
        new Token(TT.NUMBER, "1", context.generateId()),
        new Token(TT.SLASH, "/", context.generateId()),
        new Token(TT.NUMBER, "16", context.generateId())
      );

      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "grace", context.generateId()),
        rational,
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.data).to.deep.equal({
        command: "grace",
        params: [{ numerator: 1, denominator: 16 }],
      });
    });

    it("should parse %%midi trim 2/3", () => {
      const rational = new Rational(
        context.generateId(),
        new Token(TT.NUMBER, "2", context.generateId()),
        new Token(TT.SLASH, "/", context.generateId()),
        new Token(TT.NUMBER, "3", context.generateId())
      );

      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "trim", context.generateId()),
        rational,
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.type).to.equal("midi");
      expect(result!.data).to.deep.equal({
        command: "trim",
        params: [{ numerator: 2, denominator: 3 }],
      });
    });

    it("should parse %%midi trim 5/4", () => {
      const rational = new Rational(
        context.generateId(),
        new Token(TT.NUMBER, "5", context.generateId()),
        new Token(TT.SLASH, "/", context.generateId()),
        new Token(TT.NUMBER, "4", context.generateId())
      );

      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "trim", context.generateId()),
        rational,
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.data).to.deep.equal({
        command: "trim",
        params: [{ numerator: 5, denominator: 4 }],
      });
    });
  });

  describe("Error cases for fraction commands", () => {
    it("should report error when expand command is missing parameter", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "expand", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.be.null;
    });

    it("should report error when expand command receives a plain number instead of fraction", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "expand", context.generateId()),
        new Token(TT.NUMBER, "3", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.be.null;
    });

    it("should report error when grace command receives two separate numbers instead of fraction", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "grace", context.generateId()),
        new Token(TT.NUMBER, "1", context.generateId()),
        new Token(TT.NUMBER, "8", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.be.null;
    });

    it("should report error when trim command receives non-numeric parameter", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "trim", context.generateId()),
        new Token(TT.IDENTIFIER, "abc", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.be.null;
    });

    it("should report error when expand command receives too many parameters", () => {
      const rational1 = new Rational(
        context.generateId(),
        new Token(TT.NUMBER, "3", context.generateId()),
        new Token(TT.SLASH, "/", context.generateId()),
        new Token(TT.NUMBER, "4", context.generateId())
      );

      const rational2 = new Rational(
        context.generateId(),
        new Token(TT.NUMBER, "1", context.generateId()),
        new Token(TT.SLASH, "/", context.generateId()),
        new Token(TT.NUMBER, "2", context.generateId())
      );

      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "expand", context.generateId()),
        rational1,
        rational2,
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.be.null;
    });
  });
});

describe("Directive Analyzer - MIDI Part 4 (Octave Parameter Commands)", () => {
  let analyzer: SemanticAnalyzer;
  let context: ABCContext;

  beforeEach(() => {
    const errorReporter = new AbcErrorReporter();
    context = new ABCContext(errorReporter);
    analyzer = new SemanticAnalyzer(context);
  });

  describe("bassprog and chordprog without octave parameter", () => {
    it("should parse %%midi bassprog 32", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "bassprog", context.generateId()),
        new Token(TT.NUMBER, "32", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.type).to.equal("midi");
      expect(result!.data).to.deep.equal({
        command: "bassprog",
        params: [32],
      });
    });

    it("should parse %%midi chordprog 0", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "chordprog", context.generateId()),
        new Token(TT.NUMBER, "0", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.type).to.equal("midi");
      expect(result!.data).to.deep.equal({
        command: "chordprog",
        params: [0],
      });
    });
  });

  describe("bassprog and chordprog with valid octave parameter", () => {
    it("should parse %%midi bassprog 32 octave=1", () => {
      const kv = new KV(
        context.generateId(),
        new Token(TT.NUMBER, "1", context.generateId()),
        new Token(TT.IDENTIFIER, "octave", context.generateId()),
        new Token(TT.EQL, "=", context.generateId())
      );

      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "bassprog", context.generateId()),
        new Token(TT.NUMBER, "32", context.generateId()),
        kv,
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.type).to.equal("midi");
      expect(result!.data).to.deep.equal({
        command: "bassprog",
        params: [32, 1],
      });
    });

    it("should parse %%midi bassprog 32 octave=-1 (minimum valid)", () => {
      const kv = new KV(
        context.generateId(),
        new Token(TT.NUMBER, "-1", context.generateId()),
        new Token(TT.IDENTIFIER, "octave", context.generateId()),
        new Token(TT.EQL, "=", context.generateId())
      );

      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "bassprog", context.generateId()),
        new Token(TT.NUMBER, "32", context.generateId()),
        kv,
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.data).to.deep.equal({
        command: "bassprog",
        params: [32, -1],
      });
    });

    it("should parse %%midi bassprog 32 octave=3 (maximum valid)", () => {
      const kv = new KV(
        context.generateId(),
        new Token(TT.NUMBER, "3", context.generateId()),
        new Token(TT.IDENTIFIER, "octave", context.generateId()),
        new Token(TT.EQL, "=", context.generateId())
      );

      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "bassprog", context.generateId()),
        new Token(TT.NUMBER, "32", context.generateId()),
        kv,
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.data).to.deep.equal({
        command: "bassprog",
        params: [32, 3],
      });
    });

    it("should parse %%midi chordprog 0 octave=0", () => {
      const kv = new KV(
        context.generateId(),
        new Token(TT.NUMBER, "0", context.generateId()),
        new Token(TT.IDENTIFIER, "octave", context.generateId()),
        new Token(TT.EQL, "=", context.generateId())
      );

      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "chordprog", context.generateId()),
        new Token(TT.NUMBER, "0", context.generateId()),
        kv,
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.data).to.deep.equal({
        command: "chordprog",
        params: [0, 0],
      });
    });

    it("should parse %%midi chordprog 0 octave=2", () => {
      const kv = new KV(
        context.generateId(),
        new Token(TT.NUMBER, "2", context.generateId()),
        new Token(TT.IDENTIFIER, "octave", context.generateId()),
        new Token(TT.EQL, "=", context.generateId())
      );

      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "chordprog", context.generateId()),
        new Token(TT.NUMBER, "0", context.generateId()),
        kv,
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.data).to.deep.equal({
        command: "chordprog",
        params: [0, 2],
      });
    });
  });

  describe("Case insensitivity for octave keyword", () => {
    it("should parse %%midi bassprog 32 OCTAVE=1", () => {
      const kv = new KV(
        context.generateId(),
        new Token(TT.NUMBER, "1", context.generateId()),
        new Token(TT.IDENTIFIER, "OCTAVE", context.generateId()),
        new Token(TT.EQL, "=", context.generateId())
      );

      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "bassprog", context.generateId()),
        new Token(TT.NUMBER, "32", context.generateId()),
        kv,
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.data).to.deep.equal({
        command: "bassprog",
        params: [32, 1],
      });
    });

    it("should parse %%midi bassprog 32 Octave=1", () => {
      const kv = new KV(
        context.generateId(),
        new Token(TT.NUMBER, "1", context.generateId()),
        new Token(TT.IDENTIFIER, "Octave", context.generateId()),
        new Token(TT.EQL, "=", context.generateId())
      );

      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "bassprog", context.generateId()),
        new Token(TT.NUMBER, "32", context.generateId()),
        kv,
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.data).to.deep.equal({
        command: "bassprog",
        params: [32, 1],
      });
    });
  });

  describe("Out-of-range octave values with clamping", () => {
    it("should clamp octave=-2 to -1 and report error", () => {
      const kv = new KV(
        context.generateId(),
        new Token(TT.NUMBER, "-2", context.generateId()),
        new Token(TT.IDENTIFIER, "octave", context.generateId()),
        new Token(TT.EQL, "=", context.generateId())
      );

      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "bassprog", context.generateId()),
        new Token(TT.NUMBER, "32", context.generateId()),
        kv,
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      // Because we clamp and report error, the result should still be valid
      expect(result).to.not.be.null;
      expect(result!.data).to.deep.equal({
        command: "bassprog",
        params: [32, -1], // Clamped to -1
      });
    });

    it("should clamp octave=4 to 3 and report error", () => {
      const kv = new KV(
        context.generateId(),
        new Token(TT.NUMBER, "4", context.generateId()),
        new Token(TT.IDENTIFIER, "octave", context.generateId()),
        new Token(TT.EQL, "=", context.generateId())
      );

      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "bassprog", context.generateId()),
        new Token(TT.NUMBER, "32", context.generateId()),
        kv,
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      // Because we clamp and report error, the result should still be valid
      expect(result).to.not.be.null;
      expect(result!.data).to.deep.equal({
        command: "bassprog",
        params: [32, 3], // Clamped to 3
      });
    });

    it("should clamp octave=-5 to -1 and report error", () => {
      const kv = new KV(
        context.generateId(),
        new Token(TT.NUMBER, "-5", context.generateId()),
        new Token(TT.IDENTIFIER, "octave", context.generateId()),
        new Token(TT.EQL, "=", context.generateId())
      );

      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "chordprog", context.generateId()),
        new Token(TT.NUMBER, "0", context.generateId()),
        kv,
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.data).to.deep.equal({
        command: "chordprog",
        params: [0, -1], // Clamped to -1
      });
    });

    it("should clamp octave=10 to 3 and report error", () => {
      const kv = new KV(
        context.generateId(),
        new Token(TT.NUMBER, "10", context.generateId()),
        new Token(TT.IDENTIFIER, "octave", context.generateId()),
        new Token(TT.EQL, "=", context.generateId())
      );

      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "chordprog", context.generateId()),
        new Token(TT.NUMBER, "0", context.generateId()),
        kv,
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.data).to.deep.equal({
        command: "chordprog",
        params: [0, 3], // Clamped to 3
      });
    });
  });

  describe("Error cases", () => {
    it("should report error when bassprog is missing program number", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "bassprog", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.be.null;
    });

    it("should report error when bassprog receives non-numeric program", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "bassprog", context.generateId()),
        new Token(TT.IDENTIFIER, "abc", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.be.null;
    });

    it("should report error when octave value is non-numeric", () => {
      const kv = new KV(
        context.generateId(),
        new Token(TT.IDENTIFIER, "abc", context.generateId()),
        new Token(TT.IDENTIFIER, "octave", context.generateId()),
        new Token(TT.EQL, "=", context.generateId())
      );

      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "bassprog", context.generateId()),
        new Token(TT.NUMBER, "32", context.generateId()),
        kv,
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.be.null;
    });

    it("should report error when second parameter is not a KV object", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "bassprog", context.generateId()),
        new Token(TT.NUMBER, "32", context.generateId()),
        new Token(TT.NUMBER, "1", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.be.null;
    });

    it("should report error when KV key is not 'octave'", () => {
      const kv = new KV(
        context.generateId(),
        new Token(TT.NUMBER, "1", context.generateId()),
        new Token(TT.IDENTIFIER, "pitch", context.generateId()),
        new Token(TT.EQL, "=", context.generateId())
      );

      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "bassprog", context.generateId()),
        new Token(TT.NUMBER, "32", context.generateId()),
        kv,
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.be.null;
    });

    it("should report error when bassprog receives too many parameters", () => {
      const kv = new KV(
        context.generateId(),
        new Token(TT.NUMBER, "1", context.generateId()),
        new Token(TT.IDENTIFIER, "octave", context.generateId()),
        new Token(TT.EQL, "=", context.generateId())
      );

      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "bassprog", context.generateId()),
        new Token(TT.NUMBER, "32", context.generateId()),
        kv,
        new Token(TT.NUMBER, "5", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.be.null;
    });

    it("should report error when chordprog is missing program number", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "chordprog", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.be.null;
    });
  });
});

describe("Directive Analyzer - MIDI Part 5 (Special Cases)", () => {
  let analyzer: SemanticAnalyzer;
  let context: ABCContext;

  beforeEach(() => {
    const errorReporter = new AbcErrorReporter();
    context = new ABCContext(errorReporter);
    analyzer = new SemanticAnalyzer(context);
  });

  describe("drummap command with 2-token format", () => {
    it("should parse %%midi drummap C 36", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "drummap", context.generateId()),
        new Token(TT.IDENTIFIER, "C", context.generateId()),
        new Token(TT.NUMBER, "36", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.type).to.equal("midi");
      expect(result!.data).to.deep.equal({
        command: "drummap",
        params: ["C", 36],
      });
    });

    it("should parse %%midi drummap D 38", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "drummap", context.generateId()),
        new Token(TT.IDENTIFIER, "D", context.generateId()),
        new Token(TT.NUMBER, "38", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.data).to.deep.equal({
        command: "drummap",
        params: ["D", 38],
      });
    });

    it("should parse %%midi drummap F 41", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "drummap", context.generateId()),
        new Token(TT.IDENTIFIER, "F", context.generateId()),
        new Token(TT.NUMBER, "41", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.data).to.deep.equal({
        command: "drummap",
        params: ["F", 41],
      });
    });
  });

  describe("drummap command with 3-token format (accidentals)", () => {
    it("should parse %%midi drummap ^ F 42 (sharp F)", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "drummap", context.generateId()),
        new Token(TT.IDENTIFIER, "^", context.generateId()),
        new Token(TT.IDENTIFIER, "F", context.generateId()),
        new Token(TT.NUMBER, "42", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.type).to.equal("midi");
      expect(result!.data).to.deep.equal({
        command: "drummap",
        params: ["^F", 42],
      });
    });

    it("should parse %%midi drummap _ B 46 (flat B)", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "drummap", context.generateId()),
        new Token(TT.IDENTIFIER, "_", context.generateId()),
        new Token(TT.IDENTIFIER, "B", context.generateId()),
        new Token(TT.NUMBER, "46", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.data).to.deep.equal({
        command: "drummap",
        params: ["_B", 46],
      });
    });

    it("should parse %%midi drummap = G 43 (natural G)", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "drummap", context.generateId()),
        new Token(TT.IDENTIFIER, "=", context.generateId()),
        new Token(TT.IDENTIFIER, "G", context.generateId()),
        new Token(TT.NUMBER, "43", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.data).to.deep.equal({
        command: "drummap",
        params: ["=G", 43],
      });
    });
  });

  describe("drum command with variable integers", () => {
    it("should parse %%midi drum d 76 77 77 77", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "drum", context.generateId()),
        new Token(TT.IDENTIFIER, "d", context.generateId()),
        new Token(TT.NUMBER, "76", context.generateId()),
        new Token(TT.NUMBER, "77", context.generateId()),
        new Token(TT.NUMBER, "77", context.generateId()),
        new Token(TT.NUMBER, "77", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.type).to.equal("midi");
      expect(result!.data).to.deep.equal({
        command: "drum",
        params: ["d", 76, 77, 77, 77],
      });
    });

    it("should parse %%midi drum d2 76 77", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "drum", context.generateId()),
        new Token(TT.IDENTIFIER, "d2", context.generateId()),
        new Token(TT.NUMBER, "76", context.generateId()),
        new Token(TT.NUMBER, "77", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.data).to.deep.equal({
        command: "drum",
        params: ["d2", 76, 77],
      });
    });

    it("should parse %%midi drum d3 76 77 77 77 77", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "drum", context.generateId()),
        new Token(TT.IDENTIFIER, "d3", context.generateId()),
        new Token(TT.NUMBER, "76", context.generateId()),
        new Token(TT.NUMBER, "77", context.generateId()),
        new Token(TT.NUMBER, "77", context.generateId()),
        new Token(TT.NUMBER, "77", context.generateId()),
        new Token(TT.NUMBER, "77", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.data).to.deep.equal({
        command: "drum",
        params: ["d3", 76, 77, 77, 77, 77],
      });
    });

    it("should handle negative integers in drum patterns", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "drum", context.generateId()),
        new Token(TT.IDENTIFIER, "d", context.generateId()),
        new Token(TT.NUMBER, "-1", context.generateId()),
        new Token(TT.NUMBER, "76", context.generateId()),
        new Token(TT.NUMBER, "-2", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.data).to.deep.equal({
        command: "drum",
        params: ["d", -1, 76, -2],
      });
    });
  });

  describe("chordname command with variable integers", () => {
    it("should parse %%midi chordname maj7 0 4 7 11", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "chordname", context.generateId()),
        new Token(TT.IDENTIFIER, "maj7", context.generateId()),
        new Token(TT.NUMBER, "0", context.generateId()),
        new Token(TT.NUMBER, "4", context.generateId()),
        new Token(TT.NUMBER, "7", context.generateId()),
        new Token(TT.NUMBER, "11", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.type).to.equal("midi");
      expect(result!.data).to.deep.equal({
        command: "chordname",
        params: ["maj7", 0, 4, 7, 11],
      });
    });

    it("should parse %%midi chordname min 0 3 7", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "chordname", context.generateId()),
        new Token(TT.IDENTIFIER, "min", context.generateId()),
        new Token(TT.NUMBER, "0", context.generateId()),
        new Token(TT.NUMBER, "3", context.generateId()),
        new Token(TT.NUMBER, "7", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.data).to.deep.equal({
        command: "chordname",
        params: ["min", 0, 3, 7],
      });
    });

    it("should parse %%midi chordname dim7 0 3 6 9", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "chordname", context.generateId()),
        new Token(TT.IDENTIFIER, "dim7", context.generateId()),
        new Token(TT.NUMBER, "0", context.generateId()),
        new Token(TT.NUMBER, "3", context.generateId()),
        new Token(TT.NUMBER, "6", context.generateId()),
        new Token(TT.NUMBER, "9", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.data).to.deep.equal({
        command: "chordname",
        params: ["dim7", 0, 3, 6, 9],
      });
    });

    it("should handle negative integers in chord definitions", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "chordname", context.generateId()),
        new Token(TT.IDENTIFIER, "custom", context.generateId()),
        new Token(TT.NUMBER, "0", context.generateId()),
        new Token(TT.NUMBER, "-1", context.generateId()),
        new Token(TT.NUMBER, "5", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect(result!.data).to.deep.equal({
        command: "chordname",
        params: ["custom", 0, -1, 5],
      });
    });
  });

  describe("Error cases for drummap", () => {
    it("should report error when drummap is missing MIDI number", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "drummap", context.generateId()),
        new Token(TT.IDENTIFIER, "C", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.be.null;
    });

    it("should report error when drummap is missing note name", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "drummap", context.generateId()),
        new Token(TT.NUMBER, "36", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.be.null;
    });

    it("should report error when drummap has non-numeric MIDI number", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "drummap", context.generateId()),
        new Token(TT.IDENTIFIER, "C", context.generateId()),
        new Token(TT.IDENTIFIER, "abc", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.be.null;
    });

    it("should report error when drummap has no parameters", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "drummap", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.be.null;
    });

    it("should report error when drummap has too many parameters", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "drummap", context.generateId()),
        new Token(TT.IDENTIFIER, "C", context.generateId()),
        new Token(TT.NUMBER, "36", context.generateId()),
        new Token(TT.NUMBER, "38", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.be.null;
    });
  });

  describe("Error cases for drum", () => {
    it("should report error when drum is missing integer parameters", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "drum", context.generateId()),
        new Token(TT.IDENTIFIER, "d", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.be.null;
    });

    it("should report error when drum is missing string parameter", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "drum", context.generateId()),
        new Token(TT.NUMBER, "76", context.generateId()),
        new Token(TT.NUMBER, "77", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.be.null;
    });

    it("should report error when drum has non-numeric parameter after string", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "drum", context.generateId()),
        new Token(TT.IDENTIFIER, "d", context.generateId()),
        new Token(TT.NUMBER, "76", context.generateId()),
        new Token(TT.IDENTIFIER, "abc", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.be.null;
    });

    it("should report error when drum has no parameters", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "drum", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.be.null;
    });
  });

  describe("Error cases for chordname", () => {
    it("should report error when chordname is missing integer parameters", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "chordname", context.generateId()),
        new Token(TT.IDENTIFIER, "maj7", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.be.null;
    });

    it("should report error when chordname is missing string parameter", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "chordname", context.generateId()),
        new Token(TT.NUMBER, "0", context.generateId()),
        new Token(TT.NUMBER, "4", context.generateId()),
        new Token(TT.NUMBER, "7", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.be.null;
    });

    it("should report error when chordname has non-numeric parameter after string", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "chordname", context.generateId()),
        new Token(TT.IDENTIFIER, "maj7", context.generateId()),
        new Token(TT.NUMBER, "0", context.generateId()),
        new Token(TT.IDENTIFIER, "abc", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.be.null;
    });

    it("should report error when chordname has no parameters", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "chordname", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.be.null;
    });
  });

  describe("Case insensitivity for drummap, drum, and chordname", () => {
    it("should accept uppercase command names for drummap", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "DRUMMAP", context.generateId()),
        new Token(TT.IDENTIFIER, "C", context.generateId()),
        new Token(TT.NUMBER, "36", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect((result!.data as any).command).to.equal("drummap");
      expect((result!.data as any).params).to.deep.equal(["C", 36]);
    });

    it("should accept mixed-case command names for drum", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "Drum", context.generateId()),
        new Token(TT.IDENTIFIER, "d", context.generateId()),
        new Token(TT.NUMBER, "76", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect((result!.data as any).command).to.equal("drum");
    });

    it("should accept uppercase command names for chordname", () => {
      const directive = new Directive(context.generateId(), new Token(TT.IDENTIFIER, "midi", context.generateId()), [
        new Token(TT.IDENTIFIER, "CHORDNAME", context.generateId()),
        new Token(TT.IDENTIFIER, "maj7", context.generateId()),
        new Token(TT.NUMBER, "0", context.generateId()),
        new Token(TT.NUMBER, "4", context.generateId()),
        new Token(TT.NUMBER, "7", context.generateId()),
      ]);

      const result = analyzer.visitDirectiveExpr(directive);

      expect(result).to.not.be.null;
      expect((result!.data as any).command).to.equal("chordname");
    });
  });
});
