/**
 * ABCT Evaluator - Bridge between LSP and ABCT runtime.
 *
 * This module evaluates ABCT programs by:
 * 1. Processing the ABCT AST statements
 * 2. Loading referenced ABC files via FileResolver
 * 3. Applying selectors and transforms using the ABCT runtime
 * 4. Returning formatted ABC output
 */

import { Diagnostic, DiagnosticSeverity, Position, Range } from "vscode-languageserver";
import { FileResolver, FileResolverError } from "./fileResolver";
import { ABCContext, Scanner, parse as parseAbcContent, File_structure } from "abc-parser";
import {
  Program,
  Statement,
  Expr,
  Assignment,
  Pipe,
  FileRef,
  Selector,
  Application,
  Identifier,
  AbcLiteral,
  NumberLiteral,
  isAssignment,
  isPipe,
  isFileRef,
  isSelector,
  isApplication,
  isIdentifier,
  isAbcLiteral,
  isNumberLiteral,
  isUpdate,
  isLocationSelector,
  isGroup,
  isNegate,
  isFilterExpression,
  Update,
  Negate,
  FilterExpression,
  Loc,
} from "../../abct/src/ast";
import {
  ABCTRuntime,
  applySelector,
  applyTransform,
  formatSelection,
  selectAll,
  selectNotesFromSelection,
  selectChordsFromSelection,
  selectBassFromSelection,
  applyFilter,
  parseFilterPredicate,
  selectByLocation,
  selectByLocationFromSelection,
  LocationFilter,
} from "../../abct/src/runtime";
import { Selection } from "../../abct/src/runtime/types";

/**
 * Options for evaluating an ABCT document.
 */
export interface EvalOptions {
  /** Evaluate only up to this line number (1-based). If undefined, evaluate all. */
  toLine?: number;
  /** Evaluate only the expression in this selection range. */
  selection?: Range;
}

/**
 * Result of evaluating an ABCT document.
 */
export interface EvalResult {
  /** The formatted ABC output string */
  abc: string;
  /** Any diagnostics (errors/warnings) generated during evaluation */
  diagnostics: Diagnostic[];
}

/**
 * Convert an ABCT location to an LSP Range.
 * Both use 0-based positions.
 */
function locToRange(loc: Loc): Range {
  return Range.create(Position.create(loc.start.line, loc.start.column), Position.create(loc.end.line, loc.end.column));
}

/**
 * Create an error diagnostic from an ABCT location.
 */
function createErrorDiagnostic(message: string, loc: Loc): Diagnostic {
  return {
    severity: DiagnosticSeverity.Error,
    range: locToRange(loc),
    message,
    source: "abct",
  };
}

/**
 * Check if a statement is on or before the target line.
 * toLine is 1-based (from editor), AST lines are 0-based.
 */
function isStatementInScope(stmt: Statement, toLine: number): boolean {
  // Convert 1-based toLine to 0-based for comparison with AST
  const stmtLine = stmt.loc.start.line;
  return stmtLine <= toLine - 1;
}

/**
 * Check if a statement's location overlaps with the selection range.
 * Both AST locations and LSP Range are 0-based.
 */
function isStatementInSelection(stmt: Statement, selection: Range): boolean {
  const stmtStart = stmt.loc.start.line;
  const stmtEnd = stmt.loc.end.line;
  return stmtStart <= selection.end.line && stmtEnd >= selection.start.line;
}

/**
 * Evaluator class for ABCT programs.
 */
export class AbctEvaluator {
  private runtime: ABCTRuntime;
  private fileResolver: FileResolver;
  private diagnostics: Diagnostic[] = [];

  constructor(fileResolver: FileResolver) {
    this.runtime = new ABCTRuntime();
    this.fileResolver = fileResolver;
  }

  /**
   * Evaluate an ABCT program.
   *
   * @param program - The parsed ABCT program AST
   * @param options - Evaluation options (toLine, selection)
   * @returns The evaluation result with ABC output and diagnostics
   */
  async evaluate(program: Program, options: EvalOptions = {}): Promise<EvalResult> {
    this.diagnostics = [];
    let lastValue: Selection | null = null;

    // Filter statements based on options
    let statements = program.statements;

    if (options.toLine !== undefined) {
      statements = statements.filter((stmt) => isStatementInScope(stmt, options.toLine!));
    }

    if (options.selection !== undefined) {
      statements = statements.filter((stmt) => isStatementInSelection(stmt, options.selection!));
    }

    // Evaluate each statement
    for (const stmt of statements) {
      try {
        const value = await this.evaluateStatement(stmt);
        if (value !== null) {
          lastValue = value;
        }
      } catch (error) {
        if (error instanceof EvaluatorError) {
          this.diagnostics.push(createErrorDiagnostic(error.message, error.loc));
        } else if (error instanceof FileResolverError) {
          // File not found - use the statement's location for the diagnostic
          this.diagnostics.push(createErrorDiagnostic(error.message, stmt.loc));
        } else if (error instanceof Error) {
          this.diagnostics.push(createErrorDiagnostic(error.message, stmt.loc));
        }
      }
    }

    // Format the final result
    let abc = "";
    if (lastValue !== null) {
      abc = formatSelection(lastValue);
    }

    return {
      abc,
      diagnostics: this.diagnostics,
    };
  }

