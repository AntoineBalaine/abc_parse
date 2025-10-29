import * as fc from "fast-check";
import { ABCContext } from "../parsers/Context";
import { AbcErrorReporter } from "../parsers/ErrorReporter";
import { Token, TT } from "../parsers/scan2";
import { KeyRoot, KeyAccidental, Mode, MeterType, ClefType } from "../types/abcjs-ast";
import { Info_line, Binary, KV } from "../types/Expr2";

// Shared context for all generators
export const sharedContext = new ABCContext(new AbcErrorReporter());

// ============================================================================
// Key Info Line Generators (K:)
// ============================================================================

export const genKeyRoot = fc.constantFrom("A", "B", "C", "D", "E", "F", "G");
// ABC pitch notation: ^ for sharp, _ for flat, empty for natural
export const genKeyAccidental = fc.constantFrom("", "^", "_");

export const genMode = fc.constantFrom(
  "major",
  "minor",
  "m",
  "dorian",
  "phrygian",
  "lydian",
  "mixolydian",
  "locrian",
  "Mix",
  "Dor",
  "Phr",
  "Lyd",
  "Loc"
);

export const genClefName = fc.constantFrom("treble", "bass", "alto", "tenor", "perc", "none");

/**
 * Generate K: info line with key root only (e.g., "K:C", "K:G")
 */
export const genKeyInfoSimple = genKeyRoot.map((root) => {
  const keyToken = new Token(TT.IDENTIFIER, root, sharedContext.generateId());
  const tokens = [keyToken];

  return {
    infoLine: new Info_line(sharedContext.generateId(), [new Token(TT.IDENTIFIER, "K:", sharedContext.generateId()), ...tokens]),
    expected: {
      type: "key" as const,
      root: root as KeyRoot,
      acc: KeyAccidental.None,
      mode: Mode.Major,
    },
  };
});

/**
 * Generate K: info line with key root and accidental (e.g., "K:^f", "K:_b")
 * Uses ABC pitch notation: ^ for sharp, _ for flat
 */
export const genKeyInfoWithAccidental = fc
  .record({
    root: genKeyRoot,
    acc: fc.constantFrom("^", "_"),
  })
  .map(({ root, acc }) => {
    // ABC pitch notation: accidental comes before the note
    const keyStr = acc + root.toLowerCase();
    const keyToken = new Token(TT.IDENTIFIER, keyStr, sharedContext.generateId());
    const tokens = [keyToken];

    return {
      infoLine: new Info_line(sharedContext.generateId(), [new Token(TT.IDENTIFIER, "K:", sharedContext.generateId()), ...tokens]),
      expected: {
        type: "key" as const,
        root: root as KeyRoot,
        acc: acc === "^" ? KeyAccidental.Sharp : KeyAccidental.Flat,
        mode: Mode.Major,
      },
    };
  });

/**
 * Generate K: info line with key and mode (e.g., "K:Am", "K:D Mix")
 */
export const genKeyInfoWithMode = fc
  .record({
    root: genKeyRoot,
    acc: genKeyAccidental,
    mode: genMode,
  })
  .map(({ root, acc, mode }) => {
    // ABC pitch notation: accidental comes before the note (lowercase if accidental present)
    let keyStr: string;
    if (acc) {
      keyStr = acc + root.toLowerCase();
    } else {
      keyStr = root;
    }
    const keyToken = new Token(TT.IDENTIFIER, keyStr, sharedContext.generateId());
    const tokens = [keyToken];

    // Add mode as separate token if it's not empty and not major
    if (mode !== "major") {
      tokens.push(new Token(TT.IDENTIFIER, mode, sharedContext.generateId()));
    }

    const modeEnum = parseModeForTest(mode);

    return {
      infoLine: new Info_line(sharedContext.generateId(), [new Token(TT.IDENTIFIER, "K:", sharedContext.generateId()), ...tokens]),
      expected: {
        type: "key" as const,
        root: root as KeyRoot,
        acc: acc === "^" ? KeyAccidental.Sharp : acc === "_" ? KeyAccidental.Flat : KeyAccidental.None,
        mode: modeEnum,
      },
    };
  });

/**
 * Generate K: info line with clef (e.g., "K:D clef=bass")
 */
