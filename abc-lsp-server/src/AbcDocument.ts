import { ABCContext, File_structure, parse, RangeVisitor, Scanner2, Token, TT } from "abc-parser";
import { Diagnostic } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { mapAbcErrorsToDiagnostics, mapAbcWarningsToDiagnostics } from "./server_helpers";

/**
 * AbcDocument stores an Abc `TextDocument`'s diagnostics, tokens, and AST.
 *
 * Method `analyze()` returns an array of semantic tokens, or `void` in case of failure.
 */
export class AbcDocument {
  public diagnostics: Diagnostic[] = [];
  public tokens: Token[] = [];
  public AST: File_structure | null = null;
  public ctx = new ABCContext();
  public rangeVisitor = new RangeVisitor();
  constructor(public document: TextDocument) {}
  /**
   * Return an array of tokens, or void in case of failure.
   * `analyze()` parses the document,
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

    this.tokens = Scanner2(source, this.ctx);
    // Debug: Print out all tokens for inspection
    console.log("Actual tokens generated:");
    this.tokens.forEach((token, i) => {
      console.log(`${i}: ${TT[token.type]} - "${token.lexeme}"`);
    });
    const tokens = Scanner2(source, this.ctx);
    this.AST = parse(tokens, this.ctx);
    let errs = mapAbcErrorsToDiagnostics(this.ctx.errorReporter.getErrors(), this.rangeVisitor);
    let warnings = mapAbcWarningsToDiagnostics(this.ctx.errorReporter.getWarnings(), this.rangeVisitor);
    this.diagnostics = errs.concat(warnings);

    if (!this.AST) {
      return;
    }

    this.tokens = tokens;

    return tokens;
  }
}
