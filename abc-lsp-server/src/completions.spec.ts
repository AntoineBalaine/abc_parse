import { expect } from "chai";
import { describe, it } from "mocha";
import { CompletionItemKind } from "vscode-languageserver";
import {
  getDirectiveCompletionContext,
  getDirectiveCompletions,
  ABCLS_DIRECTIVES,
  ABCLS_PARSE_OPTIONS,
  ABCLS_FMT_OPTIONS,
  ABCLS_VOICES_OPTIONS,
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
});

describe("getDirectiveCompletions", () => {
  describe("directive name completions", () => {
    it("returns all directives when prefix is empty", () => {
      const result = getDirectiveCompletions(ABCLS_DIRECTIVES, "", CompletionItemKind.Keyword);
      expect(result).to.have.length(3);
      expect(result.map((r) => r.label)).to.include.members([
        "abcls-fmt",
        "abcls-parse",
        "abcls-voices",
      ]);
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
      expect(result.map((r) => r.label)).to.include.members([
        "system-comments",
        "voice-markers=inline",
        "voice-markers=infoline",
      ]);
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
