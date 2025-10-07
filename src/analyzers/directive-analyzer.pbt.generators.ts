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
  .filter(({ face, size, modifiers }) => face !== null || size !== null || modifiers.length > 0) // At least something meaningful
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

export const booleanFlagDirectives = [
  "bagpipes",
  "flatbeams",
  "jazzchords",
  "accentAbove",
  "germanAlphabet",
  "landscape",
  "titlecaps",
  "titleleft",
  "measurebox",
  "continueall",
  "begintext",
  "endtext",
  "beginps",
  "endps",
  "font",
  "nobarcheck",
] as const;

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

export const booleanValueDirectives = ["graceslurs", "staffnonote", "printtempo", "partsbox", "freegchord"] as const;

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

  return fc.float({ min, max }).map((value) => {
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

export const genMeasurementValue = fc.float({ min: 0, max: 100 });

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

export const genSepDirective = fc
  .record({
    above: fc.option(fc.float({ min: 0, max: 50 })),
    below: fc.option(fc.float({ min: 0, max: 50 })),
    length: fc.option(fc.float({ min: 0, max: 100 })),
  })
  .map(({ above, below, length }) => {
    const tokens: Token[] = [];
    if (above !== null) tokens.push(new Token(TT.NUMBER, above.toString(), sharedContext.generateId()));
    if (below !== null) tokens.push(new Token(TT.NUMBER, below.toString(), sharedContext.generateId()));
    if (length !== null) tokens.push(new Token(TT.NUMBER, length.toString(), sharedContext.generateId()));

    return {
      directive: new Directive(sharedContext.generateId(), new Token(TT.IDENTIFIER, "sep", sharedContext.generateId()), tokens),
      expected: {
        type: "sep",
        data: {
          above: above ?? undefined,
          below: below ?? undefined,
          length: length ?? undefined,
        },
      },
    };
  });

// ============================================================================
// Annotation Directive Generators (text, center, abc-*)
// ============================================================================

export const annotationDirectives = ["text", "center", "abc-copyright", "abc-creator", "abc-edited-by", "abc-version", "abc-charset"] as const;

export const genAnnotationDirectiveName = fc.constantFrom(...annotationDirectives);

export const genAnnotationText = fc.string({ minLength: 1, maxLength: 100 }).filter((s) => !s.includes("\n"));

// With Annotation object
export const genAnnotationDirectiveWithObject = fc
  .record({
    name: genAnnotationDirectiveName,
    text: genAnnotationText,
  })
  .map(({ name, text }) => {
    const textToken = new Token(TT.ANNOTATION, text, sharedContext.generateId());
    const annotation = new Annotation(sharedContext.generateId(), textToken);

    return {
      directive: new Directive(sharedContext.generateId(), new Token(TT.IDENTIFIER, name, sharedContext.generateId()), [annotation]),
      expected: {
        type: name,
        data: text,
      },
    };
  });

// With plain token(s) - splits text into multiple tokens to match parser behavior
export const genAnnotationDirectiveWithToken = fc
  .record({
    name: genAnnotationDirectiveName,
    text: genAnnotationText,
  })
  .map(({ name, text }) => {
    // Split text by spaces to create multiple tokens (matching parser behavior)
    const words = text.split(' ').filter(word => word.length > 0);
    const tokens = words.map(word => new Token(TT.IDENTIFIER, word, sharedContext.generateId()));

    return {
      directive: new Directive(sharedContext.generateId(), new Token(TT.IDENTIFIER, name, sharedContext.generateId()), tokens),
      expected: {
        type: name,
        data: text,
      },
    };
  });

export const genAnnotationDirective = fc.oneof(genAnnotationDirectiveWithObject, genAnnotationDirectiveWithToken);

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
  genNewpageDirective
);
