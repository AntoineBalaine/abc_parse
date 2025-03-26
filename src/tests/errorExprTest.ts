import { assert } from "chai";
import { describe, it } from "mocha";
import { ABCContext } from "../parsers/Context";
import { parseTune } from "../parsers/parse2";
import { Scanner2 } from "../parsers/scan2";
import { AbcFormatter2 } from "../Visitors/Formatter2";

describe("ErrorExpr Preservation in Formatter", () => {
  it("should preserve invalid tokens in the formatter output", () => {
    // Create a simple tune with an invalid token
    const source = "X:1\nA ~123 B";
    const abcContext = new ABCContext();
    const tokens = Scanner2(source, abcContext);

    // Parse the tune
    const tune = parseTune(tokens, abcContext);

    // Format the tune
    const formatter = new AbcFormatter2(abcContext);
    const formatted = formatter.format(tune);

    // Verify that the invalid token is preserved in the output
    assert.include(formatted, "~123", "Invalid token should be preserved in the formatter output");
  });

  it("should preserve invalid tokens in multi-voice context", () => {
    const input = `X:1\n[V:1]abc ~123 |\n[V:2]def \\e |\n`;
    const abcContext = new ABCContext();
    const formatter = new AbcFormatter2(abcContext);
    const tokens = Scanner2(input, abcContext);
    const ast = parseTune(tokens, abcContext);

    const result = formatter.format(ast);

    // Verify that both invalid tokens are preserved
    assert.include(result, "~123", "First invalid token should be preserved");
    assert.include(result, "\\e", "Second invalid token should be preserved");
  });
});
