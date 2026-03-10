import { expect } from "chai";
import * as fc from "fast-check";
import { describe, it } from "mocha";
import { CompletionItemKind, InsertTextFormat } from "vscode-languageserver";
import {
  getDirectiveCompletionContext,
  getDirectiveCompletions,
  getFontDirectiveCompletions,
  buildFontSnippet,
  getMeasurementDirectiveCompletions,
  buildMeasurementSnippet,
  buildSepSnippet,
  getBooleanFlagDirectiveCompletions,
  getPositionDirectiveCompletions,
  buildPositionSnippet,
  getBooleanValueDirectiveCompletions,
  buildBooleanValueSnippet,
  getMeasurementUnitCompletions,
  getPositionChoiceCompletions,
  getBooleanChoiceCompletions,
  ABCLS_DIRECTIVES,
  ABCLS_PARSE_OPTIONS,
  ABCLS_FMT_OPTIONS,
  ABCLS_VOICES_OPTIONS,
  FONT_DIRECTIVES_WITH_BOX,
  FONT_DIRECTIVES_WITHOUT_BOX,
  MEASUREMENT_DIRECTIVES,
  MEASUREMENT_UNITS,
  SEP_DIRECTIVE,
  BOOLEAN_FLAG_DIRECTIVES,
  POSITION_DIRECTIVES,
  POSITION_CHOICES,
  BOOLEAN_VALUE_DIRECTIVES,
  BOOLEAN_VALUE_CHOICES,
  getNumberDirectiveCompletions,
  buildNumberSnippet,
  NUMBER_DIRECTIVES,
  getIdentifierDirectiveCompletions,
  buildIdentifierSnippet,
  IDENTIFIER_DIRECTIVES,
  getTextDirectiveCompletions,
  buildTextSnippet,
  TEXT_DIRECTIVES,
  getComplexDirectiveCompletions,
  COMPLEX_DIRECTIVES,
  getMidiCommandCompletions,
  MIDI_COMMANDS,
} from "./completions";

describe("getDirectiveCompletionContext", () => {
  describe("non-directive lines", () => {
    it("returns none for music content", () => {
      const result = getDirectiveCompletionContext("C D E F", 4);
      expect(result.type).to.equal("none");
    });

    it("returns none for %% mid-line", () => {
      const result = getDirectiveCompletionContext("C D %% E", 6);
      expect(result.type).to.equal("none");
    });

    it("returns none for %% with leading whitespace", () => {
      const result = getDirectiveCompletionContext("  %%", 4);
      expect(result.type).to.equal("none");
    });
  });

  describe("directive name context", () => {
    it("returns directive-name with empty prefix after %%", () => {
      const result = getDirectiveCompletionContext("%%", 2);
      expect(result.type).to.equal("directive-name");
      if (result.type === "directive-name") {
        expect(result.prefix).to.equal("");
      }
    });

    it("returns directive-name with partial prefix", () => {
      const result = getDirectiveCompletionContext("%%abc", 5);
      expect(result.type).to.equal("directive-name");
      if (result.type === "directive-name") {
        expect(result.prefix).to.equal("abc");
      }
    });

    it("returns directive-name for full directive without space", () => {
      const result = getDirectiveCompletionContext("%%abcls-fmt", 11);
      expect(result.type).to.equal("directive-name");
      if (result.type === "directive-name") {
        expect(result.prefix).to.equal("abcls-fmt");
      }
    });
  });

  describe("abcls-parse options context", () => {
    it("returns abcls-parse-options after directive name and space", () => {
      const result = getDirectiveCompletionContext("%%abcls-parse ", 14);
      expect(result.type).to.equal("abcls-parse-options");
      if (result.type === "abcls-parse-options") {
        expect(result.prefix).to.equal("");
      }
    });

    it("handles multiple spaces between directive and option", () => {
      const result = getDirectiveCompletionContext("%%abcls-parse   ", 16);
      expect(result.type).to.equal("abcls-parse-options");
      if (result.type === "abcls-parse-options") {
        expect(result.prefix).to.equal("");
      }
    });

    it("is case-insensitive for directive name", () => {
      const result = getDirectiveCompletionContext("%%ABCLS-PARSE ", 14);
      expect(result.type).to.equal("abcls-parse-options");
    });
  });

  describe("abcls-fmt options context", () => {
    it("returns abcls-fmt-options after directive name and space", () => {
      const result = getDirectiveCompletionContext("%%abcls-fmt ", 12);
      expect(result.type).to.equal("abcls-fmt-options");
    });

    it("includes partial option prefix", () => {
      const result = getDirectiveCompletionContext("%%abcls-fmt sys", 15);
      expect(result.type).to.equal("abcls-fmt-options");
      if (result.type === "abcls-fmt-options") {
        expect(result.prefix).to.equal("sys");
      }
    });

    it("includes existing option in prefix (multi-option not supported)", () => {
      // When a complete option is already typed, the prefix includes it.
      // This means no completions will match because no option starts with "system-comments".
      // This is intentional: multi-option completion is out of scope for this implementation.
      const result = getDirectiveCompletionContext("%%abcls-fmt system-comments ", 28);
      expect(result.type).to.equal("abcls-fmt-options");
      if (result.type === "abcls-fmt-options") {
        expect(result.prefix).to.equal("system-comments");
      }
    });
  });

  describe("abcls-voices options context", () => {
    it("returns abcls-voices-options after directive name and space", () => {
      const result = getDirectiveCompletionContext("%%abcls-voices ", 15);
      expect(result.type).to.equal("abcls-voices-options");
    });
  });

  describe("midi command context", () => {
    it("returns midi-command after %%MIDI and space", () => {
      const result = getDirectiveCompletionContext("%%MIDI ", 7);
      expect(result.type).to.equal("midi-command");
      if (result.type === "midi-command") {
        expect(result.prefix).to.equal("");
      }
    });

    it("returns midi-command with partial prefix", () => {
      const result = getDirectiveCompletionContext("%%MIDI prog", 11);
      expect(result.type).to.equal("midi-command");
      if (result.type === "midi-command") {
        expect(result.prefix).to.equal("prog");
      }
    });

    it("is case-insensitive for MIDI", () => {
      const result = getDirectiveCompletionContext("%%midi ", 7);
      expect(result.type).to.equal("midi-command");
    });

    it("returns directive-name for %%MIDI without space", () => {
      const result = getDirectiveCompletionContext("%%MIDI", 6);
      expect(result.type).to.equal("directive-name");
      if (result.type === "directive-name") {
        expect(result.prefix).to.equal("MIDI");
      }
    });

    it("handles multiple spaces after MIDI by trimming prefix", () => {
      const result = getDirectiveCompletionContext("%%MIDI   prog", 13);
      expect(result.type).to.equal("midi-command");
      if (result.type === "midi-command") {
        expect(result.prefix).to.equal("prog");
      }
    });

    it("handles whitespace-only prefix after MIDI", () => {
      const result = getDirectiveCompletionContext("%%MIDI   ", 9);
      expect(result.type).to.equal("midi-command");
      if (result.type === "midi-command") {
        expect(result.prefix).to.equal("");
      }
    });

    it("handles cursor mid-command", () => {
      const result = getDirectiveCompletionContext("%%MIDI program", 11);
      expect(result.type).to.equal("midi-command");
      if (result.type === "midi-command") {
        expect(result.prefix).to.equal("prog");
      }
    });

    it("returns midi-command when parameters already present", () => {
      // When parameters are present, filtering will return empty (no command starts with "program 42")
      // This is correct behavior - we only complete command names, not parameters
      const result = getDirectiveCompletionContext("%%MIDI program 42 ", 18);
      expect(result.type).to.equal("midi-command");
      if (result.type === "midi-command") {
        expect(result.prefix).to.equal("program 42");
      }
    });

    it("returns directive-name for %%MIDIprogram without space", () => {
      const result = getDirectiveCompletionContext("%%MIDIprogram", 13);
      expect(result.type).to.equal("directive-name");
      if (result.type === "directive-name") {
        expect(result.prefix).to.equal("MIDIprogram");
      }
    });
  });

  describe("measurement-unit context", () => {
    it("returns measurement-unit after measurement directive + space", () => {
      const result = getDirectiveCompletionContext("%%botmargin ", 12);
      expect(result.type).to.equal("measurement-unit");
      if (result.type === "measurement-unit") {
        expect(result.prefix).to.equal("");
      }
    });

    it("includes partial unit prefix", () => {
      const result = getDirectiveCompletionContext("%%botmargin 12p", 15);
      expect(result.type).to.equal("measurement-unit");
      if (result.type === "measurement-unit") {
        expect(result.prefix).to.equal("12p");
      }
    });

    it("is case-insensitive for directive name", () => {
      const result = getDirectiveCompletionContext("%%BOTMARGIN ", 12);
      expect(result.type).to.equal("measurement-unit");
    });

    it("works for all measurement directives", () => {
      for (const directive of MEASUREMENT_DIRECTIVES) {
        const line = `%%${directive} `;
        const result = getDirectiveCompletionContext(line, line.length);
        expect(result.type).to.equal("measurement-unit");
      }
    });
  });

  describe("position-choice context", () => {
    it("returns position-choice after position directive + space", () => {
      const result = getDirectiveCompletionContext("%%vocal ", 8);
      expect(result.type).to.equal("position-choice");
      if (result.type === "position-choice") {
        expect(result.prefix).to.equal("");
      }
    });

    it("includes partial choice prefix", () => {
      const result = getDirectiveCompletionContext("%%vocal au", 10);
      expect(result.type).to.equal("position-choice");
      if (result.type === "position-choice") {
        expect(result.prefix).to.equal("au");
      }
    });

    it("is case-insensitive for directive name", () => {
      const result = getDirectiveCompletionContext("%%VOCAL ", 8);
      expect(result.type).to.equal("position-choice");
    });

    it("works for all position directives", () => {
      for (const directive of POSITION_DIRECTIVES) {
        const line = `%%${directive.label} `;
        const result = getDirectiveCompletionContext(line, line.length);
        expect(result.type).to.equal("position-choice");
      }
    });
  });

  describe("boolean-choice context", () => {
    it("returns boolean-choice after boolean value directive + space", () => {
      const result = getDirectiveCompletionContext("%%graceslurs ", 13);
      expect(result.type).to.equal("boolean-choice");
      if (result.type === "boolean-choice") {
        expect(result.prefix).to.equal("");
      }
    });

    it("includes partial choice prefix", () => {
      const result = getDirectiveCompletionContext("%%graceslurs tr", 15);
      expect(result.type).to.equal("boolean-choice");
      if (result.type === "boolean-choice") {
        expect(result.prefix).to.equal("tr");
      }
    });

    it("is case-insensitive for directive name", () => {
      const result = getDirectiveCompletionContext("%%GRACESLURS ", 13);
      expect(result.type).to.equal("boolean-choice");
    });

    it("works for all boolean value directives", () => {
      for (const directive of BOOLEAN_VALUE_DIRECTIVES) {
        const line = `%%${directive.label} `;
        const result = getDirectiveCompletionContext(line, line.length);
        expect(result.type).to.equal("boolean-choice");
      }
    });
  });
});

