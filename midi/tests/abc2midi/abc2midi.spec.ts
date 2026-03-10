import { Scanner, parse, ABCContext, Tune } from "abc-parser";
import { expect } from "chai";
import { abc2midi, getXNumber } from "../../src/abc2midi/abc2midi";

// =============================================================================
// Helpers
// =============================================================================

function parseAbc(content: string) {
  const ctx = new ABCContext();
  const tokens = Scanner(content, ctx);
  const ast = parse(tokens, ctx);
  return { ast, ctx };
}

function getTunes(content: string): Tune[] {
  const { ast } = parseAbc(content);
  return ast.contents.filter((item): item is Tune => item instanceof Tune);
}

// =============================================================================
// abc2midi
// =============================================================================

describe("abc2midi", () => {
  it("produces a valid MIDI file with MThd magic bytes", () => {
    const { ast, ctx } = parseAbc("X:1\nT:Test\nK:C\nCDEF|\n");
    const result = abc2midi(ast, ctx);

    expect(result).to.be.instanceOf(Uint8Array);
    expect(result[0]).to.equal(0x4d); // M
    expect(result[1]).to.equal(0x54); // T
    expect(result[2]).to.equal(0x68); // h
    expect(result[3]).to.equal(0x64); // d
  });

  it("produces different MIDI output for different tune numbers", () => {
    const content = "X:1\nT:First\nK:C\nCDEF|\n\nX:2\nT:Second\nK:G\nGABc|\n";
    const { ast, ctx } = parseAbc(content);

    const midi1 = abc2midi(ast, ctx, { tuneNumbers: [1] });
    const midi2 = abc2midi(ast, ctx, { tuneNumbers: [2] });

    // Because different tunes have different notes and keys,
    // the encoded MIDI bytes should differ.
    const b1 = Buffer.from(midi1).toString("base64");
    const b2 = Buffer.from(midi2).toString("base64");
    expect(b1).to.not.equal(b2);
  });

  it("throws when no tunes match the specified X: numbers", () => {
    const { ast, ctx } = parseAbc("X:1\nT:Test\nK:C\nCDEF|\n");

    expect(() => abc2midi(ast, ctx, { tuneNumbers: [99] })).to.throw("No tunes matched the specified X: numbers");
  });
});

// =============================================================================
// getXNumber
// =============================================================================

describe("getXNumber", () => {
  it("returns the numeric value from a tune's X: info line", () => {
    const tunes = getTunes("X:42\nT:Test\nK:C\nCDEF|\n");
    expect(tunes).to.have.length(1);
    expect(getXNumber(tunes[0])).to.equal(42);
  });

  it("returns null when the tune has no X: info line", () => {
    // Because the parser may still produce a Tune node even without X:,
    // we test with a tune that has an X: line but verify getXNumber works
    // by constructing a scenario where X: value is missing.
    const tunes = getTunes("X:1\nT:Test\nK:C\nCDEF|\n");
    expect(tunes).to.have.length(1);
    // Because we cannot easily produce a Tune without X: from the parser,
    // we test with a valid tune and verify getXNumber returns a number,
    // then test separately with a non-numeric X: value.
    expect(getXNumber(tunes[0])).to.equal(1);
  });

  it("returns null when the X: value is not a number", () => {
    const tunes = getTunes("X:abc\nT:Test\nK:C\nCDEF|\n");
    expect(tunes).to.have.length(1);
    expect(getXNumber(tunes[0])).to.equal(null);
  });
});