export const genKeyInfoWithClef = fc
  .record({
    root: genKeyRoot,
    clef: genClefName,
  })
  .map(({ root, clef }) => {
    const keyToken = new Token(TT.IDENTIFIER, root, sharedContext.generateId());

    // Create KV expression for clef
    const clefKV = new KV(
      sharedContext.generateId(),
      new Token(TT.IDENTIFIER, clef, sharedContext.generateId()),
      new Token(TT.IDENTIFIER, "clef", sharedContext.generateId()),
      new Token(TT.EQL, "=", sharedContext.generateId())
    );

    const tokens = [keyToken];

    return {
      infoLine: new Info_line(
        sharedContext.generateId(),
        [new Token(TT.IDENTIFIER, "K:", sharedContext.generateId()), ...tokens],
        undefined,
        [clefKV] // Use value2 for expressions
      ),
      expected: {
        type: "key" as const,
        root: root as KeyRoot,
        acc: KeyAccidental.None,
        mode: Mode.Major,
        clef: parseClefForTest(clef),
      },
    };
  });

/**
 * Generate any valid K: info line
 */
export const genKeyInfo = fc.oneof(genKeyInfoSimple, genKeyInfoWithAccidental, genKeyInfoWithMode, genKeyInfoWithClef);

// ============================================================================
// Meter Info Line Generators (M:)
// ============================================================================

/**
 * Generate M: info line with common time (e.g., "M:C")
 */
export const genMeterInfoCommonTime = fc.constant({
  infoLine: new Info_line(sharedContext.generateId(), [new Token(TT.IDENTIFIER, "M:", sharedContext.generateId())], undefined, [
    new KV(sharedContext.generateId(), new Token(TT.SPECIAL_LITERAL, "C", sharedContext.generateId())),
  ]),
  expected: {
    type: "meter" as const,
    meterType: MeterType.CommonTime,
    numerator: 4,
    denominator: 4,
  },
});

/**
 * Generate M: info line with cut time (e.g., "M:C|")
 */
export const genMeterInfoCutTime = fc.constant({
  infoLine: new Info_line(sharedContext.generateId(), [new Token(TT.IDENTIFIER, "M:", sharedContext.generateId())], undefined, [
    new KV(sharedContext.generateId(), new Token(TT.SPECIAL_LITERAL, "C|", sharedContext.generateId())),
  ]),
  expected: {
    type: "meter" as const,
    meterType: MeterType.CutTime,
    numerator: 2,
    denominator: 2,
  },
});

/**
 * Generate M: info line with numeric meter (e.g., "M:3/4", "M:6/8")
 */
export const genMeterInfoNumeric = fc
  .record({
    numerator: fc.integer({ min: 1, max: 16 }),
    denominator: fc.constantFrom(1, 2, 4, 8, 16, 32),
  })
  .map(({ numerator, denominator }) => {
    // Create Binary expression for meter
    const binary = new Binary(
      sharedContext.generateId(),
      new Token(TT.NUMBER, numerator.toString(), sharedContext.generateId()),
      new Token(TT.SLASH, "/", sharedContext.generateId()),
      new Token(TT.NUMBER, denominator.toString(), sharedContext.generateId())
    );

    return {
      infoLine: new Info_line(
        sharedContext.generateId(),
        [new Token(TT.IDENTIFIER, "M:", sharedContext.generateId())],
        undefined,
        [binary] // Use value2 for expressions
      ),
      expected: {
        type: "meter" as const,
        meterType: MeterType.Specified,
        numerator,
        denominator,
      },
    };
  });

/**
 * Generate any valid M: info line
 */
export const genMeterInfo = fc.oneof(genMeterInfoCommonTime, genMeterInfoCutTime, genMeterInfoNumeric);

// ============================================================================
// Note Length Info Line Generators (L:)
// ============================================================================

/**
 * Generate L: info line (e.g., "L:1/4", "L:1/8", "L:1/16")
 */
export const genNoteLenInfo = fc
  .record({
    numerator: fc.constantFrom(1, 2, 3, 4),
    denominator: fc.constantFrom(1, 2, 4, 8, 16, 32, 64),
  })
  .filter(({ numerator, denominator }) => numerator <= denominator)
  .map(({ numerator, denominator }) => {
    // Create Binary expression for note length
    const binary = new Binary(
      sharedContext.generateId(),
      new Token(TT.NUMBER, numerator.toString(), sharedContext.generateId()),
      new Token(TT.SLASH, "/", sharedContext.generateId()),
      new Token(TT.NUMBER, denominator.toString(), sharedContext.generateId())
    );

    return {
      infoLine: new Info_line(
        sharedContext.generateId(),
        [new Token(TT.IDENTIFIER, "L:", sharedContext.generateId())],
        undefined,
        [binary] // Use value2 for expressions
      ),
      expected: {
        type: "note_length" as const,
        numerator,
        denominator,
      },
    };
  });