describe("getDirectiveCompletions", () => {
  describe("directive name completions", () => {
    it("returns all directives when prefix is empty", () => {
      const result = getDirectiveCompletions(ABCLS_DIRECTIVES, "", CompletionItemKind.Keyword);
      expect(result).to.have.length(4);
      expect(result.map((r) => r.label)).to.include.members(["abcls-fmt", "abcls-parse", "MIDI", "abcls-voices"]);
    });

    it("filters by prefix case-insensitively", () => {
      const result = getDirectiveCompletions(ABCLS_DIRECTIVES, "abcls-f", CompletionItemKind.Keyword);
      expect(result).to.have.length(1);
      expect(result[0].label).to.equal("abcls-fmt");
    });

    it("returns empty array for non-matching prefix", () => {
      const result = getDirectiveCompletions(ABCLS_DIRECTIVES, "xyz", CompletionItemKind.Keyword);
      expect(result).to.have.length(0);
    });

    it("sets correct completion item kind", () => {
      const result = getDirectiveCompletions(ABCLS_DIRECTIVES, "", CompletionItemKind.Keyword);
      expect(result.every((r) => r.kind === CompletionItemKind.Keyword)).to.be.true;
    });

    it("uses full label as insertText", () => {
      const result = getDirectiveCompletions(ABCLS_DIRECTIVES, "abcls-f", CompletionItemKind.Keyword);
      expect(result[0].insertText).to.equal("abcls-fmt");
    });
  });
});

describe("option value completions", () => {
  describe("abcls-parse options", () => {
    it("returns linear option", () => {
      const result = getDirectiveCompletions(ABCLS_PARSE_OPTIONS, "", CompletionItemKind.Value);
      expect(result).to.have.length(1);
      expect(result[0].label).to.equal("linear");
    });

    it("filters by partial prefix", () => {
      const result = getDirectiveCompletions(ABCLS_PARSE_OPTIONS, "lin", CompletionItemKind.Value);
      expect(result).to.have.length(1);
      expect(result[0].label).to.equal("linear");
    });

    it("returns empty for non-matching prefix", () => {
      const result = getDirectiveCompletions(ABCLS_PARSE_OPTIONS, "xyz", CompletionItemKind.Value);
      expect(result).to.have.length(0);
    });
  });

  describe("abcls-fmt options", () => {
    it("returns all fmt options", () => {
      const result = getDirectiveCompletions(ABCLS_FMT_OPTIONS, "", CompletionItemKind.Value);
      expect(result).to.have.length(3);
      expect(result.map((r) => r.label)).to.include.members(["system-comments", "voice-markers=inline", "voice-markers=infoline"]);
    });

    it("filters voice-markers options by prefix", () => {
      const result = getDirectiveCompletions(ABCLS_FMT_OPTIONS, "voice", CompletionItemKind.Value);
      expect(result).to.have.length(2);
      expect(result.every((r) => r.label.startsWith("voice"))).to.be.true;
    });

    it("uses Value kind for options", () => {
      const result = getDirectiveCompletions(ABCLS_FMT_OPTIONS, "", CompletionItemKind.Value);
      expect(result.every((r) => r.kind === CompletionItemKind.Value)).to.be.true;
    });
  });

  describe("abcls-voices options", () => {
    it("returns show and hide options", () => {
      const result = getDirectiveCompletions(ABCLS_VOICES_OPTIONS, "", CompletionItemKind.Value);
      expect(result).to.have.length(2);
      expect(result.map((r) => r.label)).to.include.members(["show", "hide"]);
    });

    it("filters to show only", () => {
      const result = getDirectiveCompletions(ABCLS_VOICES_OPTIONS, "s", CompletionItemKind.Value);
      expect(result).to.have.length(1);
      expect(result[0].label).to.equal("show");
    });

    it("filters to hide only", () => {
      const result = getDirectiveCompletions(ABCLS_VOICES_OPTIONS, "h", CompletionItemKind.Value);
      expect(result).to.have.length(1);
      expect(result[0].label).to.equal("hide");
    });
  });
});

// =============================================================================
// Font Directive Completions
// =============================================================================

