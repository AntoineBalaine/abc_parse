import { ABCContext, File_structure, parse, RangeVisitor, Scanner, Token, TT } from "abc-parser";
import { Diagnostic } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { mapAbcErrorsToDiagnostics, mapAbcWarningsToDiagnostics } from "./server_helpers";

/**
 * AbclDocument stores an ABCL `TextDocument`'s diagnostics, tokens, and AST.
 *
 * ABCL files use "linear writing style" for multi-voice ABC notation.
 * In linear style, voice changes within the file represent actual system breaks,
 * as opposed to "deferred style" where ABCJS pieces voices together at render time.
 *
 * Uses standard Scanner and parse from abc-parser (not custom scanner like ABCX).
 * The difference from AbcDocument: will pass a `linear: true` flag to parsing
 * (to be implemented in Phase 2).
 */
export class AbclDocument {
  public diagnostics: Diagnostic[] = [];
  public tokens: Token[] = [];
  public AST: File_structure | null = null;
  public ctx = new ABCContext();
  public rangeVisitor = new RangeVisitor();

  constructor(public document: TextDocument) {}

  /**
   * Return an array of tokens, or void in case of failure.
   * `analyze()` parses the ABCL document,
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

    // Use standard ABC scanner and parser
    // Because linear parsing is not yet implemented, we use standard parsing
    // (Phase 2 will add the linear: true option)
    const tokens = Scanner(source, this.ctx);
    this.AST = parse(tokens, this.ctx);

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
