import { isToken } from "../helpers";
import { StaffNomenclature, VxNomenclature } from "../interpreter/InterpreterState";
import { Token, TT } from "../parsers/scan2";
import { DirectiveSemanticData, FontSpec, DRUM_SOUND_NAMES, DrumSoundName } from "../types/directive-specs";
import { Directive, Annotation, Measurement, Rational, KV, Pitch } from "../types/Expr2";
import { SemanticAnalyzer } from "./semantic-analyzer";
import { BracketBracePosition } from "../types/abcjs-ast";
import { IRational } from "../Visitors/fmt2/rational";

/**
 * Analyzes directives and produces semantic data.
 * Inspired by abcjs parseDirective.addDirective() - direct and readable.
 */
export function analyzeDirective(directive: Directive, analyzer: SemanticAnalyzer): DirectiveSemanticData | null {
  const key = directive.key.lexeme;

  // Handle pattern-based directives before the switch
  // Because setfont-1, setfont-2, etc. are tokenized as distinct identifiers,
  // we need to check for the pattern match before the switch statement.
  if (/^setfont-[1-9]$/i.test(key)) {
    return parseSetfont(directive, analyzer);
  }

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
    case "endtext":
    case "beginps":
    case "endps":
    case "font":
    case "nobarcheck":
      return parseBooleanFlag(directive, analyzer);

    // ============================================================================
    // Multi-line Text Directive
    // ============================================================================
    case "begintext":
      return parseBeginText(directive, analyzer);

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
      return parseStretchLast(directive, analyzer);
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
      analyzer.report(`Unknown directive: ${key}`, directive);
      return null;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a word is a UTF-8 marker
 */
function isUtf8Marker(word: string): boolean {
  return word === "utf" || word === "utf8" || word === "utf-8";
}

/**
 * Check if a word is a font modifier (bold, italic, underline)
 */
function isFontModifier(word: string): boolean {
  return word === "bold" || word === "italic" || word === "underline";
}

/**
 * Check if a token should be treated as part of a font face name
Concrete Examples:
Example 1: Multi-word font name
%%titlefont Times New Roman 12

"Times" → part of face name ✓
"New" → part of face name ✓
"Roman" → part of face name ✓
"12" → NOT part of face (it's a number, so it's the size)
Result: face = "Times New Roman", size = 12
Example 2: Hyphenated font name
%%titlefont Arial-Black 14 bold

"Arial" → part of face name ✓
"-" → part of face name ✓ (triggers hyphenLast mode)
"Black" → part of face name ✓ (continues from hyphen)
"14" → NOT part of face (number = size)
"bold" → NOT part of face (modifier keyword)
Result: face = "Arial-Black", size = 14, weight = "bold"
Example 3: Font name before modifiers
%%titlefont Helvetica utf8 12 italic

"Helvetica" → part of face name ✓
"utf8" → NOT part of face (UTF-8 marker → state transition)
"12" → size
"italic" → modifier
Result: face = "Helvetica", size = 12, style = "italic"
Example 4: Single-word font
%%titlefont Courier 10

"Courier" → part of face name ✓
"10" → NOT part of face (number)
Result: face = "Courier", size = 10
 */
function isPartOfFaceName(token: Token, word: string, hyphenLast: boolean): boolean {
  return hyphenLast || (!isUtf8Marker(word) && token.type !== TT.NUMBER && !isFontModifier(word) && word !== "box");
}

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
    analyzer.report(`Directive "${directive.key.lexeme}" requires font parameters`, directive);
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
      analyzer.report("Expected font size number after *", directive);
      return null;
    }
    return parseSizeOnlyFormat(directive, tokens, currentIdx, options, analyzer);
  }

  // Format 2: number only (with optional box)
  cur = current();
  if (isToken(cur) && cur.type === TT.NUMBER) {
    // Check if next token is a modifier: then it’s format 3.
    if (currentIdx + 1 < tokens.length) {
      const next = tokens[currentIdx + 1];
      if (isToken(next) && next.type === TT.IDENTIFIER) {
        const word = next.lexeme.toLowerCase();
        if (word === "bold" || word === "italic" || word === "underline") {
          // This is format 3 (size + modifiers), not format 2
          return parseFullFontDefinition(directive, tokens, options, analyzer);
        }
      }
    }
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
    analyzer.report("Expected number for font size", directive);
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
        analyzer.report(`Font type "${directive.key.lexeme}" does not support "box" parameter`, directive);
      }
    }

    if (startIdx + 2 < tokens.length) {
      analyzer.report("Extra parameters in font definition", directive);
    }
  }

  return {
    type: directive.key.lexeme as any,
    data: result,
  };
}

