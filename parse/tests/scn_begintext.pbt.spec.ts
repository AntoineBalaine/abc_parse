import { assert } from "chai";
import { describe, it } from "mocha";
import { ABCContext } from "../parsers/Context";
import { Scanner, TT } from "../parsers/scan";

describe("Scanner Example-Based: Text Directive (%%begintext)", () => {
  it("should scan complete begintext/endtext block", () => {
    const input = `%%begintext
This is some free text.
It can span multiple lines.
%%endtext`;

    const ctx = new ABCContext();
    const tokens = Scanner(input, ctx);

    // Should have: STYLESHEET_DIRECTIVE, IDENTIFIER("begintext"), FREE_TXT, STYLESHEET_DIRECTIVE, IDENTIFIER("endtext")
    assert.equal(tokens[0].type, TT.STYLESHEET_DIRECTIVE);
    assert.equal(tokens[1].type, TT.IDENTIFIER);
    assert.equal(tokens[1].lexeme, "begintext");
    assert.equal(tokens[2].type, TT.FREE_TXT);
    assert.equal(tokens[2].lexeme, "This is some free text.\nIt can span multiple lines.");
    assert.equal(tokens[3].type, TT.STYLESHEET_DIRECTIVE);
    assert.equal(tokens[4].type, TT.IDENTIFIER);
    assert.equal(tokens[4].lexeme, "endtext");
  });

  it("should scan begintext block without endtext (EOF)", () => {
    const input = `%%begintext
This text block has no end marker.
It continues until EOF.`;

    const ctx = new ABCContext();
    const tokens = Scanner(input, ctx);

    // Should have: STYLESHEET_DIRECTIVE, IDENTIFIER("begintext"), FREE_TXT (no endtext)
    assert.equal(tokens[0].type, TT.STYLESHEET_DIRECTIVE);
    assert.equal(tokens[1].type, TT.IDENTIFIER);
    assert.equal(tokens[1].lexeme, "begintext");
    assert.equal(tokens[2].type, TT.FREE_TXT);
    assert.equal(tokens[2].lexeme, "This text block has no end marker.\nIt continues until EOF.");

    // Should not have endtext tokens
    const hasEndText = tokens.some((t) => t.lexeme === "endtext");
    assert.isFalse(hasEndText);
  });

  it("should handle empty text block", () => {
    const input = `%%begintext
%%endtext`;

    const ctx = new ABCContext();
    const tokens = Scanner(input, ctx);

    assert.equal(tokens[0].type, TT.STYLESHEET_DIRECTIVE);
    assert.equal(tokens[1].type, TT.IDENTIFIER);
    assert.equal(tokens[1].lexeme, "begintext");
    assert.equal(tokens[2].type, TT.FREE_TXT);
    assert.equal(tokens[2].lexeme, "");
    assert.equal(tokens[3].type, TT.STYLESHEET_DIRECTIVE);
    assert.equal(tokens[4].type, TT.IDENTIFIER);
    assert.equal(tokens[4].lexeme, "endtext");
  });

  it("should handle single line text", () => {
    const input = `%%begintext
Just one line.
%%endtext`;

    const ctx = new ABCContext();
    const tokens = Scanner(input, ctx);
    const freeTextToken = tokens.find((t) => t.type === TT.FREE_TXT);

    assert.exists(freeTextToken);
    assert.equal(freeTextToken!.lexeme, "Just one line.");
  });

  it("should preserve multiple line breaks", () => {
    const input = `%%begintext
Line one.

Line three (with blank line above).
%%endtext`;

    const ctx = new ABCContext();
    const tokens = Scanner(input, ctx);
    const freeTextToken = tokens.find((t) => t.type === TT.FREE_TXT);

    assert.exists(freeTextToken);
    assert.equal(freeTextToken!.lexeme, "Line one.\n\nLine three (with blank line above).");
  });

  it("should be case-insensitive for directive names", () => {
    const input = `%%BeginText
Mixed case text.
%%EndText`;

    const ctx = new ABCContext();
    const tokens = Scanner(input, ctx);

    assert.equal(tokens[0].type, TT.STYLESHEET_DIRECTIVE);
    assert.equal(tokens[1].type, TT.IDENTIFIER);
    assert.equal(tokens[1].lexeme, "BeginText");
    assert.equal(tokens[2].type, TT.FREE_TXT);
    assert.equal(tokens[2].lexeme, "Mixed case text.");
    assert.equal(tokens[3].type, TT.STYLESHEET_DIRECTIVE);
    assert.equal(tokens[4].type, TT.IDENTIFIER);
    assert.equal(tokens[4].lexeme, "EndText");
  });

  it("should handle text containing %% that is not endtext", () => {
    const input = `%%begintext
This line has %% in it.
%%MIDI program 1
%%endtext`;

    const ctx = new ABCContext();
    const tokens = Scanner(input, ctx);
    const freeTextToken = tokens.find((t) => t.type === TT.FREE_TXT);

    assert.exists(freeTextToken);
    assert.equal(freeTextToken!.lexeme, "This line has %% in it.\n%%MIDI program 1");
  });
});
