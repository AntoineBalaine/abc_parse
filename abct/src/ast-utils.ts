// ABCT AST Utilities
// Functions for navigating and querying the AST

import {
  Program,
  Statement,
  Expr,
  Loc,
  Pos,
  isAssignment,
  isPipe,
  isConcat,
  isUpdate,
  isApplication,
  isSelector,
  isLocationSelector,
  isComparison,
  isIdentifier,
  isFileRef,
  isAbcLiteral,
  isList,
  isNumberLiteral,
  isOr,
  isAnd,
  isNot,
  isNegate,
  isGroup,
  isVoiceRef,
  isFilterExpression,
  Assignment,
  Pipe,
  Concat,
  Update,
  Application,
  Selector,
  List,
  Or,
  And,
  Not,
  Negate,
  Group,
  Comparison,
  FilterExpression,
} from "./ast";

/**
 * Any AST node that has a location
 */
export type AstNode =
  | Program
  | Statement
  | Expr
  | { type: string; loc: Loc };

/**
 * Check if a position is within a location range.
 * Uses 0-based line and column numbers.
 */
export function containsPosition(loc: Loc, line: number, column: number): boolean {
  // Check if position is before start
  if (line < loc.start.line) return false;
  if (line === loc.start.line && column < loc.start.column) return false;

  // Check if position is after end
  if (line > loc.end.line) return false;
  if (line === loc.end.line && column > loc.end.column) return false;

  return true;
}

/**
 * Get the source location range of a node.
 */
export function getNodeRange(node: AstNode): Loc {
  if ("loc" in node && node.loc) {
    return node.loc;
  }
  // This should not happen for well-formed AST nodes
  throw new Error("Node does not have a location");
}

/**
 * Find the deepest AST node at the given position.
 * Returns null if the position is not within any node.
 *
 * @param ast - The ABCT Program AST
 * @param line - Line number (0-based)
 * @param column - Column number (0-based)
 */
export function findNodeAtPosition(
  ast: Program,
  line: number,
  column: number
): AstNode | null {
  // First check if position is within the program
  if (!containsPosition(ast.loc, line, column)) {
    return null;
  }

  // Walk through statements to find the containing one
  for (const stmt of ast.statements) {
    const found = findInStatement(stmt, line, column);
    if (found) return found;
  }

  // Position is within program but not within any statement
  // (e.g., in whitespace between statements)
  return null;
}

function findInStatement(stmt: Statement, line: number, column: number): AstNode | null {
  if (!containsPosition(getStatementLoc(stmt), line, column)) {
    return null;
  }

  if (isAssignment(stmt)) {
    return findInAssignment(stmt, line, column);
  }

  return findInExpr(stmt, line, column);
}

function getStatementLoc(stmt: Statement): Loc {
  if (isAssignment(stmt)) {
    return stmt.loc;
  }
  return (stmt as Expr & { loc: Loc }).loc;
}

function findInAssignment(assign: Assignment, line: number, column: number): AstNode | null {
  // Check if position is in the identifier
  if (containsPosition(assign.idLoc, line, column)) {
    return { type: "assignment_id", loc: assign.idLoc, name: assign.id } as AstNode;
  }

  // Check if position is in the = operator
  if (containsPosition(assign.eqLoc, line, column)) {
    return { type: "assignment_eq", loc: assign.eqLoc } as AstNode;
  }

  // Check in the value expression
  const inValue = findInExpr(assign.value, line, column);
  if (inValue) return inValue;

  // Position is in the assignment but not in a specific sub-node
  return assign;
}

function findInExpr(expr: Expr, line: number, column: number): AstNode | null {
  if (!containsPosition(expr.loc, line, column)) {
    return null;
  }

  // Check specific expression types for sub-nodes
  if (isPipe(expr)) {
    return findInPipe(expr, line, column);
  }
  if (isConcat(expr)) {
    return findInConcat(expr, line, column);
  }
  if (isUpdate(expr)) {
    return findInUpdate(expr, line, column);
  }
  if (isApplication(expr)) {
    return findInApplication(expr, line, column);
  }
  if (isOr(expr)) {
    return findInOr(expr, line, column);
  }
  if (isAnd(expr)) {
    return findInAnd(expr, line, column);
  }
  if (isNot(expr)) {
    return findInNot(expr, line, column);
  }
  if (isNegate(expr)) {
    return findInNegate(expr, line, column);
  }
  if (isGroup(expr)) {
    return findInGroup(expr, line, column);
  }
  if (isComparison(expr)) {
    return findInComparison(expr, line, column);
  }
  if (isFilterExpression(expr)) {
    return findInFilterExpression(expr, line, column);
  }
  if (isSelector(expr)) {
    return findInSelector(expr, line, column);
  }
  if (isList(expr)) {
    return findInList(expr, line, column);
  }

  // Leaf nodes: return the node itself
  if (isIdentifier(expr) || isFileRef(expr) || isAbcLiteral(expr) ||
      isNumberLiteral(expr) || isLocationSelector(expr) || isVoiceRef(expr)) {
    return expr;
  }

  // Default: return the expression
  return expr;
}

