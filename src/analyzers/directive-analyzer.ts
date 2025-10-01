import { Directive, Annotation, Measurement } from "../types/Expr2";
import { DirectiveSemanticData, FontSpec, MeasurementSpec } from "../types/directive-specs";
import { SemanticAnalyzer } from "./semantic-analyzer";
import { Token, TT } from "../parsers/scan2";
import { isToken } from "../helpers";

/**
 * Analyzes directives and produces semantic data.
 * Inspired by abcjs parseDirective.addDirective() - direct and readable.
 */
export function analyzeDirective(directive: Directive, analyzer: SemanticAnalyzer): DirectiveSemanticData | null {
  const key = directive.key.lexeme;

  switch (key) {
    // ============================================================================
    // Font Directives with Box Support
    // ============================================================================
    case "titlefont":
    case "gchordfont":
    case "composerfont":
    case "subtitlefont":
    case "voicefont":
    case "partsfont":
    case "textfont":
    case "annotationfont":
    case "historyfont":
    case "infofont":
    case "measurefont":
    case "barlabelfont":
    case "barnumberfont":
    case "barnumfont":
      return parseFontDirective(directive, analyzer, { supportsBox: true });

    // ============================================================================
    // Font Directives without Box Support
    // ============================================================================
    case "tempofont":
    case "footerfont":
    case "headerfont":
    case "tripletfont":
    case "vocalfont":
    case "repeatfont":
    case "wordsfont":
    case "tablabelfont":
    case "tabnumberfont":
    case "tabgracefont":
      return parseFontDirective(directive, analyzer, { supportsBox: false });

    // ============================================================================
    // Layout and Formatting Directives (Boolean flags - no parameters)
    // ============================================================================
    case "bagpipes":
    case "flatbeams":
    case "jazzchords":
    case "accentAbove":
    case "germanAlphabet":
    case "landscape":
    case "titlecaps":
    case "titleleft":
    case "measurebox":
    case "continueall":
    case "begintext":
    case "endtext":
    case "beginps":
    case "endps":
    case "font":
    case "nobarcheck":
      return parseBooleanFlag(directive, analyzer);

    // ============================================================================
    // Simple String Parameter Directives
    // ============================================================================
    case "papersize":
    case "map":
    case "playtempo":
    case "auquality":
    case "continuous":
    case "voicecolor":
      return parseIdentifier(directive, analyzer);

    // ============================================================================
    // Boolean Value Directives
    // ============================================================================
    case "graceslurs":
    case "staffnonote":
    case "printtempo":
    case "partsbox":
    case "freegchord":
      return parseBooleanValue(directive, analyzer);

    // ============================================================================
    // Simple Number Directives (no constraints)
    // ============================================================================
    case "lineThickness":
    case "voicescale":
    case "scale":
    case "fontboxpadding":
      return parseNumber(directive, analyzer);

    // ============================================================================
    // Number Directives with Constraints
    // ============================================================================
    case "stretchlast":
      return parseNumber(directive, analyzer, { min: 0, max: 1 });
    case "barsperstaff":
      return parseNumber(directive, analyzer, { min: 1 });
    case "measurenb":
    case "barnumbers":
      return parseNumber(directive, analyzer, { min: 0 });
    case "setbarnb":
      return parseNumber(directive, analyzer, { min: 1 });

    // ============================================================================
    // Position Directives
    // ============================================================================
    case "vocal":
    case "dynamic":
    case "gchord":
    case "ornament":
    case "volume":
      return parsePositionChoice(directive, analyzer);

    // ============================================================================
    // Margin and Spacing Directives (Measurements)
    // ============================================================================
    case "botmargin":
    case "botspace":
    case "composerspace":
    case "indent":
    case "leftmargin":
    case "linesep":
    case "musicspace":
    case "partsspace":
    case "pageheight":
    case "pagewidth":
    case "rightmargin":
    case "stafftopmargin":
    case "staffsep":
    case "staffwidth":
    case "subtitlespace":
    case "sysstaffsep":
    case "systemsep":
    case "textspace":
    case "titlespace":
    case "topmargin":
    case "topspace":
    case "vocalspace":
    case "wordsspace":
    case "vskip":
      return parseMeasurement(directive, analyzer);

    // ============================================================================
    // Complex Directives
    // ============================================================================
    case "sep":
      return parseSep(directive, analyzer);
    case "text":
      return parseText(directive, analyzer);
    case "center":
      return parseCenter(directive, analyzer);
    case "setfont":
      return parseSetfont(directive, analyzer);
    case "newpage":
      return parseNewpage(directive, analyzer);
    case "staves":
      return parseStaves(directive, analyzer);
    case "score":
      return parseScore(directive, analyzer);
    case "header":
      return parseHeader(directive, analyzer);
    case "footer":
      return parseFooter(directive, analyzer);
    case "midi":
      return parseMidi(directive, analyzer);
    case "percmap":
      return parsePercmap(directive, analyzer);
    case "deco":
      return parseDeco(directive, analyzer);

    // ============================================================================
    // Metadata Directives
    // ============================================================================
    case "abc-copyright":
    case "abc-creator":
    case "abc-edited-by":
    case "abc-version":
    case "abc-charset":
      return parseAnnotation(directive, analyzer);

    // ============================================================================
    // Unknown Directive
    // ============================================================================
    default:
      analyzer.report(`Unknown directive: ${key}`, directive.id);
      return null;
  }
}