function parseFullFontDefinition(
  directive: Directive,
  tokens: (Token | Annotation | Pitch | KV | Rational | Measurement)[],
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
  let idx = 0;

  while (idx < tokens.length) {
    const token = tokens[idx];

    // Type guard: only Tokens are expected in font definitions
    if (!isToken(token)) {
      analyzer.report(`Unexpected non-token value in font directive`, directive);
      idx++;
      continue;
    }

    switch (state) {
      case "face":
        // Inner loop: consume ALL face name tokens at once
        let hyphenLast = false;
        while (idx < tokens.length) {
          const t = tokens[idx];

          // Type guard for face name parsing
          if (!isToken(t)) {
            analyzer.report(`Unexpected non-token value in font face name`, directive);
            idx++;
            continue;
          }

          const w = t.lexeme.toLowerCase();

          if (!isPartOfFaceName(t, w, hyphenLast)) break;

          // Build face name (handle hyphens)
          if (face.length > 0 && t.lexeme === "-") {
            hyphenLast = true;
            face[face.length - 1] += t.lexeme;
          } else {
            if (hyphenLast) {
              hyphenLast = false;
              face[face.length - 1] += t.lexeme;
            } else {
              face.push(t.lexeme);
            }
          }
          idx++;
        }

        if (idx >= tokens.length) break;

        // Type guard before checking next token
        const nextToken = tokens[idx];
        if (!isToken(nextToken)) {
          analyzer.report(`Unexpected non-token value in font directive`, directive);
          idx++;
          break;
        }

        if (isUtf8Marker(nextToken.lexeme.toLowerCase())) {
          // Skip UTF-8 marker
          idx++;
          state = "size";
        } else if (nextToken.type === TT.NUMBER) {
          state = "size"; // Let size state consume it
        } else if (isFontModifier(nextToken.lexeme.toLowerCase())) {
          state = "modifier"; // Let modifier state consume it
        } else if (nextToken.lexeme.toLowerCase() === "box") {
          state = "modifier"; // Let finished state handle box? Or handle here?
        }
        break;

      case "size":
        // Consume size number
        if (token.type === TT.NUMBER) {
          size = parseFloat(token.lexeme);
          idx++;
        }
        state = "modifier"; // Always transition
        break;

      case "modifier":
        // Inner loop: consume ALL modifiers at once
        while (idx < tokens.length) {
          const modToken = tokens[idx];

          // Type guard for modifier parsing
          if (!isToken(modToken)) {
            analyzer.report(`Unexpected non-token value in font modifiers`, directive);
            idx++;
            continue;
          }

          if (!isFontModifier(modToken.lexeme.toLowerCase())) break;

          const modWord = modToken.lexeme.toLowerCase();
          if (modWord === "bold") weight = "bold";
          else if (modWord === "italic") style = "italic";
          else if (modWord === "underline") decoration = "underline";
          idx++;
        }

        // Check for box
        if (idx < tokens.length) {
          const boxToken = tokens[idx];
          if (isToken(boxToken) && boxToken.lexeme.toLowerCase() === "box") {
            if (options.supportsBox) {
              box = true;
            } else {
              analyzer.report(`Font type "${directive.key.lexeme}" does not support "box" parameter`, directive);
            }
            idx++;
          }
        }
        state = "finished";
        break;

      case "finished":
        // Report extra tokens
        analyzer.report("Extra tokens", directive);
        idx++;
        break;
    }
  }

  let finalFace = face.join(" ");

  // trim start and end quotes
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
    analyzer.report("Font directive has no meaningful parameters", directive);
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
    analyzer.report(`Directive "${directive.key.lexeme}" expects no parameters, but got ${directive.values.length}`, directive);
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
    analyzer.report(`Directive "${directive.key.lexeme}" expects an identifier parameter`, directive);
    return null;
  }

  const value = directive.values[0];
  if (!(value instanceof Token) || value.type !== TT.IDENTIFIER) {
    analyzer.report(`Directive "${directive.key.lexeme}" expects an identifier`, directive);
    return null;
  }

  if (directive.values.length > 1) {
    analyzer.report(`Directive "${directive.key.lexeme}" expects only one parameter, ignoring extra parameters`, directive);
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
    analyzer.report(`Directive "${directive.key.lexeme}" expects a boolean parameter`, directive);
    return null;
  }

  const value = directive.values[0];
  if (!(value instanceof Token)) {
    analyzer.report(`Directive "${directive.key.lexeme}" expects a boolean (true/false or 0/1)`, directive);
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
      analyzer.report(`Directive "${directive.key.lexeme}" expects true/false or 0/1, got "${value.lexeme}"`, directive);
      return null;
    }
  } else if (value.type === TT.NUMBER) {
    const num = parseFloat(value.lexeme);
    if (num === 0) {
      boolValue = false;
    } else if (num === 1) {
      boolValue = true;
    } else {
      analyzer.report(`Directive "${directive.key.lexeme}" expects 0 or 1, got ${num}`, directive);
      return null;
    }
  } else {
    analyzer.report(`Directive "${directive.key.lexeme}" expects a boolean (true/false or 0/1)`, directive);
    return null;
  }

  if (directive.values.length > 1) {
    analyzer.report(`Directive "${directive.key.lexeme}" expects only one parameter, ignoring extra parameters`, directive);
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
    analyzer.report(`Directive "${directive.key.lexeme}" expects a number parameter`, directive);
    return null;
  }

  const value = directive.values[0];
  if (!(value instanceof Token) || value.type !== TT.NUMBER) {
    analyzer.report(`Directive "${directive.key.lexeme}" expects a number`, directive);
    return null;
  }

  const num = parseFloat(value.lexeme);
  if (isNaN(num)) {
    analyzer.report(`Invalid number: ${value.lexeme}`, directive);
    return null;
  }

  if (constraints?.min !== undefined && num < constraints.min) {
    analyzer.report(`Number ${num} is below minimum ${constraints.min}`, directive);
    return null;
  }

  if (constraints?.max !== undefined && num > constraints.max) {
    analyzer.report(`Number ${num} is above maximum ${constraints.max}`, directive);
    return null;
  }

  if (directive.values.length > 1) {
    analyzer.report(`Directive "${directive.key.lexeme}" expects only one parameter, ignoring extra parameters`, directive);
  }

  return {
    type: directive.key.lexeme as any,
    data: num,
  };
}

/**
 * Parses stretchlast directive: no param (defaults to 1), false, true, or number 0-1
 */
function parseStretchLast(directive: Directive, analyzer: SemanticAnalyzer): DirectiveSemanticData | null {
  // No parameters: default to 1 (true)
  if (directive.values.length === 0) {
    return {
      type: directive.key.lexeme as any,
      data: 1,
    };
  }

  const value = directive.values[0];
  if (!(value instanceof Token)) {
    analyzer.report(`Directive "${directive.key.lexeme}" expects false, true, or a number between 0 and 1`, directive);
    return null;
  }

  // Handle boolean keywords
  if (value.lexeme === "false") {
    return {
      type: directive.key.lexeme as any,
      data: 0,
    };
  }

  if (value.lexeme === "true") {
    return {
      type: directive.key.lexeme as any,
      data: 1,
    };
  }

  // Handle numeric value
  if (value.type === TT.NUMBER) {
    const num = parseFloat(value.lexeme);
    if (isNaN(num)) {
      analyzer.report(`Invalid number: ${value.lexeme}`, directive);
      return null;
    }

    if (num < 0 || num > 1) {
      analyzer.report(`stretchlast value must be between 0 and 1 (received ${num})`, directive);
      return null;
    }

    return {
      type: directive.key.lexeme as any,
      data: num,
    };
  }

  analyzer.report(`Directive "${directive.key.lexeme}" expects false, true, or a number between 0 and 1 (received ${value.lexeme})`, directive);
  return null;
}