// ============================================================================
// Combined Generator
// ============================================================================

// ============================================================================
// MetaText Info Line Generators (T:, C:, O:, R:, B:, S:, D:, N:, Z:, H:, A:)
// ============================================================================

/**
 * Generate realistic text for names (titles, composers, authors, etc.)
 * Alphanumeric with spaces, hyphens, apostrophes
 * Ensures no leading/trailing spaces
 */
const genNameText = fc
  .stringMatching(/^[A-Za-z][A-Za-z0-9 '\-]{0,40}[A-Za-z0-9]$/)
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

/**
 * Generate realistic rhythm types from ABC standard
 */
const genRhythmText = fc.constantFrom(
  "hornpipe",
  "double jig",
  "single jig",
  "jig",
  "reel",
  "slip jig",
  "polka",
  "waltz",
  "march",
  "mazurka",
  "strathspey",
  "barndance",
  "slide",
  "air",
  "48-bar polka",
  "balkan"
);

/**
 * Generate text with alphanumeric, spaces, and common punctuation (for notes, history)
 * Ensures no leading/trailing spaces
 * Excludes double quotes and backslashes to avoid ABC string syntax issues
 */
const genTextWithPunctuation = fc
  .stringMatching(/^[A-Za-z0-9 .,'\-()]{1,80}$/)
  .map((s) => s.trim())
  .filter((s) => s.length > 0 && !s.includes("\n"));

/**
 * Generate T: (title) info line
 */
export const genTitleInfo = genNameText.map((text) => ({
  infoLine: new Info_line(
    sharedContext.generateId(),
    [new Token(TT.IDENTIFIER, "T:", sharedContext.generateId())],
    undefined,
    text.split(" ").map((word) => new KV(sharedContext.generateId(), new Token(TT.IDENTIFIER, word, sharedContext.generateId())))
  ),
  expected: { type: "title" as const, data: text },
}));

/**
 * Generate C: (composer) info line
 */

export const genComposerInfo = genNameText.map((text) => ({
  infoLine: new Info_line(
    sharedContext.generateId(),
    [new Token(TT.IDENTIFIER, "C:", sharedContext.generateId())],
    undefined,
    text.split(" ").map((word) => new KV(sharedContext.generateId(), new Token(TT.IDENTIFIER, word, sharedContext.generateId())))
  ),
  expected: { type: "composer" as const, data: text },
}));

/**
 * Generate O: (origin) info line
 */
export const genOriginInfo = genNameText.map((text) => ({
  infoLine: new Info_line(
    sharedContext.generateId(),
    [new Token(TT.IDENTIFIER, "O:", sharedContext.generateId())],
    undefined,
    text.split(" ").map((word) => new KV(sharedContext.generateId(), new Token(TT.IDENTIFIER, word, sharedContext.generateId())))
  ),
  expected: { type: "origin" as const, data: text },
}));

/**
 * Generate R: (rhythm) info line
 */
export const genRhythmInfo = genRhythmText.map((text) => ({
  infoLine: new Info_line(
    sharedContext.generateId(),
    [new Token(TT.IDENTIFIER, "R:", sharedContext.generateId())],
    undefined,
    text.split(" ").map((word) => new KV(sharedContext.generateId(), new Token(TT.IDENTIFIER, word, sharedContext.generateId())))
  ),
  expected: { type: "rhythm" as const, data: text },
}));

/**
 * Generate B: (book) info line
 */
export const genBookInfo = genNameText.map((text) => ({
  infoLine: new Info_line(
    sharedContext.generateId(),
    [new Token(TT.IDENTIFIER, "B:", sharedContext.generateId())],
    undefined,
    text.split(" ").map((word) => new KV(sharedContext.generateId(), new Token(TT.IDENTIFIER, word, sharedContext.generateId())))
  ),
  expected: { type: "book" as const, data: text },
}));

/**
 * Generate S: (source) info line
 */
export const genSourceInfo = genNameText.map((text) => ({
  infoLine: new Info_line(
    sharedContext.generateId(),
    [new Token(TT.IDENTIFIER, "S:", sharedContext.generateId())],
    undefined,
    text.split(" ").map((word) => new KV(sharedContext.generateId(), new Token(TT.IDENTIFIER, word, sharedContext.generateId())))
  ),
  expected: { type: "source" as const, data: text },
}));

/**
 * Generate D: (discography) info line
 */
export const genDiscographyInfo = genNameText.map((text) => ({
  infoLine: new Info_line(
    sharedContext.generateId(),
    [new Token(TT.IDENTIFIER, "D:", sharedContext.generateId())],
    undefined,
    text.split(" ").map((word) => new KV(sharedContext.generateId(), new Token(TT.IDENTIFIER, word, sharedContext.generateId())))
  ),
  expected: { type: "discography" as const, data: text },
}));

/**
 * Generate N: (notes) info line
 */
export const genNotesInfo = genTextWithPunctuation.map((text) => ({
  infoLine: new Info_line(
    sharedContext.generateId(),
    [new Token(TT.IDENTIFIER, "N:", sharedContext.generateId())],
    undefined,
    text.split(" ").map((word) => new KV(sharedContext.generateId(), new Token(TT.IDENTIFIER, word, sharedContext.generateId())))
  ),
  expected: { type: "notes" as const, data: text },
}));

/**
 * Generate Z: (transcription) info line
 */
export const genTranscriptionInfo = genNameText.map((text) => ({
  infoLine: new Info_line(
    sharedContext.generateId(),
    [new Token(TT.IDENTIFIER, "Z:", sharedContext.generateId())],
    undefined,
    text.split(" ").map((word) => new KV(sharedContext.generateId(), new Token(TT.IDENTIFIER, word, sharedContext.generateId())))
  ),
  expected: { type: "transcription" as const, data: text },
}));

/**
 * Generate H: (history) info line
 */
// NOTE: Use fc.stringMatching with an alphanumeri here, with NO LINEBREAKS. Spaces and punctuation accepted.
// abandon genInfoLineText.
export const genHistoryInfo = genTextWithPunctuation.map((text) => ({
  infoLine: new Info_line(
    sharedContext.generateId(),
    [new Token(TT.IDENTIFIER, "H:", sharedContext.generateId())],
    undefined,
    text.split(" ").map((word) => new KV(sharedContext.generateId(), new Token(TT.IDENTIFIER, word, sharedContext.generateId())))
  ),
  expected: { type: "history" as const, data: text },
}));

/**
 * Generate A: (author) info line
 */
// NOTE: Use fc.stringMatching with an alphanumeri here to simulate a name.
// abandon genInfoLineText.
export const genAuthorInfo = genNameText.map((text) => ({
  infoLine: new Info_line(
    sharedContext.generateId(),
    [new Token(TT.IDENTIFIER, "A:", sharedContext.generateId())],
    undefined,
    text.split(" ").map((word) => new KV(sharedContext.generateId(), new Token(TT.IDENTIFIER, word, sharedContext.generateId())))
  ),
  expected: { type: "author" as const, data: text },
}));

/**
 * Generate any valid info line
 */
export const genAnyInfoLine = fc.oneof(genKeyInfo, genMeterInfo, genNoteLenInfo);

// ============================================================================
// Helper Functions
// ============================================================================

function parseModeForTest(mode: string): Mode {
  const lowerMode = mode.toLowerCase();
  switch (lowerMode) {
    case "major":
    case "maj":
    case "ionian":
      return Mode.Major;
    case "minor":
    case "min":
    case "m":
    case "aeolian":
    case "aeo":
      return Mode.Minor;
    case "dorian":
    case "dor":
      return Mode.Dorian;
    case "phrygian":
    case "phr":
      return Mode.Phrygian;
    case "lydian":
    case "lyd":
      return Mode.Lydian;
    case "mixolydian":
    case "mix":
      return Mode.Mixolydian;
    case "locrian":
    case "loc":
      return Mode.Locrian;
    default:
      return Mode.Major;
  }
}

function parseClefForTest(clef: string): ClefType {
  switch (clef.toLowerCase()) {
    case "treble":
      return ClefType.Treble;
    case "bass":
      return ClefType.Bass;
    case "alto":
      return ClefType.Alto;
    case "tenor":
      return ClefType.Tenor;
    case "perc":
      return ClefType.Perc;
    case "none":
      return ClefType.None;
    default:
      return ClefType.Treble;
  }
}
