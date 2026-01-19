/**
 * Tests for articulation mapping
 */

import { expect } from "chai";
import { Decorations } from "../types/abcjs-ast";
import { NoteArticulation } from "./types";
import {
  decorationsToArticulation,
  extractDynamics,
  isFermata,
  hasFermata,
  DYNAMICS_MAP,
} from "./articulation-map";

describe("Articulation Map", () => {
  describe("decorationsToArticulation", () => {
    it("should return None for empty array", () => {
      expect(decorationsToArticulation([])).to.equal(NoteArticulation.None);
    });

    it("should map staccato", () => {
      const result = decorationsToArticulation([Decorations.Staccato]);
      expect(result).to.equal(NoteArticulation.Staccato);
    });

    it("should map accent", () => {
      const result = decorationsToArticulation([Decorations.Accent]);
      expect(result).to.equal(NoteArticulation.Accent);
    });

    it("should map tenuto", () => {
      const result = decorationsToArticulation([Decorations.Tenuto]);
      expect(result).to.equal(NoteArticulation.Tenuto);
    });

    it("should map marcato", () => {
      const result = decorationsToArticulation([Decorations.Marcato]);
      expect(result).to.equal(NoteArticulation.Marcato);
    });

    it("should map trill", () => {
      const result = decorationsToArticulation([Decorations.Trill]);
      expect(result).to.equal(NoteArticulation.Trill);
    });

    it("should combine multiple articulations with bitwise OR", () => {
      const result = decorationsToArticulation([
        Decorations.Staccato,
        Decorations.Accent,
      ]);
      const expected = NoteArticulation.Staccato | NoteArticulation.Accent;
      expect(result).to.equal(expected);
    });

    it("should ignore decorations without articulation mapping", () => {
      // Fermata is handled via duration, not articulation flags
      const result = decorationsToArticulation([Decorations.Fermata]);
      expect(result).to.equal(NoteArticulation.None);
    });

    it("should ignore dynamics decorations", () => {
      const result = decorationsToArticulation([Decorations.F, Decorations.P]);
      expect(result).to.equal(NoteArticulation.None);
    });

    it("should handle mixed articulations and non-articulations", () => {
      const result = decorationsToArticulation([
        Decorations.Staccato,
        Decorations.F, // dynamics, not an articulation
        Decorations.Accent,
      ]);
      const expected = NoteArticulation.Staccato | NoteArticulation.Accent;
      expect(result).to.equal(expected);
    });
  });

  describe("extractDynamics", () => {
    it("should return undefined for empty array", () => {
      expect(extractDynamics([])).to.be.undefined;
    });

    it("should return undefined when no dynamics present", () => {
      expect(extractDynamics([Decorations.Staccato])).to.be.undefined;
    });

    it("should extract piano (p)", () => {
      const result = extractDynamics([Decorations.P]);
      expect(result).to.equal(DYNAMICS_MAP[Decorations.P]);
    });

    it("should extract forte (f)", () => {
      const result = extractDynamics([Decorations.F]);
      expect(result).to.equal(DYNAMICS_MAP[Decorations.F]);
    });

    it("should extract mezzo-forte (mf)", () => {
      const result = extractDynamics([Decorations.MF]);
      expect(result).to.equal(DYNAMICS_MAP[Decorations.MF]);
    });

    it("should extract fortissimo (ff)", () => {
      const result = extractDynamics([Decorations.FF]);
      expect(result).to.equal(DYNAMICS_MAP[Decorations.FF]);
    });

    it("should extract sforzando (sfz)", () => {
      const result = extractDynamics([Decorations.SFZ]);
      expect(result).to.equal(DYNAMICS_MAP[Decorations.SFZ]);
    });

    it("should return first dynamics found when multiple present", () => {
      const result = extractDynamics([Decorations.P, Decorations.F]);
      // Should return the first one found
      expect(result).to.equal(DYNAMICS_MAP[Decorations.P]);
    });

    it("should find dynamics among other decorations", () => {
      const result = extractDynamics([
        Decorations.Staccato,
        Decorations.MF,
        Decorations.Accent,
      ]);
      expect(result).to.equal(DYNAMICS_MAP[Decorations.MF]);
    });
  });

  describe("isFermata", () => {
    it("should return true for Fermata", () => {
      expect(isFermata(Decorations.Fermata)).to.be.true;
    });

    it("should return true for InvertedFermata", () => {
      expect(isFermata(Decorations.InvertedFermata)).to.be.true;
    });

    it("should return false for other decorations", () => {
      expect(isFermata(Decorations.Staccato)).to.be.false;
      expect(isFermata(Decorations.Accent)).to.be.false;
      expect(isFermata(Decorations.Trill)).to.be.false;
    });
  });

  describe("hasFermata", () => {
    it("should return false for empty array", () => {
      expect(hasFermata([])).to.be.false;
    });

    it("should return true when Fermata present", () => {
      expect(hasFermata([Decorations.Fermata])).to.be.true;
    });

    it("should return true when InvertedFermata present", () => {
      expect(hasFermata([Decorations.InvertedFermata])).to.be.true;
    });

    it("should return true when fermata is among other decorations", () => {
      expect(
        hasFermata([Decorations.Staccato, Decorations.Fermata, Decorations.Accent])
      ).to.be.true;
    });

    it("should return false when no fermata present", () => {
      expect(hasFermata([Decorations.Staccato, Decorations.Accent])).to.be.false;
    });
  });

  describe("DYNAMICS_MAP values", () => {
    it("should have values in ascending order from pppp to ffff", () => {
      const pppp = DYNAMICS_MAP[Decorations.PPPP]!;
      const ppp = DYNAMICS_MAP[Decorations.PPP]!;
      const pp = DYNAMICS_MAP[Decorations.PP]!;
      const p = DYNAMICS_MAP[Decorations.P]!;
      const mp = DYNAMICS_MAP[Decorations.MP]!;
      const mf = DYNAMICS_MAP[Decorations.MF]!;
      const f = DYNAMICS_MAP[Decorations.F]!;
      const ff = DYNAMICS_MAP[Decorations.FF]!;
      const fff = DYNAMICS_MAP[Decorations.FFF]!;
      const ffff = DYNAMICS_MAP[Decorations.FFFF]!;

      expect(pppp).to.be.lessThan(ppp);
      expect(ppp).to.be.lessThan(pp);
      expect(pp).to.be.lessThan(p);
      expect(p).to.be.lessThan(mp);
      expect(mp).to.be.lessThan(mf);
      expect(mf).to.be.lessThan(f);
      expect(f).to.be.lessThan(ff);
      expect(ff).to.be.lessThan(fff);
      expect(fff).to.be.lessThan(ffff);
    });

    it("should have all values between 0 and 1", () => {
      for (const [_, value] of Object.entries(DYNAMICS_MAP)) {
        if (value !== undefined) {
          expect(value).to.be.at.least(0);
          expect(value).to.be.at.most(1);
        }
      }
    });
  });
});
