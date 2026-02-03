import { expect } from "chai";
import { ABCContext } from "../parsers/Context";
import { Token, TT } from "../parsers/scan2";
import { Comment, System } from "../types/Expr2";
import { hasCommentAtBoundary } from "../Visitors/Formatter2";

describe("hasCommentAtBoundary", () => {
  function createToken(type: TT, lexeme: string): Token {
    const ctx = new ABCContext();
    return new Token(type, lexeme, ctx.generateId());
  }

  function createComment(lexeme: string): Comment {
    const ctx = new ABCContext();
    return new Comment(ctx.generateId(), new Token(TT.COMMENT, lexeme, ctx.generateId()));
  }

  describe("boundary: start", () => {
    it("returns false for empty system", () => {
      const system: System = [];
      expect(hasCommentAtBoundary(system, "start")).to.equal(false);
    });

    it("returns true when first element is empty comment (%)", () => {
      const system: System = [createComment("%")];
      expect(hasCommentAtBoundary(system, "start")).to.equal(true);
    });

    it("returns true when first element is whitespace-only comment (% )", () => {
      const system: System = [createComment("%  ")];
      expect(hasCommentAtBoundary(system, "start")).to.equal(true);
    });

    it("returns false when first element is comment with text", () => {
      const system: System = [createComment("% This is a comment")];
      expect(hasCommentAtBoundary(system, "start")).to.equal(false);
    });

    it("returns true when empty comment follows whitespace", () => {
      const system: System = [
        createToken(TT.WS, " "),
        createComment("%")
      ];
      expect(hasCommentAtBoundary(system, "start")).to.equal(true);
    });

    it("returns false when first non-whitespace is not a comment", () => {
      const system: System = [
        createToken(TT.WS, " "),
        createToken(TT.NOTE_LETTER, "C")
      ];
      expect(hasCommentAtBoundary(system, "start")).to.equal(false);
    });

    it("returns true when empty comment follows EOL", () => {
      const system: System = [
        createToken(TT.EOL, "\n"),
        createComment("%")
      ];
      expect(hasCommentAtBoundary(system, "start")).to.equal(true);
    });
  });

  describe("boundary: end", () => {
    it("returns false for empty system", () => {
      const system: System = [];
      expect(hasCommentAtBoundary(system, "end")).to.equal(false);
    });

    it("returns true when last element is empty comment (%)", () => {
      const system: System = [createComment("%")];
      expect(hasCommentAtBoundary(system, "end")).to.equal(true);
    });

    it("returns true when last element is whitespace-only comment (% )", () => {
      const system: System = [createComment("%  ")];
      expect(hasCommentAtBoundary(system, "end")).to.equal(true);
    });

    it("returns false when last element is comment with text", () => {
      const system: System = [createComment("% This is a comment")];
      expect(hasCommentAtBoundary(system, "end")).to.equal(false);
    });

    it("returns true when empty comment is before trailing whitespace", () => {
      const system: System = [
        createComment("%"),
        createToken(TT.WS, " ")
      ];
      expect(hasCommentAtBoundary(system, "end")).to.equal(true);
    });

    it("returns true when empty comment is before trailing EOL", () => {
      const system: System = [
        createComment("%"),
        createToken(TT.EOL, "\n")
      ];
      expect(hasCommentAtBoundary(system, "end")).to.equal(true);
    });

    it("returns false when last non-whitespace is not a comment", () => {
      const system: System = [
        createToken(TT.NOTE_LETTER, "C"),
        createToken(TT.EOL, "\n")
      ];
      expect(hasCommentAtBoundary(system, "end")).to.equal(false);
    });

    it("returns true when empty comment is before multiple trailing whitespace/EOL", () => {
      const system: System = [
        createComment("%"),
        createToken(TT.WS, " "),
        createToken(TT.EOL, "\n")
      ];
      expect(hasCommentAtBoundary(system, "end")).to.equal(true);
    });
  });

  describe("edge cases", () => {
    it("handles system with only whitespace", () => {
      const system: System = [
        createToken(TT.WS, " "),
        createToken(TT.EOL, "\n")
      ];
      expect(hasCommentAtBoundary(system, "start")).to.equal(false);
      expect(hasCommentAtBoundary(system, "end")).to.equal(false);
    });

    it("handles comment with just percent sign and newline in content", () => {
      // Some parsers might include the newline in the comment
      const system: System = [createComment("%\n")];
      expect(hasCommentAtBoundary(system, "start")).to.equal(true);
      expect(hasCommentAtBoundary(system, "end")).to.equal(true);
    });
  });
});