describe("getFontDirectiveCompletions", () => {
  it("returns all 24 font directives when prefix is empty", () => {
    const result = getFontDirectiveCompletions("");
    expect(result).to.have.length(24);
    const labels = result.map((r) => r.label);
    expect(labels).to.include.members([...FONT_DIRECTIVES_WITH_BOX, ...FONT_DIRECTIVES_WITHOUT_BOX]);
  });

  it("filters by prefix", () => {
    const result = getFontDirectiveCompletions("title");
    expect(result).to.have.length(1);
    expect(result[0].label).to.equal("titlefont");
  });

  it("filters case-insensitively", () => {
    const result = getFontDirectiveCompletions("TITLE");
    expect(result).to.have.length(1);
    expect(result[0].label).to.equal("titlefont");
  });

  it("filters incrementally for multiple matches", () => {
    const result = getFontDirectiveCompletions("bar");
    expect(result.map((r) => r.label)).to.include.members(["barlabelfont", "barnumberfont", "barnumfont"]);
  });

  it("uses snippet insert format when supportsSnippets is true", () => {
    const result = getFontDirectiveCompletions("titlefont", true);
    expect(result[0].insertTextFormat).to.equal(InsertTextFormat.Snippet);
  });

  it("uses plain text insert format when supportsSnippets is false", () => {
    const result = getFontDirectiveCompletions("titlefont", false);
    expect(result[0].insertTextFormat).to.equal(InsertTextFormat.PlainText);
    expect(result[0].insertText).to.equal("titlefont");
  });

  it("includes box placeholder for directives with box support", () => {
    const result = getFontDirectiveCompletions("titlefont", true);
    expect(result[0].insertText).to.match(/\$\{4\|box,/);
  });

  it("excludes box placeholder for directives without box support", () => {
    const result = getFontDirectiveCompletions("tempofont", true);
    expect(result[0].insertText).to.not.match(/\$\{4/);
  });

  it("includes font face choices", () => {
    const result = getFontDirectiveCompletions("titlefont", true);
    expect(result[0].insertText).to.include("Arial,Times,Helvetica,Courier");
  });

  it("includes modifier choices with normal as first option", () => {
    const result = getFontDirectiveCompletions("titlefont", true);
    expect(result[0].insertText).to.include("normal,bold,italic,underline");
  });

  it("returns empty array when no font directives match prefix", () => {
    const result = getFontDirectiveCompletions("xyz");
    expect(result).to.have.length(0);
  });
});

describe("buildFontSnippet", () => {
  it("uses sequential placeholder numbering with box", () => {
    const snippet = buildFontSnippet(true);
    expect(snippet).to.match(/\$\{1\|/);
    expect(snippet).to.match(/\$\{2:/);
    expect(snippet).to.match(/\$\{3\|/);
    expect(snippet).to.match(/\$\{4\|/);
  });

  it("uses sequential placeholder numbering without box", () => {
    const snippet = buildFontSnippet(false);
    expect(snippet).to.match(/\$\{1\|/);
    expect(snippet).to.match(/\$\{2:/);
    expect(snippet).to.match(/\$\{3\|/);
    expect(snippet).to.not.match(/\$\{4/);
  });

  it("puts box as first choice to work around VS Code empty choice bug", () => {
    const snippet = buildFontSnippet(true);
    // Format is ${4|box, |} - box first, space (empty) second
    expect(snippet).to.match(/\$\{4\|box,/);
  });
});

describe("getFontDirectiveCompletions - property-based", () => {
  it("property: all font directives with box produce valid snippets with box placeholder", () => {
    fc.assert(
      fc.property(fc.constantFrom(...FONT_DIRECTIVES_WITH_BOX), (directive) => {
        const result = getFontDirectiveCompletions(directive, true);
        expect(result).to.have.length(1);
        expect(result[0].insertTextFormat).to.equal(InsertTextFormat.Snippet);
        expect(result[0].insertText).to.match(/\$\{[0-9]+[:|][^}]+\}/);
        expect(result[0].insertText).to.match(/\$\{4\|box,/);
        return true;
      })
    );
  });

  it("property: all font directives without box produce valid snippets without box placeholder", () => {
    fc.assert(
      fc.property(fc.constantFrom(...FONT_DIRECTIVES_WITHOUT_BOX), (directive) => {
        const result = getFontDirectiveCompletions(directive, true);
        expect(result).to.have.length(1);
        expect(result[0].insertTextFormat).to.equal(InsertTextFormat.Snippet);
        expect(result[0].insertText).to.match(/\$\{[0-9]+[:|][^}]+\}/);
        expect(result[0].insertText).to.not.match(/\$\{4/);
        return true;
      })
    );
  });

  it("property: all font directives return plain text when snippets not supported", () => {
    const allDirectives = [...FONT_DIRECTIVES_WITH_BOX, ...FONT_DIRECTIVES_WITHOUT_BOX];
    fc.assert(
      fc.property(fc.constantFrom(...allDirectives), (directive) => {
        const result = getFontDirectiveCompletions(directive, false);
        expect(result).to.have.length(1);
        expect(result[0].insertTextFormat).to.equal(InsertTextFormat.PlainText);
        expect(result[0].insertText).to.equal(directive);
        return true;
      })
    );
  });
});

describe("font directive completion integration", () => {
  it("returns font directive completions when typing after %%", () => {
    const context = getDirectiveCompletionContext("%%title", 7);
    expect(context.type).to.equal("directive-name");
    if (context.type === "directive-name") {
      const completions = [
        ...getDirectiveCompletions(ABCLS_DIRECTIVES, context.prefix, CompletionItemKind.Keyword),
        ...getFontDirectiveCompletions(context.prefix, true),
      ];
      expect(completions.some((c) => c.label === "titlefont")).to.be.true;
    }
  });
});

// =============================================================================
// Measurement Directive Completions
// =============================================================================

describe("getMeasurementDirectiveCompletions", () => {
  it("returns all 25 measurement directives when prefix is empty", () => {
    const result = getMeasurementDirectiveCompletions("");
    expect(result).to.have.length(25);
    const labels = result.map((r) => r.label);
    expect(labels).to.include.members([...MEASUREMENT_DIRECTIVES, SEP_DIRECTIVE]);
  });

  it("filters by prefix", () => {
    const result = getMeasurementDirectiveCompletions("page");
    expect(result).to.have.length(2);
    expect(result.map((r) => r.label)).to.include.members(["pageheight", "pagewidth"]);
  });

  it("filters case-insensitively", () => {
    const result = getMeasurementDirectiveCompletions("PAGE");
    expect(result).to.have.length(2);
  });

  it("uses snippet insert format when supportsSnippets is true", () => {
    const result = getMeasurementDirectiveCompletions("botmargin", true);
    expect(result[0].insertTextFormat).to.equal(InsertTextFormat.Snippet);
  });

  it("uses plain text insert format when supportsSnippets is false", () => {
    const result = getMeasurementDirectiveCompletions("botmargin", false);
    expect(result[0].insertTextFormat).to.equal(InsertTextFormat.PlainText);
    expect(result[0].insertText).to.equal("botmargin");
  });

  it("includes unit choices in snippet", () => {
    const result = getMeasurementDirectiveCompletions("botmargin", true);
    expect(result[0].insertText).to.include("pt,in,cm,mm");
  });

  it("returns empty array when no directives match prefix", () => {
    const result = getMeasurementDirectiveCompletions("xyz");
    expect(result).to.have.length(0);
  });

  it("sep directive has 3 measurement placeholders", () => {
    const result = getMeasurementDirectiveCompletions("sep", true);
    expect(result[0].label).to.equal("sep");
    // Should have 3 value placeholders and 3 unit placeholders
    expect(result[0].insertText).to.match(/\$\{1\}/);
    expect(result[0].insertText).to.match(/\$\{3\}/);
    expect(result[0].insertText).to.match(/\$\{5\}/);
  });

  it("filters sep directive case-insensitively", () => {
    const result = getMeasurementDirectiveCompletions("SEP", true);
    expect(result).to.have.length(1);
    expect(result[0].label).to.equal("sep");
  });

  it("inserts space between directive name and snippet", () => {
    const result = getMeasurementDirectiveCompletions("botmargin", true);
    expect(result[0].insertText).to.match(/^botmargin \$\{1\}/);
  });

  it("includes data field with type and directive name", () => {
    const result = getMeasurementDirectiveCompletions("botmargin", true);
    expect(result[0].data).to.deep.equal({ type: "measurement-directive", directive: "botmargin" });
  });
});

describe("buildMeasurementSnippet", () => {
  it("creates snippet with value and unit placeholders", () => {
    const snippet = buildMeasurementSnippet();
    expect(snippet).to.match(/\$\{1\}/);
    expect(snippet).to.match(/\$\{2\|pt,in,cm,mm\|\}/);
  });

  it("includes properly formatted unit choices", () => {
    const snippet = buildMeasurementSnippet();
    expect(snippet).to.equal("${1}${2|pt,in,cm,mm|}");
  });
});

describe("buildSepSnippet", () => {
  it("creates snippet with 3 measurement placeholders", () => {
    const snippet = buildSepSnippet();
    expect(snippet).to.match(/\$\{1\}\$\{2\|pt,in,cm,mm\|\}/);
    expect(snippet).to.match(/\$\{3\}\$\{4\|pt,in,cm,mm\|\}/);
    expect(snippet).to.match(/\$\{5\}\$\{6\|pt,in,cm,mm\|\}/);
  });
});

describe("getMeasurementDirectiveCompletions - property-based", () => {
  it("property: all measurement directives produce valid snippets with unit choices", () => {
    fc.assert(
      fc.property(fc.constantFrom(...MEASUREMENT_DIRECTIVES), (directive) => {
        const result = getMeasurementDirectiveCompletions(directive, true);
        expect(result).to.have.length(1);
        expect(result[0].insertTextFormat).to.equal(InsertTextFormat.Snippet);
        expect(result[0].insertText).to.match(/\$\{[0-9]+\}/);
        expect(result[0].insertText).to.include("pt,in,cm,mm");
        return true;
      })
    );
  });

  it("property: all measurement directives return plain text when snippets not supported", () => {
    const allDirectives = [...MEASUREMENT_DIRECTIVES, SEP_DIRECTIVE];
    fc.assert(
      fc.property(fc.constantFrom(...allDirectives), (directive) => {
        const result = getMeasurementDirectiveCompletions(directive, false);
        expect(result).to.have.length(1);
        expect(result[0].insertTextFormat).to.equal(InsertTextFormat.PlainText);
        expect(result[0].insertText).to.equal(directive);
        return true;
      })
    );
  });
});

describe("measurement directive completion integration", () => {
  it("returns measurement directive completions when typing after %%", () => {
    const context = getDirectiveCompletionContext("%%page", 6);
    expect(context.type).to.equal("directive-name");
    if (context.type === "directive-name") {
      const completions = getMeasurementDirectiveCompletions(context.prefix, true);
      expect(completions.some((c) => c.label === "pagewidth")).to.be.true;
      expect(completions.some((c) => c.label === "pageheight")).to.be.true;
    }
  });
});

// =============================================================================
// Boolean Flag Directive Completions
// =============================================================================

describe("getBooleanFlagDirectiveCompletions", () => {
  it("returns all 11 boolean flag directives when prefix is empty", () => {
    const result = getBooleanFlagDirectiveCompletions("");
    expect(result).to.have.length(11);
    const labels = result.map((r) => r.label);
    expect(labels).to.include.members(BOOLEAN_FLAG_DIRECTIVES.map((d) => d.label));
  });

  it("filters by prefix", () => {
    const result = getBooleanFlagDirectiveCompletions("title");
    expect(result).to.have.length(2);
    expect(result.map((r) => r.label)).to.include.members(["titlecaps", "titleleft"]);
  });

  it("filters case-insensitively", () => {
    const result = getBooleanFlagDirectiveCompletions("TITLE");
    expect(result).to.have.length(2);
  });

  it("uses PlainText insert format (no snippets needed)", () => {
    const result = getBooleanFlagDirectiveCompletions("bagpipes");
    expect(result[0].insertTextFormat).to.equal(InsertTextFormat.PlainText);
  });

  it("insertText equals label (no snippet placeholders)", () => {
    const result = getBooleanFlagDirectiveCompletions("bagpipes");
    expect(result[0].insertText).to.equal("bagpipes");
  });

  it("returns empty array when no directives match prefix", () => {
    const result = getBooleanFlagDirectiveCompletions("xyz");
    expect(result).to.have.length(0);
  });

  it("uses Keyword completion kind", () => {
    const result = getBooleanFlagDirectiveCompletions("");
    expect(result.every((r) => r.kind === CompletionItemKind.Keyword)).to.be.true;
  });

  it("includes data field with type and directive name", () => {
    const result = getBooleanFlagDirectiveCompletions("bagpipes");
    expect(result[0].data).to.deep.equal({ type: "boolean-flag-directive", directive: "bagpipes" });
  });

  it("includes documentation for each directive", () => {
    const result = getBooleanFlagDirectiveCompletions("");
    expect(result.every((r) => typeof r.documentation === "object" && r.documentation !== null)).to.be.true;
  });
});

describe("getBooleanFlagDirectiveCompletions - property-based", () => {
  it("property: all boolean flag directives produce valid completions", () => {
    fc.assert(
      fc.property(fc.constantFrom(...BOOLEAN_FLAG_DIRECTIVES.map((d) => d.label)), (directive) => {
        const result = getBooleanFlagDirectiveCompletions(directive);
        expect(result).to.have.length(1);
        expect(result[0].insertTextFormat).to.equal(InsertTextFormat.PlainText);
        expect(result[0].insertText).to.equal(directive);
        expect(result[0].label).to.equal(directive);
        return true;
      })
    );
  });

  it("property: filtering is case-insensitive for all directives", () => {
    fc.assert(
      fc.property(fc.constantFrom(...BOOLEAN_FLAG_DIRECTIVES.map((d) => d.label)), (directive) => {
        const lowerResult = getBooleanFlagDirectiveCompletions(directive.toLowerCase());
        const upperResult = getBooleanFlagDirectiveCompletions(directive.toUpperCase());
        expect(lowerResult).to.have.length(1);
        expect(upperResult).to.have.length(1);
        expect(lowerResult[0].label).to.equal(upperResult[0].label);
        return true;
      })
    );
  });

  it("property: empty prefix returns all directives", () => {
    const result = getBooleanFlagDirectiveCompletions("");
    expect(result).to.have.length(BOOLEAN_FLAG_DIRECTIVES.length);
  });

  it("property: all returned completions match the given prefix", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 10 }), (prefix) => {
        const result = getBooleanFlagDirectiveCompletions(prefix);
        return result.every((r) => r.label.toLowerCase().startsWith(prefix.toLowerCase()));
      })
    );
  });
});

describe("boolean flag directive completion integration", () => {
  it("returns boolean flag directive completions when typing after %%", () => {
    const context = getDirectiveCompletionContext("%%bag", 5);
    expect(context.type).to.equal("directive-name");
    if (context.type === "directive-name") {
      const completions = getBooleanFlagDirectiveCompletions(context.prefix);
      expect(completions.some((c) => c.label === "bagpipes")).to.be.true;
    }
  });

  it("returns multiple matching directives for common prefixes", () => {
    const context = getDirectiveCompletionContext("%%flat", 6);
    expect(context.type).to.equal("directive-name");
    if (context.type === "directive-name") {
      const completions = getBooleanFlagDirectiveCompletions(context.prefix);
      expect(completions.some((c) => c.label === "flatbeams")).to.be.true;
    }
  });
});

// =============================================================================
// Position Directive Completions
// =============================================================================

describe("getPositionDirectiveCompletions", () => {
  it("returns all 5 position directives when prefix is empty", () => {
    const result = getPositionDirectiveCompletions("");
    expect(result).to.have.length(5);
    const labels = result.map((r) => r.label);
    expect(labels).to.include.members(POSITION_DIRECTIVES.map((d) => d.label));
  });

  it("filters by prefix", () => {
    const result = getPositionDirectiveCompletions("vo");
    expect(result).to.have.length(2);
    expect(result.map((r) => r.label)).to.include.members(["vocal", "volume"]);
  });

  it("filters case-insensitively", () => {
    const result = getPositionDirectiveCompletions("VOCAL");
    expect(result).to.have.length(1);
    expect(result[0].label).to.equal("vocal");
  });

  it("uses snippet insert format when supportsSnippets is true", () => {
    const result = getPositionDirectiveCompletions("vocal", true);
    expect(result[0].insertTextFormat).to.equal(InsertTextFormat.Snippet);
  });

  it("uses plain text insert format when supportsSnippets is false", () => {
    const result = getPositionDirectiveCompletions("vocal", false);
    expect(result[0].insertTextFormat).to.equal(InsertTextFormat.PlainText);
    expect(result[0].insertText).to.equal("vocal");
  });

  it("includes position choices in snippet", () => {
    const result = getPositionDirectiveCompletions("vocal", true);
    expect(result[0].insertText).to.include("auto,above,below,hidden");
  });

  it("returns empty array when no directives match prefix", () => {
    const result = getPositionDirectiveCompletions("xyz");
    expect(result).to.have.length(0);
  });

  it("uses Keyword completion kind", () => {
    const result = getPositionDirectiveCompletions("");
    expect(result.every((r) => r.kind === CompletionItemKind.Keyword)).to.be.true;
  });

  it("includes data field with type and directive name", () => {
    const result = getPositionDirectiveCompletions("vocal", true);
    expect(result[0].data).to.deep.equal({ type: "position-directive", directive: "vocal" });
  });

  it("inserts space between directive name and snippet", () => {
    const result = getPositionDirectiveCompletions("vocal", true);
    expect(result[0].insertText).to.match(/^vocal \$\{1\|/);
  });

  it("includes documentation for each directive", () => {
    const result = getPositionDirectiveCompletions("");
    expect(result.every((r) => typeof r.documentation === "object" && r.documentation !== null)).to.be.true;
  });
});

describe("buildPositionSnippet", () => {
  it("creates snippet with position choice placeholder", () => {
    const snippet = buildPositionSnippet();
    expect(snippet).to.equal("${1|auto,above,below,hidden|}");
  });

  it("has auto as first choice", () => {
    const snippet = buildPositionSnippet();
    expect(snippet).to.match(/^\$\{1\|auto,/);
  });
});

describe("getPositionDirectiveCompletions - property-based", () => {
  it("property: all position directives produce valid snippets with position choices", () => {
    fc.assert(
      fc.property(fc.constantFrom(...POSITION_DIRECTIVES.map((d) => d.label)), (directive) => {
        const result = getPositionDirectiveCompletions(directive, true);
        expect(result).to.have.length(1);
        expect(result[0].insertTextFormat).to.equal(InsertTextFormat.Snippet);
        expect(result[0].insertText).to.include("auto,above,below,hidden");
        return true;
      })
    );
  });

  it("property: all position directives return plain text when snippets not supported", () => {
    fc.assert(
      fc.property(fc.constantFrom(...POSITION_DIRECTIVES.map((d) => d.label)), (directive) => {
        const result = getPositionDirectiveCompletions(directive, false);
        expect(result).to.have.length(1);
        expect(result[0].insertTextFormat).to.equal(InsertTextFormat.PlainText);
        expect(result[0].insertText).to.equal(directive);
        return true;
      })
    );
  });

  it("property: filtering is case-insensitive for all directives", () => {
    fc.assert(
      fc.property(fc.constantFrom(...POSITION_DIRECTIVES.map((d) => d.label)), (directive) => {
        const lowerResult = getPositionDirectiveCompletions(directive.toLowerCase());
        const upperResult = getPositionDirectiveCompletions(directive.toUpperCase());
        expect(lowerResult).to.have.length(1);
        expect(upperResult).to.have.length(1);
        expect(lowerResult[0].label).to.equal(upperResult[0].label);
        return true;
      })
    );
  });

  it("property: all returned completions match the given prefix", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 10 }), (prefix) => {
        const result = getPositionDirectiveCompletions(prefix);
        return result.every((r) => r.label.toLowerCase().startsWith(prefix.toLowerCase()));
      })
    );
  });
});

describe("position directive completion integration", () => {
  it("returns position directive completions when typing after %%", () => {
    const context = getDirectiveCompletionContext("%%vocal", 7);
    expect(context.type).to.equal("directive-name");
    if (context.type === "directive-name") {
      const completions = getPositionDirectiveCompletions(context.prefix, true);
      expect(completions.some((c) => c.label === "vocal")).to.be.true;
    }
  });

  it("returns multiple matching directives for common prefixes", () => {
    const context = getDirectiveCompletionContext("%%vo", 4);
    expect(context.type).to.equal("directive-name");
    if (context.type === "directive-name") {
      const completions = getPositionDirectiveCompletions(context.prefix, true);
      expect(completions.some((c) => c.label === "vocal")).to.be.true;
      expect(completions.some((c) => c.label === "volume")).to.be.true;
    }
  });

  it("returns position directives alongside other directive types for shared prefix", () => {
    const context = getDirectiveCompletionContext("%%vocal", 7);
    expect(context.type).to.equal("directive-name");
    if (context.type === "directive-name") {
      const allCompletions = [
        ...getFontDirectiveCompletions(context.prefix, true),
        ...getMeasurementDirectiveCompletions(context.prefix, true),
        ...getBooleanFlagDirectiveCompletions(context.prefix),
        ...getPositionDirectiveCompletions(context.prefix, true),
      ];
      const labels = allCompletions.map((c) => c.label);
      // vocalfont (font), vocalspace (measurement), vocal (position) all match "vocal"
      expect(labels).to.include("vocalfont");
      expect(labels).to.include("vocalspace");
      expect(labels).to.include("vocal");
    }
  });
});

// =============================================================================
// Boolean Value Directive Completions
// =============================================================================

describe("getBooleanValueDirectiveCompletions", () => {
  it("returns all 5 boolean value directives when prefix is empty", () => {
    const result = getBooleanValueDirectiveCompletions("");
    expect(result).to.have.length(5);
    const labels = result.map((r) => r.label);
    expect(labels).to.include.members(BOOLEAN_VALUE_DIRECTIVES.map((d) => d.label));
  });

  it("filters by prefix", () => {
    const result = getBooleanValueDirectiveCompletions("grace");
    expect(result).to.have.length(1);
    expect(result[0].label).to.equal("graceslurs");
  });

  it("filters case-insensitively", () => {
    const result = getBooleanValueDirectiveCompletions("PRINT");
    expect(result).to.have.length(1);
    expect(result[0].label).to.equal("printtempo");
  });

  it("uses snippet insert format when supportsSnippets is true", () => {
    const result = getBooleanValueDirectiveCompletions("graceslurs", true);
    expect(result[0].insertTextFormat).to.equal(InsertTextFormat.Snippet);
  });

  it("uses plain text insert format when supportsSnippets is false", () => {
    const result = getBooleanValueDirectiveCompletions("graceslurs", false);
    expect(result[0].insertTextFormat).to.equal(InsertTextFormat.PlainText);
    expect(result[0].insertText).to.equal("graceslurs");
  });

  it("includes boolean choices in snippet", () => {
    const result = getBooleanValueDirectiveCompletions("graceslurs", true);
    expect(result[0].insertText).to.include("true,false");
  });

  it("returns empty array when no directives match prefix", () => {
    const result = getBooleanValueDirectiveCompletions("xyz");
    expect(result).to.have.length(0);
  });

  it("uses Keyword completion kind", () => {
    const result = getBooleanValueDirectiveCompletions("");
    expect(result.every((r) => r.kind === CompletionItemKind.Keyword)).to.be.true;
  });

  it("includes data field with type and directive name", () => {
    const result = getBooleanValueDirectiveCompletions("graceslurs", true);
    expect(result[0].data).to.deep.equal({ type: "boolean-value-directive", directive: "graceslurs" });
  });

  it("inserts space between directive name and snippet", () => {
    const result = getBooleanValueDirectiveCompletions("graceslurs", true);
    expect(result[0].insertText).to.match(/^graceslurs \$\{1\|/);
  });

  it("includes documentation for each directive", () => {
    const result = getBooleanValueDirectiveCompletions("");
    expect(result.every((r) => typeof r.documentation === "object" && r.documentation !== null)).to.be.true;
  });

  it("documentation includes format hint", () => {
    const result = getBooleanValueDirectiveCompletions("graceslurs", true);
    const doc = result[0].documentation as { kind: string; value: string };
    expect(doc.value).to.include("Format:");
  });
});

describe("buildBooleanValueSnippet", () => {
  it("creates snippet with boolean choice placeholder", () => {
    const snippet = buildBooleanValueSnippet();
    expect(snippet).to.equal("${1|true,false|}");
  });

  it("has true as first choice", () => {
    const snippet = buildBooleanValueSnippet();
    expect(snippet).to.match(/^\$\{1\|true,/);
  });
});

describe("getBooleanValueDirectiveCompletions - property-based", () => {
  it("property: all boolean value directives produce valid snippets with boolean choices", () => {
    fc.assert(
      fc.property(fc.constantFrom(...BOOLEAN_VALUE_DIRECTIVES.map((d) => d.label)), (directive) => {
        const result = getBooleanValueDirectiveCompletions(directive, true);
        expect(result).to.have.length(1);
        expect(result[0].insertTextFormat).to.equal(InsertTextFormat.Snippet);
        expect(result[0].insertText).to.include("true,false");
        return true;
      })
    );
  });

  it("property: all boolean value directives return plain text when snippets not supported", () => {
    fc.assert(
      fc.property(fc.constantFrom(...BOOLEAN_VALUE_DIRECTIVES.map((d) => d.label)), (directive) => {
        const result = getBooleanValueDirectiveCompletions(directive, false);
        expect(result).to.have.length(1);
        expect(result[0].insertTextFormat).to.equal(InsertTextFormat.PlainText);
        expect(result[0].insertText).to.equal(directive);
        return true;
      })
    );
  });

  it("property: filtering is case-insensitive for all directives", () => {
    fc.assert(
      fc.property(fc.constantFrom(...BOOLEAN_VALUE_DIRECTIVES.map((d) => d.label)), (directive) => {
        const lowerResult = getBooleanValueDirectiveCompletions(directive.toLowerCase());
        const upperResult = getBooleanValueDirectiveCompletions(directive.toUpperCase());
        expect(lowerResult).to.have.length(1);
        expect(upperResult).to.have.length(1);
        expect(lowerResult[0].label).to.equal(upperResult[0].label);
        return true;
      })
    );
  });

  it("property: all returned completions match the given prefix", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 10 }), (prefix) => {
        const result = getBooleanValueDirectiveCompletions(prefix);
        return result.every((r) => r.label.toLowerCase().startsWith(prefix.toLowerCase()));
      })
    );
  });

  it("property: all directives have consistent documentation format", () => {
    fc.assert(
      fc.property(fc.constantFrom(...BOOLEAN_VALUE_DIRECTIVES.map((d) => d.label)), (directive) => {
        const result = getBooleanValueDirectiveCompletions(directive, true);
        const doc = result[0].documentation as { kind: string; value: string };
        expect(doc.value).to.include("Format:");
        return true;
      })
    );
  });
});