/**
 * Parses position choice directives (auto, above, below, hidden)
 */
function parsePositionChoice(directive: Directive, analyzer: SemanticAnalyzer): DirectiveSemanticData | null {
  if (directive.values.length === 0) {
    analyzer.report(`Directive "${directive.key.lexeme}" expects a position parameter (auto, above, below, hidden)`, directive);
    return null;
  }

  const value = directive.values[0];
  if (!(value instanceof Token) || value.type !== TT.IDENTIFIER) {
    analyzer.report(`Directive "${directive.key.lexeme}" expects a position identifier`, directive);
    return null;
  }

  const lexeme = value.lexeme.toLowerCase();
  const validPositions = ["auto", "above", "below", "hidden"];
  if (!validPositions.includes(lexeme)) {
    analyzer.report(`Invalid position "${value.lexeme}", expected one of: ${validPositions.join(", ")}`, directive);
    return null;
  }

  if (directive.values.length > 1) {
    analyzer.report(`Directive "${directive.key.lexeme}" expects only one parameter, ignoring extra parameters`, directive);
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
    analyzer.report(`Directive "${directive.key.lexeme}" expects a measurement parameter`, directive);
    return null;
  }

  const value = directive.values[0];

  // Check if it's a Measurement object (number + unit)
  if (value instanceof Measurement) {
    const numValue = parseFloat(value.value.lexeme);
    if (isNaN(numValue)) {
      analyzer.report(`Invalid measurement value: ${value.value.lexeme}`, directive);
      return null;
    }

    if (directive.values.length > 1) {
      analyzer.report(`Directive "${directive.key.lexeme}" expects only one parameter, ignoring extra parameters`, directive);
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
      analyzer.report(`Invalid number: ${value.lexeme}`, directive);
      return null;
    }

    if (directive.values.length > 1) {
      analyzer.report(`Directive "${directive.key.lexeme}" expects only one parameter, ignoring extra parameters`, directive);
    }

    return {
      type: directive.key.lexeme as any,
      data: {
        value: numValue,
      },
    };
  }

  analyzer.report(`Directive "${directive.key.lexeme}" expects a measurement (number with optional unit)`, directive);
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
      analyzer.report(`Directive "sep" expects number parameters`, directive);
      continue;
    }

    const num = parseFloat(value.lexeme);
    if (isNaN(num)) {
      analyzer.report(`Invalid number: ${value.lexeme}`, directive);
      continue;
    }

    if (i === 0) result.above = num;
    else if (i === 1) result.below = num;
    else if (i === 2) result.length = num;
  }

  if (directive.values.length > 3) {
    analyzer.report(`Directive "sep" expects at most 3 parameters, ignoring extra parameters`, directive);
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
 *
 * Because the directive name includes a numeric suffix (1-9), we need to extract it
 * from the directive key. The scanner tokenizes "setfont-1" as a single IDENTIFIER.
 */
function parseSetfont(directive: Directive, analyzer: SemanticAnalyzer): DirectiveSemanticData | null {
  // Extract font number from directive key (e.g., "setfont-1" -> 1)
  const match = /^setfont-([1-9])$/i.exec(directive.key.lexeme);

  if (!match) {
    analyzer.report(`Invalid setfont directive format. Expected %%setfont-N where N is 1-9, got "${directive.key.lexeme}"`, directive);
    return null;
  }

  const fontNumber = parseInt(match[1], 10);

  // Validate font specification is provided
  if (directive.values.length === 0) {
    analyzer.report(`Directive "${directive.key.lexeme}" requires font parameters`, directive);
    return null;
  }

  // Parse the font specification using existing font parsing logic
  // setfont does not support the box parameter
  const fontResult = parseFullFontDefinition(directive, directive.values, { supportsBox: false }, analyzer);

  if (!fontResult) {
    return null;
  }

  // Return setfont-specific data structure
  return {
    type: "setfont",
    data: {
      number: fontNumber,
      font: fontResult.data as FontSpec,
    },
  };
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
    analyzer.report(`Directive "${directive.key.lexeme}" expects an optional number parameter`, directive);
    return null;
  }

  const pageNum = parseFloat(value.lexeme);
  if (isNaN(pageNum)) {
    analyzer.report(`Invalid page number: ${value.lexeme}`, directive);
    return null;
  }

  if (directive.values.length > 1) {
    analyzer.report(`Directive "${directive.key.lexeme}" expects only one parameter, ignoring extra parameters`, directive);
  }

  return {
    type: directive.key.lexeme as any,
    data: pageNum,
  };
}

/**
 * Mutable context object used during staff directive parsing.
 * Groups all the state that needs to be modified by helper functions
 * during the parsing of %%score and %%staves directives.
 */
interface StaffParsingContext {
  /** The staffs being built during parsing */
  staves: StaffNomenclature[];
  /** Maps voice IDs to their staff assignments */
  vxStaff: Map<string, VxNomenclature>;
  /** Whether the next staff should continue bar lines from the previous staff */
  continueBar: boolean;
  /** The ID of the most recently processed voice */
  lastVoiceId: string | null;
  /** State tracking for grouping symbols */
  openParen: boolean;
  justOpenParen: boolean;
  openBracket: boolean;
  justOpenBracket: boolean;
  openBrace: boolean;
  justOpenBrace: boolean;
}

/**
 * Adds a voice to the staff parsing context.
 * Creates a new staff if needed and assigns the voice to it.
 */
