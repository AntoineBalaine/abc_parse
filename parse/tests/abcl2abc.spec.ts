import { expect } from "chai";
import { ABCContext } from "../parsers/Context";
import { AbcErrorReporter } from "../parsers/ErrorReporter";
import { abclToAbc, convertFileToDeferred } from "../abcl";
import { Scanner } from "../parsers/scan2";
import { parse } from "../parsers/parse2";
import { AbcFormatter } from "../Visitors/Formatter2";
import { Tune } from "../types/Expr2";

function createCtx(): ABCContext {
  return new ABCContext(new AbcErrorReporter());
}

/**
 * Normalize ABC output for comparison:
 * - Trim each line
 * - Remove empty lines
 * - Join with newlines
 */
function normalize(abc: string): string {
  return abc
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

describe("ABCL to ABC Converter", () => {
  describe("Basic conversion examples", () => {
    it("should insert X rest when V:2 is missing from second row", () => {
      const input = `X:1
T:Test
K:C
V:1
abcd|
dfca|
V:2
abde|
defg`;

      const expected = `X:1
T:Test
K:C
V:1
abcd|
V:2
X|
V:1
dfca|
V:2
abde|
V:1
X
V:2
defg`;

      const ctx = new ABCContext();
      const tokens = Scanner(input, ctx);
      const ast = parse(tokens, ctx, { linear: true });

      const systems = (ast.contents[0] as unknown as Tune).tune_body?.sequence;
      expect(systems).to.have.lengthOf(3);

      const astDeferred = convertFileToDeferred(ast, ctx);

      const formatter = new AbcFormatter(ctx);
      const fmt = formatter.stringify(astDeferred);
      expect(normalize(fmt)).to.equal(normalize(expected));
    });

    it("should insert X rest when V:1 is missing from second row", () => {
      const input = `X:1
T:Test
K:C
V:1
abcd|
V:2
efga|
bcde|`;

      const expected = `X:1
T:Test
K:C
V:1
abcd|
V:2
efga|
V:1
X|
V:2
bcde|`;

      const ctx = createCtx();
      const result = abclToAbc(input, ctx);
      expect(normalize(result)).to.equal(normalize(expected));
    });

    it("should handle three voices with unequal lines", () => {
      const input = `X:1
T:Test
K:C
V:1
C|
D|
V:2
E|
V:3
F|
G|`;

      const expected = `X:1
T:Test
K:C
V:1
C|
V:2
X|
V:3
X|
V:1
D|
V:2
E|
V:3
F|
V:1
X|
V:2
X|
V:3
G|`;

      const ctx = createCtx();
      const result = abclToAbc(input, ctx);
      expect(normalize(result)).to.equal(normalize(expected));
    });

    it("should handle voice appearing late (backfill with X rests)", () => {
      const input = `X:1
T:Test
K:C
V:1
C|
D|
V:2
E|
F|
V:3
G|`;

      // V:3 appears late, so row 1 needs V:3 with X rest
      const expected = `X:1
T:Test
K:C
V:1
C|
V:2
X|
V:3
X|
V:1
D|
V:2
E|
V:3
X|
V:1
X|
V:2
F|
V:3
G|`;

      const ctx = createCtx();
      const result = abclToAbc(input, ctx);
      expect(normalize(result)).to.equal(normalize(expected));
    });
  });

  describe("Single voice passthrough", () => {
    it("should pass through single voice without modification", () => {
      const input = `X:1
T:Test
K:C
CDEF|GABc|`;

      const expected = `X:1
T:Test
K:C
CDEF|GABc|`;

      const ctx = createCtx();
      const result = abclToAbc(input, ctx);
      expect(normalize(result)).to.equal(normalize(expected));
    });
  });

  describe("Voice order preservation", () => {
    it("should preserve voice discovery order", () => {
      const input = `X:1
T:Test
K:C
V:2
D|
V:1
C|`;

      // Voice 2 was discovered first, so it comes first in output
      const expected = `X:1
T:Test
K:C
V:2
D|
V:1
C|`;

      const ctx = createCtx();
      const result = abclToAbc(input, ctx);
      expect(normalize(result)).to.equal(normalize(expected));
    });
  });

  describe("Complex multi-line scenarios", () => {
    it("should handle V:1 with 3 lines, V:2 with 1 line", () => {
      const input = `X:1
T:Test
K:C
V:1
C|
D|
E|
V:2
F|`;

      const expected = `X:1
T:Test
K:C
V:1
C|
V:2
X|
V:1
D|
V:2
X|
V:1
E|
V:2
F|`;

      const ctx = createCtx();
      const result = abclToAbc(input, ctx);
      expect(normalize(result)).to.equal(normalize(expected));
    });

    it("should handle V:1 with 1 line, V:2 with 3 lines", () => {
      const input = `X:1
T:Test
K:C
V:1
C|
V:2
D|
E|
F|`;

      const expected = `X:1
T:Test
K:C
V:1
C|
V:2
D|
V:1
X|
V:2
E|
V:1
X|
V:2
F|`;

      const ctx = createCtx();
      const result = abclToAbc(input, ctx);
      expect(normalize(result)).to.equal(normalize(expected));
    });

    it("should handle multiple systems (voice cycles)", () => {
      const input = `X:1
T:Test
K:C
V:1
C|
V:2
D|
V:1
E|
V:2
F|
V:1
G|
V:2
A|`;

      const expected = `X:1
T:Test
K:C
V:1
C|
V:2
D|
V:1
E|
V:2
F|
V:1
G|
V:2
A|`;

      const ctx = createCtx();
      const result = abclToAbc(input, ctx);
      expect(normalize(result)).to.equal(normalize(expected));
    });
  });

  describe("Edge cases", () => {
    it("should handle empty tune body", () => {
      const input = `X:1
T:Test
K:C`;

      const ctx = createCtx();
      const result = abclToAbc(input, ctx);

      expect(result).to.include("X:1");
      expect(result).to.include("T:Test");
      expect(result).to.include("K:C");
    });
  });
});
