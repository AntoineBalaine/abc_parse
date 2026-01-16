import { ABCContext, File_structure, parseAbcx, RangeVisitor, ScannerAbcx, Token, TT } from "abc-parser";
import { Diagnostic } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { mapAbcErrorsToDiagnostics, mapAbcWarningsToDiagnostics } from "./server_helpers";

/**
 * AbcxDocument stores an ABCx `TextDocument`'s diagnostics, tokens, and AST.
 *
 * Similar to AbcDocument but uses the ABCx scanner and parser for chord sheet notation.
 */
export class AbcxDocument {
  public diagnostics: Diagnostic[] = [];
  public tokens: Token[] = [];
  public AST: File_structure | null = null;
  public ctx = new ABCContext();
  public rangeVisitor = new RangeVisitor();

  constructor(public document: TextDocument) {}

  /**
   * Return an array of tokens, or void in case of failure.
   * `analyze()` parses the ABCx document,
   * stores the AST,
   * stores any diagnostics,
   * and stores the semantic tokens used for highlighting.
   *
   * @returns an array of semantic tokens or void.
   */
  analyze() {
    const source = String.raw`${this.document.getText()}`;

    this.ctx.errorReporter.resetWarnings();
    this.ctx.errorReporter.resetErrors();
    this.diagnostics = [];
    this.tokens = [];

    // Use ABCx scanner and parser
    const tokens = ScannerAbcx(source, this.ctx);
    this.AST = parseAbcx(tokens, this.ctx);

    const errs = mapAbcErrorsToDiagnostics(this.ctx.errorReporter.getErrors(), this.rangeVisitor);
    const warnings = mapAbcWarningsToDiagnostics(this.ctx.errorReporter.getWarnings(), this.rangeVisitor);
    this.diagnostics = errs.concat(warnings);

    if (!this.AST) {
      return;
    }

    this.tokens = tokens;

    return tokens;
  }
}
