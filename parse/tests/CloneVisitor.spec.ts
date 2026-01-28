import chai from "chai";
import { ABCContext } from "../parsers/Context";
import { Scanner, Token, TT } from "../parsers/scan2";
import { ParseCtx, parseTune } from "../parsers/parse2";
import { cloneExpr, cloneLine, cloneToken } from "../Visitors/CloneVisitor";
import { Note, Pitch, Rhythm, Chord, Beam, BarLine, tune_body_code } from "../types/Expr2";

const expect = chai.expect;

// Helper function to create a basic token
function createToken(type: TT, lexeme: string, ctx: ABCContext): Token {
  const tokenCtx = {
    source: "",
    tokens: [],
    start: 0,
    current: lexeme.length,
    line: 0,
    report: () => {},
    push: () => {},
    test: () => false,
    abcContext: ctx,
    errorReporter: ctx.errorReporter,
  };
  const token = new Token(type, tokenCtx, ctx.generateId());
  Object.defineProperty(token, "lexeme", { value: lexeme, writable: false });
  return token;
}

// Helper function to create a basic Pitch
function createPitch(noteLetter: string, ctx: ABCContext): Pitch {
  return new Pitch(ctx.generateId(), {
    noteLetter: createToken(TT.NOTE_LETTER, noteLetter, ctx),
  });
}

// Helper function to create a basic Rhythm
function createRhythm(numerator: string, ctx: ABCContext): Rhythm {
  return new Rhythm(ctx.generateId(), createToken(TT.NUMBER, numerator, ctx), undefined, undefined, undefined);
}

// Helper function to create a basic Note
function createNote(noteLetter: string, ctx: ABCContext, rhythm?: string): Note {
  return new Note(ctx.generateId(), createPitch(noteLetter, ctx), rhythm ? createRhythm(rhythm, ctx) : undefined, undefined);
}

