import { assert, expect } from "chai";
import * as fc from "fast-check";
import { SemanticAnalyzer } from "../analyzers/semantic-analyzer";
import { ABCContext } from "../parsers/Context";
import { parse } from "../parsers/parse2";
import { Scanner } from "../parsers/scan2";
import { File_structure, File_header, Tune, Tune_header, FormatterConfig, DEFAULT_FORMATTER_CONFIG } from "../types/Expr2";
import { cloneExpr } from "../Visitors/CloneVisitor";
import { CourtesyAccidentalsTransform } from "../Visitors/CourtesyAccidentalsTransform";
import { AbcFormatter } from "../Visitors/Formatter2";
import { filterVoiceInAst } from "../Visitors/VoiceFilterVisitor";

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
      const fileStructure = new File_structure(ctx.generateId(), null, [], false);
      expect(fileStructure.formatterConfig).to.deep.equal(DEFAULT_FORMATTER_CONFIG);
      expect(fileStructure.formatterConfig.systemComments).to.equal(false);
    });

    it("preserves custom formatterConfig when specified", () => {
      const ctx = new ABCContext();
      const customConfig: FormatterConfig = { systemComments: true, voiceMarkerStyle: "inline", courtesyAccidentals: false };
      const fileStructure = new File_structure(ctx.generateId(), null, [], false, customConfig);
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
      const customConfig: FormatterConfig = { systemComments: true, voiceMarkerStyle: "infoline", courtesyAccidentals: false };
      const tune = new Tune(ctx.generateId(), tuneHeader, null, false, customConfig);
      expect(tune.formatterConfig.systemComments).to.equal(true);
      expect(tune.formatterConfig.voiceMarkerStyle).to.equal("infoline");
    });
  });

  describe("Cloner preserves formatterConfig", () => {
    it("cloned File_structure has same formatterConfig", () => {
      const ctx = new ABCContext();
      const customConfig: FormatterConfig = { systemComments: true, voiceMarkerStyle: "inline", courtesyAccidentals: false };
      const fileStructure = new File_structure(ctx.generateId(), new File_header(ctx.generateId(), []), [], true, customConfig);

      const cloned = cloneExpr(fileStructure, ctx);

      expect(cloned.formatterConfig.systemComments).to.equal(true);
      expect(cloned.formatterConfig.voiceMarkerStyle).to.equal("inline");
      // Verify it's a copy, not the same reference
      expect(cloned.formatterConfig).to.not.equal(fileStructure.formatterConfig);
    });

    it("cloned Tune has same formatterConfig", () => {
      const ctx = new ABCContext();
      const tuneHeader = new Tune_header(ctx.generateId(), [], []);
      const customConfig: FormatterConfig = { systemComments: true, voiceMarkerStyle: "infoline", courtesyAccidentals: false };
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
      const customConfig: FormatterConfig = { systemComments: true, voiceMarkerStyle: "inline", courtesyAccidentals: false };
      const fileStructure = new File_structure(ctx.generateId(), new File_header(ctx.generateId(), []), [], true, customConfig);

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
      const customConfig: FormatterConfig = { systemComments: true, voiceMarkerStyle: "infoline", courtesyAccidentals: false };
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

    it("system-comments directive does NOT enable linear mode", () => {
      // system-comments only works when %%abcls-parse linear is also present
      const ctx = new ABCContext();
      const input = "%%abcls-fmt system-comments\n\nX:1\nK:C\nCDEF|\n";
      const tokens = Scanner(input, ctx);
      const ast = parse(tokens, ctx);

      expect(ast.linear).to.equal(false);
      const tune = ast.contents[0] as Tune;
      expect(tune.linear).to.equal(false);
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

    it("inserts comments between systems when both linear and system-comments are enabled", () => {
      const ctx = new ABCContext();
      // Requires BOTH %%abcls-parse linear AND %%abcls-fmt system-comments
      const input = `%%abcls-parse linear
%%abcls-fmt system-comments
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

    it("inserts comments for deferred style tunes with system-comments directive", () => {
      const ctx = new ABCContext();
      // system-comments should insert comments for deferred style multi-voice tunes
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

      // Should contain separator comments for deferred style tunes
      expect(output).to.include("\n%\n");
    });

    it("does not insert comments for single system", () => {
      const ctx = new ABCContext();
      // Linear tune with only one system - requires both directives
      const input = `%%abcls-parse linear
%%abcls-fmt system-comments
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
      // Linear tune with existing empty comment at system boundary - requires both directives
      const input = `%%abcls-parse linear
%%abcls-fmt system-comments
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
      const percentLines = output.split("\n").filter((line) => line.trim() === "%").length;
      // Should have only 1 % line (the original one), not 2
      expect(percentLines).to.equal(1);
    });

    it("inserts system separator for multi-voice linear tune (input/output comparison)", () => {
      const ctx = new ABCContext();
      // Requires BOTH %%abcls-parse linear AND %%abcls-fmt system-comments
      const input = `%%abcls-parse linear
%%abcls-fmt system-comments

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
      const expected = `%%abcls-parse linear
%%abcls-fmt system-comments

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

describe("CourtesyAccidentals", () => {
  function applyCourtesyTransform(input: string): string {
    const ctx = new ABCContext();
    const tokens = Scanner(input, ctx);
    const ast = parse(tokens, ctx);
    const tune = ast.contents[0] as Tune;

    const analyzer = new SemanticAnalyzer(ctx);
    tune.accept(analyzer);

    const transform = new CourtesyAccidentalsTransform();
    transform.transform(tune, analyzer.data, ctx);

    const formatter = new AbcFormatter(ctx);
    return formatter.stringify(tune);
  }
  function stringifyWithoutTransform(input: string): string {
    const ctx = new ABCContext();
    const tokens = Scanner(input, ctx);
    const ast = parse(tokens, ctx);
    const tune = ast.contents[0] as Tune;
    const formatter = new AbcFormatter(ctx);
    return formatter.stringify(tune);
  }

  function formatTune(input: string): string {
    const ctx = new ABCContext();
    const tokens = Scanner(input, ctx);
    const ast = parse(tokens, ctx);
    const tune = ast.contents[0] as Tune;
    const formatter = new AbcFormatter(ctx);
    return formatter.format(tune);
  }

  function formatTuneWithDirective(input: string): string {
    const fullInput = "%%abcls-fmt courtesy-accidentals\n\n" + input;
    const ctx = new ABCContext();
    const tokens = Scanner(fullInput, ctx);
    const ast = parse(tokens, ctx);
    const tune = ast.contents[0] as Tune;
    const formatter = new AbcFormatter(ctx);
    return formatter.format(tune);
  }
  describe("directive parsing", () => {
    it("sets courtesyAccidentals on file-level formatterConfig", () => {
      const ctx = new ABCContext();
      const input = "%%abcls-fmt courtesy-accidentals\n\nX:1\nK:C\nCDEF |";
      const tokens = Scanner(input, ctx);
      parse(tokens, ctx);
      assert.isTrue(ctx.formatterConfig.courtesyAccidentals);
    });

    it("sets courtesyAccidentals on tune-level tuneFormatterConfig", () => {
      const ctx = new ABCContext();
      const input = "X:1\n%%abcls-fmt courtesy-accidentals\nK:C\nCDEF |";
      const tokens = Scanner(input, ctx);
      parse(tokens, ctx);
      assert.isTrue(ctx.tuneFormatterConfig.courtesyAccidentals);
    });

    it("leaves courtesyAccidentals false when no directive is present", () => {
      const ctx = new ABCContext();
      const input = "X:1\nK:C\nCDEF |";
      const tokens = Scanner(input, ctx);
      parse(tokens, ctx);
      assert.isFalse(ctx.formatterConfig.courtesyAccidentals);
      assert.isFalse(ctx.tuneFormatterConfig.courtesyAccidentals);
    });
  });

  describe("CourtesyAccidentalsTransform", () => {
    it("adds a courtesy natural when a note was sharped in the previous measure", () => {
      const output = applyCourtesyTransform("X:1\nK:C\n^C D E F | C D E F |");
      expect(output).to.include("| =C D E F |");
    });

    it("does not add courtesy when the letter was not altered in the previous measure", () => {
      const output = applyCourtesyTransform("X:1\nK:C\n^C D E F | D E F G |");
      // D was not altered in measure 1, so no courtesy is added
      expect(output).to.include("| D E F G |");
      expect(output).to.not.include("=D");
    });

    it("adds a courtesy sharp for F in key of G (F# in key signature)", () => {
      const output = applyCourtesyTransform("X:1\nK:G\n=F G A B | F G A B |");
      expect(output).to.include("| ^F G A B |");
    });

    it("handles multiple voices independently", () => {
      // Both measures are on the same line (no system break) so that
      // previous-measure accidentals carry across the barline.
      const input = "X:1\nV:1\nV:2\nK:C\nV:1\n^C D E F | C D E F |\nV:2\nC D E F | C D E F |";
      const output = applyCourtesyTransform(input);
      const lines = output.split("\n");
      let v1Body = "";
      let v2Body = "";
      let currentVoice = "";
      for (const line of lines) {
        if (line.startsWith("V:1")) currentVoice = "1";
        else if (line.startsWith("V:2")) currentVoice = "2";
        else if (currentVoice === "1" && line.includes("D E F")) v1Body = line;
        else if (currentVoice === "2" && line.includes("D E F")) v2Body = line;
      }
      // Voice 1 should have courtesy =C in measure 2 because C was sharped in measure 1
      expect(v1Body).to.include("=C");
      // Voice 2 should not have any courtesy accidentals because C was never altered
      expect(v2Body).to.not.include("=C");
    });

    it("clears previous accidentals on system break (EOL)", () => {
      // When there is a system break (new line), accidentals from the
      // previous system are cleared, so no courtesy is needed.
      const output = applyCourtesyTransform("X:1\nK:C\n^C D E F |\nC D E F |");
      // The second line's C should not have a courtesy accidental because
      // the EOL/system break cleared the tracking
      const lines = output.split("\n");
      const secondMeasureLine = lines.find((l) => l.startsWith("C D") || l.startsWith("=C D"));
      expect(secondMeasureLine).to.not.be.undefined;
      expect(secondMeasureLine!.startsWith("=C")).to.be.false;
    });

    it("adds courtesy accidentals inside chords", () => {
      const output = applyCourtesyTransform("X:1\nK:C\n[^CE] D E F | [CE] D E F |");
      expect(output).to.include("[=CE]");
    });

    it("does not modify notes that already have explicit accidentals", () => {
      const output = applyCourtesyTransform("X:1\nK:C\n^C D E F | _C D E F |");
      // _C should remain _C, not be changed to =C
      expect(output).to.include("| _C D E F |");
    });

    it("does not add courtesy on tied notes across barlines", () => {
      const output = applyCourtesyTransform("X:1\nK:C\n^C D E F-| F D E C |");
      // F is tied, so it should not get a courtesy accidental.
      // However, C was sharped in measure 1, so C in measure 2 gets =C.
      expect(output).to.include("| F D E =C |");
    });

    it("clears previous accidentals on multi-measure rest", () => {
      const output = applyCourtesyTransform("X:1\nK:C\n^C D E F | Z | C D E F |");
      // After a multi-measure rest, previous accidentals are cleared
      // so C in the third measure should not get a courtesy accidental
      expect(output).to.not.include("=C");
    });

    it("adds courtesy accidentals on grace notes (consuming)", () => {
      const output = applyCourtesyTransform("X:1\nK:C\n^C D E F | {C}D E F G |");
      // Grace note C should receive courtesy =C
      expect(output).to.include("{=C}");
    });

    it("grace notes produce accidentals that trigger courtesy in next measure", () => {
      const output = applyCourtesyTransform("X:1\nK:C\n{^C}D E F G | C D E F |");
      // Grace note ^C in measure 1 altered C, so C in measure 2 gets =C
      expect(output).to.include("| =C D E F |");
    });

    it("handles chained accidentals across three measures", () => {
      const output = applyCourtesyTransform("X:1\nK:C\n^C D E F | _C D E F | C D E F |");
      // Measure 2: _C has explicit accidental, left as-is
      // Measure 3: C was flatted in measure 2, so C gets courtesy =C
      expect(output).to.include("| _C D E F | =C D E F |");
    });

    it("does not modify input when no accidentals are present", () => {
      const input = "X:1\nK:C\nC D E F | G A B c |";
      const output = applyCourtesyTransform(input);
      // No accidentals in any measure, so no courtesy accidentals should be added
      expect(output).to.not.include("=");
      expect(output).to.not.include("^");
      expect(output).to.not.include("_");
    });

    it("processes an entire file structure with multiple tunes", () => {
      const input = "X:1\nK:C\n^C D E F | C D E F |\n\nX:2\nK:G\n=F G A B | F G A B |";
      const ctx = new ABCContext();
      const tokens = Scanner(input, ctx);
      const ast = parse(tokens, ctx);

      const analyzer = new SemanticAnalyzer(ctx);
      // We analyze each tune separately because the semantic analyzer works per-tune
      for (const content of ast.contents) {
        if (content instanceof Tune) {
          content.accept(analyzer);
        }
      }

      const transform = new CourtesyAccidentalsTransform();
      transform.transform(ast, analyzer.data, ctx);

      const formatter = new AbcFormatter(ctx);
      const tune1 = ast.contents[0] as Tune;
      const tune2 = ast.contents[1] as Tune;
      const output1 = formatter.stringify(tune1);
      const output2 = formatter.stringify(tune2);

      // Tune 1: C was sharped in measure 1, so measure 2 gets courtesy =C
      expect(output1).to.include("=C");
      // Tune 2: F was naturalized in measure 1 (key of G has F#), so measure 2 gets courtesy ^F
      expect(output2).to.include("^F");
    });

    it("isolates state between tunes when processing a file structure", () => {
      // Tune 1 alters C, tune 2 should not be affected by tune 1's accidentals
      const input = "X:1\nK:C\n^C D E F |\n\nX:2\nK:C\nC D E F | C D E F |";
      const ctx = new ABCContext();
      const tokens = Scanner(input, ctx);
      const ast = parse(tokens, ctx);

      const analyzer = new SemanticAnalyzer(ctx);
      for (const content of ast.contents) {
        if (content instanceof Tune) {
          content.accept(analyzer);
        }
      }

      const transform = new CourtesyAccidentalsTransform();
      transform.transform(ast, analyzer.data, ctx);

      const formatter = new AbcFormatter(ctx);
      const tune2 = ast.contents[1] as Tune;
      const output2 = formatter.stringify(tune2);

      // Tune 2 never altered C, so no courtesy accidental should appear
      expect(output2).to.not.include("=C");
    });
  });

  describe("property-based tests", () => {
    const noteLetterArb = fc.constantFrom("C", "D", "E", "F", "G", "A", "B");
    const keyArb = fc.constantFrom("C", "G", "D", "F", "Bb", "Eb", "Am", "Em");

    // Generator for a sequence of note letters (no accidentals) separated by spaces
    const measureArb = fc.array(noteLetterArb, { minLength: 1, maxLength: 6 }).map((notes) => notes.join(" "));

    it("produces no changes when no measure contains an explicit accidental", () => {
      fc.assert(
        fc.property(keyArb, fc.array(measureArb, { minLength: 1, maxLength: 4 }), (key, measures) => {
          const body = measures.join(" | ");
          const input = `X:1\nK:${key}\n${body} |`;
          const output = applyCourtesyTransform(input);
          const inputStringified = stringifyWithoutTransform(input);
          // Because no explicit accidentals exist, the transform should not add any
          expect(output).to.equal(inputStringified);
        }),
        { numRuns: 50 }
      );
    });

    it("never modifies a note that already has an explicit accidental", () => {
      const accidentalArb = fc.constantFrom("^", "_", "=");
      fc.assert(
        fc.property(noteLetterArb, accidentalArb, (letter, acc) => {
          // Measure 1: alter the note. Measure 2: same note with a different explicit accidental.
          // We use a different letter (that won't be altered) to avoid interference.
          const otherAcc = acc === "^" ? "_" : "^";
          const safeLetter = letter === "G" ? "A" : "G";
          const input = `X:1\nK:C\n${acc}${letter} ${safeLetter} ${safeLetter} ${safeLetter} | ${otherAcc}${letter} ${safeLetter} ${safeLetter} ${safeLetter} |`;
          const output = applyCourtesyTransform(input);
          // The second measure's note should keep its original explicit accidental
          expect(output).to.include(`${otherAcc}${letter}`);
        }),
        { numRuns: 30 }
      );
    });

    it("the output has at least as many accidental tokens as the input", () => {
      const accidentalArb = fc.constantFrom("^", "_", "=");
      fc.assert(
        fc.property(noteLetterArb, accidentalArb, (letter, acc) => {
          const input = `X:1\nK:C\n${acc}${letter} D E F | ${letter} D E F |`;
          const inputStringified = stringifyWithoutTransform(input);
          const output = applyCourtesyTransform(input);
          const countAccidentals = (s: string) => (s.match(/[=^_]/g) || []).length;
          // The transform only adds accidentals, never removes them
          expect(countAccidentals(output)).to.be.gte(countAccidentals(inputStringified));
        }),
        { numRuns: 30 }
      );
    });
  });

  describe("end-to-end formatter integration", () => {
    it("adds courtesy accidentals when file-level directive is present", () => {
      const input = "%%abcls-fmt courtesy-accidentals\n\nX:1\nK:C\n^C D E F | C D E F |";
      const output = formatTune(input);
      expect(output).to.include("=C");
    });

    it("does not add courtesy accidentals when no directive is present", () => {
      const input = "X:1\nK:C\n^C D E F | C D E F |";
      const output = formatTune(input);
      // Without the directive, the C in measure 2 should remain unaltered
      expect(output).to.not.include("=C");
    });

    it("adds courtesy accidentals when tune-level directive is present", () => {
      const input = "X:1\n%%abcls-fmt courtesy-accidentals\nK:C\n^C D E F | C D E F |";
      const output = formatTune(input);
      expect(output).to.include("=C");
    });

    it("handles multi-voice with directive enabled", () => {
      const input = "%%abcls-fmt courtesy-accidentals\n\nX:1\nV:1\nV:2\nK:C\nV:1\n^C D E F | C D E F |\nV:2\nC D E F | C D E F |";
      const output = formatTune(input);
      // Voice 1 should have courtesy =C, voice 2 should not
      const lines = output.split("\n");
      let v1Body = "";
      let v2Body = "";
      let currentVoice = "";
      for (const line of lines) {
        if (line.startsWith("V:1")) currentVoice = "1";
        else if (line.startsWith("V:2")) currentVoice = "2";
        else if (currentVoice === "1" && line.includes("D E F")) v1Body = line;
        else if (currentVoice === "2" && line.includes("D E F")) v2Body = line;
      }
      expect(v1Body).to.include("=C");
      expect(v2Body).to.not.include("=C");
    });

    it("respects key changes mid-tune", () => {
      // ^F in K:C means F is altered. After [K:G], F is sharp in the key signature.
      // The transform sees that F was altered in the previous measure, and the key
      // of G says F should be sharp, so it inserts a courtesy ^F. This is redundant
      // with the key signature but correct: the courtesy shows the player what
      // accidental applies after the key change.
      const input = "%%abcls-fmt courtesy-accidentals\n\nX:1\nK:C\n^F G A B | [K:G] F G A B |";
      const output = formatTune(input);
      expect(output).to.include("[K:G] ^F G A B");
    });

    it("no new accidentals are introduced without the directive (property-based)", () => {
      const keyArb = fc.constantFrom("C", "G", "D", "F", "Bb");
      const noteArb = fc.constantFrom("C", "D", "E", "F", "G", "A", "B");
      const accArb = fc.constantFrom("^", "_", "=");
      fc.assert(
        fc.property(keyArb, noteArb, accArb, (key, note, acc) => {
          const input = `X:1\nK:${key}\n${acc}${note} D E F | ${note} D E F |`;
          const withDirective = formatTuneWithDirective(input);
          const withoutDirective = formatTune(input);
          const countAccidentals = (s: string) => (s.match(/[=^_]/g) || []).length;
          // Without the directive, no new accidentals should be added
          const inputStringified = stringifyWithoutTransform(input);
          expect(countAccidentals(withoutDirective)).to.equal(countAccidentals(inputStringified));
          // With the directive, accidentals may be added (or equal if no courtesy needed)
          expect(countAccidentals(withDirective)).to.be.gte(countAccidentals(inputStringified));
        }),
        { numRuns: 30 }
      );
    });
  });
});