// ============================================================================
// Helper Functions (to be implemented)
// ============================================================================

/**
 * Parses font directives (face, size, bold, italic, underline, box)
 *
 * Three formats supported:
 * 1. * <size> [box]           - keep current face, change size
 * 2. <size> [box]             - keep current face, change size
 * 3. <face> [utf8] [size] [modifiers...] [box] - full definition
 */
function parseFontDirective(directive: Directive, analyzer: SemanticAnalyzer, options: { supportsBox: boolean }): DirectiveSemanticData | null {
  if (directive.values.length === 0) {
    analyzer.report(`Directive "${directive.key.lexeme}" requires font parameters`, directive.id);
    return null;
  }

  const tokens = [...directive.values]; // Copy to avoid modifying original
  let currentIdx = 0;

  // Helper to get current token
  const current = () => (currentIdx < tokens.length ? tokens[currentIdx] : null);
  const advance = () => currentIdx++;

  // Format 1: asterisk and number only
  let cur = current();
  if (isToken(cur) && cur.type === TT.IDENTIFIER && cur.lexeme === "*") {
    advance();
    if (!current()) {
      analyzer.report("Expected font size number after *", directive.id);
      return null;
    }
    return parseSizeOnlyFormat(directive, tokens, currentIdx, options, analyzer);
  }

  // Format 2: number only (with optional box)
  cur = current();
  if (isToken(cur) && cur.type === TT.NUMBER) {
    return parseSizeOnlyFormat(directive, tokens, currentIdx, options, analyzer);
  }

  // Format 3: full definition
  return parseFullFontDefinition(directive, tokens, options, analyzer);
}

function parseSizeOnlyFormat(
  directive: Directive,
  tokens: Array<Token | any>,
  startIdx: number,
  options: { supportsBox: boolean },
  analyzer: SemanticAnalyzer
): DirectiveSemanticData | null {
  const sizeToken = tokens[startIdx];

  if (!isToken(sizeToken) || sizeToken.type !== TT.NUMBER) {
    analyzer.report("Expected number for font size", directive.id);
    return null;
  }

  const size = parseFloat(sizeToken.lexeme);
  const result: FontSpec = { size };

  // Check for optional box parameter
  if (startIdx + 1 < tokens.length) {
    const nextToken = tokens[startIdx + 1];
    if (isToken(nextToken) && nextToken.type === TT.IDENTIFIER && nextToken.lexeme.toLowerCase() === "box") {
      if (options.supportsBox) {
        result.box = true;
      } else {
        analyzer.report(`Font type "${directive.key.lexeme}" does not support "box" parameter`, directive.id);
      }
    }

    if (startIdx + 2 < tokens.length) {
      analyzer.report("Extra parameters in font definition", directive.id);
    }
  }

  return {
    type: directive.key.lexeme as any,
    data: result,
  };
}

