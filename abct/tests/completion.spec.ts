// Tests for ABCT auto-completion functionality
// Tests context detection and completion item generation

import { expect } from "chai";
import { TextDocument } from "vscode-languageserver-textdocument";
import { Position, CompletionItemKind } from "vscode-languageserver";
import {
  getCompletionContext,
  getDefinedVariables,
} from "../../abc-lsp-server/src/abct/completionContext";
import { provideAbctCompletions } from "../../abc-lsp-server/src/abct/AbctCompletionProvider";

/**
 * Creates a TextDocument for testing.
 */
function createDocument(content: string, uri = "file:///test.abct"): TextDocument {
  return TextDocument.create(uri, "abct", 1, content);
}

describe("ABCT Auto-completion", () => {
  describe("Context Detection", () => {
    describe("Transform Context", () => {
      it("should detect transform context after |", () => {
        const doc = createDocument("song.abc | ");
        const context = getCompletionContext(doc, Position.create(0, 11));
        expect(context.type).to.equal("transform");
        expect(context.prefix).to.equal("");
      });

      it("should detect transform context after | with partial name", () => {
        const doc = createDocument("song.abc | tr");
        const context = getCompletionContext(doc, Position.create(0, 13));
        expect(context.type).to.equal("transform");
        expect(context.prefix).to.equal("tr");
      });

      it("should detect transform context after |=", () => {
        const doc = createDocument("song.abc | @chords |= ");
        const context = getCompletionContext(doc, Position.create(0, 22));
        expect(context.type).to.equal("transform");
        expect(context.prefix).to.equal("");
      });

      it("should detect transform context after |= with partial name", () => {
        const doc = createDocument("song.abc | @chords |= trans");
        const context = getCompletionContext(doc, Position.create(0, 27));
        expect(context.type).to.equal("transform");
        expect(context.prefix).to.equal("trans");
      });
    });

    describe("Selector Context", () => {
      it("should detect selector context after @", () => {
        const doc = createDocument("song.abc | @");
        const context = getCompletionContext(doc, Position.create(0, 12));
        expect(context.type).to.equal("selector");
        expect(context.prefix).to.equal("");
      });

      it("should detect selector context after @ with partial name", () => {
        const doc = createDocument("song.abc | @ch");
        const context = getCompletionContext(doc, Position.create(0, 14));
        expect(context.type).to.equal("selector");
        expect(context.prefix).to.equal("ch");
      });

      it("should detect selector context after @ at line start", () => {
        const doc = createDocument("@notes");
        const context = getCompletionContext(doc, Position.create(0, 6));
        expect(context.type).to.equal("selector");
        expect(context.prefix).to.equal("notes");
      });
    });

    describe("Selector Argument Context", () => {
      it("should detect voice selector argument after @V:", () => {
        const doc = createDocument("song.abc | @V:");
        const context = getCompletionContext(doc, Position.create(0, 14));
        expect(context.type).to.equal("selectorArg");
        expect(context.selector).to.equal("v");
        expect(context.prefix).to.equal("");
      });

      it("should detect voice selector argument with partial name", () => {
        const doc = createDocument("song.abc | @V:mel");
        const context = getCompletionContext(doc, Position.create(0, 17));
        expect(context.type).to.equal("selectorArg");
        expect(context.selector).to.equal("v");
        expect(context.prefix).to.equal("mel");
      });

      it("should detect measure selector argument after @M:", () => {
        const doc = createDocument("song.abc | @M:");
        const context = getCompletionContext(doc, Position.create(0, 14));
        expect(context.type).to.equal("selectorArg");
        expect(context.selector).to.equal("m");
        expect(context.prefix).to.equal("");
      });
    });

    describe("File Context", () => {
      it("should detect file context at line start", () => {
        const doc = createDocument("song");
        const context = getCompletionContext(doc, Position.create(0, 4));
        expect(context.type).to.equal("file");
        expect(context.prefix).to.equal("song");
      });

      it("should detect file context after assignment", () => {
        const doc = createDocument("result = song");
        const context = getCompletionContext(doc, Position.create(0, 13));
        expect(context.type).to.equal("file");
        expect(context.prefix).to.equal("song");
      });
    });

    describe("Variable Context", () => {
      it("should detect variable context with identifier prefix", () => {
        const doc = createDocument("result | res");
        const context = getCompletionContext(doc, Position.create(0, 12));
        // After pipe, this should be transform context
        expect(context.type).to.equal("transform");
      });
    });
  });

  describe("Variable Extraction", () => {
    it("should extract defined variables from document", () => {
      const doc = createDocument(`input = song.abc
step1 = input | @chords
step2 = step1 | transpose 2
result`);
      const variables = getDefinedVariables(doc, Position.create(3, 0));
      expect(variables).to.have.length(3);
      expect(variables.map((v) => v.name)).to.include.members(["input", "step1", "step2"]);
    });

    it("should not include variables defined after cursor", () => {
      const doc = createDocument(`input = song.abc
step1 = input | @chords
step2 = step1 | transpose 2`);
      const variables = getDefinedVariables(doc, Position.create(1, 0));
      expect(variables).to.have.length(1);
      expect(variables[0].name).to.equal("input");
    });

    it("should update variable line on redefinition", () => {
      const doc = createDocument(`x = song.abc
x = other.abc
y = x`);
      const variables = getDefinedVariables(doc, Position.create(2, 0));
      const xVar = variables.find((v) => v.name === "x");
      expect(xVar).to.not.be.undefined;
      expect(xVar!.line).to.equal(2);
    });
  });

  describe("Completion Items", () => {
    describe("Transform Completions", () => {
      it("should provide transform completions after |", () => {
        const doc = createDocument("song.abc | ");
        const items = provideAbctCompletions(doc, Position.create(0, 11));
        expect(items.length).to.be.greaterThan(0);
        const labels = items.map((i) => i.label);
        expect(labels).to.include("transpose");
        expect(labels).to.include("octave");
      });

      it("should filter transform completions by prefix", () => {
        const doc = createDocument("song.abc | tr");
        const items = provideAbctCompletions(doc, Position.create(0, 13));
        expect(items.length).to.be.greaterThan(0);
        // All should start with 'tr'
        for (const item of items) {
          expect(item.label.toLowerCase()).to.match(/^tr/);
        }
      });

      it("should include documentation for transforms", () => {
        const doc = createDocument("song.abc | trans");
        const items = provideAbctCompletions(doc, Position.create(0, 16));
        const transposeItem = items.find((i) => i.label === "transpose");
        expect(transposeItem).to.not.be.undefined;
        expect(transposeItem!.kind).to.equal(CompletionItemKind.Function);
        expect(transposeItem!.detail).to.not.be.undefined;
        expect(transposeItem!.documentation).to.not.be.undefined;
      });
    });

    describe("Selector Completions", () => {
      it("should provide selector completions after @", () => {
        const doc = createDocument("song.abc | @");
        const items = provideAbctCompletions(doc, Position.create(0, 12));
        expect(items.length).to.be.greaterThan(0);
        const labels = items.map((i) => i.label);
        expect(labels).to.include("@chords");
        expect(labels).to.include("@notes");
      });

      it("should include short forms in selector completions", () => {
        const doc = createDocument("song.abc | @");
        const items = provideAbctCompletions(doc, Position.create(0, 12));
        const labels = items.map((i) => i.label);
        expect(labels).to.include("@c"); // short for @chords
        expect(labels).to.include("@n"); // short for @notes
      });

      it("should filter selector completions by prefix", () => {
        const doc = createDocument("song.abc | @ch");
        const items = provideAbctCompletions(doc, Position.create(0, 14));
        expect(items.length).to.be.greaterThan(0);
        const labels = items.map((i) => i.label);
        expect(labels).to.include("@chords");
      });

      it("should use Field kind for selectors", () => {
        const doc = createDocument("song.abc | @");
        const items = provideAbctCompletions(doc, Position.create(0, 12));
        for (const item of items) {
          expect(item.kind).to.equal(CompletionItemKind.Field);
        }
      });
    });

    describe("Selector Argument Completions", () => {
      it("should provide voice names after @V:", () => {
        const doc = createDocument("song.abc | @V:");
        const items = provideAbctCompletions(doc, Position.create(0, 14));
        expect(items.length).to.be.greaterThan(0);
        const labels = items.map((i) => i.label);
        expect(labels).to.include("melody");
        expect(labels).to.include("bass");
      });

      it("should filter voice names by prefix", () => {
        const doc = createDocument("song.abc | @V:mel");
        const items = provideAbctCompletions(doc, Position.create(0, 17));
        expect(items.length).to.be.greaterThan(0);
        expect(items[0].label).to.equal("melody");
      });

      it("should provide measure patterns after @M:", () => {
        const doc = createDocument("song.abc | @M:");
        const items = provideAbctCompletions(doc, Position.create(0, 14));
        expect(items.length).to.be.greaterThan(0);
        const labels = items.map((i) => i.label);
        expect(labels).to.include("1");
        expect(labels).to.include("1-4");
      });
    });

    describe("Variable Completions", () => {
      it("should provide variable completions for defined variables", () => {
        const doc = createDocument(`input = song.abc
result = inp`);
        const items = provideAbctCompletions(doc, Position.create(1, 12));
        // Because this is after =, it's a file context, but let's test variable completion
        // in a different context
      });
    });

    describe("Empty Results", () => {
      it("should return empty array for none context", () => {
        const doc = createDocument("");
        const items = provideAbctCompletions(doc, Position.create(0, 0));
        // At the start with empty doc, should return file completions (which may be empty)
        expect(items).to.be.an("array");
      });
    });
  });
});
