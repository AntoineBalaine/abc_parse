import assert from "assert";
import { describe, it } from "mocha";
import { ABCContext } from "../parsers/Context";
import { Ctx, isFileHeader } from "../parsers/scan2";

// Helper function to create a Ctx object for testing
function createCtx(source: string): Ctx {
  return new Ctx(source, new ABCContext());
}

describe("isFileHeader", () => {
  it("should return true for an empty file", () => {
    const ctx = createCtx("");
    const result = isFileHeader(ctx);
    assert.strictEqual(result, true);
  });

  it("should return true for a file with only header content", () => {
    const ctx = createCtx(`%%directive
%comment
T:Title
`);
    const result = isFileHeader(ctx);
    assert.strictEqual(result, true);
  });

  it("should return false for a file with tune header start", () => {
    const ctx = createCtx(`X:1
T:Title
`);
    const result = isFileHeader(ctx);
    assert.strictEqual(result, false);
  });

  it("should return true for a file with section break", () => {
    const ctx = createCtx(`Some text

More text`);
    const result = isFileHeader(ctx);
    assert.strictEqual(result, true);
  });

  it("should return false when current position is not 0", () => {
    const ctx = createCtx(`Some text`);
    ctx.current = 5; // Set current position to non-zero
    const result = isFileHeader(ctx);
    assert.strictEqual(result, false);
  });

  it("should return false when tune header start comes before section break", () => {
    const ctx = createCtx(`Some text
X:1
T:Title

More text`);
    const result = isFileHeader(ctx);
    assert.strictEqual(result, false);
  });

  it("should return true when section break comes before tune header start", () => {
    const ctx = createCtx(`Some text

X:1
T:Title
`);
    const result = isFileHeader(ctx);
    assert.strictEqual(result, true);
  });

  it("should handle complex file with multiple headers and breaks", () => {
    const ctx = createCtx(`%%directive
%comment
T:Title

X:1
T:Tune1
K:C

X:2
T:Tune2
K:G`);
    const result = isFileHeader(ctx);
    assert.strictEqual(result, true);
  });
});
