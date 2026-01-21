import { Diagnostic, DiagnosticSeverity, Range, Position } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { parse } from "../../abct/src/parser/parser";
import { Program } from "../../abct/src/ast";
import { scan, Token } from "../../abct/src/scanner";
import { AbctContext } from "../../abct/src/context";
import { createFileResolver } from "./fileResolver";
import { evaluateAbct, EvalOptions, EvalResult } from "./abctEvaluator";
import { AbctValidator } from "./abct/AbctValidator";
import { findNodeAtPosition, AstNode } from "../../abct/src/ast-utils";

/**
 * AbctDocument stores an ABCT `TextDocument`'s diagnostics, tokens, and AST.
 *
 * Uses the ABCT scanner and parser for transform script notation.
 * Scanner tokens are stored directly for semantic highlighting.
 */
export class AbctDocument {
  public diagnostics: Diagnostic[] = [];
  public tokens: Token[] = [];
  public AST: Program | null = null;
  public ctx = new AbctContext();

  constructor(public document: TextDocument) {}

  /**
   * Analyze the ABCT document.
   * Scans and parses the document, stores tokens for semantic highlighting,
   * and collects any scan/parse/semantic errors as diagnostics.
   *
   * @returns an array of scanner tokens or void.
   */
  analyze(): Token[] | void {
    const source = this.document.getText();

    // Reset state before analysis
    this.ctx.errorReporter.resetErrors();
    this.diagnostics = [];
    this.tokens = [];
    this.AST = null;

    // Scan and parse with shared context
    this.tokens = scan(source, this.ctx);
    this.AST = parse(this.tokens, this.ctx);

    // Convert scanner/parser errors to diagnostics
    for (const e of this.ctx.errorReporter.getErrors()) {
      if (e.loc) {
        this.diagnostics.push({
          severity: DiagnosticSeverity.Error,
          range: Range.create(
            Position.create(e.loc.start.line - 1, e.loc.start.column - 1),
            Position.create(e.loc.end.line - 1, e.loc.end.column - 1)
          ),
          message: e.message,
          source: "abct",
        });
      }
    }

    // Run semantic validation (returns Diagnostic[] directly)
    if (this.AST) {
      const validator = new AbctValidator();
      const semanticDiagnostics = validator.validateProgram(this.AST);
      this.diagnostics.push(...semanticDiagnostics);
    }

    return this.tokens;
  }

  /**
   * Evaluate the ABCT document and return the ABC output.
   *
   * @param options - Evaluation options (toLine, selection)
   * @returns Promise resolving to the evaluation result with ABC output and diagnostics
   */
  async evaluate(options: EvalOptions = {}): Promise<EvalResult> {
    // Ensure the document has been parsed
    if (this.AST === null) {
      this.analyze();
    }

    // If there are parse errors, return empty result with diagnostics
    if (this.AST === null) {
      return {
        abc: "",
        diagnostics: this.diagnostics,
      };
    }

    // Create a file resolver for this document
    const fileResolver = createFileResolver(this.document.uri);

    // Evaluate the program
    const result = await evaluateAbct(this.AST, fileResolver, options);

    // Combine parse diagnostics with evaluation diagnostics
    return {
      abc: result.abc,
      diagnostics: [...this.diagnostics, ...result.diagnostics],
    };
  }

  /**
   * Find the AST node at the given position.
   *
   * @param position - The cursor position (0-based line and character from LSP)
   * @returns The AST node at the position, or null if no node found
   */
  getNodeAtPosition(position: Position): AstNode | null {
    if (!this.AST) {
      return null;
    }

    // Convert from 0-based LSP position to 1-based Peggy position
    const line = position.line + 1;
    const column = position.character + 1;

    return findNodeAtPosition(this.AST, line, column);
  }
}
