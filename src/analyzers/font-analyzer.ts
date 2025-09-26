/**
 * Font Directive Semantic Analyzer
 *
 * Analyzes font-related directives and converts them to typed semantic data.
 * Supports all font directives: titlefont, gchordfont, composerfont, etc.
 */

import { Directive } from "../types/Expr2";
import { FontSpec, DIRECTIVE_SPECS, DirectiveSemanticData } from "../types/directive-specs";
import { Token, TT } from "../parsers/scan2";
import { SemanticAnalyzer } from "./semantic-analyzer";

/**
 * Analyzes a font directive and pushes semantic data to context
 *
 * Font directives follow the pattern:
 * %%fontname [face] [utf8] [size] [modifiers...] [box]
 *
 * Where:
 * - face: Font name (can be quoted, or * to keep current)
 * - utf8: Optional "utf8" keyword (ignored)
 * - size: Font size in pixels
 * - modifiers: bold, italic, underline
 * - box: Optional "box" keyword for supported fonts
 */
export function analyzeFontDirective(directive: Directive, analyzer: SemanticAnalyzer): DirectiveSemanticData | null {
  const directiveName = directive.key!;
  if (!directiveName) {
    analyzer.report("Missing directive name", directive.id);
    return null;
  }

  const spec = DIRECTIVE_SPECS[directiveName.lexeme];
  if (!spec) {
    analyzer.report(`Unknown directive: ${directiveName.lexeme}`, directive.id, directive.key);
    return null;
  }

  const values = directive.values || [];
  const result: FontSpec = {};
  let hasErrors = false;

  // Track what we've parsed to handle the flexible font syntax
  let hasExplicitFace = false;
  let hasExplicitSize = false;

  for (let i = 0; i < values.length; i++) {
    const value = values[i];

    if (!(value instanceof Token)) {
      analyzer.report(`Expected token, got ${typeof value}`, directive.id);
      hasErrors = true;
      continue;
    }

    const token = value.lexeme;

    // Handle special cases first
    if (token === "*") {
      // Asterisk means "keep current font face"
      hasExplicitFace = true;
      continue;
    }

    if (token.toLowerCase() === "utf8") {
      // UTF-8 specifier - ignore but mark as processed
      continue;
    }

    // Handle modifiers
    if (["bold", "italic", "underline"].includes(token.toLowerCase())) {
      switch (token.toLowerCase()) {
        case "bold":
          result.weight = "bold";
          break;
        case "italic":
          result.style = "italic";
          break;
        case "underline":
          result.decoration = "underline";
          break;
      }
      continue;
    }

    // Handle box keyword (only for supported font types)
    if (token.toLowerCase() === "box") {
      const supportsBox = [
        "gchordfont",
        "measurefont",
        "partsfont",
        "annotationfont",
        "composerfont",
        "historyfont",
        "infofont",
        "subtitlefont",
        "textfont",
        "titlefont",
        "voicefont",
        "barlabelfont",
        "barnumberfont",
        "barnumfont",
      ].includes(directiveName.lexeme);

      if (supportsBox) {
        result.box = true;
      } else {
        analyzer.report(`Font type "${directiveName.lexeme}" does not support "box" parameter`, directive.id, value);
        hasErrors = true;
      }
      continue;
    }

    // Handle numeric size
    if (value.type === TT.NUMBER) {
      const size = parseFloat(token);
      if (!isNaN(size) && size > 0) {
        result.size = size;
        hasExplicitSize = true;
      } else {
        analyzer.report(`Invalid font size: ${token}`, directive.id, value);
        hasErrors = true;
      }
      continue;
    }

    // Handle font face (anything else that's not a number or keyword)
    if (!hasExplicitFace && !hasExplicitSize) {
      // This must be a font face
      let fontFace = token;

      // Remove quotes if present
      if ((fontFace.startsWith('"') && fontFace.endsWith('"')) || (fontFace.startsWith("'") && fontFace.endsWith("'"))) {
        fontFace = fontFace.slice(1, -1);
      }

      result.face = fontFace;
      hasExplicitFace = true;
      continue;
    }

    // If we get here, it's an unrecognized parameter
    analyzer.report(`Unrecognized font parameter: ${token}`, directive.id, value);
    hasErrors = true;
  }

  // Set defaults for unspecified properties
  if (result.weight === undefined) result.weight = "normal";
  if (result.style === undefined) result.style = "normal";
  if (result.decoration === undefined) result.decoration = "none";

  // Validate that we have at least some meaningful content
  if (!result.face && !result.size && !result.weight && !result.style && !result.decoration && !result.box) {
    analyzer.report("Font directive has no meaningful parameters", directive.id);
    hasErrors = true;
  }

  // If there were errors, don't push semantic data
  if (hasErrors) {
    return null;
  }

  // Create and push semantic data
  const semanticData: DirectiveSemanticData = {
    type: directiveName.lexeme as any, // Type assertion needed for tagged union
    data: result,
  };

  analyzer.data.set(directive.id, semanticData);
  return semanticData;
}
