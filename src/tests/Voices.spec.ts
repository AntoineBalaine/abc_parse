import chai, { assert } from "chai";
import { Parser } from "../parsers/Parser";
import { Scanner } from "../parsers/Scanner";
import { ABCContext } from "../parsers/Context";
import { isInfo_line, isToken } from "../helpers";
import { Info_line } from "../types/Expr";
import { TokenType } from "../types/types";
import { buildParse } from "./RhythmTransform.spec";
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
  it("should find multiple info line voices with custom names", () => {
    const sample = `X:1
K:C
V:RH clef=treble
V:LH clef=bass
V:RH 
C|
V:LH 
G| 
V:RH 
D|
V:LH 
A| 
`;
    const ctx = new ABCContext();
    const scan = new Scanner(sample, ctx).scanTokens();
    const parse = new Parser(scan, ctx).parse();
    expect(parse!.tune[0].tune_header.voices).to.have.lengthOf(2);
    expect(parse!.tune[0].tune_body!.sequence).to.have.lengthOf(2);
    const tok0 = parse!.tune[0].tune_body!.sequence[0][0];
    expect(isInfo_line(tok0) && tok0.value[0].lexeme.trim() === "RH").to.be.true;
  });
  it("should find multiple inline voices with custom names", () => {
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

  describe("Info_line - voice line parsing", () => {
    let ctx: ABCContext;

    beforeEach(() => {
      ctx = new ABCContext();
    });

    function createVoiceLine(input: string): Info_line {
      const scanner = new Scanner(input, ctx);
      return new Info_line(ctx, scanner.scanTokens());
    }

    describe("basic voice names", () => {
      it("parses simple voice name", () => {
        const line = createVoiceLine("V:RH");
        assert.equal(line.key.lexeme, "V:");
        assert.equal(line.value[0].lexeme, "RH");
        assert.isUndefined(line.metadata);
      });

      it("handles voice name with spaces", () => {
        const line = createVoiceLine("V:VoiceOne");
        assert.equal(line.value[0].lexeme, "VoiceOne");
        assert.isUndefined(line.metadata);
      });

      it("handles voice name with hyphens", () => {
        const line = createVoiceLine("V:Voice-1");
        assert.equal(line.value[0].lexeme, "Voice-1");
        assert.isUndefined(line.metadata);
      });
    });

    describe("metadata handling", () => {
      it("parses voice with single metadata", () => {
        const line = createVoiceLine("V:RH clef=treble");
        assert.equal(line.value[0].lexeme, "RH");
        const meta = line.metadata![0];
        assert(isToken(meta) && meta.lexeme === "clef=treble");
      });

      it("parses voice with multiple metadata items", () => {
        const line = createVoiceLine("V:RH clef=treble octave=4");
        assert.equal(line.value[0].lexeme, "RH");
        const meta = line.metadata![0];
        assert(isToken(meta) && meta.lexeme === "clef=treble octave=4");
      });

      it("handles metadata with spaces", () => {
        const line = createVoiceLine("V:Voice1 name=Right Hand");
        assert.equal(line.value[0].lexeme, "Voice1");
        const meta = line.metadata![0];
        assert(isToken(meta) && meta.lexeme === "name=Right Hand");
      });
    });

    describe("whitespace handling", () => {
      it("handles leading whitespace", () => {
        const line = createVoiceLine("V:  RH");
        assert.equal(line.value[0].lexeme, "RH");
        assert.isUndefined(line.metadata);
      });

      it("handles multiple spaces between voice and metadata", () => {
        const line = createVoiceLine("V:RH    clef=treble");
        assert.equal(line.value[0].lexeme, "RH");
        const meta = line.metadata![0];
        assert(isToken(meta) && meta.lexeme === "clef=treble");
      });
    });

    describe("comment handling", () => {
      it("preserves comments after voice name", () => {
        const line = createVoiceLine("V:RH % comment");
        assert.equal(line.value[0].lexeme, "RH");
        const metadata = line.metadata!;
        const token = metadata[0];
        assert(isToken(token) && token.type === TokenType.COMMENT && token.lexeme === "% comment");
      });

      it("preserves comments after metadata", () => {
        const line = createVoiceLine("V:RH clef=treble % comment");
        assert.equal(line.value[0].lexeme, "RH");
        const metadata = line.metadata!;
        const meta = line.metadata![0];
        assert(isToken(meta) && meta.lexeme === "clef=treble");
        const token = metadata[1];
        assert(isToken(token) && token.type === TokenType.COMMENT && token.lexeme === "% comment");
      });
    });

    describe("edge cases", () => {
      it("handles empty voice line", () => {
        const line = createVoiceLine("V:");
        assert.isEmpty(line.value);
        assert.isUndefined(line.metadata);
      });

      it("handles voice line with only whitespace", () => {
        const line = createVoiceLine("V:   ");
        assert.isEmpty(line.value);
        assert.isUndefined(line.metadata);
      });

      it("handles complex voice names", () => {
        const line = createVoiceLine("V:Voice-1_Bass_Clef");
        assert.equal(line.value[0].lexeme, "Voice-1_Bass_Clef");
        assert.isUndefined(line.metadata);
      });
    });
  });

  it("parse correct number of voices - numbered voice labels", () => {
    const ctx = new ABCContext();
    const source = `
X:1
V:1
V:2
V:1
CDEF|GABC|
V:2
CDEF|GABC|`;

    // const fmtHeader = tuneHeader(source);
    const scan = new Scanner(source, ctx).scanTokens();
    const parse = new Parser(scan, ctx).parse();
    if (!parse) {
      throw new Error("failed multi voice parse");
    }
    expect(parse!.tune[0].tune_header.voices.length).to.equal(2);
    expect(isInfo_line(parse!.tune[0].tune_body!.sequence[0][0])).to.be.true;
  });
  it("parse correct number of voices - custom voice labels", () => {
    const ctx = new ABCContext();
    const result = buildParse(
      `V:RH clef=treble
V:LH clef=bass
V:RH
Z4|
V:LH
CDEF|GABC|CDEF|GABC|
            `,
      ctx
    );
    expect(result?.tune[0].tune_header.voices.length).to.equal(2);
  });

  it("it formats all voices in a 3-voice system", () => {
    const ctx = new ABCContext();
    const result = buildParse(
      `X:1
V:1 name="soprano" clef=treble   middle=B
V:2 name="tenor"   clef=treble-8 middle=B,
V:3 name="bass"    clef=bass     middle=D,
%
[V:1] | CDEF GABc | cdef gabc' |
[V:2] | C,D,E,F, G,A,B,C | CDEF GABc |
[V:3] | C,,D,,E,,F,, G,,A,,B,,C, | C,D,E,F, G,A,B,C |`,
      ctx
    );

    expect(result?.tune[0].tune_header.voices.length).to.equal(3);
    expect(result?.tune[0].tune_body?.sequence.length).to.equal(1);
  });

  describe("Voice Inline markers", () => {
    let ctx: ABCContext;

    beforeEach(() => {
      ctx = new ABCContext();
    });

    it("parse correct number of voices using inline voice markers", () => {
      const ctx = new ABCContext();
      const result = buildParse(
        `V:RH clef=treble
V:LH clef=bass
[V:RH]Z4|
[V:LH]CDEF|GABC|CDEF|GABC|`,
        ctx
      );
      expect(result?.tune[0].tune_header.voices.length).to.equal(2);
    });
  });
});
