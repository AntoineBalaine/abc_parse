import * as fc from "fast-check";
import { ABCContext } from "../parsers/Context";
import { AbcErrorReporter } from "../parsers/ErrorReporter";
import { Token, TT } from "../parsers/scan2";
import { Directive, Annotation, Measurement } from "../types/Expr2";

// Shared context for all generators
export const sharedContext = new ABCContext(new AbcErrorReporter());

// ============================================================================
// Font Directive Generators
// ============================================================================

export const fontDirectivesWithBox = [
  "titlefont",
  "gchordfont",
  "composerfont",
  "subtitlefont",
  "voicefont",
  "partsfont",
  "textfont",
  "annotationfont",
  "historyfont",
  "infofont",
  "measurefont",
  "barlabelfont",
  "barnumberfont",
  "barnumfont",
] as const;

export const fontDirectivesWithoutBox = [
  "tempofont",
  "footerfont",
  "headerfont",
  "tripletfont",
  "vocalfont",
  "repeatfont",
  "wordsfont",
  "tablabelfont",
  "tabnumberfont",
  "tabgracefont",
] as const;

export const genFontDirectiveNameWithBox = fc.constantFrom(...fontDirectivesWithBox);
export const genFontDirectiveNameWithoutBox = fc.constantFrom(...fontDirectivesWithoutBox);
export const genFontDirectiveName = fc.constantFrom(...fontDirectivesWithBox, ...fontDirectivesWithoutBox);

// Font face generators
export const genFontFace = fc.oneof(
  fc.constantFrom("Arial", "Times", "Helvetica", "Courier", "Times-Roman", "Courier-New"),
  fc.stringMatching(/^[A-Z][a-z]+(-[A-Z][a-z]+)?$/).filter((s) => s.length > 0 && s.length < 30)
);

export const genQuotedFontFace = genFontFace.map((face) => `"${face}"`);

export const genFontSize = fc.integer({ min: 6, max: 72 });

export const genFontModifier = fc.constantFrom("bold", "italic", "underline");

export const genFontModifiers = fc.array(genFontModifier, { maxLength: 3 }).map((mods) => Array.from(new Set(mods))); // Remove duplicates

// Format 1: * size [box]
export const genFontDirectiveFormat1 = fc
  .record({
    name: genFontDirectiveName,
    size: genFontSize,
    box: fc.boolean(),
  })
  .map(({ name, size, box }) => {
    const supportsBox = fontDirectivesWithBox.includes(name as any);
    const tokens = [new Token(TT.IDENTIFIER, "*", sharedContext.generateId()), new Token(TT.NUMBER, size.toString(), sharedContext.generateId())];
    if (box && supportsBox) {
      tokens.push(new Token(TT.IDENTIFIER, "box", sharedContext.generateId()));
    }

    return {
      directive: new Directive(sharedContext.generateId(), new Token(TT.IDENTIFIER, name, sharedContext.generateId()), tokens),
      expected: {
        type: name,
        size,
        box: box && supportsBox,
        face: undefined,
      },
      supportsBox,
    };
  });

// Format 2: size [box]
export const genFontDirectiveFormat2 = fc
  .record({
    name: genFontDirectiveName,
    size: genFontSize,
    box: fc.boolean(),
  })
  .map(({ name, size, box }) => {
    const supportsBox = fontDirectivesWithBox.includes(name as any);
    const tokens = [new Token(TT.NUMBER, size.toString(), sharedContext.generateId())];
    if (box && supportsBox) {
      tokens.push(new Token(TT.IDENTIFIER, "box", sharedContext.generateId()));
    }

    return {
      directive: new Directive(sharedContext.generateId(), new Token(TT.IDENTIFIER, name, sharedContext.generateId()), tokens),
      expected: {
        type: name,
        size,
        box: box && supportsBox,
        face: undefined,
      },
      supportsBox,
    };
  });

