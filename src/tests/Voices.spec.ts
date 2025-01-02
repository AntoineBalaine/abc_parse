import chai from "chai";
import { Parser } from "../parsers/Parser";
import { Scanner } from "../parsers/Scanner";
import { ABCContext } from "../parsers/Context";
const expect = chai.expect;

const two_voices = `X:1
V: V0 clef=treble name="Piano"
V: V1 clef=bass name="Piano"
M:4/4
L:1/8
[V: V0]z16|
[V: V1]z16|
`;

describe("Voices / Systems", () => {
  it("should parse even when there are no voices in score", () => {
    const sample = `X:1
M:4/4
L:1/8
z16|
z16|`;

    const ctx = new ABCContext();
    const parser = new Parser(new Scanner(sample, ctx).scanTokens(), ctx);
    const parse = parser.parse();
    expect(parse).to.not.be.null;
    if (!parse) {
      return;
    }
    const systems = parse.tune[0].tune_body?.sequence;
    expect(systems).to.have.lengthOf(2);
  });
  it("should find systems in score", () => {
    const ctx = new ABCContext();
    const parser = new Parser(new Scanner(two_voices, ctx).scanTokens(), ctx);
    const parse = parser.parse();
    expect(parse).to.not.be.null;
    if (!parse) {
      return;
    }
    const systems = parse.tune[0].tune_body?.sequence;
    expect(systems).to.have.lengthOf(1);
  });

  it("should find multiple systems in score", () => {
    const sample =
      two_voices +
      `[V: V0]z16|
[V: V1]z16|`;

    const ctx = new ABCContext();
    const parser = new Parser(new Scanner(sample, ctx).scanTokens(), ctx);
    const parse = parser.parse();
    expect(parse).to.not.be.null;
    if (!parse) {
      return;
    }
    const systems = parse.tune[0].tune_body?.sequence;
    expect(systems).to.have.lengthOf(2);
  });
  it("should find multiple systems interspersed with comments", () => {
    const sample = `${two_voices}%this is comment
[V: V0]z16|
[V: V1]z16|`;
    const ctx = new ABCContext();
    const parser = new Parser(new Scanner(sample, ctx).scanTokens(), ctx);
    const parse = parser.parse();
    expect(parse).to.not.be.null;
    if (!parse) {
      return;
    }
    const systems = parse.tune[0].tune_body?.sequence;
    expect(systems).to.have.lengthOf(2);
  });
  it("should find multiple voices with custom names", () => {
    const sample = `X:1
V:RH clef=treble
V:LH clef=bass
K:C
[V: RH] C|
[V: LH] G| 
[V: RH] D|
[V: LH] A| 
`;
    const ctx = new ABCContext();
    const parse = new Parser(new Scanner(sample, ctx).scanTokens(), ctx).parse();
    expect(parse!.tune[0].tune_body!.sequence).to.have.lengthOf(2);
  });
});