describe("boolean value directive completion integration", () => {
  it("returns boolean value directive completions when typing after %%", () => {
    const context = getDirectiveCompletionContext("%%grace", 7);
    expect(context.type).to.equal("directive-name");
    if (context.type === "directive-name") {
      const completions = getBooleanValueDirectiveCompletions(context.prefix, true);
      expect(completions.some((c) => c.label === "graceslurs")).to.be.true;
    }
  });

  it("returns multiple matching directives for common prefixes", () => {
    const context = getDirectiveCompletionContext("%%p", 3);
    expect(context.type).to.equal("directive-name");
    if (context.type === "directive-name") {
      const completions = getBooleanValueDirectiveCompletions(context.prefix, true);
      expect(completions.some((c) => c.label === "printtempo")).to.be.true;
      expect(completions.some((c) => c.label === "partsbox")).to.be.true;
    }
  });

  it("returns boolean value directives alongside other directive types for shared prefix", () => {
    const context = getDirectiveCompletionContext("%%parts", 7);
    expect(context.type).to.equal("directive-name");
    if (context.type === "directive-name") {
      const allCompletions = [
        ...getFontDirectiveCompletions(context.prefix, true),
        ...getMeasurementDirectiveCompletions(context.prefix, true),
        ...getBooleanFlagDirectiveCompletions(context.prefix),
        ...getPositionDirectiveCompletions(context.prefix, true),
        ...getBooleanValueDirectiveCompletions(context.prefix, true),
      ];
      const labels = allCompletions.map((c) => c.label);
      // partsfont (font), partsspace (measurement), partsbox (boolean value) all match "parts"
      expect(labels).to.include("partsfont");
      expect(labels).to.include("partsspace");
      expect(labels).to.include("partsbox");
    }
  });
});