  /**
   * Evaluate a single statement.
   */
  private async evaluateStatement(stmt: Statement): Promise<Selection | null> {
    if (isAssignment(stmt)) {
      const value = await this.evaluateExpr(stmt.value);
      if (value !== null) {
        this.runtime.setVariable(stmt.id, value);
      }
      return null; // Assignments don't produce output
    }

    // Expression statement - evaluate and return its value
    return this.evaluateExpr(stmt);
  }

  /**
   * Evaluate an expression and return a Selection.
   */
  private async evaluateExpr(expr: Expr): Promise<Selection | null> {
    if (isFileRef(expr)) {
      return this.evaluateFileRef(expr);
    }

    if (isAbcLiteral(expr)) {
      return this.evaluateAbcLiteral(expr);
    }

    if (isIdentifier(expr)) {
      return this.evaluateIdentifier(expr);
    }

    if (isPipe(expr)) {
      return this.evaluatePipe(expr);
    }

    if (isSelector(expr)) {
      // A standalone selector without a value to select from is an error
      throw new EvaluatorError("Selector requires a value to select from", expr.loc);
    }

    if (isApplication(expr)) {
      return this.evaluateApplication(expr);
    }

    if (isUpdate(expr)) {
      return this.evaluateUpdate(expr);
    }

    if (isGroup(expr)) {
      // Unwrap the grouped expression and evaluate the inner expression
      return this.evaluateExpr(expr.expr);
    }

    // For other expression types, we don't have a value to return
    return null;
  }

  /**
   * Evaluate a file reference (e.g., "song.abc").
   */
  private async evaluateFileRef(expr: FileRef): Promise<Selection> {
    const loaded = await this.fileResolver.loadAbc(expr.path);

    // Start with a selection of all elements
    let selection = selectAll(loaded.ast);

    // If the file ref has a selector, apply it
    if (expr.selector) {
      selection = this.applySelectorPath(selection, expr.selector);
    }

    return selection;
  }

  /**
   * Evaluate an ABC literal (inline ABC code).
   */
  private evaluateAbcLiteral(expr: AbcLiteral): Selection {
    const ctx = new ABCContext();
    const tokens = Scanner(expr.content, ctx);
    const ast = parseAbcContent(tokens, ctx);
    return selectAll(ast);
  }

  /**
   * Evaluate an identifier (variable reference).
   */
  private evaluateIdentifier(expr: Identifier): Selection {
    const value = this.runtime.getVariable(expr.name);
    if (value === undefined) {
      throw new EvaluatorError(`Undefined variable: ${expr.name}`, expr.loc);
    }
    return value;
  }

  /**
   * Evaluate a pipe expression (left | right).
   */
  private async evaluatePipe(expr: Pipe): Promise<Selection> {
    // Evaluate the left side to get a Selection
    const leftValue = await this.evaluateExpr(expr.left);
    if (leftValue === null) {
      throw new EvaluatorError("Pipe left side must produce a value", expr.left.loc);
    }

    // The right side should be a selector or transform application
    if (isSelector(expr.right)) {
      return this.applySelectorToSelection(leftValue, expr.right);
    }

    if (isApplication(expr.right)) {
      return this.applyTransformToSelection(leftValue, expr.right);
    }

    if (isIdentifier(expr.right)) {
      // Could be a transform name without arguments
      return this.applyTransformToSelection(leftValue, {
        type: "application",
        terms: [expr.right],
        loc: expr.right.loc,
      });
    }

    if (isUpdate(expr.right)) {
      // Update expression: @selector |= transform
      return this.evaluateUpdateInContext(leftValue, expr.right);
    }

    if (isFilterExpression(expr.right)) {
      // Filter expression: filter (predicate)
      return this.applyFilterToSelection(leftValue, expr.right);
    }

    if (isLocationSelector(expr.right)) {
      // Location selector: :line or :line:col or :line:col-end
      const filter = this.locationSelectorToFilter(expr.right);
      return selectByLocationFromSelection(leftValue, filter);
    }

    throw new EvaluatorError("Pipe right side must be a selector, transform, or filter", expr.right.loc);
  }

