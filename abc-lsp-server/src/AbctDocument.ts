import { Diagnostic, DiagnosticSeverity, Range, Position } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { parse, extractTokens, AbctToken, Program } from "../../abct/src/parser";
import { createFileResolver } from "./fileResolver";
import { evaluateAbct, EvalOptions, EvalResult } from "./abctEvaluator";
import { AbctValidator } from "./abct/AbctValidator";

/**
 * AbctDocument stores an ABCT `TextDocument`'s diagnostics, tokens, and AST.
 *
 * Uses the ABCT Peggy parser and token extractor for transform script notation.
 */
export class AbctDocument {
  public diagnostics: Diagnostic[] = [];
  public tokens: AbctToken[] = [];
  public AST: Program | null = null;

  constructor(public document: TextDocument) {}

  /**
   * Analyze the ABCT document.
   * Parses the document, extracts tokens for semantic highlighting,
   * and collects any parse errors and semantic errors as diagnostics.
   *
   * @returns an array of semantic tokens or void.
   */
  analyze(): AbctToken[] | void {
    const source = this.document.getText();

    this.diagnostics = [];
    this.tokens = [];
    this.AST = null;

    const result = parse(source);

    if (!result.success) {
      // Convert parse error to diagnostic
      const error = result.error;
      const startPos = error.location?.start ?? { line: 1, column: 1 };
      const endPos = error.location?.end ?? startPos;

      this.diagnostics.push({
        severity: DiagnosticSeverity.Error,
        range: Range.create(
          Position.create(startPos.line - 1, startPos.column - 1),
          Position.create(endPos.line - 1, endPos.column - 1)
        ),
        message: error.message,
        source: "abct",
      });

      return;
    }

    this.AST = result.value;
    this.tokens = extractTokens(this.AST, source);

    // Run semantic validation to detect unknown transforms, selectors, and type errors
    const validator = new AbctValidator();
    const semanticDiagnostics = validator.validateProgram(this.AST);
    this.diagnostics.push(...semanticDiagnostics);

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
}
