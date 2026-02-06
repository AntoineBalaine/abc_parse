import { expect } from "chai";
import { ABCContext } from "../parsers/Context";
import { AbcErrorReporter } from "../parsers/ErrorReporter";
import { Scanner } from "../parsers/scan2";
import { parse } from "../parsers/parse2";
import { filterVoiceInAst, filterVoicesInAbc, VoiceFilterState, FilterContext } from "../Visitors/VoiceFilterVisitor";
import { AbcFormatter } from "../Visitors/Formatter2";
import { File_structure, Tune, Info_line, Directive } from "../types/Expr2";

describe("VoiceFilterVisitor", () => {
  let context: ABCContext;

  beforeEach(() => {
    context = new ABCContext(new AbcErrorReporter());
  });

  function parseAbc(source: string): File_structure {
    const tokens = Scanner(source, context);
    return parse(tokens, context);
  }

  function filterAndStringify(source: string): string {
    const ast = parseAbc(source);
    const filtered = filterVoiceInAst(ast, context);
    const formatter = new AbcFormatter(context);
    return formatter.stringify(filtered);
  }

  describe("Example-based tests", () => {
    it("Basic show filtering: %%abcls-voices show V1 on a 2-voice tune keeps only V1 content", () => {
      const source = `X:1
T:Test
M:4/4
L:1/4
%%abcls-voices show V1
V:V1 clef=treble
V:V2 clef=bass
K:C
[V:V1]CDEF|
[V:V2]GFED|
`;
      const result = filterAndStringify(source);

      // V1 content should be present
      expect(result).to.include("[V:V1]");
      expect(result).to.include("CDEF");

      // V2 content should be removed
      expect(result).to.not.include("[V:V2]");
      expect(result).to.not.include("GFED");

      // %%abcls-voices directive should be removed
      expect(result).to.not.include("%%abcls-voices");
    });

    it("Basic hide filtering: %%abcls-voices hide V1 on a 2-voice tune removes V1 content", () => {
      const source = `X:1
T:Test
M:4/4
L:1/4
%%abcls-voices hide V1
V:V1 clef=treble
V:V2 clef=bass
K:C
[V:V1]CDEF|
[V:V2]GFED|
`;
      const result = filterAndStringify(source);

      // V1 content should be removed
      expect(result).to.not.include("[V:V1]");
      expect(result).to.not.include("CDEF");

      // V2 content should be present
      expect(result).to.include("[V:V2]");
      expect(result).to.include("GFED");
    });

    it("File header scope: file-level %%abcls-voices show V1 filters all tunes", () => {
      const source = `%%abcls-voices show V1

X:1
T:Tune 1
M:4/4
L:1/4
V:V1 clef=treble
V:V2 clef=bass
K:C
[V:V1]CDEF|
[V:V2]GFED|

X:2
T:Tune 2
M:4/4
L:1/4
V:V1 clef=treble
V:V2 clef=bass
K:C
[V:V1]EFGA|
[V:V2]AGFE|
`;
      const result = filterAndStringify(source);

      // Both tunes should have V1 content only
      expect(result).to.include("[V:V1]");
      expect(result).to.include("CDEF");
      expect(result).to.include("EFGA");

      // V2 content should be removed from both tunes
      expect(result).to.not.include("[V:V2]");
      expect(result).to.not.include("GFED");
      expect(result).to.not.include("AGFE");
    });

    it("Tune header override: file-level %%abcls-voices show V1 overridden by tune-level %%abcls-voices show V2", () => {
      const source = `%%abcls-voices show V1

X:1
T:Tune 1 (uses file default)
M:4/4
L:1/4
V:V1 clef=treble
V:V2 clef=bass
K:C
[V:V1]CDEF|
[V:V2]GFED|

X:2
T:Tune 2 (overrides to V2)
M:4/4
L:1/4
%%abcls-voices show V2
V:V1 clef=treble
V:V2 clef=bass
K:C
[V:V1]EFGA|
[V:V2]AGFE|
`;
      const result = filterAndStringify(source);

      // Tune 1 should have V1 only
      expect(result).to.include("CDEF");

      // Tune 2 should have V2 only
      expect(result).to.include("AGFE");
      expect(result).to.not.include("EFGA");
    });

    it("Removes %%abcls-voices directive itself from output", () => {
      const source = `X:1
T:Test
M:4/4
L:1/4
%%abcls-voices show V1
V:V1 clef=treble
K:C
[V:V1]CDEF|
`;
      const result = filterAndStringify(source);

      // %%abcls-voices directive should be removed
      expect(result).to.not.include("%%abcls-voices");
      expect(result).to.not.include("show V1");
    });

    it("No directive: passes through all content unchanged", () => {
      const source = `X:1
T:Test
M:4/4
L:1/4
V:V1 clef=treble
V:V2 clef=bass
K:C
[V:V1]CDEF|
[V:V2]GFED|
`;
      const result = filterAndStringify(source);

      // All content should be present
      expect(result).to.include("[V:V1]");
      expect(result).to.include("CDEF");
      expect(result).to.include("[V:V2]");
      expect(result).to.include("GFED");
    });

    it("Score/staves directives are preserved", () => {
      const source = `X:1
T:Test
M:4/4
L:1/4
%%score [V1 V2]
%%abcls-voices show V1
V:V1 clef=treble
V:V2 clef=bass
K:C
[V:V1]CDEF|
[V:V2]GFED|
`;
      const result = filterAndStringify(source);

      // %%score directive should be preserved
      expect(result).to.include("%%score");

      // %%abcls-voices should be removed
      expect(result).to.not.include("%%abcls-voices");
    });
  });

  describe("Voice ID extraction", () => {
    it("Handles voice switch with V: info line", () => {
      const source = `X:1
T:Test
M:4/4
L:1/4
%%abcls-voices show Melody
V:Melody name="Main"
V:Bass name="Low"
K:C
V:Melody
CDEF|
V:Bass
GFED|
`;
      const result = filterAndStringify(source);

      // Melody content should be present
      expect(result).to.include("V:Melody");
      expect(result).to.include("CDEF");

      // Bass content should be removed
      expect(result).to.not.include("V:Bass");
      expect(result).to.not.include("GFED");
    });
  });

  describe("Last wins semantics", () => {
    it("Multiple directives in same scope: last one wins", () => {
      const source = `X:1
T:Test
M:4/4
L:1/4
%%abcls-voices show V1
%%abcls-voices show V2
V:V1 clef=treble
V:V2 clef=bass
K:C
[V:V1]CDEF|
[V:V2]GFED|
`;
      const result = filterAndStringify(source);

      // Last directive says show V2, so V2 should be present
      expect(result).to.include("[V:V2]");
      expect(result).to.include("GFED");

      // V1 should be removed
      expect(result).to.not.include("[V:V1]");
      expect(result).to.not.include("CDEF");
    });

    it("Hide then show: last wins", () => {
      const source = `X:1
T:Test
M:4/4
L:1/4
%%abcls-voices hide V1
%%abcls-voices show V1
V:V1 clef=treble
V:V2 clef=bass
K:C
[V:V1]CDEF|
[V:V2]GFED|
`;
      const result = filterAndStringify(source);

      // Last directive says show V1
      expect(result).to.include("[V:V1]");
      expect(result).to.include("CDEF");

      // V2 should be removed
      expect(result).to.not.include("[V:V2]");
      expect(result).to.not.include("GFED");
    });
  });

  describe("Idempotence", () => {
    it("Filtering twice produces same result as filtering once", () => {
      const source = `X:1
T:Test
M:4/4
L:1/4
%%abcls-voices show V1
V:V1 clef=treble
V:V2 clef=bass
K:C
[V:V1]CDEF|
[V:V2]GFED|
`;
      const ast = parseAbc(source);

      // First filter
      const filtered1 = filterVoiceInAst(ast, context);
      const formatter1 = new AbcFormatter(context);
      const result1 = formatter1.stringify(filtered1);

      // Create new context for second filter
      const context2 = new ABCContext(new AbcErrorReporter());

      // Second filter on already filtered AST
      const filtered2 = filterVoiceInAst(filtered1, context2);
      const formatter2 = new AbcFormatter(context2);
      const result2 = formatter2.stringify(filtered2);

      // Results should be equivalent (ignoring whitespace differences)
      expect(result1.replace(/\s+/g, " ")).to.equal(result2.replace(/\s+/g, " "));
    });
  });

  describe("Show/hide duality", () => {
    it("For 2 voices, show {V1} equals hide {V2}", () => {
      const sourceShow = `X:1
T:Test
M:4/4
L:1/4
%%abcls-voices show V1
V:V1 clef=treble
V:V2 clef=bass
K:C
[V:V1]CDEF|
[V:V2]GFED|
`;
      const sourceHide = `X:1
T:Test
M:4/4
L:1/4
%%abcls-voices hide V2
V:V1 clef=treble
V:V2 clef=bass
K:C
[V:V1]CDEF|
[V:V2]GFED|
`;

      const resultShow = filterAndStringify(sourceShow);
      const resultHide = filterAndStringify(sourceHide);

      // Both should have V1 content
      expect(resultShow).to.include("CDEF");
      expect(resultHide).to.include("CDEF");

      // Both should NOT have V2 content
      expect(resultShow).to.not.include("GFED");
      expect(resultHide).to.not.include("GFED");
    });
  });

  describe("Edge cases", () => {
    it("Handles empty voice list gracefully", () => {
      const source = `X:1
T:Test
M:4/4
L:1/4
V:V1 clef=treble
K:C
CDEF|
`;
      // No %%abcls-voices directive - should pass through unchanged
      const result = filterAndStringify(source);
      expect(result).to.include("CDEF");
    });

    it("Handles tune with no voices", () => {
      const source = `X:1
T:Test
M:4/4
L:1/4
K:C
CDEF|
`;
      const result = filterAndStringify(source);
      expect(result).to.include("CDEF");
    });

    it("Handles show with voice that does not exist", () => {
      const source = `X:1
T:Test
M:4/4
L:1/4
%%abcls-voices show NonExistent
V:V1 clef=treble
K:C
[V:V1]CDEF|
`;
      const result = filterAndStringify(source);

      // V1 should be removed because it's not in the show list
      expect(result).to.not.include("CDEF");
    });

    it("Handles hide with voice that does not exist", () => {
      const source = `X:1
T:Test
M:4/4
L:1/4
%%abcls-voices hide NonExistent
V:V1 clef=treble
K:C
[V:V1]CDEF|
`;
      const result = filterAndStringify(source);

      // V1 should be present because NonExistent is hidden (not V1)
      expect(result).to.include("CDEF");
    });
  });

  describe("filterVoicesInAbc convenience function", () => {
    it("Filters ABC string directly without needing manual parse/format", () => {
      const source = `X:1
T:Test
M:4/4
L:1/4
%%abcls-voices show V1
V:V1 clef=treble
V:V2 clef=bass
K:C
[V:V1]CDEF|
[V:V2]GFED|
`;
      const ctx = new ABCContext(new AbcErrorReporter());
      const result = filterVoicesInAbc(source, ctx);

      // V1 content should be present
      expect(result).to.include("V1");
      expect(result).to.include("CDEF");

      // V2 content should be removed
      expect(result).to.not.include("[V:V2]");
      expect(result).to.not.include("GFED");

      // %%abcls-voices directive should be removed
      expect(result).to.not.include("%%abcls-voices");
    });

    it("Returns unchanged content when no %%abcls-voices directive is present", () => {
      const source = `X:1
T:Test
M:4/4
L:1/4
V:V1 clef=treble
K:C
CDEF|
`;
      const ctx = new ABCContext(new AbcErrorReporter());
      const result = filterVoicesInAbc(source, ctx);

      // All content should be present
      expect(result).to.include("CDEF");
    });
  });
});
