import { ABCContext, Scanner, parse, AbcFormatter, Expr, AbcErrorReporter, SemanticAnalyzer, isBarLine, BarEntry, BarMap, buildBarMap } from "abc-parser";
import { ContextInterpreter, DocumentSnapshots } from "abc-parser/interpreter/ContextInterpreter";
import { Token, TT } from "abc-parser/parsers/scan2";
import { Note, Chord, Rest, Grace_group, Pitch, Rhythm, System, Tune, Tune_Body, BarLine } from "abc-parser/types/Expr2";
import { calculateDuration } from "abc-parser/Visitors/fmt2/fmt_timeMap";
import { createRational, rationalToNumber } from "abc-parser/Visitors/fmt2/rational";
import { expect } from "chai";
import { describe, it } from "mocha";
import { fromAst } from "../src/csTree/fromAst";
import { toAst } from "../src/csTree/toAst";
import { createSelection, Selection } from "../src/selection";
import { selectRange } from "../src/selectors/rangeSelector";
import {
  explosion,
  filterChordToPart,
  walkAndFilter,
  getBarSlice,
  getVoiceIdsFromSelection,
  getSourceBarRange,
  extractBarsContent,
  assignParts,
  filterToParts,
  SourceVoiceContent,
  cursorRangeToTimeRange,
  splitNoteAt,
  replaceTimeRangeInBar,
  findBarEntry,
} from "../src/transforms/explosionTimed";

function makeNote(letter: string, ctx: ABCContext): Note {
  const noteLetter = new Token(TT.NOTE_LETTER, letter, ctx.generateId());
  const pitch = new Pitch(ctx.generateId(), { noteLetter });
  return new Note(ctx.generateId(), pitch);
}

function makeChord(letters: string[], ctx: ABCContext, rhythm?: Rhythm): Chord {
  // Notes are stored bottom-up in Chord.contents, so the first letter
  // in the array is the bottom note.
  const notes = letters.map((l) => makeNote(l, ctx));
  return new Chord(ctx.generateId(), notes, rhythm);
}

function makeGraceGroup(letters: string[], ctx: ABCContext): Grace_group {
  const notes = letters.map((l) => makeNote(l, ctx));
  const leftBrace = new Token(TT.GRC_GRP_LEFT_BRACE, "{", ctx.generateId());
  const rightBrace = new Token(TT.RBRACE, "}", ctx.generateId());
  return new Grace_group(ctx.generateId(), notes, false, leftBrace, rightBrace);
}

function createFullTestContext(abc: string): {
  selection: Selection;
  ctx: ABCContext;
  snapshots: DocumentSnapshots;
} {
  const ctx = new ABCContext(new AbcErrorReporter());
  const tokens = Scanner(abc, ctx);
  const ast = parse(tokens, ctx);
  const root = fromAst(ast, ctx);
  const selection = createSelection(root);

  const analyzer = new SemanticAnalyzer(ctx);
  ast.accept(analyzer);

  const interpreter = new ContextInterpreter();
  const snapshots = interpreter.interpret(ast, analyzer.data, ctx);

  return { selection, ctx, snapshots };
}

function createBarMapTestContext(abc: string): {
  tuneBody: Tune_Body;
  ctx: ABCContext;
  snapshots: DocumentSnapshots;
} {
  const ctx = new ABCContext(new AbcErrorReporter());
  const tokens = Scanner(abc, ctx);
  const ast = parse(tokens, ctx);
  const tune = ast.contents[0] as Tune;

  const analyzer = new SemanticAnalyzer(ctx);
  ast.accept(analyzer);

  const interpreter = new ContextInterpreter();
  const snapshots = interpreter.interpret(ast, analyzer.data, ctx);

  return { tuneBody: tune.tune_body!, ctx, snapshots };
}

function getTuneBody(abc: string): { tuneBody: Tune_Body; ctx: ABCContext } {
  const ctx = new ABCContext(new AbcErrorReporter());
  const tokens = Scanner(abc, ctx);
  const ast = parse(tokens, ctx);
  const tune = ast.contents[0] as Tune;
  return { tuneBody: tune.tune_body!, ctx };
}

