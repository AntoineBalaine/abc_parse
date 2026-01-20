// ABCT AST Type Definitions
// These types match the structure produced by the Peggy grammar

// ============================================================================
// Program Structure
// ============================================================================

export interface Program {
  type: "program";
  statements: Statement[];
}

export type Statement = Assignment | Expr;

export interface Assignment {
  type: "assignment";
  id: string;
  value: Expr;
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
  | Comparison
  | Selector
  | LocationSelector
  | VoiceRef
  | List
  | AbcLiteral
  | FileRef
  | NumberLiteral
  | Identifier;

export interface Pipe {
  type: "pipe";
  left: Expr;
  right: Expr;
}

export interface Concat {
  type: "concat";
  left: Expr;
  right: Expr;
}

export interface Update {
  type: "update";
  selector: Selector | LocationSelector;
  transform: Expr;
}

export interface Application {
  type: "application";
  terms: Expr[];
}

// ============================================================================
// Logical and Comparison Operators
// ============================================================================

export interface Or {
  type: "or";
  left: Expr;
  right: Expr;
}

export interface And {
  type: "and";
  left: Expr;
  right: Expr;
}

export interface Not {
  type: "not";
  operand: Expr;
}

export type ComparisonOp = ">=" | "<=" | "==" | "!=" | ">" | "<";

export interface Comparison {
  type: "comparison";
  op: ComparisonOp;
  left: Expr;
  right: Expr;
}

// ============================================================================
// Atoms
// ============================================================================

export interface Selector {
  type: "selector";
  path: SelectorPath;
}

export interface LocationSelector {
  type: "location_selector";
  line: number;
  col?: number;
  end?: RangeEnd;
}

export interface SelectorPath {
  id: string;
  value?: string | number | Range;
}

export interface VoiceRef {
  type: "voice_ref";
  voiceType: string;
  name: string | number;
}

export interface List {
  type: "list";
  items: Expr[];
}

export interface AbcLiteral {
  type: "abc_literal";
  content: string;
}

export interface FileRef {
  type: "file_ref";
  path: string;
  location: Location | null;
  selector: SelectorPath | null;
}

export interface NumberLiteral {
  type: "number";
  value: string; // String because it can be a fraction like "1/2"
}

export interface Identifier {
  type: "identifier";
  name: string;
}

// ============================================================================
// Supporting Types
// ============================================================================

export interface Location {
  line: number;
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

export function isVoiceRef(node: unknown): node is VoiceRef {
  return (
    typeof node === "object" &&
    node !== null &&
    (node as VoiceRef).type === "voice_ref"
  );
}