  /**
   * Evaluate an update expression (selector |= transform).
   * Standalone updates (not within a pipe) are not supported.
   */
  private async evaluateUpdate(expr: Update): Promise<Selection> {
    throw new EvaluatorError("Update expressions must be used within a pipe (e.g., file.abc | @notes |= transpose 2)", expr.loc);
  }

  /**
   * Evaluate an update expression within the context of a pipe.
   * This is called when the right side of a pipe is an Update expression.
   *
   * For example: src | @notes |= transpose 2
   * - context is the Selection from evaluating 'src'
   * - update.selector is @notes
   * - update.transform is transpose 2
   *
   * The result is the context with the selected nodes transformed.
   */
  private async evaluateUpdateInContext(context: Selection, update: Update): Promise<Selection> {
    let selection: Selection;

    // Handle LocationSelector separately from regular selectors
    if (isLocationSelector(update.selector)) {
      // Convert LocationSelector to LocationFilter
      const filter = this.locationSelectorToFilter(update.selector);
      selection = selectByLocationFromSelection(context, filter);
    } else {
      // Apply the regular selector to narrow down which nodes to transform
      selection = this.applySelectorToSelection(context, update.selector);
    }

    // Evaluate the transform based on its type
    if (isApplication(update.transform)) {
      this.applyTransformToSelection(selection, update.transform);
    } else if (isIdentifier(update.transform)) {
      // Bare transform name without arguments (e.g., retrograde)
      const app: Application = {
        type: "application",
        terms: [update.transform],
        loc: update.transform.loc,
      };
      this.applyTransformToSelection(selection, app);
    } else if (isPipe(update.transform)) {
      // Pipeline as transform: (f | g | h)
      await this.evaluatePipelineAsTransform(selection, update.transform);
    } else if (isUpdate(update.transform)) {
      // Nested update: @chords |= (@notes |= transpose 2)
      // The inner update operates on the nodes selected by the outer selector
      await this.evaluateUpdateInContext(selection, update.transform);
    } else if (isGroup(update.transform)) {
      // Grouped expression: @chords |= (transpose 2 | retrograde)
      // Unwrap the group and recursively handle the inner expression
      const inner = update.transform.expr;
      if (isPipe(inner)) {
        await this.evaluatePipelineAsTransform(selection, inner);
      } else if (isUpdate(inner)) {
        await this.evaluateUpdateInContext(selection, inner);
      } else if (isApplication(inner)) {
        this.applyTransformToSelection(selection, inner);
      } else if (isIdentifier(inner)) {
        const app: Application = {
          type: "application",
          terms: [inner],
          loc: inner.loc,
        };
        this.applyTransformToSelection(selection, app);
      } else {
        throw new EvaluatorError("Invalid grouped transform in update expression", update.transform.loc);
      }
    } else {
      throw new EvaluatorError("Invalid transform in update expression", update.transform.loc);
    }

    // Return the original context - the AST has been mutated in place
    return context;
  }

  /**
   * Evaluate a pipeline expression as a transform.
   * Used when the transform part of an update is itself a pipeline.
   *
   * For example: src | @chords |= (transpose 2 | retrograde)
   * The (transpose 2 | retrograde) is evaluated as a series of transforms.
   */
  private async evaluatePipelineAsTransform(selection: Selection, pipe: Pipe): Promise<void> {
    const steps = this.flattenPipeline(pipe);
    let current = selection;

    for (const step of steps) {
      if (isApplication(step)) {
        current = this.applyTransformToSelection(current, step);
      } else if (isIdentifier(step)) {
        const app: Application = {
          type: "application",
          terms: [step],
          loc: step.loc,
        };
        current = this.applyTransformToSelection(current, app);
      } else if (isSelector(step)) {
        // Selector within a transform pipeline narrows the selection
        current = this.applyScopedSelector(current, step);
      } else {
        throw new EvaluatorError("Invalid step in transform pipeline", step.loc);
      }
    }
  }

  /**
   * Flatten a pipeline expression into a list of steps.
   * For (a | b | c), returns [a, b, c].
   */
  private flattenPipeline(expr: Expr): Expr[] {
    if (isPipe(expr)) {
      return [...this.flattenPipeline(expr.left), ...this.flattenPipeline(expr.right)];
    }
    return [expr];
  }

  /**
   * Apply a scoped selector to an existing selection.
   * Used for nested contexts where we want to select within already-selected nodes.
   */
  private applyScopedSelector(selection: Selection, selector: Selector): Selection {
    const selectorId = selector.path.id.toLowerCase();

    switch (selectorId) {
      case "notes":
      case "n":
        return selectNotesFromSelection(selection);
      case "chords":
      case "c":
        return selectChordsFromSelection(selection);
      case "bass":
        return selectBassFromSelection(selection);
      default:
        throw new EvaluatorError(`Selector @${selectorId} is not supported in nested context`, selector.loc);
    }
  }

