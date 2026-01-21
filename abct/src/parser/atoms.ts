/**
 * ABCT Parser Atom Functions
 *
 * Parses atomic expressions: identifiers, numbers, strings, ABC literals,
 * lists, grouped expressions, selectors, voice refs, file refs, and location selectors.
 */

import { AbctParseCtx, tokenToLoc, spanLoc } from "./context";
import { AbctTT, Token } from "../scanner";
import {
  peek,
  advance,
  check,
  checkAny,
  match,
  tryConsume,
  skipWS,
  isAtEnd,
  previous,
  ParseException,
} from "./utils";
import {
  Expr,
  Identifier,
  NumberLiteral,
  AbcLiteral,
  List,
  Group,
  Selector,
  SelectorPath,
  VoiceRef,
  FileRef,
  LocationSelector,
  Loc,
  ErrorExpr,
  Range,
  Location,
  RangeEnd,
} from "../ast";

/**
 * Parse an identifier
 */
export function parseIdentifier(ctx: AbctParseCtx): Identifier {
  const token = advance(ctx);
  return {
    type: "identifier",
    name: token.lexeme,
    loc: tokenToLoc(token),
  };
}

/**
 * Parse a number literal (integer, decimal, or fraction)
 */
export function parseNumberLiteral(ctx: AbctParseCtx): NumberLiteral {
  const token = advance(ctx);
  return {
    type: "number",
    value: token.lexeme,
    loc: tokenToLoc(token),
  };
}

/**
 * Parse location from ABC fence open lexeme
 * Format: ```abc :line or :line:col or :line:col-endCol or :line:col-endLine:endCol
 */
function parseLocationFromFence(lexeme: string): Location | undefined {
  // Pattern: ```abc :line:col-endLine:endCol (all parts after :line are optional)
  // Note: The range part (-endCol or -endLine:endCol) is nested inside the col part,
  // so a range requires a column to be specified first.
  const match = lexeme.match(
    /^[ \t]*```abc(?: :(\d+)(?::(\d+)(?:-(\d+)(?::(\d+))?)?)?)?/
  );
  if (!match || !match[1]) {
    return undefined; // No location specified
  }

  const line = parseInt(match[1], 10);
  const col = match[2] ? parseInt(match[2], 10) : undefined;

  let end: RangeEnd | undefined;
  if (match[3]) {
    if (match[4]) {
      // Multi-line range: :line:col-endLine:endCol
      end = {
        type: "multiline",
        endLine: parseInt(match[3], 10),
        endCol: parseInt(match[4], 10),
      };
    } else {
      // Single-line range: :line:col-endCol
      end = {
        type: "singleline",
        endCol: parseInt(match[3], 10),
      };
    }
  }

  return { line, col, end };
}

/**
 * Parse an ABC fence literal: ```abc ... ```
 */
export function parseAbcLiteral(ctx: AbctParseCtx): AbcLiteral {
  const openToken = advance(ctx); // ABC_FENCE_OPEN
  let content = "";

  // If there's ABC_CONTENT content
  if (check(ctx, AbctTT.ABC_CONTENT)) {
    content = advance(ctx).lexeme;
  }

  // Expect closing fence
  if (!match(ctx, AbctTT.ABC_FENCE_CLOSE)) {
    ctx.error("Expected '```' to close ABC literal");
  }
  const closeToken = previous(ctx);

  // Parse optional location from fence lexeme
  const location = parseLocationFromFence(openToken.lexeme);

  return {
    type: "abc_literal",
    content,
    location,
    loc: spanLoc(openToken, closeToken),
  };
}

/**
 * Parse a list: [item1, item2, ...]
 */
export function parseList(
  ctx: AbctParseCtx,
  parseExpr: (ctx: AbctParseCtx) => Expr
): List {
  const openToken = advance(ctx); // [
  const items: Expr[] = [];

  skipWS(ctx);

  // Empty list
  if (check(ctx, AbctTT.RBRACKET)) {
    const closeToken = advance(ctx);
    return {
      type: "list",
      items: [],
      loc: spanLoc(openToken, closeToken),
    };
  }

  // First item
  items.push(parseExpr(ctx));
  skipWS(ctx);

  // Additional items
  while (match(ctx, AbctTT.COMMA)) {
    skipWS(ctx);
    items.push(parseExpr(ctx));
    skipWS(ctx);
  }

  // Expect ]
  if (!match(ctx, AbctTT.RBRACKET)) {
    ctx.error("Expected ']' to close list");
  }
  const closeToken = previous(ctx);

  return {
    type: "list",
    items,
    loc: spanLoc(openToken, closeToken),
  };
}

