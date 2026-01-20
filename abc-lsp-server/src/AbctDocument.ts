import { Diagnostic, DiagnosticSeverity, Range, Position } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { parse, extractTokens, AbctToken, Program } from "../../abct/src/parser";

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
   * and collects any parse errors as diagnostics.
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

    return this.tokens;
  }
}