function parseFullFontDefinition(
  directive: Directive,
  tokens: Array<Token | any>,
  options: { supportsBox: boolean },
  analyzer: SemanticAnalyzer
): DirectiveSemanticData | null {
  const face: string[] = [];
  let size: number | undefined;
  let weight: "normal" | "bold" = "normal";
  let style: "normal" | "italic" = "normal";
  let decoration: "none" | "underline" = "none";
  let box: boolean = false;

  let state: "face" | "size" | "modifier" | "finished" = "face";
  let hyphenLast = false;
  let idx = 0;

  while (idx < tokens.length) {
    const token = tokens[idx];
    if (!isToken(token)) {
      analyzer.report("Unexpected token type in font definition", directive.id);
      idx++;
      continue;
    }

    const word = token.lexeme.toLowerCase();

    switch (state) {
      case "face":
        // Check if this is a keyword that transitions state
        if (
          hyphenLast ||
          (word !== "utf" &&
            word !== "utf8" &&
            word !== "utf-8" &&
            token.type !== TT.NUMBER &&
            word !== "bold" &&
            word !== "italic" &&
            word !== "underline" &&
            word !== "box")
        ) {
          // Part of face name
          if (face.length > 0 && token.lexeme === "-") {
            hyphenLast = true;
            face[face.length - 1] = face[face.length - 1] + token.lexeme;
          } else {
            if (hyphenLast) {
              hyphenLast = false;
              face[face.length - 1] = face[face.length - 1] + token.lexeme;
            } else {
              face.push(token.lexeme);
            }
          }
        } else {
          // State transition
          if (token.type === TT.NUMBER) {
            if (size !== undefined) {
              analyzer.report("Font size specified twice in font definition", directive.id);
            } else {
              size = parseFloat(token.lexeme);
            }
            state = "modifier";
          } else if (word === "bold") {
            weight = "bold";
          } else if (word === "italic") {
            style = "italic";
          } else if (word === "underline") {
            decoration = "underline";
          } else if (word === "box") {
            if (options.supportsBox) {
              box = true;
            } else {
              analyzer.report(`Font type "${directive.key.lexeme}" does not support "box" parameter`, directive.id);
            }
            state = "finished";
          } else if (word === "utf" || word === "utf8" || word === "utf-8") {
            // Skip utf8 marker and the "8" if separate
            if (word === "utf" && idx + 1 < tokens.length) {
              idx++; // Skip the "8"
            }
            state = "size";
          } else {
            analyzer.report(`Unknown parameter "${token.lexeme}" in font definition`, directive.id);
          }
        }
        break;

      case "size":
        if (token.type === TT.NUMBER) {
          if (size !== undefined) {
            analyzer.report("Font size specified twice in font definition", directive.id);
          } else {
            size = parseFloat(token.lexeme);
          }
        } else {
          analyzer.report("Expected font size in font definition", directive.id);
        }
        state = "modifier";
        break;

      case "modifier":
        if (word === "bold") {
          weight = "bold";
        } else if (word === "italic") {
          style = "italic";
        } else if (word === "underline") {
          decoration = "underline";
        } else if (word === "box") {
          if (options.supportsBox) {
            box = true;
          } else {
            analyzer.report(`Font type "${directive.key.lexeme}" does not support "box" parameter`, directive.id);
          }
          state = "finished";
        } else {
          analyzer.report(`Unknown parameter "${token.lexeme}" in font definition`, directive.id);
        }
        break;

      case "finished":
        analyzer.report(`Extra characters found after "box" in font definition`, directive.id);
        break;
    }

    idx++;
  }

  // Build final face string
  let finalFace = face.join(" ");

  // Handle quoted font names
  if ((finalFace.startsWith('"') && finalFace.endsWith('"')) || (finalFace.startsWith("'") && finalFace.endsWith("'"))) {
    finalFace = finalFace.slice(1, -1);
  }

  const result: FontSpec = {
    weight,
    style,
    decoration,
  };

  if (finalFace) {
    result.face = finalFace;
  }

  if (size !== undefined) {
    result.size = size;
  }

  if (box) {
    result.box = true;
  }

  // Validate that we have meaningful content
  if (!result.face && !result.size && result.weight === "normal" && result.style === "normal" && result.decoration === "none" && !result.box) {
    analyzer.report("Font directive has no meaningful parameters", directive.id);
    return null;
  }

  return {
    type: directive.key.lexeme as any,
    data: result,
  };
}

/**
 * Parses boolean flag directives (no parameters expected)
 */
