/**
 * ABCx Module - Unified exports for ABCx chord sheet notation support
 *
 * ABCx is a simplified subset of ABC notation for chord sheet transcriptions.
 * It allows writing chord progressions without full musical notation.
 *
 * Architecture:
 *   ABCx source -> ScannerAbcx -> parseAbcx -> AbcxToAbcConverter -> ABC AST -> Formatter2 -> ABC string
 *
 * Usage:
 *   import { ScannerAbcx, parseAbcx, AbcxToAbcConverter, convertAbcxToAbc } from './abcx';
 */

// Scanner
export { ScannerAbcx, scanAbcxTuneBody } from "../parsers/scan_abcx_tunebody";

// Parser
export { parseAbcx } from "../parsers/parse_abcx";

// Converter
export {
  AbcxToAbcConverter,
  AbcxConversionConfig,
  convertAbcxToAbc,
  convertAbcxToAbcAst,
} from "../Visitors/AbcxToAbcConverter";

// AST Types (ChordSymbol is the ABCx-specific node type)
export { ChordSymbol } from "../types/Expr2";