// Format 3: face [utf8] [size] [modifiers] [box]
export const genFontDirectiveFormat3 = fc
  .record({
    name: genFontDirectiveName,
    face: fc.option(fc.oneof(genFontFace, genQuotedFontFace)),
    utf8: fc.boolean(),
    size: fc.option(genFontSize),
    modifiers: genFontModifiers,
    box: fc.boolean(),
  })
  // Format 3 must have either a face or modifiers (not just size alone - that's format 2)
  .filter(({ face, modifiers }) => face !== null || modifiers.length > 0)
  .map(({ name, face, utf8, size, modifiers, box }) => {
    const supportsBox = fontDirectivesWithBox.includes(name as any);
    const tokens: Token[] = [];

    if (face) {
      // Handle quoted vs unquoted faces
      const isQuoted = face.startsWith('"');
      if (isQuoted) {
        tokens.push(new Token(TT.IDENTIFIER, face, sharedContext.generateId()));
      } else {
        // Split multi-word font names into separate tokens
        const parts = face.split("-");
        parts.forEach((part, idx) => {
          tokens.push(new Token(TT.IDENTIFIER, part, sharedContext.generateId()));
          if (idx < parts.length - 1) {
            tokens.push(new Token(TT.IDENTIFIER, "-", sharedContext.generateId()));
          }
        });
      }
    }

    if (utf8 && face) {
      tokens.push(new Token(TT.IDENTIFIER, "utf8", sharedContext.generateId()));
    }

    if (size !== null) {
      tokens.push(new Token(TT.NUMBER, size.toString(), sharedContext.generateId()));
    }

    modifiers.forEach((mod) => {
      tokens.push(new Token(TT.IDENTIFIER, mod, sharedContext.generateId()));
    });

    if (box && supportsBox) {
      tokens.push(new Token(TT.IDENTIFIER, "box", sharedContext.generateId()));
    }

    // Compute expected face (remove quotes if quoted)
    const expectedFace = face ? (face.startsWith('"') ? face.slice(1, -1) : face) : undefined;

    return {
      directive: new Directive(sharedContext.generateId(), new Token(TT.IDENTIFIER, name, sharedContext.generateId()), tokens),
      expected: {
        type: name,
        face: expectedFace,
        size: size ?? undefined,
        weight: modifiers.includes("bold") ? "bold" : "normal",
        style: modifiers.includes("italic") ? "italic" : "normal",
        decoration: modifiers.includes("underline") ? "underline" : "none",
        box: box && supportsBox,
      },
      supportsBox,
    };
  });

export const genFontDirective = fc.oneof(genFontDirectiveFormat1, genFontDirectiveFormat2, genFontDirectiveFormat3);

// ============================================================================
// Boolean Flag Directive Generators
// ============================================================================

// Parser config directives - can appear in file header, affect parsing but not exposed
export const parserConfigDirectives = ["landscape", "titlecaps", "continueall", "font"] as const;

// Formatting directives - tune header only, stored in tune.formatting
export const formattingDirectives = ["bagpipes", "flatbeams", "jazzchords", "accentAbove", "germanAlphabet", "titleleft", "measurebox", "nobarcheck"] as const;

// All boolean flag directives
export const booleanFlagDirectives = [...parserConfigDirectives, ...formattingDirectives] as const;

export const genBooleanFlagDirectiveName = fc.constantFrom(...booleanFlagDirectives);

export const genBooleanFlagDirective = genBooleanFlagDirectiveName.map((name) => {
  return {
    directive: new Directive(sharedContext.generateId(), new Token(TT.IDENTIFIER, name, sharedContext.generateId()), []),
    expected: {
      type: name,
      data: true,
    },
  };
});

// Generator for parser config directives only (file header allowed)
export const genParserConfigDirectiveName = fc.constantFrom(...parserConfigDirectives);

export const genParserConfigDirective = genParserConfigDirectiveName.map((name) => {
  return {
    directive: new Directive(sharedContext.generateId(), new Token(TT.IDENTIFIER, name, sharedContext.generateId()), []),
    expected: {
      type: name,
      data: true,
    },
  };
});

// ============================================================================
// Identifier Directive Generators
// ============================================================================

export const identifierDirectives = ["papersize", "map", "playtempo", "auquality", "continuous", "voicecolor"] as const;