function parseBooleanFlag(directive: Directive, analyzer: SemanticAnalyzer): DirectiveSemanticData | null {
  if (directive.values.length > 0) {
    analyzer.report(`Directive "${directive.key.lexeme}" expects no parameters, but got ${directive.values.length}`, directive.id);
  }

  return {
    type: directive.key.lexeme as any,
    data: true,
  };
}

/**
 * Parses directives that expect a single identifier
 */
function parseIdentifier(directive: Directive, analyzer: SemanticAnalyzer): DirectiveSemanticData | null {
  if (directive.values.length === 0) {
    analyzer.report(`Directive "${directive.key.lexeme}" expects an identifier parameter`, directive.id);
    return null;
  }

  const value = directive.values[0];
  if (!(value instanceof Token) || value.type !== TT.IDENTIFIER) {
    analyzer.report(`Directive "${directive.key.lexeme}" expects an identifier`, directive.id);
    return null;
  }

  if (directive.values.length > 1) {
    analyzer.report(`Directive "${directive.key.lexeme}" expects only one parameter, ignoring extra parameters`, directive.id);
  }

  return {
    type: directive.key.lexeme as any,
    data: value.lexeme,
  };
}

/**
 * Parses directives that expect a boolean value (true/false or 0/1)
 */
function parseBooleanValue(directive: Directive, analyzer: SemanticAnalyzer): DirectiveSemanticData | null {
  if (directive.values.length === 0) {
    analyzer.report(`Directive "${directive.key.lexeme}" expects a boolean parameter`, directive.id);
    return null;
  }

  const value = directive.values[0];
  if (!(value instanceof Token)) {
    analyzer.report(`Directive "${directive.key.lexeme}" expects a boolean (true/false or 0/1)`, directive.id);
    return null;
  }

  let boolValue: boolean;
  if (value.type === TT.IDENTIFIER) {
    const lexeme = value.lexeme.toLowerCase();
    if (lexeme === "true") {
      boolValue = true;
    } else if (lexeme === "false") {
      boolValue = false;
    } else {
      analyzer.report(`Directive "${directive.key.lexeme}" expects true/false or 0/1, got "${value.lexeme}"`, directive.id);
      return null;
    }
  } else if (value.type === TT.NUMBER) {
    const num = parseFloat(value.lexeme);
    if (num === 0) {
      boolValue = false;
    } else if (num === 1) {
      boolValue = true;
    } else {
      analyzer.report(`Directive "${directive.key.lexeme}" expects 0 or 1, got ${num}`, directive.id);
      return null;
    }
  } else {
    analyzer.report(`Directive "${directive.key.lexeme}" expects a boolean (true/false or 0/1)`, directive.id);
    return null;
  }

  if (directive.values.length > 1) {
    analyzer.report(`Directive "${directive.key.lexeme}" expects only one parameter, ignoring extra parameters`, directive.id);
  }

  return {
    type: directive.key.lexeme as any,
    data: boolValue,
  };
}

/**
 * Parses directives that expect a number
 */
function parseNumber(directive: Directive, analyzer: SemanticAnalyzer, constraints?: { min?: number; max?: number }): DirectiveSemanticData | null {
  if (directive.values.length === 0) {
    analyzer.report(`Directive "${directive.key.lexeme}" expects a number parameter`, directive.id);
    return null;
  }

  const value = directive.values[0];
  if (!(value instanceof Token) || value.type !== TT.NUMBER) {
    analyzer.report(`Directive "${directive.key.lexeme}" expects a number`, directive.id);
    return null;
  }

  const num = parseFloat(value.lexeme);
  if (isNaN(num)) {
    analyzer.report(`Invalid number: ${value.lexeme}`, directive.id);
    return null;
  }

  if (constraints?.min !== undefined && num < constraints.min) {
    analyzer.report(`Number ${num} is below minimum ${constraints.min}`, directive.id);
    return null;
  }

  if (constraints?.max !== undefined && num > constraints.max) {
    analyzer.report(`Number ${num} is above maximum ${constraints.max}`, directive.id);
    return null;
  }

  if (directive.values.length > 1) {
    analyzer.report(`Directive "${directive.key.lexeme}" expects only one parameter, ignoring extra parameters`, directive.id);
  }

  return {
    type: directive.key.lexeme as any,
    data: num,
  };
}

