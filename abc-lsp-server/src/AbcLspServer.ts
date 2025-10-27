import { AbcFormatter, RhythmVisitor, Transposer } from "abc-parser";
import { HandlerResult, Position, Range, SemanticTokens, SemanticTokensBuilder, TextDocuments, TextEdit } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { AbcDocument } from "./AbcDocument";
import { LspEventListener, mapTTtoStandardScope } from "./server_helpers";

/**
 * Type definition for a selection range in a document
 */
export interface SelectionRange {
  start: Position;
  end: Position;
  active: Position;
  anchor: Position;
}

/**
 * Parameters for ABC transformation commands
 */
export interface AbcTransformParams {
  selection: SelectionRange;
  uri: string;
}

/**
 * Storage for abc scores, their diagnostics,
 * and access for handlers for SemanticTokens, Formatting, and RhythmTransform.
 */
export class AbcLspServer {
  /**
   * A hashmap of abc scores stored by the server.
   * Uses the document's uri as key to index the scores.
   */
  abcDocuments: Map<string, AbcDocument> = new Map();
  constructor(private documents: TextDocuments<TextDocument>, private listener: LspEventListener) {
    this.documents.onDidChangeContent((change) => {
      this.onDidChangeContent(change.document.uri);
    });

    this.documents.onDidClose((event) => {
      this.abcDocuments.delete(event.document.uri);
    });
  }

  /**
   * Get the updated changes in the document,
   * parse it and send diagnostics to the client.
   * @param uri
   */
  onDidChangeContent(uri: string) {
    let abcDocument = this.abcDocuments.get(uri);
    if (!abcDocument) {
      const document = this.documents.get(uri);
      if (document) {
        abcDocument = new AbcDocument(document);
        this.abcDocuments.set(uri, abcDocument);
      }
    }

    if (abcDocument) {
      abcDocument.analyze();
      this.listener("diagnostics", {
        uri: uri,
        diagnostics: abcDocument.diagnostics,
      });
    }
  }

  /**
   * Handler for Semantic Tokens request
   *
   * Find the requested document and build its semantic tokens for syntax highlighting.
   * @param uri of the document
   * @returns SemanticTokens
   */
  onSemanticTokens(uri: string): HandlerResult<SemanticTokens, void> {
    const abcDocument = this.abcDocuments.get(uri); // find doc in previously parsed docs
    if (!abcDocument || !abcDocument.tokens) {
      return { data: [] };
    }

    const builder = new SemanticTokensBuilder();

    for (const token of abcDocument.tokens) {
      builder.push(
        token.line,
        token.position,
        token.lexeme.length,
        mapTTtoStandardScope(token.type), // typeId
        0
      );
    }

    return builder.build();
  }

  /**
   * Handler for Formatting request
   *
   * Find the requested document and format it using the {@link AbcFormatter}.
   * returns an array of {@link TextEdit}s.
   */
  onFormat(uri: string): HandlerResult<TextEdit[], void> {
    const abcDocument = this.abcDocuments.get(uri); // find doc in previously parsed docs
    if (!abcDocument || !abcDocument.tokens || abcDocument.ctx.errorReporter.hasErrors()) {
      return [];
    }

    const formatted = new AbcFormatter(abcDocument.ctx).formatFile(abcDocument.AST!);
    const edit = TextEdit.replace(Range.create(Position.create(0, 0), Position.create(Number.MAX_VALUE, Number.MAX_VALUE)), formatted);
    return [edit];
  }

  /**
   * Handler for transposition
   *
   * @param uri Document URI
   * @param dist Distance to transpose (in semitones)
   * @param range Selection range
   * @returns Array of TextEdits
   */
  onTranspose(uri: string, dist: number, range: SelectionRange): HandlerResult<TextEdit[], void> {
    const abcDocument = this.abcDocuments.get(uri); // find doc in previously parsed docs
    if (!abcDocument || !abcDocument.tokens) {
      return [];
    }
    const transposer = new Transposer(abcDocument.AST!, abcDocument.ctx);
    const selectionRange = Range.create(range.start, range.end);
    const edit = TextEdit.replace(selectionRange, transposer.transpose(dist, selectionRange));
    return [edit];
  }

  /**
   * Handler for Abc client's custom command for rhythm transformation
   *
   * Find the requested document and multiply/divide the rhythm of the selected range.
   *
   * Returns an array of {@link TextEdit}s.
   */
  onRhythmTransform(uri: string, type: "*" | "/", range: SelectionRange): HandlerResult<TextEdit[], void> {
    const abcDocument = this.abcDocuments.get(uri); // find doc in previously parsed docs
    if (!abcDocument || !abcDocument.tokens) {
      return [];
    }
    const visitor = new RhythmVisitor(abcDocument.AST!, abcDocument.ctx);
    const selectionRange = Range.create(range.start, range.end);
    visitor.transform(type, selectionRange);

    const edit = TextEdit.replace(selectionRange, visitor.getChanges());
    return [edit];
  }

  /**
   * Helper for onCompletion handler.
   * Use the uri to find the document and the character at line and char position.
   * @param uri
   * @param char
   * @param line
   * @returns string
   */
  findCharInDoc(uri: string, char: number, line: number) {
    const abcDocument = this.abcDocuments.get(uri); // find doc in previously parsed docs
    if (!abcDocument || !abcDocument.tokens) {
      return [];
    }
    const doc = abcDocument.document;
    const lineText = doc.getText().split("\n")[line];
    const charIndex = lineText.indexOf(String.fromCharCode(char));
    return lineText.charAt(char);
  }
}