// =============================================================================
// Number Directive Completions
// =============================================================================

describe("getNumberDirectiveCompletions", () => {
  it("returns all 10 number directives when prefix is empty", () => {
    const result = getNumberDirectiveCompletions("");
    expect(result).to.have.length(10);
    const labels = result.map((r) => r.label);
    expect(labels).to.include.members(NUMBER_DIRECTIVES.map((d) => d.label));
  });

  it("filters by prefix", () => {
    const result = getNumberDirectiveCompletions("scale");
    expect(result).to.have.length(1);
    expect(result[0].label).to.equal("scale");
  });

  it("filters case-insensitively", () => {
    const result = getNumberDirectiveCompletions("BARS");
    expect(result).to.have.length(1);
    expect(result[0].label).to.equal("barsperstaff");
  });

  it("uses snippet insert format when supportsSnippets is true", () => {
    const result = getNumberDirectiveCompletions("scale", true);
    expect(result[0].insertTextFormat).to.equal(InsertTextFormat.Snippet);
  });

  it("uses plain text insert format when supportsSnippets is false", () => {
    const result = getNumberDirectiveCompletions("scale", false);
    expect(result[0].insertTextFormat).to.equal(InsertTextFormat.PlainText);
    expect(result[0].insertText).to.equal("scale");
  });

  it("includes default value in snippet placeholder", () => {
    const result = getNumberDirectiveCompletions("scale", true);
    expect(result[0].insertText).to.include("${1:1}");
  });

  it("returns empty array when no directives match prefix", () => {
    const result = getNumberDirectiveCompletions("xyz");
    expect(result).to.have.length(0);
  });

  it("uses Keyword completion kind", () => {
    const result = getNumberDirectiveCompletions("");
    expect(result.every((r) => r.kind === CompletionItemKind.Keyword)).to.be.true;
  });

  it("includes data field with type and directive name", () => {
    const result = getNumberDirectiveCompletions("scale", true);
    expect(result[0].data).to.deep.equal({ type: "number-directive", directive: "scale" });
  });

  it("inserts space between directive name and snippet", () => {
    const result = getNumberDirectiveCompletions("scale", true);
    expect(result[0].insertText).to.match(/^scale \$\{1:/);
  });

  it("includes documentation for each directive", () => {
    const result = getNumberDirectiveCompletions("");
    expect(result.every((r) => typeof r.documentation === "object" && r.documentation !== null)).to.be.true;
  });

  it("documentation includes format hint", () => {
    const result = getNumberDirectiveCompletions("scale", true);
    const doc = result[0].documentation as { kind: string; value: string };
    expect(doc.value).to.include("Format:");
  });

  it("newpage has empty default value", () => {
    const result = getNumberDirectiveCompletions("newpage", true);
    expect(result[0].insertText).to.include("${1:}");
  });

  it("NUMBER_DIRECTIVES contains exactly the 10 layout/formatting number directives", () => {
    // This test ensures the hardcoded list stays in sync with directive-specs.ts
    // If this test fails, either a new layout directive was added or the list is incomplete
    // MIDI directives (bassvol, chordvol, etc.) are intentionally excluded
    const expectedDirectives = [
      "lineThickness",
      "stretchlast",
      "fontboxpadding",
      "voicescale",
      "scale",
      "barsperstaff",
      "measurenb",
      "barnumbers",
      "setbarnb",
      "newpage",
    ];
    const actualDirectives = NUMBER_DIRECTIVES.map((d) => d.label).sort();
    expect(actualDirectives).to.deep.equal(expectedDirectives.sort());
  });

  it("defaults to snippet format when supportsSnippets is undefined", () => {
    const result = getNumberDirectiveCompletions("scale");
    expect(result[0].insertTextFormat).to.equal(InsertTextFormat.Snippet);
  });
});

describe("buildNumberSnippet", () => {
  it("creates snippet with default value placeholder", () => {
    const snippet = buildNumberSnippet("1.0");
    expect(snippet).to.equal("${1:1.0}");
  });

  it("handles empty default value", () => {
    const snippet = buildNumberSnippet("");
    expect(snippet).to.equal("${1:}");
  });

  it("handles integer default value", () => {
    const snippet = buildNumberSnippet("4");
    expect(snippet).to.equal("${1:4}");
  });
});

describe("getNumberDirectiveCompletions - property-based", () => {
  it("property: all number directives produce valid snippets with default values", () => {
    fc.assert(
      fc.property(fc.constantFrom(...NUMBER_DIRECTIVES.map((d) => d.label)), (directive) => {
        const result = getNumberDirectiveCompletions(directive, true);
        expect(result).to.have.length(1);
        expect(result[0].insertTextFormat).to.equal(InsertTextFormat.Snippet);
        expect(result[0].insertText).to.match(/\$\{1:[^}]*\}/);
        return true;
      })
    );
  });

  it("property: all number directives return plain text when snippets not supported", () => {
    fc.assert(
      fc.property(fc.constantFrom(...NUMBER_DIRECTIVES.map((d) => d.label)), (directive) => {
        const result = getNumberDirectiveCompletions(directive, false);
        expect(result).to.have.length(1);
        expect(result[0].insertTextFormat).to.equal(InsertTextFormat.PlainText);
        expect(result[0].insertText).to.equal(directive);
        return true;
      })
    );
  });

  it("property: filtering is case-insensitive for all directives", () => {
    fc.assert(
      fc.property(fc.constantFrom(...NUMBER_DIRECTIVES.map((d) => d.label)), (directive) => {
        const lowerResult = getNumberDirectiveCompletions(directive.toLowerCase());
        const upperResult = getNumberDirectiveCompletions(directive.toUpperCase());
        expect(lowerResult).to.have.length(1);
        expect(upperResult).to.have.length(1);
        expect(lowerResult[0].label).to.equal(upperResult[0].label);
        return true;
      })
    );
  });

  it("property: all returned completions match the given prefix", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 10 }), (prefix) => {
        const result = getNumberDirectiveCompletions(prefix);
        return result.every((r) => r.label.toLowerCase().startsWith(prefix.toLowerCase()));
      })
    );
  });

  it("property: all directives have consistent documentation format", () => {
    fc.assert(
      fc.property(fc.constantFrom(...NUMBER_DIRECTIVES.map((d) => d.label)), (directive) => {
        const result = getNumberDirectiveCompletions(directive, true);
        const doc = result[0].documentation as { kind: string; value: string };
        expect(doc.value).to.include("Format:");
        return true;
      })
    );
  });
});

describe("number directive completion integration", () => {
  it("returns number directive completions when typing after %%", () => {
    const context = getDirectiveCompletionContext("%%scale", 7);
    expect(context.type).to.equal("directive-name");
    if (context.type === "directive-name") {
      const completions = getNumberDirectiveCompletions(context.prefix, true);
      expect(completions.some((c) => c.label === "scale")).to.be.true;
    }
  });

  it("returns multiple matching directives for common prefixes", () => {
    const context = getDirectiveCompletionContext("%%bar", 5);
    expect(context.type).to.equal("directive-name");
    if (context.type === "directive-name") {
      const completions = getNumberDirectiveCompletions(context.prefix, true);
      expect(completions.some((c) => c.label === "barsperstaff")).to.be.true;
      expect(completions.some((c) => c.label === "barnumbers")).to.be.true;
    }
  });

  it("returns number directives alongside other directive types for shared prefix", () => {
    const context = getDirectiveCompletionContext("%%voice", 7);
    expect(context.type).to.equal("directive-name");
    if (context.type === "directive-name") {
      const allCompletions = [
        ...getFontDirectiveCompletions(context.prefix, true),
        ...getMeasurementDirectiveCompletions(context.prefix, true),
        ...getNumberDirectiveCompletions(context.prefix, true),
      ];
      const labels = allCompletions.map((c) => c.label);
      // voicefont (font), voicescale (number) match "voice"
      expect(labels).to.include("voicefont");
      expect(labels).to.include("voicescale");
    }
  });
});

// =============================================================================
// Identifier Directive Completions
// =============================================================================