/**
 * Parses position choice directives (auto, above, below, hidden)
 */
function parsePositionChoice(directive: Directive, analyzer: SemanticAnalyzer): DirectiveSemanticData | null {
  if (directive.values.length === 0) {
    analyzer.report(`Directive "${directive.key.lexeme}" expects a position parameter (auto, above, below, hidden)`, directive.id);
    return null;
  }

  const value = directive.values[0];
  if (!(value instanceof Token) || value.type !== TT.IDENTIFIER) {
    analyzer.report(`Directive "${directive.key.lexeme}" expects a position identifier`, directive.id);
    return null;
  }

  const lexeme = value.lexeme.toLowerCase();
  const validPositions = ["auto", "above", "below", "hidden"];
  if (!validPositions.includes(lexeme)) {
    analyzer.report(`Invalid position "${value.lexeme}", expected one of: ${validPositions.join(", ")}`, directive.id);
    return null;
  }

  if (directive.values.length > 1) {
    analyzer.report(`Directive "${directive.key.lexeme}" expects only one parameter, ignoring extra parameters`, directive.id);
  }

  return {
    type: directive.key.lexeme as any,
    data: lexeme as "auto" | "above" | "below" | "hidden",
  };
}

/**
 * Parses measurement directives (number with optional unit)
 */
function parseMeasurement(directive: Directive, analyzer: SemanticAnalyzer): DirectiveSemanticData | null {
  if (directive.values.length === 0) {
    analyzer.report(`Directive "${directive.key.lexeme}" expects a measurement parameter`, directive.id);
    return null;
  }

  const value = directive.values[0];

  // Check if it's a Measurement object (number + unit)
  if (value instanceof Measurement) {
    const numValue = parseFloat(value.value.lexeme);
    if (isNaN(numValue)) {
      analyzer.report(`Invalid measurement value: ${value.value.lexeme}`, directive.id);
      return null;
    }

    if (directive.values.length > 1) {
      analyzer.report(`Directive "${directive.key.lexeme}" expects only one parameter, ignoring extra parameters`, directive.id);
    }

    return {
      type: directive.key.lexeme as any,
      data: {
        value: numValue,
        unit: value.scale.lexeme as "pt" | "in" | "cm" | "mm",
      },
    };
  }

  // Otherwise, expect a plain number (default unit)
  if (value instanceof Token && value.type === TT.NUMBER) {
    const numValue = parseFloat(value.lexeme);
    if (isNaN(numValue)) {
      analyzer.report(`Invalid number: ${value.lexeme}`, directive.id);
      return null;
    }

    if (directive.values.length > 1) {
      analyzer.report(`Directive "${directive.key.lexeme}" expects only one parameter, ignoring extra parameters`, directive.id);
    }

    return {
      type: directive.key.lexeme as any,
      data: {
        value: numValue,
      },
    };
  }

  analyzer.report(`Directive "${directive.key.lexeme}" expects a measurement (number with optional unit)`, directive.id);
  return null;
}

/**
 * Parses %%sep directive (space above, space below, line length)
 * Format: %%sep [above] [below] [length]
 */
function parseSep(directive: Directive, analyzer: SemanticAnalyzer): DirectiveSemanticData | null {
  const result: { above?: number; below?: number; length?: number } = {};

  for (let i = 0; i < directive.values.length && i < 3; i++) {
    const value = directive.values[i];
    if (!(value instanceof Token) || value.type !== TT.NUMBER) {
      analyzer.report(`Directive "sep" expects number parameters`, directive.id);
      continue;
    }

    const num = parseFloat(value.lexeme);
    if (isNaN(num)) {
      analyzer.report(`Invalid number: ${value.lexeme}`, directive.id);
      continue;
    }

    if (i === 0) result.above = num;
    else if (i === 1) result.below = num;
    else if (i === 2) result.length = num;
  }

  if (directive.values.length > 3) {
    analyzer.report(`Directive "sep" expects at most 3 parameters, ignoring extra parameters`, directive.id);
  }

  return {
    type: directive.key.lexeme as any,
    data: result,
  };
}

/**
 * Parses %%text directive (quoted string)
 */
function parseText(directive: Directive, analyzer: SemanticAnalyzer): DirectiveSemanticData | null {
  // Same as parseAnnotation - accepts text content
  return parseAnnotation(directive, analyzer);
}

