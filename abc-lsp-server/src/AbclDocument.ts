import { parse, Scanner } from "abc-parser";
import { TextDocument } from "vscode-languageserver-textdocument";
import { AbcDocument } from "./AbcDocument";
import { mapAbcErrorsToDiagnostics, mapAbcWarningsToDiagnostics } from "./server_helpers";

/**
 * AbclDocument extends AbcDocument for ABCL linear-style files.
 *
 * ABCL files use "linear writing style" for multi-voice ABC notation.
 * In linear style, voice changes within the file represent actual system breaks,
 * as opposed to "deferred style" where ABCJS pieces voices together at render time.
 *
 * The difference from AbcDocument: passes a `linear: true` flag to parsing,
 * which enables dynamic voice discovery and linear-style system detection.
 *
 * By extending AbcDocument, AbclDocument inherits the same ctx property,
 * allowing it to work with selectors and transforms that check `instanceof AbcDocument`.
 */
export class AbclDocument extends AbcDocument {
  constructor(document: TextDocument) {
    super(document);
  }

  /**
   * Override analyze() to use linear mode parsing.
   *
   * In linear mode, voice changes indicate system breaks and voices are
   * discovered dynamically as they appear in the source.
   *
   * @returns an array of semantic tokens or void.
   */
  override analyze() {
    const source = String.raw`${this.document.getText()}`;

    this.ctx.errorReporter.resetWarnings();
    this.ctx.errorReporter.resetErrors();
    this.diagnostics = [];
    this.tokens = [];

    // Use standard ABC scanner and parser with linear mode enabled
    const tokens = Scanner(source, this.ctx);
    this.AST = parse(tokens, this.ctx, { linear: true });

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