describe("getIdentifierDirectiveCompletions", () => {
  it("returns all 6 identifier directives when prefix is empty", () => {
    const result = getIdentifierDirectiveCompletions("");
    expect(result).to.have.length(6);
    const labels = result.map((r) => r.label);
    expect(labels).to.include.members(IDENTIFIER_DIRECTIVES.map((d) => d.label));
  });

  it("filters by prefix", () => {
    const result = getIdentifierDirectiveCompletions("paper");
    expect(result).to.have.length(1);
    expect(result[0].label).to.equal("papersize");
  });

  it("filters case-insensitively", () => {
    const result = getIdentifierDirectiveCompletions("VOICE");
    expect(result).to.have.length(1);
    expect(result[0].label).to.equal("voicecolor");
  });

  it("uses snippet insert format when supportsSnippets is true", () => {
    const result = getIdentifierDirectiveCompletions("papersize", true);
    expect(result[0].insertTextFormat).to.equal(InsertTextFormat.Snippet);
  });

  it("uses plain text insert format when supportsSnippets is false", () => {
    const result = getIdentifierDirectiveCompletions("papersize", false);
    expect(result[0].insertTextFormat).to.equal(InsertTextFormat.PlainText);
    expect(result[0].insertText).to.equal("papersize");
  });

  it("includes default value in snippet placeholder for papersize", () => {
    const result = getIdentifierDirectiveCompletions("papersize", true);
    expect(result[0].insertText).to.include("${1:a4}");
  });

  it("includes empty default for directives without common defaults", () => {
    const result = getIdentifierDirectiveCompletions("map", true);
    expect(result[0].insertText).to.include("${1:}");
  });

  it("returns empty array when no directives match prefix", () => {
    const result = getIdentifierDirectiveCompletions("xyz");
    expect(result).to.have.length(0);
  });

  it("uses Keyword completion kind", () => {
    const result = getIdentifierDirectiveCompletions("");
    expect(result.every((r) => r.kind === CompletionItemKind.Keyword)).to.be.true;
  });

  it("includes data field with type and directive name", () => {
    const result = getIdentifierDirectiveCompletions("papersize", true);
    expect(result[0].data).to.deep.equal({ type: "identifier-directive", directive: "papersize" });
  });

  it("inserts space between directive name and snippet", () => {
    const result = getIdentifierDirectiveCompletions("papersize", true);
    expect(result[0].insertText).to.match(/^papersize \$\{1:/);
  });

  it("includes documentation for each directive", () => {
    const result = getIdentifierDirectiveCompletions("");
    expect(result.every((r) => typeof r.documentation === "object" && r.documentation !== null)).to.be.true;
  });

  it("documentation includes format hint", () => {
    const result = getIdentifierDirectiveCompletions("papersize", true);
    const doc = result[0].documentation as { kind: string; value: string };
    expect(doc.value).to.include("Format:");
  });

  it("IDENTIFIER_DIRECTIVES contains exactly the 6 layout/configuration identifier directives", () => {
    const expectedDirectives = ["papersize", "voicecolor", "map", "playtempo", "auquality", "continuous"];
    const actualDirectives = IDENTIFIER_DIRECTIVES.map((d) => d.label).sort();
    expect(actualDirectives).to.deep.equal(expectedDirectives.sort());
  });

  it("defaults to snippet format when supportsSnippets is undefined", () => {
    const result = getIdentifierDirectiveCompletions("papersize");
    expect(result[0].insertTextFormat).to.equal(InsertTextFormat.Snippet);
  });
});

describe("buildIdentifierSnippet", () => {
  it("creates snippet with default value placeholder", () => {
    const snippet = buildIdentifierSnippet("a4");
    expect(snippet).to.equal("${1:a4}");
  });

  it("handles empty default value", () => {
    const snippet = buildIdentifierSnippet("");
    expect(snippet).to.equal("${1:}");
  });
});

describe("getIdentifierDirectiveCompletions - property-based", () => {
  it("property: all identifier directives produce valid snippets", () => {
    fc.assert(
      fc.property(fc.constantFrom(...IDENTIFIER_DIRECTIVES.map((d) => d.label)), (directive) => {
        const result = getIdentifierDirectiveCompletions(directive, true);
        expect(result).to.have.length(1);
        expect(result[0].insertTextFormat).to.equal(InsertTextFormat.Snippet);
        expect(result[0].insertText).to.match(/\$\{1:[^}]*\}/);
        return true;
      })
    );
  });

  it("property: all identifier directives return plain text when snippets not supported", () => {
    fc.assert(
      fc.property(fc.constantFrom(...IDENTIFIER_DIRECTIVES.map((d) => d.label)), (directive) => {
        const result = getIdentifierDirectiveCompletions(directive, false);
        expect(result).to.have.length(1);
        expect(result[0].insertTextFormat).to.equal(InsertTextFormat.PlainText);
        expect(result[0].insertText).to.equal(directive);
        return true;
      })
    );
  });

  it("property: filtering is case-insensitive for all directives", () => {
    fc.assert(
      fc.property(fc.constantFrom(...IDENTIFIER_DIRECTIVES.map((d) => d.label)), (directive) => {
        const lowerResult = getIdentifierDirectiveCompletions(directive.toLowerCase());
        const upperResult = getIdentifierDirectiveCompletions(directive.toUpperCase());
        expect(lowerResult).to.have.length(1);
        expect(upperResult).to.have.length(1);
        expect(lowerResult[0].label).to.equal(upperResult[0].label);
        return true;
      })
    );
  });

  it("property: all returned completions match the given prefix", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 10 }), (prefix) => {
        const result = getIdentifierDirectiveCompletions(prefix);
        return result.every((r) => r.label.toLowerCase().startsWith(prefix.toLowerCase()));
      })
    );
  });

  it("property: all directives have consistent documentation format", () => {
    fc.assert(
      fc.property(fc.constantFrom(...IDENTIFIER_DIRECTIVES.map((d) => d.label)), (directive) => {
        const result = getIdentifierDirectiveCompletions(directive, true);
        const doc = result[0].documentation as { kind: string; value: string };
        expect(doc.value).to.include("Format:");
        return true;
      })
    );
  });
});

describe("identifier directive completion integration", () => {
  it("returns identifier directive completions when typing after %%", () => {
    const context = getDirectiveCompletionContext("%%paper", 7);
    expect(context.type).to.equal("directive-name");
    if (context.type === "directive-name") {
      const completions = getIdentifierDirectiveCompletions(context.prefix, true);
      expect(completions.some((c) => c.label === "papersize")).to.be.true;
    }
  });

  it("returns identifier directives alongside other directive types for shared prefix", () => {
    const context = getDirectiveCompletionContext("%%voice", 7);
    expect(context.type).to.equal("directive-name");
    if (context.type === "directive-name") {
      const allCompletions = [
        ...getFontDirectiveCompletions(context.prefix, true),
        ...getNumberDirectiveCompletions(context.prefix, true),
        ...getIdentifierDirectiveCompletions(context.prefix, true),
      ];
      const labels = allCompletions.map((c) => c.label);
      // voicefont (font), voicescale (number), voicecolor (identifier) match "voice"
      expect(labels).to.include("voicefont");
      expect(labels).to.include("voicescale");
      expect(labels).to.include("voicecolor");
    }
  });
});

// =============================================================================
// Text/Annotation Directive Completions
// =============================================================================

describe("getTextDirectiveCompletions", () => {
  it("returns all 7 text directives when prefix is empty", () => {
    const result = getTextDirectiveCompletions("");
    expect(result).to.have.length(7);
    const labels = result.map((r) => r.label);
    expect(labels).to.include.members(TEXT_DIRECTIVES.map((d) => d.label));
  });

  it("filters by prefix", () => {
    const result = getTextDirectiveCompletions("text");
    expect(result).to.have.length(1);
    expect(result[0].label).to.equal("text");
  });

  it("filters by prefix for hyphenated directives", () => {
    const result = getTextDirectiveCompletions("abc-copy");
    expect(result).to.have.length(1);
    expect(result[0].label).to.equal("abc-copyright");
  });

  it("filters case-insensitively", () => {
    const result = getTextDirectiveCompletions("CENTER");
    expect(result).to.have.length(1);
    expect(result[0].label).to.equal("center");
  });

  it("returns all abc- prefixed directives", () => {
    const result = getTextDirectiveCompletions("abc-");
    expect(result).to.have.length(5);
    expect(result.every((r) => r.label.startsWith("abc-"))).to.be.true;
  });

  it("uses snippet insert format when supportsSnippets is true", () => {
    const result = getTextDirectiveCompletions("text", true);
    expect(result[0].insertTextFormat).to.equal(InsertTextFormat.Snippet);
  });

  it("uses plain text insert format when supportsSnippets is false", () => {
    const result = getTextDirectiveCompletions("text", false);
    expect(result[0].insertTextFormat).to.equal(InsertTextFormat.PlainText);
    expect(result[0].insertText).to.equal("text");
  });

  it("includes placeholder in snippet", () => {
    const result = getTextDirectiveCompletions("text", true);
    expect(result[0].insertText).to.include("${1:text here}");
  });

  it("returns empty array when no directives match prefix", () => {
    const result = getTextDirectiveCompletions("xyz");
    expect(result).to.have.length(0);
  });

  it("uses Keyword completion kind", () => {
    const result = getTextDirectiveCompletions("");
    expect(result.every((r) => r.kind === CompletionItemKind.Keyword)).to.be.true;
  });

  it("includes data field with type and directive name", () => {
    const result = getTextDirectiveCompletions("text", true);
    expect(result[0].data).to.deep.equal({ type: "text-directive", directive: "text" });
  });

  it("inserts space between directive name and snippet", () => {
    const result = getTextDirectiveCompletions("text", true);
    expect(result[0].insertText).to.match(/^text \$\{1:/);
  });

  it("includes documentation for each directive", () => {
    const result = getTextDirectiveCompletions("");
    expect(result.every((r) => typeof r.documentation === "object" && r.documentation !== null)).to.be.true;
  });

  it("documentation includes format hint", () => {
    const result = getTextDirectiveCompletions("text", true);
    const doc = result[0].documentation as { kind: string; value: string };
    expect(doc.value).to.include("**Format:**");
    expect(doc.value).to.include("%%text <text>");
  });

  it("TEXT_DIRECTIVES contains exactly the 7 text/annotation directives", () => {
    const expectedDirectives = ["text", "center", "abc-copyright", "abc-creator", "abc-edited-by", "abc-version", "abc-charset"];
    const actualDirectives = TEXT_DIRECTIVES.map((d) => d.label).sort();
    expect(actualDirectives).to.deep.equal(expectedDirectives.sort());
  });

  it("defaults to snippet format when supportsSnippets is undefined", () => {
    const result = getTextDirectiveCompletions("text");
    expect(result[0].insertTextFormat).to.equal(InsertTextFormat.Snippet);
  });
});

describe("buildTextSnippet", () => {
  it("creates snippet with placeholder text", () => {
    const snippet = buildTextSnippet("hello world");
    expect(snippet).to.equal("${1:hello world}");
  });

  it("handles placeholder with spaces", () => {
    const snippet = buildTextSnippet("Copyright notice");
    expect(snippet).to.equal("${1:Copyright notice}");
  });
});

describe("getTextDirectiveCompletions - property-based", () => {
  it("property: all text directives produce valid snippets", () => {
    fc.assert(
      fc.property(fc.constantFrom(...TEXT_DIRECTIVES.map((d) => d.label)), (directive) => {
        const result = getTextDirectiveCompletions(directive, true);
        expect(result).to.have.length(1);
        expect(result[0].insertTextFormat).to.equal(InsertTextFormat.Snippet);
        expect(result[0].insertText).to.match(/\$\{1:[^}]+\}/);
        return true;
      })
    );
  });

  it("property: all text directives return plain text when snippets not supported", () => {
    fc.assert(
      fc.property(fc.constantFrom(...TEXT_DIRECTIVES.map((d) => d.label)), (directive) => {
        const result = getTextDirectiveCompletions(directive, false);
        expect(result).to.have.length(1);
        expect(result[0].insertTextFormat).to.equal(InsertTextFormat.PlainText);
        expect(result[0].insertText).to.equal(directive);
        return true;
      })
    );
  });

  it("property: filtering is case-insensitive for all directives", () => {
    fc.assert(
      fc.property(fc.constantFrom(...TEXT_DIRECTIVES.map((d) => d.label)), (directive) => {
        const lowerResult = getTextDirectiveCompletions(directive.toLowerCase());
        const upperResult = getTextDirectiveCompletions(directive.toUpperCase());
        expect(lowerResult).to.have.length(1);
        expect(upperResult).to.have.length(1);
        expect(lowerResult[0].label).to.equal(upperResult[0].label);
        return true;
      })
    );
  });

  it("property: all returned completions match the given prefix", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 10 }), (prefix) => {
        const result = getTextDirectiveCompletions(prefix);
        return result.every((r) => r.label.toLowerCase().startsWith(prefix.toLowerCase()));
      })
    );
  });

  it("property: all directives have consistent documentation format", () => {
    fc.assert(
      fc.property(fc.constantFrom(...TEXT_DIRECTIVES.map((d) => d.label)), (directive) => {
        const result = getTextDirectiveCompletions(directive, true);
        const doc = result[0].documentation as { kind: string; value: string };
        expect(doc.value).to.match(/\*\*Format:\*\* `%%[\w-]+ <text>`/);
        return true;
      })
    );
  });
});

