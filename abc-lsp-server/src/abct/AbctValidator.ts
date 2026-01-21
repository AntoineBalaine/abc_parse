/**
 * ABCT AST Validator
 *
 * Validates ABCT AST nodes and collects diagnostics for:
 * - Unknown transforms (with suggestions for similar names)
 * - Unknown selectors (with suggestions for similar names)
 * - Type errors in transform arguments
 */

import { Diagnostic, DiagnosticSeverity, Range, Position } from "vscode-languageserver";
import {
  Program,
  Expr,
  Loc,
  isApplication,
  isSelector,
  isPipe,
  isUpdate,
  isConcat,
  isIdentifier,
  isOr,
  isAnd,
  isNot,
  isNegate,
  isGroup,
  isComparison,
  isList,
  isAssignment,
  isNumberLiteral,
  isAbcLiteral,
  Application,
  Selector,
  Identifier,
  NumberLiteral,
} from "../../../abct/src/ast";
import {
  getTransformInfo,
  getSelectorInfo,
  findSimilarTransforms,
  findSimilarSelectors,
  TransformInfo,
  ArgSpec,
} from "../../../abct/src/registry";

/**
 * Convert ABCT AST location to LSP Range
 */
function locToRange(loc: Loc): Range {
  return Range.create(
    Position.create(loc.start.line - 1, loc.start.column - 1),
    Position.create(loc.end.line - 1, loc.end.column - 1)
  );
}

/**
 * Validator for ABCT AST that collects diagnostics
 */
export class AbctValidator {
  private diagnostics: Diagnostic[] = [];

  /**
   * Validate a program and return all diagnostics
   */
  validateProgram(program: Program): Diagnostic[] {
    this.diagnostics = [];

    for (const stmt of program.statements) {
      if (isAssignment(stmt)) {
        this.validateExpr(stmt.value, false);
      } else {
        this.validateExpr(stmt, false);
      }
    }

    return this.diagnostics;
  }

  /**
   * Validate an expression recursively.
   * @param expr The expression to validate
   * @param inTransformPosition Whether the expression is in a position where a transform is expected
   */
  private validateExpr(expr: Expr, inTransformPosition: boolean): void {
    if (isPipe(expr)) {
      this.validateExpr(expr.left, false);
      // The right side of a pipe is in transform position
      this.validateExpr(expr.right, true);
    } else if (isUpdate(expr)) {
      // Validate the selector
      if (isSelector(expr.selector)) {
        this.validateSelector(expr.selector);
      }
      // The transform expression is in transform position
      this.validateExpr(expr.transform, true);
    } else if (isConcat(expr)) {
      this.validateExpr(expr.left, false);
      this.validateExpr(expr.right, false);
    } else if (isApplication(expr)) {
      this.validateApplication(expr);
    } else if (isSelector(expr)) {
      this.validateSelector(expr);
    } else if (isIdentifier(expr)) {
      // Bare identifiers in transform position need to be validated as potential transforms
      if (inTransformPosition) {
        this.validateBareTransform(expr);
      }
    } else if (isOr(expr)) {
      this.validateExpr(expr.left, false);
      this.validateExpr(expr.right, false);
    } else if (isAnd(expr)) {
      this.validateExpr(expr.left, false);
      this.validateExpr(expr.right, false);
    } else if (isNot(expr)) {
      this.validateExpr(expr.operand, false);
    } else if (isComparison(expr)) {
      this.validateExpr(expr.left, false);
      this.validateExpr(expr.right, false);
    } else if (isList(expr)) {
      for (const item of expr.items) {
        this.validateExpr(item, false);
      }
    } else if (isNegate(expr)) {
      this.validateExpr(expr.operand, false);
    } else if (isGroup(expr)) {
      // Validate the expression inside the group, preserving transform position context
      this.validateExpr(expr.expr, inTransformPosition);
    }
    // FileRef, AbcLiteral, NumberLiteral, LocationSelector, VoiceRef
    // do not require semantic validation here
  }

  /**
   * Validate a bare identifier used as a transform (without arguments)
   */
  private validateBareTransform(id: Identifier): void {
    const transformName = id.name;
    const transformInfo = getTransformInfo(transformName);

    if (!transformInfo) {
      // Unknown transform - add diagnostic with suggestions
      const similar = findSimilarTransforms(transformName);
      let message = `Unknown transform '${transformName}'.`;
      if (similar.length > 0) {
        message += ` Did you mean '${similar[0]}'?`;
      }
      this.addDiagnostic(id.loc, message, DiagnosticSeverity.Error);
    } else {
      // Check for missing required arguments
      const requiredArgs = transformInfo.args.filter((spec) => spec.required);
      if (requiredArgs.length > 0) {
        const message = `Transform '${transformInfo.name}' requires argument${requiredArgs.length > 1 ? "s" : ""}: ${requiredArgs.map((a) => a.name).join(", ")}`;
        this.addDiagnostic(id.loc, message, DiagnosticSeverity.Error);
      }
    }
  }