function addVoiceToStaff(
  ctx: StaffParsingContext,
  voiceId: string,
  newStaff: boolean,
  bracket?: BracketBracePosition,
  brace?: BracketBracePosition,
  connectBar?: boolean
): void {
  // Create new staff if needed
  if (newStaff || ctx.staves.length === 0) {
    ctx.staves.push({ index: ctx.staves.length, numVoices: 0 });
  }

  const staff = ctx.staves[ctx.staves.length - 1];

  // Apply grouping properties (only if not already set)
  if (bracket !== undefined && staff.bracket === undefined) {
    staff.bracket = bracket;
  }
  if (brace !== undefined && staff.brace === undefined) {
    staff.brace = brace;
  }
  if (connectBar) {
    staff.connectBarLines = BracketBracePosition.End;
  }

  // Add voice if not already added
  if (!ctx.vxStaff.has(voiceId)) {
    ctx.vxStaff.set(voiceId, {
      staffNum: staff.index,
      index: staff.numVoices,
    });
    staff.numVoices++;
  }
}

/**
 * Handles bar line connections between staffs.
 * Updates the continueBar flag and sets appropriate connection types on staffs.
 */
function addContinueBar(ctx: StaffParsingContext): void {
  ctx.continueBar = true;
  if (ctx.lastVoiceId !== null) {
    const lastVoice = ctx.vxStaff.get(ctx.lastVoiceId);
    if (lastVoice) {
      let ty: BracketBracePosition = BracketBracePosition.Start;
      if (lastVoice.staffNum > 0) {
        const prevStaff = ctx.staves[lastVoice.staffNum - 1];
        if (prevStaff.connectBarLines === BracketBracePosition.Start || prevStaff.connectBarLines === BracketBracePosition.Continue) {
          ty = BracketBracePosition.Continue;
        }
      }
      ctx.staves[lastVoice.staffNum].connectBarLines = ty;
    }
  }
}

/**
 * Core parsing logic for %%score and %%staves directives.
 *
 * These directives control how voices are grouped onto staffs and how staffs are visually grouped.
 *
 * Syntax:
 * - Space: separates staffs
 * - ( ): groups voices on same staff
 * - { }: brace decoration (piano)
 * - [ ]: bracket decoration (ensemble)
 * - |: connects barlines between staffs
 *
 * @param directive - The directive to parse
 * @param analyzer - Semantic analyzer for error reporting
 * @param autoConnectBars - If true (%%staves), automatically connect barlines between all staffs
 * @returns Parsed staff layout information or null on error
 */
function parseStaffDirective(
  directive: Directive,
  analyzer: SemanticAnalyzer,
  autoConnectBars: boolean
): { staves: StaffNomenclature[]; voiceAssignments: Map<string, VxNomenclature> } | null {
  const ctx: StaffParsingContext = {
    staves: [],
    vxStaff: new Map<string, VxNomenclature>(),
    continueBar: false,
    lastVoiceId: null,
    openParen: false,
    justOpenParen: false,
    openBracket: false,
    justOpenBracket: false,
    openBrace: false,
    justOpenBrace: false,
  };

  // Process each token in directive.values
  for (const value of directive.values) {
    // We only process Token objects
    if (!isToken(value)) {
      analyzer.report("Score/staves directive should only contain voice IDs and grouping symbols", directive);
      continue;
    }

    // Handle each token type
    switch (value.type) {
      case TT.LPAREN:
        if (ctx.openParen) {
          analyzer.report("Cannot nest parentheses in score/staves directive", directive);
        }
        ctx.openParen = true;
        ctx.justOpenParen = true;
        break;

      case TT.RPAREN:
        if (!ctx.openParen || ctx.justOpenParen) {
          analyzer.report("Unexpected close parenthesis in score/staves directive", directive);
        }
        ctx.openParen = false;
        break;

      case TT.LBRACKET:
        if (ctx.openBracket) {
          analyzer.report("Cannot nest brackets in score/staves directive", directive);
        }
        ctx.openBracket = true;
        ctx.justOpenBracket = true;
        break;

      case TT.RBRACKET:
        if (!ctx.openBracket || ctx.justOpenBracket) {
          analyzer.report("Unexpected close bracket in score/staves directive", directive);
        }
        ctx.openBracket = false;
        // Set 'end' marker on the last voice's staff
        if (ctx.lastVoiceId !== null) {
          const lastVoice = ctx.vxStaff.get(ctx.lastVoiceId);
          if (lastVoice) {
            ctx.staves[lastVoice.staffNum].bracket = BracketBracePosition.End;
          }
        }
        break;

      case TT.LBRACE:
        if (ctx.openBrace) {
          analyzer.report("Cannot nest braces in score/staves directive", directive);
        }
        ctx.openBrace = true;
        ctx.justOpenBrace = true;
        break;

      case TT.RBRACE:
        if (!ctx.openBrace || ctx.justOpenBrace) {
          analyzer.report("Unexpected close brace in score/staves directive", directive);
        }
        ctx.openBrace = false;
        // Set 'end' marker on the last voice's staff
        if (ctx.lastVoiceId !== null) {
          const lastVoice = ctx.vxStaff.get(ctx.lastVoiceId);
          if (lastVoice) {
            ctx.staves[lastVoice.staffNum].brace = BracketBracePosition.End;
          }
        }
        break;

      case TT.PIPE:
        addContinueBar(ctx);
        break;

      case TT.IDENTIFIER:
        // This is a voice ID
        const voiceId = value.lexeme;

        // Decide whether to create a new staff
        // Key logic: inside parentheses (and not just opened) → same staff
        const newStaff = !ctx.openParen || ctx.justOpenParen;

        // Determine bracket/brace decoration
        const bracket = ctx.justOpenBracket ? BracketBracePosition.Start : ctx.openBracket ? BracketBracePosition.Continue : undefined;
        const brace = ctx.justOpenBrace ? BracketBracePosition.Start : ctx.openBrace ? BracketBracePosition.Continue : undefined;

        // Add the voice
        addVoiceToStaff(ctx, voiceId, newStaff, bracket, brace, ctx.continueBar);

        // Reset "just opened" flags
        ctx.justOpenParen = false;
        ctx.justOpenBracket = false;
        ctx.justOpenBrace = false;
        ctx.continueBar = false;
        ctx.lastVoiceId = voiceId;

        // For %%staves, automatically add bar connections after each voice
        if (autoConnectBars) {
          addContinueBar(ctx);
        }
        break;

      default:
        analyzer.report(`Unexpected token type ${TT[value.type]} in score/staves directive`, directive);
        break;
    }
  }

  // Validation: check for unclosed groupings
  if (ctx.openParen) {
    analyzer.report("Unclosed parenthesis in score/staves directive", directive);
  }
  if (ctx.openBracket) {
    analyzer.report("Unclosed bracket in score/staves directive", directive);
  }
  if (ctx.openBrace) {
    analyzer.report("Unclosed brace in score/staves directive", directive);
  }

  return { staves: ctx.staves, voiceAssignments: ctx.vxStaff };
}

