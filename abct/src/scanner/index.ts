/**
 * ABCT Scanner Public API
 */

// Main scanner function
export { scan, scanProgram, ScanResult } from "./scanner";

// Context for advanced usage
export { AbctCtx, createCtx, ScannerError } from "./context";

// Token types and Token class
export { AbctTT, Token, SourceLocation } from "./types";

// Utility functions for advanced usage
export { isAtEnd, advance, peek, peekNext, consume, matchPattern, newLine } from "./utils";

// Primitive scanner functions for composition
export {
  identifier,
  number,
  string,
  abcLiteral,
  operator,
  collectInvalid,
} from "./primitives";

// Whitespace scanner functions
export { WS, EOL, comment } from "./whitespace";
