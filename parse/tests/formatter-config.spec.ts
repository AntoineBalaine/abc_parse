import { expect } from "chai";
import * as fc from "fast-check";
import { ABCContext } from "../parsers/Context";
import {
  File_structure,
  File_header,
  Tune,
  Tune_header,
  FormatterConfig,
  DEFAULT_FORMATTER_CONFIG,
} from "../types/Expr2";
import { Scanner } from "../parsers/scan2";
import { parse } from "../parsers/parse2";
import { cloneExpr } from "../Visitors/CloneVisitor";
import { filterVoiceInAst } from "../Visitors/VoiceFilterVisitor";
import { AbcFormatter } from "../Visitors/Formatter2";

describe("FormatterConfig", () => {
  describe("DEFAULT_FORMATTER_CONFIG", () => {
    it("has systemComments set to false", () => {
      expect(DEFAULT_FORMATTER_CONFIG.systemComments).to.equal(false);
    });

    it("has voiceMarkerStyle set to null", () => {
      expect(DEFAULT_FORMATTER_CONFIG.voiceMarkerStyle).to.equal(null);
    });
  });

  describe("File_structure", () => {
    it("has formatterConfig with default value when not specified", () => {
      const ctx = new ABCContext();
      const fileStructure = new File_structure(
        ctx.generateId(),
        null,
        [],
        false
      );
      expect(fileStructure.formatterConfig).to.deep.equal(DEFAULT_FORMATTER_CONFIG);
      expect(fileStructure.formatterConfig.systemComments).to.equal(false);
    });

    it("preserves custom formatterConfig when specified", () => {
      const ctx = new ABCContext();
      const customConfig: FormatterConfig = { systemComments: true, voiceMarkerStyle: "inline" };
      const fileStructure = new File_structure(
        ctx.generateId(),
        null,
        [],
        false,
        customConfig
      );
      expect(fileStructure.formatterConfig.systemComments).to.equal(true);
      expect(fileStructure.formatterConfig.voiceMarkerStyle).to.equal("inline");
    });
  });

  describe("Tune", () => {
    it("has formatterConfig with default value when not specified", () => {
      const ctx = new ABCContext();
      const tuneHeader = new Tune_header(ctx.generateId(), [], []);
      const tune = new Tune(ctx.generateId(), tuneHeader, null, false);
      expect(tune.formatterConfig).to.deep.equal(DEFAULT_FORMATTER_CONFIG);
      expect(tune.formatterConfig.systemComments).to.equal(false);
      expect(tune.formatterConfig.voiceMarkerStyle).to.equal(null);
    });

    it("preserves custom formatterConfig when specified", () => {
      const ctx = new ABCContext();
      const tuneHeader = new Tune_header(ctx.generateId(), [], []);
      const customConfig: FormatterConfig = { systemComments: true, voiceMarkerStyle: "infoline" };
      const tune = new Tune(ctx.generateId(), tuneHeader, null, false, customConfig);
      expect(tune.formatterConfig.systemComments).to.equal(true);
      expect(tune.formatterConfig.voiceMarkerStyle).to.equal("infoline");
    });
  });

  describe("Cloner preserves formatterConfig", () => {
    it("cloned File_structure has same formatterConfig", () => {
      const ctx = new ABCContext();
      const customConfig: FormatterConfig = { systemComments: true, voiceMarkerStyle: "inline" };
      const fileStructure = new File_structure(
        ctx.generateId(),
        new File_header(ctx.generateId(), []),
        [],
        true,
        customConfig
      );

      const cloned = cloneExpr(fileStructure, ctx);

      expect(cloned.formatterConfig.systemComments).to.equal(true);
      expect(cloned.formatterConfig.voiceMarkerStyle).to.equal("inline");
      // Verify it's a copy, not the same reference
      expect(cloned.formatterConfig).to.not.equal(fileStructure.formatterConfig);
    });

    it("cloned Tune has same formatterConfig", () => {
      const ctx = new ABCContext();
      const tuneHeader = new Tune_header(ctx.generateId(), [], []);
      const customConfig: FormatterConfig = { systemComments: true, voiceMarkerStyle: "infoline" };
      const tune = new Tune(ctx.generateId(), tuneHeader, null, true, customConfig);

      const cloned = cloneExpr(tune, ctx);

      expect(cloned.formatterConfig.systemComments).to.equal(true);
      expect(cloned.formatterConfig.voiceMarkerStyle).to.equal("infoline");
      // Verify it's a copy, not the same reference
      expect(cloned.formatterConfig).to.not.equal(tune.formatterConfig);
    });
  });

  describe("VoiceFilterVisitor preserves formatterConfig", () => {
    it("filtered File_structure has same formatterConfig", () => {
      const ctx = new ABCContext();
      const customConfig: FormatterConfig = { systemComments: true, voiceMarkerStyle: "inline" };
      const fileStructure = new File_structure(
        ctx.generateId(),
        new File_header(ctx.generateId(), []),
        [],
        true,
        customConfig
      );

      const filtered = filterVoiceInAst(fileStructure, ctx);

      expect(filtered.formatterConfig.systemComments).to.equal(true);
      expect(filtered.formatterConfig.voiceMarkerStyle).to.equal("inline");
      // Verify it's a copy, not the same reference
      expect(filtered.formatterConfig).to.not.equal(fileStructure.formatterConfig);
    });

    it("filtered Tune has same formatterConfig", () => {
      const ctx = new ABCContext();
      const input = "X:1\nK:C\nCDEF|\n";
      const tokens = Scanner(input, ctx);
      const ast = parse(tokens, ctx);

      // Set custom config on the file and tune
      const customConfig: FormatterConfig = { systemComments: true, voiceMarkerStyle: "infoline" };
      ast.formatterConfig = customConfig;
      (ast.contents[0] as Tune).formatterConfig = customConfig;

      const filtered = filterVoiceInAst(ast, ctx);

      expect(filtered.formatterConfig.systemComments).to.equal(true);
      expect(filtered.formatterConfig.voiceMarkerStyle).to.equal("infoline");
      const filteredTune = filtered.contents[0] as Tune;
      expect(filteredTune.formatterConfig.systemComments).to.equal(true);
      expect(filteredTune.formatterConfig.voiceMarkerStyle).to.equal("infoline");
    });
  });

  describe("parsed files have formatterConfig", () => {
    it("parsed File_structure has default formatterConfig", () => {
      const ctx = new ABCContext();
      const input = "X:1\nK:C\nCDEF|\n";
      const tokens = Scanner(input, ctx);
      const ast = parse(tokens, ctx);

      expect(ast.formatterConfig).to.deep.equal(DEFAULT_FORMATTER_CONFIG);
    });

    it("parsed Tune has default formatterConfig", () => {
      const ctx = new ABCContext();
      const input = "X:1\nK:C\nCDEF|\n";
      const tokens = Scanner(input, ctx);
      const ast = parse(tokens, ctx);

      const tune = ast.contents[0] as Tune;
      expect(tune.formatterConfig).to.deep.equal(DEFAULT_FORMATTER_CONFIG);
    });
  });

  describe("%%abcls-fmt directive parsing", () => {
    it("file-level %%abcls-fmt system-comments sets formatterConfig on File_structure", () => {
      const ctx = new ABCContext();
      const input = "%%abcls-fmt system-comments\n\nX:1\nK:C\nCDEF|\n";
      const tokens = Scanner(input, ctx);
      const ast = parse(tokens, ctx);

      expect(ast.formatterConfig.systemComments).to.equal(true);
    });

    it("directive also enables linear mode", () => {
      const ctx = new ABCContext();
      const input = "%%abcls-fmt system-comments\n\nX:1\nK:C\nCDEF|\n";
      const tokens = Scanner(input, ctx);
      const ast = parse(tokens, ctx);

      expect(ast.linear).to.equal(true);
      const tune = ast.contents[0] as Tune;
      expect(tune.linear).to.equal(true);
    });

    it("tune inherits file-level formatterConfig", () => {
      const ctx = new ABCContext();
      const input = "%%abcls-fmt system-comments\n\nX:1\nK:C\nCDEF|\n";
      const tokens = Scanner(input, ctx);
      const ast = parse(tokens, ctx);

      const tune = ast.contents[0] as Tune;
      expect(tune.formatterConfig.systemComments).to.equal(true);
    });

    it("tune-level %%abcls-fmt without file-level works", () => {
      const ctx = new ABCContext();
      const input = "X:1\n%%abcls-fmt system-comments\nK:C\nCDEF|\n";
      const tokens = Scanner(input, ctx);
      const ast = parse(tokens, ctx);

      // File level should be default (false)
      expect(ast.formatterConfig.systemComments).to.equal(false);
      // Tune level should be true
      const tune = ast.contents[0] as Tune;
      expect(tune.formatterConfig.systemComments).to.equal(true);
    });

  });

  describe("%%abcls-fmt voice-markers directive parsing", () => {
    it("file-level %%abcls-fmt voice-markers=inline sets voiceMarkerStyle on File_structure", () => {
      const ctx = new ABCContext();
      const input = "%%abcls-fmt voice-markers=inline\n\nX:1\nK:C\nCDEF|\n";
      const tokens = Scanner(input, ctx);
      const ast = parse(tokens, ctx);

      expect(ast.formatterConfig.voiceMarkerStyle).to.equal("inline");
    });

    it("file-level %%abcls-fmt voice-markers=infoline sets voiceMarkerStyle on File_structure", () => {
      const ctx = new ABCContext();
      const input = "%%abcls-fmt voice-markers=infoline\n\nX:1\nK:C\nCDEF|\n";
      const tokens = Scanner(input, ctx);
      const ast = parse(tokens, ctx);

      expect(ast.formatterConfig.voiceMarkerStyle).to.equal("infoline");
    });

    it("tune-level %%abcls-fmt voice-markers=inline sets voiceMarkerStyle on Tune", () => {
      const ctx = new ABCContext();
      const input = "X:1\n%%abcls-fmt voice-markers=inline\nK:C\nCDEF|\n";
      const tokens = Scanner(input, ctx);
      const ast = parse(tokens, ctx);

      // File level should be default (null)
      expect(ast.formatterConfig.voiceMarkerStyle).to.equal(null);
      // Tune level should be "inline"
      const tune = ast.contents[0] as Tune;
      expect(tune.formatterConfig.voiceMarkerStyle).to.equal("inline");
    });

    it("tune-level %%abcls-fmt voice-markers=infoline sets voiceMarkerStyle on Tune", () => {
      const ctx = new ABCContext();
      const input = "X:1\n%%abcls-fmt voice-markers=infoline\nK:C\nCDEF|\n";
      const tokens = Scanner(input, ctx);
      const ast = parse(tokens, ctx);

      // File level should be default (null)
      expect(ast.formatterConfig.voiceMarkerStyle).to.equal(null);
      // Tune level should be "infoline"
      const tune = ast.contents[0] as Tune;
      expect(tune.formatterConfig.voiceMarkerStyle).to.equal("infoline");
    });

    it("no directive leaves voiceMarkerStyle as null", () => {
      const ctx = new ABCContext();
      const input = "X:1\nK:C\nCDEF|\n";
      const tokens = Scanner(input, ctx);
      const ast = parse(tokens, ctx);

      expect(ast.formatterConfig.voiceMarkerStyle).to.equal(null);
      const tune = ast.contents[0] as Tune;
      expect(tune.formatterConfig.voiceMarkerStyle).to.equal(null);
    });

    it("invalid value leaves voiceMarkerStyle as null", () => {
      const ctx = new ABCContext();
      const input = "%%abcls-fmt voice-markers=unknown\n\nX:1\nK:C\nCDEF|\n";
      const tokens = Scanner(input, ctx);
      const ast = parse(tokens, ctx);

      expect(ast.formatterConfig.voiceMarkerStyle).to.equal(null);
    });

    it("tune inherits file-level voiceMarkerStyle", () => {
      const ctx = new ABCContext();
      const input = "%%abcls-fmt voice-markers=inline\n\nX:1\nK:C\nCDEF|\n";
      const tokens = Scanner(input, ctx);
      const ast = parse(tokens, ctx);

      const tune = ast.contents[0] as Tune;
      expect(tune.formatterConfig.voiceMarkerStyle).to.equal("inline");
    });

    it("tune-level directive overrides file-level", () => {
      const ctx = new ABCContext();
      const input = "%%abcls-fmt voice-markers=inline\n\nX:1\n%%abcls-fmt voice-markers=infoline\nK:C\nCDEF|\n";
      const tokens = Scanner(input, ctx);
      const ast = parse(tokens, ctx);

      // File level should be "inline"
      expect(ast.formatterConfig.voiceMarkerStyle).to.equal("inline");
      // Tune level should be "infoline" (overridden)
      const tune = ast.contents[0] as Tune;
      expect(tune.formatterConfig.voiceMarkerStyle).to.equal("infoline");
    });

    it("voice-markers directive does not affect linear mode", () => {
      const ctx = new ABCContext();
      const input = "%%abcls-fmt voice-markers=inline\n\nX:1\nK:C\nCDEF|\n";
      const tokens = Scanner(input, ctx);
      const ast = parse(tokens, ctx);

      // voice-markers should not enable linear mode (unlike system-comments)
      expect(ast.linear).to.equal(false);
    });

    it("property: valid voice-markers values set the correct voiceMarkerStyle", () => {
      fc.assert(
        fc.property(fc.constantFrom("inline", "infoline"), (style) => {
          const ctx = new ABCContext();
          const input = `%%abcls-fmt voice-markers=${style}\n\nX:1\nK:C\nCDEF|\n`;
          const tokens = Scanner(input, ctx);
          const ast = parse(tokens, ctx);

          return ast.formatterConfig.voiceMarkerStyle === style;
        }),
        { numRuns: 20 }
      );
    });
  });

  describe("system separator comment insertion", () => {
    it("does not insert comments when systemComments is false", () => {
      const ctx = new ABCContext();
      // Linear multi-voice tune without system-comments directive
      const input = `%%abcls-parse linear
X:1
V:1
V:2
K:C
V:1
CDEF|
V:2
GFED|
V:1
EFGA|
V:2
ABCD|
`;
      const tokens = Scanner(input, ctx);
      const ast = parse(tokens, ctx);
      const tune = ast.contents[0] as Tune;

      const formatter = new AbcFormatter(ctx);
      const output = formatter.stringify(tune);

      // Should not contain any inserted %\n comments between systems
      // (there may be existing comments but not our separator comments)
      expect(output).to.not.include("\n%\n");
    });

    it("inserts comments between systems when enabled", () => {
      const ctx = new ABCContext();
      // Linear multi-voice tune WITH system-comments directive (which also enables linear mode)
      const input = `%%abcls-fmt system-comments
X:1
V:1
V:2
K:C
V:1
CDEF|
V:2
GFED|
V:1
EFGA|
V:2
ABCD|
`;
      const tokens = Scanner(input, ctx);
      const ast = parse(tokens, ctx);
      const tune = ast.contents[0] as Tune;

      const formatter = new AbcFormatter(ctx);
      const output = formatter.stringify(tune);

      // Should contain %\n between systems
      expect(output).to.include("\n%\n");
    });

    it("does not insert comments for single system", () => {
      const ctx = new ABCContext();
      // Linear tune with only one system
      const input = `%%abcls-fmt system-comments
X:1
V:1
V:2
K:C
V:1
CDEF|
V:2
GFED|
`;
      const tokens = Scanner(input, ctx);
      const ast = parse(tokens, ctx);
      const tune = ast.contents[0] as Tune;

      const formatter = new AbcFormatter(ctx);
      const output = formatter.stringify(tune);

      // Should not contain any separator comments for single system
      expect(output).to.not.include("\n%\n");
    });

    it("does not insert comments when directive is absent", () => {
      const ctx = new ABCContext();
      // Multi-voice tune without system-comments directive (uses %%abcls-parse for multi-system parsing)
      const input = `%%abcls-parse linear
X:1
V:1
V:2
K:C
V:1
CDEF|
V:2
GFED|
V:1
EFGA|
V:2
ABCD|
`;
      const tokens = Scanner(input, ctx);
      const ast = parse(tokens, ctx);
      const tune = ast.contents[0] as Tune;

      const formatter = new AbcFormatter(ctx);
      const output = formatter.stringify(tune);

      // Without the directive, no separator comments should be inserted
      expect(output).to.not.include("\n%\n");
    });

    it("does not insert comment if boundary already has empty comment", () => {
      const ctx = new ABCContext();
      // Linear tune with existing empty comment at system boundary
      const input = `%%abcls-fmt system-comments
X:1
V:1
V:2
K:C
V:1
CDEF|
V:2
GFED|
%
V:1
EFGA|
V:2
ABCD|
`;
      const tokens = Scanner(input, ctx);
      const ast = parse(tokens, ctx);
      const tune = ast.contents[0] as Tune;

      const formatter = new AbcFormatter(ctx);
      const output = formatter.stringify(tune);

      // Count the number of standalone % lines (not including %%directives)
      const percentLines = output.split("\n").filter(line => line.trim() === "%").length;
      // Should have only 1 % line (the original one), not 2
      expect(percentLines).to.equal(1);
    });

    it("inserts system separator for multi-voice linear tune (input/output comparison)", () => {
      const ctx = new ABCContext();
      const input = `%%abcls-fmt system-comments

X:1
T:Test
M:4/4
L:1/4
V:1 name=A clef=treble
V:2 name=B clef=bass
K:C
V:1
CDEF | abcd
V:2
X    |
V:1
FDEA
V:2
FDEC |
`;
      const expected = `%%abcls-fmt system-comments

X:1
T:Test
M:4/4
L:1/4
V:1 name=A clef=treble
V:2 name=B clef=bass
K:C
V:1
CDEF | abcd
V:2
X    |
%
V:1
FDEA
V:2
FDEC |
`;
      const tokens = Scanner(input, ctx);
      const ast = parse(tokens, ctx);

      const formatter = new AbcFormatter(ctx);
      const output = formatter.formatFile(ast);

      expect(output).to.equal(expected);
    });
  });
});
