import { expect } from "chai";
import { ChordPositionCollector, ChordPosition } from "../interpreter/ChordPositionCollector";
import { findPreviousChordInVoice } from "../music-theory/voiceLeading";
import { SemanticAnalyzer } from "../analyzers/semantic-analyzer";
import { ABCContext } from "../parsers/Context";
import { Scanner } from "../parsers/scan2";
import { parse } from "../parsers/parse2";

/**
 * Helper to parse ABC source and collect chord positions.
 */
function collectChordPositions(source: string, minVoices: number = 4): ChordPosition[] {
  const ctx = new ABCContext();
  const tokens = Scanner(source, ctx);
  const ast = parse(tokens, ctx);
  if (!ast) throw new Error("Parse failed");

  const analyzer = new SemanticAnalyzer(ctx);
  ast.accept(analyzer);

  const collector = new ChordPositionCollector(analyzer.data, minVoices);
  return collector.collect(ast);
}

describe("ChordPositionCollector", () => {
  describe("basic chord collection", () => {
    it("collects position for single 4-note chord", () => {
      const source = "X:1\nK:C\n[CEGc]";
      const positions = collectChordPositions(source);

      expect(positions.length).to.equal(1);
      expect(positions[0].midiPitches).to.deep.equal([60, 64, 67, 72]); // C4, E4, G4, C5
    });

    it("collects positions for multiple chords", () => {
      const source = "X:1\nK:C\n[CEGc] [DFAd]";
      const positions = collectChordPositions(source);

      expect(positions.length).to.equal(2);
      expect(positions[0].midiPitches).to.deep.equal([60, 64, 67, 72]); // C4, E4, G4, C5
      expect(positions[1].midiPitches).to.deep.equal([62, 65, 69, 74]); // D4, F4, A4, D5
    });

    it("sorts pitches from low to high", () => {
      const source = "X:1\nK:C\n[cGEC]";
      const positions = collectChordPositions(source);

      expect(positions.length).to.equal(1);
      // Even though written c, G, E, C - should be sorted to C, E, G, c
      expect(positions[0].midiPitches).to.deep.equal([60, 64, 67, 72]); // C4, E4, G4, C5
    });

    it("filters chords below minVoices", () => {
      const source = "X:1\nK:C\n[CEG]"; // 3-note chord
      const positions = collectChordPositions(source, 4);

      expect(positions.length).to.equal(0);
    });

    it("respects custom minVoices", () => {
      const source = "X:1\nK:C\n[CEG]"; // 3-note chord
      const positions = collectChordPositions(source, 3);

      expect(positions.length).to.equal(1);
    });
  });

  describe("key signature handling", () => {
    it("applies key signature sharps", () => {
      const source = "X:1\nK:G\n[DFAB]"; // G major has F#
      const positions = collectChordPositions(source);

      expect(positions.length).to.equal(1);
      // F should be F# (66 instead of 65)
      expect(positions[0].midiPitches).to.deep.equal([62, 66, 69, 71]); // D4, F#4, A4, B4
    });

    it("applies key signature flats", () => {
      const source = "X:1\nK:F\n[CFAc]"; // F major has Bb, but no B in chord
      const positions = collectChordPositions(source);

      expect(positions.length).to.equal(1);
      // No B in chord, so no effect from Bb
      expect(positions[0].midiPitches).to.deep.equal([60, 65, 69, 72]); // C4, F4, A4, C5
    });

    it("handles minor key signature", () => {
      const source = "X:1\nK:Am\n[CEGc]";
      const positions = collectChordPositions(source);

      expect(positions.length).to.equal(1);
      // A minor has no sharps/flats
      expect(positions[0].midiPitches).to.deep.equal([60, 64, 67, 72]); // C4, E4, G4, C5
    });
  });

  describe("measure accidentals", () => {
    it("applies explicit accidentals", () => {
      const source = "X:1\nK:C\n[C^FAc]"; // F#
      const positions = collectChordPositions(source);

      expect(positions.length).to.equal(1);
      // F is F# (66)
      expect(positions[0].midiPitches).to.deep.equal([60, 66, 69, 72]); // C4, F#4, A4, C5
    });

    it("measure accidentals carry forward", () => {
      const source = "X:1\nK:C\n^F [CFAc]"; // ^F affects F in chord
      const positions = collectChordPositions(source);

      expect(positions.length).to.equal(1);
      // The F in the chord should be F# because of prior ^F
      expect(positions[0].midiPitches).to.deep.equal([60, 66, 69, 72]); // C4, F#4, A4, C5
    });

    it("resets accidentals at barline", () => {
      const source = "X:1\nK:C\n^F | [CFAc]";
      const positions = collectChordPositions(source);

      expect(positions.length).to.equal(1);
      // F should be natural after barline
      expect(positions[0].midiPitches).to.deep.equal([60, 65, 69, 72]); // C4, F4, A4, C5
    });

    it("handles natural accidentals", () => {
      const source = "X:1\nK:G\n[D=FAB]"; // =F cancels F# from key
      const positions = collectChordPositions(source);

      expect(positions.length).to.equal(1);
      // F natural (65)
      expect(positions[0].midiPitches).to.deep.equal([62, 65, 69, 71]); // D4, F4, A4, B4
    });

    it("handles flat accidentals", () => {
      const source = "X:1\nK:C\n[C_EGc]"; // Eb
      const positions = collectChordPositions(source);

      expect(positions.length).to.equal(1);
      // E is Eb (63)
      expect(positions[0].midiPitches).to.deep.equal([60, 63, 67, 72]); // C4, Eb4, G4, C5
    });
  });

  describe("voice tracking", () => {
    it("tracks default voice ID", () => {
      const source = "X:1\nK:C\n[CEGc]";
      const positions = collectChordPositions(source);

      expect(positions.length).to.equal(1);
      expect(positions[0].voiceId).to.equal("");
    });

    it("tracks explicit voice IDs", () => {
      const source = "X:1\nK:C\nV:1\n[CEGc]\nV:2\n[FAce]";
      const positions = collectChordPositions(source);

      expect(positions.length).to.equal(2);
      expect(positions[0].voiceId).to.equal("1");
      expect(positions[1].voiceId).to.equal("2");
    });
  });

  describe("position encoding", () => {
    it("encodes position correctly", () => {
      const source = "X:1\nK:C\n[CEGc]";
      const positions = collectChordPositions(source);

      expect(positions.length).to.equal(1);
      // Position should be non-zero
      expect(positions[0].pos).to.be.greaterThan(0);
    });

    it("maintains order by position", () => {
      const source = "X:1\nK:C\n[CEGc] [DFAd]";
      const positions = collectChordPositions(source);

      expect(positions.length).to.equal(2);
      expect(positions[0].pos).to.be.lessThan(positions[1].pos);
    });
  });
});

