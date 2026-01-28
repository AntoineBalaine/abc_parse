import chai from "chai";
import * as fc from "fast-check";
import { isToken, isVoiceMarker } from "../helpers";
import { ABCContext } from "../parsers/Context";
import { ParseCtx, parseTune } from "../parsers/parse2";
import { Scanner, Token, TT } from "../parsers/scan2";
import { isNewSystem, parseNoVoices, parseSystemsWithVoices, parseVoices, extractVoiceId, VoiceCtx, LinearVoiceCtx } from "../parsers/voices2";
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
function createLinVoiceCtx(elements: tune_body_code[], voices: string[] = []) {
  return new LinearVoiceCtx(elements, voices);
}
function createVoiceCtx(elements: tune_body_code[], voices: string[] = []) {
  return new VoiceCtx(elements, voices);
}

// Helper function to parse ABC notation into tokens
function parseABC(abc: string): Token[] {
  const ctx = new ABCContext();
  return Scanner(abc, ctx);
}

// Import the internal functions for testing (we'll need to export them temporarily)
import { buildBarMapsFromLines, splitIntoLines } from "../parsers/voices2";
import { getAllVoices } from "../abcl";

describe("voices2.ts", () => {
  describe("Helper functions - splitIntoLines", () => {
    it("should split elements at EOL boundaries", () => {
      const elements: tune_body_code[] = [
        createToken(TT.NOTE_LETTER, "C"),
        createToken(TT.NOTE_LETTER, "D"),
        createToken(TT.EOL, "\n"),
        createToken(TT.NOTE_LETTER, "E"),
        createToken(TT.NOTE_LETTER, "F"),
        createToken(TT.EOL, "\n"),
      ];

      const lines = splitIntoLines(elements);

      expect(lines).to.have.lengthOf(2);
      expect(lines[0]).to.have.lengthOf(3); // C, D, EOL
      expect(lines[1]).to.have.lengthOf(3); // E, F, EOL
    });

    it("should handle last line without EOL", () => {
      const elements: tune_body_code[] = [
        createToken(TT.NOTE_LETTER, "C"),
        createToken(TT.NOTE_LETTER, "D"),
        createToken(TT.EOL, "\n"),
        createToken(TT.NOTE_LETTER, "E"),
      ];

      const lines = splitIntoLines(elements);

      expect(lines).to.have.lengthOf(2);
      expect(lines[0]).to.have.lengthOf(3); // C, D, EOL
      expect(lines[1]).to.have.lengthOf(1); // E
    });
  });

  describe("Helper functions - buildBarMapsFromLines", () => {
    it("should map bar numbers for single voice", () => {
      const sample = `X:1
K:C
CD|E|`;
      const ctx = new ABCContext();
      const tokens = Scanner(sample, ctx);
      const parseCtx = new ParseCtx(tokens, ctx);
      const tune = parseTune(parseCtx);

      const elements = tune.tune_body?.sequence.flat() || [];
      const lines = splitIntoLines(elements);
      const barMap = buildBarMapsFromLines(lines);

      // Should have mapped the music line
      expect(barMap.size).to.be.greaterThan(0);

      // Find the line with music
      const musicLineIdx = Array.from(barMap.keys())[0];
      const range = barMap.get(musicLineIdx);

      expect(range).to.not.be.undefined;
      // CD| is bar 0, E| increments to bar 1, so we should have bars 0-1
      expect(range?.start).to.equal(0);
      expect(range?.end).to.equal(1);
    });

    it("should track separate bar counters for different voices", () => {
      const sample = `X:1
K:A
V:2
C|D|
V:1
E|F|`;
      const ctx = new ABCContext();
      const tokens = Scanner(sample, ctx);
      const parseCtx = new ParseCtx(tokens, ctx);
      const tune = parseTune(parseCtx);

      const elements = tune.tune_body?.sequence.flat() || [];
      const lines = splitIntoLines(elements);
      const barMap = buildBarMapsFromLines(lines);

      // Should have mapped both voice lines
      expect(barMap.size).to.equal(2);

      const ranges = Array.from(barMap.values());

      // Voice 2: bars 0-1
      const v2Range = ranges.find((r) => r.voice === "2");
      expect(v2Range).to.not.be.undefined;
      expect(v2Range?.start).to.equal(0);
      expect(v2Range?.end).to.equal(1);

      // Voice 1: bars 0-1 (separate counter)
      const v1Range = ranges.find((r) => r.voice === "1");
      expect(v1Range).to.not.be.undefined;
      expect(v1Range?.start).to.equal(0);
      expect(v1Range?.end).to.equal(1);
    });

    it("should continue bar count for same voice across lines", () => {
      const sample = `X:1
K:A
V:1
C|D|
V:1
E|F|`;
      const ctx = new ABCContext();
      const tokens = Scanner(sample, ctx);
      const parseCtx = new ParseCtx(tokens, ctx);
      const tune = parseTune(parseCtx);

      const elements = tune.tune_body?.sequence.flat() || [];
      const lines = splitIntoLines(elements);
      const barMap = buildBarMapsFromLines(lines);

      // Should have mapped both lines
      expect(barMap.size).to.equal(2);

      const ranges = Array.from(barMap.entries()).sort((a, b) => a[0] - b[0]);

      // First V:1 line: bars 0-1
      expect(ranges[0][1].voice).to.equal("1");
      expect(ranges[0][1].start).to.equal(0);
      expect(ranges[0][1].end).to.equal(1);

      // Second V:1 line: bars 2-3 (continues from first line)
      expect(ranges[1][1].voice).to.equal("1");
      expect(ranges[1][1].start).to.equal(2);
      expect(ranges[1][1].end).to.equal(3);
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
      const inlineField = new Inline_field(ctx.generateId(), createToken(TT.INF_HDR, "V:"), [createToken(TT.INFO_STR, "Voice1")], undefined);

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

      expect(extractVoiceId(infoLine)).to.equal("Voice1");
    });

    it("should extract voice name from Inline_field", () => {
      const ctx = new ABCContext();
      const inlineField = new Inline_field(ctx.generateId(), createToken(TT.INF_HDR, "V:"), [createToken(TT.INFO_STR, "Voice1")], undefined);

      expect(extractVoiceId(inlineField)).to.equal("Voice1");
    });

    it("should extract only the voice ID from Info_line with metadata", () => {
      const ctx = new ABCContext();
      // V:Tenor clef=treble name="Tenor Voice"
      const infoLine = new Info_line(ctx.generateId(), [
        createToken(TT.INF_HDR, "V:"),
        createToken(TT.INFO_STR, "Tenor"),
        createToken(TT.WS, " "),
        createToken(TT.INFO_STR, "clef=treble"),
        createToken(TT.WS, " "),
        createToken(TT.INFO_STR, 'name="Tenor Voice"'),
      ]);

      expect(extractVoiceId(infoLine)).to.equal("Tenor");
    });

    it("should extract only the voice ID from Inline_field with metadata", () => {
      const ctx = new ABCContext();
      // [V:S1 stem=up]
      const inlineField = new Inline_field(
        ctx.generateId(),
        createToken(TT.INF_HDR, "V:"),
        [createToken(TT.INFO_STR, "S1"), createToken(TT.WS, " "), createToken(TT.INFO_STR, "stem=up")],
        undefined
      );

      expect(extractVoiceId(inlineField)).to.equal("S1");
    });

    it("should skip leading whitespace when extracting voice ID", () => {
      const ctx = new ABCContext();
      // V: Tenor (with leading space after V:)
      const infoLine = new Info_line(ctx.generateId(), [createToken(TT.INF_HDR, "V:"), createToken(TT.WS, " "), createToken(TT.INFO_STR, "Tenor")]);

      expect(extractVoiceId(infoLine)).to.equal("Tenor");
    });

    it("should return empty string for empty Info_line value", () => {
      const ctx = new ABCContext();
      const infoLine = new Info_line(ctx.generateId(), [createToken(TT.INF_HDR, "V:")]);

      expect(extractVoiceId(infoLine)).to.equal("");
    });

    it("should return empty string for Info_line with only whitespace", () => {
      const ctx = new ABCContext();
      const infoLine = new Info_line(ctx.generateId(), [createToken(TT.INF_HDR, "V:"), createToken(TT.WS, "   ")]);

      expect(extractVoiceId(infoLine)).to.equal("");
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

      const voiceCtx = createLinVoiceCtx(elements, ["Voice1"]);

      const systems = parseVoices(voiceCtx);

      expect(systems).to.have.lengthOf(1);
      expect(voiceCtx.prefix).to.have.lengthOf(3); // C, D, EOL
      expect(systems[0].get("Voice1")).to.have.lengthOf(3); // V:Voice1, E, F
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

      const voiceCtx = createLinVoiceCtx(elements, ["Voice1", "Voice2"]);

      const systems = parseVoices(voiceCtx);

      expect(systems).to.have.lengthOf(2);
      expect(systems[0].get("Voice1")).to.have.lengthOf(3); // V:Voice1, C, D, V:Voice2, E, F
      expect(systems[0].get("Voice2")).to.have.lengthOf(3); // V:Voice1, C, D, V:Voice2, E, F
      expect(systems[1].get("Voice1")).to.have.lengthOf(3); // V:Voice1, G, A
    });

    it("should handle inline voice markers", () => {
      const ctx = new ABCContext();

      const elements: tune_body_code[] = [
        new Inline_field(ctx.generateId(), createToken(TT.INF_HDR, "V:"), [createToken(TT.INFO_STR, "Voice1")], undefined),
        createToken(TT.NOTE_LETTER, "C"),
        createToken(TT.NOTE_LETTER, "D"),
        new Inline_field(ctx.generateId(), createToken(TT.INF_HDR, "V:"), [createToken(TT.INFO_STR, "Voice2")], undefined),
        createToken(TT.NOTE_LETTER, "E"),
        createToken(TT.NOTE_LETTER, "F"),
      ];

      const voiceCtx = createLinVoiceCtx(elements, ["Voice1", "Voice2"]);

      const systems = parseVoices(voiceCtx);

      expect(systems).to.have.lengthOf(1);
      expect(systems[0].get("Voice1")).to.have.lengthOf(3);
      expect(systems[0].get("Voice2")).to.have.lengthOf(3);
    });

    it("should create system boundary when new music line continues same voice in linear mode", () => {
      // In linear mode, a new line of music without a voice marker is an implicit
      // continuation of the current voice. If the current voice's index is not less
      // than the last voice's index, this marks a system boundary.
      //
      // Expected: 2 systems
      //   System 1: V:1 abcde
      //   System 2: V:1 dfgef, V:2 abcde
      const sample = `X:1
K:C
V:1
abcde
dfgef
V:2
abcde`;

      const ctx = new ABCContext();
      const tokens = Scanner(sample, ctx);
      const parseCtx = new ParseCtx(tokens, ctx);
      const tune = parseTune(parseCtx, undefined, true); // linear = true
      const vxls = getAllVoices(tune.tune_body!, tune.tune_header.voices);
      const systems = parseVoices(createLinVoiceCtx(tune.tune_body!.sequence[0], vxls));

      expect(systems).to.have.lengthOf(2);
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
      const tokens = Scanner(sample, ctx);
      const parseCtx = new ParseCtx(tokens, ctx);
      const tune = parseTune(parseCtx);

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
      const tokens = Scanner(sample, ctx);
      const parseCtx = new ParseCtx(tokens, ctx);
      const tune = parseTune(parseCtx);

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
      const tokens = Scanner(sample, ctx);
      const parseCtx = new ParseCtx(tokens, ctx);
      const tune = parseTune(parseCtx);

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
      const tokens = Scanner(sample, ctx);
      const parseCtx = new ParseCtx(tokens, ctx);
      const tune = parseTune(parseCtx);

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
      const tokens = Scanner(sample, ctx);
      const parseCtx = new ParseCtx(tokens, ctx);
      const tune = parseTune(parseCtx);

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
      const tokens = Scanner(sample, ctx);
      const parseCtx = new ParseCtx(tokens, ctx);
      const tune = parseTune(parseCtx);

      expect(tune).to.not.be.null;
      expect(tune.tune_header.voices).to.have.lengthOf(2);
      const systems = tune.tune_body?.sequence;
      expect(systems).to.have.lengthOf(2);
    });

    it("should correctly separate voice declarations from voice usage", () => {
      const sample = `X:1
V:1 clef=treble
V:2 clef=bass
V:1
CDEF|GABC|
V:2
CDEF|GABC|`;

      const ctx = new ABCContext();
      const tokens = Scanner(sample, ctx);
      const parseCtx = new ParseCtx(tokens, ctx);
      const tune = parseTune(parseCtx);

      expect(tune).to.not.be.null;

      // Should have exactly 3 info lines in tune header: X:1, V:1 clef=treble, V:2 clef=bass
      const infoLines = tune.tune_header.info_lines.filter((item): item is Info_line => item instanceof Info_line);
      expect(infoLines).to.have.lengthOf(3);
      expect(infoLines[0].key.lexeme).to.equal("X:");
      expect(infoLines[1].key.lexeme).to.equal("V:");
      expect(infoLines[2].key.lexeme).to.equal("V:");

      // Voice tracking should have detected 2 unique voices
      expect(tune.tune_header.voices).to.have.lengthOf(2);
      expect(tune.tune_header.voices).to.include("1");
      expect(tune.tune_header.voices).to.include("2");
    });

    it("should group non-sequential voice lines with overlapping bars into same system", () => {
      const sample = `X:1
V:1 clef=treble
V:2 clef=bass
K:C
V:2
CDEF|GABC|defg|abcd|
V:1
CDEF|GABC|defg|abcd|`;

      const ctx = new ABCContext();
      const tokens = Scanner(sample, ctx);
      const parseCtx = new ParseCtx(tokens, ctx);
      const tune = parseTune(parseCtx);

      expect(tune).to.not.be.null;
      const systems = tune.tune_body?.sequence;

      // Voice 2 plays bars 1-4, Voice 1 plays bars 1-4
      // These should be in the same system because they overlap (bars 1-4)
      expect(systems).to.have.lengthOf(1);
      expect(systems![0].length).to.be.greaterThan(0);
    });

    it("should group multiple non-sequential overlapping voice lines", () => {
      const sample = `X:1
V:1 clef=treble
V:2 clef=bass
V:3 clef=alto
K:C
V:3
CDEF|GABC|
V:1
CDEF|GABC|
V:2
CDEF|GABC|`;

      const ctx = new ABCContext();
      const tokens = Scanner(sample, ctx);
      const parseCtx = new ParseCtx(tokens, ctx);
      const tune = parseTune(parseCtx);

      expect(tune).to.not.be.null;
      const systems = tune.tune_body?.sequence;

      // V:3 bars 1-2, V:1 bars 1-2, V:2 bars 1-2
      // All overlap, so should be one system
      expect(systems).to.have.lengthOf(1);
    });

    it("should separate systems when voice lines do not overlap in bar numbers", () => {
      const sample = `X:1
V:1 clef=treble
V:2 clef=bass
K:C
V:2
CDEF|GABC|defg|abcd|
V:1
CDEF|GABC|defg|abcd|
V:2
efga|bcde|
V:1
efga|bcde|`;

      const ctx = new ABCContext();
      const tokens = Scanner(sample, ctx);
      const parseCtx = new ParseCtx(tokens, ctx);
      const tune = parseTune(parseCtx, undefined, true);

      tune.tune_header.voices;
      const vxls = getAllVoices(tune.tune_body!, tune.tune_header.voices);
      const systems = parseVoices(createLinVoiceCtx(tune.tune_body!.sequence[0], vxls));

      // System 1: V:2 bars 1-4, V:1 bars 1-4 (overlap)
      // System 2: V:2 bars 5-6, V:1 bars 5-6 (overlap, but don't overlap with system 1)
      expect(systems).to.have.lengthOf(3);
    });
    it("should separate systems when finding undeclared voice markers", () => {
      const sample = `X:1
V:1 clef=treble
V:2 clef=bass
K:C
V:2
CDEF|GABC|defg|abcd|
V:1
CDEF|GABC|defg|abcd|
V:3
efga|bcde|
V:1
efga|bcde|`;

      const ctx = new ABCContext();
      const tokens = Scanner(sample, ctx);
      const parseCtx = new ParseCtx(tokens, ctx);
      const tune = parseTune(parseCtx, undefined, true);
      const vxls = getAllVoices(tune.tune_body!, tune.tune_header.voices);
      const systems = parseVoices(createLinVoiceCtx(tune.tune_body!.sequence[0], vxls));

      // System 1: V:2 bars 1-4, V:1 bars 1-4 (overlap)
      // System 2: V:2 bars 5-6, V:1 bars 5-6 (overlap, but don't overlap with system 1)
      expect(systems).to.have.lengthOf(3);
    });

    it("should handle partial bar overlap correctly", () => {
      const sample = `X:1
V:1 clef=treble
V:2 clef=bass
K:C
V:1
CDEF|GABC|defg|abcd|
V:2
defg|abcd|efga|bcde|`;

      const ctx = new ABCContext();
      const tokens = Scanner(sample, ctx);
      const parseCtx = new ParseCtx(tokens, ctx);
      const tune = parseTune(parseCtx);

      expect(tune).to.not.be.null;
      const systems = tune.tune_body?.sequence;

      // V:1 bars 1-4, V:2 bars 1-4
      // Bars 1-4 overlap with bars 1-4, so same system
      expect(systems).to.have.lengthOf(1);
    });

    it("should handle voice lines starting at different bar numbers with overlap", () => {
      const sample = `X:1
V:1 clef=treble
V:2 clef=bass
K:C
V:1
CDEF|GABC|defg|abcd|efga|bcde|
V:2
CDEF|GABC|`;

      const ctx = new ABCContext();
      const tokens = Scanner(sample, ctx);
      const parseCtx = new ParseCtx(tokens, ctx);
      const tune = parseTune(parseCtx);

      expect(tune).to.not.be.null;
      const systems = tune.tune_body?.sequence;

      // V:1 bars 1-6, V:2 bars 1-2
      // Bars 1-2 overlap with 1-6, so same system
      expect(systems).to.have.lengthOf(1);
    });

    it("should extract voice ID from parsed ABC with metadata", () => {
      const sample = `X:1
V:Tenor clef=treble name="Tenor Voice"
K:C
`;
      const ctx = new ABCContext();
      const tokens = Scanner(sample, ctx);
      const parseCtx = new ParseCtx(tokens, ctx);
      const tune = parseTune(parseCtx);

      // Find the V: Info_line and verify stringifyVoice extracts "Tenor"
      const voiceLine = tune.tune_header.info_lines.find((l): l is Info_line => l instanceof Info_line && l.key.lexeme === "V:");
      expect(voiceLine).to.not.be.undefined;
      expect(extractVoiceId(voiceLine!)).to.equal("Tenor");
    });

    it("should extract voice ID from inline voice marker with metadata", () => {
      const sample = `X:1
V:S1 stem=up
K:C
[V:S1 stem=down]C|`;
      const ctx = new ABCContext();
      const tokens = Scanner(sample, ctx);
      const parseCtx = new ParseCtx(tokens, ctx);
      const tune = parseTune(parseCtx);

      // Find the inline field in the tune body
      const inlineField = tune.tune_body?.sequence.flat().find((el): el is Inline_field => el instanceof Inline_field && el.field.lexeme === "V:");
      expect(inlineField).to.not.be.undefined;
      expect(extractVoiceId(inlineField!)).to.equal("S1");
    });
  });

  describe("Property-based tests for linear parsing", () => {
    // Generator for linear-style systems where:
    // - The first system includes ALL voices (to establish discovery order)
    // - Each voice has exactly 1 line of content
    // - Subsequent systems may omit some voices but maintain order
    const genLinearAbcSimple = fc
      .tuple(
        fc.integer({ min: 2, max: 4 }), // number of voices
        fc.integer({ min: 1, max: 4 }) // number of systems
      )
      .chain(([numVoices, numSystems]) => {
        // For systems after the first, generate which voices are included
        const genSubsequentSystemVoices = fc.array(fc.boolean(), { minLength: numVoices, maxLength: numVoices }).map((include) => {
          // Ensure at least one voice
          if (!include.some((v) => v)) include[0] = true;
          return include.map((inc, idx) => (inc ? idx + 1 : null)).filter((v): v is number => v !== null);
        });

        const subsequentSystemsCount = Math.max(0, numSystems - 1);

        return fc.array(genSubsequentSystemVoices, { minLength: subsequentSystemsCount, maxLength: subsequentSystemsCount }).map((subsequentSystems) => {
          // First system always includes all voices in order
          const allVoices = Array.from({ length: numVoices }, (_, i) => i + 1);
          const systems = [allVoices, ...subsequentSystems];

          // Build the ABC string
          let abc = "X:1\nK:C\n";

          // Track last voice index for system boundary detection
          let lastVoiceIdx = -1;
          let expectedSystemCount = 0;

          for (const voices of systems) {
            for (const voiceNum of voices) {
              const voiceIdx = voiceNum - 1; // 0-based index matches discovery order

              // System boundary when voice index goes backward (or first voice)
              if (lastVoiceIdx === -1 || voiceIdx < lastVoiceIdx) {
                expectedSystemCount++;
              }
              lastVoiceIdx = voiceIdx;

              // Add voice marker and single line of content
              abc += `V:${voiceNum}\nC|D|\n`;
            }
          }

          return {
            numVoices,
            numSystems,
            systems,
            expectedSystemCount,
            abc,
          };
        });
      });

    it("should produce the expected number of systems for linear-style ABC", () => {
      fc.assert(
        fc.property(genLinearAbcSimple, ({ abc, expectedSystemCount }) => {
          const ctx = new ABCContext();
          const tokens = Scanner(abc, ctx);
          const parseCtx = new ParseCtx(tokens, ctx);
          const tune = parseTune(parseCtx, undefined, true); // linear = true
          const vxls = getAllVoices(tune.tune_body!, tune.tune_header.voices);
          const systems = parseVoices(createLinVoiceCtx(tune.tune_body!.sequence[0], vxls));

          const actualSystemCount = systems.length;

          if (actualSystemCount !== expectedSystemCount) {
            console.log("ABC:", abc);
            console.log("Expected systems:", expectedSystemCount);
            console.log("Actual systems:", actualSystemCount);
            return false;
          }
          return true;
        }),
        { numRuns: 100, verbose: true }
      );
    });

    it("should detect system boundaries when voice index goes backwards", () => {
      // Property: If we have V:2 followed by V:1, that's a system boundary
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 5 }), // numVoices
          fc.integer({ min: 1, max: 3 }), // numSystems
          (numVoices, numSystems) => {
            // Build ABC with explicit voice cycling (V:1, V:2, ... V:n, V:1, V:2, ...)
            let abc = "X:1\nK:C\n";
            for (let sys = 0; sys < numSystems; sys++) {
              for (let v = 1; v <= numVoices; v++) {
                abc += `V:${v}\nC|D|\n`;
              }
            }

            const ctx = new ABCContext();
            const tokens = Scanner(abc, ctx);
            const parseCtx = new ParseCtx(tokens, ctx);
            const tune = parseTune(parseCtx, undefined, true);
            const vxls = getAllVoices(tune.tune_body!, tune.tune_header.voices);
            const systems = parseVoices(createLinVoiceCtx(tune.tune_body!.sequence[0], vxls));

            const actualSystems = systems.length;

            // Each complete cycle of all voices should be one system
            return actualSystems === numSystems;
          }
        ),
        { numRuns: 50 }
      );
    });

    it("should detect system boundaries on implicit voice continuation (new music line without voice marker)", () => {
      // Property: If V:1 has multiple lines of content, each line after the first starts a new system
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 4 }), (numContentLines) => {
          // Build ABC with single voice but multiple content lines
          let abc = "X:1\nK:C\nV:1\n";
          for (let i = 0; i < numContentLines; i++) {
            abc += "C|D|\n";
          }

          const ctx = new ABCContext();
          const tokens = Scanner(abc, ctx);
          const parseCtx = new ParseCtx(tokens, ctx);
          const tune = parseTune(parseCtx, undefined, true);
          const vxls = getAllVoices(tune.tune_body!, tune.tune_header.voices);
          const systems = parseVoices(createLinVoiceCtx(tune.tune_body!.sequence[0], vxls));

          const actualSystems = systems.length;

          // Each content line becomes its own system in linear mode
          return actualSystems === numContentLines;
        }),
        { numRuns: 20 }
      );
    });

    it("should handle systems with missing voices correctly", () => {
      // Property: When voices are omitted from subsequent systems, system boundaries
      // are still detected correctly based on voice index going backwards
      const genSystemsWithMissingVoices = fc
        .tuple(
          fc.integer({ min: 2, max: 4 }), // numVoices
          fc.integer({ min: 2, max: 4 }) // numSystems
        )
        .chain(([numVoices, numSystems]) => {
          // Generate which voices to include in each subsequent system
          // Each system must have at least one voice, voices in ascending order
          const genSubsetVoices = fc.array(fc.boolean(), { minLength: numVoices, maxLength: numVoices }).map((include) => {
            if (!include.some((v) => v)) include[0] = true;
            return include.map((inc, idx) => (inc ? idx + 1 : null)).filter((v): v is number => v !== null);
          });

          return fc.array(genSubsetVoices, { minLength: numSystems - 1, maxLength: numSystems - 1 }).map((subsets) => {
            // First system has all voices
            const allVoices = Array.from({ length: numVoices }, (_, i) => i + 1);
            const systems = [allVoices, ...subsets];

            // Build ABC and calculate expected systems
            let abc = "X:1\nK:C\n";
            let lastVoiceIdx = -1;
            let expectedSystemCount = 0;

            for (const voices of systems) {
              for (const voiceNum of voices) {
                const voiceIdx = voiceNum - 1;
                if (lastVoiceIdx === -1 || voiceIdx < lastVoiceIdx) {
                  expectedSystemCount++;
                }
                lastVoiceIdx = voiceIdx;
                abc += `V:${voiceNum}\nC|D|\n`;
              }
            }

            // Track which systems have missing voices for reporting
            const systemsWithMissingVoices = systems.filter((s) => s.length < numVoices).length;

            return { abc, expectedSystemCount, numVoices, systems, systemsWithMissingVoices };
          });
        });

      fc.assert(
        fc.property(genSystemsWithMissingVoices, ({ abc, expectedSystemCount, systemsWithMissingVoices }) => {
          const ctx = new ABCContext();
          const tokens = Scanner(abc, ctx);
          const parseCtx = new ParseCtx(tokens, ctx);
          const tune = parseTune(parseCtx, undefined, true);
          const vxls = getAllVoices(tune.tune_body!, tune.tune_header.voices);
          const systems = parseVoices(createLinVoiceCtx(tune.tune_body!.sequence[0], vxls));

          const actualSystemCount = systems.length;

          if (actualSystemCount !== expectedSystemCount) {
            console.log("ABC:", abc);
            console.log("Expected:", expectedSystemCount, "Actual:", actualSystemCount);
            console.log("Systems with missing voices:", systemsWithMissingVoices);
            return false;
          }
          return true;
        }),
        { numRuns: 100 }
      );
    });
  });
});
