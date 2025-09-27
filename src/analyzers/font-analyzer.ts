/**
 * Font Directive Semantic Analyzer
 *
 * Analyzes font-related directives and converts them to typed semantic data.
 * Supports all font directives: titlefont, gchordfont, composerfont, etc.
 */

import { Directive } from "../types/Expr2";
import { FontSpec, DIRECTIVE_SPECS, DirectiveSemanticData, ParamSpec } from "../types/directive-specs";
import { Token, TT } from "../parsers/scan2";
import { SemanticAnalyzer } from "./semantic-analyzer";

/**
 * Validates that a directive has a valid key and returns the directive spec
 * @param directive The directive to validate
 * @param analyzer The semantic analyzer for error reporting
 * @returns The directive spec if valid, null otherwise
 */
function isDirectiveKey(directive: Directive, analyzer: SemanticAnalyzer): { params: ParamSpec[] } | null {
  const directiveName = directive.key;
  if (!directiveName) {
    analyzer.report("Missing directive name", directive.id);
    return null;
  }

  const spec = DIRECTIVE_SPECS[directiveName.lexeme];
  if (!spec) {
    analyzer.report(`Unknown directive: ${directiveName.lexeme}`, directive.id, directive.key);
    return null;
  }

  return spec;
}

/**
 * Parses a numeric token and validates it as a positive number
 */
function parseNumber(
  value: Token,
  directive: Directive,
  analyzer: SemanticAnalyzer,
  context: { hasExplicitSize: boolean; hasErrors: boolean }
): number | null {
  if (!(value.type === TT.NUMBER)) return null;
  const lexeme = value.lexeme.toLowerCase();
  const size = parseFloat(lexeme);

  if (!isNaN(size) && size > 0) {
    context.hasExplicitSize = true;
    return size;
  } else {
    analyzer.report(`Invalid font size: ${lexeme}`, directive.id, value);
    context.hasErrors = true;
    return null;
  }
}

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
export function analyzeFontSpec(directive: Directive, analyzer: SemanticAnalyzer): DirectiveSemanticData | null {
  const spec = isDirectiveKey(directive, analyzer);
  if (!spec) return null;

  const result: FontSpec = {};

  // Track what we've parsed to handle the flexible font syntax
  let ctx = { hasExplicitSize: false, hasErrors: false, hasExplicitFace: false };

  for (let i = 0; i < directive.values.length; i++) {
    const value = directive.values[i];

    if (!(value instanceof Token)) {
      analyzer.report(`Expected token, got ${typeof value}`, directive.id);
      ctx.hasErrors = true;
      continue;
    }

    const lexeme = value.lexeme.toLowerCase();

    // Handle special cases first
    if (lexeme === "*") {
      // Asterisk means "keep current font face"
      ctx.hasExplicitFace = true;
      continue;
    }

    if (lexeme.toLowerCase() === "utf8") {
      // UTF-8 specifier - ignore but mark as processed
      continue;
    }

    // Handle modifiers
    if (["bold", "italic", "underline"].includes(lexeme)) {
      switch (lexeme) {
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
    if (lexeme === "box") {
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
      ].includes(directive.key.lexeme);

      if (supportsBox) {
        result.box = true;
      } else {
        analyzer.report(`Font type "${directive.key.lexeme}" does not support "box" parameter`, directive.id, value);
        ctx.hasErrors = true;
      }
      continue;
    }

    const size = parseNumber(value, directive, analyzer, ctx);
    if (size === null) continue;
    result.size = size;

    // Handle font face (anything else that's not a number or keyword)
    if (!ctx.hasExplicitFace && !ctx.hasExplicitSize) {
      // This must be a font face
      let fontFace = lexeme;

      // Remove quotes if present
      if ((fontFace.startsWith('"') && fontFace.endsWith('"')) || (fontFace.startsWith("'") && fontFace.endsWith("'"))) {
        fontFace = fontFace.slice(1, -1);
      }

      result.face = fontFace;
      ctx.hasExplicitFace = true;
      continue;
    }

    // If we get here, it's an unrecognized parameter
    analyzer.report(`Unrecognized font parameter: ${lexeme}`, directive.id, value);
    ctx.hasErrors = true;
  }

  // Set defaults for unspecified properties
  if (result.weight === undefined) result.weight = "normal";
  if (result.style === undefined) result.style = "normal";
  if (result.decoration === undefined) result.decoration = "none";

  // Validate that we have at least some meaningful content
  if (!result.face && !result.size && !result.weight && !result.style && !result.decoration && !result.box) {
    analyzer.report("Font directive has no meaningful parameters", directive.id);
    ctx.hasErrors = true;
  }

  // If there were errors, don't push semantic data
  if (ctx.hasErrors) {
    return null;
  }

  // Create and push semantic data
  const semanticData: DirectiveSemanticData = {
    type: directive.key.lexeme as any, // Type assertion needed for tagged union
    data: result,
  };

  analyzer.data.set(directive.id, semanticData);
  return semanticData;
}