export const genIdentifierDirectiveName = fc.constantFrom(...identifierDirectives);

export const genIdentifier = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_]*$/).filter((s) => s.length > 0 && s.length < 20);

export const genIdentifierDirective = fc
  .record({
    name: genIdentifierDirectiveName,
    value: genIdentifier,
  })
  .map(({ name, value }) => {
    return {
      directive: new Directive(sharedContext.generateId(), new Token(TT.IDENTIFIER, name, sharedContext.generateId()), [
        new Token(TT.IDENTIFIER, value, sharedContext.generateId()),
      ]),
      expected: {
        type: name,
        data: value,
      },
    };
  });

// ============================================================================
// Boolean Value Directive Generators
// ============================================================================

export const booleanValueDirectives = ["graceslurs", "linear", "staffnonote", "printtempo", "partsbox", "freegchord"] as const;

export const genBooleanValueDirectiveName = fc.constantFrom(...booleanValueDirectives);

export const genBooleanValue = fc.oneof(
  fc.constantFrom("true", "false").map((val) => ({ token: new Token(TT.IDENTIFIER, val, sharedContext.generateId()), value: val === "true" })),
  fc.constantFrom("0", "1").map((val) => ({ token: new Token(TT.NUMBER, val, sharedContext.generateId()), value: val === "1" }))
);

export const genBooleanValueDirective = fc
  .record({
    name: genBooleanValueDirectiveName,
    boolValue: genBooleanValue,
  })
  .map(({ name, boolValue }) => {
    return {
      directive: new Directive(sharedContext.generateId(), new Token(TT.IDENTIFIER, name, sharedContext.generateId()), [boolValue.token]),
      expected: {
        type: name,
        data: boolValue.value,
      },
    };
  });

// ============================================================================
// Number Directive Generators
// ============================================================================

export const numberDirectives = [
  { name: "lineThickness", min: undefined, max: undefined },
  { name: "voicescale", min: undefined, max: undefined },
  { name: "scale", min: undefined, max: undefined },
  { name: "fontboxpadding", min: undefined, max: undefined },
  { name: "stretchlast", min: 0, max: 1 },
  { name: "barsperstaff", min: 1, max: undefined },
  { name: "measurenb", min: 0, max: undefined },
  { name: "barnumbers", min: 0, max: undefined },
  { name: "setbarnb", min: 1, max: undefined },
] as const;

export const genNumberDirective = fc.integer({ min: 0, max: numberDirectives.length - 1 }).chain((idx) => {
  const spec = numberDirectives[idx];
  const min = spec.min ?? -100;
  const max = spec.max ?? 100;

  return fc
    .float({ min, max })
    .filter((value) => !isNaN(value) && isFinite(value))
    .map((value) => {
      return {
        directive: new Directive(sharedContext.generateId(), new Token(TT.IDENTIFIER, spec.name, sharedContext.generateId()), [
          new Token(TT.NUMBER, value.toString(), sharedContext.generateId()),
        ]),
        expected: {
          type: spec.name,
          data: value,
        },
        constraints: {
          min: spec.min,
          max: spec.max,
        },
      };
    });
});

// ============================================================================
// Position Choice Directive Generators
// ============================================================================

export const positionDirectives = ["vocal", "dynamic", "gchord", "ornament", "volume"] as const;

export const genPositionDirectiveName = fc.constantFrom(...positionDirectives);

export const genPosition = fc.constantFrom("auto", "above", "below", "hidden");

export const genPositionDirective = fc
  .record({
    name: genPositionDirectiveName,
    position: genPosition,
  })
  .map(({ name, position }) => {
    return {
      directive: new Directive(sharedContext.generateId(), new Token(TT.IDENTIFIER, name, sharedContext.generateId()), [
        new Token(TT.IDENTIFIER, position, sharedContext.generateId()),
      ]),
      expected: {
        type: name,
        data: position,
      },
    };
  });

// ============================================================================
// Measurement Directive Generators
// ============================================================================