  /**
   * Evaluate an application expression (transform with arguments).
   */
  private async evaluateApplication(expr: Application): Promise<Selection | null> {
    // If this is a standalone application (not part of a pipe),
    // it might be a file reference or identifier
    if (expr.terms.length === 1) {
      return this.evaluateExpr(expr.terms[0]);
    }

    // Multiple terms without a pipe context is an error
    throw new EvaluatorError("Transform application requires a value to transform", expr.loc);
  }

  /**
   * Apply a selector to a Selection.
   */
  private applySelectorToSelection(selection: Selection, selector: Selector): Selection {
    return this.applySelectorPath(selection, selector.path);
  }

  /**
   * Apply a selector path to a Selection.
   */
  private applySelectorPath(selection: Selection, path: { id: string; value?: string | number | { type: "range"; start: number; end: number } }): Selection {
    const selectorId = path.id;
    const value = path.value;

    // Convert range to the format expected by applySelector
    let selectorValue: string | number | { start: number; end: number } | undefined;
    if (typeof value === "object" && value !== null && "type" in value && value.type === "range") {
      selectorValue = { start: value.start, end: value.end };
    } else {
      selectorValue = value as string | number | undefined;
    }

    return applySelector(selection.ast, selectorId, selectorValue);
  }

  /**
   * Convert a LocationSelector from the ABCT AST to a LocationFilter for the runtime.
   */
  private locationSelectorToFilter(selector: {
    line: number;
    col?: number;
    end?: { type: "singleline"; endCol: number } | { type: "multiline"; endLine: number; endCol: number };
  }): LocationFilter {
    const filter: LocationFilter = {
      line: selector.line,
    };

    if (selector.col !== undefined) {
      filter.col = selector.col;
    }

    if (selector.end) {
      if (selector.end.type === "singleline") {
        filter.end = {
          type: "singleline",
          endCol: selector.end.endCol,
        };
      } else {
        filter.end = {
          type: "multiline",
          endLine: selector.end.endLine,
          endCol: selector.end.endCol,
        };
      }
    }

    return filter;
  }

  /**
   * Apply a transform to a Selection.
   */
  private applyTransformToSelection(selection: Selection, application: Application): Selection {
    if (application.terms.length === 0) {
      throw new EvaluatorError("Transform requires a name", application.loc);
    }

    const firstTerm = application.terms[0];
    if (!isIdentifier(firstTerm)) {
      throw new EvaluatorError("Transform name must be an identifier", firstTerm.loc);
    }

    const transformName = firstTerm.name;
    const args = application.terms.slice(1).map((term) => {
      if (isNumberLiteral(term)) {
        // Parse number - handle fractions like "1/2"
        if (term.value.includes("/")) {
          const [num, denom] = term.value.split("/").map(Number);
          return num / denom;
        }
        return Number(term.value);
      }
      if (isIdentifier(term)) {
        // Could be a constant or enum value
        return term.name;
      }
      if (isNegate(term) && isNumberLiteral(term.operand)) {
        // Handle negative numbers like -2
        const operand = term.operand;
        if (operand.value.includes("/")) {
          const [num, denom] = operand.value.split("/").map(Number);
          return -(num / denom);
        }
        return -Number(operand.value);
      }
      throw new EvaluatorError("Invalid transform argument", term.loc);
    });

    return applyTransform(selection, transformName, args);
  }

  /**
   * Apply a filter expression to a Selection.
   * Removes elements that do not match the predicate.
   */
  private applyFilterToSelection(selection: Selection, filterExpr: FilterExpression): Selection {
    // Parse the predicate from the comparison expression
    const predicate = parseFilterPredicate(filterExpr.predicate);
    if (predicate === null) {
      throw new EvaluatorError("Invalid filter predicate. Expected format: property op value (e.g., pitch > C4)", filterExpr.predicate.loc);
    }

    // Apply the filter - mutates the AST in place
    applyFilter(selection, predicate);

    // Return the same selection (with mutated AST)
    return selection;
  }
}

/**
 * Error thrown during ABCT evaluation.
 */
export class EvaluatorError extends Error {
  constructor(
    message: string,
    public readonly loc: Loc
  ) {
    super(message);
    this.name = "EvaluatorError";
  }
}

/**
 * Evaluate an ABCT program.
 *
 * @param program - The parsed ABCT program AST
 * @param fileResolver - Resolver for loading external ABC files
 * @param options - Evaluation options
 * @returns Promise resolving to the evaluation result
 */
export async function evaluateAbct(program: Program, fileResolver: FileResolver, options: EvalOptions = {}): Promise<EvalResult> {
  const evaluator = new AbctEvaluator(fileResolver);
  return evaluator.evaluate(program, options);
}