describe("explosionTimed", () => {
  describe("filterChordToPart", () => {
    it("3-note chord [CEG] filtered with partIndices [0] keeps top note G (unwrapped)", () => {
      const ctx = new ABCContext();
      // Notes stored bottom-up: C, E, G. Top note (part 0) = G.
      const chord = makeChord(["C", "E", "G"], ctx);
      const content: System = [chord];

      filterChordToPart(content, 0, [0], ctx);

      // Should be unwrapped to a single Note with pitch G
      expect(content[0]).to.be.instanceOf(Note);
      const note = content[0] as Note;
      expect(note.pitch.noteLetter.lexeme).to.equal("G");
    });

    it("3-note chord [CEG] filtered with partIndices [2] keeps bottom note C (unwrapped)", () => {
      const ctx = new ABCContext();
      const chord = makeChord(["C", "E", "G"], ctx);
      const content: System = [chord];

      filterChordToPart(content, 0, [2], ctx);

      expect(content[0]).to.be.instanceOf(Note);
      const note = content[0] as Note;
      expect(note.pitch.noteLetter.lexeme).to.equal("C");
    });

    it("3-note chord [CEG] filtered with partIndices [1, 2] keeps [CE] (stays as chord)", () => {
      const ctx = new ABCContext();
      const chord = makeChord(["C", "E", "G"], ctx);
      const content: System = [chord];

      filterChordToPart(content, 0, [1, 2], ctx);

      expect(content[0]).to.be.instanceOf(Chord);
      const result = content[0] as Chord;
      const notes = result.contents.filter((e): e is Note => e instanceof Note);
      expect(notes).to.have.lengthOf(2);
      expect(notes[0].pitch.noteLetter.lexeme).to.equal("C");
      expect(notes[1].pitch.noteLetter.lexeme).to.equal("E");
    });

    it("2-note chord [CE] filtered with partIndices [0, 1, 2] keeps [CE] (excess indices ignored)", () => {
      const ctx = new ABCContext();
      const chord = makeChord(["C", "E"], ctx);
      const content: System = [chord];

      filterChordToPart(content, 0, [0, 1, 2], ctx);

      expect(content[0]).to.be.instanceOf(Chord);
      const result = content[0] as Chord;
      const notes = result.contents.filter((e): e is Note => e instanceof Note);
      expect(notes).to.have.lengthOf(2);
    });

    it("1-note chord filtered with partIndices [3] becomes a rest (all indices exceed chord size)", () => {
      const ctx = new ABCContext();
      const chord = makeChord(["C"], ctx);
      const content: System = [chord];

      filterChordToPart(content, 0, [3], ctx);

      expect(content[0]).to.be.instanceOf(Rest);
    });

    it("chord's rhythm is carried over to unwrapped note", () => {
      const ctx = new ABCContext();
      const numToken = new Token(TT.RHY_NUMER, "2", ctx.generateId());
      const rhythm = new Rhythm(ctx.generateId(), numToken);
      const chord = makeChord(["C", "E", "G"], ctx, rhythm);
      const content: System = [chord];

      filterChordToPart(content, 0, [0], ctx);

      expect(content[0]).to.be.instanceOf(Note);
      const note = content[0] as Note;
      expect(note.rhythm).to.equal(rhythm);
    });
  });

  describe("walkAndFilter", () => {
    it("partIndices [0] on [CEG] A preserves standalone note A and keeps top note G", () => {
      const ctx = new ABCContext();
      const chord = makeChord(["C", "E", "G"], ctx);
      const noteA = makeNote("A", ctx);
      const content: System = [chord, noteA];

      walkAndFilter(content, [0], ctx);

      // Chord should be unwrapped to G (top note)
      expect(content[0]).to.be.instanceOf(Note);
      expect((content[0] as Note).pitch.noteLetter.lexeme).to.equal("G");
      // Standalone note A should be preserved (part 0 keeps notes)
      expect(content[1]).to.be.instanceOf(Note);
      expect((content[1] as Note).pitch.noteLetter.lexeme).to.equal("A");
    });

    it("partIndices [1] on [CEG] A converts standalone note A to rest and keeps middle note E", () => {
      const ctx = new ABCContext();
      const chord = makeChord(["C", "E", "G"], ctx);
      const noteA = makeNote("A", ctx);
      const content: System = [chord, noteA];

      walkAndFilter(content, [1], ctx);

      // Chord should be unwrapped to E (middle note, part index 1)
      expect(content[0]).to.be.instanceOf(Note);
      expect((content[0] as Note).pitch.noteLetter.lexeme).to.equal("E");
      // Standalone note A should become a rest (lower part)
      expect(content[1]).to.be.instanceOf(Rest);
    });

    it("partIndices [0] on {abc} [CEG] preserves the grace group", () => {
      const ctx = new ABCContext();
      const grace = makeGraceGroup(["a", "b", "c"], ctx);
      const chord = makeChord(["C", "E", "G"], ctx);
      const content: System = [grace, chord];

      walkAndFilter(content, [0], ctx);

      expect(content).to.have.lengthOf(2);
      expect(content[0]).to.be.instanceOf(Grace_group);
    });

    it("partIndices [1] on {abc} [CEG] removes the grace group", () => {
      const ctx = new ABCContext();
      const grace = makeGraceGroup(["a", "b", "c"], ctx);
      const chord = makeChord(["C", "E", "G"], ctx);
      const content: System = [grace, chord];

      walkAndFilter(content, [1], ctx);

      // Grace group should be removed for lower parts
      expect(content).to.have.lengthOf(1);
      expect(content[0]).to.be.instanceOf(Note);
      expect((content[0] as Note).pitch.noteLetter.lexeme).to.equal("E");
    });
  });

  describe("buildBarMap", () => {
    it("single system, single voice: 3 barlines produce 3 bar entries", () => {
      const { tuneBody } = getTuneBody("X:1\nK:C\nC D | E F | G A |\n");
      const barMap = buildBarMap(tuneBody, "1");

      expect(barMap.has("1")).to.be.true;
      const voice1 = barMap.get("1")!;
      expect(voice1.size).to.equal(3);

      // Bar numbers should be 0, 1, 2
      expect(voice1.has(0)).to.be.true;
      expect(voice1.has(1)).to.be.true;
      expect(voice1.has(2)).to.be.true;

      // Each entry's nodeId should match the corresponding barline's ID
      for (const [barNum, entry] of voice1) {
        expect(entry.barNumber).to.equal(barNum);
        expect(entry.closingNodeId).to.be.a("number");
      }
    });

    it("single system, multi-voice: each voice gets independent bar numbering", () => {
      const { tuneBody } = getTuneBody("X:1\nK:C\nC D | E F |[V:2] G A | B c |\n");
      const barMap = buildBarMap(tuneBody, "1");

      expect(barMap.has("1")).to.be.true;
      expect(barMap.has("2")).to.be.true;

      const voice1 = barMap.get("1")!;
      const voice2 = barMap.get("2")!;

      // V:1 has 2 barlines, V:2 has 2 barlines
      expect(voice1.size).to.equal(2);
      expect(voice2.size).to.equal(2);

      // Each voice starts numbering at 0
      expect(voice1.has(0)).to.be.true;
      expect(voice1.has(1)).to.be.true;
      expect(voice2.has(0)).to.be.true;
      expect(voice2.has(1)).to.be.true;
    });

    it("multiple systems: bar numbering accumulates across systems", () => {
      const { tuneBody } = getTuneBody("X:1\nK:C\nC D | E F |\nG A | B c |\n");
      const barMap = buildBarMap(tuneBody, "1");

      const voice1 = barMap.get("1")!;
      // 2 barlines per system, 2 systems = 4 cumulative entries
      expect(voice1.size).to.equal(4);
      expect(voice1.has(0)).to.be.true;
      expect(voice1.has(1)).to.be.true;
      expect(voice1.has(2)).to.be.true;
      expect(voice1.has(3)).to.be.true;
    });

    it("voice with no barlines but with content produces one bar entry", () => {
      // No barlines at all -- the finalize() call closes the bar for voice "1"
      const { tuneBody } = getTuneBody("X:1\nK:C\nC D E F\n");
      const barMap = buildBarMap(tuneBody, "1");

      const voice1 = barMap.get("1")!;
      expect(voice1.size).to.equal(1);
      expect(voice1.has(0)).to.be.true;
      // The closing anchor should be the last content node's ID (not a barline)
      expect(voice1.get(0)!.closingNodeId).to.be.a("number");
    });

    it("content after last barline produces a final bar", () => {
      // "C D | E F" -- bar 0 closed by barline, bar 1 closed by finalize
      const { tuneBody } = getTuneBody("X:1\nK:C\nC D | E F\n");
      const barMap = buildBarMap(tuneBody, "1");

      const voice1 = barMap.get("1")!;
      // Bar 0 from the barline, bar 1 from content after barline (closed by EOL)
      expect(voice1.size).to.equal(2);
      expect(voice1.has(0)).to.be.true;
      expect(voice1.has(1)).to.be.true;
    });

    it("barline followed by EOL does not produce a spurious empty bar", () => {
      const { tuneBody } = getTuneBody("X:1\nK:C\nC D |\n");
      const barMap = buildBarMap(tuneBody, "1");

      const voice1 = barMap.get("1")!;
      // Only 1 bar (closed by the barline), no extra bar from the EOL
      expect(voice1.size).to.equal(1);
    });

    it("multi-voice linear system where one voice has no barlines", () => {
      // Voice 1 has a barline, voice 2 has content but no barline
      const { tuneBody } = getTuneBody("X:1\nK:C\nC D |[V:2] G A\n");
      const barMap = buildBarMap(tuneBody, "1");

      expect(barMap.has("1")).to.be.true;
      expect(barMap.has("2")).to.be.true;

      const voice1 = barMap.get("1")!;
      const voice2 = barMap.get("2")!;

      expect(voice1.size).to.equal(1);
      // Voice 2 has content but no barline; EOL or finalize should close it
      expect(voice2.size).to.equal(1);
    });

    it("two consecutive barlines produce an empty bar between them", () => {
      // Using "| |" (space between barlines) so the parser produces two separate BarLine nodes
      const { tuneBody } = getTuneBody("X:1\nK:C\nC D | | E F |\n");
      const barMap = buildBarMap(tuneBody, "1");

      const voice1 = barMap.get("1")!;
      // Bar 0 from first |, bar 1 (empty) from second |, bar 2 from third |
      expect(voice1.size).to.equal(3);
    });

    it("two consecutive voice markers with no content: first voice has zero entries", () => {
      // [V:1] immediately followed by [V:2] -- voice 1 has no content
      const { tuneBody } = getTuneBody("X:1\nK:C\n[V:1][V:2]C D |\n");
      const barMap = buildBarMap(tuneBody, "default");

      // Voice "1" was entered and exited without any content
      const voice1 = barMap.get("1");
      expect(voice1).to.not.be.undefined;
      expect(voice1!.size).to.equal(0);

      // Voice "2" has one barline
      expect(barMap.has("2")).to.be.true;
      expect(barMap.get("2")!.size).to.equal(1);
    });

    it("default voice with no voice markers in the tune", () => {
      const { tuneBody } = getTuneBody("X:1\nK:C\nC D | E F |\n");
      const barMap = buildBarMap(tuneBody, "default");

      expect(barMap.has("default")).to.be.true;
      const defaultVoice = barMap.get("default")!;
      expect(defaultVoice.size).to.equal(2);
    });

    it("startingVoiceId has no content before the first voice marker", () => {
      // The starting voice "default" has no content, then [V:1] starts
      const { tuneBody } = getTuneBody("X:1\nK:C\n[V:1]C D |\n");
      const barMap = buildBarMap(tuneBody, "default");

      const defaultVoice = barMap.get("default");
      expect(defaultVoice).to.not.be.undefined;
      expect(defaultVoice!.size).to.equal(0);

      expect(barMap.has("1")).to.be.true;
      expect(barMap.get("1")!.size).to.equal(1);
    });
  });

  describe("getBarSlice", () => {
    function parseSystem(abc: string): { system: System; ctx: ABCContext } {
      const ctx = new ABCContext(new AbcErrorReporter());
      const tokens = Scanner(abc, ctx);
      const ast = parse(tokens, ctx);
      const tune = ast.contents[0] as Tune;
      return { system: tune.tune_body!.sequence[0], ctx };
    }

    function barEntryFor(nodeId: number, barNumber: number = 0): BarEntry {
      return { barNumber, closingNodeId: nodeId };
    }

    it("returns the content boundaries before the first barline", () => {
      const { system } = parseSystem("X:1\nK:C\nC D | E F |\n");

      const firstBarline = system.find((e) => isBarLine(e)) as BarLine;
      expect(firstBarline).to.not.be.undefined;

      const slice = getBarSlice(system, barEntryFor(firstBarline.id));
      expect(slice).to.not.be.null;
      expect(slice!.startIdx).to.equal(0);
      // Because the anchor is a barline, endIdx excludes it
      expect(slice!.endIdx).to.be.greaterThan(0);
      expect(slice!.content).to.equal(system);
    });

    it("returns the content boundaries between two barlines", () => {
      const { system } = parseSystem("X:1\nK:C\nC D | E F |\n");

      const barlines = system.filter((e) => isBarLine(e)) as BarLine[];
      expect(barlines.length).to.be.greaterThanOrEqual(2);

      const slice = getBarSlice(system, barEntryFor(barlines[1].id, 1));
      expect(slice).to.not.be.null;
      expect(slice!.startIdx).to.be.greaterThan(0);
      expect(slice!.endIdx).to.be.greaterThan(slice!.startIdx);
    });

    it("returns null for a non-existent node ID", () => {
      const { system } = parseSystem("X:1\nK:C\nC D | E F |\n");
      const slice = getBarSlice(system, barEntryFor(999999));
      expect(slice).to.be.null;
    });

    it("stops at voice markers when walking backward", () => {
      const { system } = parseSystem("X:1\nK:C\nC D |[V:2] G A |\n");

      const barlines = system.filter((e) => isBarLine(e)) as BarLine[];
      const lastBarline = barlines[barlines.length - 1];

      const slice = getBarSlice(system, barEntryFor(lastBarline.id, 1));
      expect(slice).to.not.be.null;
      const firstBarlineIdx = system.indexOf(barlines[0]);
      expect(slice!.startIdx).to.be.greaterThan(firstBarlineIdx);
    });

    it("closing anchor is a content node: endIdx includes the node", () => {
      // Build a bar map where the last bar has no trailing barline
      const { tuneBody } = getTuneBody("X:1\nK:C\nC D | E F\n");
      const barMap = buildBarMap(tuneBody, "1");

      const voice1 = barMap.get("1")!;
      // Bar 1 is the content after the barline, closed by EOL/finalize
      const bar1 = voice1.get(1)!;

      const system = tuneBody.sequence[0];
      const slice = getBarSlice(system, bar1);
      expect(slice).to.not.be.null;

      // The anchor is NOT a barline, so endIdx should include it (anchorIdx + 1)
      const anchorIdx = system.findIndex((e) => e.id === bar1.closingNodeId);
      expect(slice!.endIdx).to.equal(anchorIdx + 1);
    });

    it("second system's bar starts at index 0", () => {
      // The parser splits systems at EOL tokens, so each system starts fresh.
      // The backward walk in the second system should reach index 0.
      const { tuneBody } = getTuneBody("X:1\nK:C\nC D |\nE F |\n");

      const system2 = tuneBody.sequence[1];
      const barline = system2.find((e) => isBarLine(e)) as BarLine;
      expect(barline).to.not.be.undefined;

      const slice = getBarSlice(system2, barEntryFor(barline.id));
      expect(slice).to.not.be.null;
      expect(slice!.startIdx).to.equal(0);
    });
  });

  describe("getVoiceIdsFromSelection", () => {
    it("selection within V:1 content returns only voice 1", () => {
      const abc = "X:1\nV:1\nV:2\nK:C\n[V:1]C D E|[V:2]F G A|\n";
      const { selection, snapshots } = createFullTestContext(abc);

      const scoped = selectRange(selection, 4, 5, 4, 9);

      const voiceIds = getVoiceIdsFromSelection(scoped, snapshots);
      expect(voiceIds.has("1")).to.be.true;
      expect(voiceIds.has("2")).to.be.false;
    });

    it("selection spanning a voice marker returns both voices", () => {
      const abc = "X:1\nV:1\nV:2\nK:C\n[V:1]C D E|[V:2]F G A|\n";
      const { selection, snapshots } = createFullTestContext(abc);

      const scoped = selectRange(selection, 4, 5, 4, 19);

      const voiceIds = getVoiceIdsFromSelection(scoped, snapshots);
      expect(voiceIds.has("1")).to.be.true;
      expect(voiceIds.has("2")).to.be.true;
    });
  });

  describe("getSourceBarRange", () => {
    it("cursor on first bar returns start=0, end=0", () => {
      // Because the interpreter uses "" as the default voice ID for single-voice
      // tunes, we must use "" as the starting voice ID for buildBarMap so that the
      // bar map's voice keys match what resolveVoiceAtPosition returns.
      const abc = "X:1\nK:C\nC D | E F |\n";
      const { tuneBody, snapshots } = createBarMapTestContext(abc);
      const barMap = buildBarMap(tuneBody, "");

      const cursorRange = { start: { line: 2, character: 0 }, end: { line: 2, character: 3 } };
      const range = getSourceBarRange(barMap, tuneBody.sequence, cursorRange, snapshots);

      expect(range.start).to.equal(0);
      expect(range.end).to.equal(0);
    });

    it("cursor spanning both bars returns start=0, end=1", () => {
      const abc = "X:1\nK:C\nC D | E F |\n";
      const { tuneBody, snapshots } = createBarMapTestContext(abc);
      const barMap = buildBarMap(tuneBody, "");

      // Cursor spanning from "C" (char 0) through "F" (char 9), crossing the first barline at char 4
      const cursorRange = { start: { line: 2, character: 0 }, end: { line: 2, character: 9 } };
      const range = getSourceBarRange(barMap, tuneBody.sequence, cursorRange, snapshots);

      expect(range.start).to.equal(0);
      expect(range.end).to.equal(1);
    });
  });

  describe("extractBarsContent", () => {
    it("extracts bars 1 and 2 with barline delimiter, skipping bar 0", () => {
      const abc = "X:1\nK:C\nA B | C D | E F |\n";
      const { tuneBody, ctx } = createBarMapTestContext(abc);
      const barMap = buildBarMap(tuneBody, "1");

      const content = extractBarsContent(barMap, { start: 1, end: 2 }, "1", tuneBody.sequence);

      // Should contain content of bars 1 and 2, with a barline between them
      const formatter = new AbcFormatter(ctx);
      const text = content
        .map((e) => {
          if (e instanceof Token) return e.lexeme;
          return formatter.stringify(e as Expr);
        })
        .join("");

      // Should have the content from bar 1 ("C D" or similar), a barline, then bar 2
      expect(text).to.include("|");
      // Should NOT have "A" or "B" from bar 0
      expect(text).to.not.include("A");
      expect(text).to.not.include("B");
    });

    it("trailing bar with content-node anchor: no spurious barline delimiter", () => {
      // "A B | C D" -- bar 0 closed by barline, bar 1 closed by content node (via EOL/finalize)
      const abc = "X:1\nK:C\nA B | C D\n";
      const { tuneBody, ctx } = createBarMapTestContext(abc);
      const barMap = buildBarMap(tuneBody, "1");

      // Extract bars 0 and 1
      const content = extractBarsContent(barMap, { start: 0, end: 1 }, "1", tuneBody.sequence);
      const formatter = new AbcFormatter(ctx);
      const text = content
        .map((e) => {
          if (e instanceof Token) return e.lexeme;
          return formatter.stringify(e as Expr);
        })
        .join("");

      // Bar 0's anchor is a barline, so a delimiter is inserted.
      // Bar 1's content should include "C" and "D".
      expect(text).to.include("C");
      expect(text).to.include("D");
    });

    it("barRange.end exceeding actual bar count returns only existing bars", () => {
      const abc = "X:1\nK:C\nA B | C D |\n";
      const { tuneBody } = createBarMapTestContext(abc);
      const barMap = buildBarMap(tuneBody, "1");

      // Ask for bars 0..10, but only 2 bars exist
      const content = extractBarsContent(barMap, { start: 0, end: 10 }, "1", tuneBody.sequence);
      // Should not crash and should return content for the 2 existing bars
      expect(content.length).to.be.greaterThan(0);
    });
  });

  describe("assignParts", () => {
    it("one source voice with max chord size 3, 3 targets: assigns [0], [1], [2]", () => {
      const ctx = new ABCContext();
      const chord = makeChord(["C", "E", "G"], ctx);
      const sourceContents: SourceVoiceContent[] = [{ voiceId: "1", content: [chord] }];

      const assignments = assignParts(sourceContents, ["T1", "T2", "T3"]);

      expect(assignments.get("T1")!.partIndices).to.deep.equal([0]);
      expect(assignments.get("T2")!.partIndices).to.deep.equal([1]);
      expect(assignments.get("T3")!.partIndices).to.deep.equal([2]);
      // All should reference source voice "1"
      expect(assignments.get("T1")!.sourceVoiceId).to.equal("1");
    });

    it("one source voice with max chord size 3, 2 targets: last target gets leftover [1, 2]", () => {
      const ctx = new ABCContext();
      const chord = makeChord(["C", "E", "G"], ctx);
      const sourceContents: SourceVoiceContent[] = [{ voiceId: "1", content: [chord] }];

      const assignments = assignParts(sourceContents, ["T1", "T2"]);

      expect(assignments.get("T1")!.partIndices).to.deep.equal([0]);
      expect(assignments.get("T2")!.partIndices).to.deep.equal([1, 2]);
    });

    it("two source voices: distributes targets across sources", () => {
      const ctx = new ABCContext();
      const chord2 = makeChord(["C", "E"], ctx);
      const noteA = makeNote("A", ctx);
      const sourceContents: SourceVoiceContent[] = [
        { voiceId: "1", content: [chord2] },
        { voiceId: "2", content: [noteA] },
      ];

      const assignments = assignParts(sourceContents, ["T1", "T2", "T3"]);

      // Source voice "1" has max chord size 2, gets T1 and T2
      expect(assignments.get("T1")!.sourceVoiceId).to.equal("1");
      expect(assignments.get("T1")!.partIndices).to.deep.equal([0]);
      expect(assignments.get("T2")!.sourceVoiceId).to.equal("1");
      expect(assignments.get("T2")!.partIndices).to.deep.equal([1]);
      // Source voice "2" has max chord size 1, gets T3
      expect(assignments.get("T3")!.sourceVoiceId).to.equal("2");
      expect(assignments.get("T3")!.partIndices).to.deep.equal([0]);
    });
  });

  describe("filterToParts", () => {
    it("[CEG] A filtered with partIndices [0] produces G A", () => {
      const ctx = new ABCContext();
      const chord = makeChord(["C", "E", "G"], ctx);
      const noteA = makeNote("A", ctx);
      const content: System = [chord, noteA];

      const result = filterToParts(content, [0], ctx);

      expect(result).to.have.lengthOf(2);
      expect(result[0]).to.be.instanceOf(Note);
      expect((result[0] as Note).pitch.noteLetter.lexeme).to.equal("G");
      expect(result[1]).to.be.instanceOf(Note);
      expect((result[1] as Note).pitch.noteLetter.lexeme).to.equal("A");
    });

    it("[CEG] A filtered with partIndices [1, 2] produces [CE] z", () => {
      const ctx = new ABCContext();
      const chord = makeChord(["C", "E", "G"], ctx);
      const noteA = makeNote("A", ctx);
      const content: System = [chord, noteA];

      const result = filterToParts(content, [1, 2], ctx);

      expect(result).to.have.lengthOf(2);
      expect(result[0]).to.be.instanceOf(Chord);
      const chordResult = result[0] as Chord;
      const notes = chordResult.contents.filter((e): e is Note => e instanceof Note);
      expect(notes).to.have.lengthOf(2);
      expect(notes[0].pitch.noteLetter.lexeme).to.equal("C");
      expect(notes[1].pitch.noteLetter.lexeme).to.equal("E");
      // The standalone note A should become a rest
      expect(result[1]).to.be.instanceOf(Rest);
    });
  });

  // --- Phase 5 tests ---

  describe("cursorRangeToTimeRange", () => {
    it("returns the time range for notes covered by the cursor range", () => {
      // Parse "C D E F |" to get AST content with positions
      const { tuneBody } = createBarMapTestContext("X:1\nK:C\nL:1/4\nC D E F |");
      // The notes are in the last system (system[0] contains L: info line)
      const system = tuneBody.sequence[tuneBody.sequence.length - 1];
      // The bar content runs from index 0 to the barline
      let barlineIdx = system.length - 1;
      for (let i = 0; i < system.length; i++) {
        if (isBarLine(system[i])) {
          barlineIdx = i;
          break;
        }
      }

      // Full bar cursor range covering all notes (line 3, chars 0..9)
      const fullRange = {
        start: { line: 3, character: 0 },
        end: { line: 3, character: 20 },
      };
      const result = cursorRangeToTimeRange(system, 0, barlineIdx, fullRange);
      // calculateDuration returns raw rhythm values (not scaled by L:).
      // Each note with no rhythm token has duration 1. Four notes = 4.
      expect(rationalToNumber(result.start)).to.equal(0);
      expect(rationalToNumber(result.end)).to.equal(4);
    });

    it("returns zero-span range when no notes overlap the cursor", () => {
      const { tuneBody } = createBarMapTestContext("X:1\nK:C\nC D |");
      const system = tuneBody.sequence[tuneBody.sequence.length - 1];
      let barlineIdx = system.length - 1;
      for (let i = 0; i < system.length; i++) {
        if (isBarLine(system[i])) {
          barlineIdx = i;
          break;
        }
      }

      // Cursor range far away from notes
      const noOverlapRange = {
        start: { line: 100, character: 0 },
        end: { line: 100, character: 10 },
      };
      const result = cursorRangeToTimeRange(system, 0, barlineIdx, noOverlapRange);
      expect(rationalToNumber(result.start)).to.equal(0);
      expect(rationalToNumber(result.end)).to.equal(0);
    });
  });

  describe("splitNoteAt", () => {
    it("splits a note with rhythm 2 at offset 1 into two notes with rhythm 1 each", () => {
      const ctx = new ABCContext(new AbcErrorReporter());
      const noteLetter = new Token(TT.NOTE_LETTER, "C", ctx.generateId());
      const pitch = new Pitch(ctx.generateId(), { noteLetter });
      const numToken = new Token(TT.RHY_NUMER, "2", ctx.generateId());
      const rhythm = new Rhythm(ctx.generateId(), numToken);
      const note = new Note(ctx.generateId(), pitch, rhythm);
      const content: System = [note];

      splitNoteAt(content, 0, createRational(1, 1), ctx);

      expect(content).to.have.lengthOf(2);
      expect(content[0]).to.be.instanceOf(Note);
      expect(content[1]).to.be.instanceOf(Note);

      // Verify that both halves have the correct durations
      const dur0 = calculateDuration(content[0] as Note, {});
      const dur1 = calculateDuration(content[1] as Note, {});
      expect(rationalToNumber(dur0)).to.equal(1);
      expect(rationalToNumber(dur1)).to.equal(1);
    });

    it("does not split when splitAt equals the full duration", () => {
      const ctx = new ABCContext(new AbcErrorReporter());
      const noteLetter = new Token(TT.NOTE_LETTER, "D", ctx.generateId());
      const pitch = new Pitch(ctx.generateId(), { noteLetter });
      const note = new Note(ctx.generateId(), pitch);
      const content: System = [note];

      // splitAt == duration (1/1) should be a no-op because the guard
      // rejects split points at or beyond the note's full duration.
      splitNoteAt(content, 0, createRational(1, 1), ctx);

      expect(content).to.have.lengthOf(1);
    });

    it("does not split when splitAt is zero", () => {
      const ctx = new ABCContext(new AbcErrorReporter());
      const noteLetter = new Token(TT.NOTE_LETTER, "E", ctx.generateId());
      const pitch = new Pitch(ctx.generateId(), { noteLetter });
      const note = new Note(ctx.generateId(), pitch);
      const content: System = [note];

      splitNoteAt(content, 0, createRational(0, 1), ctx);

      expect(content).to.have.lengthOf(1);
    });
  });

  describe("replaceTimeRangeInBar", () => {
    it("replaces the entire bar when the time range covers it fully", () => {
      const ctx = new ABCContext(new AbcErrorReporter());
      // Create a bar with a Z rest + barline
      const barline = new BarLine(ctx.generateId(), [new Token(TT.BARLINE, "|", ctx.generateId())]);
      const replacement: System = [makeNote("C", ctx), makeNote("D", ctx)];

      // Z rest has infinite duration, but buildTimeMap skips infinite entries.
      // So we need to use a finite-duration rest instead.
      const restToken = new Token(TT.REST, "z", ctx.generateId());
      const restNumToken = new Token(TT.RHY_NUMER, "4", ctx.generateId());
      const restRhythm = new Rhythm(ctx.generateId(), restNumToken);
      const finiteRest = new Rest(ctx.generateId(), restToken, restRhythm);
      const content2: System = [finiteRest, barline];

      const timeRange = { start: createRational(0, 1), end: createRational(1, 1) };
      replaceTimeRangeInBar(content2, 0, 1, timeRange, replacement, ctx);

      // The rest should be replaced, barline remains at the end
      expect(content2.length).to.be.greaterThanOrEqual(2);
      expect(content2[0]).to.be.instanceOf(Note);
      expect(content2[1]).to.be.instanceOf(Note);
    });
  });

  describe("findBarEntry", () => {
    it("returns the entry when it exists", () => {
      const barMap: BarMap = new Map();
      const voiceEntries = new Map<number, BarEntry>();
      voiceEntries.set(0, { barNumber: 0, closingNodeId: 100 });
      voiceEntries.set(1, { barNumber: 1, closingNodeId: 200 });
      barMap.set("1", voiceEntries);

      const result = findBarEntry(barMap, "1", 1);
      expect(result).to.not.be.null;
      expect(result!.barNumber).to.equal(1);
      expect(result!.closingNodeId).to.equal(200);
    });

    it("returns null when the bar does not exist", () => {
      const barMap: BarMap = new Map();
      const voiceEntries = new Map<number, BarEntry>();
      voiceEntries.set(0, { barNumber: 0, closingNodeId: 100 });
      barMap.set("1", voiceEntries);

      const result = findBarEntry(barMap, "1", 5);
      expect(result).to.be.null;
    });

    it("returns null when the voice does not exist", () => {
      const barMap: BarMap = new Map();
      const result = findBarEntry(barMap, "nonexistent", 0);
      expect(result).to.be.null;
    });
  });

  describe("integration: buildBarMap + getBarSlice pipeline", () => {
    it("tune with content after the last barline: all bars are accessible", () => {
      // "C D | E F" has bar 0 (closed by barline) and bar 1 (closed by finalize)
      const abc = "X:1\nK:C\nC D | E F\n";
      const { tuneBody, ctx } = createBarMapTestContext(abc);
      const barMap = buildBarMap(tuneBody, "1");

      const voice1 = barMap.get("1")!;
      expect(voice1.size).to.equal(2);

      // Both bars should be retrievable via getBarSlice
      const system = tuneBody.sequence[0];
      const bar0Slice = getBarSlice(system, voice1.get(0)!);
      const bar1Slice = getBarSlice(system, voice1.get(1)!);

      expect(bar0Slice).to.not.be.null;
      expect(bar1Slice).to.not.be.null;

      // Bar 0 content should include C and D
      const formatter = new AbcFormatter(ctx);
      const bar0Text = bar0Slice!.content
        .slice(bar0Slice!.startIdx, bar0Slice!.endIdx)
        .map((e) => (e instanceof Token ? e.lexeme : formatter.stringify(e as Expr)))
        .join("");
      expect(bar0Text).to.include("C");
      expect(bar0Text).to.include("D");

      // Bar 1 content should include E and F
      const bar1Text = bar1Slice!.content
        .slice(bar1Slice!.startIdx, bar1Slice!.endIdx)
        .map((e) => (e instanceof Token ? e.lexeme : formatter.stringify(e as Expr)))
        .join("");
      expect(bar1Text).to.include("E");
      expect(bar1Text).to.include("F");
    });

    it("single-bar tune with no barlines: one bar accessible", () => {
      const abc = "X:1\nK:C\nC D E F\n";
      const { tuneBody, ctx } = createBarMapTestContext(abc);
      const barMap = buildBarMap(tuneBody, "1");

      const voice1 = barMap.get("1")!;
      expect(voice1.size).to.equal(1);

      // The single bar should be retrievable
      const system = tuneBody.sequence[0];
      const bar0Slice = getBarSlice(system, voice1.get(0)!);
      expect(bar0Slice).to.not.be.null;

      const formatter = new AbcFormatter(ctx);
      const bar0Text = bar0Slice!.content
        .slice(bar0Slice!.startIdx, bar0Slice!.endIdx)
        .map((e) => (e instanceof Token ? e.lexeme : formatter.stringify(e as Expr)))
        .join("");
      expect(bar0Text).to.include("C");
      expect(bar0Text).to.include("D");
      expect(bar0Text).to.include("E");
      expect(bar0Text).to.include("F");
    });
  });
});