/**
 * Parse a grouped expression: (expr)
 */
export function parseGroup(
  ctx: AbctParseCtx,
  parseExpr: (ctx: AbctParseCtx) => Expr
): Group {
  const openToken = advance(ctx); // (
  skipWS(ctx);

  // Allow newlines inside parentheses
  while (check(ctx, AbctTT.EOL)) {
    advance(ctx);
    skipWS(ctx);
  }

  const expr = parseExpr(ctx);

  skipWS(ctx);
  while (check(ctx, AbctTT.EOL)) {
    advance(ctx);
    skipWS(ctx);
  }

  // Expect )
  if (!match(ctx, AbctTT.RPAREN)) {
    ctx.error("Expected ')' to close grouped expression");
  }
  const closeToken = previous(ctx);

  return {
    type: "group",
    expr,
    openLoc: tokenToLoc(openToken),
    closeLoc: tokenToLoc(closeToken),
    loc: spanLoc(openToken, closeToken),
  };
}

/**
 * Parse a selector: @path or @path:value
 */
export function parseSelector(ctx: AbctParseCtx): Selector {
  const atToken = advance(ctx); // @
  skipWS(ctx);

  const path = parseSelectorPath(ctx);

  return {
    type: "selector",
    atLoc: tokenToLoc(atToken),
    path,
    loc: {
      start: tokenToLoc(atToken).start,
      end: path.valueLoc ? path.valueLoc.end : path.idLoc.end,
    },
  };
}

/**
 * Parse a selector path: id or id:value
 */
export function parseSelectorPath(ctx: AbctParseCtx): SelectorPath {
  if (!check(ctx, AbctTT.IDENTIFIER)) {
    ctx.error("Expected identifier in selector path");
    throw new ParseException("Expected identifier", peek(ctx));
  }

  const idToken = advance(ctx);
  const idLoc = tokenToLoc(idToken);

  // Check for :value
  if (!match(ctx, AbctTT.COLON)) {
    return {
      id: idToken.lexeme,
      idLoc,
    };
  }

  skipWS(ctx);

  // Value can be identifier, number, negative number, or range
  if (check(ctx, AbctTT.IDENTIFIER)) {
    const valueToken = advance(ctx);
    return {
      id: idToken.lexeme,
      idLoc,
      value: valueToken.lexeme,
      valueLoc: tokenToLoc(valueToken),
    };
  }

  // Handle negative numbers: -N
  if (check(ctx, AbctTT.MINUS)) {
    const minusToken = advance(ctx);
    if (check(ctx, AbctTT.NUMBER)) {
      const numToken = advance(ctx);
      const value = -parseInt(numToken.lexeme, 10);
      return {
        id: idToken.lexeme,
        idLoc,
        value,
        valueLoc: spanLoc(minusToken, numToken),
      };
    }
    // Minus not followed by number - error
    ctx.error("Expected number after '-' in selector value");
    throw new ParseException("Expected number", peek(ctx));
  }

  if (check(ctx, AbctTT.NUMBER)) {
    const startToken = advance(ctx);
    const startValue = parseInt(startToken.lexeme, 10);

    // Check for range: N-M
    if (match(ctx, AbctTT.MINUS)) {
      if (check(ctx, AbctTT.NUMBER)) {
        const endToken = advance(ctx);
        const endValue = parseInt(endToken.lexeme, 10);
        const range: Range = {
          type: "range",
          start: startValue,
          end: endValue,
        };
        return {
          id: idToken.lexeme,
          idLoc,
          value: range,
          valueLoc: spanLoc(startToken, endToken),
        };
      }
      // Incomplete range: N- without end number
      ctx.error("Expected number after '-' in range");
      throw new ParseException("Expected number", peek(ctx));
    }

    return {
      id: idToken.lexeme,
      idLoc,
      value: startValue,
      valueLoc: tokenToLoc(startToken),
    };
  }

  ctx.error("Expected identifier, number, or range in selector value");
  throw new ParseException("Expected value", peek(ctx));
}

