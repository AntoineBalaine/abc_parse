import { expect } from "chai";
import { describe, it } from "mocha";
import * as fc from "fast-check";
import { TAGS } from "../src/csTree/types";
import {
  toCSTree, collectAll, collectSubtree, findByTag, siblingCount,
  genAbcTune, genAbcWithChords, genAbcMultiTune,
  roundtrip, formatAst
} from "./helpers";

describe("csTree - fromAst", () => {
  describe("properties", () => {
    it("every CSNode has a tag matching one of the TAGS entries", () => {
      const validTags = new Set(Object.values(TAGS));
      fc.assert(
        fc.property(genAbcTune, (abc) => {
          const root = toCSTree(abc);
          const allNodes = collectAll(root);
          for (const node of allNodes) {
            if (!validTags.has(node.tag)) return false;
          }
          return true;
        })
      );
    });

    it("Token CSNodes are always leaves (firstChild is null)", () => {
      fc.assert(
        fc.property(genAbcTune, (abc) => {
          const root = toCSTree(abc);
          const tokens = findByTag(root, TAGS.Token);
          for (const t of tokens) {
            if (t.firstChild !== null) return false;
          }
          return true;
        })
      );
    });
  });

  describe("examples", () => {
    it("[CEG]2 C2 D2| — chord has Note children linked as siblings", () => {
      const root = toCSTree("X:1\nK:C\n[CEG]2 C2 D2|\n");
      expect(root.tag).to.equal(TAGS.File_structure);

      const tunes = findByTag(root, TAGS.Tune);
      expect(tunes.length).to.equal(1);

      const chords = findByTag(root, TAGS.Chord);
      expect(chords.length).to.equal(1);

      const chordSubtree = collectSubtree(chords[0]);
      const chordNotes = chordSubtree.filter((n) => n.tag === TAGS.Note);
      expect(chordNotes.length).to.equal(3);
    });

    it("CDEF GABc| — beamed notes are children of Beam CSNodes", () => {
      const root = toCSTree("X:1\nK:C\nCDEF GABc|\n");
      const beams = findByTag(root, TAGS.Beam);
      expect(beams.length).to.be.greaterThan(0);

      for (const beam of beams) {
        const subtree = collectSubtree(beam);
        const notes = subtree.filter((n) => n.tag === TAGS.Note);
        expect(notes.length).to.be.greaterThan(0);
      }
    });

    it("multi-tune input — root has multiple Tune children as siblings", () => {
      const root = toCSTree("X:1\nK:C\nCDE|\n\nX:2\nK:G\nGAB|\n");
      const tunes = findByTag(root, TAGS.Tune);
      expect(tunes.length).to.equal(2);
    });

    it("a Note CSNode has tag 'Note', Chord has 'Chord', Rest has 'Rest'", () => {
      const root = toCSTree("X:1\nK:C\n[CE]2 C2 z2|\n");
      const notes = findByTag(root, TAGS.Note);
      expect(notes.length).to.be.greaterThan(0);
      for (const n of notes) expect(n.tag).to.equal("Note");

      const chords = findByTag(root, TAGS.Chord);
      expect(chords.length).to.equal(1);
      expect(chords[0].tag).to.equal("Chord");

      const rests = findByTag(root, TAGS.Rest);
      expect(rests.length).to.equal(1);
      expect(rests[0].tag).to.equal("Rest");
    });

    it("Beam CSNode has tag 'Beam'", () => {
      const root = toCSTree("X:1\nK:C\nCDEF|\n");
      const beams = findByTag(root, TAGS.Beam);
      expect(beams.length).to.be.greaterThan(0);
      expect(beams[0].tag).to.equal("Beam");
    });

    it("fromAst works on a subtree (Chord node)", () => {
      const root = toCSTree("X:1\nK:C\n[CEG]2|\n");
      const chords = findByTag(root, TAGS.Chord);
      expect(chords.length).to.equal(1);
      const subtree = collectSubtree(chords[0]);
      const notes = subtree.filter((n) => n.tag === TAGS.Note);
      expect(notes.length).to.equal(3);
    });

    it("Tune has Tune_header and Tune_Body children", () => {
      const root = toCSTree("X:1\nK:C\nCDE|\n");
      const tunes = findByTag(root, TAGS.Tune);
      expect(tunes.length).to.equal(1);

      const tune = tunes[0];
      expect(tune.firstChild).to.not.equal(null);
      expect(tune.firstChild!.tag).to.equal(TAGS.Tune_header);
      expect(tune.firstChild!.nextSibling).to.not.equal(null);
      expect(tune.firstChild!.nextSibling!.tag).to.equal(TAGS.Tune_Body);
    });
  });
});

