import { assert } from "chai";
import { describe, it } from "mocha";
import { ABCContext } from "../parsers/Context";
import { ParseCtx, parseTune } from "../parsers/parse2";
import { Scanner } from "../parsers/scan2";
import { AbcFormatter } from "../Visitors/Formatter2";

describe("ErrorExpr Preservation in Formatter", () => {
  it("should preserve invalid tokens in the formatter output", () => {
    // Create a simple tune with an invalid token
    const source = "X:1\nA ~123 B";
    const abcContext = new ABCContext();
    const tokens = Scanner(source, abcContext);

    // Parse the tune
    const parseCtx = new ParseCtx(tokens, abcContext);
    const tune = parseTune(parseCtx);

    // Format the tune
    const formatter = new AbcFormatter(abcContext);
    const formatted = formatter.format(tune);

    // Verify that the invalid token is preserved in the output
    assert.include(formatted, "~123", "Invalid token should be preserved in the formatter output");
  });

  it("should preserve invalid tokens in multi-voice context", () => {
    const input = `X:1\n[V:1]abc ~123 |\n[V:2]def \\e |\n`;
    const abcContext = new ABCContext();
    const formatter = new AbcFormatter(abcContext);
    const tokens = Scanner(input, abcContext);
    const parseCtx = new ParseCtx(tokens, abcContext);
    const ast = parseTune(parseCtx);

    const result = formatter.format(ast);

    // Verify that both invalid tokens are preserved
    assert.include(result, "~123", "First invalid token should be preserved");
    assert.include(result, "\\e", "Second invalid token should be preserved");
  });
});