/**
 * Parse a voice reference: V:name or V:number
 */
export function parseVoiceRef(ctx: AbctParseCtx): VoiceRef {
  const typeToken = advance(ctx); // e.g., V

  if (!match(ctx, AbctTT.COLON)) {
    ctx.error("Expected ':' in voice reference");
    throw new ParseException("Expected ':'", peek(ctx));
  }

  skipWS(ctx);

  let name: string | number;
  let nameLoc: Loc;

  if (check(ctx, AbctTT.IDENTIFIER)) {
    const nameToken = advance(ctx);
    name = nameToken.lexeme;
    nameLoc = tokenToLoc(nameToken);
  } else if (check(ctx, AbctTT.NUMBER)) {
    const nameToken = advance(ctx);
    name = parseInt(nameToken.lexeme, 10);
    nameLoc = tokenToLoc(nameToken);
  } else {
    ctx.error("Expected identifier or number in voice reference");
    throw new ParseException("Expected name", peek(ctx));
  }

  return {
    type: "voice_ref",
    voiceType: typeToken.lexeme,
    typeLoc: tokenToLoc(typeToken),
    name,
    nameLoc,
    loc: spanLoc(typeToken, previous(ctx)),
  };
}

/**
 * Parse a location selector: :line or :line:col or :line:col-end
 */
export function parseLocationSelector(ctx: AbctParseCtx): LocationSelector {
  const colonToken = advance(ctx); // :

  if (!check(ctx, AbctTT.NUMBER)) {
    ctx.error("Expected line number in location selector");
    throw new ParseException("Expected number", peek(ctx));
  }

  const lineToken = advance(ctx);
  const line = parseInt(lineToken.lexeme, 10);
  let col: number | undefined;
  let end: RangeEnd | undefined;
  let lastToken = lineToken;

  // Check for :col
  if (match(ctx, AbctTT.COLON)) {
    if (check(ctx, AbctTT.NUMBER)) {
      const colToken = advance(ctx);
      col = parseInt(colToken.lexeme, 10);
      lastToken = colToken;

      // Check for range end: -endCol or -endLine:endCol
      if (match(ctx, AbctTT.MINUS)) {
        if (check(ctx, AbctTT.NUMBER)) {
          const endToken1 = advance(ctx);
          const endVal1 = parseInt(endToken1.lexeme, 10);
          lastToken = endToken1;

          // Check for :endCol (multi-line range)
          if (match(ctx, AbctTT.COLON)) {
            if (check(ctx, AbctTT.NUMBER)) {
              const endToken2 = advance(ctx);
              const endVal2 = parseInt(endToken2.lexeme, 10);
              lastToken = endToken2;
              end = {
                type: "multiline",
                endLine: endVal1,
                endCol: endVal2,
              };
            }
          } else {
            // Single-line range
            end = {
              type: "singleline",
              endCol: endVal1,
            };
          }
        }
      }
    }
  }

  return {
    type: "location_selector",
    line,
    col,
    end,
    loc: spanLoc(colonToken, lastToken),
  };
}

/**
 * Parse a file reference: path.ext or path.ext:loc or path.ext@selector
 */
export function parseFileRef(ctx: AbctParseCtx): FileRef {
  // Collect the full path including dots
  const pathParts: Token[] = [];
  pathParts.push(advance(ctx)); // first identifier

  // Collect .segment parts
  while (check(ctx, AbctTT.DOT)) {
    pathParts.push(advance(ctx)); // .
    if (check(ctx, AbctTT.IDENTIFIER)) {
      pathParts.push(advance(ctx)); // segment
    } else {
      break;
    }
  }

  const path = pathParts.map((t) => t.lexeme).join("");
  const pathLoc = spanLoc(pathParts[0], pathParts[pathParts.length - 1]);

  let location: Location | null = null;
  let locationLoc: Loc | null = null;
  let selector: SelectorPath | null = null;

  // Check for :location
  if (check(ctx, AbctTT.COLON)) {
    const colonToken = peek(ctx);
    advance(ctx);

    if (check(ctx, AbctTT.NUMBER)) {
      const locSelector = parseLocationValue(ctx);
      location = locSelector.value;
      locationLoc = spanLoc(colonToken, previous(ctx));
    }
  }

  // Check for @selector
  if (match(ctx, AbctTT.AT)) {
    selector = parseSelectorPath(ctx);
  }

  const lastToken = selector
    ? previous(ctx)
    : locationLoc
      ? previous(ctx)
      : pathParts[pathParts.length - 1];

  return {
    type: "file_ref",
    path,
    pathLoc,
    location,
    locationLoc,
    selector,
    loc: spanLoc(pathParts[0], lastToken),
  };
}