describe("csTree - toAst roundtrip", () => {
  describe("property-based", () => {
    it("roundtrip produces same output as direct formatting (single tune)", () => {
      fc.assert(
        fc.property(genAbcTune, (abc) => {
          const rt = roundtrip(abc);
          const direct = formatAst(abc);
          return rt === direct;
        }),
        { numRuns: 200 }
      );
    });

    it("roundtrip produces same output as direct formatting (tunes with chords)", () => {
      fc.assert(
        fc.property(genAbcWithChords, (abc) => {
          const rt = roundtrip(abc);
          const direct = formatAst(abc);
          return rt === direct;
        }),
        { numRuns: 200 }
      );
    });

    it("roundtrip produces same output as direct formatting (multi-tune)", () => {
      fc.assert(
        fc.property(genAbcMultiTune, (abc) => {
          const rt = roundtrip(abc);
          const direct = formatAst(abc);
          return rt === direct;
        }),
        { numRuns: 100 }
      );
    });

    it("node count is stable across fromAst conversions", () => {
      fc.assert(
        fc.property(genAbcTune, (abc) => {
          const root1 = toCSTree(abc);
          const root2 = toCSTree(abc);
          return collectAll(root1).length === collectAll(root2).length;
        })
      );
    });
  });

  describe("example-based roundtrips", () => {
    const cases: Array<[string, string]> = [
      ["simple note", "X:1\nK:C\nC|\n"],
      ["note with accidental and octave", "X:1\nK:C\n^^C''3/4>|\n"],
      ["note with tie", "X:1\nK:C\nC-|\n"],
      ["chord with rhythm and tie", "X:1\nK:C\n[CEG]2-|\n"],
      ["grace group (non-acciaccatura)", "X:1\nK:C\n{CDE}F|\n"],
      ["acciaccatura grace group", "X:1\nK:C\n{/CDE}F|\n"],
      ["inline field", "X:1\nK:C\nCD[K:Am]EF|\n"],
      ["barline simple", "X:1\nK:C\nCDE|\n"],
      ["barline double", "X:1\nK:C\nCDE||\n"],
      ["rest with rhythm", "X:1\nK:C\nz3/4|\n"],
      ["beam contents", "X:1\nK:C\nCDEF|\n"],
      ["decoration", "X:1\nK:C\n!mf!C|\n"],
      ["annotation", "X:1\nK:C\n\"Am\"C|\n"],
      ["tuplet (3", "X:1\nK:C\n(3CDE|\n"],
      ["tuplet (3:2:3", "X:1\nK:C\n(3:2:3CDE|\n"],
      ["multi-measure rest", "X:1\nK:C\nZ4|\n"],
      ["y spacer", "X:1\nK:C\ny2C|\n"],
      ["chord symbol", "X:1\nK:C\n\"^Intro\"C|\n"],
      ["multi-tune with section break", "X:1\nK:C\nCDE|\n\nX:2\nK:G\nGAB|\n"],
      ["note with broken rhythm", "X:1\nK:C\nC>D|\n"],
      ["rest plain", "X:1\nK:C\nz|\n"],
      ["barline repeat end", "X:1\nK:C\nCDE:|\n"],
      ["single note chord", "X:1\nK:C\n[C]|\n"],
    ];

    for (const [label, source] of cases) {
      it(`${label}: ${source.trim()}`, () => {
        const rt = roundtrip(source);
        const direct = formatAst(source);
        expect(rt).to.equal(direct);
      });
    }
  });
});
