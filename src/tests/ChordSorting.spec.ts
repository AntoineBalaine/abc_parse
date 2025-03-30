import { expect } from "chai";
import * as fc from "fast-check";
import { isNote, isToken } from "../helpers";
import { ABCContext } from "../parsers/Context";
import { parse } from "../parsers/parse2";
import { Scanner2, Token, TT } from "../parsers/scan2";
import { Annotation, Chord, Note, Pitch } from "../types/Expr2";
import { AbcFormatter2, getSplits, sortNotes, toMidiPitch } from "../Visitors/Formatter2";
import * as ParseGen from "./parse2_pbt.generators.spec";
import * as ScanGen from "./scan2_pbt.generators.spec";

describe("Chord Note Sorting Functions", () => {
  let ctx: ABCContext;

  beforeEach(() => {
    ctx = new ABCContext();
  });

  describe("toMidiPitch", () => {
    it("should calculate correct MIDI pitch values for basic notes", () => {
      // Create pitches for testing
      const pitchC = new Pitch(ctx.generateId(), {
        noteLetter: new Token(TT.NOTE_LETTER, "C", ctx.generateId()),
      });
      const pitchD = new Pitch(ctx.generateId(), {
        noteLetter: new Token(TT.NOTE_LETTER, "D", ctx.generateId()),
      });
      const pitchE = new Pitch(ctx.generateId(), {
        noteLetter: new Token(TT.NOTE_LETTER, "E", ctx.generateId()),
      });

      // Calculate MIDI pitch values
      const midiC = toMidiPitch(pitchC);
      const midiD = toMidiPitch(pitchD);
      const midiE = toMidiPitch(pitchE);

      // Check relative values (C < D < E)
      expect(midiC).to.be.lessThan(midiD);
      expect(midiD).to.be.lessThan(midiE);
    });

    it("should handle alterations correctly", () => {
      // Create pitches with alterations
      const pitchCSharp = new Pitch(ctx.generateId(), {
        noteLetter: new Token(TT.NOTE_LETTER, "C", ctx.generateId()),
        alteration: new Token(TT.ACCIDENTAL, "^", ctx.generateId()),
      });
      const pitchDFlat = new Pitch(ctx.generateId(), {
        noteLetter: new Token(TT.NOTE_LETTER, "D", ctx.generateId()),
        alteration: new Token(TT.ACCIDENTAL, "_", ctx.generateId()),
      });
      const pitchE = new Pitch(ctx.generateId(), {
        noteLetter: new Token(TT.NOTE_LETTER, "E", ctx.generateId()),
      });

      // Calculate MIDI pitch values
      const midiCSharp = toMidiPitch(pitchCSharp);
      const midiDFlat = toMidiPitch(pitchDFlat);
      const midiE = toMidiPitch(pitchE);

      // C# and Db should have the same pitch value
      expect(midiCSharp).to.equal(midiDFlat);
      // E should be higher than C# and Db
      expect(midiCSharp).to.be.lessThan(midiE);
    });

    it("should handle octave markers correctly", () => {
      // Create pitches with different octaves
      const pitchC = new Pitch(ctx.generateId(), {
        noteLetter: new Token(TT.NOTE_LETTER, "C", ctx.generateId()),
      });
      const pitchCHigher = new Pitch(ctx.generateId(), {
        noteLetter: new Token(TT.NOTE_LETTER, "C", ctx.generateId()),
        octave: new Token(TT.OCTAVE, "'", ctx.generateId()),
      });
      const pitchCLower = new Pitch(ctx.generateId(), {
        noteLetter: new Token(TT.NOTE_LETTER, "C", ctx.generateId()),
        octave: new Token(TT.OCTAVE, ",", ctx.generateId()),
      });

      // Calculate MIDI pitch values
      const midiC = toMidiPitch(pitchC);
      const midiCHigher = toMidiPitch(pitchCHigher);
      const midiCLower = toMidiPitch(pitchCLower);

      // Check relative values (C, < C < C')
      expect(midiCLower).to.be.lessThan(midiC);
      expect(midiC).to.be.lessThan(midiCHigher);
      // The difference should be exactly 12 (one octave)
      expect(midiCHigher - midiC).to.equal(12);
      expect(midiC - midiCLower).to.equal(12);
    });

    it("should handle lowercase letters as one octave higher", () => {
      // Create pitches with uppercase and lowercase letters
      const pitchC = new Pitch(ctx.generateId(), {
        noteLetter: new Token(TT.NOTE_LETTER, "C", ctx.generateId()),
      });
      const pitchc = new Pitch(ctx.generateId(), {
        noteLetter: new Token(TT.NOTE_LETTER, "c", ctx.generateId()),
      });

      // Calculate MIDI pitch values
      const midiC = toMidiPitch(pitchC);
      const midic = toMidiPitch(pitchc);

      // Lowercase c should be one octave higher than uppercase C
      expect(midic - midiC).to.equal(12);
    });

    it("should handle complex alterations and octaves", () => {
      // Create pitches with complex alterations and octaves
      const pitchCDoubleSharpHigher = new Pitch(ctx.generateId(), {
        noteLetter: new Token(TT.NOTE_LETTER, "C", ctx.generateId()),
        alteration: new Token(TT.ACCIDENTAL, "^^", ctx.generateId()),
        octave: new Token(TT.OCTAVE, "'", ctx.generateId()),
      });
      const pitchDFlatLower = new Pitch(ctx.generateId(), {
        noteLetter: new Token(TT.NOTE_LETTER, "D", ctx.generateId()),
        alteration: new Token(TT.ACCIDENTAL, "_", ctx.generateId()),
        octave: new Token(TT.OCTAVE, ",", ctx.generateId()),
      });

      // Calculate MIDI pitch values
      const midiCDoubleSharpHigher = toMidiPitch(pitchCDoubleSharpHigher);
      const midiDFlatLower = toMidiPitch(pitchDFlatLower);

      // C^^ in octave 5 should be higher than D_ in octave 3
      expect(midiDFlatLower).to.be.lessThan(midiCDoubleSharpHigher);
    });
  });

  describe("getSplits", () => {
    it("should correctly split chord contents into groups", () => {
      // Create a chord with notes and tokens
      const contents: Array<Note | Token | Annotation> = [
        new Token(TT.DECORATION, ".", ctx.generateId()),
        new Note(
          ctx.generateId(),
          new Pitch(ctx.generateId(), {
            noteLetter: new Token(TT.NOTE_LETTER, "C", ctx.generateId()),
          })
        ),
        new Token(TT.DECORATION, "~", ctx.generateId()),
        new Note(
          ctx.generateId(),
          new Pitch(ctx.generateId(), {
            noteLetter: new Token(TT.NOTE_LETTER, "E", ctx.generateId()),
          })
        ),
        new Token(TT.DECORATION, "!", ctx.generateId()),
        new Note(
          ctx.generateId(),
          new Pitch(ctx.generateId(), {
            noteLetter: new Token(TT.NOTE_LETTER, "G", ctx.generateId()),
          })
        ),
      ];

      // Get the splits
      const splits = getSplits(contents);

      // Should have 3 groups (one for each note)
      expect(splits.length).to.equal(3);

      // Each group should contain the tokens before the note and the note itself
      expect(splits[0].length).to.equal(2); // [., C]
      expect(splits[1].length).to.equal(2); // [~, E]
      expect(splits[2].length).to.equal(2); // [!, G]

      // Check that each group contains the correct note
      expect(isNote(splits[0][1])).to.be.true;
      expect((splits[0][1] as Note).pitch.noteLetter.lexeme).to.equal("C");

      expect(isNote(splits[1][1])).to.be.true;
      expect((splits[1][1] as Note).pitch.noteLetter.lexeme).to.equal("E");

      expect(isNote(splits[2][1])).to.be.true;
      expect((splits[2][1] as Note).pitch.noteLetter.lexeme).to.equal("G");
    });

    it("should handle property-based tests for splitting", () => {
      fc.assert(
        fc.property(
          // Generate 2-5 notes
          fc.array(ParseGen.genNoteExpr, { minLength: 2, maxLength: 5 }),
          // Generate 0-3 tokens
          fc.array(ScanGen.genDecoration, { maxLength: 3 }),
          (noteExprs, decorations) => {
            // Create a mixed array of notes and tokens
            const contents: Array<Note | Token | Annotation> = [];

            // Add some tokens before each note
            noteExprs.forEach((ne, index) => {
              // Add a decoration if available
              if (index < decorations.length) {
                contents.push(decorations[index]);
              }

              // Add the note
              contents.push(ne.expr);
            });

            // Get the splits
            const splits = getSplits(contents);

            // Should have the same number of groups as notes
            expect(splits.length).to.equal(noteExprs.length);

            // Each group should contain at least one element (the note)
            splits.forEach((group) => {
              expect(group.length).to.be.at.least(1);

              // The last element in each group should be a note
              const lastElement = group[group.length - 1];
              expect(isNote(lastElement)).to.be.true;
            });

            return true;
          }
        )
      );
    });
  });

  describe("sortNotes", () => {
    it("should sort notes from lowest to highest", () => {
      // Create a chord with notes in random order
      const contents: Array<Note | Token | Annotation> = [
        new Note(
          ctx.generateId(),
          new Pitch(ctx.generateId(), {
            noteLetter: new Token(TT.NOTE_LETTER, "G", ctx.generateId()),
          })
        ),
        new Note(
          ctx.generateId(),
          new Pitch(ctx.generateId(), {
            noteLetter: new Token(TT.NOTE_LETTER, "C", ctx.generateId()),
          })
        ),
        new Note(
          ctx.generateId(),
          new Pitch(ctx.generateId(), {
            noteLetter: new Token(TT.NOTE_LETTER, "E", ctx.generateId()),
          })
        ),
      ];

      // Sort the notes
      const sorted = sortNotes(contents);

      // Should have the same number of elements
      expect(sorted.length).to.equal(contents.length);

      // Notes should be sorted from lowest to highest: C, E, G
      expect(isNote(sorted[0])).to.be.true;
      expect((sorted[0] as Note).pitch.noteLetter.lexeme).to.equal("C");

      expect(isNote(sorted[1])).to.be.true;
      expect((sorted[1] as Note).pitch.noteLetter.lexeme).to.equal("E");

      expect(isNote(sorted[2])).to.be.true;
      expect((sorted[2] as Note).pitch.noteLetter.lexeme).to.equal("G");
    });

    it("should preserve tokens associated with notes", () => {
      // Create a chord with notes and tokens
      const contents: Array<Note | Token | Annotation> = [
        new Token(TT.DECORATION, ".", ctx.generateId()),
        new Note(
          ctx.generateId(),
          new Pitch(ctx.generateId(), {
            noteLetter: new Token(TT.NOTE_LETTER, "G", ctx.generateId()),
          })
        ),
        new Token(TT.DECORATION, "~", ctx.generateId()),
        new Note(
          ctx.generateId(),
          new Pitch(ctx.generateId(), {
            noteLetter: new Token(TT.NOTE_LETTER, "C", ctx.generateId()),
          })
        ),
        new Token(TT.DECORATION, "!", ctx.generateId()),
        new Note(
          ctx.generateId(),
          new Pitch(ctx.generateId(), {
            noteLetter: new Token(TT.NOTE_LETTER, "E", ctx.generateId()),
          })
        ),
      ];

      // Sort the notes
      const sorted = sortNotes(contents);

      // Should have the same number of elements
      expect(sorted.length).to.equal(contents.length);

      // Notes should be sorted from lowest to highest: C, E, G
      // And tokens should stay with their associated notes

      // First group: [~, C]
      expect(isToken(sorted[0])).to.be.true;
      expect((sorted[0] as Token).lexeme).to.equal("~");
      expect(isNote(sorted[1])).to.be.true;
      expect((sorted[1] as Note).pitch.noteLetter.lexeme).to.equal("C");

      // Second group: [!, E]
      expect(isToken(sorted[2])).to.be.true;
      expect((sorted[2] as Token).lexeme).to.equal("!");
      expect(isNote(sorted[3])).to.be.true;
      expect((sorted[3] as Note).pitch.noteLetter.lexeme).to.equal("E");

      // Third group: [., G]
      expect(isToken(sorted[4])).to.be.true;
      expect((sorted[4] as Token).lexeme).to.equal(".");
      expect(isNote(sorted[5])).to.be.true;
      expect((sorted[5] as Note).pitch.noteLetter.lexeme).to.equal("G");
    });

    it("should handle property-based tests for sorting", () => {
      fc.assert(
        fc.property(
          // Generate 2-5 notes
          fc.array(ParseGen.genNoteExpr, { minLength: 2, maxLength: 5 }),
          (noteExprs) => {
            // Create an array of notes
            const contents: Array<Note> = noteExprs.map((ne) => ne.expr);

            // Sort the notes
            const sorted = sortNotes(contents);

            // Should have the same number of elements
            expect(sorted.length).to.equal(contents.length);

            // Check that the notes are sorted by pitch
            for (let i = 1; i < sorted.length; i++) {
              if (isNote(sorted[i - 1]) && isNote(sorted[i])) {
                const prevNote = sorted[i - 1] as Note;
                const currNote = sorted[i] as Note;

                if (prevNote.pitch instanceof Pitch && currNote.pitch instanceof Pitch) {
                  const prevPitch = toMidiPitch(prevNote.pitch);
                  const currPitch = toMidiPitch(currNote.pitch);

                  // Each note should be higher or equal to the previous note
                  expect(prevPitch).to.be.at.most(currPitch);
                }
              }
            }

            return true;
          }
        )
      );
    });
  });

  describe("Integration with formatter", () => {
    it("should correctly re-order notes in a chord when formatting", () => {
      // Create a formatter
      const formatter = new AbcFormatter2(ctx);

      // Create a chord with notes in a specific order (G, C, E)
      const chord = new Chord(ctx.generateId(), [
        new Note(
          ctx.generateId(),
          new Pitch(ctx.generateId(), {
            noteLetter: new Token(TT.NOTE_LETTER, "G", ctx.generateId()),
          })
        ),
        new Note(
          ctx.generateId(),
          new Pitch(ctx.generateId(), {
            noteLetter: new Token(TT.NOTE_LETTER, "C", ctx.generateId()),
          })
        ),
        new Note(
          ctx.generateId(),
          new Pitch(ctx.generateId(), {
            noteLetter: new Token(TT.NOTE_LETTER, "E", ctx.generateId()),
          })
        ),
      ]);

      // Format the chord (which should sort the notes)
      formatter.no_format = false; // Enable formatting
      const formatted = formatter.visitChordExpr(chord);

      // The notes should be sorted from lowest to highest: C, E, G
      expect(formatted).to.equal("[CEG]");
    });

    it("should preserve tokens and annotations when re-ordering chord notes", () => {
      // Create a formatter
      const formatter = new AbcFormatter2(ctx);

      // Create a chord with notes and tokens in a specific order
      const chord = new Chord(ctx.generateId(), [
        new Token(TT.DECORATION, ".", ctx.generateId()),
        new Note(
          ctx.generateId(),
          new Pitch(ctx.generateId(), {
            noteLetter: new Token(TT.NOTE_LETTER, "G", ctx.generateId()),
          })
        ),
        new Token(TT.DECORATION, "~", ctx.generateId()),
        new Note(
          ctx.generateId(),
          new Pitch(ctx.generateId(), {
            noteLetter: new Token(TT.NOTE_LETTER, "C", ctx.generateId()),
          })
        ),
        new Token(TT.DECORATION, "!", ctx.generateId()),
        new Note(
          ctx.generateId(),
          new Pitch(ctx.generateId(), {
            noteLetter: new Token(TT.NOTE_LETTER, "E", ctx.generateId()),
          })
        ),
      ]);

      // Format the chord (which should sort the notes and preserve tokens)
      formatter.no_format = false; // Enable formatting
      const formatted = formatter.visitChordExpr(chord);

      // The notes should be sorted from lowest to highest: C, E, G
      // And the tokens should stay with their associated notes
      expect(formatted).to.equal("[~C!E.G]");
    });

    it("should not re-order notes when no_format is true", () => {
      // Create a formatter
      const formatter = new AbcFormatter2(ctx);

      // Create a chord with notes in a specific order (G, C, E)
      const chord = new Chord(ctx.generateId(), [
        new Note(
          ctx.generateId(),
          new Pitch(ctx.generateId(), {
            noteLetter: new Token(TT.NOTE_LETTER, "G", ctx.generateId()),
          })
        ),
        new Note(
          ctx.generateId(),
          new Pitch(ctx.generateId(), {
            noteLetter: new Token(TT.NOTE_LETTER, "C", ctx.generateId()),
          })
        ),
        new Note(
          ctx.generateId(),
          new Pitch(ctx.generateId(), {
            noteLetter: new Token(TT.NOTE_LETTER, "E", ctx.generateId()),
          })
        ),
      ]);

      // Stringify the chord (which should not sort the notes)
      formatter.no_format = true; // Disable formatting
      const stringified = formatter.visitChordExpr(chord);

      // The notes should remain in their original order: G, C, E
      expect(stringified).to.equal("[GCE]");
    });

    it("should handle complex chords with alterations and octaves", () => {
      // Create a formatter
      const formatter = new AbcFormatter2(ctx);

      // Create a chord with complex notes
      const chord = new Chord(ctx.generateId(), [
        new Note(
          ctx.generateId(),
          new Pitch(ctx.generateId(), {
            noteLetter: new Token(TT.NOTE_LETTER, "c", ctx.generateId()),
            alteration: new Token(TT.ACCIDENTAL, "^^", ctx.generateId()),
            octave: new Token(TT.OCTAVE, "'", ctx.generateId()),
          })
        ),
        new Note(
          ctx.generateId(),
          new Pitch(ctx.generateId(), {
            noteLetter: new Token(TT.NOTE_LETTER, "D", ctx.generateId()),
            alteration: new Token(TT.ACCIDENTAL, "_", ctx.generateId()),
            octave: new Token(TT.OCTAVE, ",", ctx.generateId()),
          })
        ),
        new Note(
          ctx.generateId(),
          new Pitch(ctx.generateId(), {
            noteLetter: new Token(TT.NOTE_LETTER, "e", ctx.generateId()),
          })
        ),
      ]);

      // Format the chord
      formatter.no_format = false;
      const formatted = formatter.visitChordExpr(chord);

      // The notes should be sorted from lowest to highest
      // D_ in octave 3 < C^^ in octave 5 < e in octave 5
      expect(formatted).to.equal("[_D,e^^c']");
    });

    it("should correctly format chords in a multi-voice tune - integration test", () => {
      // Import necessary scanner and parser functions

      // ABC string with chords in a multi-voice tune
      const abcString = `X:1
V:1
V:2
V:1
[edc][gfe] |
V:2
a2         |`;

      // Create a context for parsing
      const abcCtx = new ABCContext();

      // Scan the ABC string to get tokens
      const tokens = Scanner2(abcString, abcCtx);

      // Parse the tokens to get an AST
      const ast = parse(tokens, abcCtx);

      // Create a formatter
      const formatter = new AbcFormatter2(abcCtx);
      formatter.no_format = false;

      const formatted = formatter.formatFile(ast);
      expect(formatted).to.include("[cde]");
      expect(formatted).to.include("[efg]");
    });
  });
});
