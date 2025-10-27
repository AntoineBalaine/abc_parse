import { assert } from "chai";
import { ABCContext } from "../parsers/Context";
import { prsBody, ParseCtx } from "../parsers/parse2";
import { TT } from "../parsers/scan2";
import { Tune_Body, Chord, Note, Pitch, SystemBreak } from "../types/Expr2";
import { createToken } from "./prs_music_code.spec";

describe("Round Trip Tests", () => {
  it("should correctly round-trip chord expression [^aa]", () => {
    const abcContext = new ABCContext();

    // Create tokens for [^aa]
    const tokens = [
      createToken(TT.CHRD_LEFT_BRKT, "["),
      createToken(TT.ACCIDENTAL, "^"),
      createToken(TT.NOTE_LETTER, "a"),
      createToken(TT.NOTE_LETTER, "a"),
      createToken(TT.CHRD_RIGHT_BRKT, "]"),
      createToken(TT.EOL, "\n"),
    ];

    // Parse the tokens using prsBody
    const tuneBody = prsBody(new ParseCtx(tokens, abcContext));

    // Verify the result
    assert.isNotNull(tuneBody);
    assert.instanceOf(tuneBody, Tune_Body);
    assert.isArray(tuneBody.sequence);
    assert.isTrue(tuneBody.sequence.length > 0);

    // Get the first expression from the tune body
    const parsedExpr = tuneBody.sequence[0][0];
    assert.instanceOf(parsedExpr, Chord);

    const chord = parsedExpr as Chord;
    assert.equal(chord.contents.length, 2);

    // First note should have an accidental
    assert.instanceOf(chord.contents[0], Note);
    assert.instanceOf((chord.contents[0] as Note).pitch, Pitch);
    assert.equal(((chord.contents[0] as Note).pitch as Pitch).noteLetter.lexeme, "a");
    assert.equal(((chord.contents[0] as Note).pitch as Pitch).alteration?.lexeme, "^");

    // Second note should not have an accidental
    assert.instanceOf(chord.contents[1], Note);
    assert.instanceOf((chord.contents[1] as Note).pitch, Pitch);
    assert.equal(((chord.contents[1] as Note).pitch as Pitch).noteLetter.lexeme, "a");
    assert.isUndefined(((chord.contents[1] as Note).pitch as Pitch).alteration);
  });

  // This test case is based on a failing case from property-based testing
  it("should correctly round-trip chord expression [A_a]", () => {
    const abcContext = new ABCContext();

    // Create tokens for [A_a]
    const tokens = [
      createToken(TT.CHRD_LEFT_BRKT, "["),
      createToken(TT.NOTE_LETTER, "A"),
      createToken(TT.ACCIDENTAL, "_"),
      createToken(TT.NOTE_LETTER, "a"),
      createToken(TT.CHRD_RIGHT_BRKT, "]"),
      createToken(TT.EOL, "\n"),
    ];

    // Parse the tokens using prsBody
    const tuneBody = prsBody(new ParseCtx(tokens, abcContext));

    // Verify the result
    assert.isNotNull(tuneBody);
    assert.instanceOf(tuneBody, Tune_Body);
    assert.isArray(tuneBody.sequence);
    assert.isTrue(tuneBody.sequence.length > 0);

    // Get the first expression from the tune body
    const parsedExpr = tuneBody.sequence[0][0];
    assert.instanceOf(parsedExpr, Chord);

    const chord = parsedExpr as Chord;
    assert.equal(chord.contents.length, 2);

    // First note should be 'A' without an accidental
    assert.instanceOf(chord.contents[0], Note);
    assert.instanceOf((chord.contents[0] as Note).pitch, Pitch);
    assert.equal(((chord.contents[0] as Note).pitch as Pitch).noteLetter.lexeme, "A");
    assert.isUndefined(((chord.contents[0] as Note).pitch as Pitch).alteration);

    // Second note should be 'a' with a flat accidental
    assert.instanceOf(chord.contents[1], Note);
    assert.instanceOf((chord.contents[1] as Note).pitch, Pitch);
    assert.equal(((chord.contents[1] as Note).pitch as Pitch).noteLetter.lexeme, "a");
    assert.equal(((chord.contents[1] as Note).pitch as Pitch).alteration?.lexeme, "_");
  });

  it("should correctly round-trip system break expression", () => {
    const abcContext = new ABCContext();

    // Create tokens for a system break surrounded by notes: C ! D
    const tokens = [
      createToken(TT.NOTE_LETTER, "C"),
      createToken(TT.SYSTEM_BREAK, "!"),
      createToken(TT.NOTE_LETTER, "D"),
      createToken(TT.EOL, "\n"),
    ];

    // Parse the tokens using prsBody
    const tuneBody = prsBody(new ParseCtx(tokens, abcContext));

    // Verify the result
    assert.isNotNull(tuneBody);
    assert.instanceOf(tuneBody, Tune_Body);
    assert.isArray(tuneBody.sequence);
    assert.isTrue(tuneBody.sequence.length > 0);

    // The sequence should contain: Note, RendererBreak, Note, and possibly EOL
    const sequence = tuneBody.sequence[0];

    // Find the system break in the sequence
    const systemBreakIndex = sequence.findIndex((item) => item instanceof SystemBreak);
    assert.isTrue(systemBreakIndex >= 0, "Should find a SystemBreak in the sequence");

    const systemBreak = sequence[systemBreakIndex] as SystemBreak;
    assert.equal(systemBreak.symbol.lexeme, "!");

    // Verify we have notes before and after
    const notesBefore = sequence.slice(0, systemBreakIndex).filter((item) => item instanceof Note);
    const notesAfter = sequence.slice(systemBreakIndex + 1).filter((item) => item instanceof Note);

    assert.isTrue(notesBefore.length > 0, "Should have at least one note before the system break");
    assert.isTrue(notesAfter.length > 0, "Should have at least one note after the system break");

    assert.equal(((notesBefore[0] as Note).pitch as Pitch).noteLetter.lexeme, "C");
    assert.equal(((notesAfter[0] as Note).pitch as Pitch).noteLetter.lexeme, "D");
  });
});