  /**
   * Validate an application (function call with arguments)
   */
  private validateApplication(app: Application): void {
    if (app.terms.length === 0) {
      return;
    }

    const firstTerm = app.terms[0];

    // The first term should be an identifier (transform name) or another expression
    if (isIdentifier(firstTerm)) {
      const transformName = firstTerm.name;
      const transformInfo = getTransformInfo(transformName);

      if (!transformInfo) {
        // Unknown transform - add diagnostic with suggestions
        const similar = findSimilarTransforms(transformName);
        let message = `Unknown transform '${transformName}'.`;
        if (similar.length > 0) {
          message += ` Did you mean '${similar[0]}'?`;
        }

        this.addDiagnostic(firstTerm.loc, message, DiagnosticSeverity.Error);
      } else {
        // Validate arguments
        this.validateTransformArgs(app, transformInfo);
      }
    } else {
      // First term is an expression - validate it recursively
      this.validateExpr(firstTerm, false);
    }

    // Validate remaining terms (arguments)
    for (let i = 1; i < app.terms.length; i++) {
      const term = app.terms[i];
      // Recursively validate nested expressions
      if (isApplication(term) || isPipe(term) || isUpdate(term) || isConcat(term)) {
        this.validateExpr(term, false);
      } else if (isSelector(term)) {
        this.validateSelector(term);
      } else if (isList(term)) {
        for (const item of term.items) {
          this.validateExpr(item, false);
        }
      }
    }
  }

  /**
   * Validate transform arguments against the transform's specification
   */
  private validateTransformArgs(app: Application, transformInfo: TransformInfo): void {
    const args = app.terms.slice(1); // Skip the transform name
    const argSpecs = transformInfo.args;

    // Check for missing required arguments
    const requiredArgs = argSpecs.filter((spec) => spec.required);
    if (args.length < requiredArgs.length) {
      const missing = requiredArgs.slice(args.length);
      const message = `Transform '${transformInfo.name}' requires argument${missing.length > 1 ? "s" : ""}: ${missing.map((a) => a.name).join(", ")}`;
      this.addDiagnostic(app.loc, message, DiagnosticSeverity.Error);
      return;
    }

    // Validate argument types
    for (let i = 0; i < args.length && i < argSpecs.length; i++) {
      const arg = args[i];
      const spec = argSpecs[i];
      this.validateArgType(arg, spec);
    }

    // Check for transpose 0 warning
    if (
      transformInfo.name === "transpose" &&
      args.length >= 1 &&
      isNumberLiteral(args[0])
    ) {
      const numArg = args[0] as NumberLiteral;
      if (numArg.value === "0") {
        this.addDiagnostic(
          numArg.loc,
          "transpose 0 has no effect",
          DiagnosticSeverity.Warning
        );
      }
    }

    // Check for octave 0 warning
    if (
      transformInfo.name === "octave" &&
      args.length >= 1 &&
      isNumberLiteral(args[0])
    ) {
      const numArg = args[0] as NumberLiteral;
      if (numArg.value === "0") {
        this.addDiagnostic(
          numArg.loc,
          "octave 0 has no effect",
          DiagnosticSeverity.Warning
        );
      }
    }
  }

  /**
   * Validate that an argument matches the expected type
   */
  private validateArgType(arg: Expr, spec: ArgSpec): void {
    switch (spec.type) {
      case "integer":
        if (isNumberLiteral(arg)) {
          const numArg = arg as NumberLiteral;
          // Check if it's a fraction (not an integer)
          if (numArg.value.includes("/")) {
            this.addDiagnostic(
              arg.loc,
              `'${spec.name}' expects integer argument, got fraction`,
              DiagnosticSeverity.Error
            );
          }
        } else if (isAbcLiteral(arg)) {
          this.addDiagnostic(
            arg.loc,
            `'${spec.name}' expects integer argument, got ABC literal`,
            DiagnosticSeverity.Error
          );
        } else if (isList(arg)) {
          this.addDiagnostic(
            arg.loc,
            `'${spec.name}' expects integer argument, got list`,
            DiagnosticSeverity.Error
          );
        }
        // Identifiers and other expressions could be variables - allow them
        break;
      case "number":
        // Both integers and fractions are valid
        break;
      case "string":
        if (isNumberLiteral(arg)) {
          this.addDiagnostic(
            arg.loc,
            `'${spec.name}' expects string argument, got number`,
            DiagnosticSeverity.Error
          );
        }
        break;
      case "list":
        if (!isList(arg)) {
          this.addDiagnostic(
            arg.loc,
            `'${spec.name}' expects list argument`,
            DiagnosticSeverity.Error
          );
        }
        break;
      case "expression":
        // Any expression is valid
        break;
    }
  }

  /**
   * Validate a selector
   */
  private validateSelector(selector: Selector): void {
    const selectorId = selector.path.id;

    // Check if it's a known selector
    const selectorInfo = getSelectorInfo(selectorId);
    if (!selectorInfo) {
      // Check for special selectors like V and M which have values
      const specialSelectors = ["v", "m"];
      if (!specialSelectors.includes(selectorId.toLowerCase())) {
        const similar = findSimilarSelectors(selectorId);
        let message = `Unknown selector '@${selectorId}'.`;
        if (similar.length > 0) {
          message += ` Did you mean '@${similar[0]}'?`;
        }

        this.addDiagnostic(selector.loc, message, DiagnosticSeverity.Error);
      }
    }
  }

  /**
   * Add a diagnostic to the collection
   */
  private addDiagnostic(
    loc: Loc,
    message: string,
    severity: DiagnosticSeverity
  ): void {
    this.diagnostics.push({
      severity,
      range: locToRange(loc),
      message,
      source: "abct",
    });
  }
}