/**
 * Parses %%staves directive (staff layout)
 */
function parseStaves(directive: Directive, analyzer: SemanticAnalyzer): DirectiveSemanticData | null {
  const result = parseStaffDirective(directive, analyzer, true);
  if (!result) return null;

  // Store the full data as an opaque object that the interpreter will use
  // Type system expects StaffLayoutSpec[] but we're passing richer data
  return {
    type: "staves",
    data: result as any,
  };
}

/**
 * Parses %%score directive (staff layout)
 */
function parseScore(directive: Directive, analyzer: SemanticAnalyzer): DirectiveSemanticData | null {
  const result = parseStaffDirective(directive, analyzer, false);
  if (!result) return null;

  // Store the full data as an opaque object that the interpreter will use
  // Type system expects StaffLayoutSpec[] but we're passing richer data
  return {
    type: "score",
    data: result as any,
  };
}

/**
 * Parses %%header and %%footer directives (tab-separated left/center/right)
 * Reference: abcjs abc_parse_directive.js lines 1142-1160
 *
 * Because the text content may contain special characters like tabs that serve as delimiters,
 * we need to parse the tab-separated values and map them to left/center/right structure.
 */
function parseHeaderFooter(directive: Directive, analyzer: SemanticAnalyzer, type: "header" | "footer"): DirectiveSemanticData | null {
  if (directive.values.length === 0) {
    analyzer.report(`Directive "${type}" expects a text parameter`, directive);
    return null;
  }

  // Extract text from first value (Token with FREE_TXT type)
  const value = directive.values[0];
  let text: string;

  if (value instanceof Token) {
    text = value.lexeme;
  } else if (value instanceof Annotation) {
    text = value.text.lexeme;
  } else {
    analyzer.report(`Directive "${type}" contains invalid value type`, directive);
    return null;
  }

  // Remove surrounding quotes if present
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    text = text.slice(1, -1);
  }

  // Split by tab character
  const parts = text.split("\t");

  // Build result structure based on number of parts
  let result: { left: string; center: string; right: string };

  if (parts.length === 1) {
    result = { left: "", center: parts[0], right: "" };
  } else if (parts.length === 2) {
    result = { left: parts[0], center: parts[1], right: "" };
  } else {
    result = { left: parts[0], center: parts[1], right: parts[2] };

    if (parts.length > 3) {
      analyzer.report(`Too many tabs in ${type}: ${parts.length} sections found (expected 1-3)`, directive);
    }
  }

  return {
    type: type,
    data: result,
  };
}

/**
 * Parses %%header directive (tab-separated left/center/right)
 */
function parseHeader(directive: Directive, analyzer: SemanticAnalyzer): DirectiveSemanticData | null {
  return parseHeaderFooter(directive, analyzer, "header");
}

/**
 * Parses %%footer directive (tab-separated left/center/right)
 */
function parseFooter(directive: Directive, analyzer: SemanticAnalyzer): DirectiveSemanticData | null {
  return parseHeaderFooter(directive, analyzer, "footer");
}

/**
 * Parses %%midi directive (command + parameters)
 * Reference: abcjs abc_parse_directive.js lines 538-725 (parseMidiCommand)
 *
 * Because MIDI directives have many subcommands with varying parameter requirements,
 * we categorize commands by their parameter signatures and validate accordingly.
 */
