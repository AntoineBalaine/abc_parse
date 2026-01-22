/**
 * ABC-specific generators for property-based testing
 *
 * These generators create valid ABC music notation for testing
 * the TreeSitter parser against the TypeScript parser.
 */

import fc from "fast-check";

// Generate valid note letters
export const genNoteLetter = fc.constantFrom(
  "a", "b", "c", "d", "e", "f", "g",
  "A", "B", "C", "D", "E", "F", "G"
);

// Generate accidentals
export const genAccidental = fc.constantFrom("", "^", "_", "=", "^^", "__");

// Generate octave modifiers
export const genOctave = fc
  .array(fc.constantFrom("'", ","), { minLength: 0, maxLength: 3 })
  .map((arr) => arr.join(""));

// Generate a simple pitch (accidental + note letter + octave)
export const genPitch = fc
  .tuple(genAccidental, genNoteLetter, genOctave)
  .map(([acc, note, oct]) => `${acc}${note}${oct}`);

// Generate rhythm numerator
export const genRhythmNumerator = fc.oneof(
  fc.constant(""),
  fc.integer({ min: 1, max: 16 }).map(String)
);

// Generate rhythm denominator
export const genRhythmDenominator = fc.oneof(
  fc.constant(""),
  fc.integer({ min: 1, max: 16 }).map((n) => `/${n}`),
  fc.constant("/"),
  fc.constant("//")
);

// Generate rhythm value
export const genRhythm = fc.oneof(
  fc.constant(""),
  fc.integer({ min: 1, max: 16 }).map(String),
  fc.integer({ min: 1, max: 8 }).map((n) => `/${n}`),
  fc
    .tuple(
      fc.integer({ min: 1, max: 8 }),
      fc.integer({ min: 1, max: 8 })
    )
    .map(([n, d]) => `${n}/${d}`)
);

// Generate a note with optional rhythm
export const genNoteWithRhythm = fc
  .tuple(genPitch, genRhythm)
  .map(([pitch, rhythm]) => `${pitch}${rhythm}`);

// Generate a rest
export const genRest = fc
  .tuple(fc.constantFrom("z", "Z", "x", "X"), genRhythm)
  .map(([rest, rhythm]) => `${rest}${rhythm}`);

// Generate a barline
export const genBarline = fc.constantFrom(
  "|", "||", "|]", "[|", ":|", "|:", "::", "[1", "[2", "|1", "|2"
);

// Generate music content (sequence of notes, rests, and barlines)
export const genMusicContent = fc
  .array(
    fc.oneof(
      { weight: 5, arbitrary: genNoteWithRhythm },
      { weight: 1, arbitrary: genRest },
      { weight: 2, arbitrary: genBarline }
    ),
    { minLength: 1, maxLength: 20 }
  )
  .map((items) => items.join(" "));

// Generate a simple chord
export const genChord = fc
  .tuple(
    fc.array(genPitch, { minLength: 2, maxLength: 4 }),
    genRhythm
  )
  .map(([pitches, rhythm]) => `[${pitches.join("")}]${rhythm}`);

// Generate a grace group
export const genGraceGroup = fc
  .tuple(
    fc.boolean(), // acciaccatura slash
    fc.array(genPitch, { minLength: 1, maxLength: 4 })
  )
  .map(([slash, pitches]) =>
    `{${slash ? "/" : ""}${pitches.join("")}}`
  );

// Generate common info line types
export const genInfoLineKey = fc.constantFrom(
  "T", "M", "L", "K", "C", "Q", "R", "N", "O", "A", "B", "D", "F", "G", "H", "S", "Z"
);

// Generate info line content (simplified)
export const genInfoLineContent = fc
  .array(
    fc.constantFrom(
      "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m",
      "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z",
      "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
      "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
      "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
      " ", "/", "-", "#", "b"
    ),
    { minLength: 1, maxLength: 30 }
  )
  .map((arr) => arr.join(""));

// Generate an info line
export const genInfoLine = fc
  .tuple(genInfoLineKey, genInfoLineContent)
  .map(([key, content]) => `${key}:${content}`);

// Generate key signature
export const genKeySignature = fc.constantFrom(
  "C", "G", "D", "A", "E", "B", "F#", "C#",
  "F", "Bb", "Eb", "Ab", "Db", "Gb", "Cb",
  "Am", "Em", "Bm", "F#m", "C#m", "G#m", "D#m", "A#m",
  "Dm", "Gm", "Cm", "Fm", "Bbm", "Ebm", "Abm"
);

// Generate meter
export const genMeter = fc.constantFrom(
  "4/4", "3/4", "2/4", "6/8", "9/8", "12/8", "2/2", "C", "C|", "none"
);

// Generate note length
export const genNoteLength = fc.constantFrom(
  "1/4", "1/8", "1/16", "1/2", "1/1"
);

// Generate a minimal tune header
export const genTuneHeader = fc
  .tuple(
    fc.integer({ min: 1, max: 999 }),
    fc
      .array(
        fc.constantFrom(
          "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m",
          "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z",
          " "
        ),
        { minLength: 1, maxLength: 30 }
      )
      .map((arr) => arr.join("")),
    genMeter,
    genNoteLength,
    genKeySignature
  )
  .map(
    ([num, title, meter, length, key]) =>
      `X:${num}\nT:${title}\nM:${meter}\nL:${length}\nK:${key}`
  );

// Generate a minimal complete tune
export const genTune = fc
  .tuple(genTuneHeader, genMusicContent)
  .map(([header, music]) => `${header}\n${music}\n`);

// Generate valid ABC syntax (various forms)
export const genValidABCSyntax = fc.oneof(
  { weight: 3, arbitrary: genTune },
  { weight: 2, arbitrary: genMusicContent },
  { weight: 1, arbitrary: genInfoLine }
);

// Generate a tune body line (music or inline field)
export const genTuneBodyLine = fc.oneof(
  { weight: 5, arbitrary: genMusicContent },
  {
    weight: 1,
    arbitrary: fc.constantFrom(
      "[K:G]", "[M:3/4]", "[L:1/8]", "[V:1]", "[V:2]"
    ),
  }
);

// Generate a comment
export const genComment = fc
  .array(
    fc.constantFrom(
      "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m",
      "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z",
      " ", "!", "?"
    ),
    { minLength: 0, maxLength: 40 }
  )
  .map((arr) => `%${arr.join("")}`);

// Generate a directive
export const genDirective = fc.constantFrom(
  "%%scale 1.0",
  "%%linebreak <EOL>",
  "%%stretchlast 1",
  "%%staffsep 50",
  "%%titleformat T",
  "%%gchordfont Helvetica 12"
);

// Generate a tune with various features
export const genComplexTune = fc
  .tuple(
    genTuneHeader,
    fc.array(
      fc.oneof(
        { weight: 4, arbitrary: genMusicContent },
        { weight: 1, arbitrary: genComment },
        { weight: 1, arbitrary: genDirective }
      ),
      { minLength: 1, maxLength: 5 }
    )
  )
  .map(([header, lines]) => `${header}\n${lines.join("\n")}\n`);
