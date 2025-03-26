import { assert } from "chai";
import { isToken } from "../helpers2";
import { ABCContext } from "../parsers/Context";
import { parseTune } from "../parsers/parse2";
import { Scanner2, TT } from "../parsers/scan2";
import { System } from "../types/Expr2";
import { splitLines } from "../Visitors/fmt2/fmt_timeMapHelpers";

describe("splitSystem (fmt2)", () => {
  let ctx: ABCContext;

  beforeEach(() => {
    ctx = new ABCContext();
  });

  function parseSystem(input: string): System {
    const tokens = Scanner2(input, ctx);
    const ast = parseTune(tokens, ctx);
    if (!ast) {
      throw new Error("Failed to parse");
    }
    return ast.tune_body!.sequence[0];
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
    assert.equal(result.length, 4, "Should split into four lines");
  });

  it("splits at EOL tokens", () => {
    const system = parseSystem(`
X:1
V:1
V:2
V:1
CDEF|
V:2
GABC|`);

    const result = splitLines(system);
    assert.equal(result.length, 4, "Should split into four lines");
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
    assert.equal(result.length, 4, "Should split into four parts");
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
    assert.equal(result.length, 6, "Should split into six parts");
  });

  it("handles EOL tokens correctly", () => {
    const system = parseSystem(`
X:1
V:1
CDEF|
GABC|`);

    const result = splitLines(system);

    // Check that each split ends with an EOL token
    result.forEach((split, index) => {
      if (index < result.length - 1) {
        // Skip the last split if it doesn't end with EOL
        const lastNode = split[split.length - 1];
        assert.isTrue(isToken(lastNode) && lastNode.type === TT.EOL, `Split ${index} should end with EOL token`);
      }
    });
  });
});
