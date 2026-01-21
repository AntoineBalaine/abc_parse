// ABCT Hover Provider Tests
// Tests for hover documentation functionality

import { expect } from "chai";
import { Position } from "vscode-languageserver";
import { scan } from "../src/scanner";
import { parse } from "../src/parser/parser";
import { AbctContext } from "../src/context";
import { provideHover } from "../../abc-lsp-server/src/abct/AbctHoverProvider";

describe("ABCT Hover Provider", () => {
  // Helper to parse and get hover at a specific position (0-based)
  function getHover(source: string, line: number, character: number) {
    const ctx = new AbctContext();
    const tokens = scan(source, ctx);
    const program = parse(tokens, ctx);
    if (ctx.errorReporter.hasErrors()) {
      const errors = ctx.errorReporter.getErrors();
      throw new Error(`Failed to parse: ${errors[0].message}`);
    }
    const position: Position = { line, character };
    return provideHover(program, position);
  }

  // Helper to get hover content as string
  function getHoverContent(source: string, line: number, character: number): string | null {
    const hover = getHover(source, line, character);
    if (!hover || !hover.contents) {
      return null;
    }
    if (typeof hover.contents === "string") {
      return hover.contents;
    }
    if ("value" in hover.contents) {
      return hover.contents.value;
    }
    return null;
  }

  describe("Transform Hover", () => {
    it("should show documentation for transpose transform", () => {
      const content = getHoverContent("transpose 2", 0, 2);
      expect(content).to.not.be.null;
      expect(content).to.include("transpose");
      expect(content).to.include("semitones");
    });

    it("should show documentation for octave transform", () => {
      const content = getHoverContent("octave 1", 0, 2);
      expect(content).to.not.be.null;
      expect(content).to.include("octave");
    });

    it("should show documentation for retrograde transform", () => {
      const content = getHoverContent("retrograde", 0, 2);
      expect(content).to.not.be.null;
      expect(content).to.include("retrograde");
      expect(content).to.include("reverse");
    });

    it("should show documentation for bass transform", () => {
      const content = getHoverContent("bass", 0, 2);
      expect(content).to.not.be.null;
      expect(content).to.include("bass");
    });

    it("should show transform hover in pipeline context", () => {
      const content = getHoverContent("src.abc | @notes |= transpose 2", 0, 22);
      expect(content).to.not.be.null;
      expect(content).to.include("transpose");
    });
  });

  describe("Selector Hover", () => {
    it("should show documentation for @chords selector", () => {
      const content = getHoverContent("src.abc | @chords", 0, 11);
      expect(content).to.not.be.null;
      expect(content).to.include("chords");
    });

    it("should show documentation for @notes selector", () => {
      const content = getHoverContent("src.abc | @notes", 0, 11);
      expect(content).to.not.be.null;
      expect(content).to.include("notes");
    });

    it("should show documentation for short form @c selector", () => {
      const content = getHoverContent("src.abc | @c", 0, 11);
      expect(content).to.not.be.null;
      expect(content).to.include("chords");
    });

    it("should show documentation for short form @n selector", () => {
      const content = getHoverContent("src.abc | @n", 0, 11);
      expect(content).to.not.be.null;
      expect(content).to.include("notes");
    });
  });

  describe("Operator Hover", () => {
    it("should show documentation for | (pipe) operator", () => {
      const content = getHoverContent("src.abc | @chords", 0, 8);
      expect(content).to.not.be.null;
      expect(content).to.include("pipe");
    });

    it("should show documentation for |= (update) operator", () => {
      const content = getHoverContent("@chords |= transpose 2", 0, 8);
      expect(content).to.not.be.null;
      expect(content).to.include("update");
    });

    it("should show documentation for + (concat) operator", () => {
      const content = getHoverContent("a.abc + b.abc", 0, 6);
      expect(content).to.not.be.null;
      expect(content).to.include("concat");
    });

    it("should show documentation for = (assignment) operator", () => {
      const content = getHoverContent("x = src.abc", 0, 2);
      expect(content).to.not.be.null;
      expect(content).to.include("assignment");
    });

    it("should show documentation for @ (selector) symbol", () => {
      const content = getHoverContent("src.abc | @chords", 0, 10);
      expect(content).to.not.be.null;
      expect(content).to.include("selector");
    });

    it("should show documentation for or keyword", () => {
      const content = getHoverContent("a or b", 0, 2);
      expect(content).to.not.be.null;
      expect(content).to.include("or");
    });

    it("should show documentation for and keyword", () => {
      const content = getHoverContent("a and b", 0, 2);
      expect(content).to.not.be.null;
      expect(content).to.include("and");
    });

    it("should show documentation for not keyword", () => {
      const content = getHoverContent("not a", 0, 1);
      expect(content).to.not.be.null;
      expect(content).to.include("not");
    });
  });

  describe("Variable Hover", () => {
    it("should show definition location for variable reference", () => {
      const source = `source = song.abc
result = source | transpose 2`;
      const content = getHoverContent(source, 1, 10);
      expect(content).to.not.be.null;
      expect(content).to.include("source");
      expect(content).to.include("variable");
      expect(content).to.include("line 1");
    });

    it("should not show variable hover at definition site", () => {
      const source = `source = song.abc
result = source | transpose 2`;
      // Hovering over 'source' at its definition - should not show variable hover
      // but might show nothing or something else
      const hover = getHover(source, 0, 2);
      // At definition site, if it's not a known transform, it shouldn't show variable hover
      if (hover) {
        const content = getHoverContent(source, 0, 2);
        // Should not say "Defined at line 1" since we're AT the definition
        expect(content).to.not.include("Defined at line 1");
      }
    });
  });

  describe("No Hover Cases", () => {
    it("should return null for unknown identifiers", () => {
      const hover = getHover("unknownTransform 5", 0, 5);
      // Unknown transforms without transform info should return null
      expect(hover).to.be.null;
    });

    it("should return null for whitespace", () => {
      const source = "a   b";
      const hover = getHover(source, 0, 2);
      // Position in whitespace between identifiers
      expect(hover).to.be.null;
    });

    it("should return null for file references", () => {
      // File references don't have special hover documentation
      const hover = getHover("song.abc", 0, 2);
      expect(hover).to.be.null;
    });

    it("should return null for number literals", () => {
      const hover = getHover("transpose 12", 0, 11);
      expect(hover).to.be.null;
    });
  });

  describe("Complex Expressions", () => {
    it("should show hover in nested pipeline", () => {
      const content = getHoverContent("src.abc | @chords |= (transpose 2 | retrograde)", 0, 23);
      expect(content).to.not.be.null;
      expect(content).to.include("transpose");
    });

    it("should show hover for selector in update expression", () => {
      const content = getHoverContent("src.abc | @chords |= transpose 2", 0, 11);
      expect(content).to.not.be.null;
      expect(content).to.include("chords");
    });
  });
});