describe("text directive completion integration", () => {
  it("returns text directive completions when typing after %%", () => {
    const context = getDirectiveCompletionContext("%%text", 6);
    expect(context.type).to.equal("directive-name");
    if (context.type === "directive-name") {
      const completions = getTextDirectiveCompletions(context.prefix, true);
      expect(completions.some((c) => c.label === "text")).to.be.true;
    }
  });

  it("returns all abc- metadata directives", () => {
    const context = getDirectiveCompletionContext("%%abc-", 6);
    expect(context.type).to.equal("directive-name");
    if (context.type === "directive-name") {
      const completions = getTextDirectiveCompletions(context.prefix, true);
      expect(completions).to.have.length(5);
      expect(completions.some((c) => c.label === "abc-copyright")).to.be.true;
      expect(completions.some((c) => c.label === "abc-creator")).to.be.true;
    }
  });

  it("returns text directives alongside other directive types for shared prefix", () => {
    const context = getDirectiveCompletionContext("%%text", 6);
    expect(context.type).to.equal("directive-name");
    if (context.type === "directive-name") {
      const allCompletions = [
        ...getFontDirectiveCompletions(context.prefix, true),
        ...getMeasurementDirectiveCompletions(context.prefix, true),
        ...getTextDirectiveCompletions(context.prefix, true),
      ];
      const labels = allCompletions.map((c) => c.label);
      // textfont (font), textspace (measurement), text (text) all match "text"
      expect(labels).to.include("textfont");
      expect(labels).to.include("textspace");
      expect(labels).to.include("text");
    }
  });
});

// =============================================================================
// Complex Directive Completions
// =============================================================================

describe("getComplexDirectiveCompletions", () => {
  it("returns all 8 complex directives when prefix is empty", () => {
    const result = getComplexDirectiveCompletions("");
    expect(result).to.have.length(8);
    const labels = result.map((r) => r.label);
    expect(labels).to.include.members(COMPLEX_DIRECTIVES.map((d) => d.label));
  });

  it("filters by prefix", () => {
    const result = getComplexDirectiveCompletions("begin");
    expect(result).to.have.length(1);
    expect(result[0].label).to.equal("begintext");
  });

  it("filters case-insensitively", () => {
    const result = getComplexDirectiveCompletions("STAVES");
    expect(result).to.have.length(1);
    expect(result[0].label).to.equal("staves");
  });

  it("uses snippet insert format when supportsSnippets is true", () => {
    const result = getComplexDirectiveCompletions("begintext", true);
    expect(result[0].insertTextFormat).to.equal(InsertTextFormat.Snippet);
  });

  it("uses plain text insert format when supportsSnippets is false", () => {
    const result = getComplexDirectiveCompletions("begintext", false);
    expect(result[0].insertTextFormat).to.equal(InsertTextFormat.PlainText);
    expect(result[0].insertText).to.equal("begintext");
  });

  it("begintext includes alignment choice dropdown", () => {
    const result = getComplexDirectiveCompletions("begintext", true);
    expect(result[0].insertText).to.include("${1|obey,fill,justify,skip,center,right,none|}");
  });

  it("setfont includes font number, name, and size placeholders", () => {
    const result = getComplexDirectiveCompletions("setfont", true);
    expect(result[0].insertText).to.include("setfont-${1|1,2,3,4|}");
    expect(result[0].insertText).to.include("${2:");
    expect(result[0].insertText).to.include("${3:");
  });

  it("header includes tab separators", () => {
    const result = getComplexDirectiveCompletions("header", true);
    expect(result[0].insertText).to.include("\t");
  });

  it("footer includes tab separators", () => {
    const result = getComplexDirectiveCompletions("footer", true);
    expect(result[0].insertText).to.include("\t");
  });

  it("returns empty array when no directives match prefix", () => {
    const result = getComplexDirectiveCompletions("xyz");
    expect(result).to.have.length(0);
  });

  it("uses Keyword completion kind", () => {
    const result = getComplexDirectiveCompletions("");
    expect(result.every((r) => r.kind === CompletionItemKind.Keyword)).to.be.true;
  });

  it("includes data field with type and directive name", () => {
    const result = getComplexDirectiveCompletions("begintext", true);
    expect(result[0].data).to.deep.equal({ type: "complex-directive", directive: "begintext" });
  });

  it("includes documentation for each directive", () => {
    const result = getComplexDirectiveCompletions("");
    expect(result.every((r) => typeof r.documentation === "object" && r.documentation !== null)).to.be.true;
  });

  it("staves and score have similar structure", () => {
    const staves = getComplexDirectiveCompletions("staves", true);
    const score = getComplexDirectiveCompletions("score", true);
    expect(staves[0].insertText).to.match(/staves \$\{1:/);
    expect(score[0].insertText).to.match(/score \$\{1:/);
  });

  it("percmap includes note, sound, and optional head placeholders", () => {
    const result = getComplexDirectiveCompletions("percmap", true);
    expect(result[0].insertText).to.include("${1:");
    expect(result[0].insertText).to.include("${2:");
    expect(result[0].insertText).to.include("${3:");
  });

  it("COMPLEX_DIRECTIVES contains exactly the 8 complex directives", () => {
    const expectedDirectives = ["begintext", "setfont", "staves", "score", "header", "footer", "deco", "percmap"];
    const actualDirectives = COMPLEX_DIRECTIVES.map((d) => d.label).sort();
    expect(actualDirectives).to.deep.equal(expectedDirectives.sort());
  });

  it("defaults to snippet format when supportsSnippets is undefined", () => {
    const result = getComplexDirectiveCompletions("begintext");
    expect(result[0].insertTextFormat).to.equal(InsertTextFormat.Snippet);
  });
});

describe("getComplexDirectiveCompletions - property-based", () => {
  it("property: all complex directives produce valid snippets", () => {
    fc.assert(
      fc.property(fc.constantFrom(...COMPLEX_DIRECTIVES.map((d) => d.label)), (directive) => {
        const result = getComplexDirectiveCompletions(directive, true);
        expect(result).to.have.length(1);
        expect(result[0].insertTextFormat).to.equal(InsertTextFormat.Snippet);
        // All complex directives should have at least one placeholder
        expect(result[0].insertText).to.match(/\$\{1/);
        return true;
      })
    );
  });

  it("property: all complex directives return plain text when snippets not supported", () => {
    fc.assert(
      fc.property(fc.constantFrom(...COMPLEX_DIRECTIVES.map((d) => d.label)), (directive) => {
        const result = getComplexDirectiveCompletions(directive, false);
        expect(result).to.have.length(1);
        expect(result[0].insertTextFormat).to.equal(InsertTextFormat.PlainText);
        expect(result[0].insertText).to.equal(directive);
        return true;
      })
    );
  });

  it("property: filtering is case-insensitive for all directives", () => {
    fc.assert(
      fc.property(fc.constantFrom(...COMPLEX_DIRECTIVES.map((d) => d.label)), (directive) => {
        const lowerResult = getComplexDirectiveCompletions(directive.toLowerCase());
        const upperResult = getComplexDirectiveCompletions(directive.toUpperCase());
        expect(lowerResult).to.have.length(1);
        expect(upperResult).to.have.length(1);
        expect(lowerResult[0].label).to.equal(upperResult[0].label);
        return true;
      })
    );
  });

  it("property: all returned completions match the given prefix", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 10 }), (prefix) => {
        const result = getComplexDirectiveCompletions(prefix);
        return result.every((r) => r.label.toLowerCase().startsWith(prefix.toLowerCase()));
      })
    );
  });
});

describe("complex directive completion integration", () => {
  it("returns complex directive completions when typing after %%", () => {
    const context = getDirectiveCompletionContext("%%begin", 7);
    expect(context.type).to.equal("directive-name");
    if (context.type === "directive-name") {
      const completions = getComplexDirectiveCompletions(context.prefix, true);
      expect(completions.some((c) => c.label === "begintext")).to.be.true;
    }
  });

  it("returns staves and score for 's' prefix", () => {
    const context = getDirectiveCompletionContext("%%s", 3);
    expect(context.type).to.equal("directive-name");
    if (context.type === "directive-name") {
      const completions = getComplexDirectiveCompletions(context.prefix, true);
      expect(completions.some((c) => c.label === "staves")).to.be.true;
      expect(completions.some((c) => c.label === "score")).to.be.true;
      expect(completions.some((c) => c.label === "setfont")).to.be.true;
    }
  });
});

// =============================================================================
// MIDI Command Completions
// =============================================================================