function parseMidi(directive: Directive, analyzer: SemanticAnalyzer): DirectiveSemanticData | null {
  // Validate that a command is provided
  if (directive.values.length === 0) {
    analyzer.report("MIDI directive requires a command", directive);
    return null;
  }

  const firstValue = directive.values[0];
  if (!isToken(firstValue) || firstValue.type !== TT.IDENTIFIER) {
    analyzer.report("MIDI directive requires a command name", directive);
    return null;
  }

  // Because MIDI commands are case-insensitive, we normalize to lowercase
  const command = firstValue.lexeme.toLowerCase();
  const params: (string | number | IRational)[] = [];

  // Define command categories based on parameter signatures
  // These arrays match the reference implementation in abc_parse_directive.js
  const midiCmdParam0 = [
    "nobarlines",
    "barlines",
    "beataccents",
    "nobeataccents",
    "droneon",
    "droneoff",
    "drumon",
    "drumoff",
    "fermatafixed",
    "fermataproportional",
    "gchordon",
    "gchordoff",
    "controlcombo",
    "temperamentnormal",
    "noportamento",
  ];

  const midiCmdParam1String = ["gchord", "ptstress", "beatstring"];

  const midiCmdParam1Integer = [
    "bassvol",
    "chordvol",
    "c",
    "channel",
    "beatmod",
    "deltaloudness",
    "drumbars",
    "gracedivider",
    "makechordchannels",
    "randomchordattack",
    "chordattack",
    "stressmodel",
    "transpose",
    "rtranspose",
    "vol",
    "volinc",
    "gchordbars",
  ];

  const midiCmdParam2Integer = ["ratio", "snt", "bendvelocity", "pitchbend", "control", "temperamentlinear"];

  const midiCmdParam4Integer = ["beat"];

  const midiCmdParam5Integer = ["drone"];

  const midiCmdParam1String1Integer = ["portamento"];

  const midiCmdParam1Integer1OptionalInteger = ["program"];

  const midiCmdParamFraction = ["expand", "grace", "trim"];

  const midiCmdParam1Integer1OptionalString = ["bassprog", "chordprog"];

  const midiCmdParam1StringVariableIntegers = ["drum", "chordname"];

  const remainingValues = directive.values.slice(1);

  // Parse parameters based on command category
  if (midiCmdParam0.includes(command)) {
    // No parameters expected
    if (remainingValues.length > 0) {
      analyzer.report(`MIDI command '${command}' expects no parameters`, directive);
    }
    // params remains empty
  } else if (midiCmdParam1String.includes(command)) {
    // One string parameter expected
    if (remainingValues.length !== 1) {
      analyzer.report(`MIDI command '${command}' expects one string parameter`, directive);
      return null;
    }
    if (!isToken(remainingValues[0])) {
      analyzer.report(`MIDI command '${command}' expects string parameter`, directive);
      return null;
    }
    params.push(remainingValues[0].lexeme);
  } else if (midiCmdParam1Integer.includes(command)) {
    // One integer parameter expected
    if (remainingValues.length !== 1) {
      analyzer.report(`MIDI command '${command}' expects one integer parameter`, directive);
      return null;
    }
    const token = remainingValues[0];
    if (!isToken(token) || token.type !== TT.NUMBER) {
      analyzer.report(`MIDI command '${command}' expects integer parameter`, directive);
      return null;
    }
    params.push(parseInt(token.lexeme, 10));
  } else if (midiCmdParam2Integer.includes(command)) {
    // Two integer parameters expected
    if (remainingValues.length !== 2) {
      analyzer.report(`MIDI command '${command}' expects two parameters`, directive);
      return null;
    }
    const token1 = remainingValues[0];
    const token2 = remainingValues[1];
    if (!isToken(token1) || token1.type !== TT.NUMBER) {
      analyzer.report(`MIDI command '${command}' expects two integer parameters`, directive);
      return null;
    }
    if (!isToken(token2) || token2.type !== TT.NUMBER) {
      analyzer.report(`MIDI command '${command}' expects two integer parameters`, directive);
      return null;
    }
    params.push(parseInt(token1.lexeme, 10));
    params.push(parseInt(token2.lexeme, 10));
  } else if (midiCmdParam4Integer.includes(command)) {
    // Four integer parameters expected
    if (remainingValues.length !== 4) {
      analyzer.report(`MIDI command '${command}' expects four parameters`, directive);
      return null;
    }
    for (let i = 0; i < 4; i++) {
      const token = remainingValues[i];
      if (!isToken(token) || token.type !== TT.NUMBER) {
        analyzer.report(`MIDI command '${command}' expects four integer parameters`, directive);
        return null;
      }
      params.push(parseInt(token.lexeme, 10));
    }
  } else if (midiCmdParam5Integer.includes(command)) {
    // Five integer parameters expected
    if (remainingValues.length !== 5) {
      analyzer.report(`MIDI command '${command}' expects five parameters`, directive);
      return null;
    }
    for (let i = 0; i < 5; i++) {
      const token = remainingValues[i];
      if (!isToken(token) || token.type !== TT.NUMBER) {
        analyzer.report(`MIDI command '${command}' expects five integer parameters`, directive);
        return null;
      }
      params.push(parseInt(token.lexeme, 10));
    }
  } else if (midiCmdParam1String1Integer.includes(command)) {
    // One string and one integer parameter expected
    if (remainingValues.length !== 2) {
      analyzer.report(`MIDI command '${command}' expects two parameters`, directive);
      return null;
    }
    const stringToken = remainingValues[0];
    const intToken = remainingValues[1];
    if (!isToken(stringToken) || stringToken.type !== TT.IDENTIFIER) {
      analyzer.report(`MIDI command '${command}' expects one string and one integer parameter`, directive);
      return null;
    }
    // Because portamento only accepts "on" or "off", we validate strictly
    const stringValue = stringToken.lexeme.toLowerCase();
    if (stringValue !== "on" && stringValue !== "off") {
      analyzer.report(`MIDI command '${command}' expects 'on' or 'off' as first parameter`, directive);
      return null;
    }
    if (!isToken(intToken) || intToken.type !== TT.NUMBER) {
      analyzer.report(`MIDI command '${command}' expects one string and one integer parameter`, directive);
      return null;
    }
    params.push(stringToken.lexeme);
    params.push(parseInt(intToken.lexeme, 10));
  } else if (midiCmdParam1Integer1OptionalInteger.includes(command)) {
    // One integer and one optional integer parameter expected
    if (remainingValues.length !== 1 && remainingValues.length !== 2) {
      analyzer.report(`MIDI command '${command}' expects one or two parameters`, directive);
      return null;
    }
    const token1 = remainingValues[0];
    if (!isToken(token1) || token1.type !== TT.NUMBER) {
      analyzer.report(`MIDI command '${command}' expects integer parameter`, directive);
      return null;
    }
    params.push(parseInt(token1.lexeme, 10));

    if (remainingValues.length === 2) {
      const token2 = remainingValues[1];
      if (!isToken(token2) || token2.type !== TT.NUMBER) {
        analyzer.report(`MIDI command '${command}' expects integer parameter`, directive);
        return null;
      }
      params.push(parseInt(token2.lexeme, 10));
    }
  } else if (midiCmdParamFraction.includes(command)) {
    // Fraction parameter expected (e.g., 3/4)
    // Because the parser creates Rational objects when it sees number/number,
    // we expect a single Rational object in remainingValues
    if (remainingValues.length !== 1) {
      analyzer.report(`MIDI command '${command}' expects fraction parameter (e.g., 3/4)`, directive);
      return null;
    }

    const value = remainingValues[0];

    // Check if it's a Rational object
    if (!(value instanceof Rational)) {
      analyzer.report(`MIDI command '${command}' expects fraction parameter (e.g., 3/4)`, directive);
      return null;
    }

    // Extract numerator and denominator from the Rational AST node
    const numerator = value.numerator;
    const denominator = value.denominator;

    // Validate that both are numbers
    if (!isToken(numerator) || numerator.type !== TT.NUMBER) {
      analyzer.report(`MIDI command '${command}' expects fraction parameter (e.g., 3/4)`, directive);
      return null;
    }
    if (!isToken(denominator) || denominator.type !== TT.NUMBER) {
      analyzer.report(`MIDI command '${command}' expects fraction parameter (e.g., 3/4)`, directive);
      return null;
    }

    // Convert to IRational format
    const num = parseInt(numerator.lexeme, 10);
    const denom = parseInt(denominator.lexeme, 10);
    params.push({ numerator: num, denominator: denom } as IRational);
  } else if (midiCmdParam1Integer1OptionalString.includes(command)) {
    // One integer and one optional octave=N parameter expected
    // Because the parser creates KV objects for key=value patterns,
    // we expect either 1 parameter (program number) or 2 parameters (program number + KV object)
    if (remainingValues.length !== 1 && remainingValues.length !== 2) {
      analyzer.report(`MIDI command '${command}' expects one or two parameters`, directive);
      return null;
    }

    // First parameter: program number (integer)
    const progToken = remainingValues[0];
    if (!isToken(progToken) || progToken.type !== TT.NUMBER) {
      analyzer.report(`MIDI command '${command}' expects integer program number`, directive);
      return null;
    }
    params.push(parseInt(progToken.lexeme, 10));

    // Second parameter (optional): octave=N
    if (remainingValues.length === 2) {
      const octaveParam = remainingValues[1];

      // Because the parser creates KV objects for octave=N patterns,
      // we check if it's a KV object
      if (octaveParam instanceof KV) {
        const kv = octaveParam as KV;

        // Validate key is "octave" (case-insensitive)
        if (!kv.key || !isToken(kv.key)) {
          analyzer.report(`MIDI command '${command}' expects octave=N format`, directive);
          return null;
        }

        const keyName = (kv.key as Token).lexeme.toLowerCase();
        if (keyName !== "octave") {
          analyzer.report(`MIDI command '${command}' expects octave=N format`, directive);
          return null;
        }

        // Validate value is a number
        if (!isToken(kv.value) || kv.value.type !== TT.NUMBER) {
          analyzer.report(`MIDI command '${command}' expects octave=N format`, directive);
          return null;
        }

        let octave = parseInt((kv.value as Token).lexeme, 10);

        // Validate octave range and clamp if out of range
        if (octave < -1) {
          analyzer.report(`Octave value must be between -1 and 3 (got ${octave}, clamping to -1)`, directive);
          octave = -1;
        } else if (octave > 3) {
          analyzer.report(`Octave value must be between -1 and 3 (got ${octave}, clamping to 3)`, directive);
          octave = 3;
        }

        params.push(octave);
      } else {
        analyzer.report(`MIDI command '${command}' expects octave=N format`, directive);
        return null;
      }
    }
  } else if (command === "drummap") {
    // Special case: drummap accepts 2 or 3 tokens
    // 2 tokens: note midi_number (e.g., "C 36")
    // 3 tokens: accidental note midi_number (e.g., "^ F 42")
    // Because the scanner tokenizes accidentals as separate tokens,
    // we need to handle both formats and concatenate the accidental with the note.
    if (remainingValues.length === 2) {
      const noteToken = remainingValues[0];
      const midiToken = remainingValues[1];

      if (!isToken(noteToken) || !isToken(midiToken) || midiToken.type !== TT.NUMBER) {
        analyzer.report("MIDI drummap expects note name and MIDI number", directive);
        return null;
      }

      params.push(noteToken.lexeme);
      params.push(parseInt(midiToken.lexeme, 10));
    } else if (remainingValues.length === 3) {
      // Format: accidental note midi_number (e.g., ^ F 42)
      // Because the 3-token format requires accidental + note + midi_number,
      // we need to validate that the second token is a note name (not a number).
      const acciToken = remainingValues[0];
      const noteToken = remainingValues[1];
      const midiToken = remainingValues[2];

      if (!isToken(acciToken) || !isToken(noteToken) || noteToken.type === TT.NUMBER || !isToken(midiToken) || midiToken.type !== TT.NUMBER) {
        analyzer.report("MIDI drummap expects note name and MIDI number", directive);
        return null;
      }

      // Combine accidental and note
      params.push(acciToken.lexeme + noteToken.lexeme);
      params.push(parseInt(midiToken.lexeme, 10));
    } else {
      // Because drummap only accepts 2 or 3 parameters, we report an error for any other count
      analyzer.report("MIDI drummap expects two or three parameters: note and MIDI number", directive);
      return null;
    }
  } else if (midiCmdParam1StringVariableIntegers.includes(command)) {
    // One string parameter followed by variable number of integers (at least 1)
    // Because drum and chordname define patterns/chords with arbitrary length,
    // we need to validate at least one integer is present after the string.
    if (remainingValues.length < 2) {
      analyzer.report(`MIDI command '${command}' expects string parameter and at least one integer parameter`, directive);
      return null;
    }

    // First parameter: string (must NOT be a number)
    const stringToken = remainingValues[0];
    if (!isToken(stringToken) || stringToken.type === TT.NUMBER) {
      analyzer.report(`MIDI command '${command}' expects string parameter`, directive);
      return null;
    }
    params.push(stringToken.lexeme);

    // Remaining parameters: integers
    for (let i = 1; i < remainingValues.length; i++) {
      const token = remainingValues[i];
      if (!isToken(token) || token.type !== TT.NUMBER) {
        analyzer.report(`MIDI command '${command}' expects integer parameters after string`, directive);
        return null;
      }
      params.push(parseInt(token.lexeme, 10));
    }
  } else {
    // Unknown MIDI command
    analyzer.report(`Unknown MIDI command: ${command}`, directive);
    return null;
  }

  return {
    type: "midi",
    data: {
      command: command,
      params: params,
    },
  };
}

