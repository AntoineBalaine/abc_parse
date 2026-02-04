import { Selection } from "../selection";
import { CSNode, TAGS, isTokenNode, getTokenData } from "../csTree/types";
import { ABCContext, Pitch, Token, TT, toMidiPitch, fromMidiPitch } from "abc-parser";
import { toAst } from "../csTree/toAst";
import { fromAst } from "../csTree/fromAst";
import { findNodesById } from "./types";
import { findChildByTag, replaceChild } from "./treeUtils";

const FLAT_SPELLING: { letter: string; accidental: string | null }[] = [
  { letter: "C", accidental: null },   // 0
  { letter: "D", accidental: "_" },    // 1
  { letter: "D", accidental: null },   // 2
  { letter: "E", accidental: "_" },    // 3
  { letter: "E", accidental: null },   // 4
  { letter: "F", accidental: null },   // 5
  { letter: "G", accidental: "_" },    // 6
  { letter: "G", accidental: null },   // 7
  { letter: "A", accidental: "_" },    // 8
  { letter: "A", accidental: null },   // 9
  { letter: "B", accidental: "_" },    // 10
  { letter: "B", accidental: null },   // 11
];

export function fromMidiPitchFlat(midiPitch: number, ctx: ABCContext): Pitch {
  const pitchClass = midiPitch % 12;
  const { letter, accidental } = FLAT_SPELLING[pitchClass];

  const midiOctave = Math.floor(midiPitch / 12) - 1;

  let noteLetterToken: Token;
  let accidentalToken: Token | undefined;
  let octaveToken: Token | undefined;

  if (midiOctave <= 4) {
    noteLetterToken = new Token(TT.NOTE_LETTER, letter, ctx.generateId());
    if (midiOctave < 4) {
      octaveToken = new Token(TT.OCTAVE, ",".repeat(4 - midiOctave), ctx.generateId());
    }
  } else {
    noteLetterToken = new Token(TT.NOTE_LETTER, letter.toLowerCase(), ctx.generateId());
    if (midiOctave > 5) {
      octaveToken = new Token(TT.OCTAVE, "'".repeat(midiOctave - 5), ctx.generateId());
    }
  }

  if (accidental) {
    accidentalToken = new Token(TT.ACCIDENTAL, accidental, ctx.generateId());
  }

  return new Pitch(ctx.generateId(), {
    alteration: accidentalToken,
    noteLetter: noteLetterToken,
    octave: octaveToken,
  });
}

export function enharmonize(selection: Selection, ctx: ABCContext): Selection {
  for (const cursor of selection.cursors) {
    const nodes = findNodesById(selection.root, cursor);
    for (const csNode of nodes) {
      if (csNode.tag === TAGS.Note) {
        enharmonizePitchChild(csNode, ctx);
      } else if (csNode.tag === TAGS.Chord) {
        let current = csNode.firstChild;
        while (current !== null) {
          if (current.tag === TAGS.Note) {
            enharmonizePitchChild(current, ctx);
          }
          current = current.nextSibling;
        }
      }
    }
  }
  return selection;
}

function enharmonizePitchChild(noteNode: CSNode, ctx: ABCContext): void {
  const pitchResult = findChildByTag(noteNode, TAGS.Pitch);
  if (pitchResult === null) return;

  const pitchCSNode = pitchResult.node;

  // Walk the Pitch's children to find the Alteration token (TT.ACCIDENTAL)
  let alterationToken: CSNode | null = null;
  let current = pitchCSNode.firstChild;
  while (current !== null) {
    if (isTokenNode(current) && getTokenData(current).tokenType === TT.ACCIDENTAL) {
      alterationToken = current;
      break;
    }
    current = current.nextSibling;
  }

  if (alterationToken === null) return;

  const lexeme = getTokenData(alterationToken).lexeme;
  if (lexeme === "=") return;

  const pitchExpr = toAst(pitchCSNode) as Pitch;
  const midiPitch = toMidiPitch(pitchExpr);

  // Guard: skip if MIDI pitch is out of valid range
  if (midiPitch < 0 || midiPitch > 127) return;

  let newPitchExpr: Pitch | null = null;
  if (lexeme.startsWith("^")) {
    newPitchExpr = fromMidiPitchFlat(midiPitch, ctx);
  } else if (lexeme.startsWith("_")) {
    newPitchExpr = fromMidiPitch(midiPitch, ctx);
  }

  if (newPitchExpr === null) return;

  const newPitchCSNode = fromAst(newPitchExpr, ctx);
  replaceChild(noteNode, pitchResult.prev, pitchCSNode, newPitchCSNode);
}
