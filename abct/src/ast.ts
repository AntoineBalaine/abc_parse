// ABCT AST Type Definitions

// ============================================================================
// Source Location Types
// ============================================================================

/**
 * Position in source code. All values are 0-based.
 */
export interface Pos {
  /** 0-based line number */
  line: number;
  /** 0-based column number */
  column: number;
  /** 0-based byte offset from start of source */
  offset: number;
}

/**
 * Source location range in source code. All values are 0-based.
 */
export interface Loc {
  start: Pos;
  end: Pos;
}

// ============================================================================
// Program Structure
// ============================================================================

export interface Program {
  type: "program";
  statements: Statement[];
  loc: Loc;
}

export type Statement = Assignment | Expr;

export interface Assignment {
  type: "assignment";
  id: string;
  idLoc: Loc; // Location of the identifier (for variable highlighting)
  eqLoc: Loc; // Location of the = operator
  value: Expr;
  loc: Loc;
}

// ============================================================================
// Expressions
// ============================================================================

export type Expr =
  | Pipe
  | Concat
  | Update
  | Application
  | Or
  | And
  | Not
  | Negate
  | Comparison
  | FilterExpression
  | Selector
  | LocationSelector
  | VoiceRef
  | List
  | AbcLiteral
  | FileRef
  | NumberLiteral
  | Identifier
  | Group
  | ErrorExpr;

export interface Pipe {
  type: "pipe";
  left: Expr;
  opLoc: Loc; // Location of the | operator
  right: Expr;
  loc: Loc;
}

export interface Concat {
  type: "concat";
  left: Expr;
  opLoc: Loc; // Location of the + operator
  right: Expr;
  loc: Loc;
}

export interface Update {
  type: "update";
  selector: Selector | LocationSelector;
  opLoc: Loc; // Location of the |= operator
  transform: Expr;
  loc: Loc;
}

export interface Application {
  type: "application";
  terms: Expr[];
  loc: Loc;
}

// ============================================================================
// Logical and Comparison Operators
// ============================================================================

export interface Or {
  type: "or";
  left: Expr;
  kwLoc: Loc; // Location of the 'or' keyword
  right: Expr;
  loc: Loc;
}

export interface And {
  type: "and";
  left: Expr;
  kwLoc: Loc; // Location of the 'and' keyword
  right: Expr;
  loc: Loc;
}

export interface Not {
  type: "not";
  kwLoc: Loc; // Location of the 'not' keyword
  operand: Expr;
  loc: Loc;
}

export interface Negate {
  type: "negate";
  opLoc: Loc; // Location of the '-' operator
  operand: Expr;
  loc: Loc;
}

export type ComparisonOp = ">=" | "<=" | "==" | "!=" | ">" | "<";

export interface Comparison {
  type: "comparison";
  op: ComparisonOp;
  opLoc: Loc; // Location of the comparison operator
  left: Expr;
  right: Expr;
  loc: Loc;
}

/**
 * Filter expression: filter (predicate)
 * Removes elements from a selection that do not match the predicate.
 */
export interface FilterExpression {
  type: "filter";
  kwLoc: Loc; // Location of the 'filter' keyword
  predicate: Comparison;
  loc: Loc;
}

// ============================================================================
// Atoms
// ============================================================================

export interface Selector {
  type: "selector";
  atLoc: Loc; // Location of the @ symbol
  path: SelectorPath;
  loc: Loc;
}

export interface LocationSelector {
  type: "location_selector";
  line: number;
  col?: number;
  end?: RangeEnd;
  loc: Loc;
}

export interface SelectorPath {
  id: string;
  idLoc: Loc; // Location of the selector id
  value?: string | number | Range;
  valueLoc?: Loc; // Location of the value (if present)
}

export interface VoiceRef {
  type: "voice_ref";
  voiceType: string;
  typeLoc: Loc; // Location of the type (e.g., 'V')
  name: string | number;
  nameLoc: Loc; // Location of the name
  loc: Loc;
}

export interface List {
  type: "list";
  items: Expr[];
  loc: Loc;
}

export interface AbcLiteral {
  type: "abc_literal";
  content: string;
  location?: Location; // Optional target location from fence: ```abc :10:5
  loc: Loc;
}

export interface FileRef {
  type: "file_ref";
  path: string;
  pathLoc: Loc; // Location of the path
  location: Location | null;
  locationLoc: Loc | null; // Location of the :line:col part
  selector: SelectorPath | null;
  loc: Loc;
}

export interface NumberLiteral {
  type: "number";
  value: string; // String because it can be a fraction like "1/2"
  loc: Loc;
}

export interface Identifier {
  type: "identifier";
  name: string;
  loc: Loc;
}

/**
 * Grouped expression (parentheses)
 * Preserves user intent for precedence grouping
 */
export interface Group {
  type: "group";
  expr: Expr;
  openLoc: Loc; // Location of the ( token
  closeLoc: Loc; // Location of the ) token
  loc: Loc;
}