function findInPipe(pipe: Pipe, line: number, column: number): AstNode | null {
  // Check operator first (it's the most specific)
  if (containsPosition(pipe.opLoc, line, column)) {
    return { type: "pipe_op", loc: pipe.opLoc, op: "|" } as AstNode;
  }

  // Check left side
  const inLeft = findInExpr(pipe.left, line, column);
  if (inLeft) return inLeft;

  // Check right side
  const inRight = findInExpr(pipe.right, line, column);
  if (inRight) return inRight;

  return pipe;
}

function findInConcat(concat: Concat, line: number, column: number): AstNode | null {
  if (containsPosition(concat.opLoc, line, column)) {
    return { type: "concat_op", loc: concat.opLoc, op: "+" } as AstNode;
  }

  const inLeft = findInExpr(concat.left, line, column);
  if (inLeft) return inLeft;

  const inRight = findInExpr(concat.right, line, column);
  if (inRight) return inRight;

  return concat;
}

function findInUpdate(update: Update, line: number, column: number): AstNode | null {
  if (containsPosition(update.opLoc, line, column)) {
    return { type: "update_op", loc: update.opLoc, op: "|=" } as AstNode;
  }

  const inSelector = findInExpr(update.selector, line, column);
  if (inSelector) return inSelector;

  const inTransform = findInExpr(update.transform, line, column);
  if (inTransform) return inTransform;

  return update;
}

function findInApplication(app: Application, line: number, column: number): AstNode | null {
  for (const term of app.terms) {
    const found = findInExpr(term, line, column);
    if (found) return found;
  }

  return app;
}

function findInOr(or: Or, line: number, column: number): AstNode | null {
  if (containsPosition(or.kwLoc, line, column)) {
    return { type: "or_kw", loc: or.kwLoc, keyword: "or" } as AstNode;
  }

  const inLeft = findInExpr(or.left, line, column);
  if (inLeft) return inLeft;

  const inRight = findInExpr(or.right, line, column);
  if (inRight) return inRight;

  return or;
}

function findInAnd(and: And, line: number, column: number): AstNode | null {
  if (containsPosition(and.kwLoc, line, column)) {
    return { type: "and_kw", loc: and.kwLoc, keyword: "and" } as AstNode;
  }

  const inLeft = findInExpr(and.left, line, column);
  if (inLeft) return inLeft;

  const inRight = findInExpr(and.right, line, column);
  if (inRight) return inRight;

  return and;
}

function findInNot(not: Not, line: number, column: number): AstNode | null {
  if (containsPosition(not.kwLoc, line, column)) {
    return { type: "not_kw", loc: not.kwLoc, keyword: "not" } as AstNode;
  }

  const inOperand = findInExpr(not.operand, line, column);
  if (inOperand) return inOperand;

  return not;
}

function findInNegate(neg: Negate, line: number, column: number): AstNode | null {
  if (containsPosition(neg.opLoc, line, column)) {
    return { type: "negate_op", loc: neg.opLoc, op: "-" } as AstNode;
  }

  const inOperand = findInExpr(neg.operand, line, column);
  if (inOperand) return inOperand;

  return neg;
}

function findInGroup(group: Group, line: number, column: number): AstNode | null {
  if (containsPosition(group.openLoc, line, column)) {
    return { type: "group_open", loc: group.openLoc } as AstNode;
  }

  if (containsPosition(group.closeLoc, line, column)) {
    return { type: "group_close", loc: group.closeLoc } as AstNode;
  }

  const inExpr = findInExpr(group.expr, line, column);
  if (inExpr) return inExpr;

  return group;
}

function findInComparison(comp: Comparison, line: number, column: number): AstNode | null {
  if (containsPosition(comp.opLoc, line, column)) {
    return { type: "comparison_op", loc: comp.opLoc, op: comp.op } as AstNode;
  }

  const inLeft = findInExpr(comp.left, line, column);
  if (inLeft) return inLeft;

  const inRight = findInExpr(comp.right, line, column);
  if (inRight) return inRight;

  return comp;
}

