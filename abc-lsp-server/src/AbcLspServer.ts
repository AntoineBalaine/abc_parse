import { AbcFormatter, RhythmVisitor, Transposer } from "abc-parser";
import { HandlerResult, Position, Range, SemanticTokens, SemanticTokensBuilder, TextDocuments, TextEdit } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { AbcDocument } from "./AbcDocument";
import { AbcxDocument } from "./AbcxDocument";
import { AbctDocument } from "./AbctDocument";
import { LspEventListener, mapTTtoStandardScope, mapAbctTokenToScope } from "./server_helpers";
/** Common interface for ABC, ABCx, and ABCT documents */
type DocumentType = AbcDocument | AbcxDocument | AbctDocument;

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
   * Supports both ABC (.abc) and ABCx (.abcx) documents.
   */
  abcDocuments: Map<string, DocumentType> = new Map();
  constructor(
    private documents: TextDocuments<TextDocument>,
    private listener: LspEventListener
  ) {
    this.documents.onDidChangeContent((change) => {
      this.onDidChangeContent(change.document.uri);
    });

    this.documents.onDidClose((event) => {
      this.abcDocuments.delete(event.document.uri);
    });
  }

  /**
   * Checks if a URI refers to an ABCx file
   */
  private isAbcxFile(uri: string): boolean {
    return uri.toLowerCase().endsWith(".abcx");
  }

  /**
   * Checks if a URI refers to an ABCT file
   */
  private isAbctFile(uri: string): boolean {
    return uri.toLowerCase().endsWith(".abct");
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
        // Create appropriate document type based on file extension
        if (this.isAbctFile(uri)) {
          abcDocument = new AbctDocument(document);
        } else if (this.isAbcxFile(uri)) {
          abcDocument = new AbcxDocument(document);
        } else {
          abcDocument = new AbcDocument(document);
        }
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

    // ABCT documents have a different token format
    if (abcDocument instanceof AbctDocument) {
      for (const token of abcDocument.tokens) {
        const scope = mapAbctTokenToScope(token.type);
        if (scope >= 0) {
          builder.push(
            token.line - 1, // Convert from 1-based to 0-based
            token.column - 1, // Convert from 1-based to 0-based
            token.length,
            scope,
            0
          );
        }
      }
    } else {
      // ABC and ABCx documents
      for (const token of abcDocument.tokens) {
        const scope = mapTTtoStandardScope(token.type);
        if (scope === -1) continue;

        // Handle multi-line tokens by splitting them across lines
        if (token.lexeme.includes("\n")) {
          const lines = token.lexeme.split("\n");
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].length === 0) continue;
            builder.push(
              token.line + i,
              i === 0 ? token.position : 0,
              lines[i].length,
              scope,
              0
            );
          }
        } else {
          builder.push(
            token.line,
            token.position,
            token.lexeme.length,
            scope,
            0
          );
        }
      }
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
