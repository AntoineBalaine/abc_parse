/**
 * ABCT Parser - Public API
 *
 * Exports the main parse function and supporting types.
 */

// Main parse functions
export { parse, parseTokens, parseProgram, parseStatement, ParseResult } from "./parser";

// Expression parsing (for direct use/testing)
export {
  parseExpr,
  parsePipeline,
  parseConcatTerm,
  parseUpdateTerm,
  parseApplication,
  parseLogical,
  parseOr,
  parseAnd,
  parseNot,
  parseComparison,
  parseUnaryMinus,
  parseAtom,
  canStartAtom,
} from "./expressions";

// Atom parsing
export {
  parseIdentifier,
  parseNumberLiteral,
  parseAbcLiteral,
  parseList,
  parseGroup,
  parseSelector,
  parseSelectorPath,
  parseVoiceRef,
  parseFileRef,
  parseLocationSelector,
  isFileRef,
  isVoiceRef,
  createErrorExpr,
} from "./atoms";

// Context and utilities
export { AbctParseCtx, createParseCtx, tokenToLoc, spanLoc, ParseError } from "./context";
export {
  isAtEnd,
  peek,
  peekNext,
  previous,
  advance,
  check,
  checkAny,
  match,
  consume,
  tryConsume,
  skipWS,
  skipWSAndEOL,
} from "./utils";

// Error recovery
export {
  synchronize,
  synchronizeToStatement,
  synchronizeToClose,
  isAtRecoveryPoint,
  tryRecover,
} from "./recovery";