/**
 * Parses %%percmap directive (note mapping for percussion)
 *
 * Because the percmap directive maps ABC notes to MIDI percussion sounds,
 * we need to validate that the drum sound is either a valid MIDI number (35-81)
 * or a recognized drum sound name from the DRUM_SOUND_NAMES array.
 *
 * Syntax: %%percmap <abc-note> <drum-sound> [note-head]
 */
function parsePercmap(directive: Directive, analyzer: SemanticAnalyzer): DirectiveSemanticData | null {
  // Because percmap expects 2 or 3 parameters (note, sound, optional note head),
  // we need to validate the parameter count first.
  if (directive.values.length < 2 || directive.values.length > 3) {
    analyzer.report("percmap directive expects 2 or 3 parameters: abc-note, drum-sound, [note-head]", directive);
    return null;
  }

  // Extract the ABC note (first parameter)
  const noteToken = directive.values[0];
  if (!isToken(noteToken)) {
    analyzer.report("percmap expects ABC note as first parameter", directive);
    return null;
  }
  const note = noteToken.lexeme;

  // Parse the drum sound (second parameter)
  // Because the drum sound can be either a MIDI number or a drum name,
  // we need to check the token type and validate accordingly.
  const soundToken = directive.values[1];
  if (!isToken(soundToken)) {
    analyzer.report("percmap expects drum sound as second parameter", directive);
    return null;
  }

  let sound: number;

  // Because the sound token might be a number, we try to parse it as a MIDI number first
  if (soundToken.type === TT.NUMBER) {
    const midiNum = parseInt(soundToken.lexeme, 10);
    if (midiNum < 35 || midiNum > 81) {
      analyzer.report(`MIDI percussion sound must be between 35 and 81 (got ${midiNum})`, directive);
      return null;
    }
    sound = midiNum;
  } else {
    // Because the sound is not a number, we try to match it as a drum name
    const drumName = soundToken.lexeme.toLowerCase();
    const drumIndex = DRUM_SOUND_NAMES.indexOf(drumName as DrumSoundName);

    if (drumIndex === -1) {
      analyzer.report(`Unknown drum sound name: ${soundToken.lexeme}`, directive);
      return null;
    }

    // Because drum names are indexed starting at 0 and map to MIDI notes starting at 35,
    // we need to add 35 to convert the array index to the MIDI note number.
    sound = drumIndex + 35;
  }

  // Extract optional note head (third parameter)
  let noteHead: string | undefined;
  if (directive.values.length === 3) {
    const headToken = directive.values[2];
    if (!isToken(headToken)) {
      analyzer.report("percmap expects note head style as third parameter", directive);
      return null;
    }
    noteHead = headToken.lexeme;
  }

  return {
    type: "percmap",
    data: {
      note: note,
      sound: sound,
      noteHead: noteHead,
    },
  };
}

