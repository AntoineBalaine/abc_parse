import chai from "chai";
import { isToken, isVoiceMarker } from "../helpers";
import { ABCContext } from "../parsers/Context";
import { parseTune } from "../parsers/parse2";
import { Scanner2, Token, TT } from "../parsers/scan2";
import { isNewSystem, parseNoVoices, parseSystemsWithVoices, parseVoices, stringifyVoice, VoiceCtx } from "../parsers/voices2";
import { Info_line, Inline_field, tune_body_code } from "../types/Expr2";

const expect = chai.expect;

// Helper function to create a token with the given type and lexeme
function createToken(type: TT, lexeme: string, line: number = 0, position: number = 0): Token {
  const abcContext = new ABCContext();
  const token = new Token(
    type,
    {
      source: "",
      tokens: [],
      start: 0,
      current: lexeme.length,
      line,
      report: () => {},
      push: () => {},
      test: () => false,
      abcContext: abcContext,
      errorReporter: abcContext.errorReporter,
    },
    abcContext.generateId()
  );

  // Override the lexeme property
  Object.defineProperty(token, "lexeme", {
    value: lexeme,
    writable: false,
  });

  // Override the position property
  Object.defineProperty(token, "position", {
    value: position,
    writable: false,
  });

  return token;
}

// Helper function to create a VoiceCtx with the given elements and voices
function createVoiceCtx(elements: tune_body_code[], voices: string[] = []): VoiceCtx {
  return new VoiceCtx(elements, voices);
}

// Helper function to parse ABC notation into tokens
function parseABC(abc: string): Token[] {
  const ctx = new ABCContext();
  return Scanner2(abc, ctx);
}