/**
 * Parse a location value (used in file refs)
 */
function parseLocationValue(ctx: AbctParseCtx): { value: Location; loc: Loc } {
  const startToken = peek(ctx);
  const lineToken = advance(ctx);
  const line = parseInt(lineToken.lexeme, 10);
  let col: number | undefined;
  let end: RangeEnd | undefined;
  let lastToken = lineToken;

  // Check for :col
  if (match(ctx, AbctTT.COLON)) {
    if (check(ctx, AbctTT.NUMBER)) {
      const colToken = advance(ctx);
      col = parseInt(colToken.lexeme, 10);
      lastToken = colToken;

      // Check for range end
      if (match(ctx, AbctTT.MINUS)) {
        if (check(ctx, AbctTT.NUMBER)) {
          const endToken1 = advance(ctx);
          const endVal1 = parseInt(endToken1.lexeme, 10);
          lastToken = endToken1;

          if (match(ctx, AbctTT.COLON)) {
            if (check(ctx, AbctTT.NUMBER)) {
              const endToken2 = advance(ctx);
              const endVal2 = parseInt(endToken2.lexeme, 10);
              lastToken = endToken2;
              end = {
                type: "multiline",
                endLine: endVal1,
                endCol: endVal2,
              };
            }
          } else {
            end = {
              type: "singleline",
              endCol: endVal1,
            };
          }
        }
      }
    }
  }

  return {
    value: { line, col, end },
    loc: spanLoc(startToken, lastToken),
  };
}

/**
 * Check if current position starts a file reference
 * (identifier followed by dot and another identifier)
 */
export function isFileRef(ctx: AbctParseCtx): boolean {
  if (!check(ctx, AbctTT.IDENTIFIER)) return false;

  // Look ahead for pattern: IDENTIFIER DOT IDENTIFIER
  const current = ctx.current;
  let pos = current + 1;

  // Skip whitespace
  while (
    pos < ctx.tokens.length &&
    ctx.tokens[pos].type === AbctTT.WS
  ) {
    pos++;
  }

  // Check for DOT
  if (pos >= ctx.tokens.length || ctx.tokens[pos].type !== AbctTT.DOT) {
    return false;
  }

  pos++;

  // Check for IDENTIFIER (extension)
  if (pos >= ctx.tokens.length || ctx.tokens[pos].type !== AbctTT.IDENTIFIER) {
    return false;
  }

  return true;
}

/**
 * Check if current position starts a voice reference
 * (identifier followed by colon and identifier/number, NOT a selector)
 */
export function isVoiceRef(ctx: AbctParseCtx): boolean {
  if (!check(ctx, AbctTT.IDENTIFIER)) return false;

  const current = ctx.current;
  let pos = current + 1;

  // Check for COLON
  if (pos >= ctx.tokens.length || ctx.tokens[pos].type !== AbctTT.COLON) {
    return false;
  }

  pos++;

  // Skip whitespace
  while (
    pos < ctx.tokens.length &&
    ctx.tokens[pos].type === AbctTT.WS
  ) {
    pos++;
  }

  // Check for IDENTIFIER or NUMBER
  if (pos >= ctx.tokens.length) return false;
  const nextType = ctx.tokens[pos].type;
  return nextType === AbctTT.IDENTIFIER || nextType === AbctTT.NUMBER;
}

/**
 * Create an error expression for recovery
 */
export function createErrorExpr(
  ctx: AbctParseCtx,
  message: string,
  partial?: Expr
): ErrorExpr {
  const token = peek(ctx);
  return {
    type: "error",
    message,
    partial,
    loc: tokenToLoc(token),
  };
}