/**
 * Parses %%deco directive (decoration definition)
 *
 * Because custom decorations require complex PostScript processing that is typically not supported,
 * we parse and store the decoration name and definition but report a warning that the feature
 * is not fully implemented. This matches the abcjs reference behavior.
 *
 * Syntax: %%deco <name> <definition>
 * Reference: abcjs abc_parse_directive.js lines 963-967
 */
function parseDeco(directive: Directive, analyzer: SemanticAnalyzer): DirectiveSemanticData | null {
  // Because the decoration name is mandatory, we validate that at least one parameter exists
  if (directive.values.length === 0) {
    analyzer.report("deco directive requires a decoration name", directive);
    return null;
  }

  // Extract the decoration name (first parameter must be an identifier)
  const nameToken = directive.values[0];
  if (!isToken(nameToken) || nameToken.type !== TT.IDENTIFIER) {
    analyzer.report("deco directive expects decoration name as first parameter", directive);
    return null;
  }

  const name = nameToken.lexeme;
  let definition: string | undefined;

  // Because the definition is optional, we collect remaining tokens if present
  if (directive.values.length > 1) {
    const defParts: string[] = [];
    for (let i = 1; i < directive.values.length; i++) {
      const value = directive.values[i];
      if (isToken(value)) {
        defParts.push(value.lexeme);
      } else if (value instanceof Annotation) {
        defParts.push(value.text.lexeme);
      }
    }
    definition = defParts.join(" ");
  }

  // Because decoration redefinition requires PostScript processing that is not implemented,
  // we report an informational warning matching the abcjs behavior
  analyzer.report("Decoration redefinition is parsed but not fully implemented", directive);

  return {
    type: "deco",
    data: {
      name: name,
      definition: definition,
    },
  };
}

/**
 * Parses annotation directives (quoted string or plain text)
 * Note: Quotes are preserved to match abcjs behavior
 */
function parseAnnotation(directive: Directive, analyzer: SemanticAnalyzer): DirectiveSemanticData | null {
  if (directive.values.length === 0) {
    analyzer.report(`Directive "${directive.key.lexeme}" expects a text parameter`, directive);
    return null;
  }

  const textParts: string[] = [];

  // Collect text from all values (parser may split into multiple tokens)
  for (const value of directive.values) {
    if (value instanceof Annotation) {
      textParts.push(value.text.lexeme);
    } else if (value instanceof Token) {
      textParts.push(value.lexeme);
    } else {
      analyzer.report(`Directive "${directive.key.lexeme}" contains invalid value type`, directive);
      return null;
    }
  }

  return {
    type: directive.key.lexeme as any,
    data: textParts.join(" "),
  };
}

/**
 * Parses %%begintext directive (multi-line text block)
 */
function parseBeginText(directive: Directive, analyzer: SemanticAnalyzer): DirectiveSemanticData | null {
  if (directive.values.length === 0) {
    analyzer.report(`Directive "${directive.key.lexeme}" expects text content`, directive);
    return null;
  }

  // The value should be a single FREE_TXT token containing all the text
  const value = directive.values[0];
  if (!(value instanceof Token)) {
    analyzer.report(`Directive "${directive.key.lexeme}" contains invalid value type`, directive);
    return null;
  }

  return {
    type: "begintext",
    data: value.lexeme,
  };
}
