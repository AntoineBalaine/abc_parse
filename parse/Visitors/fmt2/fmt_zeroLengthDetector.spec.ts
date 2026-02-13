import { expect } from "chai";
import { ABCContext } from "../../parsers/Context";
import { AbcErrorReporter } from "../../parsers/ErrorReporter";
import { Scanner } from "../../parsers/scan2";
import { parse } from "../../parsers/parse2";
import { Tune } from "../../types/Expr2";
import { ZeroLengthNoteDetector } from "./fmt_zeroLengthDetector";

function createContext(): ABCContext {
  return new ABCContext(new AbcErrorReporter());
}

function parseTuneBody(abc: string, ctx: ABCContext) {
  const tokens = Scanner(abc, ctx);
  const file = parse(tokens, ctx);
  const tune = file.contents.find((item): item is Tune => item instanceof Tune);
  return tune?.tune_body;
}

describe("ZeroLengthNoteDetector", () => {
  let ctx: ABCContext;
  let detector: ZeroLengthNoteDetector;

  beforeEach(() => {
    ctx = createContext();
    detector = new ZeroLengthNoteDetector();
  });

  describe("detects zero-length notes", () => {
    it("should return true for simple zero-length note B0", () => {
      const body = parseTuneBody("X:1\nK:C\nB0 B0 B0 B0 |", ctx);
      expect(body).to.not.be.null;
      const result = body!.accept(detector);
      expect(result).to.be.true;
    });

    it("should return true for zero-length chord", () => {
      const body = parseTuneBody("X:1\nK:C\n[CEG]0 |", ctx);
      expect(body).to.not.be.null;
      const result = body!.accept(detector);
      expect(result).to.be.true;
    });

    it("should return true for zero-length rest", () => {
      const body = parseTuneBody("X:1\nK:C\nz0 |", ctx);
      expect(body).to.not.be.null;
      const result = body!.accept(detector);
      expect(result).to.be.true;
    });

    it("should return true when zero-length note is inside a beam", () => {
      const body = parseTuneBody("X:1\nK:C\nAB0C |", ctx);
      expect(body).to.not.be.null;
      const result = body!.accept(detector);
      expect(result).to.be.true;
    });

    it("should return true when zero-length note is mixed with regular notes", () => {
      const body = parseTuneBody("X:1\nK:C\nC D E F | G A B0 c |", ctx);
      expect(body).to.not.be.null;
      const result = body!.accept(detector);
      expect(result).to.be.true;
    });
  });

  describe("returns false when no zero-length notes", () => {
    it("should return false for regular notes", () => {
      const body = parseTuneBody("X:1\nK:C\nC D E F |", ctx);
      expect(body).to.not.be.null;
      const result = body!.accept(detector);
      expect(result).to.be.false;
    });

    it("should return false for notes with various rhythms", () => {
      const body = parseTuneBody("X:1\nK:C\nC2 D/2 E3/2 F4 |", ctx);
      expect(body).to.not.be.null;
      const result = body!.accept(detector);
      expect(result).to.be.false;
    });

    it("should return false for chords without zero rhythm", () => {
      const body = parseTuneBody("X:1\nK:C\n[CEG]2 [FAc] |", ctx);
      expect(body).to.not.be.null;
      const result = body!.accept(detector);
      expect(result).to.be.false;
    });

    it("should return false for rests without zero rhythm", () => {
      const body = parseTuneBody("X:1\nK:C\nz2 z z/2 |", ctx);
      expect(body).to.not.be.null;
      const result = body!.accept(detector);
      expect(result).to.be.false;
    });

    it("should return false for empty tune body", () => {
      const body = parseTuneBody("X:1\nK:C\n|", ctx);
      expect(body).to.not.be.null;
      const result = body!.accept(detector);
      expect(result).to.be.false;
    });
  });

  describe("short-circuits on first zero-length note", () => {
    it("should return true immediately when zero-length note is found", () => {
      // The detector should return true after finding B0, not process the rest
      const body = parseTuneBody("X:1\nK:C\nB0 C D E F G A B c d e f |", ctx);
      expect(body).to.not.be.null;
      const result = body!.accept(detector);
      expect(result).to.be.true;
    });
  });
});
