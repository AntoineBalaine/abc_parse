/**
 * ABCT Scanner Public API
 */

// Main scanner function
export { scan, scanProgram } from "./scanner";

// Context for advanced usage
export { AbctCtx, createCtx } from "./context";

// Token types and Token class
export { AbctTT, Token, SourceLocation } from "./types";

// Utility functions for advanced usage
export { isAtEnd, advance, peek, peekNext, consume, matchPattern, newLine } from "./utils";

// Primitive scanner functions for composition
export {
  identifier,
  number,
  string,
  abcFence,
  operator,
  collectInvalid,
  sanitizeAbcContent,
  desanitizeAbcContent,
} from "./primitives";

// Whitespace scanner functions
export { WS, EOL, comment } from "./whitespace";