/**
 * Serializes a CSTree root back to ABC text by converting to AST and formatting.
 */
function serializeSelection(selection: Selection, ctx: ABCContext): string {
  const ast = toAst(selection.root);
  const formatter = new AbcFormatter(ctx);
  return formatter.stringify(ast as Expr);
}

/**
 * Creates a full test context and narrows the selection to a specific line range
 * in the tune body. The line/col values are 0-indexed.
 */
function createExplosionTestContext(
  abc: string,
  startLine: number,
  startCol: number,
  endLine: number,
  endCol: number
): {
  selection: Selection;
  ctx: ABCContext;
  snapshots: DocumentSnapshots;
} {
  const { selection, ctx, snapshots } = createFullTestContext(abc);
  const narrowed = selectRange(selection, startLine, startCol, endLine, endCol);
  // The explosion transform expects a single grouped cursor (as the LSP
  // server provides via GROUPED_CURSOR_TRANSFORMS). selectRange creates
  // one cursor per matched node, so we merge them here.
  const merged = new Set<number>();
  for (const cursor of narrowed.cursors) {
    for (const id of cursor) merged.add(id);
  }
  return {
    selection: { root: narrowed.root, cursors: [merged] },
    ctx,
    snapshots,
  };
}

describe("end-to-end", () => {
  describe("deferred style (ctx.tuneLinear = false)", () => {
    it("D1: simple two-note chords exploded into two voices", () => {
      const abc = "X:1\nK:C\n[CE] [DF] [EG]|\n";
      const { selection, ctx, snapshots } = createExplosionTestContext(abc, 2, 0, 2, 100);

      const result = explosion(selection, ["1", "2"], ctx, snapshots);
      const text = serializeSelection(result, ctx);

      expect(text).to.equal("X:1\nK:C\n[CE] [DF] [EG]|\n[V:1]E F G|\n[V:2]C D E|\n");
      expect(result.cursors.length).to.equal(2);
      expect(result.cursors[0].size).to.be.greaterThan(0);
      expect(result.cursors[1].size).to.be.greaterThan(0);
    });

    it("D2: three-note chord exploded into three voices", () => {
      const abc = "X:1\nK:C\n[CEG]|\n";
      const { selection, ctx, snapshots } = createExplosionTestContext(abc, 2, 0, 2, 100);

      const result = explosion(selection, ["1", "2", "3"], ctx, snapshots);
      const text = serializeSelection(result, ctx);

      expect(text).to.equal("X:1\nK:C\n[CEG]|\n[V:1]G|\n[V:2]E|\n[V:3]C|\n");
      expect(result.cursors.length).to.equal(3);
    });

    it("D3: two-bar selection with mixed chords and standalone notes", () => {
      const abc = "X:1\nK:C\n[CE] D | [EG] F|\n";
      const { selection, ctx, snapshots } = createExplosionTestContext(abc, 2, 0, 2, 100);

      const result = explosion(selection, ["1", "2"], ctx, snapshots);
      const text = serializeSelection(result, ctx);

      expect(text).to.equal("X:1\nK:C\n[CE] D | [EG] F|\n[V:1]E D | G F|\n[V:2]C z | E z|\n");
      expect(result.cursors.length).to.equal(2);
    });

    it("D4: partial bar selection (only some notes selected)", () => {
      const abc = "X:1\nK:C\nA [CE] [DF] B|\n";
      const { selection, ctx, snapshots } = createExplosionTestContext(abc, 2, 2, 2, 11);

      const result = explosion(selection, ["1", "2"], ctx, snapshots);
      const text = serializeSelection(result, ctx);

      // Partial bar selection is a known open issue (see bugtracker).
      // The output is not fully correct but we lock in the current
      // behavior to detect regressions.
      expect(text).to.equal("X:1\nK:C\nA [CE] [DF] B|\n[V:1]ZA E F B|\n[V:2]Zz C D z|\n");
    });

    it("D5: tune with explicit voice declaration", () => {
      const abc = "X:1\nK:C\nV:1\n[CE] [DF]| [EG] [FA]|\n";
      const { selection, ctx, snapshots } = createExplosionTestContext(abc, 3, 0, 3, 100);

      const result = explosion(selection, ["1", "2"], ctx, snapshots);
      const text = serializeSelection(result, ctx);

      expect(text).to.equal("X:1\nK:C\nV:1\nE F|  G A|\n[V:2]C D| E F|\n");
      expect(result.cursors.length).to.equal(2);
      expect(result.cursors[0].size).to.be.greaterThan(0);
      expect(result.cursors[1].size).to.be.greaterThan(0);
    });

    it("D6: chords with rhythm are preserved in the exploded notes", () => {
      const abc = "X:1\nK:C\n[CE]2 [DF]/|\n";
      const { selection, ctx, snapshots } = createExplosionTestContext(abc, 2, 0, 2, 100);

      const result = explosion(selection, ["1", "2"], ctx, snapshots);
      const text = serializeSelection(result, ctx);

      expect(text).to.equal("X:1\nK:C\n[CE]2 [DF]/|\n[V:1]E2 F/|\n[V:2]C2 D/|\n");
    });
  });

  describe("linear style (ctx.tuneLinear = true)", () => {
    it("L1: simple linear tune with chords", () => {
      const abc = "X:1\n%%abcls-parse linear\nK:C\n[CE] [DF]|\n";
      const { selection, ctx, snapshots } = createExplosionTestContext(abc, 3, 0, 3, 100);

      const result = explosion(selection, ["1", "2"], ctx, snapshots);
      const text = serializeSelection(result, ctx);

      expect(text).to.equal("X:1\n%%abcls-parse linear\nK:C\n[CE] [DF]|\n[V:1]E F|\n[V:2]C D|\n");
      expect(result.cursors.length).to.equal(2);
    });

    it("L2: linear tune with existing voices", () => {
      const abc = "X:1\n%%abcls-parse linear\nK:C\nV:1\n[CE] [DF]|\nV:2\nG A|\n";
      const { selection, ctx, snapshots } = createExplosionTestContext(abc, 4, 0, 4, 100);

      const result = explosion(selection, ["1", "3"], ctx, snapshots);
      const text = serializeSelection(result, ctx);

      expect(text).to.equal("X:1\n%%abcls-parse linear\nK:C\nV:1\nE F|\nV:2\nG A|\n[V:3]C D|\n");
    });
  });

  describe("guard clause coverage", () => {
    it("G1: empty selection produces no changes", () => {
      const abc = "X:1\nK:C\n[CE] [DF]|\n";
      const { selection: baseSelection, ctx, snapshots } = createFullTestContext(abc);
      const emptySelection: Selection = { root: baseSelection.root, cursors: [] };

      const result = explosion(emptySelection, ["1", "2"], ctx, snapshots);
      const text = serializeSelection(result, ctx);

      expect(text).to.equal(abc);
    });

    it("G2: selection spanning multiple voices returns unchanged", () => {
      const abc = "X:1\nK:C\nV:1\nC D|\nV:2\nE F|\n";
      const { selection, ctx, snapshots } = createExplosionTestContext(abc, 3, 0, 5, 100);

      const result = explosion(selection, ["3", "4"], ctx, snapshots);
      const text = serializeSelection(result, ctx);

      expect(text).to.equal(abc);
    });

    it("G3: tune with only standalone notes (no chords)", () => {
      const abc = "X:1\nK:C\nC D E F|\n";
      const { selection, ctx, snapshots } = createExplosionTestContext(abc, 2, 0, 2, 100);

      const result = explosion(selection, ["1", "2"], ctx, snapshots);
      const text = serializeSelection(result, ctx);

      expect(text).to.equal("X:1\nK:C\nC D E F|\n[V:1]C D E F|\n");
    });

    it("G4: target voice IDs include the source voice", () => {
      const abc = "X:1\nK:C\n[CE] [DF]|\n";
      const { selection, ctx, snapshots } = createExplosionTestContext(abc, 2, 0, 2, 100);

      const result = explosion(selection, ["1", "2"], ctx, snapshots);
      const text = serializeSelection(result, ctx);

      expect(text).to.equal("X:1\nK:C\n[CE] [DF]|\n[V:1]E F|\n[V:2]C D|\n");
      expect(result.cursors.length).to.equal(2);
    });
  });
});