/**
 * Error expression for error recovery
 * Allows parser to continue after errors while preserving partial AST
 */
export interface ErrorExpr {
  type: "error";
  message: string;
  partial?: Expr; // Partial AST if available
  loc: Loc;
}

// ============================================================================
// Supporting Types
// ============================================================================

/**
 * Target location in an ABC file (for :line:col selectors in ABCT DSL).
 *
 * NOTE: This is different from Pos/Loc which represent source code positions.
 * - Pos/Loc: 0-based positions in ABCT source code (internal representation)
 * - Location: 1-based positions in target ABC files (user-visible DSL syntax)
 *
 * Values are 1-based because they appear in user-visible DSL syntax like:
 *   file.abc:10:5  or  :10:5-12:20
 */
export interface Location {
  /** 1-based line number in the target ABC file */
  line: number;
  /** 1-based column number (optional) */
  col?: number;
  end?: RangeEnd;
}

export type RangeEnd =
  | { type: "singleline"; endCol: number }
  | { type: "multiline"; endLine: number; endCol: number };

export interface Range {
  type: "range";
  start: number;
  end: number;
}

// ============================================================================
// Type Guards
// ============================================================================

export function isProgram(node: unknown): node is Program {
  return (
    typeof node === "object" &&
    node !== null &&
    (node as Program).type === "program"
  );
}

export function isAssignment(node: unknown): node is Assignment {
  return (
    typeof node === "object" &&
    node !== null &&
    (node as Assignment).type === "assignment"
  );
}

export function isPipe(node: unknown): node is Pipe {
  return (
    typeof node === "object" && node !== null && (node as Pipe).type === "pipe"
  );
}

export function isConcat(node: unknown): node is Concat {
  return (
    typeof node === "object" &&
    node !== null &&
    (node as Concat).type === "concat"
  );
}

export function isUpdate(node: unknown): node is Update {
  return (
    typeof node === "object" &&
    node !== null &&
    (node as Update).type === "update"
  );
}

export function isApplication(node: unknown): node is Application {
  return (
    typeof node === "object" &&
    node !== null &&
    (node as Application).type === "application"
  );
}

export function isSelector(node: unknown): node is Selector {
  return (
    typeof node === "object" &&
    node !== null &&
    (node as Selector).type === "selector"
  );
}

export function isLocationSelector(node: unknown): node is LocationSelector {
  return (
    typeof node === "object" &&
    node !== null &&
    (node as LocationSelector).type === "location_selector"
  );
}

export function isComparison(node: unknown): node is Comparison {
  return (
    typeof node === "object" &&
    node !== null &&
    (node as Comparison).type === "comparison"
  );
}

export function isIdentifier(node: unknown): node is Identifier {
  return (
    typeof node === "object" &&
    node !== null &&
    (node as Identifier).type === "identifier"
  );
}

export function isFileRef(node: unknown): node is FileRef {
  return (
    typeof node === "object" &&
    node !== null &&
    (node as FileRef).type === "file_ref"
  );
}

export function isAbcLiteral(node: unknown): node is AbcLiteral {
  return (
    typeof node === "object" &&
    node !== null &&
    (node as AbcLiteral).type === "abc_literal"
  );
}

export function isList(node: unknown): node is List {
  return (
    typeof node === "object" && node !== null && (node as List).type === "list"
  );
}

export function isNumberLiteral(node: unknown): node is NumberLiteral {
  return (
    typeof node === "object" &&
    node !== null &&
    (node as NumberLiteral).type === "number"
  );
}

export function isOr(node: unknown): node is Or {
  return (
    typeof node === "object" && node !== null && (node as Or).type === "or"
  );
}

export function isAnd(node: unknown): node is And {
  return (
    typeof node === "object" && node !== null && (node as And).type === "and"
  );
}

export function isNot(node: unknown): node is Not {
  return (
    typeof node === "object" && node !== null && (node as Not).type === "not"
  );
}

export function isNegate(node: unknown): node is Negate {
  return (
    typeof node === "object" &&
    node !== null &&
    (node as Negate).type === "negate"
  );
}

export function isVoiceRef(node: unknown): node is VoiceRef {
  return (
    typeof node === "object" &&
    node !== null &&
    (node as VoiceRef).type === "voice_ref"
  );
}

export function isGroup(node: unknown): node is Group {
  return (
    typeof node === "object" &&
    node !== null &&
    (node as Group).type === "group"
  );
}

export function isErrorExpr(node: unknown): node is ErrorExpr {
  return (
    typeof node === "object" &&
    node !== null &&
    (node as ErrorExpr).type === "error"
  );
}

export function isFilterExpression(node: unknown): node is FilterExpression {
  return (
    typeof node === "object" &&
    node !== null &&
    (node as FilterExpression).type === "filter"
  );
}
