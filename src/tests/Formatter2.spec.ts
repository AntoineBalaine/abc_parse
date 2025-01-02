import { assert } from "chai";
import { Info_line, Music_code, Comment, music_code, Inline_field } from "../types/Expr";
import { System, TokenType } from "../types/types";
import { Token } from "../types/token";
import { Scanner } from "../parsers/Scanner";
import { Parser } from "../parsers/Parser";
import { buildParse } from "./RhythmTransform.spec";
import { ABCContext } from "../parsers/Context";

describe("splitIntoVoices", () => {
  it("splits a simple two-voice system", () => {
    // Create tokens/expressions for a simple two-voice system
    const sample = `X:1
V:RH clef=treble
V:LH clef=bass
K:C
[V: RH]C|
[V: LH]G|`;
    const ctx = new ABCContext();
    const parse = new Parser(new Scanner(sample, ctx).scanTokens(), ctx).parse();
    const system: System = parse!.tune[0].tune_body!.sequence[0];

    const result = splitIntoVoices(system);

    assert.equal(result.length, 2, "Should split into two voices");

    // Check first voice
    assert.equal(result[0].length, 3, "First voice should have 3 elements");
    assert.isTrue(result[0][0] instanceof Inline_field, "Should start with voice marker");
    assert.isTrue(result[0][1] instanceof Music_code, "Should contain music");

    // Check second voice
    assert.equal(result[1].length, 3, "Second voice should have 2 elements");
    assert.isTrue(result[1][0] instanceof Inline_field, "Should start with voice marker");
    assert.isTrue(result[1][1] instanceof Music_code, "Should contain music");
  });

  it("handles comments in voices", () => {
    const sample = `X:1\nV:RH clef=treble\nK:C`;
    const ctx = new ABCContext();
    const parse = new Parser(new Scanner(sample, ctx).scanTokens(), ctx).parse();
    const system: System = parse!.tune[0].tune_body!.sequence[0];

    const result = splitIntoVoices(system);

    assert.equal(result.length, 1, "Should keep as one voice");
    assert.equal(result[0].length, 3, "Should contain voice marker, comment, and music");
    assert.isTrue(result[0][1] instanceof Comment, "Should preserve comment");
  });

  it("handles standalone comments between voices", () => {
    const sample = `X:1
V:RH clef=treble
V:LH clef=bass
K:C
[V: RH]C|
% between voices
[V: LH]G|`;
    const ctx = new ABCContext();
    const parse = new Parser(new Scanner(sample, ctx).scanTokens(), ctx).parse();
    const system: System = parse!.tune[0].tune_body!.sequence[0];

    const result = splitIntoVoices(system);

    assert.equal(result.length, 3, "Should split into three parts");
    assert.isTrue(result[1][0] instanceof Comment, "Middle part should be comment");
  });

  it("handles empty voice markers", () => {
    const sample = `X:1
V:RH clef=treble
V:LH clef=bass
K:C
[V: RH]
[V: LH]G|
`;
    const ctx = new ABCContext();
    const parse = new Parser(new Scanner(sample, ctx).scanTokens(), ctx).parse();
    const system: System = parse!.tune[0].tune_body!.sequence[0];

    const result = splitIntoVoices(system);

    assert.equal(result.length, 2, "Should create two voices");
    assert.equal(result[0].length, 2, "First voice should have marker and EOL");
  });
});
function splitIntoVoices(system: System): any {
  throw new Error("Function not implemented.");
}