describe("findPreviousChordInVoice", () => {
  it("finds previous chord in same voice", () => {
    const positions: ChordPosition[] = [
      { pos: 100, voiceId: "1", midiPitches: [48, 52, 55, 60] },
      { pos: 200, voiceId: "1", midiPitches: [50, 54, 57, 62] },
    ];
    const result = findPreviousChordInVoice(positions, "1", 200);
    expect(result).to.deep.equal([48, 52, 55, 60]);
  });

  it("skips chords in different voice", () => {
    const positions: ChordPosition[] = [
      { pos: 100, voiceId: "1", midiPitches: [48, 52, 55, 60] },
      { pos: 150, voiceId: "2", midiPitches: [36, 40, 43, 48] },
      { pos: 200, voiceId: "1", midiPitches: [50, 54, 57, 62] },
    ];
    const result = findPreviousChordInVoice(positions, "1", 200);
    expect(result).to.deep.equal([48, 52, 55, 60]);
  });

  it("returns null when no previous chord exists", () => {
    const positions: ChordPosition[] = [{ pos: 200, voiceId: "1", midiPitches: [50, 54, 57, 62] }];
    const result = findPreviousChordInVoice(positions, "1", 200);
    expect(result).to.be.null;
  });

  it("returns null for empty positions array", () => {
    const result = findPreviousChordInVoice([], "1", 200);
    expect(result).to.be.null;
  });

  it("returns null when voice has no previous chords", () => {
    const positions: ChordPosition[] = [
      { pos: 100, voiceId: "2", midiPitches: [48, 52, 55, 60] },
      { pos: 150, voiceId: "2", midiPitches: [50, 54, 57, 62] },
    ];
    const result = findPreviousChordInVoice(positions, "1", 200);
    expect(result).to.be.null;
  });

  it("finds most recent chord before position", () => {
    const positions: ChordPosition[] = [
      { pos: 100, voiceId: "1", midiPitches: [48, 52, 55, 60] },
      { pos: 150, voiceId: "1", midiPitches: [50, 54, 57, 62] },
      { pos: 200, voiceId: "1", midiPitches: [52, 55, 59, 64] },
    ];
    const result = findPreviousChordInVoice(positions, "1", 200);
    // Should find pos=150, not pos=100
    expect(result).to.deep.equal([50, 54, 57, 62]);
  });
});
