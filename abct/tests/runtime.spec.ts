// ABCT Runtime Tests
// Tests for selectors and transforms

import { expect } from "chai";
import { ABCContext } from "../../parse/parsers/Context";
import { Scanner } from "../../parse/parsers/scan2";
import { parse } from "../../parse/parsers/parse2";
import { AbcFormatter } from "../../parse/Visitors/Formatter2";
import { File_structure, Expr } from "../../parse/types/Expr2";
import { isNote, isChord } from "../../parse/helpers";

import {
  selectChords,
  selectNotes,
  selectVoice,
  selectMeasures,
  selectBass,
  selectBassFromSelection,
  applySelector,
  applyTransform,
  formatSelection,
  transpose,
  octave,
  retrograde,
  bass,
  applyFilter,
  parseFilterPredicate,
  parsePitchLiteral,
  ABCTRuntime,
  createRuntime,
} from "../src/runtime";
import { Comparison, ComparisonOp, Identifier } from "../src/ast";
import { Selection } from "../src/runtime/types";

// Helper to parse ABC into AST
function parseAbc(input: string): File_structure {
  const ctx = new ABCContext();
  const tokens = Scanner(input, ctx);
  return parse(tokens, ctx);
}

// Helper to stringify AST back to ABC
function stringify(ast: File_structure): string {
  const ctx = new ABCContext();
  const formatter = new AbcFormatter(ctx);
  return formatter.stringify(ast, true);
}

// Helper to get the body content as string (without header)
function getBodyContent(abc: string): string {
  const lines = abc.split("\n");
  // Skip header lines (X:, T:, K:, etc.)
  const bodyLines = lines.filter(
    (line) => !line.match(/^[A-Z]:/) && line.trim().length > 0
  );
  return bodyLines.join("\n");
}