describe("voices2.ts", () => {
  describe("VoiceCtx class", () => {
    it("should initialize with the provided elements and voices", () => {
      const elements: tune_body_code[] = [createToken(TT.NOTE_LETTER, "C"), createToken(TT.NOTE_LETTER, "D")];
      const voices = ["Voice1", "Voice2"];

      const ctx = createVoiceCtx(elements, voices);

      expect(ctx.elements).to.equal(elements);
      expect(ctx.voices).to.equal(voices);
      expect(ctx.current).to.equal(0);
      expect(ctx.systems).to.be.an("array").that.is.empty;
      expect(ctx.curSystem).to.be.undefined;
      expect(ctx.lastVoice).to.equal("");
    });

    it("should peek at the current element without advancing", () => {
      const elements: tune_body_code[] = [createToken(TT.NOTE_LETTER, "C"), createToken(TT.NOTE_LETTER, "D")];

      const ctx = createVoiceCtx(elements);

      expect(ctx.peek()).to.equal(elements[0]);
      expect(ctx.current).to.equal(0); // Should not advance
    });

    it("should return the previous element", () => {
      const elements: tune_body_code[] = [createToken(TT.NOTE_LETTER, "C"), createToken(TT.NOTE_LETTER, "D")];

      const ctx = createVoiceCtx(elements);
      ctx.current = 1; // Set current to 1

      expect(ctx.previous()).to.equal(elements[0]);
    });

    it("should advance to the next element and return the previous one", () => {
      const elements: tune_body_code[] = [createToken(TT.NOTE_LETTER, "C"), createToken(TT.NOTE_LETTER, "D")];

      const ctx = createVoiceCtx(elements);

      const result = ctx.advance();

      expect(result).to.equal(elements[0]);
      expect(ctx.current).to.equal(1);
    });

    it("should not advance past the end of the elements", () => {
      const elements: tune_body_code[] = [createToken(TT.NOTE_LETTER, "C")];

      const ctx = createVoiceCtx(elements);
      ctx.current = 0;

      ctx.advance(); // Advance to the end
      expect(ctx.current).to.equal(1);

      ctx.advance(); // Try to advance past the end
      expect(ctx.current).to.equal(1); // Should not change
    });

    it("should detect when at the end of the elements", () => {
      const elements: tune_body_code[] = [createToken(TT.NOTE_LETTER, "C")];

      const ctx = createVoiceCtx(elements);

      expect(ctx.isAtEnd()).to.be.false;

      ctx.current = 1; // Set to end
      expect(ctx.isAtEnd()).to.be.true;
    });

    it("should detect EOF token as end of elements", () => {
      const elements: tune_body_code[] = [createToken(TT.NOTE_LETTER, "C"), createToken(TT.EOF, "")];

      const ctx = createVoiceCtx(elements);

      expect(ctx.isAtEnd()).to.be.false;

      ctx.current = 1; // Set to EOF token
      expect(ctx.isAtEnd()).to.be.true;
    });
  });

  describe("Helper functions", () => {
    it("should identify voice markers (Info_line)", () => {
      const ctx = new ABCContext();
      const infoLine = new Info_line(ctx.generateId(), [createToken(TT.INF_HDR, "V:"), createToken(TT.INFO_STR, "Voice1")]);

      expect(isVoiceMarker(infoLine)).to.be.true;
    });

    it("should identify voice markers (Inline_field)", () => {
      const ctx = new ABCContext();
      const inlineField = new Inline_field(ctx.generateId(), createToken(TT.INF_HDR, "V:"), [createToken(TT.INFO_STR, "Voice1")]);

      expect(isVoiceMarker(inlineField)).to.be.true;
    });

    it("should not identify non-voice markers as voice markers", () => {
      const ctx = new ABCContext();
      const infoLine = new Info_line(ctx.generateId(), [createToken(TT.INF_HDR, "K:"), createToken(TT.INFO_STR, "C")]);

      expect(isVoiceMarker(infoLine)).to.be.false;
    });

    it("should identify tokens", () => {
      const token = createToken(TT.NOTE_LETTER, "C");

      expect(isToken(token)).to.be.true;
    });

    it("should not identify non-tokens as tokens", () => {
      const ctx = new ABCContext();
      const infoLine = new Info_line(ctx.generateId(), [createToken(TT.INF_HDR, "K:"), createToken(TT.INFO_STR, "C")]);

      expect(isToken(infoLine)).to.be.false;
    });

    it("should extract voice name from Info_line", () => {
      const ctx = new ABCContext();
      const infoLine = new Info_line(ctx.generateId(), [createToken(TT.INF_HDR, "V:"), createToken(TT.INFO_STR, "Voice1")]);

      expect(stringifyVoice(infoLine)).to.equal("Voice1");
    });

    it("should extract voice name from Inline_field", () => {
      const ctx = new ABCContext();
      const inlineField = new Inline_field(ctx.generateId(), createToken(TT.INF_HDR, "V:"), [createToken(TT.INFO_STR, "Voice1")]);

      expect(stringifyVoice(inlineField)).to.equal("Voice1");
    });

    it("should detect new system when lastVoice is empty", () => {
      const ctx = new ABCContext();
      const infoLine = new Info_line(ctx.generateId(), [createToken(TT.INF_HDR, "V:"), createToken(TT.INFO_STR, "Voice1")]);

      const voiceCtx = createVoiceCtx([infoLine], ["Voice1", "Voice2"]);

      expect(isNewSystem(voiceCtx)).to.be.true;
    });

    it("should detect new system when current voice has lower index than last voice", () => {
      const ctx = new ABCContext();
      const infoLine = new Info_line(ctx.generateId(), [createToken(TT.INF_HDR, "V:"), createToken(TT.INFO_STR, "Voice1")]);

      const voiceCtx = createVoiceCtx([infoLine], ["Voice1", "Voice2"]);
      voiceCtx.lastVoice = "Voice2";

      expect(isNewSystem(voiceCtx)).to.be.true;
    });

    it("should not detect new system when current voice has higher index than last voice", () => {
      const ctx = new ABCContext();
      const infoLine = new Info_line(ctx.generateId(), [createToken(TT.INF_HDR, "V:"), createToken(TT.INFO_STR, "Voice2")]);

      const voiceCtx = createVoiceCtx([infoLine], ["Voice1", "Voice2"]);
      voiceCtx.lastVoice = "Voice1";

      expect(isNewSystem(voiceCtx)).to.be.false;
    });
  });

  describe("parseNoVoices", () => {
    it("should create a new system at each line break", () => {
      const elements: tune_body_code[] = [
        createToken(TT.NOTE_LETTER, "C"),
        createToken(TT.NOTE_LETTER, "D"),
        createToken(TT.EOL, "\n"),
        createToken(TT.NOTE_LETTER, "E"),
        createToken(TT.NOTE_LETTER, "F"),
        createToken(TT.EOL, "\n"),
      ];

      const ctx = createVoiceCtx(elements);

      const systems = parseNoVoices(ctx);

      expect(systems).to.have.lengthOf(2);
      expect(systems[0]).to.have.lengthOf(3); // C, D, EOL
      expect(systems[1]).to.have.lengthOf(3); // E, F, EOL
    });

    it("should include the last system even without a line break", () => {
      const elements: tune_body_code[] = [
        createToken(TT.NOTE_LETTER, "C"),
        createToken(TT.NOTE_LETTER, "D"),
        createToken(TT.EOL, "\n"),
        createToken(TT.NOTE_LETTER, "E"),
        createToken(TT.NOTE_LETTER, "F"),
      ];

      const ctx = createVoiceCtx(elements);

      const systems = parseNoVoices(ctx);

      expect(systems).to.have.lengthOf(2);
      expect(systems[0]).to.have.lengthOf(3); // C, D, EOL
      expect(systems[1]).to.have.lengthOf(2); // E, F
    });

    it("should handle empty input", () => {
      const elements: tune_body_code[] = [];

      const ctx = createVoiceCtx(elements);

      const systems = parseNoVoices(ctx);

      expect(systems).to.have.lengthOf(0);
    });
  });

  describe("parseVoices", () => {
    it("should handle content before first voice marker", () => {
      const ctx = new ABCContext();

      const elements: tune_body_code[] = [
        createToken(TT.NOTE_LETTER, "C"),
        createToken(TT.NOTE_LETTER, "D"),
        createToken(TT.EOL, "\n"),
        new Info_line(ctx.generateId(), [createToken(TT.INF_HDR, "V:"), createToken(TT.INFO_STR, "Voice1")]),
        createToken(TT.NOTE_LETTER, "E"),
        createToken(TT.NOTE_LETTER, "F"),
      ];

      const voiceCtx = createVoiceCtx(elements, ["Voice1"]);

      const systems = parseVoices(voiceCtx);

      expect(systems).to.have.lengthOf(2);
      expect(systems[0]).to.have.lengthOf(3); // C, D, EOL
      expect(systems[1]).to.have.lengthOf(3); // V:Voice1, E, F
    });

    it("should create a new system when a voice with lower index appears", () => {
      const ctx = new ABCContext();

      const elements: tune_body_code[] = [
        new Info_line(ctx.generateId(), [createToken(TT.INF_HDR, "V:"), createToken(TT.INFO_STR, "Voice1")]),
        createToken(TT.NOTE_LETTER, "C"),
        createToken(TT.NOTE_LETTER, "D"),
        new Info_line(ctx.generateId(), [createToken(TT.INF_HDR, "V:"), createToken(TT.INFO_STR, "Voice2")]),
        createToken(TT.NOTE_LETTER, "E"),
        createToken(TT.NOTE_LETTER, "F"),
        new Info_line(ctx.generateId(), [createToken(TT.INF_HDR, "V:"), createToken(TT.INFO_STR, "Voice1")]),
        createToken(TT.NOTE_LETTER, "G"),
        createToken(TT.NOTE_LETTER, "A"),
      ];

      const voiceCtx = createVoiceCtx(elements, ["Voice1", "Voice2"]);

      const systems = parseVoices(voiceCtx);

      expect(systems).to.have.lengthOf(2);
      expect(systems[0]).to.have.lengthOf(6); // V:Voice1, C, D, V:Voice2, E, F
      expect(systems[1]).to.have.lengthOf(3); // V:Voice1, G, A
    });

    it("should handle inline voice markers", () => {
      const ctx = new ABCContext();

      const elements: tune_body_code[] = [
        new Inline_field(ctx.generateId(), createToken(TT.INF_HDR, "V:"), [createToken(TT.INFO_STR, "Voice1")]),
        createToken(TT.NOTE_LETTER, "C"),
        createToken(TT.NOTE_LETTER, "D"),
        new Inline_field(ctx.generateId(), createToken(TT.INF_HDR, "V:"), [createToken(TT.INFO_STR, "Voice2")]),
        createToken(TT.NOTE_LETTER, "E"),
        createToken(TT.NOTE_LETTER, "F"),
      ];

      const voiceCtx = createVoiceCtx(elements, ["Voice1", "Voice2"]);

      const systems = parseVoices(voiceCtx);

      expect(systems).to.have.lengthOf(1);
      expect(systems[0]).to.have.lengthOf(6);
    });
  });

  describe("parseSystemsWithVoices", () => {
    it("should use parseNoVoices when there are fewer than 2 voices", () => {
      const elements: tune_body_code[] = [
        createToken(TT.NOTE_LETTER, "C"),
        createToken(TT.NOTE_LETTER, "D"),
        createToken(TT.EOL, "\n"),
        createToken(TT.NOTE_LETTER, "E"),
        createToken(TT.NOTE_LETTER, "F"),
      ];

      const systems = parseSystemsWithVoices(elements, ["Voice1"]);

      expect(systems).to.have.lengthOf(2);
    });

    it("should use parseVoices when there are 2 or more voices", () => {
      const ctx = new ABCContext();

      const elements: tune_body_code[] = [
        new Info_line(ctx.generateId(), [createToken(TT.INF_HDR, "V:"), createToken(TT.INFO_STR, "Voice1")]),
        createToken(TT.NOTE_LETTER, "C"),
        new Info_line(ctx.generateId(), [createToken(TT.INF_HDR, "V:"), createToken(TT.INFO_STR, "Voice2")]),
        createToken(TT.NOTE_LETTER, "D"),
      ];

      const systems = parseSystemsWithVoices(elements, ["Voice1", "Voice2"]);

      expect(systems).to.have.lengthOf(1);
      expect(systems[0]).to.have.lengthOf(4);
    });
  });

  describe("Integration tests", () => {
    it("should parse a tune with no voices", () => {
      const sample = `X:1
M:4/4
L:1/8
z16|
z16|`;

      const ctx = new ABCContext();
      const tokens = Scanner2(sample, ctx);
      const tune = parseTune(tokens, ctx);

      expect(tune).to.not.be.null;
      const systems = tune.tune_body?.sequence;
      expect(systems).to.have.lengthOf(2);
    });

    it("should parse a tune with two voices", () => {
      const sample = `X:1
V: V0 clef=treble name="Piano"
V: V1 clef=bass name="Piano"
M:4/4
L:1/8
[V: V0]z16|
[V: V1]z16|`;

      const ctx = new ABCContext();
      const tokens = Scanner2(sample, ctx);
      const tune = parseTune(tokens, ctx);

      expect(tune).to.not.be.null;
      const systems = tune.tune_body?.sequence;
      expect(systems).to.have.lengthOf(1);
    });

    it("should parse a tune with multiple systems", () => {
      const sample = `X:1
V: V0 clef=treble name="Piano"
V: V1 clef=bass name="Piano"
M:4/4
L:1/8
[V: V0]z16|
[V: V1]z16|
[V: V0]z16|
[V: V1]z16|`;

      const ctx = new ABCContext();
      const tokens = Scanner2(sample, ctx);
      const tune = parseTune(tokens, ctx);

      expect(tune).to.not.be.null;
      const systems = tune.tune_body?.sequence;
      expect(systems).to.have.lengthOf(2);
    });

    it("should parse a tune with comments between voice sections", () => {
      const sample = `X:1
V: V0 clef=treble name="Piano"
V: V1 clef=bass name="Piano"
M:4/4
L:1/8
[V: V0]z16|
[V: V1]z16|
% This is a comment
[V: V0]z16|
[V: V1]z16|`;

      const ctx = new ABCContext();
      const tokens = Scanner2(sample, ctx);
      const tune = parseTune(tokens, ctx);

      expect(tune).to.not.be.null;
      const systems = tune.tune_body?.sequence;
      expect(systems).to.have.lengthOf(2);
    });

    it("should parse a tune with custom voice names", () => {
      const sample = `X:1
V:RH clef=treble
V:LH clef=bass
V:RH 
C|
V:LH 
G| 
V:RH 
D|
V:LH 
A|`;

      const ctx = new ABCContext();
      const tokens = Scanner2(sample, ctx);
      const tune = parseTune(tokens, ctx);

      expect(tune).to.not.be.null;
      expect(tune.tune_header.voices).to.have.lengthOf(2);
      const systems = tune.tune_body?.sequence;
      expect(systems).to.have.lengthOf(2);
    });

    it("should parse a tune with inline voice markers", () => {
      const sample = `X:1
V:RH clef=treble
V:LH clef=bass
K:C
[V: RH] C|
[V: LH] G| 
[V: RH] D|
[V: LH] A|`;

      const ctx = new ABCContext();
      const tokens = Scanner2(sample, ctx);
      const tune = parseTune(tokens, ctx);

      expect(tune).to.not.be.null;
      expect(tune.tune_header.voices).to.have.lengthOf(2);
      const systems = tune.tune_body?.sequence;
      expect(systems).to.have.lengthOf(2);
    });
  });
});