describe("CloneVisitor", () => {
  describe("cloneToken", () => {
    it("should create a new token with different ID", () => {
      const ctx = new ABCContext();
      const original = createToken(TT.NOTE_LETTER, "C", ctx);
      const cloned = cloneToken(original, ctx);

      expect(cloned.id).to.not.equal(original.id);
      expect(cloned.type).to.equal(original.type);
      expect(cloned.lexeme).to.equal(original.lexeme);
    });
  });

  describe("cloneExpr with Pitch", () => {
    it("should create a new pitch with different ID", () => {
      const ctx = new ABCContext();
      const original = createPitch("C", ctx);
      const cloned = cloneExpr(original, ctx);

      expect(cloned.id).to.not.equal(original.id);
      expect(cloned.noteLetter.lexeme).to.equal(original.noteLetter.lexeme);
      expect(cloned.noteLetter.id).to.not.equal(original.noteLetter.id);
    });

    it("should clone accidental and octave if present", () => {
      const ctx = new ABCContext();
      const original = new Pitch(ctx.generateId(), {
        alteration: createToken(TT.ACCIDENTAL, "_", ctx),
        noteLetter: createToken(TT.NOTE_LETTER, "B", ctx),
        octave: createToken(TT.OCTAVE, ",", ctx),
      });
      const cloned = cloneExpr(original, ctx);

      expect(cloned.alteration).to.not.be.undefined;
      expect(cloned.alteration!.id).to.not.equal(original.alteration!.id);
      expect(cloned.alteration!.lexeme).to.equal("_");
      expect(cloned.octave).to.not.be.undefined;
      expect(cloned.octave!.id).to.not.equal(original.octave!.id);
    });
  });

  describe("cloneExpr with Rhythm", () => {
    it("should create a new rhythm with different ID", () => {
      const ctx = new ABCContext();
      const original = createRhythm("2", ctx);
      const cloned = cloneExpr(original, ctx);

      expect(cloned.id).to.not.equal(original.id);
      expect(cloned.numerator!.lexeme).to.equal("2");
      expect(cloned.numerator!.id).to.not.equal(original.numerator!.id);
    });
  });

  describe("cloneExpr with Note", () => {
    it("should create a new note with different ID", () => {
      const ctx = new ABCContext();
      const original = createNote("C", ctx);
      const cloned = cloneExpr(original, ctx);

      expect(cloned.id).to.not.equal(original.id);
      expect(cloned.pitch.id).to.not.equal(original.pitch.id);
      expect(cloned.pitch.noteLetter.lexeme).to.equal("C");
    });

    it("should clone rhythm if present", () => {
      const ctx = new ABCContext();
      const original = createNote("C", ctx, "2");
      const cloned = cloneExpr(original, ctx);

      expect(cloned.rhythm).to.not.be.undefined;
      expect(cloned.rhythm!.id).to.not.equal(original.rhythm!.id);
      expect(cloned.rhythm!.numerator!.lexeme).to.equal("2");
    });

    it("should clone tie if present", () => {
      const ctx = new ABCContext();
      const original = new Note(ctx.generateId(), createPitch("C", ctx), undefined, createToken(TT.TIE, "-", ctx));
      const cloned = cloneExpr(original, ctx);

      expect(cloned.tie).to.not.be.undefined;
      expect(cloned.tie!.id).to.not.equal(original.tie!.id);
      expect(cloned.tie!.lexeme).to.equal("-");
    });
  });

  describe("cloneExpr with Chord", () => {
    it("should create a new chord with different ID", () => {
      const ctx = new ABCContext();
      const original = new Chord(
        ctx.generateId(),
        [createNote("C", ctx), createNote("E", ctx), createNote("G", ctx)],
        undefined, // rhythm
        undefined, // tie
        createToken(TT.CHRD_LEFT_BRKT, "[", ctx),
        createToken(TT.CHRD_RIGHT_BRKT, "]", ctx)
      );
      const cloned = cloneExpr(original, ctx);

      expect(cloned.id).to.not.equal(original.id);
      expect(cloned.contents).to.have.lengthOf(3);
      expect((cloned.contents[0] as Note).id).to.not.equal((original.contents[0] as Note).id);
      expect((cloned.contents[1] as Note).id).to.not.equal((original.contents[1] as Note).id);
      expect((cloned.contents[2] as Note).id).to.not.equal((original.contents[2] as Note).id);
    });
  });

  describe("cloneExpr with Beam", () => {
    it("should clone all elements in the beam", () => {
      const ctx = new ABCContext();
      const original = new Beam(ctx.generateId(), [createNote("C", ctx), createNote("D", ctx), createNote("E", ctx), createNote("F", ctx)]);
      const cloned = cloneExpr(original, ctx);

      expect(cloned.id).to.not.equal(original.id);
      expect(cloned.contents).to.have.lengthOf(4);
      for (let i = 0; i < 4; i++) {
        expect(cloned.contents[i]).to.be.instanceOf(Note);
        expect((cloned.contents[i] as Note).id).to.not.equal((original.contents[i] as Note).id);
      }
    });
  });

  describe("cloneExpr with BarLine", () => {
    it("should clone barline tokens", () => {
      const ctx = new ABCContext();
      const original = new BarLine(ctx.generateId(), [createToken(TT.BARLINE, "|", ctx)], undefined);
      const cloned = cloneExpr(original, ctx);

      expect(cloned.id).to.not.equal(original.id);
      expect(cloned.barline).to.have.lengthOf(1);
      expect(cloned.barline[0].id).to.not.equal(original.barline[0].id);
      expect(cloned.barline[0].lexeme).to.equal("|");
    });
  });

  describe("cloneLine", () => {
    it("should clone all elements in a line", () => {
      const ctx = new ABCContext();
      const line: tune_body_code[] = [createNote("C", ctx), createNote("D", ctx), createToken(TT.BARLINE, "|", ctx), createNote("E", ctx)];
      const cloned = cloneLine(line, ctx);

      expect(cloned).to.have.lengthOf(4);
      for (let i = 0; i < 4; i++) {
        expect(cloned[i]).to.not.equal(line[i]);
        if ("id" in cloned[i] && "id" in line[i]) {
          expect((cloned[i] as any).id).to.not.equal((line[i] as any).id);
        }
      }
    });

    it("should maintain the same structure as original", () => {
      const ctx = new ABCContext();
      const line: tune_body_code[] = [createNote("C", ctx, "2"), createNote("D", ctx)];
      const cloned = cloneLine(line, ctx);

      expect(cloned[0]).to.be.instanceOf(Note);
      expect(cloned[1]).to.be.instanceOf(Note);
      expect((cloned[0] as Note).rhythm).to.not.be.undefined;
      expect((cloned[1] as Note).rhythm).to.be.undefined;
    });
  });

  describe("cloneExpr - integration with parsed ABC", () => {
    it("should clone a note from parsed ABC", () => {
      const sample = `X:1
K:C
C2|`;
      const ctx = new ABCContext();
      const tokens = Scanner(sample, ctx);
      const parseCtx = new ParseCtx(tokens, ctx);
      const tune = parseTune(parseCtx);

      const elements = tune.tune_body?.sequence.flat() || [];
      const note = elements.find((e): e is Note => e instanceof Note);

      expect(note).to.not.be.undefined;
      const cloned = cloneExpr(note!, ctx);

      expect(cloned).to.be.instanceOf(Note);
      expect(cloned.id).to.not.equal(note!.id);
      expect(cloned.pitch.id).to.not.equal(note!.pitch.id);
    });

    it("should clone a chord from parsed ABC", () => {
      const sample = `X:1
K:C
[CEG]2|`;
      const ctx = new ABCContext();
      const tokens = Scanner(sample, ctx);
      const parseCtx = new ParseCtx(tokens, ctx);
      const tune = parseTune(parseCtx);

      const elements = tune.tune_body?.sequence.flat() || [];
      const chord = elements.find((e): e is Chord => e instanceof Chord);

      expect(chord).to.not.be.undefined;
      const cloned = cloneExpr(chord!, ctx);

      expect(cloned).to.be.instanceOf(Chord);
      expect(cloned.id).to.not.equal(chord!.id);
      expect(cloned.contents[0].id).to.not.equal(chord!.contents[0].id);
    });

    it("should clone a beam from parsed ABC", () => {
      const sample = `X:1
K:C
CDEF|`;
      const ctx = new ABCContext();
      const tokens = Scanner(sample, ctx);
      const parseCtx = new ParseCtx(tokens, ctx);
      const tune = parseTune(parseCtx);

      const elements = tune.tune_body?.sequence.flat() || [];
      const beam = elements.find((e): e is Beam => e instanceof Beam);

      expect(beam).to.not.be.undefined;
      const cloned = cloneExpr(beam!, ctx);

      expect(cloned).to.be.instanceOf(Beam);
      expect(cloned.id).to.not.equal(beam!.id);
      expect(cloned.contents.length).to.equal(beam!.contents.length);
    });

    it("should clone an entire music line from parsed ABC", () => {
      const sample = `X:1
K:C
C2 D E/2 F|`;
      const ctx = new ABCContext();
      const tokens = Scanner(sample, ctx);
      const parseCtx = new ParseCtx(tokens, ctx);
      const tune = parseTune(parseCtx);

      const line = tune.tune_body?.sequence[0] || [];
      const cloned = cloneLine(line, ctx);

      expect(cloned.length).to.equal(line.length);

      // Verify all IDs are different
      for (let i = 0; i < line.length; i++) {
        const orig = line[i];
        const clone = cloned[i];
        if ("id" in orig && "id" in clone) {
          expect((clone as any).id).to.not.equal((orig as any).id);
        }
      }
    });
  });

  describe("nested cloning", () => {
    it("should not share any references between original and clone", () => {
      const ctx = new ABCContext();
      const originalNote = createNote("C", ctx, "2");
      const clonedNote = cloneExpr(originalNote, ctx);

      // Modify cloned note's rhythm
      if (clonedNote.rhythm && clonedNote.rhythm.numerator) {
        Object.defineProperty(clonedNote.rhythm.numerator, "lexeme", {
          value: "4",
          writable: false,
        });
      }

      // Original should be unchanged
      expect(originalNote.rhythm!.numerator!.lexeme).to.equal("2");
    });
  });
});