export const measurementDirectives = [
  "botmargin",
  "botspace",
  "composerspace",
  "indent",
  "leftmargin",
  "linesep",
  "musicspace",
  "partsspace",
  "pageheight",
  "pagewidth",
  "rightmargin",
  "stafftopmargin",
  "staffsep",
  "staffwidth",
  "subtitlespace",
  "sysstaffsep",
  "systemsep",
  "textspace",
  "titlespace",
  "topmargin",
  "topspace",
  "vocalspace",
  "wordsspace",
  "vskip",
] as const;

export const genMeasurementDirectiveName = fc.constantFrom(...measurementDirectives);

export const genUnit = fc.constantFrom("pt", "in", "cm", "mm");

export const genMeasurementValue = fc.float({ min: 0, max: 100 }).filter((v) => !isNaN(v) && isFinite(v));

// Generate measurement with Measurement object (has unit)
export const genMeasurementDirectiveWithUnit = fc
  .record({
    name: genMeasurementDirectiveName,
    value: genMeasurementValue,
    unit: genUnit,
  })
  .map(({ name, value, unit }) => {
    const valueToken = new Token(TT.NUMBER, value.toString(), sharedContext.generateId());
    const unitToken = new Token(TT.IDENTIFIER, unit, sharedContext.generateId());
    const measurement = new Measurement(sharedContext.generateId(), valueToken, unitToken);

    return {
      directive: new Directive(sharedContext.generateId(), new Token(TT.IDENTIFIER, name, sharedContext.generateId()), [measurement]),
      expected: {
        type: name,
        data: {
          value,
          unit,
        },
      },
    };
  });

// Generate measurement with plain number (no unit)
export const genMeasurementDirectiveWithoutUnit = fc
  .record({
    name: genMeasurementDirectiveName,
    value: genMeasurementValue,
  })
  .map(({ name, value }) => {
    return {
      directive: new Directive(sharedContext.generateId(), new Token(TT.IDENTIFIER, name, sharedContext.generateId()), [
        new Token(TT.NUMBER, value.toString(), sharedContext.generateId()),
      ]),
      expected: {
        type: name,
        data: {
          value,
          unit: undefined,
        },
      },
    };
  });

export const genMeasurementDirective = fc.oneof(genMeasurementDirectiveWithUnit, genMeasurementDirectiveWithoutUnit);

// ============================================================================
// Sep Directive Generator
// ============================================================================

export const genSepDirective = fc.array(fc.float({ min: 0, max: 50 }), { maxLength: 3 }).map((values) => {
  const tokens: Token[] = values.map((v) => new Token(TT.NUMBER, v.toString(), sharedContext.generateId()));

  // Build expected data based on number of values
  const data: { above?: number; below?: number; length?: number } = {};
  if (values.length >= 1) data.above = values[0];
  if (values.length >= 2) data.below = values[1];
  if (values.length >= 3) data.length = values[2];

  return {
    directive: new Directive(sharedContext.generateId(), new Token(TT.IDENTIFIER, "sep", sharedContext.generateId()), tokens),
    expected: {
      type: "sep",
      data,
    },
  };
});

// ============================================================================
// Annotation Directive Generators (text, center, abc-*)
// ============================================================================

export const annotationDirectives = ["abc-copyright", "abc-creator", "abc-edited-by", "abc-version", "abc-charset"] as const;

export const genAnnotationDirectiveName = fc.constantFrom(...annotationDirectives);
export const genTextDirectiveName = fc.constantFrom("text", "center");