describe("getMidiCommandCompletions", () => {
  it("returns all MIDI commands when prefix is empty", () => {
    const result = getMidiCommandCompletions("");
    expect(result).to.have.length(MIDI_COMMANDS.length);
    // Verify count matches expectation (update if MIDI_COMMAND_SPECS changes)
    expect(MIDI_COMMANDS.length).to.equal(53);
  });

  it("filters by prefix", () => {
    const result = getMidiCommandCompletions("prog");
    expect(result).to.have.length(1);
    expect(result[0].label).to.equal("program");
  });

  it("filters case-insensitively", () => {
    const result = getMidiCommandCompletions("TRANS");
    expect(result).to.have.length(1);
    expect(result[0].label).to.equal("transpose");
  });

  it("trims whitespace from prefix", () => {
    const result = getMidiCommandCompletions("  prog");
    expect(result).to.have.length(1);
    expect(result[0].label).to.equal("program");
  });

  it("uses snippet insert format when supportsSnippets is true", () => {
    const result = getMidiCommandCompletions("program", true);
    expect(result[0].insertTextFormat).to.equal(InsertTextFormat.Snippet);
  });

  it("uses plain text insert format when supportsSnippets is false", () => {
    const result = getMidiCommandCompletions("program", false);
    expect(result[0].insertTextFormat).to.equal(InsertTextFormat.PlainText);
    expect(result[0].insertText).to.equal("program");
  });

  it("no-param commands have no placeholders", () => {
    const result = getMidiCommandCompletions("nobarlines", true);
    expect(result[0].insertText).to.equal("nobarlines");
  });

  it("one-int commands have one placeholder", () => {
    const result = getMidiCommandCompletions("channel", true);
    expect(result[0].insertText).to.include("${1:");
    expect(result[0].insertText).to.not.include("${2:");
  });

  it("two-int commands have two placeholders", () => {
    const result = getMidiCommandCompletions("ratio", true);
    expect(result[0].insertText).to.include("${1:");
    expect(result[0].insertText).to.include("${2:");
  });

  it("beat command has four placeholders", () => {
    const result = getMidiCommandCompletions("beat", true);
    const beatCmd = result.find((r) => r.label === "beat");
    expect(beatCmd).to.not.be.undefined;
    expect(beatCmd!.insertText).to.include("${1:");
    expect(beatCmd!.insertText).to.include("${2:");
    expect(beatCmd!.insertText).to.include("${3:");
    expect(beatCmd!.insertText).to.include("${4:");
  });

  it("drone command has five placeholders", () => {
    const result = getMidiCommandCompletions("drone", true);
    const droneCmd = result.find((r) => r.label === "drone");
    expect(droneCmd).to.not.be.undefined;
    expect(droneCmd!.insertText).to.include("${1:");
    expect(droneCmd!.insertText).to.include("${5:");
  });

  it("fraction commands include fraction default", () => {
    const result = getMidiCommandCompletions("grace", true);
    const graceCmd = result.find((r) => r.label === "grace");
    expect(graceCmd).to.not.be.undefined;
    expect(graceCmd!.insertText).to.include("1/8");
  });

  it("returns empty array when no commands match prefix", () => {
    const result = getMidiCommandCompletions("xyz");
    expect(result).to.have.length(0);
  });

  it("uses Keyword completion kind", () => {
    const result = getMidiCommandCompletions("");
    expect(result.every((r) => r.kind === CompletionItemKind.Keyword)).to.be.true;
  });

  it("includes data field with type and command name", () => {
    const result = getMidiCommandCompletions("program", true);
    expect(result[0].data).to.deep.equal({ type: "midi-command", command: "program" });
  });

  it("includes documentation for each command", () => {
    const result = getMidiCommandCompletions("");
    expect(result.every((r) => typeof r.documentation === "object" && r.documentation !== null)).to.be.true;
  });

  it("returns multiple commands for common prefix", () => {
    const result = getMidiCommandCompletions("drum");
    expect(result.length).to.be.greaterThan(1);
    expect(result.some((c) => c.label === "drumon")).to.be.true;
    expect(result.some((c) => c.label === "drumoff")).to.be.true;
    expect(result.some((c) => c.label === "drum")).to.be.true;
    expect(result.some((c) => c.label === "drumbars")).to.be.true;
    expect(result.some((c) => c.label === "drummap")).to.be.true;
  });

  it("defaults to snippet format when supportsSnippets is undefined", () => {
    const result = getMidiCommandCompletions("program");
    expect(result[0].insertTextFormat).to.equal(InsertTextFormat.Snippet);
  });
});

describe("getMidiCommandCompletions - property-based", () => {
  it("property: all MIDI commands produce valid completions", () => {
    fc.assert(
      fc.property(fc.constantFrom(...MIDI_COMMANDS.map((c) => c.label)), (command) => {
        const result = getMidiCommandCompletions(command, true);
        // Because some commands are prefixes of others (e.g., "c" matches "c", "channel", etc.),
        // we expect at least 1 result and verify the exact match is included
        expect(result.length).to.be.greaterThanOrEqual(1);
        const exactMatch = result.find((r) => r.label === command);
        expect(exactMatch).to.not.be.undefined;
        expect(exactMatch!.insertTextFormat).to.equal(InsertTextFormat.Snippet);
        return true;
      })
    );
  });

  it("property: all MIDI commands return plain text when snippets not supported", () => {
    fc.assert(
      fc.property(fc.constantFrom(...MIDI_COMMANDS.map((c) => c.label)), (command) => {
        const result = getMidiCommandCompletions(command, false);
        // Because some commands are prefixes of others (e.g., "c" matches "c", "channel", etc.),
        // we expect at least 1 result and verify the exact match is included
        expect(result.length).to.be.greaterThanOrEqual(1);
        const exactMatch = result.find((r) => r.label === command);
        expect(exactMatch).to.not.be.undefined;
        expect(exactMatch!.insertTextFormat).to.equal(InsertTextFormat.PlainText);
        expect(exactMatch!.insertText).to.equal(command);
        return true;
      })
    );
  });

  it("property: filtering is case-insensitive for all commands", () => {
    fc.assert(
      fc.property(fc.constantFrom(...MIDI_COMMANDS.map((c) => c.label)), (command) => {
        const lowerResult = getMidiCommandCompletions(command.toLowerCase());
        const upperResult = getMidiCommandCompletions(command.toUpperCase());
        expect(lowerResult.length).to.be.greaterThanOrEqual(1);
        expect(upperResult.length).to.be.greaterThanOrEqual(1);
        expect(lowerResult[0].label).to.equal(upperResult[0].label);
        return true;
      })
    );
  });

  it("property: all returned completions match the given prefix", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 10 }), (prefix) => {
        const result = getMidiCommandCompletions(prefix);
        return result.every((r) => r.label.toLowerCase().startsWith(prefix.trim().toLowerCase()));
      })
    );
  });
});

describe("MIDI command completion integration", () => {
  it("returns MIDI command completions when typing after %%MIDI ", () => {
    const context = getDirectiveCompletionContext("%%MIDI prog", 11);
    expect(context.type).to.equal("midi-command");
    if (context.type === "midi-command") {
      const completions = getMidiCommandCompletions(context.prefix, true);
      expect(completions.some((c) => c.label === "program")).to.be.true;
    }
  });

  it("returns all MIDI commands for empty prefix after %%MIDI ", () => {
    const context = getDirectiveCompletionContext("%%MIDI ", 7);
    expect(context.type).to.equal("midi-command");
    if (context.type === "midi-command") {
      const completions = getMidiCommandCompletions(context.prefix, true);
      expect(completions).to.have.length(53);
    }
  });

  it("offers MIDI as a directive name before typing space", () => {
    const context = getDirectiveCompletionContext("%%MID", 5);
    expect(context.type).to.equal("directive-name");
    if (context.type === "directive-name") {
      expect(context.prefix).to.equal("MID");
    }
  });
});

// =============================================================================
// Parameter Completion Functions (secondary completions)
// =============================================================================

describe("getMeasurementUnitCompletions", () => {
  it("returns all units for empty prefix", () => {
    const result = getMeasurementUnitCompletions("");
    expect(result).to.have.length(MEASUREMENT_UNITS.length);
    expect(result.map((r) => r.label)).to.include.members(MEASUREMENT_UNITS);
  });

  it("filters by prefix case-insensitively", () => {
    const result = getMeasurementUnitCompletions("p");
    expect(result).to.have.length(1);
    expect(result[0].label).to.equal("pt");
  });

  it("returns empty array for non-matching prefix", () => {
    const result = getMeasurementUnitCompletions("xyz");
    expect(result).to.have.length(0);
  });

  it("sets correct completion item kind (Unit)", () => {
    const result = getMeasurementUnitCompletions("");
    expect(result.every((r) => r.kind === CompletionItemKind.Unit)).to.be.true;
  });

  it("uses PlainText insertTextFormat", () => {
    const result = getMeasurementUnitCompletions("");
    expect(result.every((r) => r.insertTextFormat === InsertTextFormat.PlainText)).to.be.true;
  });
});

describe("getPositionChoiceCompletions", () => {
  it("returns all choices for empty prefix", () => {
    const result = getPositionChoiceCompletions("");
    expect(result).to.have.length(POSITION_CHOICES.length);
    expect(result.map((r) => r.label)).to.include.members(POSITION_CHOICES);
  });

  it("filters by prefix case-insensitively", () => {
    const result = getPositionChoiceCompletions("a");
    expect(result).to.have.length(2);
    expect(result.map((r) => r.label)).to.include.members(["auto", "above"]);
  });

  it("returns empty array for non-matching prefix", () => {
    const result = getPositionChoiceCompletions("xyz");
    expect(result).to.have.length(0);
  });

  it("sets correct completion item kind (EnumMember)", () => {
    const result = getPositionChoiceCompletions("");
    expect(result.every((r) => r.kind === CompletionItemKind.EnumMember)).to.be.true;
  });

  it("uses PlainText insertTextFormat", () => {
    const result = getPositionChoiceCompletions("");
    expect(result.every((r) => r.insertTextFormat === InsertTextFormat.PlainText)).to.be.true;
  });
});

describe("getBooleanChoiceCompletions", () => {
  it("returns all choices for empty prefix", () => {
    const result = getBooleanChoiceCompletions("");
    expect(result).to.have.length(BOOLEAN_VALUE_CHOICES.length);
    expect(result.map((r) => r.label)).to.include.members(BOOLEAN_VALUE_CHOICES);
  });

  it("filters by prefix case-insensitively", () => {
    const result = getBooleanChoiceCompletions("t");
    expect(result).to.have.length(1);
    expect(result[0].label).to.equal("true");
  });

  it("returns empty array for non-matching prefix", () => {
    const result = getBooleanChoiceCompletions("xyz");
    expect(result).to.have.length(0);
  });

  it("sets correct completion item kind (EnumMember)", () => {
    const result = getBooleanChoiceCompletions("");
    expect(result.every((r) => r.kind === CompletionItemKind.EnumMember)).to.be.true;
  });

  it("uses PlainText insertTextFormat", () => {
    const result = getBooleanChoiceCompletions("");
    expect(result.every((r) => r.insertTextFormat === InsertTextFormat.PlainText)).to.be.true;
  });
});

describe("Secondary completion integration", () => {
  it("returns position choices when typing after %%vocal ", () => {
    const context = getDirectiveCompletionContext("%%vocal ", 8);
    expect(context.type).to.equal("position-choice");
    if (context.type === "position-choice") {
      const completions = getPositionChoiceCompletions(context.prefix);
      expect(completions).to.have.length(4);
      expect(completions.map((c) => c.label)).to.include.members(["auto", "above", "below", "hidden"]);
    }
  });

  it("returns measurement units when typing after %%botmargin ", () => {
    const context = getDirectiveCompletionContext("%%botmargin ", 12);
    expect(context.type).to.equal("measurement-unit");
    if (context.type === "measurement-unit") {
      const completions = getMeasurementUnitCompletions(context.prefix);
      expect(completions).to.have.length(4);
      expect(completions.map((c) => c.label)).to.include.members(["pt", "in", "cm", "mm"]);
    }
  });

  it("returns boolean choices when typing after %%graceslurs ", () => {
    const context = getDirectiveCompletionContext("%%graceslurs ", 13);
    expect(context.type).to.equal("boolean-choice");
    if (context.type === "boolean-choice") {
      const completions = getBooleanChoiceCompletions(context.prefix);
      expect(completions).to.have.length(2);
      expect(completions.map((c) => c.label)).to.include.members(["true", "false"]);
    }
  });

  it("filters position choices by partial prefix", () => {
    const context = getDirectiveCompletionContext("%%vocal au", 10);
    expect(context.type).to.equal("position-choice");
    if (context.type === "position-choice") {
      const completions = getPositionChoiceCompletions(context.prefix);
      expect(completions).to.have.length(1);
      expect(completions[0].label).to.equal("auto");
    }
  });
});
