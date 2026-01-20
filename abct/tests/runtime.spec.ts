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
  applySelector,
  applyTransform,
  formatSelection,
  transpose,
  octave,
  retrograde,
  bass,
  ABCTRuntime,
  createRuntime,
} from "../src/runtime";
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