describe("ABCT Runtime", () => {
  describe("Selectors", () => {
    describe("selectChords", () => {
      it("should select all chord nodes", () => {
        const abc = "X:1\nK:C\n[CEG] [FAc] [GBd]";
        const ast = parseAbc(abc);
        const selection = selectChords(ast);

        expect(selection.selected.size).to.equal(3);
        for (const node of selection.selected) {
          expect(isChord(node)).to.be.true;
        }
      });

      it("should return empty set for ABC with no chords", () => {
        const abc = "X:1\nK:C\nC D E F";
        const ast = parseAbc(abc);
        const selection = selectChords(ast);

        expect(selection.selected.size).to.equal(0);
      });

      it("should find chords inside beams", () => {
        const abc = "X:1\nK:C\n[CEG][FAc] G A";
        const ast = parseAbc(abc);
        const selection = selectChords(ast);

        expect(selection.selected.size).to.equal(2);
      });
    });

    describe("selectNotes", () => {
      it("should select all note nodes", () => {
        const abc = "X:1\nK:C\nC D E F";
        const ast = parseAbc(abc);
        const selection = selectNotes(ast);

        expect(selection.selected.size).to.equal(4);
        for (const node of selection.selected) {
          expect(isNote(node)).to.be.true;
        }
      });

      it("should select notes inside chords", () => {
        const abc = "X:1\nK:C\n[CEG]";
        const ast = parseAbc(abc);
        const selection = selectNotes(ast);

        // Chord [CEG] has 3 notes
        expect(selection.selected.size).to.equal(3);
      });

      it("should select notes in grace groups", () => {
        const abc = "X:1\nK:C\n{cde}C";
        const ast = parseAbc(abc);
        const selection = selectNotes(ast);

        // 3 grace notes + 1 main note = 4
        expect(selection.selected.size).to.equal(4);
      });
    });

    describe("selectMeasures", () => {
      it("should select notes in specified measure range", () => {
        const abc = "X:1\nK:C\nC D | E F | G A | B c";
        const ast = parseAbc(abc);
        const selection = selectMeasures(ast, 2, 3);

        // Measures 2-3 contain: E F (measure 2) and G A (measure 3)
        expect(selection.selected.size).to.equal(4);
      });

      it("should select single measure when start equals end", () => {
        const abc = "X:1\nK:C\nC D | E F | G A";
        const ast = parseAbc(abc);
        const selection = selectMeasures(ast, 2, 2);

        // Only measure 2: E F
        expect(selection.selected.size).to.equal(2);
      });
    });

    describe("applySelector", () => {
      it("should apply chord selector with short form", () => {
        const abc = "X:1\nK:C\n[CEG] D";
        const ast = parseAbc(abc);
        const selection = applySelector(ast, "c");

        expect(selection.selected.size).to.equal(1);
      });

      it("should apply notes selector with full form", () => {
        const abc = "X:1\nK:C\nC D E";
        const ast = parseAbc(abc);
        const selection = applySelector(ast, "notes");

        expect(selection.selected.size).to.equal(3);
      });

      it("should apply bass selector", () => {
        const abc = "X:1\nK:C\n[CEG] [FAc]";
        const ast = parseAbc(abc);
        const selection = applySelector(ast, "bass");

        // Should select 2 bass notes (C from first chord, F from second chord)
        expect(selection.selected.size).to.equal(2);
        for (const node of selection.selected) {
          expect(isNote(node)).to.be.true;
        }
      });
    });

    describe("selectBass", () => {
      it("should select bass note from each chord", () => {
        const abc = "X:1\nK:C\n[CEG] [FAc] [GBd]";
        const ast = parseAbc(abc);
        const selection = selectBass(ast);

        // Should select 3 bass notes (one from each chord)
        expect(selection.selected.size).to.equal(3);
        for (const node of selection.selected) {
          expect(isNote(node)).to.be.true;
        }
      });

      it("should skip single notes", () => {
        const abc = "X:1\nK:C\nC D E F";
        const ast = parseAbc(abc);
        const selection = selectBass(ast);

        // Single notes are skipped, so the selection should be empty
        expect(selection.selected.size).to.equal(0);
      });

      it("should return empty set for ABC with no chords", () => {
        const abc = "X:1\nK:C\nC D E F";
        const ast = parseAbc(abc);
        const selection = selectBass(ast);

        expect(selection.selected.size).to.equal(0);
      });

      it("should find bass notes from chords inside beams", () => {
        const abc = "X:1\nK:C\n[CEG][FAc]";
        const ast = parseAbc(abc);
        const selection = selectBass(ast);

        // Should select 2 bass notes from the 2 chords in the beam
        expect(selection.selected.size).to.equal(2);
      });

      it("should select the lowest pitched note in chord", () => {
        const abc = "X:1\nK:C\n[GBd]";
        const ast = parseAbc(abc);
        const selection = selectBass(ast);

        expect(selection.selected.size).to.equal(1);
        // G is the lowest note - we can verify by applying a transform
        // and checking the result
        transpose(selection, [12]); // Up an octave
        const result = stringify(ast);
        // The chord should still have G, B, d but G is transposed to g
        expect(result).to.include("g");
      });
    });

    describe("selectBassFromSelection", () => {
      it("should select bass notes from chords in an existing selection", () => {
        const abc = "X:1\nK:C\n[CEG] [FAc] [GBd]";
        const ast = parseAbc(abc);
        const chordSelection = selectChords(ast);
        const bassSelection = selectBassFromSelection(chordSelection);

        // Should select 3 bass notes from the 3 chords
        expect(bassSelection.selected.size).to.equal(3);
        for (const node of bassSelection.selected) {
          expect(isNote(node)).to.be.true;
        }
      });

      it("should skip single notes in the selection", () => {
        const abc = "X:1\nK:C\nC D E F";
        const ast = parseAbc(abc);
        const noteSelection = selectNotes(ast);
        const bassSelection = selectBassFromSelection(noteSelection);

        // Single notes are skipped, so bass selection should be empty
        expect(bassSelection.selected.size).to.equal(0);
      });

      it("should enable nested transforms like @chords |= (@bass | transpose -12)", () => {
        const abc = "X:1\nK:C\n[ceg]";
        const ast = parseAbc(abc);

        // First select the chords
        const chordSelection = selectChords(ast);

        // Then select bass notes from the chord selection
        const bassSelection = selectBassFromSelection(chordSelection);

        // Apply transpose to just the bass notes
        transpose(bassSelection, [-12]); // Down an octave

        const result = stringify(ast);
        // c should be transposed to C, but e and g remain unchanged
        expect(result).to.include("[Ceg]");
      });

      it("should work with multiple chords", () => {
        const abc = "X:1\nK:C\n[ceg] [fac']";
        const ast = parseAbc(abc);

        // Select all chords
        const chordSelection = selectChords(ast);

        // Select bass notes from all chords
        const bassSelection = selectBassFromSelection(chordSelection);

        // Transpose bass notes down
        transpose(bassSelection, [-12]);

        const result = stringify(ast);
        // c and f should be transposed down, others unchanged
        expect(result).to.include("[Ceg]");
        expect(result).to.include("[Fac']");
      });
    });
  });

  describe("Transforms", () => {
    describe("transpose", () => {
      it("should transpose notes up by semitones", () => {
        const abc = "X:1\nK:C\nC D E";
        const ast = parseAbc(abc);
        const selection = selectNotes(ast);

        transpose(selection, [2]); // Up a whole step

        const result = stringify(ast);
        // C -> D, D -> E, E -> F# (or ^F in ABC)
        expect(result).to.include("D");
        expect(result).to.include("E");
        expect(result).to.include("^F");
      });

      it("should transpose notes down with negative semitones", () => {
        const abc = "X:1\nK:C\nD E F";
        const ast = parseAbc(abc);
        const selection = selectNotes(ast);

        transpose(selection, [-2]); // Down a whole step

        const result = stringify(ast);
        // D -> C, E -> D, F -> D# or Eb
        expect(result).to.include("C");
        expect(result).to.include("D");
      });

      it("should be identity for transpose 0", () => {
        const abc = "X:1\nK:C\nC D E F";
        const ast = parseAbc(abc);
        const originalResult = stringify(ast);
        const selection = selectNotes(ast);

        transpose(selection, [0]);

        const result = stringify(ast);
        expect(result).to.equal(originalResult);
      });

      it("should transpose notes in chords", () => {
        const abc = "X:1\nK:C\n[CEG]";
        const ast = parseAbc(abc);
        const selection = selectChords(ast);

        transpose(selection, [12]); // Up an octave

        const result = stringify(ast);
        // All notes should be in a higher octave
        expect(result).to.include("[ceg]");
      });
    });

    describe("octave", () => {
      it("should be equivalent to transpose by 12 semitones", () => {
        const abc1 = "X:1\nK:C\nC D E";
        const abc2 = "X:1\nK:C\nC D E";
        const ast1 = parseAbc(abc1);
        const ast2 = parseAbc(abc2);
        const selection1 = selectNotes(ast1);
        const selection2 = selectNotes(ast2);

        octave(selection1, [1]);
        transpose(selection2, [12]);

        expect(stringify(ast1)).to.equal(stringify(ast2));
      });

      it("should work with negative octaves", () => {
        const abc = "X:1\nK:C\nc d e";
        const ast = parseAbc(abc);
        const selection = selectNotes(ast);

        octave(selection, [-1]);

        const result = stringify(ast);
        expect(result).to.include("C");
        expect(result).to.include("D");
        expect(result).to.include("E");
      });
    });

    describe("retrograde", () => {
      it("should reverse sequence of notes", () => {
        const abc = "X:1\nK:C\nC D E F";
        const ast = parseAbc(abc);
        const selection = selectNotes(ast);

        retrograde(selection, []);

        const result = stringify(ast);
        // The pitches should be reversed: F E D C
        // Note: this verifies the pitch content is reversed
        const body = getBodyContent(result);
        expect(body).to.match(/F.*E.*D.*C/);
      });

      it("should be identity when applied twice", () => {
        const abc = "X:1\nK:C\nC D E F G";
        const ast = parseAbc(abc);
        const selection = selectNotes(ast);

        const originalResult = stringify(ast);

        retrograde(selection, []);
        retrograde(selection, []);

        const result = stringify(ast);
        expect(result).to.equal(originalResult);
      });

      it("should handle single note (no-op)", () => {
        const abc = "X:1\nK:C\nC";
        const ast = parseAbc(abc);
        const selection = selectNotes(ast);
        const originalResult = stringify(ast);

        retrograde(selection, []);

        expect(stringify(ast)).to.equal(originalResult);
      });
    });

    describe("bass", () => {
      it("should extract lowest note from chord", () => {
        const abc = "X:1\nK:C\n[CEG]";
        const ast = parseAbc(abc);
        const selection = selectChords(ast);

        bass(selection, []);

        const result = stringify(ast);
        // The chord should now contain only the lowest note (C)
        expect(result).to.include("[C]");
      });

      it("should leave single notes unchanged", () => {
        const abc = "X:1\nK:C\nC D E";
        const ast = parseAbc(abc);
        const selection = selectNotes(ast);
        const originalResult = stringify(ast);

        bass(selection, []);

        expect(stringify(ast)).to.equal(originalResult);
      });

      it("should handle chords with mixed octaves", () => {
        const abc = "X:1\nK:C\n[GBd]";
        const ast = parseAbc(abc);
        const selection = selectChords(ast);

        bass(selection, []);

        const result = stringify(ast);
        // G is the lowest note
        expect(result).to.include("[G]");
      });

      it("should process multiple chords", () => {
        const abc = "X:1\nK:C\n[CEG] [FAc] [GBd]";
        const ast = parseAbc(abc);
        const selection = selectChords(ast);

        bass(selection, []);

        const result = stringify(ast);
        // Each chord should be reduced to its lowest note
        expect(result).to.include("[C]");
        expect(result).to.include("[F]");
        expect(result).to.include("[G]");
      });
    });

    describe("filter", () => {
      // Helper to create a mock comparison for testing
      function createComparison(
        property: string,
        op: ComparisonOp,
        value: string | number
      ): Comparison {
        const dummyLoc = {
          start: { line: 0, column: 0, offset: 0 },
          end: { line: 0, column: 0, offset: 0 },
        };

        const leftId: Identifier = {
          type: "identifier",
          name: property,
          loc: dummyLoc,
        };

        const rightExpr =
          typeof value === "number"
            ? { type: "number" as const, value: String(value), loc: dummyLoc }
            : { type: "identifier" as const, name: value, loc: dummyLoc };

        return {
          type: "comparison",
          op,
          opLoc: dummyLoc,
          left: leftId,
          right: rightExpr,
          loc: dummyLoc,
        };
      }

      describe("parsePitchLiteral", () => {
        it("should parse uppercase notes as octave 4", () => {
          // C4 = MIDI 60
          expect(parsePitchLiteral("C")).to.equal(60);
          expect(parsePitchLiteral("D")).to.equal(62);
          expect(parsePitchLiteral("E")).to.equal(64);
        });

        it("should parse lowercase notes as octave 5", () => {
          // c5 = MIDI 72
          expect(parsePitchLiteral("c")).to.equal(72);
          expect(parsePitchLiteral("d")).to.equal(74);
        });

        it("should parse scientific notation", () => {
          expect(parsePitchLiteral("C4")).to.equal(60);
          expect(parsePitchLiteral("C5")).to.equal(72);
          expect(parsePitchLiteral("A4")).to.equal(69);
        });

        it("should parse accidentals", () => {
          expect(parsePitchLiteral("C#4")).to.equal(61);
          expect(parsePitchLiteral("Db4")).to.equal(61);
          expect(parsePitchLiteral("F#")).to.equal(66);
        });

        it("should return null for invalid pitches", () => {
          expect(parsePitchLiteral("X")).to.be.null;
          expect(parsePitchLiteral("123")).to.be.null;
        });
      });

      describe("parseFilterPredicate", () => {
        it("should parse pitch comparison with note literal", () => {
          const comparison = createComparison("pitch", ">", "C4");
          const predicate = parseFilterPredicate(comparison);

          expect(predicate).to.not.be.null;
          expect(predicate!.property).to.equal("pitch");
          expect(predicate!.op).to.equal(">");
          expect(predicate!.value).to.equal(60); // C4 = MIDI 60
        });

        it("should parse size comparison with number", () => {
          const comparison = createComparison("size", ">=", 3);
          const predicate = parseFilterPredicate(comparison);

          expect(predicate).to.not.be.null;
          expect(predicate!.property).to.equal("size");
          expect(predicate!.op).to.equal(">=");
          expect(predicate!.value).to.equal(3);
        });
      });

      describe("applyFilter on notes", () => {
        it("should filter notes below a pitch threshold", () => {
          const abc = "X:1\nK:C\nC D E F G A B c";
          const ast = parseAbc(abc);
          const selection = selectNotes(ast);

          // Filter: keep notes with pitch > E4 (MIDI 64)
          const predicate = parseFilterPredicate(
            createComparison("pitch", ">", "E4")
          )!;

          applyFilter(selection, predicate);

          const result = stringify(ast);
          const body = getBodyContent(result);

          // E4 = MIDI 64, so F, G, A, B, c should remain
          expect(body).to.include("F");
          expect(body).to.include("G");
          expect(body).to.include("A");
          expect(body).to.include("B");
          expect(body).to.include("c");
          // C, D, E should be removed
          expect(body).not.to.match(/\bC\b/);
          expect(body).not.to.match(/\bD\b/);
          expect(body).not.to.match(/\bE\b/);
        });

        it("should filter notes with >= comparison", () => {
          const abc = "X:1\nK:C\nC D E F";
          const ast = parseAbc(abc);
          const selection = selectNotes(ast);

          // Filter: keep notes with pitch >= E4 (MIDI 64)
          const predicate = parseFilterPredicate(
            createComparison("pitch", ">=", "E")
          )!;

          applyFilter(selection, predicate);

          const result = stringify(ast);
          const body = getBodyContent(result);

          // E and F should remain
          expect(body).to.include("E");
          expect(body).to.include("F");
        });

        it("should filter notes with < comparison", () => {
          const abc = "X:1\nK:C\nC D E F";
          const ast = parseAbc(abc);
          const selection = selectNotes(ast);

          // Filter: keep notes with pitch < E (MIDI 64)
          const predicate = parseFilterPredicate(
            createComparison("pitch", "<", "E")
          )!;

          applyFilter(selection, predicate);

          const result = stringify(ast);
          const body = getBodyContent(result);

          // C and D should remain
          expect(body).to.include("C");
          expect(body).to.include("D");
          // E and F should be removed
          expect(body).not.to.match(/\bE\b/);
          expect(body).not.to.match(/\bF\b/);
        });
      });

      describe("applyFilter on chords (filtering notes within)", () => {
        it("should filter notes within chords based on pitch", () => {
          const abc = "X:1\nK:C\n[CEG]";
          const ast = parseAbc(abc);
          const selection = selectChords(ast);

          // Filter: keep notes with pitch > D4 (MIDI 62)
          const predicate = parseFilterPredicate(
            createComparison("pitch", ">", "D")
          )!;

          applyFilter(selection, predicate);

          const result = stringify(ast);
          // C should be removed, E and G should remain
          expect(result).to.include("E");
          expect(result).to.include("G");
          expect(result).not.to.match(/\[C/);
        });

        it("should filter notes in multiple chords", () => {
          const abc = "X:1\nK:C\n[CEG] [FAc]";
          const ast = parseAbc(abc);
          const selection = selectChords(ast);

          // Filter: keep notes with pitch >= E4 (MIDI 64)
          const predicate = parseFilterPredicate(
            createComparison("pitch", ">=", "E")
          )!;

          applyFilter(selection, predicate);

          const result = stringify(ast);
          // From [CEG]: E and G remain
          // From [FAc]: F, A, c remain
          expect(result).to.include("E");
          expect(result).to.include("G");
          expect(result).to.include("F");
          expect(result).to.include("A");
          expect(result).to.include("c");
        });
      });

      describe("applyFilter on chords by size", () => {
        it("should filter chords with size < threshold", () => {
          const abc = "X:1\nK:C\n[CE] [CEG] [CEGB]";
          const ast = parseAbc(abc);
          const selection = selectChords(ast);

          // Filter: keep chords with size >= 3
          const predicate = parseFilterPredicate(
            createComparison("size", ">=", 3)
          )!;

          applyFilter(selection, predicate);

          const result = stringify(ast);
          // [CE] has 2 notes - should be removed
          // [CEG] has 3 notes - should remain
          // [CEGB] has 4 notes - should remain
          expect(result).to.include("[CEG]");
          expect(result).to.include("[CEGB]");
          expect(result).not.to.include("[CE]");
        });

        it("should filter chords with exact size match", () => {
          const abc = "X:1\nK:C\n[CE] [CEG] [CEGB]";
          const ast = parseAbc(abc);
          const selection = selectChords(ast);

          // Filter: keep chords with size == 3
          const predicate = parseFilterPredicate(
            createComparison("size", "==", 3)
          )!;

          applyFilter(selection, predicate);

          const result = stringify(ast);
          // Only [CEG] has exactly 3 notes
          expect(result).to.include("[CEG]");
          expect(result).not.to.include("[CE]");
          expect(result).not.to.include("[CEGB]");
        });
      });

      describe("edge cases", () => {
        it("should remove chords that become empty after filtering all notes", () => {
          const abc = "X:1\nK:C\n[CD] E F";
          const ast = parseAbc(abc);
          const selection = selectChords(ast);

          // Filter: keep notes with pitch > E (no notes in [CD] match)
          const predicate = parseFilterPredicate(
            createComparison("pitch", ">", "E")
          )!;

          applyFilter(selection, predicate);

          const result = stringify(ast);
          // The chord [CD] should be removed entirely, not left as empty []
          expect(result).not.to.include("[]");
          expect(result).not.to.include("[CD]");
          expect(result).to.include("E");
          expect(result).to.include("F");
        });

        it("should keep chords that still have notes after filtering", () => {
          const abc = "X:1\nK:C\n[CDE] F G";
          const ast = parseAbc(abc);
          const selection = selectChords(ast);

          // Filter: keep notes with pitch >= D
          const predicate = parseFilterPredicate(
            createComparison("pitch", ">=", "D")
          )!;

          applyFilter(selection, predicate);

          const result = stringify(ast);
          // Chord should still exist with D and E remaining
          expect(result).to.include("[");
          expect(result).not.to.include("[C");
        });
      });
    });

    describe("applyTransform", () => {
      it("should apply named transform", () => {
        const abc = "X:1\nK:C\nC D E";
        const ast = parseAbc(abc);
        const selection = selectNotes(ast);

        applyTransform(selection, "transpose", [2]);

        const result = stringify(ast);
        expect(result).to.include("D");
      });

      it("should throw for unknown transform", () => {
        const abc = "X:1\nK:C\nC D E";
        const ast = parseAbc(abc);
        const selection = selectNotes(ast);

        expect(() => applyTransform(selection, "nonexistent", [])).to.throw(
          "Unknown transform"
        );
      });
    });
  });

  describe("Property Tests", () => {
    describe("transpose identity and inverse", () => {
      it("transpose n | transpose -n should be identity", () => {
        const abc = "X:1\nK:C\nC D E F G A B c";
        const ast = parseAbc(abc);
        const originalResult = stringify(ast);
        const selection = selectNotes(ast);

        applyTransform(selection, "transpose", [5]);
        applyTransform(selection, "transpose", [-5]);

        expect(stringify(ast)).to.equal(originalResult);
      });
    });

    describe("octave equivalence", () => {
      it("octave 1 equals transpose 12", () => {
        const abc1 = "X:1\nK:C\nC E G";
        const abc2 = "X:1\nK:C\nC E G";
        const ast1 = parseAbc(abc1);
        const ast2 = parseAbc(abc2);

        applyTransform(selectNotes(ast1), "octave", [1]);
        applyTransform(selectNotes(ast2), "transpose", [12]);

        expect(stringify(ast1)).to.equal(stringify(ast2));
      });
    });
  });

  describe("ABCTRuntime class", () => {
    it("should create runtime with createRuntime()", () => {
      const runtime = createRuntime();
      expect(runtime).to.be.instanceof(ABCTRuntime);
    });

    it("should manage variables", () => {
      const runtime = createRuntime();
      const abc = "X:1\nK:C\nC D E";
      const ast = parseAbc(abc);
      const selection = { ast, selected: new Set<Expr>() };

      runtime.setVariable("input", selection);
      const retrieved = runtime.getVariable("input");

      expect(retrieved).to.equal(selection);
    });

    it("should apply selector through runtime", () => {
      const runtime = createRuntime();
      const abc = "X:1\nK:C\n[CEG] D E";
      const ast = parseAbc(abc);
      const selection = runtime.createSelection(ast);

      const chordSelection = runtime.select(selection, "chords");
      expect(chordSelection.selected.size).to.equal(1);
    });

    it("should apply transform through runtime", () => {
      const runtime = createRuntime();
      const abc = "X:1\nK:C\nC D E";
      const ast = parseAbc(abc);
      const selection = runtime.select({ ast, selected: new Set<Expr>() }, "notes");

      runtime.transform(selection, "transpose", [2]);

      const result = runtime.format(selection);
      expect(result).to.include("D");
    });
  });

  describe("formatSelection", () => {
    it("should format selection to ABC string", () => {
      const abc = "X:1\nK:C\nC D E F";
      const ast = parseAbc(abc);
      const selection = { ast, selected: new Set<Expr>() };

      const result = formatSelection(selection);
      expect(result).to.include("X:1");
      expect(result).to.include("K:C");
    });
  });
});
