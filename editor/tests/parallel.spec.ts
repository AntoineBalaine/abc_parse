import { SemanticAnalyzer } from "abc-parser";
import { Scanner, parse } from "abc-parser";
import { ChordPositionCollector, ChordPosition, ChordCollectorConfig } from "abc-parser/interpreter/ChordPositionCollector";
import { ContextInterpreter, DocumentSnapshots } from "abc-parser/interpreter/ContextInterpreter";
import { expect } from "chai";
import { describe, it } from "mocha";
import { ABCContext } from "../../parse/parsers/Context";
import { Token, TT } from "../../parse/parsers/scan2";
import { Pitch } from "../../parse/types/Expr2";
import { fromAst } from "../src/csTree/fromAst";
import { TAGS } from "../src/csTree/types";
import { Selection } from "../src/selection";
import { parallelVoicing, parallelDiatonic, parallelChromatic, calcDiatonicOffset, getPitch, getRhythm, getTie } from "../src/transforms/parallel";
import { formatSelection, findByTag, toCSTreeWithContext } from "./helpers";

interface ParallelTestSetup {
  selection: Selection;
  ctx: ABCContext;
  snapshots: DocumentSnapshots;
  chordPositions: ChordPosition[];
}

interface SetupOptions {
  selectNotes?: boolean;
  includeAstChord?: boolean;
  minVoices?: number;
}

function setupParallelTest(source: string, options: SetupOptions = {}): ParallelTestSetup {
  const ctx = new ABCContext();
  const tokens = Scanner(source, ctx);
  const ast = parse(tokens, ctx);

  const analyzer = new SemanticAnalyzer(ctx);
  ast.accept(analyzer);

  const interpreter = new ContextInterpreter();
  const snapshots = interpreter.interpret(ast, analyzer.data, ctx, { snapshotAccidentals: true });

  const collectorConfig: Partial<ChordCollectorConfig> = {
    includeAstChord: options.includeAstChord ?? true,
    minVoices: options.minVoices ?? 3,
  };
  const collector = new ChordPositionCollector(analyzer.data, collectorConfig);
  const chordPositions = collector.collect(ast);

  // Use the same context and AST for CSTree creation to ensure ID consistency
  const root = fromAst(ast, ctx);

  let selection: Selection;
  if (options.selectNotes) {
    const notes = findByTag(root, TAGS.Note);
    const nonChordNotes = notes.filter((n) => {
      const parent = findParentByRoot(root, n);
      return parent === null || parent.tag !== TAGS.Chord;
    });
    const cursor = new Set(nonChordNotes.map((n) => n.id));
    selection = { root, cursors: [cursor] };
  } else {
    selection = { root, cursors: [new Set([root.id])] };
  }

  return { selection, ctx, snapshots, chordPositions };
}

function findParentByRoot(root: any, target: any): any | null {
  const stack: any[] = [{ node: root, parent: null }];
  while (stack.length > 0) {
    const { node, parent } = stack.pop()!;
    if (node === target) return parent;
    let child = node.firstChild;
    while (child !== null) {
      stack.push({ node: child, parent: node });
      child = child.nextSibling;
    }
  }
  return null;
}

function createPitch(ctx: ABCContext, letter: string, alteration?: string, octaveStr?: string): Pitch {
  const alterationToken = alteration ? new Token(TT.ACCIDENTAL, alteration, ctx.generateId()) : undefined;
  const noteLetterToken = new Token(TT.NOTE_LETTER, letter, ctx.generateId());
  const octaveToken = octaveStr ? new Token(TT.OCTAVE, octaveStr, ctx.generateId()) : undefined;
  return new Pitch(ctx.generateId(), {
    alteration: alterationToken,
    noteLetter: noteLetterToken,
    octave: octaveToken,
  });
}

