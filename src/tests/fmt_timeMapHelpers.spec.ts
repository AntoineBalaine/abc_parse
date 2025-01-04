import { assert } from "chai";
import { isInfo_line, isToken, isComment } from "../helpers";
import { ABCContext } from "../parsers/Context";
import { Parser } from "../parsers/Parser";
import { Scanner } from "../parsers/Scanner";
import { System, TokenType } from "../types/types";
import { splitLines } from "../Visitors/fmt/fmt_timeMapHelpers";

/**
 * TODO: remove this stuff, it’s so overkill
 */
describe("splitSystem", () => {
  let ctx: ABCContext;

  beforeEach(() => {
    ctx = new ABCContext();
  });

  function parseSystem(input: string): System {
    const scanner = new Scanner(input, ctx);
    const tokens = scanner.scanTokens();
    const parser = new Parser(tokens, ctx);
    const ast = parser.parse();
    if (!ast) {
      throw new Error("Failed to parse");
    }
    return ast.tune[0].tune_body!.sequence[0];
  }

  it("one line per voice marker", () => {
    const system = parseSystem(`
X:1
V:1
V:2
V:1
CDEF|
V:2
GABC|`);

    const result = splitLines(system);
    assert.equal(result.length, 4, "Should split into two lines");
  });

  it("splits at EOL tokens", () => {
    const system = parseSystem(`
X:1
CDEF|
GABC|`);

    const result = splitLines(system);
    assert.equal(result.length, 2, "Should split into two lines");
  });

  it("splits at comments", () => {
    const system = parseSystem(`
X:1
V:1
V:2
P:help
[V:1] CDEF|
% comment
[V:2] GABC|`);

    const result = splitLines(system);

    assert.equal(result.length, 3, "Should split into three lines");
  });

  it("keeps content between splits", () => {
    const system = parseSystem(`
X:1
V:1
V:2
V:1
CDEF| GABC|
V:2
ABCD| EFGA|`);

    const result = splitLines(system);
    assert.equal(result.length, 4, "Should split into two parts");
  });

  it("handles multiple consecutive splits", () => {
    const system = parseSystem(`
X:1
V:1
V:2
V:1
% comment 1
CDEF|
% comment 2
V:2
GBB|`);

    const result = splitLines(system);
    assert.equal(result.length, 6, "Should split into three parts");
  });
});