/**
 * Parses %%center directive (quoted string)
 */
function parseCenter(directive: Directive, analyzer: SemanticAnalyzer): DirectiveSemanticData | null {
  // Same as parseAnnotation - accepts text content
  return parseAnnotation(directive, analyzer);
}

/**
 * Parses %%setfont directive (font number + font spec)
 * Format: %%setfont-N <font-spec>
 */
function parseSetfont(directive: Directive, analyzer: SemanticAnalyzer): DirectiveSemanticData | null {
  // TODO: Implement - requires parsing -N suffix and font spec
  analyzer.report(`Directive "${directive.key.lexeme}" is not yet implemented`, directive.id);
  return null;
}

/**
 * Parses %%newpage directive (optional page number)
 */
function parseNewpage(directive: Directive, analyzer: SemanticAnalyzer): DirectiveSemanticData | null {
  if (directive.values.length === 0) {
    // No page number specified
    return {
      type: directive.key.lexeme as any,
      data: null,
    };
  }

  const value = directive.values[0];
  if (!(value instanceof Token) || value.type !== TT.NUMBER) {
    analyzer.report(`Directive "${directive.key.lexeme}" expects an optional number parameter`, directive.id);
    return null;
  }

  const pageNum = parseFloat(value.lexeme);
  if (isNaN(pageNum)) {
    analyzer.report(`Invalid page number: ${value.lexeme}`, directive.id);
    return null;
  }

  if (directive.values.length > 1) {
    analyzer.report(`Directive "${directive.key.lexeme}" expects only one parameter, ignoring extra parameters`, directive.id);
  }

  return {
    type: directive.key.lexeme as any,
    data: pageNum,
  };
}

/**
 * Parses %%staves directive (staff layout)
 */
function parseStaves(directive: Directive, analyzer: SemanticAnalyzer): DirectiveSemanticData | null {
  // TODO: Implement
  throw new Error("Not implemented");
}

/**
 * Parses %%score directive (staff layout)
 */
function parseScore(directive: Directive, analyzer: SemanticAnalyzer): DirectiveSemanticData | null {
  // TODO: Implement
  throw new Error("Not implemented");
}

/**
 * Parses %%header directive (tab-separated left/center/right)
 */
function parseHeader(directive: Directive, analyzer: SemanticAnalyzer): DirectiveSemanticData | null {
  // TODO: Implement
  throw new Error("Not implemented");
}

/**
 * Parses %%footer directive (tab-separated left/center/right)
 */
function parseFooter(directive: Directive, analyzer: SemanticAnalyzer): DirectiveSemanticData | null {
  // TODO: Implement
  throw new Error("Not implemented");
}

/**
 * Parses %%midi directive (command + parameters)
 */
function parseMidi(directive: Directive, analyzer: SemanticAnalyzer): DirectiveSemanticData | null {
  // TODO: Implement
  throw new Error("Not implemented");
}

/**
 * Parses %%percmap directive (note mapping for percussion)
 */
function parsePercmap(directive: Directive, analyzer: SemanticAnalyzer): DirectiveSemanticData | null {
  // TODO: Implement
  throw new Error("Not implemented");
}

/**
 * Parses %%deco directive (decoration definition)
 */
function parseDeco(directive: Directive, analyzer: SemanticAnalyzer): DirectiveSemanticData | null {
  // TODO: Implement
  throw new Error("Not implemented");
}

/**
 * Parses annotation directives (quoted string or plain text)
 */
function parseAnnotation(directive: Directive, analyzer: SemanticAnalyzer): DirectiveSemanticData | null {
  if (directive.values.length === 0) {
    analyzer.report(`Directive "${directive.key.lexeme}" expects a text parameter`, directive.id);
    return null;
  }

  const value = directive.values[0];

  // Check if it's an Annotation object
  if (value instanceof Annotation) {
    return {
      type: directive.key.lexeme as any,
      data: value.text.lexeme,
    };
  }

  // Otherwise accept a plain token
  if (value instanceof Token) {
    return {
      type: directive.key.lexeme as any,
      data: value.lexeme,
    };
  }

  analyzer.report(`Directive "${directive.key.lexeme}" expects a string parameter`, directive.id);
  return null;
}
