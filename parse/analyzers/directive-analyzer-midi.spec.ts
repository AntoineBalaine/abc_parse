import { expect } from "chai";
import { ABCContext } from "../parsers/Context";
import { AbcErrorReporter } from "../parsers/ErrorReporter";
import { Token, TT } from "../parsers/scan2";
import { Directive } from "../types/Expr2";
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