describe("parallel transform", () => {
  describe("helper functions", () => {
    describe("calcDiatonicOffset", () => {
      it("returns 0 for same pitch", () => {
        const ctx = new ABCContext();
        const pitch1 = createPitch(ctx, "C");
        const pitch2 = createPitch(ctx, "C");
        expect(calcDiatonicOffset(pitch1, pitch2)).to.equal(0);
      });

      it("returns positive for higher target", () => {
        const ctx = new ABCContext();
        const target = createPitch(ctx, "E");
        const ref = createPitch(ctx, "C");
        expect(calcDiatonicOffset(target, ref)).to.equal(2);
      });

      it("returns negative for lower target", () => {
        const ctx = new ABCContext();
        const target = createPitch(ctx, "A", undefined, ",");
        const ref = createPitch(ctx, "C");
        expect(calcDiatonicOffset(target, ref)).to.equal(-2);
      });

      it("accounts for octave in lowercase letters", () => {
        const ctx = new ABCContext();
        const target = createPitch(ctx, "c");
        const ref = createPitch(ctx, "C");
        expect(calcDiatonicOffset(target, ref)).to.equal(7);
      });

      it("accounts for octave markers", () => {
        const ctx = new ABCContext();
        const target = createPitch(ctx, "c", undefined, "'");
        const ref = createPitch(ctx, "C");
        expect(calcDiatonicOffset(target, ref)).to.equal(14);
      });
    });

    describe("getPitch", () => {
      it("extracts pitch from note CSNode", () => {
        const { root } = toCSTreeWithContext("X:1\nK:C\nC");
        const notes = findByTag(root, TAGS.Note);
        expect(notes.length).to.be.greaterThan(0);
        const pitch = getPitch(notes[0]);
        expect(pitch).to.not.be.null;
        expect(pitch!.noteLetter.lexeme).to.equal("C");
      });

      it("returns null for rest", () => {
        const { root } = toCSTreeWithContext("X:1\nK:C\nz");
        const rests = findByTag(root, TAGS.Rest);
        expect(rests.length).to.be.greaterThan(0);
        const pitch = getPitch(rests[0]);
        expect(pitch).to.be.null;
      });
    });

    describe("getRhythm", () => {
      it("extracts rhythm from note with explicit rhythm", () => {
        const { root } = toCSTreeWithContext("X:1\nK:C\nC4");
        const notes = findByTag(root, TAGS.Note);
        const rhythm = getRhythm(notes[0]);
        expect(rhythm).to.not.be.null;
      });

      it("returns null for note without rhythm", () => {
        const { root } = toCSTreeWithContext("X:1\nK:C\nC");
        const notes = findByTag(root, TAGS.Note);
        const rhythm = getRhythm(notes[0]);
        expect(rhythm).to.be.null;
      });
    });

    describe("getTie", () => {
      it("extracts tie from note with tie", () => {
        const { root } = toCSTreeWithContext("X:1\nK:C\nC-C");
        const notes = findByTag(root, TAGS.Note);
        const tie = getTie(notes[0]);
        expect(tie).to.not.be.null;
        expect(tie!.lexeme).to.equal("-");
      });

      it("returns null for note without tie", () => {
        const { root } = toCSTreeWithContext("X:1\nK:C\nC");
        const notes = findByTag(root, TAGS.Note);
        const tie = getTie(notes[0]);
        expect(tie).to.be.null;
      });
    });
  });

  describe("parallelDiatonic", () => {
    it("replaces a note with a chord shifted diatonically from previous chord", () => {
      const source = "X:1\nK:C\n[CEG]2 A2";
      const { selection, ctx, snapshots, chordPositions } = setupParallelTest(source, {
        selectNotes: true,
        includeAstChord: true,
      });

      parallelDiatonic(selection, "prev", ctx, snapshots, chordPositions);

      const result = formatSelection(selection);
      expect(result).to.equal("X:1\nK:C\n[CEG]2 [DFA]2");
    });

    it("preserves rhythm from target note", () => {
      const source = "X:1\nK:C\n[CEG]2 A4";
      const { selection, ctx, snapshots, chordPositions } = setupParallelTest(source, {
        selectNotes: true,
        includeAstChord: true,
      });

      parallelDiatonic(selection, "prev", ctx, snapshots, chordPositions);

      const result = formatSelection(selection);
      expect(result).to.equal("X:1\nK:C\n[CEG]2 [DFA]4");
    });

    it("preserves tie from target note", () => {
      // Both A notes are 1 step above G (top of [CEG]), so both become [DFA]
      const source = "X:1\nK:C\n[CEG]2 A4-A4";
      const { selection, ctx, snapshots, chordPositions } = setupParallelTest(source, {
        selectNotes: true,
        includeAstChord: true,
      });

      parallelDiatonic(selection, "prev", ctx, snapshots, chordPositions);

      const result = formatSelection(selection);
      expect(result).to.equal("X:1\nK:C\n[CEG]2 [DFA]4-[DFA]4");
    });

    it("handles next direction", () => {
      // G4 is 1 diatonic step below A4 (top of [DFA]), so [DFA] shifted -1 = [CEG]
      const source = "X:1\nK:C\nG2 [DFA]2";
      const { selection, ctx, snapshots, chordPositions } = setupParallelTest(source, {
        selectNotes: true,
        includeAstChord: true,
      });

      parallelDiatonic(selection, "next", ctx, snapshots, chordPositions);

      const result = formatSelection(selection);
      expect(result).to.equal("X:1\nK:C\n[CEG]2 [DFA]2");
    });

    it("silent failure when no reference chord exists", () => {
      const source = "X:1\nK:C\nC D E";
      const { selection, ctx, snapshots, chordPositions } = setupParallelTest(source, {
        selectNotes: true,
        includeAstChord: true,
      });

      parallelDiatonic(selection, "prev", ctx, snapshots, chordPositions);

      const result = formatSelection(selection);
      expect(result).to.equal("X:1\nK:C\nC D E");
    });

    it("applies key signature accidentals when shifting", () => {
      const source = "X:1\nK:G\n[GBd]2 e2";
      const { selection, ctx, snapshots, chordPositions } = setupParallelTest(source, {
        selectNotes: true,
        includeAstChord: true,
      });

      parallelDiatonic(selection, "prev", ctx, snapshots, chordPositions);

      const result = formatSelection(selection);
      expect(result).to.equal("X:1\nK:G\n[GBd]2 [Ace]2");
    });

    it("shifts down when target is below reference", () => {
      // E4 is 6 diatonic steps below d (D5), so [GBd] shifted -6 = [A,CE]
      // d(D5)->E4, B(B4)->C4, G(G4)->A3
      const source = "X:1\nK:C\n[GBd]2 E2";
      const { selection, ctx, snapshots, chordPositions } = setupParallelTest(source, {
        selectNotes: true,
        includeAstChord: true,
      });

      parallelDiatonic(selection, "prev", ctx, snapshots, chordPositions);

      const result = formatSelection(selection);
      expect(result).to.equal("X:1\nK:C\n[GBd]2 [A,CE]2");
    });

    it("handles chord in minor key", () => {
      // B4 is 1 diatonic step above A4 (top note by MIDI of [ACE]), so [ACE] shifted +1 = [BDF]
      // A4 (MIDI 69) is highest, not E4 (64)
      // A4->B4, C4->D4, E4->F4
      const source = "X:1\nK:Am\n[ACE]2 B2";
      const { selection, ctx, snapshots, chordPositions } = setupParallelTest(source, {
        selectNotes: true,
        includeAstChord: true,
      });

      parallelDiatonic(selection, "prev", ctx, snapshots, chordPositions);

      const result = formatSelection(selection);
      expect(result).to.equal("X:1\nK:Am\n[ACE]2 [BDF]2");
    });
  });

  describe("parallelChromatic", () => {
    it("replaces a note with a chord shifted chromatically from previous chord", () => {
      // A4 (MIDI 69) is 2 semitones above G4 (MIDI 67)
      // C+2=D, E+2=F#, G+2=A -> [D^FA]
      // Note: Using natural A to avoid accidental extraction issues in test
      const source = "X:1\nK:C\n[CEG]2 A2";
      const { selection, ctx, snapshots, chordPositions } = setupParallelTest(source, {
        selectNotes: true,
      });

      parallelChromatic(selection, "prev", ctx, snapshots, chordPositions);

      const result = formatSelection(selection);
      expect(result).to.equal("X:1\nK:C\n[CEG]2 [D^FA]2");
    });

    it("preserves rhythm and tie from target note", () => {
      // A4 (MIDI 69) is 2 semitones above G4 (MIDI 67)
      // C+2=D, E+2=F#, G+2=A -> [D^FA]
      // Testing single note with rhythm and tie
      const source = "X:1\nK:C\n[CEG]2 A4-";
      const { selection, ctx, snapshots, chordPositions } = setupParallelTest(source, {
        selectNotes: true,
      });

      parallelChromatic(selection, "prev", ctx, snapshots, chordPositions);

      const result = formatSelection(selection);
      expect(result).to.equal("X:1\nK:C\n[CEG]2 [D^FA]4-");
    });

    it("uses context-appropriate spelling for chromatic pitches", () => {
      // In F major (Bb), d (D5, MIDI 74) is 2 semitones above c (C5, MIDI 72)
      // F+2=G, A+2=B (but key has Bb, so needs =B), c+2=d -> [G=Bd]
      const source = "X:1\nK:F\n[FAc]2 d2";
      const { selection, ctx, snapshots, chordPositions } = setupParallelTest(source, {
        selectNotes: true,
      });

      parallelChromatic(selection, "prev", ctx, snapshots, chordPositions);

      const result = formatSelection(selection);
      expect(result).to.equal("X:1\nK:F\n[FAc]2 [G=Bd]2");
    });

    it("silent failure when no reference chord exists", () => {
      // Bar line at start ensures the first note is not at position 0 of the tune body,
      // so the snapshot query for pos-1 finds the initial snapshot.
      const source = "X:1\nK:C\n|C D E";
      const { selection, ctx, snapshots, chordPositions } = setupParallelTest(source, {
        selectNotes: true,
      });

      parallelChromatic(selection, "prev", ctx, snapshots, chordPositions);

      const result = formatSelection(selection);
      expect(result).to.equal("X:1\nK:C\n|C D E");
    });

    it("handles downward chromatic shift", () => {
      // F4 (MIDI 65) is 2 semitones below G4 (MIDI 67)
      // C4-2=Bb3, E4-2=D4, G4-2=F4 -> [_B,DF]
      // Note: Bb3 is written as _B, in ABC (comma indicates octave 3)
      const source = "X:1\nK:C\n[CEG]2 F2";
      const { selection, ctx, snapshots, chordPositions } = setupParallelTest(source, {
        selectNotes: true,
      });

      parallelChromatic(selection, "prev", ctx, snapshots, chordPositions);

      const result = formatSelection(selection);
      expect(result).to.equal("X:1\nK:C\n[CEG]2 [_B,DF]2");
    });

    it("handles next direction", () => {
      // F4 (MIDI 65) is 4 semitones below A4 (MIDI 69, top of [ACE])
      // A4-4=F4, C4-4=Ab3, E4-4=C4 -> [_A,CF]
      // Note: Ab3 is written as _A, in ABC (comma indicates octave 3)
      // Bar line at start ensures the first note is not at position 0 of the tune body.
      const source = "X:1\nK:C\n|F2 [ACE]2";
      const { selection, ctx, snapshots, chordPositions } = setupParallelTest(source, {
        selectNotes: true,
      });

      parallelChromatic(selection, "next", ctx, snapshots, chordPositions);

      const result = formatSelection(selection);
      expect(result).to.equal("X:1\nK:C\n|[_A,CF]2 [ACE]2");
    });

    it("handles natural accidentals after measure flats", () => {
      // Reference chord [DG_B] has D4, G4, Bb4 (MIDI 62, 67, 70)
      // Target =B is B natural (MIDI 71)
      // Chromatic shift = 71 - 70 = +1
      // D4+1=D#4, G4+1=G#4, Bb4+1=B4 -> [^D^G=B]
      // The =B needs explicit natural because measure has B flat from _B
      const source = 'X:1\nK:C\n"Cm7"[DG_B] "G7"=B';
      const { selection, ctx, snapshots, chordPositions } = setupParallelTest(source, {
        selectNotes: true,
      });

      parallelChromatic(selection, "prev", ctx, snapshots, chordPositions);

      const result = formatSelection(selection);
      expect(result).to.equal('X:1\nK:C\n"Cm7"[DG_B] "G7"[^D^G=B]');
    });
  });

  describe("parallelVoicing (unified entry point)", () => {
    it("dispatches to diatonic mode when mode is 'diatonic'", () => {
      const source = "X:1\nK:C\n[CEG]2 A2";
      const { selection, ctx, snapshots, chordPositions } = setupParallelTest(source, {
        selectNotes: true,
        includeAstChord: true,
      });

      parallelVoicing(selection, "prev", "diatonic", ctx, snapshots, chordPositions);

      const result = formatSelection(selection);
      expect(result).to.equal("X:1\nK:C\n[CEG]2 [DFA]2");
    });

    it("dispatches to chromatic mode when mode is 'chromatic'", () => {
      const source = "X:1\nK:C\n[CEG]2 A2";
      const { selection, ctx, snapshots, chordPositions } = setupParallelTest(source, {
        selectNotes: true,
      });

      parallelVoicing(selection, "prev", "chromatic", ctx, snapshots, chordPositions);

      const result = formatSelection(selection);
      expect(result).to.equal("X:1\nK:C\n[CEG]2 [D^FA]2");
    });
  });
});
