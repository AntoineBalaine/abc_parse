/**
 * Multi-Staff Implementation Tests
 *
 * Tests to validate the multi-staff/multi-voice functionality.
 */

import { expect } from "chai";
import { ABCContext } from "../parsers/Context";
import { AbcErrorReporter } from "../parsers/ErrorReporter";
import { Scanner } from "../parsers/scan2";
import { parse } from "../parsers/parse2";
import { SemanticAnalyzer } from "../analyzers/semantic-analyzer";
import { TuneInterpreter } from "./TuneInterpreter";
import { StaffSystem } from "../types/abcjs-ast";

describe("Multi-Staff Implementation", () => {
  function interpretABC(abc: string) {
    const ctx = new ABCContext(new AbcErrorReporter());
    const tokens = Scanner(abc, ctx);
    const ast = parse(tokens, ctx);
    const analyzer = new SemanticAnalyzer(ctx);
    ast.accept(analyzer);
    const interpreter = new TuneInterpreter(analyzer, ctx, abc);
    const result = interpreter.interpretFile(ast);
    return result.tunes[0];
  }

  describe("Two voices, separate staffs (automatic mode)", () => {
    it("should create two separate staffs for two voices declared in header", () => {
      const abc = `X:1
M:4/4
L:1/4
V:1
V:2
K:C
V:1
CDEF |
V:2
C,D,E,F, |`;

      const tune = interpretABC(abc);

      // Should have one system with both voices
      expect(tune.systems.length).to.be.greaterThanOrEqual(1);

      const system = tune.systems[0] as StaffSystem;
      expect(system).to.have.property("staff");

      // Should have two staffs
      expect(system.staff.length).to.equal(2);

      // Should report 2 staffs
      expect(tune.staffNum).to.equal(2);
      expect(tune.voiceNum).to.equal(2);

      // Voice 1 should have 5 elements (C, D, E, F, |)
      expect(system.staff[0].voices[0].length).to.equal(5);

      // Voice 2 should have 5 elements (C,, D,, E,, F,, |)
      expect(system.staff[1].voices[0].length).to.equal(5);
    });

    it("should handle voices with different numbers of measures", () => {
      const abc = `X:1
M:4/4
L:1/4
K:C
V:1
V:2
V:1
CDEF | GABA | c2d2 |
V:2
C,D,E,F, |`;

      const tune = interpretABC(abc);

      const system = tune.systems[0] as StaffSystem;

      // Voice 1 has 3 measures (15 elements), Voice 2 has 1 measure (5 elements)
      // This is allowed - no synchronization required
      expect(system.staff[0].voices[0].length).to.be.greaterThan(10);
      expect(system.staff[1].voices[0].length).to.equal(5);
    });
  });

  describe("Non-sequential voice writing", () => {
    it("should handle V1 → V2 → V1 pattern (interleaved measures)", () => {
      const abc = `X:1
M:4/4
L:1/4
K:C
V:1
V:2
V:1
CDEF |
V:2
C,D,E,F, |
V:1
GABA |`;

      const tune = interpretABC(abc);

      // First system should have both voices' first measures
      const system1 = tune.systems[0] as StaffSystem;
      expect(system1.staff[0].voices[0].length).to.equal(5); // CDEF |
      expect(system1.staff[1].voices[0].length).to.equal(5); // C,D,E,F, |

      // Second measure of voice 1 goes to next system
      if (tune.systems.length > 1) {
        const system2 = tune.systems[1] as StaffSystem;
        expect(system2.staff[0].voices[0].length).to.be.greaterThan(0); // GABA |
      }
    });

    it("should handle V1 → V1 → V2 → V2 pattern (multiple measures per voice)", () => {
      const abc = `X:1
M:4/4
L:1/4
K:C
V:1
V:2
V:1
CDEF | GABA |
V:2
C,D,E,F, | G,A,B,C |`;

      const tune = interpretABC(abc);

      const system = tune.systems[0] as StaffSystem;

      // Voice 1 writes 2 measures first
      expect(system.staff[0].voices[0].length).to.equal(10); // 2 measures * 5 elements

      // Voice 2 writes 2 measures after
      expect(system.staff[1].voices[0].length).to.equal(10); // 2 measures * 5 elements
    });

    it("should handle V1 → V2 → V3 → V1 → V2 → V3 pattern (round-robin)", () => {
      const abc = `X:1
M:4/4
L:1/4
K:C
V:1
V:2
V:3
V:1
CDEF |
V:2
C,D,E,F, |
V:3
G,A,B,C |
V:1
GABA |
V:2
G,A,B,C |
V:3
c,d,e,f, |`;

      const tune = interpretABC(abc);

      const system1 = tune.systems[0] as StaffSystem;

      // All three voices should have their first measure in system 1
      expect(system1.staff[0].voices[0].length).to.equal(5); // V1 measure 1
      expect(system1.staff[1].voices[0].length).to.equal(5); // V2 measure 1
      expect(system1.staff[2].voices[0].length).to.equal(5); // V3 measure 1

      // All three voices should have their second measure in system 2
      if (tune.systems.length > 1) {
        const system2 = tune.systems[1] as StaffSystem;
        expect(system2.staff[0].voices[0].length).to.be.greaterThan(0); // V1 measure 2
        expect(system2.staff[1].voices[0].length).to.be.greaterThan(0); // V2 measure 2
        expect(system2.staff[2].voices[0].length).to.be.greaterThan(0); // V3 measure 2
      }
    });

    it("should handle V2 → V1 pattern (reverse order)", () => {
      const abc = `X:1
M:4/4
L:1/4
K:C
V:1
V:2
V:2
C,D,E,F, |
V:1
CDEF |`;

      const tune = interpretABC(abc);

      const system = tune.systems[0] as StaffSystem;

      // Both voices write to same system, regardless of order
      expect(system.staff[0].voices[0].length).to.equal(5); // V1
      expect(system.staff[1].voices[0].length).to.equal(5); // V2
    });

    it("should handle V1 → V2 → V1 → V3 → V2 pattern (complex interleaving)", () => {
      const abc = `X:1
M:4/4
L:1/4
V:1
V:2
V:3
K:C
V:1
CDEF |
V:2
C,D,E,F, |
V:1
GABA |
V:3
G,A,B,C |
V:2
G,A,B,C |`;

      const tune = interpretABC(abc);

      const system1 = tune.systems[0] as StaffSystem;

      // System 1 should have first measures of V1 and V2
      expect(system1.staff[0].voices[0].length).to.equal(5); // V1 measure 1
      expect(system1.staff[1].voices[0].length).to.equal(5); // V2 measure 1

      // System 2 should have second measures
      if (tune.systems.length > 1) {
        const system2 = tune.systems[1] as StaffSystem;
        expect(system2.staff[0].voices[0].length).to.be.greaterThan(0); // V1 measure 2
        expect(system2.staff[1].voices[0].length).to.be.greaterThan(0); // V2 measure 2
      }
    });

    it("should handle sparse voice writing (V1 skips a system)", () => {
      const abc = `X:1
M:4/4
L:1/4
K:C
V:1
V:2
V:2
C,D,E,F, | G,A,B,C |
V:1
CDEF |`;

      const tune = interpretABC(abc);

      // Voice 2 writes 2 measures to system 1
      const system1 = tune.systems[0] as StaffSystem;
      expect(system1.staff[1].voices[0].length).to.equal(10); // 2 measures

      // Voice 1 writes its first measure to system 1
      expect(system1.staff[0].voices[0].length).to.equal(5);
    });
  });

  describe("Three voices", () => {
    it("should create three separate staffs for three voices", () => {
      const abc = `X:1
M:4/4
L:1/4
K:C
V:1
CDEF |
V:2
C,D,E,F, |
V:3
G,A,B,C |`;

      const tune = interpretABC(abc);

      expect(tune.systems.length).to.be.greaterThanOrEqual(1);

      const system = tune.systems[0] as StaffSystem;
      expect(system.staff.length).to.be.greaterThanOrEqual(3);

      expect(tune.staffNum).to.equal(3);
      expect(tune.voiceNum).to.equal(3);
    });
  });

  describe("Voice properties", () => {
    it("should preserve clef per voice", () => {
      const abc = `X:1
M:4/4
L:1/4
K:C
V:1 clef=treble
CDEF |
V:2 clef=bass
C,D,E,F, |`;

      const tune = interpretABC(abc);

      const system = tune.systems[0] as StaffSystem;

      // Staff 0 (voice 1) should have treble clef
      expect(system.staff[0].clef.type).to.equal("treble");

      // Staff 1 (voice 2) should have bass clef
      expect(system.staff[1].clef.type).to.equal("bass");
    });
  });

  describe("Direct writing verification", () => {
    it("should write elements directly without buffering", () => {
      const abc = `X:1
M:4/4
L:1/4
K:C
V:1
CDEF |`;

      const tune = interpretABC(abc);

      const system = tune.systems[0] as StaffSystem;

      // Verify the structure exists
      expect(system.staff[0].voices[0]).to.be.an("array");
      expect(system.staff[0].voices[0].length).to.equal(5);

      // Verify elements are in correct order
      const elements = system.staff[0].voices[0];
      expect(elements[0]).to.have.property("el_type", "note");
      expect(elements[4]).to.have.property("el_type", "bar");
    });
  });

  describe("Single voice (backward compatibility)", () => {
    it("should handle single-voice tunes correctly", () => {
      const abc = `X:1
M:4/4
L:1/4
K:C
CDEF | GABA |`;

      const tune = interpretABC(abc);

      // Should have systems with single staff
      expect(tune.systems.length).to.be.greaterThanOrEqual(1);

      const system = tune.systems[0] as StaffSystem;
      expect(system.staff.length).to.equal(1);
      expect(system.staff[0].voices.length).to.equal(1);

      // Should have elements
      expect(system.staff[0].voices[0].length).to.be.greaterThan(0);
    });
  });

  describe("Voice assignment timing", () => {
    it("should assign voices to staffs when declared in header", () => {
      const abc = `X:1
M:4/4
L:1/4
K:C
V:1
V:2
V:1
CDEF |
V:2
C,D,E,F, |`;

      const tune = interpretABC(abc);

      // Both voices declared in header, should have 2 staffs
      expect(tune.staffNum).to.equal(2);
      expect(tune.voiceNum).to.equal(2);
    });

    it("should handle voice declared in header but used in body", () => {
      const abc = `X:1
M:4/4
L:1/4
K:C
V:1 name="Soprano"
V:2 name="Alto" clef=bass
V:1
CDEF |
V:2
C,D,E,F, |`;

      const tune = interpretABC(abc);

      // Should have two staffs
      expect(tune.staffNum).to.equal(2);

      const system = tune.systems[0] as StaffSystem;

      // Verify clefs are correct
      expect(system.staff[0].clef.type).to.equal("treble"); // default for V1
      expect(system.staff[1].clef.type).to.equal("bass"); // specified for V2
    });

    it("should preserve voice properties through switching", () => {
      const abc = `X:1
M:4/4
L:1/4
K:C
V:1 clef=treble name="Melody"
V:2 clef=bass name="Bass"
V:1
CDEF |
V:2
C,D,E,F, |
V:1
GABA |`;

      const tune = interpretABC(abc);

      // Clefs should be preserved across voice switches
      const system1 = tune.systems[0] as StaffSystem;
      expect(system1.staff[0].clef.type).to.equal("treble");
      expect(system1.staff[1].clef.type).to.equal("bass");
    });
  });
});