function findInFilterExpression(filter: FilterExpression, line: number, column: number): AstNode | null {
  // Check if position is on the 'filter' keyword
  if (containsPosition(filter.kwLoc, line, column)) {
    return { type: "filter_kw", loc: filter.kwLoc, name: "filter" } as AstNode;
  }

  // Check in the predicate (comparison expression)
  const inPredicate = findInExpr(filter.predicate, line, column);
  if (inPredicate) return inPredicate;

  return filter;
}

function findInSelector(sel: Selector, line: number, column: number): AstNode | null {
  // Check @ symbol
  if (containsPosition(sel.atLoc, line, column)) {
    return { type: "selector_at", loc: sel.atLoc } as AstNode;
  }

  // Check selector id
  if (containsPosition(sel.path.idLoc, line, column)) {
    return { type: "selector_id", loc: sel.path.idLoc, id: sel.path.id } as AstNode;
  }

  // Check selector value if present
  if (sel.path.valueLoc && containsPosition(sel.path.valueLoc, line, column)) {
    return { type: "selector_value", loc: sel.path.valueLoc, value: sel.path.value } as AstNode;
  }

  return sel;
}

function findInList(list: List, line: number, column: number): AstNode | null {
  for (const item of list.items) {
    const found = findInExpr(item, line, column);
    if (found) return found;
  }

  return list;
}

/**
 * Get the parent chain of nodes leading to the given position.
 * Returns an array with the root (Program) first and the deepest node last.
 */
export function getNodePath(
  ast: Program,
  line: number,
  column: number
): AstNode[] {
  const path: AstNode[] = [];

  if (!containsPosition(ast.loc, line, column)) {
    return path;
  }

  path.push(ast);
  buildPathInProgram(ast, line, column, path);

  return path;
}

function buildPathInProgram(ast: Program, line: number, column: number, path: AstNode[]): void {
  for (const stmt of ast.statements) {
    const stmtLoc = getStatementLoc(stmt);
    if (containsPosition(stmtLoc, line, column)) {
      path.push(stmt);
      if (isAssignment(stmt)) {
        buildPathInExpr(stmt.value, line, column, path);
      } else {
        buildPathInExpr(stmt, line, column, path);
      }
      return;
    }
  }
}

function buildPathInExpr(expr: Expr, line: number, column: number, path: AstNode[]): void {
  if (!containsPosition(expr.loc, line, column)) {
    return;
  }

  // Always add the current expression to the path
  path.push(expr);

  // Recursively check children
  if (isPipe(expr)) {
    buildPathInExpr(expr.left, line, column, path);
    buildPathInExpr(expr.right, line, column, path);
  } else if (isConcat(expr)) {
    buildPathInExpr(expr.left, line, column, path);
    buildPathInExpr(expr.right, line, column, path);
  } else if (isUpdate(expr)) {
    buildPathInExpr(expr.selector, line, column, path);
    buildPathInExpr(expr.transform, line, column, path);
  } else if (isApplication(expr)) {
    for (const term of expr.terms) {
      buildPathInExpr(term, line, column, path);
    }
  } else if (isOr(expr) || isAnd(expr)) {
    buildPathInExpr((expr as Or | And).left, line, column, path);
    buildPathInExpr((expr as Or | And).right, line, column, path);
  } else if (isNot(expr)) {
    buildPathInExpr(expr.operand, line, column, path);
  } else if (isNegate(expr)) {
    buildPathInExpr(expr.operand, line, column, path);
  } else if (isGroup(expr)) {
    buildPathInExpr(expr.expr, line, column, path);
  } else if (isComparison(expr)) {
    buildPathInExpr(expr.left, line, column, path);
    buildPathInExpr(expr.right, line, column, path);
  } else if (isFilterExpression(expr)) {
    buildPathInExpr(expr.predicate, line, column, path);
  } else if (isList(expr)) {
    for (const item of expr.items) {
      buildPathInExpr(item, line, column, path);
    }
  }
}

/**
 * Check if a node is in an "application position" (first term of an application).
 * This is used to determine if an identifier should be treated as a transform name.
 */
export function isInApplicationPosition(node: AstNode, ast: Program, line: number, column: number): boolean {
  const path = getNodePath(ast, line, column);

  // Find if there's an Application in the path
  for (let i = path.length - 1; i >= 0; i--) {
    const current = path[i];
    if (isApplication(current as unknown)) {
      const app = current as Application;
      // Check if node is the first term
      if (app.terms.length > 0 && app.terms[0] === node) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Collect all identifiers defined as variables (left side of assignments).
 */
export function collectVariables(ast: Program): Map<string, Assignment> {
  const variables = new Map<string, Assignment>();

  for (const stmt of ast.statements) {
    if (isAssignment(stmt)) {
      variables.set(stmt.id, stmt);
    }
  }

  return variables;
}