// Generate safe annotation text - alphanumeric with safe punctuation only
// Avoid quotes, backslashes, and other characters that could break ABC string syntax
// Require at least 2 characters OR start with alphanumeric to avoid edge cases like single commas
export const genAnnotationText = fc
  .stringMatching(/^[A-Za-z0-9 .\-,()':]+$/)
  .map((s) => s.trim())
  .filter((s) => s.length >= 2 && s.length <= 100 && /^[A-Za-z0-9]/.test(s));

// With Annotation object
export const genAnnotationDirectiveWithObject = fc
  .record({
    name: genAnnotationDirectiveName,
    text: genAnnotationText,
  })
  .map(({ name, text }) => {
    // Token lexeme should include quotes for stringification
    const textToken = new Token(TT.ANNOTATION, `"${text}"`, sharedContext.generateId());
    const annotation = new Annotation(sharedContext.generateId(), textToken);

    return {
      directive: new Directive(sharedContext.generateId(), new Token(TT.IDENTIFIER, name, sharedContext.generateId()), [annotation]),
      expected: {
        type: name,
        data: `"${text}"`, // Keep quotes to match abcjs behavior
      },
    };
  });

// With plain token(s) - use single ANNOTATION token with the full text (quoted)
export const genAnnotationDirectiveWithToken = fc
  .record({
    name: genAnnotationDirectiveName,
    text: genAnnotationText,
  })
  .map(({ name, text }) => {
    // Create single ANNOTATION token with quotes in the lexeme for proper stringification
    const token = new Token(TT.ANNOTATION, `"${text}"`, sharedContext.generateId());

    return {
      directive: new Directive(sharedContext.generateId(), new Token(TT.IDENTIFIER, name, sharedContext.generateId()), [token]),
      expected: {
        type: name,
        data: `"${text}"`, // Keep quotes to match abcjs behavior
      },
    };
  });

// Text directives (%%text, %%center) use FREE_TXT tokens from the scanner
export const genTextDirective = fc
  .record({
    name: genTextDirectiveName,
    text: genAnnotationText,
  })
  .map(({ name, text }) => {
    // Because the scanner handles text/center directives specially with FREE_TXT tokens,
    // we create a FREE_TXT token without quotes
    const token = new Token(TT.FREE_TXT, text, sharedContext.generateId());

    return {
      directive: new Directive(sharedContext.generateId(), new Token(TT.IDENTIFIER, name, sharedContext.generateId()), [token]),
      expected: {
        type: name,
        data: text, // No quotes for FREE_TXT
      },
    };
  });

export const genAnnotationDirective = fc.oneof(genAnnotationDirectiveWithObject, genAnnotationDirectiveWithToken, genTextDirective);

// ============================================================================
// Header/Footer Directive Generators
// ============================================================================

export const genHeaderFooterDirectiveName = fc.constantFrom("header", "footer");

// Generate text that might contain field codes
const genFieldCode = fc.constantFrom("$P", "$N", "$T", "$C", "$A", "$D", "$F");
const genPlainText = fc.string({ minLength: 0, maxLength: 20 }).filter((s) => !s.includes("\t") && !s.includes("\n"));
const genSectionText = fc.oneof(genFieldCode, genPlainText, fc.constant(""));

// Generate header/footer with 1, 2, or 3 tab-separated sections
export const genHeaderFooterDirective = fc
  .record({
    name: genHeaderFooterDirectiveName,
    numSections: fc.integer({ min: 1, max: 3 }),
    left: genSectionText,
    center: genSectionText,
    right: genSectionText,
  })
  .map(({ name, numSections, left, center, right }) => {
    // Build tab-separated text based on number of sections
    let text: string;
    let expectedLeft: string;
    let expectedCenter: string;
    let expectedRight: string;

    if (numSections === 1) {
      text = center;
      expectedLeft = "";
      expectedCenter = center;
      expectedRight = "";
    } else if (numSections === 2) {
      text = `${left}\t${center}`;
      expectedLeft = left;
      expectedCenter = center;
      expectedRight = "";
    } else {
      text = `${left}\t${center}\t${right}`;
      expectedLeft = left;
      expectedCenter = center;
      expectedRight = right;
    }

    // Because the scanner handles header/footer directives specially with FREE_TXT tokens,
    // we create a FREE_TXT token with tab-separated text
    const token = new Token(TT.FREE_TXT, text, sharedContext.generateId());

    return {
      directive: new Directive(sharedContext.generateId(), new Token(TT.IDENTIFIER, name, sharedContext.generateId()), [token]),
      expected: {
        type: name,
        data: {
          left: expectedLeft,
          center: expectedCenter,
          right: expectedRight,
        },
      },
    };
  });

// ============================================================================
// Newpage Directive Generator
// ============================================================================

export const genNewpageDirective = fc.option(fc.integer({ min: 1, max: 100 })).map((pageNum) => {
  const tokens = pageNum !== null ? [new Token(TT.NUMBER, pageNum.toString(), sharedContext.generateId())] : [];

  return {
    directive: new Directive(sharedContext.generateId(), new Token(TT.IDENTIFIER, "newpage", sharedContext.generateId()), tokens),
    expected: {
      type: "newpage",
      data: pageNum,
    },
  };
});

// ============================================================================
// Percmap Directive Generator
// ============================================================================

// Because drum sound names are case-insensitive, we need to generate them with various cases
const genDrumSoundName = fc.constantFrom(
  "acoustic-bass-drum",
  "bass-drum-1",
  "side-stick",
  "acoustic-snare",
  "hand-clap",
  "electric-snare",
  "low-floor-tom",
  "closed-hi-hat",
  "high-floor-tom",
  "pedal-hi-hat",
  "low-tom",
  "open-hi-hat",
  "low-mid-tom",
  "hi-mid-tom",
  "crash-cymbal-1",
  "high-tom",
  "ride-cymbal-1",
  "chinese-cymbal",
  "ride-bell",
  "tambourine",
  "splash-cymbal",
  "cowbell",
  "crash-cymbal-2",
  "vibraslap",
  "ride-cymbal-2",
  "hi-bongo",
  "low-bongo",
  "mute-hi-conga",
  "open-hi-conga",
  "low-conga",
  "high-timbale",
  "low-timbale",
  "high-agogo",
  "low-agogo",
  "cabasa",
  "maracas",
  "short-whistle",
  "long-whistle",
  "short-guiro",
  "long-guiro",
  "claves",
  "hi-wood-block",
  "low-wood-block",
  "mute-cuica",
  "open-cuica",
  "mute-triangle",
  "open-triangle"
);

// Because we want to test case insensitivity, we generate drum names with random casing
const genDrumSoundNameAnyCase = genDrumSoundName.chain((name) =>
  fc.oneof(fc.constant(name), fc.constant(name.toUpperCase()), fc.constant(name.charAt(0).toUpperCase() + name.slice(1)))
);

// Because ABC notes can have accidentals and octave markers, we generate various formats
const genAbcNote = fc.oneof(
  fc.constantFrom("C", "D", "E", "F", "G", "A", "B", "c", "d", "e", "f", "g", "a", "b"),
  fc.constantFrom("^C", "_B", "=G", "^F", "_E"),
  fc.constantFrom("C,", "D,", "c'", "d'")
);

const genNoteHead = fc.constantFrom("x", "triangle", "diamond", "square", "normal");

export const genPercmapDirectiveWithMidiNumber = fc
  .record({
    note: genAbcNote,
    midiNum: fc.integer({ min: 35, max: 81 }),
    noteHead: fc.option(genNoteHead, { nil: undefined }),
  })
  .map(({ note, midiNum, noteHead }) => {
    const tokens = [new Token(TT.IDENTIFIER, note, sharedContext.generateId()), new Token(TT.NUMBER, midiNum.toString(), sharedContext.generateId())];

    if (noteHead !== undefined) {
      tokens.push(new Token(TT.IDENTIFIER, noteHead, sharedContext.generateId()));
    }

    return {
      directive: new Directive(sharedContext.generateId(), new Token(TT.IDENTIFIER, "percmap", sharedContext.generateId()), tokens),
      expected: {
        type: "percmap",
        note,
        sound: midiNum,
        noteHead,
      },
    };
  });

export const genPercmapDirectiveWithDrumName = fc
  .record({
    note: genAbcNote,
    drumName: genDrumSoundNameAnyCase,
    noteHead: fc.option(genNoteHead, { nil: undefined }),
  })
  .map(({ note, drumName, noteHead }) => {
    const tokens = [new Token(TT.IDENTIFIER, note, sharedContext.generateId()), new Token(TT.IDENTIFIER, drumName, sharedContext.generateId())];

    if (noteHead !== undefined) {
      tokens.push(new Token(TT.IDENTIFIER, noteHead, sharedContext.generateId()));
    }

    // Because drum names map to MIDI numbers starting at 35, we need to calculate the expected sound
    // by finding the lowercase drum name in the array and adding 35
    const drumSoundNames = [
      "acoustic-bass-drum",
      "bass-drum-1",
      "side-stick",
      "acoustic-snare",
      "hand-clap",
      "electric-snare",
      "low-floor-tom",
      "closed-hi-hat",
      "high-floor-tom",
      "pedal-hi-hat",
      "low-tom",
      "open-hi-hat",
      "low-mid-tom",
      "hi-mid-tom",
      "crash-cymbal-1",
      "high-tom",
      "ride-cymbal-1",
      "chinese-cymbal",
      "ride-bell",
      "tambourine",
      "splash-cymbal",
      "cowbell",
      "crash-cymbal-2",
      "vibraslap",
      "ride-cymbal-2",
      "hi-bongo",
      "low-bongo",
      "mute-hi-conga",
      "open-hi-conga",
      "low-conga",
      "high-timbale",
      "low-timbale",
      "high-agogo",
      "low-agogo",
      "cabasa",
      "maracas",
      "short-whistle",
      "long-whistle",
      "short-guiro",
      "long-guiro",
      "claves",
      "hi-wood-block",
      "low-wood-block",
      "mute-cuica",
      "open-cuica",
      "mute-triangle",
      "open-triangle",
    ];
    const drumIndex = drumSoundNames.indexOf(drumName.toLowerCase());
    const expectedSound = drumIndex + 35;

    return {
      directive: new Directive(sharedContext.generateId(), new Token(TT.IDENTIFIER, "percmap", sharedContext.generateId()), tokens),
      expected: {
        type: "percmap",
        note,
        sound: expectedSound,
        noteHead,
      },
    };
  });

export const genPercmapDirective = fc.oneof(genPercmapDirectiveWithMidiNumber, genPercmapDirectiveWithDrumName);

// ============================================================================
// Deco Directive Generators
// ============================================================================

export const genDecorationName = fc.oneof(
  fc.constantFrom("fermata", "trill", "mordent", "turn", "staccato", "accent", "tenuto", "marcato"),
  fc.stringMatching(/^[a-z][a-z0-9_-]{0,15}$/).filter((s) => s.length > 0)
);

export const genDecorationDefinition = fc
  .array(fc.oneof(fc.constantFrom("abc", "def", "xyz", "123", "456", "postscript", "code"), fc.integer({ min: 0, max: 100 }).map((n) => n.toString())), {
    minLength: 0,
    maxLength: 10,
  })
  .map((parts) => (parts.length > 0 ? parts.join(" ") : undefined));

export const genDecoDirective = fc
  .record({
    name: genDecorationName,
    definition: genDecorationDefinition,
  })
  .map(({ name, definition }) => {
    const tokens: Token[] = [new Token(TT.IDENTIFIER, name, sharedContext.generateId())];

    // Because the definition is optional, we only add tokens if definition is not undefined
    if (definition !== undefined) {
      const defParts = definition.split(" ");
      for (const part of defParts) {
        // Because parts can be numbers or identifiers, we check if it's a number
        if (/^\d+$/.test(part)) {
          tokens.push(new Token(TT.NUMBER, part, sharedContext.generateId()));
        } else {
          tokens.push(new Token(TT.IDENTIFIER, part, sharedContext.generateId()));
        }
      }
    }

    return {
      directive: new Directive(sharedContext.generateId(), new Token(TT.IDENTIFIER, "deco", sharedContext.generateId()), tokens),
      expected: {
        type: "deco",
        name,
        definition,
      },
    };
  });

// ============================================================================
// Combined Generator (all directive types)
// ============================================================================

export const genAnyDirective = fc.oneof(
  genFontDirective,
  genBooleanFlagDirective,
  genIdentifierDirective,
  genBooleanValueDirective,
  genNumberDirective,
  genPositionDirective,
  genMeasurementDirective,
  genSepDirective,
  genAnnotationDirective,
  genHeaderFooterDirective,
  genNewpageDirective,
  genPercmapDirective,
  genDecoDirective
);
